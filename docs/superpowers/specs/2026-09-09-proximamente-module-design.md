# Próximamente (Coming Soon) — Spec de diseño
**Fecha:** 2026-09-09
**Estado:** Aprobado para implementación

---

## Resumen

Módulo nuevo que permite marcar productos como "Próximamente" — **de a uno
desde el buscador, o una categoría/subcategoría completa desde el árbol de
categorías**. En la tienda se muestran con un badge distintivo, **sin precio
visible**, **sin poder comprarse**, y con una **cuenta regresiva** hasta la
fecha de lanzamiento en la ficha del producto. Opcionalmente, la ficha incluye un formulario
"Avisame cuando esté disponible" que captura emails de interesados (exportables
a CSV). Al llegar la fecha de lanzamiento el producto **vuelve solo** a su estado
normal (precio visible, comprable).

Sigue el patrón end-to-end de "Precios y Cuotas" (`functions/price-financing.js`):
módulo backend propio + colección Firestore propia + bootstrap script propio
registrado en Partners + widget JS dinámico multi-tenant gateado por suscripción.
**El widget no muestra ningún branding** (ni PromoNube ni GlowLab).

El bloqueo de compra es de doble candado: cosmético en el widget **y** pausando
el producto vía API de Tiendanube (stock 0 + stock_management), con snapshot y
restauración cuidada.

---

## Arquitectura

### Almacenamiento (Firestore)

- **Doc por tienda:** `promonube_coming_soon/{storeId}`
- **Leads:** subcolección `promonube_coming_soon/{storeId}/leads/{autoId}`

### Backend

- **Módulo nuevo:** `functions/coming-soon.js`, exporta
  `registerComingSoonRoutes(app, { db, FieldValue, checkStoreActive })`.
- **Wiring:** en `functions/index.js`, junto a las líneas de `price-financing` /
  `search` (~línea 763):
  ```js
  const { registerComingSoonRoutes } = require('./coming-soon');
  registerComingSoonRoutes(app, { db, FieldValue, checkStoreActive });
  ```
- Acceso a la API de Tiendanube: `accessToken` de
  `promonube_stores/{storeId}.accessToken`, base `https://api.tiendanube.com/2025-03/{storeId}/...`,
  header `User-Agent: "GlowLab (info@techdi.com.ar)"` (igual que price-financing).

### Bootstrap script (Tiendanube Partners)

- Registrar **a mano** en Partners (Aplicaciones → GlowLab #23137 → Scripts) un
  script nuevo: **"Próximamente"**, `location: storefront`, que apunta a
  `https://glowlab-production.up.railway.app/api/coming-soon-widget.js?store=` + storeId.
- El `script_id` numérico resultante va en una constante `COMING_SOON_SCRIPT_ID`
  en `functions/coming-soon.js`, marcada con `// TODO: completar con el id real de Partners`.
- Igual que en price-financing: con instalación automática apagada, cada tienda
  se activa con `POST /2025-03/{storeId}/scripts { script_id }`.
- El bootstrap en sí (archivo estático subido a Partners) sigue el molde de
  `price-financing-version.js`: detecta `storeId` y carga el widget. Se agrega a
  la raíz del repo como `coming-soon-version.js` para tenerlo versionado.

### Frontend (admin)

- **Página:** `src/pages/ComingSoonConfig.jsx` + `ComingSoonConfig.css`
- **Ruta:** `/proximamente` en `src/App.jsx`
- **Sidebar:** entrada "Próximamente" en `BASE_NAV_ITEMS` de
  `src/components/Sidebar.jsx`, ícono `Rocket` de lucide-react.
- Búsqueda de productos: hook existente `useProductPicker(storeId)` →
  `GET /api/tiendanube/products/search?storeId=&q=`.
- Árbol de categorías: endpoint existente `GET /api/tiendanube/categories?storeId=`
  (devuelve `id`, `name`, `parent` → se arma el árbol en el cliente).
- Productos de una categoría: endpoint existente
  `GET /api/tiendanube/category-products?storeId=&categoryId=` (id, name,
  canonical_url, images, variants).

### Endpoints nuevos

| Endpoint | Uso | Auth |
|---|---|---|
| `GET /api/coming-soon-config?storeId=X` | Config para el admin React | — |
| `POST /api/coming-soon-config` | Guardar config (body `{ storeId, config }`) | — |
| `GET /api/coming-soon-widget.js?store=X` | Script servido a la tienda | `checkStoreActive` + `enabled` |
| `POST /api/coming-soon/install` | Asocia el script a la tienda (`{ storeId }`) | `checkStoreActive` |
| `POST /api/coming-soon/products/:productId/launch` | "Lanzar ahora" — restaura stock + marca launched (`{ storeId }`) | — |
| `POST /api/coming-soon/subscribe` | Alta de lead desde el widget (`{ store, productId, email }`) | pública + rate-limit + validación de email |
| `GET /api/coming-soon/leads.csv?storeId=X` | Export CSV de todos los leads de la tienda | — |

(El resto de endpoints del proyecto tampoco tienen auth de admin; se mantiene la
convención existente. `subscribe` sí valida formato de email y limita a
~5 req/min por IP+store para evitar spam.)

---

## Config shape

```js
// promonube_coming_soon/{storeId}
{
  enabled: false,

  // --- Estilo global (todo configurable) ---
  style: {
    // Badge
    badgeText: 'PRÓXIMAMENTE',
    badgeShape: 'ribbon',        // 'ribbon' | 'pill' | 'corner' | 'tag'
    badgePosition: 'top-left',   // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    badgeBg: '#111111',
    badgeTextColor: '#ffffff',
    badgeFontFamily: 'inherit',
    badgeFontSize: 12,
    badgeUppercase: true,

    // Precio oculto → cartel de reemplazo
    priceReplaceText: 'Disponible pronto',
    priceReplaceColor: '#111111',
    priceReplaceFontSize: 14,
    priceShowDate: true,         // añade "· 15/03" con la launchDate del producto

    // Countdown (ficha de producto)
    countdownEnabled: true,
    countdownLayout: 'boxes',    // 'boxes' | 'inline'
    countdownUnits: ['days','hours','minutes','seconds'],
    countdownDigitsColor: '#111111',
    countdownLabelsColor: '#777777',
    countdownAccentColor: '#111111',
    countdownFontFamily: 'inherit',
    countdownSize: 'md',         // 'sm' | 'md' | 'lg'
    countdownHeading: 'Lanzamiento en',

    // Formulario "Avisame"
    notifyEnabled: true,
    notifyHeading: '¿Querés que te avisemos?',
    notifyPlaceholder: 'Tu email',
    notifyButtonText: 'Avisarme',
    notifySuccessText: '¡Listo! Te avisamos cuando esté disponible.',
    notifyBg: '#f5f5f5',
    notifyTextColor: '#111111',
    notifyButtonBg: '#111111',
    notifyButtonTextColor: '#ffffff',
  },

  // --- Categorías agregadas como "próximamente" (para agrupar en el admin
  //     y para el botón "Actualizar productos de la categoría") ---
  categories: [
    {
      categoryId: '987654',
      categoryName: 'Colección Verano',
      launchDate: '2026-12-01T09:00:00',
      message: '',
      addedAt: '2026-09-09T14:00:00Z',
      lastSyncedAt: '2026-09-09T14:00:00Z'
    }
  ],

  // --- Productos marcados (uno por producto, sea que se agregó suelto o vía categoría) ---
  products: [
    {
      productId: '123456789',
      productName: 'Zapatilla X',
      productImage: 'https://...',
      launchDate: '2026-10-01T10:00:00',   // OBLIGATORIA (fecha + hora, hora local de la tienda)
      message: '',                         // opcional; pisa priceReplaceText para ese producto
      source: 'manual',                    // 'manual' | 'category'
      sourceCategoryId: null,              // '987654' si source === 'category'
      status: 'scheduled',                 // 'scheduled' | 'launched'
      stockSnapshot: [                     // capturado al activar; usado para restaurar
        { variantId: '111', stock: 8,  stockManagement: true },
        { variantId: '222', stock: 3,  stockManagement: true }
      ],
      pausedAt: '2026-09-09T14:00:00Z',    // cuándo se pausó vía API
      launchedAt: null
    }
  ],

  updatedAt: <serverTimestamp>
}
```

**`message` por producto:** si tiene valor, se usa como texto del cartel que
reemplaza el precio para ese producto (ej. "Lanzamiento exclusivo socios"). El
resto del estilo es global.

### Lead (subcolección)

```js
// promonube_coming_soon/{storeId}/leads/{autoId}
{ productId: '123456789', email: 'cliente@mail.com', createdAt: <serverTimestamp>, userAgent: '...' }
```

---

## Bloqueo de compra — pausar / restaurar vía API

### Al activar un producto (se agrega a `products` y `enabled` global, o al guardar con un producto nuevo)

1. `GET /2025-03/{storeId}/products/{productId}` → leer `variants[]`.
2. Por cada variante, guardar en `stockSnapshot`: `{ variantId, stock, stockManagement }`
   (de `variant.stock` y `variant.stock_management`).
3. Por cada variante, `PUT /2025-03/{storeId}/products/{productId}/variants/{variantId}`
   con `{ stock: 0, stock_management: true }`.
4. Setear `status: 'scheduled'`, `pausedAt: now`.
5. **El precio NO se toca.** El precio real queda en el catálogo para estar
   correcto en el momento del lanzamiento.

### Al lanzar (automático por fecha, o botón "Lanzar ahora")

Función pura `buildStockRestorePlan(snapshot, currentVariants)`:

- Por cada variante del snapshot:
  - Si la variante **ya no existe** en el producto → se ignora.
  - Si `currentVariant.stock === 0` (nadie la tocó) → restaurar
    `{ stock: snapshot.stock, stock_management: snapshot.stockManagement }`.
  - Si `currentVariant.stock !== 0` (el dueño editó el stock a mano en el medio)
    → **no tocar**, se respeta su valor.
- Aplicar los `PUT` resultantes.
- Setear `status: 'launched'`, `launchedAt: now`. El producto queda en el array
  con `status: 'launched'` (histórico) hasta que el dueño lo quite; el widget y
  la reconciliación lo ignoran.

### Errores

- Producto borrado en Tiendanube (`404`) → quitar del array, log, seguir.
- Error de red en un `PUT` → reintentar 1 vez; si falla, dejar el producto como
  está y registrar `lastError` en el item (visible en el admin).

---

## Auto-reversión por fecha

### Reconciliación (función central)

`reconcileStore(storeId, config)`:
1. Para cada producto con `status === 'scheduled'` y `launchDate <= now`:
   ejecutar el flujo "Al lanzar".
2. Persistir el config actualizado.
Idempotente: si ya está `launched`, no hace nada.

### Disparadores

1. **Timer en proceso (Railway):** dentro del bloque `if (require.main === module)`
   de `functions/index.js`, un `setInterval` cada **5 minutos** que hace un
   `collectionGroup`/scan de `promonube_coming_soon` con al menos un producto
   `scheduled` y llama `reconcileStore` para cada uno.
   - Se registra desde `coming-soon.js` vía una función exportada
     `startComingSoonScheduler({ db, ... })` que `index.js` llama solo en ese bloque.
   - Si Railway corriera >1 instancia, el timer corre duplicado → **inocuo**
     porque `reconcileStore` es idempotente y los `PUT` de restauración también.
2. **Lazy (backstop):** al principio de `GET /api/coming-soon-widget.js` y de
   `GET /api/coming-soon-config` se llama `reconcileStore(storeId, config)` antes
   de responder. Best-effort (el CDN puede servir `widget.js` cacheado hasta 60s
   sin pegarle al origin); el camino confiable es el timer de 5 min. En la
   ventana entre que pasa la fecha y corre el timer, el widget igual **deja de
   ocultar** el producto client-side (filtra `launchDate` pasada), aunque el
   stock recién se restaura al reconciliar.

---

## Widget en la tienda (`/api/coming-soon-widget.js`) — hecho de cero

### Handler backend

```
GET /api/coming-soon-widget.js?store=X
- Content-Type: application/javascript; charset=utf-8
- Cache-Control: public, max-age=60, s-maxage=60
- Sin store → comentario
- checkStoreActive(store) falso → comentario "plan inactivo"
- reconcileStore(store, cfg)  // backstop
- cfg.enabled === false → comentario "deshabilitado"
- Filtrar products a status==='scheduled' con launchDate futura
- Sin productos → comentario "sin productos"
- Enviar buildWidgetScript(store, { style, products: [{ productId, launchDate, message }] })
```

El widget recibe **solo** lo necesario embebido (sin precios, sin snapshots).
No hace API calls en runtime salvo `POST /api/coming-soon/subscribe`.

### Comportamiento del script

- Guard de instancia única: `window.__pnComingSoonLoaded`.
- Detecta contexto con `window.LS`: `LS.product` → PDP, si no → listado.
- `TARGET = Set(products.map(p => String(p.productId)))`.

**En listado** (selectores tipo `[data-item-id]`, `.product-item`, `.item-product`,
`[data-product-id]` — misma lista que price-financing):
- Para cada card cuyo id ∈ TARGET:
  1. Badge: crear un `<div>` **wrapper posicionado** sobre el contenedor de
     imagen (el `<a>`/`<figure>` que envuelve al `<img>`), con `position:relative`
     en el wrapper y el badge como **hijo del wrapper, nunca del `<img>`**
     (fix del bug viejo). Si el contenedor de imagen ya es posicionable se usa
     ese; si no, se envuelve el `<img>` en un span posicionado una sola vez.
  2. Ocultar el nodo de precio (`display:none` en el/los nodos de precio del card).
  3. Deshabilitar compra: ocultar/`disabled` en botones "Comprar"/"Agregar"
     dentro del card; `pointer-events:none` en el form de add-to-cart.
- Reproceso con `MutationObserver` debounced (100ms), igual que price-financing.

**En PDP** (`LS.product.id ∈ TARGET`):
  1. Badge cerca del nombre del producto (`.product-name`, `h1`, `[data-store="product-name"]`).
  2. Ocultar el bloque de precio (lista de selectores de price-financing) y, en su
     lugar, insertar el **cartel de reemplazo** (`message` del producto ||
     `style.priceReplaceText`, + fecha si `priceShowDate`).
  3. Ocultar/deshabilitar el form de compra (`[data-store="product-buy-form"]`,
     `.js-addtocart`, botón "Comprar", selector de cantidad).
  4. Si `style.countdownEnabled`: render del **countdown** a `launchDate`
     (tick cada 1s). Al llegar a 0: `clearInterval`, quitar overlays y
     `location.reload()` (el backend ya habrá restaurado el stock por lazy/timer).
  5. Si `style.notifyEnabled`: render del formulario "Avisame" debajo del
     countdown. `submit` → `POST /api/coming-soon/subscribe` con
     `{ store, productId, email }` → mostrar `notifySuccessText`. Validación de
     email en cliente; el backend revalida.

**Variantes** (fix del bug viejo): el estado del widget en PDP se re-aplica al
cambiar de variante. Se escucha:
- el evento de cambio de variante de la tienda si existe (`LS` dispara eventos en
  el `<form>`; escuchar `change` en el selector de variantes), y
- el `MutationObserver` general (debounced) como red.
En cada re-aplicación se comprueba idempotencia por flags `data-pn-cs-*` en los
nodos ya tratados, así no se duplican badges ni carteles.

**CSS:** un único `<style id="pn-cs-styles">` inyectado una vez, todo con
`!important` y `box-sizing`, scopeado a clases `.pn-cs-*` (mismo enfoque que
`pn-pf-*`). Sin `@import` de fuentes salvo que `badgeFontFamily`/`countdownFontFamily`
sea una Google Font conocida y no esté ya presente.

**Sin branding:** ningún texto "PromoNube"/"GlowLab" en el DOM ni en los
comentarios visibles del bundle servido a la tienda.

---

## Página de configuración — Secciones

### 1. General
- Toggle activar/desactivar el módulo.
- Botón "Activar en mi tienda" → `POST /api/coming-soon/install` (igual que el de
  price-financing; muestra estado instalado/no instalado).
- Aviso: "Los productos marcados quedan sin stock hasta la fecha de lanzamiento."

### 2. Productos y categorías

**Dos formas de agregar:**

1. **Producto suelto** — buscador (`useProductPicker`) → se agrega un item a
   `products` con `source: 'manual'`.
2. **Categoría / subcategoría completa** — se despliega el árbol de categorías
   (armado desde `GET /api/tiendanube/categories`, anidando por `parent`). Se
   elige una categoría, una `launchDate` y un mensaje opcional, y "Agregar":
   - Se llama `GET /api/tiendanube/category-products?storeId=&categoryId=`.
   - Cada producto de la categoría se agrega a `products` con
     `source: 'category'`, `sourceCategoryId`, y la `launchDate`/`message` de la
     categoría.
   - Se agrega una entrada a `categories` para poder agrupar la vista y ofrecer
     "Actualizar productos de la categoría".
   - Seleccionar una categoría padre **no** arrastra automáticamente las
     subcategorías; cada nivel se agrega explícitamente (evita sorpresas).

**Membresía de categoría:** la expansión es **al agregar/guardar** (mismo patrón
que Flash Sale). Los productos que entren a la categoría más tarde **no** se
marcan solos — el dueño usa el botón "Actualizar productos de la categoría"
(re-fetchea y agrega los nuevos; los que salieron de la categoría se listan para
que decida si liberarlos). Cambiar la `launchDate` de una entrada de `categories`
propaga la nueva fecha a todos sus productos `source: 'category'` no lanzados.

**Vista agrupada:** los productos que vienen de una categoría se muestran
colapsados bajo el nombre de la categoría (con acciones a nivel grupo: cambiar
fecha, lanzar todos, quitar todos). Los productos sueltos van en su propia lista.

- Por producto (fila):
  - Imagen + nombre.
  - `launchDate` — input `datetime-local`, **obligatorio** (no se puede guardar sin fecha).
  - Mensaje opcional (pisa el cartel de precio para ese producto).
  - Estado: `Programado` (con "faltan X días") / `En vivo` (fecha ya pasó pero aún no reconciliado) / `Lanzado`.
  - Botón "Lanzar ahora" → `POST /api/coming-soon/products/:productId/launch`.
  - Botón quitar (restaura stock si estaba pausado, luego lo saca del array).
- Validación al guardar: todo producto en la lista debe tener `launchDate` válida y futura (salvo los ya `launched`).

### 3. Estilo — Badge
- Texto, forma (ribbon/pill/corner/tag), posición, color fondo, color texto,
  tipografía, tamaño, mayúsculas on/off.
- Preview en vivo.

### 4. Estilo — Precio oculto
- Texto de reemplazo, color, tamaño, "mostrar fecha de lanzamiento" on/off.

### 5. Estilo — Countdown
- On/off, layout (cajas/inline), qué unidades mostrar (días/hs/min/seg),
  color dígitos, color labels, color acento, tipografía, tamaño (sm/md/lg),
  encabezado.
- Preview en vivo.

### 6. Estilo — Formulario "Avisame"
- On/off, encabezado, placeholder, texto botón, texto de éxito,
  color fondo, color texto, color botón, color texto botón.

### 7. Leads
- Tabla: producto · cantidad de interesados.
- Botón "Descargar CSV" → `GET /api/coming-soon/leads.csv?storeId=X`
  (columnas: `producto_id, producto_nombre, email, fecha`).

---

## Flujo de guardado

1. El admin edita estilo / agrega productos / setea fechas.
2. "Guardar" → `POST /api/coming-soon-config { storeId, config }`.
3. Backend, en el `POST`:
   a. Diff contra el config actual: productos **nuevos** (sueltos o expandidos de
      una categoría) o el módulo pasando de `enabled:false` a `true` → ejecutar
      "Al activar un producto" (snapshot + pausa).
   b. Productos **quitados** → restaurar stock (plan de restauración) antes de sacarlos.
   c. Persistir el config (con snapshots/estados actualizados).
4. Cache del widget expira en 60s → la tienda refleja los cambios.

La expansión de una categoría a productos individuales se hace en el **cliente**
(llama a `category-products` y arma el array) antes del `POST`; el backend solo
ve productos. "Actualizar productos de la categoría" repite ese paso para una
`categoryId` puntual sin tocar el resto del form.

"Lanzar ahora" y quitar producto operan directo sobre el doc + API, sin pasar por
el form completo.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `functions/coming-soon.js` | Crear — rutas + widget builder + reconciliación + scheduler + helpers puros |
| `functions/index.js` | 2 líneas de wiring (~L763) + llamar `startComingSoonScheduler` en el bloque `require.main === module` |
| `functions/coming-soon.test.js` | Crear — tests de las funciones puras |
| `coming-soon-version.js` (raíz) | Crear — bootstrap para subir a Partners (molde: `price-financing-version.js`) |
| `src/pages/ComingSoonConfig.jsx` | Crear |
| `src/pages/ComingSoonConfig.css` | Crear |
| `src/App.jsx` | Agregar `import` + `<Route path="/proximamente">` |
| `src/components/Sidebar.jsx` | Agregar item "Próximamente" (ícono `Rocket`) a `BASE_NAV_ITEMS` |

No se modifican módulos existentes. Colección Firestore nueva: `promonube_coming_soon`.

---

## Testing

### `node --test` — funciones puras en `functions/coming-soon.js`

- `isPastLaunch(launchDate, now)` — límites exactos, timezone.
- `buildStockRestorePlan(snapshot, currentVariants)`:
  - restaura cuando `currentStock === 0`;
  - respeta ediciones manuales (`currentStock !== 0`);
  - ignora variantes inexistentes;
  - snapshot vacío → plan vacío.
- `diffProducts(prevConfig, nextConfig)` → qué productos activar / restaurar
  (incluye los que llegan expandidos desde una categoría).
- `expandCategoryToProducts(categoryProducts, { launchDate, message, categoryId })`
  → items de `products` bien formados, sin duplicar los que ya están.
- `propagateCategoryDate(config, categoryId, newDate)` → actualiza la fecha de
  los productos `source:'category'` no lanzados de esa categoría.
- `shapeWidgetConfig(cfg)` → el payload del widget NO incluye precios ni
  `stockSnapshot`, y excluye productos `launched` o con `launchDate` pasada.
- `leadsToCsv(rows)` → escaping de comas/comillas/saltos de línea.
- `validateLaunchDate(value, now)` → rechaza vacío / pasado / formato inválido.

### QA manual (checklist en un theme real)

- [ ] Listado: badge fuera del `<img>`, precio oculto, botón comprar deshabilitado.
- [ ] PDP: badge, cartel de precio, countdown, form "Avisame".
- [ ] Cambiar de variante en PDP no duplica ni rompe el layout.
- [ ] Forzar el producto al carrito por URL → no se puede (stock 0) y el widget lo limpia.
- [ ] Llega la fecha → el producto vuelve a normal solo (precio + compra) sin recargar el panel.
- [ ] "Lanzar ahora" restaura al instante.
- [ ] Quitar producto restaura el stock.
- [ ] Agregar una categoría marca todos sus productos actuales (cada uno con su snapshot).
- [ ] "Actualizar productos de la categoría" incorpora los productos nuevos de la categoría.
- [ ] Cambiar la fecha de una categoría propaga a sus productos no lanzados.
- [ ] Editar el stock a mano durante el prelanzamiento → al lanzar se respeta ese valor.
- [ ] CSV de leads descarga con datos correctos.
- [ ] Plan inactivo / módulo deshabilitado → widget no hace nada.

---

## Restricciones y límites

- `launchDate` es hora local de la tienda (Argentina). Se guarda como string
  `YYYY-MM-DDTHH:mm:ss` sin zona; el countdown y la reconciliación asumen
  `America/Argentina/Buenos_Aires`.
- Máximo sugerido ~50 productos por tienda en "Próximamente" (límite blando; el
  scan del scheduler y el bundle del widget escalan lineal).
- `GET /api/tiendanube/category-products` hoy trae `per_page=50` sin paginar: si
  una categoría tiene más de 50 productos, la implementación debe paginar ese
  endpoint (o crear una variante) para no marcar la categoría a medias.
- El bloqueo de compra depende de `stock_management`: productos configurados para
  vender sin control de stock quedan igualmente en `stock:0 + stock_management:true`
  y se restaura el estado original al lanzar.
- El widget no corre en checkout (detección por URL `/checkout`).
- Una vez publicada la app, el script "Próximamente" debe existir en el catálogo
  de Partners antes de poder asociarlo por tienda (no se crean scripts ad-hoc).
- Sin envío automático de emails a los leads en v1 (solo export CSV). Queda para v2.
