# Combos: página y ficha propia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página `/combos/` en la tienda que lista los combos como productos, y una ficha por combo en `/combos/?combo=<slug>`, con fotos y textos editables desde el admin.

**Architecture:** Los campos nuevos viven en cada combo de `promonube_combos/{storeId}`. Un endpoint público nuevo, `/api/combos-page.json`, resuelve las piezas con el mismo cache de productos que la card actual. El script `/api/combos-widget.js` suma dos vistas, grilla y ficha, cuando la URL es la `pagePath`. La card de selección de colores se reutiliza. El admin suma una pestaña "Ficha" con un uploader que valida tamaño y peso.

**Tech Stack:** Node/Express (Railway), Firestore, `node:test`, React (Vite), JS de storefront serializado como string.

**Spec:** `docs/superpowers/specs/2026-10-20-combos-pagina-design.md`

## Global Constraints

- **URL:** página `pagePath`, por defecto `/combos/`. La ficha es `pagePath + "?combo=" + slug`.
- **Slug:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, de hasta 60 caracteres y único dentro de la tienda.
- **Imágenes:** hasta 6. Solo URLs `https://storage.googleapis.com/<bucket>/combos/...`.
- **Textos de cada combo:** `includesText` ≤ 120 caracteres, `shortDescription` ≤ 300 y `description` ≤ 3000. Todos en texto plano: en el storefront se usa `textContent`, nunca `innerHTML`.
- **Textos de la página:** `pageTitle` ≤ 80 y `pageIntro` ≤ 300. Por defecto: "Combos" y "Armá el conjunto en los colores que quieras y llevátelo con descuento."
- **Upload (admin):** se rechazan los archivos de más de 5 MB, los que no sean jpg/png/webp y los que tengan el lado corto menor a 800 px. Se reduce a 1200 px como máximo y se manda como JPEG 0.9 a `/api/upload-image-base64` con `folder: "combos"`.
- **Ayuda del upload, textual:** "Tamaño recomendado: 1200 × 1200 px (cuadrada). Mínimo 800 × 800 px. JPG, PNG o WebP de hasta 5 MB."
- **Precio "desde":** Σ(precio mínimo con stock de cada pieza × cantidad) × (1 − %/100), redondeado a 2 decimales.
- **Compatibilidad:** los combos que ya existen, sin los campos nuevos, siguen funcionando. Si un combo no tiene slug, se genera de `slugify(name)` al guardar.
- **Estilo del código:** el de `combos.js` (comentarios en castellano sin tildes, `!important` en los estilos del storefront).

## Review Focus

- **Dos combos con el mismo nombre** → los slugs no pueden chocar: el segundo recibe un sufijo `-2` al generarse. Si el comercio escribe uno repetido a mano, el guardado da 400 con un mensaje. *(Task 1)*
- **Combo sin fotos propias** → la grilla y la galería usan la foto de la opción por defecto de cada pieza, y nunca queda una card sin imagen si alguna pieza tiene foto. *(Task 1, `comboGallery`)*
- **`?combo=` con un slug que no existe, o de un combo inactivo o sin stock** → se muestra "Este combo ya no está disponible" con un link a la página. No queda una pantalla en blanco ni se rompe el script. *(Task 3)*
- **Una descripción con `<script>` o HTML** → se ve como texto, no se ejecuta. *(Task 1 lo sanitiza como string; Task 3 usa textContent)*
- **Una foto de 14 MB o de 500 × 500** → el admin la rechaza antes de subirla y dice el peso o el tamaño real. *(Task 4)*

---

### Task 1: Lógica pura — campos de ficha, slugs y datos de la página

**Files:**
- Modify: `functions/combos.js` (`sanitizeCombo`, nuevas funciones puras, `DEFAULT_CONFIG`, exports)
- Test: `functions/combos.test.js`

**Interfaces:**
- Produces:
  - `slugify(text: string) -> string`: misma regla que `gift-registry.js` (sin acentos, `[a-z0-9-]`, ≤ 60).
  - `assignSlugs(combos: Combo[]) -> { ok: true, combos } | { ok: false, message }`: completa los slugs vacíos con sufijo `-2`, `-3`…; si dos slugs explícitos chocan o uno es inválido, devuelve `ok: false` con el mensaje `Hay dos combos con la URL "<slug>".` o `La URL "<slug>" no es válida.`
  - `sanitizeCombo` además conserva `slug`, `showOnPage` (por defecto `true`), `images` (filtradas con `isComboImageUrl`, hasta 6), `includesText`, `shortDescription` y `description`, recortados a los límites.
  - `isComboImageUrl(url) -> boolean`.
  - `DEFAULT_CONFIG` suma `pagePath: "/combos/"`, `pageTitle: ""` y `pageIntro: ""`.
  - `resolveComboItems(combo, groupsByKey, productsById, palette) -> Item[]`: se extrae de `buildWidgetCombos`; es el mismo shape `{label, quantity, options[]}`.
  - `comboFromPrice(items: Item[], discountPercent: number) -> { from: number, was: number }`.
  - `comboGallery(combo, items) -> string[]`: `combo.images` si las tiene; si no, la foto de la primera opción con stock de cada pieza, sin duplicados.
  - `defaultIncludesText(items) -> string`: `"<qty> <label>"` unido con `" + "`. Si alguna pieza tiene más de una opción, se agrega `" · cualquier color"`.
  - `buildPageCombos(config, groupsByKey, productsById, palette) -> PageCombo[]`: solo los activos, con `showOnPage !== false` y todas las piezas con stock, en el orden de la config. `PageCombo = { id, slug, name, discountPercent, includesText, shortDescription, description, images, from, was, items }`.

- [ ] **Step 1: Escribir los tests que fallan** en `combos.test.js`:
  - `assignSlugs - genera desde el nombre y desambigua`: `[{name:"Comedor Nova"},{name:"Comedor Nova"}]` da los slugs `["comedor-nova","comedor-nova-2"]`.
  - `assignSlugs - rechaza slug explicito repetido o invalido`: dos `slug:"x"` dan `ok:false`; `slug:"Mal Slug!"` da `ok:false`.
  - `sanitizeCombo - conserva ficha y descarta imagenes externas`: `images:["https://storage.googleapis.com/b/combos/1/a.webp","https://evil.com/x.jpg"]` queda con solo la primera; `description` de 3500 caracteres se recorta a 3000; un combo sin `showOnPage` queda en `true`.
  - `comboFromPrice - usa la opcion mas barata con stock`: pieza A con opciones `[{price:100,available:true},{price:80,available:false},{price:90,available:true}]` y qty 2, pieza B `[{price:50,available:true}]` y qty 1, al 10% dan `{ was: 230, from: 207 }`.
  - `comboGallery - sin fotos propias usa las de las piezas sin duplicar`.
  - `buildPageCombos - filtra inactivos, ocultos y sin stock y respeta el orden`: reutiliza el fixture de `buildWidgetCombos`.
- [ ] **Step 2: Correr** `node --test combos.test.js`. Se espera FAIL (funciones no exportadas).
- [ ] **Step 3: Implementar** lo de *Produces*. `buildWidgetCombos` pasa a usar `resolveComboItems` y suma `slug` a cada combo devuelto, para el link "Ver combo".
- [ ] **Step 4: Correr** `node --test combos.test.js`. Se espera PASS en todos, también en los tests viejos.
- [ ] **Step 5: Commit** `feat(combos): campos de ficha, slugs y precio desde`.

### Task 2: Rutas — guardar la ficha y servir los datos de la página

**Files:**
- Modify: `functions/combos.js` (`POST /api/combos-config`, nueva `GET /api/combos-page.json`)

**Interfaces:**
- Consumes: `assignSlugs`, `sanitizeCombo` y `buildPageCombos` (Task 1).
- Produces:
  - `POST /api/combos-config` acepta `config.pagePath` (normalizado con `/` al principio y al final, validado con `^\/[a-z0-9\-/]+\/$`), `pageTitle` y `pageIntro`. Corre `assignSlugs` y responde 400 con su mensaje si falla. Responde `{ success, promotionId, combos }`, con los combos ya con slug, para que el admin los muestre.
  - `GET /api/combos-page.json?store=X` responde `{ swatchMode, pageTitle, pageIntro, combos: PageCombo[] }`, con `Cache-Control: public, max-age=60`. Si la tienda no está permitida, está inactiva o deshabilitada, responde `{ combos: [] }`. Reutiliza `widgetCache` y `fetchProductsByIds`.
  - `buildWidgetScript(store, { pagePath })`: el script recibe la ruta de la página.

- [ ] **Step 1:** implementar las dos rutas y pasar `pagePath` a `buildWidgetScript` desde `/api/combos-widget.js` (usa `stateCache`).
- [ ] **Step 2: Verificar** con el harness de jsdom/express de Task 5. Mientras tanto, `node -e "require('./combos')"` tiene que cargar sin error y `node --test combos.test.js` tiene que dar PASS.
- [ ] **Step 3: Commit** `feat(combos): datos de la pagina de combos y guardado de la ficha`.

### Task 3: Storefront — grilla `/combos/` y ficha `?combo=`

**Files:**
- Modify: `functions/combos.js` (`buildWidgetScript`)
- Test: `functions/combos.test.js` (el test existente `buildWidgetScript - genera JS valido` pasa a llamarse con `{ pagePath: "/combos/" }`)

**Interfaces:**
- Consumes: `/api/combos-page.json` (Task 2) y el shape `PageCombo`.
- Produces, dentro del script:
  - **Arranque:** si `location.pathname === PAGE_PATH`, monta la página; si no, si hay `LS.product`, la card como hoy. Ahora el `return` temprano por `!product` solo aplica fuera de la página.
  - **Montaje:** en el host `.user-content, .page-content, [data-store='page-content'], main .container` (el mismo de la lista de regalos), cuyo `innerHTML` se vacía.
  - **`renderGrid(data)`:** `section.pn-cbp` con encabezado (ruta, `h1` = `pageTitle || "Combos"`, intro) y `.pn-cbp-grid` en 4 columnas, que pasa a 2 a menos de 768 px. Cada card es un `<a href="?combo=slug">` con imagen 1:1 (la segunda imagen aparece con hover), badge `-N%`, nombre, `includesText || defaultIncludesText` (ya viene resuelto del server), "Desde", `from` y `was` tachado.
  - **`renderDetail(combo)`:** galería con miniaturas en columna, que pasan abajo a menos de 768 px; ruta "Inicio / Combos / nombre", `h1`, precio, tachado y "Ahorrás $X". Los totales se calculan con los colores elegidos, reutilizando la lógica de `refreshTotals`. Debajo, `shortDescription`, las piezas con swatches (se extrae de `renderCombo` una función `renderPieces(combo, swatchMode, onChange)` que usan las dos vistas), cantidad −/+, que va de 1 a 10, y el botón "Agregar combo al carrito" (`addAll` con `quantity × n`). Abajo, `description`, mostrando los saltos de línea con `white-space: pre-line`. Además pone `document.title = name + " | " + título original`.
  - **Combo no encontrado:** `h2` "Este combo ya no está disponible" y un link "Ver todos los combos".
  - **Card de la ficha de producto:** suma el link `Ver combo →` a `PAGE_PATH + "?combo=" + slug`.
- [ ] **Step 1:** actualizar el test de `buildWidgetScript` (se espera que el JS parsee con `new Function` y contenga `?combo=`). Correr: FAIL.
- [ ] **Step 2: Implementar.** Los estilos van con el prefijo `.pn-cbp` y en la paleta de la card actual (`#353434`, `#8a8580`, `#e7e2db`, `#f2efeb` para el fondo del encabezado y `#4f7a4a` para el ahorro).
- [ ] **Step 3:** `node --test combos.test.js` da PASS.
- [ ] **Step 4: Commit** `feat(combos): pagina de combos y ficha del combo en la tienda`.

### Task 4: Admin — pestaña Ficha y uploader optimizado

**Files:**
- Create: `src/pages/ComboImageUploader.jsx`
- Modify: `src/pages/CombosConfig.jsx`, `src/pages/CombosConfig.css`

**Interfaces:**
- Consumes: la respuesta de `POST /api/combos-config` (Task 2), de la que se toman los `combos` con slug.
- Produces:
  - `prepareComboImage(file) -> Promise<{ dataUrl, width, height, square }>`, exportada desde `ComboImageUploader.jsx`. Rechaza con `Error` y estos mensajes exactos:
    - `"<nombre>" pesa <X,X> MB. Subí una de hasta 5 MB.`
    - `"<nombre>" no es JPG, PNG o WebP.`
    - `"<nombre>" mide <w> × <h> px. El mínimo es 800 × 800 px.`
  - `<ComboImageUploader storeId images onChange />`: grilla de 6 casilleros, la primera marcada "Principal"; botones ← → para ordenar y × para quitar. Muestra la ayuda textual de Global Constraints y, si la foto no es cuadrada, el aviso `La foto no es cuadrada: en la grilla se recorta al centro.`
  - **En `CombosConfig`:** cada combo suma pestañas "Productos" (lo de hoy) y "Ficha", con el uploader, "URL del combo" (slug y preview `/combos/?combo=…`), el check "Mostrar en la página de combos", "Qué incluye (opcional)", "Descripción corta" y "Descripción larga", con contador de caracteres. En la sección General: "Página de combos en la tienda" (`pagePath`), el título, la bajada y la ayuda "Creá en Tiendanube una página vacía con esa dirección y sumala al menú."
  - Al guardar, reemplaza `config.combos` con los que devuelve el server.
- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Verificar** `npx eslint src/pages/CombosConfig.jsx src/pages/ComboImageUploader.jsx` (sin errores) y `npx vite build` (sin errores).
- [ ] **Step 3: Commit** `feat(combos): ficha del combo en el admin con fotos optimizadas`.

### Task 5: Verificación punta a punta y cierre

**Files:**
- Modify: `.gitignore` (agregar `.superpowers/`)
- Harness fuera del repo: `<scratchpad>/harness/combos-run.js`, con el mismo enfoque que el de la lista de regalos: Express real, Firestore en memoria y jsdom, mockeando `fetchProductsByIds` con `globalThis.fetch` falso para la API de Tiendanube.

- [ ] **Step 1: Harness.** Recorrer y verificar:
  - La grilla en `/combos/` muestra 2 combos en orden, con "Desde" y el tachado correctos, y oculta el que tiene `showOnPage:false`.
  - Al tocar una card, se muestra la ficha con galería, la descripción como texto (un `<b>` no se renderiza) y el total cambia al elegir otro color.
  - "Agregar combo al carrito" con cantidad 2 hace un POST a `/comprar/` por pieza, con `quantity` × 2.
  - `?combo=no-existe` muestra el aviso.
  - En la ficha de producto se ve la card con "Ver combo →".
  - El guardado con dos slugs iguales da 400.
- [ ] **Step 2:** `node --test combos.test.js gift-registry.test.js` da PASS.
- [ ] **Step 3: Commit** `chore: ignorar mockups de brainstorming`.
