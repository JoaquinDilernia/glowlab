# Grupos de Variantes por SKU — Spec de diseño
**Fecha:** 2026-09-11
**Estado:** Aprobado para implementación
**Alcance:** solo Alto Rancho (tienda real) + tienda demo. Módulo oculto para el resto de los clientes (ver "Allowlist").

---

## Resumen

Alto Rancho no usa variantes nativas de Tiendanube para el color: cada color de
un mismo mueble es un **producto individual** con su propio SKU (ej. `BCV136PT`,
`BCV136NT`, `BCV136NG` = misma silla, colores Pintado/Natural/Negro). Hoy usan
una app de terceros ("Administrar Grupos") para armar manualmente, grupo por
grupo, la agrupación que se muestra como swatches de color en la vidriera — con
189 grupos ya cargados a mano, y una importación por Excel que exige el **ID
interno de producto** (dato que no se ve en ningún lado del admin de Tiendanube
salvo en la URL), así que tampoco es una vía realista para mantenerlo al día.

Este módulo reemplaza ese flujo por **agrupado automático por SKU**: se le saca
al SKU el sufijo de color (los últimos 2 caracteres) y todo lo que comparte la
raíz (`BCV136`) se propone como un mismo grupo. El admin corre un escaneo bajo
demanda, revisa/edita la propuesta (nunca se publica nada sin que el dueño lo
vea) y publica. La tienda muestra swatches de color (mini-foto de cada
variante) en el listado y en la ficha de producto, igual que hace la app vieja
pero con mejor UX de mantenimiento.

Sigue el patrón end-to-end de `functions/price-financing.js` /
`functions/coming-soon.js`: módulo backend propio + colección Firestore propia
+ bootstrap script propio registrado en Partners + widget JS dinámico gateado
por suscripción. **El widget no muestra ningún branding** (ni PromoNube ni
GlowLab).

---

## Algoritmo de agrupado (funciones puras, testeables)

### `splitSku(sku, { suffixLength = 2, minGroupKeyLength = 3 } = {})`

- `sku` inválido (vacío, no string) → `null`.
- Se toma `colorCode = sku.slice(-suffixLength)` y `groupKey = sku.slice(0, -suffixLength)`.
- Si `groupKey.length < minGroupKeyLength` → `null` (SKU demasiado corto para
  que la raíz signifique algo; ej. un SKU de 3 caracteres no alcanza).
- Devuelve `{ groupKey, colorCode }`. Regla **fija**, no configurable (decisión
  tomada: simplicidad > flexibilidad para v1).

### `computeSkuGroups(products)`

- `products`: `[{ productId, sku, name, image, url }]` — un item por producto
  de Tiendanube, usando el SKU de su variante por defecto (ver "Supuesto: 1
  producto = 1 SKU" más abajo).
- Aplica `splitSku` a cada uno. Los que dan `null` van directo a `ungrouped`.
- Agrupa por `groupKey`. **Un grupo de 1 solo producto no es un grupo** (no hay
  nada para swatchear) → esos también van a `ungrouped`.
- Para cada grupo con 2+ productos: `title = deriveGroupTitle(products.map(p => p.name))`.
- Devuelve `{ groups: [{ groupKey, title, products }], ungrouped: [...] }`.

### `deriveGroupTitle(names)`

- Prefijo común más largo de los nombres, recortado a la última palabra
  completa (ej. `"Silla Rey Rojo"`, `"Silla Rey Natural"` → `"Silla Rey"`).
- Si no hay prefijo común útil (< 2 palabras), se usa el primer nombre tal cual
  como fallback — el título es 100% editable a mano en la revisión de todos
  modos, esto es solo una propuesta inicial.

### `diffScanWithPublished(scanResult, publishedGroups)`

Para el botón "Volver a escanear" — no debe pisar ediciones manuales ya
publicadas:

- Por cada grupo escaneado cuyo `groupKey` **ya existe** en `publishedGroups`:
  compara sus `products` contra los del grupo publicado (menos su
  `excludedProductIds`) → los que son nuevos se listan como **"productos
  nuevos para agregar"** a ese grupo (se muestran en la revisión, no se
  agregan solos).
- Por cada grupo escaneado cuyo `groupKey` **no existe todavía** publicado →
  se propone como **grupo nuevo**.
- Productos que estaban en un grupo publicado pero ya no aparecen en el
  catálogo (borrados/despublicados en Tiendanube) → se listan como
  **"ya no existen"** para que el dueño los saque del grupo si quiere.
- Nunca se re-sugiere un producto que esté en `excludedProductIds` de un grupo
  publicado (así "sacar del grupo" en la revisión es permanente hasta que el
  dueño lo revierta a mano).

### `buildWidgetIndex(publishedGroups)`

Transforma los grupos publicados (visibles, no ocultos) en el payload que
consume la vidriera: `{ [productId]: { groupKey, siblings: [{ productId, url,
image, active }] } }` — `siblings` incluye al propio producto (marcado
`active`) para que el widget no tenga que hacer lookups extra.

### Supuesto: 1 producto = 1 SKU

Alto Rancho no usa variantes de Tiendanube para color (por eso existe este
módulo). Si un producto tiene más de una variante, se usa el SKU de la
**primera variante** y se lo trata igual; productos sin ninguna variante (o sin
SKU) van directo a `ungrouped`. No se soporta en v1 "producto con variantes de
talle **y** SKU de color" simultáneamente — no es el caso de este catálogo hoy.

---

## Arquitectura

### Almacenamiento (Firestore)

- **Doc por tienda:** `promonube_variant_groups/{storeId}`

```js
{
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  swatchSize: 'md',          // 'sm' | 'md' | 'lg'

  groups: [
    {
      groupKey: 'BCV136',
      title: 'Silla Rey',
      hidden: false,
      excludedProductIds: ['555555'],   // sacados a mano en la revisión; no se re-sugieren
      products: [
        { productId: '123456', sku: 'BCV136PT', name: 'Silla Rey Rojo',    image: 'https://...', url: '/productos/silla-rey-rojo' },
        { productId: '123457', sku: 'BCV136NT', name: 'Silla Rey Natural', image: 'https://...', url: '/productos/silla-rey-natural' }
      ]
    }
  ],

  ungrouped: [
    { productId: '999999', sku: 'X1', name: 'Producto suelto', image: 'https://...', url: '/productos/producto-suelto', reason: 'sku_too_short' }
    // reason: 'no_sku' (sin SKU o sin variante) | 'sku_too_short' (splitSku dio null) | 'single_product' (groupKey sin pares)
  ],

  lastScanAt: <serverTimestamp>,
  updatedAt: <serverTimestamp>
}
```

`groups[].products` es la fuente de verdad de qué está publicado (lo que no
está ahí, no se muestra). `excludedProductIds` existe solo para que un
re-escaneo no vuelva a proponer algo que el dueño ya sacó a mano.

### Backend

- **Módulo nuevo:** `functions/variant-groups.js`, exporta
  `registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive })`.
- **Wiring:** en `functions/index.js`, junto a `coming-soon` / `price-financing`:
  ```js
  const { registerVariantGroupsRoutes } = require('./variant-groups');
  registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive });
  ```
- Acceso a Tiendanube: `accessToken` de `promonube_stores/{storeId}.accessToken`,
  base `https://api.tiendanube.com/2025-03/{storeId}/...`, header
  `User-Agent: "GlowLab (info@techdi.com.ar)"` (igual que el resto).
- **Fetch de catálogo completo** (`GET /2025-03/{storeId}/products`), paginado
  con `page` + `per_page=200`, `fields=id,name,images,variants,canonical_url`
  hasta que una página devuelva menos de `per_page` items. Se arma
  `products: [{ productId, sku: variants[0]?.sku, name, image: images[0]?.src,
  url: canonical_url }]` para pasarle a `computeSkuGroups`.

### Allowlist (temporal — solo mientras es piloto de Alto Rancho)

Alto Rancho: `storeId 2547699`. Tienda demo: `storeId 6854698` (confirmados
contra `promonube_stores` en Firestore).

```js
// functions/variant-groups.js
const ALLOWED_STORE_IDS = ['2547699', '6854698'];
```

Cada endpoint nuevo chequea `ALLOWED_STORE_IDS.includes(String(storeId))` al
principio y devuelve `403 { success:false, message:'Módulo no disponible para
esta tienda' }` si no matchea.

En el frontend **ya existe** el mecanismo para esto — `Sidebar.jsx` tiene
`STORE_EXCLUSIVE_ITEMS`, un objeto `{ [storeId]: [...items] }` usado hoy para
"Stock Altorancho" / "Aviso Checkout". Se agrega ahí una entrada para
`'2547699'` con el ítem "Grupos de Variantes", **y se agrega `'6854698'`
(demo) como clave nueva** con el mismo ítem (hoy `STORE_EXCLUSIVE_ITEMS` solo
tiene la entrada de Alto Rancho). Se sigue el mismo patrón existente en vez de
crear una capa de allowlist paralela. `App.jsx`/`VariantGroupsConfig.jsx`
igual valida `ALLOWED_STORE_IDS` (mismos dos IDs, duplicados a mano como ya
pasa con `PRICE_FINANCING_SCRIPT_ID` y similares en este repo) y redirige a
`/dashboard` si el storeId no matchea, por si alguien navega directo a la URL
sin pasar por el menú. **Cuando se decida ofrecerlo a todas las tiendas**, se
saca la entrada de `STORE_EXCLUSIVE_ITEMS` (el ítem pasa a `BASE_NAV_ITEMS`) y
se borra el chequeo de `ALLOWED_STORE_IDS` en backend y frontend — queda
marcado con `// TODO: quitar allowlist cuando se libere a todas las tiendas`.

### Bootstrap script (Tiendanube Partners)

- Registrar a mano en Partners un script nuevo: **"Grupos de Variantes"**,
  `location: storefront`, apuntando a
  `https://glowlab-production.up.railway.app/api/variant-groups-widget.js?store=` + storeId.
- El `script_id` numérico va en `VARIANT_GROUPS_SCRIPT_ID` en
  `functions/variant-groups.js`, marcado `// TODO: completar con el id real de Partners`.
- Con instalación automática apagada: `POST /2025-03/{storeId}/scripts { script_id }`
  vía `POST /api/variant-groups/install`.
- Bootstrap estático (molde `price-financing-version.js`) versionado como
  `variant-groups-version.js` en la raíz del repo.
- **No se instala en Alto Rancho hasta que el dueño lo pida explícitamente**
  (tienen la app vieja activa); se prueba primero en la tienda demo.

### Endpoints nuevos

| Endpoint | Uso |
|---|---|
| `GET /api/variant-groups-config?storeId=X` | Config + grupos publicados + ungrouped para el admin |
| `POST /api/variant-groups-config` | Guardar solo settings (`enabled`, `showOnListing`, `showOnPDP`, `swatchSize`) |
| `POST /api/variant-groups/scan` | `{ storeId }` → escanea el catálogo, devuelve propuesta (diffeada contra lo publicado). **No persiste nada.** |
| `POST /api/variant-groups/publish` | `{ storeId, groups, ungrouped }` → persiste el estado final aprobado en la revisión |
| `POST /api/variant-groups/install` | Asocia el script a la tienda (`{ storeId }`) |
| `GET /api/variant-groups-widget.js?store=X` | Script servido a la tienda (Content-Type JS, cache 60s) |
| `GET /api/variant-groups-data.json?store=X` | JSON de `buildWidgetIndex` que el script pide en runtime (cache 60s) |

Todos, salvo los dos `GET` públicos para la tienda, con el chequeo de
allowlist. Sin auth de admin adicional (mismo criterio que el resto del
proyecto).

---

## Página de configuración (admin) — Secciones

### 1. General
- Toggle activar/desactivar.
- Toggles "Mostrar en listado" / "Mostrar en ficha de producto".
- Tamaño de swatch (chico/mediano/grande).
- Botón "Activar en mi tienda" → `POST /api/variant-groups/install` (mismo
  patrón que Precios y Cuotas / Próximamente).

### 2. Escanear y revisar
- Botón **"Escanear productos"** → `POST /api/variant-groups/scan`. Mientras
  corre (puede tardar por la paginación del catálogo completo): estado de
  carga con texto ("Leyendo catálogo…").
- Resultado, en la misma pantalla (sin navegar):
  - **Grupos propuestos**: una card por grupo con título editable (input de
    texto), miniaturas de cada producto miembro (imagen + SKU + nombre) con
    botón "quitar" (pasa a `ungrouped` para esa revisión), y si el diff trae
    "productos nuevos para agregar" a un grupo ya publicado, se listan
    resaltados dentro de la card con check para incluir/excluir cada uno.
  - **Sin agrupar**: lista de productos que no matchearon ningún patrón, con
    un selector para asignarlos a mano a un grupo existente de la propuesta
    (buscador por título de grupo).
  - Si el diff detecta productos de un grupo publicado que ya no están en el
    catálogo, se muestran tachados con opción "quitar del grupo".
  - Los "productos nuevos para agregar" a un grupo ya publicado vienen
    **incluidos por defecto** (checkbox tildado) en la propuesta — el dueño
    destilda los que no quiere, no al revés (el caso común es que sí querés
    sumar el color nuevo que acabás de cargar).
- Botón **"Publicar"** → `POST /api/variant-groups/publish` con el estado
  final editado. Confirma con un toast y refresca la sección 3.

### 3. Grupos publicados
- Lista (igual espíritu que la app vieja, pero de solo lectura + acciones):
  título, cantidad de productos, miniaturas, botones "Editar" (reabre ese
  grupo en el flujo de revisión de la sección 2) y "Ocultar"/"Mostrar"
  (`hidden`, no borra el grupo, solo lo saca de la vidriera).
- Buscador por título o SKU.

No hay sección de "estilo" con colores/tipografías como en Próximamente — el
swatch es simplemente la miniatura del producto en un círculo; no tiene
sentido tematizarlo más para v1 (YAGNI).

---

## Widget en la tienda

### `GET /api/variant-groups-widget.js?store=X`
- Sin store / `checkStoreActive` falso / `enabled:false` → comentario, no-op
  (mismo patrón que los otros widgets).
- Script **genérico** (no embebe datos): al cargar, hace
  `fetch('/api/variant-groups-data.json?store=X')` una vez y cachea el
  resultado en memoria de la página. Esto permite que `widget.js` en sí se
  cachee agresivamente (no cambia salvo que se actualice el código) mientras
  los datos de grupos se refrescan solos al publicar (cache 60s en el JSON).

### `GET /api/variant-groups-data.json?store=X`
- Devuelve `buildWidgetIndex(groups filtrados por !hidden)`. `Cache-Control: public, max-age=60`.

### Comportamiento del script

- Guard de instancia única: `window.__pnVariantGroupsLoaded`.
- Detecta contexto con `window.LS`: `LS.product` → PDP; si no, listado.
- **PDP**: si `LS.product.id` está en el índice, renderiza una fila de
  swatches (imagen circular de cada sibling, el propio producto resaltado sin
  link) cerca del precio/antes del formulario de compra. Selectores de
  anclaje: misma lista que `price-financing.js` (`PRICE_SELECTORS` /
  contenedor de compra), reutilizando el criterio ya probado en este repo.
- **Listado**: para cada card con `data-item-id`/`.product-item`/etc. (misma
  lista de selectores que `price-financing.js`/`coming-soon.js`) cuyo id esté
  en el índice, swatches chicos debajo del nombre/precio del card.
- Cada swatch no activo es un `<a href="{url}">` (navegación normal del
  storefront, sin JS de "cambiar variante" — son productos distintos).
- Reproceso con `MutationObserver` debounced (100ms), mismo patrón que los
  otros widgets (necesario porque muchos temas de Tiendanube renderizan el
  listado/PDP de forma asíncrona).
- CSS inyectado una vez (`<style id="pn-vg-styles">`), `!important`, clases
  `.pn-vg-*`. Tamaño del swatch controlado por `swatchSize` (28px / 36px / 44px).
- Sin branding en el DOM ni en comentarios del bundle servido a la tienda.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `functions/variant-groups.js` | Crear — rutas + algoritmo puro + fetch paginado de catálogo + widget builder |
| `functions/index.js` | 2 líneas de wiring, junto a `price-financing`/`coming-soon` |
| `functions/variant-groups.test.js` | Crear — tests de las funciones puras |
| `variant-groups-version.js` (raíz) | Crear — bootstrap para Partners (molde `price-financing-version.js`) |
| `src/pages/VariantGroupsConfig.jsx` | Crear |
| `src/pages/VariantGroupsConfig.css` | Crear — tema dark `--gl-*` desde el arranque (no repetir el error de Próximamente) |
| `src/App.jsx` | `import` + `<Route path="/grupos-variantes">` (el guard de allowlist vive en la propia página) |
| `src/components/Sidebar.jsx` | Agregar el ítem "Grupos de Variantes" (ícono `Layers`) a `STORE_EXCLUSIVE_ITEMS['2547699']`, y agregar una entrada nueva `STORE_EXCLUSIVE_ITEMS['6854698']` (demo) con el mismo ítem |

Colección Firestore nueva: `promonube_variant_groups`. No se modifica ningún
módulo existente más allá del wiring.

---

## Testing

### `node --test` — funciones puras en `functions/variant-groups.js`

- `splitSku`: sufijo de 2 chars ok; SKU corto → `null`; SKU vacío/undefined → `null`.
- `computeSkuGroups`: agrupa por `groupKey`; grupo de 1 solo producto → va a
  `ungrouped`; varios grupos simultáneos no se mezclan; SKUs duplicados exactos
  (dos productos con el mismo SKU completo, error de carga real) → ambos
  quedan en el mismo grupo sin romper nada.
- `deriveGroupTitle`: prefijo común de 2+ nombres; fallback cuando no hay
  prefijo útil.
- `diffScanWithPublished`: detecta productos nuevos para un grupo existente;
  detecta grupos completamente nuevos; no re-sugiere un `excludedProductIds`;
  detecta productos publicados que ya no vinieron en el escaneo.
- `buildWidgetIndex`: excluye grupos `hidden`; cada producto del índice trae
  a sus siblings incluído él mismo marcado `active`; un `groupKey` con todos
  sus miembros `hidden` no genera entradas huérfanas.

### QA manual (checklist en la tienda demo, con los productos con SKU tipo Alto Rancho)

- [ ] Escanear detecta los grupos esperados por SKU y dej a los inválidos en "sin agrupar".
- [ ] Editar el título de un grupo antes de publicar se respeta.
- [ ] Sacar un producto de un grupo en la revisión y publicar → no aparece en la vidriera.
- [ ] Volver a escanear no revive un producto que se sacó a mano.
- [ ] Asignar manualmente un producto de "sin agrupar" a un grupo funciona.
- [ ] Ocultar un grupo publicado lo saca de la vidriera sin borrar los datos.
- [ ] PDP: swatches visibles, el producto actual se ve resaltado y sin link a sí mismo.
- [ ] Listado: swatches debajo de cada card correspondiente, sin romper el layout del theme.
- [ ] Tienda fuera del allowlist: el ítem de menú no aparece y la ruta redirige.
- [ ] Plan inactivo / módulo deshabilitado → widget no hace nada.

---

## Restricciones y límites

- Regla de SKU fija (últimos 2 caracteres), no configurable en v1 — si la
  convención de SKU cambia, hay que tocar código (`splitSku`).
- 1 producto = 1 SKU (primera variante). No soporta productos con variantes de
  talle además del color por SKU en v1.
- El escaneo lee el catálogo completo en cada corrida (paginado) — con
  catálogos grandes (miles de productos) puede tardar varios segundos; no hay
  límite duro en v1 pero se deja anotado como candidato a job en background
  si Alto Rancho crece mucho más.
- Selectores de anclaje del widget (precio, formulario de compra, cards de
  listado) son heurísticos, iguales a los que ya usan `price-financing.js` y
  `coming-soon.js` en este repo — puede necesitar ajuste fino por tema en la
  QA manual, mismo riesgo aceptado que en esos módulos.
- Módulo con allowlist duro por `storeId` (frontend + backend) mientras sea
  piloto de Alto Rancho; sacar el chequeo es la única condición para
  ofrecerlo a otras tiendas.
- Una vez publicada la app, el script "Grupos de Variantes" debe existir en
  el catálogo de Partners antes de poder asociarlo por tienda (no se crean
  scripts ad-hoc) — no se instala en Alto Rancho hasta que el dueño lo pida.
