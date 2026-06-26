# Flash Sale — Spec de diseño
**Fecha:** 2026-06-26  
**Estado:** Aprobado para implementación

---

## Resumen

Módulo Flash Sale para PromoNube. Permite configurar una venta relámpago sobre una categoría de TiendaNube: resalta los productos con un marco visual y countdown en cualquier listado, muestra un banner en la ficha de producto, y opcionalmente inyecta una sección destacada con los productos de la categoría (similar a Shop the Look).

Todo el código del widget corre dentro del `style-widget.js` existente (sin nueva instalación). La config se guarda en `promonube_style_config` bajo la clave `flashSale`. La página de configuración es un módulo independiente (`/flash-sale`), no está dentro de la página de Style.

---

## Arquitectura

### Almacenamiento
- **Firestore:** `promonube_style_config/{storeId}` → campo `flashSale: {...}`
- **API existente:** `POST /api/style-config` (ya existe, compartida con ShopTheLook y otros módulos de Style)
- **API de lectura:** `GET /api/style-config?storeId=X` (ya existe)

### Nuevos endpoints de backend
| Endpoint | Descripción |
|---|---|
| `GET /api/tn-categories?storeId=X` | Devuelve lista de categorías de TiendaNube (id, name, url) |
| `GET /api/tn-category-products?storeId=X&categoryId=Y` | Devuelve productos de la categoría (id, name, imageUrl, url, price, comparePrice) — máximo 50, paginado si es necesario |

Estos endpoints llaman a la API de TiendaNube usando el `accessToken` del store guardado en Firestore.

### Frontend
- **Página:** `src/pages/FlashSaleConfig.jsx` → ruta `/flash-sale`
- **CSS:** reutiliza `src/pages/StyleConfig.css`
- **Sidebar:** entrada "Flash Sale" con ícono `Zap` de lucide-react, entre "Shop the Look" y "Banner Home"
- **Router:** nueva `<Route>` en `App.jsx`

### Widget
- Nueva función `customizeFlashSale()` dentro del script generado en `GET /api/style-widget.js`
- Se llama con `setTimeout(customizeFlashSale, 700)` junto a las demás funciones
- No realiza API calls en runtime — todos los datos están embebidos en el CONFIG

---

## Config shape

```js
flashSale: {
  enabled: false,

  // Categoría
  categoryId: '123456',
  categoryName: 'Zapatillas',
  categoryUrl: '/zapatillas',

  // Datos pre-fetcheados al guardar
  productIds: [111, 222, 333],          // todos los IDs de la categoría
  featuredProducts: [                    // primeros 8-10 con datos completos
    { id: 111, name: 'Producto A', imageUrl: '...', url: '/...', price: '$1000', comparePrice: '$1500' }
  ],

  // Ventana temporal
  startDate: '2025-07-01T10:00:00',
  endDate:   '2025-07-01T23:59:00',

  // Textos generales
  title: '🔥 Flash Sale',
  subtitle: 'Descuentos por tiempo limitado',
  countdownLabel: 'Termina en:',
  buttonText: 'Ver todos',

  // Badge (esquina del card en listings)
  badgeText: '🔥 FLASH',
  badgeBg: '#ff3c00',
  badgeTextColor: '#ffffff',
  badgeFontSize: 11,
  badgePosition: 'top-left',      // 'top-left' | 'top-right'
  badgeBorderRadius: 6,

  // Marco del card
  frameBorderColor: '#ff3c00',
  frameBorderWidth: 2,
  frameBorderRadius: 12,
  frameGlowEnabled: true,         // box-shadow sutil de color

  // Countdown en card
  cardCountdownEnabled: true,
  cardCountdownColor: '#ff3c00',
  cardCountdownFontSize: 11,

  // Banner de categoría (encima del grid en la página de categoría)
  categoryBannerEnabled: true,
  categoryBannerBg: '#ff3c00',
  categoryBannerTextColor: '#ffffff',

  // Banner inline en página de producto
  detailBannerEnabled: true,
  detailBannerBg: '#fff3f0',
  detailBannerBorderColor: '#ff3c00',
  detailBannerTextColor: '#cc2200',

  // Sección inyectada (tipo Shop the Look)
  sectionEnabled: true,
  sectionInjectSelector: '',      // selector CSS donde insertar; vacío = automático
  sectionInjectPosition: 'after', // 'before' | 'after' | 'prepend' | 'append'
  sectionBg: '#ffffff',
  sectionTextColor: '#111111',
  sectionCardBg: '#ffffff',
  sectionFontFamily: "'Poppins', sans-serif",
  sectionColumns: 4,              // columnas en desktop (2 en mobile)
  sectionMaxProducts: 8,
}
```

---

## Comportamiento del widget

### Cuándo corre
Solo si `now >= startDate && now <= endDate`. Si la sale no está activa, la función retorna inmediatamente sin tocar el DOM.

### Contexto 1 — Cualquier listado (home, búsqueda, categorías genéricas)
1. Construye un `Set` con los `productIds` de la config (O(1) lookup)
2. Busca todos los `[data-item-id]` en el DOM
3. Para cada elemento cuyo ID está en el Set:
   - Agrega `position: relative` al contenedor
   - Inyecta el **marco** (borde + glow opcional) via CSS class
   - Inyecta el **badge** (texto "🔥 FLASH") en esquina superior
   - Si `cardCountdownEnabled`: inyecta countdown HH:MM:SS que actualiza cada segundo

### Contexto 2 — Página de la categoría flash sale
Detectado por `window.LS && window.LS.category && window.LS.category.id == config.categoryId`.

- Aplica marco + badge + countdown a **todos** los product cards de la página (sin verificar IDs — todos pertenecen a la categoría)
- Si `categoryBannerEnabled`: inyecta un banner encima del grid de productos con título, subtítulo, countdown grande y botón "Ver todos"

### Contexto 3 — Página de producto de la categoría
Detectado por `window.LS.product.categories` — array de objetos con `id` y `name`. Se compara `category.id == config.categoryId`. Si el array no está disponible, se usa fallback por nombre.

- Si `detailBannerEnabled`: inyecta un banner compacto cerca del nombre del producto con "🔥 Flash Sale — Termina en: HH:MM:SS" y link a la categoría

### Contexto 4 — Sección inyectada
Si `sectionEnabled` y `featuredProducts.length > 0`:
- Renderiza una sección con: título, subtítulo, countdown, grid de productos (imagen, nombre, precio tachado + precio actual) y botón "Ver todos"
- Fuente Poppins (cargada desde Google Fonts si no está presente)
- Se inserta según `sectionInjectSelector` + `sectionInjectPosition`, o automáticamente antes del footer si no hay selector
- Aplica en cualquier página excepto checkout

---

## Página de configuración — Secciones

### 1. General
- Toggle activar/desactivar
- Selector de categoría (dropdown con fetch a `/api/tn-categories`)
- Fecha/hora de inicio y fin (datetime-local inputs)
- Botón "Actualizar productos" (re-fetchea `/api/tn-category-products`, carga los datos en el estado del form — el usuario debe hacer clic en "Guardar" para persistir)
- Indicador de cuántos productos están cargados (ej: "32 productos en la categoría, mostrando 8 en la sección")

### 2. Textos
- Título (con emoji picker o texto libre)
- Subtítulo
- Texto del badge
- Label del countdown ("Termina en:")
- Texto del botón "Ver todos"

### 3. Marco del producto
- Color del borde
- Ancho del borde (1–6 px, slider)
- Border radius (0–20 px, slider)
- Toggle sombra de color (glow)

### 4. Badge
- Texto del badge
- Color de fondo
- Color de texto
- Tamaño de fuente (slider)
- Posición: top-left / top-right

### 5. Countdown en card
- Toggle mostrar/ocultar
- Color del texto del countdown
- Tamaño de fuente

### 6. Banner de categoría
- Toggle mostrar/ocultar
- Color de fondo
- Color de texto

### 7. Banner de producto (ficha)
- Toggle mostrar/ocultar
- Color de fondo
- Color de borde
- Color de texto

### 8. Sección inyectada
- Toggle mostrar/ocultar
- Número de productos a mostrar (4–10)
- Columnas en desktop (2–5)
- Color de fondo de la sección
- Color del texto
- Color de fondo de los cards
- Selector CSS de inyección (campo de texto, opcional)
- Posición de inyección (before / after / prepend / append)

---

## Flujo de guardado

1. Usuario elige categoría → frontend hace GET a `/api/tn-categories` para el dropdown
2. Al clickar "Guardar":
   a. Frontend llama `GET /api/tn-category-products?storeId=X&categoryId=Y`
   b. Backend devuelve `productIds[]` + `featuredProducts[]` (con datos completos)
   c. Frontend mergea esos datos con el resto de la config
   d. Frontend hace `POST /api/style-config` con el config completo
3. Cache del style-widget expira en 60s → tienda refleja cambios

El botón "Actualizar productos" fuerza el paso 2a–2b sin tocar los demás campos (útil si se agregaron productos a la categoría).

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `src/pages/FlashSaleConfig.jsx` | Crear |
| `src/App.jsx` | Agregar route `/flash-sale` |
| `src/components/Sidebar.jsx` | Agregar entrada "Flash Sale" con ícono Zap |
| `functions/index.js` | Agregar endpoints `/api/tn-categories` y `/api/tn-category-products` + función `customizeFlashSale()` en el script generado de style-widget |

No se necesitan nuevas colecciones de Firestore ni nuevos scripts de TiendaNube.

---

## Restricciones y límites

- Máximo 50 productos en `productIds` (si la categoría tiene más, se toman los primeros 50 — suficiente para el Set lookup en listings y para la sección)
- `featuredProducts` máximo 10 (para la sección visual)
- El widget no corre en páginas de checkout (detección por URL `/checkout`)
- Poppins se carga desde Google Fonts solo si `sectionEnabled` está activo y la fuente no está ya en la página
- Si `startDate` está vacío, la flash sale empieza inmediatamente al activarse
