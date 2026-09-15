# Carrusel de Categorías — Design Spec

**Fecha:** 2026-09-15
**Estado:** Aprobado por el usuario en brainstorming, pendiente de plan de implementación.

## 1. Objetivo

Reemplazar el banner grande y fijo que Tiendanube muestra nativamente arriba de
cada página de categoría (que el usuario va a desactivar manualmente desde el
panel de Tiendanube, categoría por categoría) por un módulo propio: un
carrusel de tarjetas cuadradas (imagen + título + link), configurable por
categoría, con diseño personalizable (bordes, tipografía, espaciados,
cantidad de imágenes visibles) y adaptado a mobile.

Referencias visuales usadas durante el brainstorming:
- https://www.crateandbarrel.com/whats-new/new-arrivals-by-category/ — layout
  de tarjetas cuadradas en fila con carrusel (flechas prev/next), título
  debajo de cada imagen.
- https://altorancho.com/the-getaway-club/tendencia-timeless/ — ejemplo del
  banner grande y fijo actual que se quiere reemplazar.

## 2. No-goals (fuera de alcance de esta iteración)

- No se oculta ni se toca el banner nativo de Tiendanube vía CSS/JS — el
  usuario lo desactiva manualmente desde el panel de cada categoría en
  Tiendanube.
- No hay estilos por-carrusel individuales: el diseño (bordes, tipografía,
  espaciados, cantidad visible) es global por tienda y se aplica a todos los
  carruseles configurados. Se puede revisar más adelante si hace falta.
- No se mapean selectores DOM verificados por theme desde el día uno (ver
  §5.2) — se arranca con heurística genérica + arquitectura extensible,
  igual que se hizo históricamente con `theme-menu-selectors.js`.

## 3. Arquitectura general

Mismo patrón que los módulos existentes (`search.js`, `coming-soon.js`):

- Archivo nuevo `functions/category-carousel.js`, exporta
  `registerCategoryCarouselRoutes(app, { db, FieldValue, checkStoreActive })`
  y `setCategoryCarouselScriptId(id)`.
- Se monta en `functions/index.js` junto a los otros módulos.
- Colección Firestore nueva: `promonube_category_carousel_config`, un doc por
  `storeId`.
- Rutas:
  - `GET /api/category-carousel-config?storeId=` — trae config (merge con
    `DEFAULT_CONFIG`).
  - `POST /api/category-carousel-config` — guarda config.
  - `GET /api/category-carousel-widget.js` — sirve el script del storefront
    con la config (y el mapa de selectores por theme, ver §5.2) inyectados
    vía `JSON.stringify`, igual que `buildWidgetScript` en `search.js`.
  - `POST /api/category-carousel/install` — instala el script tag en
    Tiendanube (`POST /2025-03/{storeId}/scripts`), mismo patrón copy-paste
    que `search.js:148` y `coming-soon.js:791` (no hay helper compartido en
    este repo, se sigue la convención existente).
  - Reutiliza `GET /api/tiendanube/categories` (ya existe, `functions/index.js:9497`)
    para poblar el picker de categorías en el admin — no hace falta una ruta
    nueva.

**Prerequisito de despliegue (no es código):** como con Buscador Inteligente
Pro (`chore: set real Buscador Inteligente Pro script id (#9840)`), hace
falta registrar un script nuevo en Tiendanube Partners y setear su id real
antes de que `install` funcione en producción. Se deja como paso manual
posterior al merge, igual que la vez pasada.

## 4. Modelo de datos

```js
const DEFAULT_CONFIG = {
  enabled: false,
  style: {
    borderRadius: 12,        // px, bordes de cada tarjeta
    gap: 16,                 // px, espacio entre tarjetas
    titleFontFamily: 'system-ui',
    titleFontSize: 'medium', // small | medium | large
    titleColor: '#111111',
    desktopVisible: 4,       // tarjetas visibles en pantallas >= 640px
    mobileVisible: 2,        // tarjetas visibles en pantallas < 640px
  },
  carousels: [
    // {
    //   id: 'c_...',
    //   name: 'Living',              // referencia interna para el admin
    //   categoryIds: [123, 456],     // ids de categoria/subcategoria de Tiendanube
    //   tiles: [
    //     { id: 't_...', imageUrl: '', title: '', url: '' },
    //   ],
    // }
  ],
};
```

Notas:
- `categoryIds` es un array: una misma tarjeta de carrusel puede aplicar a
  varias categorías/subcategorías (ej. mostrar el mismo carrusel en "Sillas"
  y en su subcategoría "Sillas de living").
- Si dos carruseles configurados comparten un `categoryId` (error de carga
  del admin), el storefront usa el primero que matchee, en el orden del
  array — no hay validación de unicidad en el backend por ahora (se puede
  agregar si en la práctica genera confusión).
- `normalizeUrl()` de `search.js:30` se reutiliza (duplicada en este módulo,
  siguiendo la convención de este repo de no compartir helpers entre
  módulos) para las URLs de las tarjetas.

## 5. Storefront widget

### 5.1 Detección de categoría

El script espera a que `window.LS` esté disponible (igual que el módulo de
Flash Sale en `functions/index.js:13798`) y lee `window.LS.category.id`. Si
no hay `window.LS.category` (no es una página de categoría) el script no
hace nada.

### 5.2 Dónde insertar el carrusel (selectores por theme)

Se crea `functions/category-anchor-selectors.js`, calcado de
`theme-menu-selectors.js`:

```js
const CATEGORY_ANCHOR_SELECTORS = {
  // theme_code: { gridSelector: '...' }  -- se completa a medida que se
  // verifican themes reales, igual que se hizo con rio/new_linkedman/ipanema.
};
const DEFAULT_ANCHOR_SELECTOR = { gridSelector: null };

function resolveCategoryAnchorSelectors(themeCode) { ... }
```

Cuando `gridSelector` es `null` (caso por defecto, sin verificar), el script
del storefront usa una heurística: busca el primer elemento que contenga
varios hijos con clases típicas de producto de Tiendanube
(`.js-item-product`, `[data-product-id]`, `.product-item`, etc. — se
confirma la lista exacta durante la implementación mirando el DOM real de 2-3
temas) y inserta el carrusel inmediatamente antes del contenedor padre de esa
grilla. La detección de theme reusa `window.LS.theme` (mismo mecanismo que
`pnDetectTheme()`, `functions/index.js:10817`).

Igual que con el menú: si un cliente reporta que el carrusel no aparece o
aparece en mal lugar, se verifica el selector real de su theme y se agrega
al mapa — no bloquea el lanzamiento inicial.

### 5.3 Render y comportamiento

- Tarjetas cuadradas (`aspect-ratio: 1/1`), `object-fit: cover`, radio de
  borde configurable, título debajo (tipografía/tamaño/color configurables).
- Ancho de cada tarjeta: `calc((100% - (visible - 1) * gap) / visible)`,
  donde `visible` sale de `style.desktopVisible` (≥640px) o
  `style.mobileVisible` (<640px) vía media query.
- Contenedor con `overflow-x: auto`, `scroll-snap-type: x mandatory` y cada
  tarjeta con `scroll-snap-align: start` — scroll nativo, swipe funciona
  solo en mobile sin JS extra.
- Flechas prev/next (`scrollBy` de un "page" = `visible * (tileWidth + gap)`)
  visibles solo en desktop y solo si `tiles.length > desktopVisible`;
  ocultas en mobile (breakpoint <640px) para no duplicar el swipe nativo.

## 6. Panel admin (`src/pages/CategoryCarouselConfig.jsx`)

Mismo esqueleto que `SearchConfig.jsx`: toggle general, sección "Diseño"
(inputs para los 6 campos de `style`), sección "Carruseles" (lista
add/edit/remove; cada uno con selector de categorías —reusa el fetch a
`/api/tiendanube/categories` que ya usa `ComingSoonConfig.jsx`— y su lista de
tarjetas usando `useImageUpload(storeId, 'category-carousel')`), columna de
vista previa en vivo (renderiza el primer carrusel cargado con el estilo
actual — no hace falta el patrón de popup "Probar" del buscador porque este
widget no es un popup, se ve embebido directamente en la página).

Se agrega entrada en `src/components/Sidebar.jsx` y tile en
`src/pages/Dashboard.jsx`, mismo patrón que los otros módulos.

## 7. Testing

Siguiendo la convención de este repo (`node --test`, funciones puras
exportadas, sin DOM real — ver `theme-menu-selectors.test.js`,
`search.test.js`):

- `category-anchor-selectors.test.js`: `resolveCategoryAnchorSelectors`
  devuelve selectores verificados para themes mapeados y `DEFAULT` (null) para
  themes desconocidos — mismo patrón que `theme-menu-selectors.test.js`.
- `category-carousel.test.js`:
  - merge de config con `DEFAULT_CONFIG` (valores faltantes se completan).
  - `normalizeUrl` con los mismos casos borde que `search.test.js`.
  - que el script generado (`buildWidgetScript` exportado, mismo patrón que
    `search.js`) contenga las reglas CSS de ancho/breakpoint esperadas para
    un `style` de ejemplo (desktopVisible/mobileVisible distintos).
  - que un carrusel cuyo `categoryIds` no incluye la categoría actual no se
    renderice (test de la función pura que hace el match, extraída aparte
    para poder testearla sin DOM).

## 8. Edge cases

- Tienda sin ningún carrusel configurado o módulo deshabilitado: el script
  no inserta nada (chequeo temprano, sin pegarle a la API de categorías).
- Categoría sin carrusel asociado: no se renderiza nada (no es un error).
- Carrusel con menos tarjetas que `desktopVisible`/`mobileVisible`: no se
  muestran flechas, las tarjetas ocupan el ancho calculado igual (quedan más
  chicas si son pocas — comportamiento aceptado, no se fuerza a expandir).
- Imagen de tarjeta rota: incluir el `onerror` que ya se usa en
  `search.js:437` (ocultar visualmente en vez de mostrar el ícono roto del
  navegador).
