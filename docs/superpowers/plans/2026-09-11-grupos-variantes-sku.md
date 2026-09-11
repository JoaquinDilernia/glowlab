# Grupos de Variantes por SKU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el flujo manual de "Administrar Grupos" (app de terceros) por un módulo propio que agrupa automáticamente los productos de Alto Rancho por SKU (quitando el sufijo de color de 2 caracteres), permite revisar/editar la propuesta antes de publicar, y muestra swatches de color en el listado y la ficha de producto de la tienda.

**Architecture:** Módulo backend aislado (`functions/variant-groups.js`) con colección Firestore propia (`promonube_variant_groups`), registrado en `functions/index.js` igual que `price-financing`/`coming-soon`. El agrupado es 100% funciones puras (testeables sin red). El flujo es "escanear → revisar en el admin → publicar" (nunca automático/silencioso). La vidriera se sirve con un script liviano y genérico (`/api/variant-groups-widget.js`, cacheable fuerte) que pide los datos de grupos por separado (`/api/variant-groups-data.json`, cache corta) — así cambiar un grupo no requiere invalidar el script. Módulo oculto para todas las tiendas salvo Alto Rancho y la tienda demo, reusando el mecanismo `STORE_EXCLUSIVE_ITEMS` que ya existe en `Sidebar.jsx`.

**Tech Stack:** Node 22 + Express 4 (CommonJS) en Railway · Firestore (`firebase-admin`) · React 19 + Vite + react-router-dom (HashRouter) · `node:test` para tests · lucide-react para íconos · API de Tiendanube v1 (`Authentication: bearer`) y 2025-03 (`Authorization: Bearer`, solo Scripts).

**Spec:** `docs/superpowers/specs/2026-09-11-grupos-variantes-sku-design.md`

## Global Constraints

- **Regla de SKU fija, no configurable:** raíz = SKU sin los últimos 2 caracteres; sufijo = esos 2 caracteres (color). SKU con raíz de menos de 3 caracteres → no se agrupa.
- **1 producto = 1 SKU:** se usa el SKU de la primera variante del producto (`product.variants[0].sku`). Productos sin variantes o sin SKU van a "sin agrupar".
- **Un grupo necesita 2+ productos.** Un solo producto con una raíz de SKU que no se repite en ningún otro producto va a "sin agrupar" (razón `single_product`).
- **Nunca se publica nada sin revisión humana.** El escaneo (`POST /api/variant-groups/scan`) NUNCA escribe en Firestore — solo `POST /api/variant-groups/publish` persiste.
- **Re-escanear no pisa ediciones manuales:** un producto en `excludedProductIds` de un grupo publicado nunca vuelve a aparecer como sugerencia para ese grupo.
- **Colección Firestore:** `promonube_variant_groups/{storeId}` (doc único por tienda, incluye `groups`, `ungrouped`, settings y `lastScanAt`).
- **Base URL backend (producción):** `https://glowlab-production.up.railway.app`.
- **API de Tiendanube:**
  - Lectura de catálogo → API v1: `https://api.tiendanube.com/v1/{storeId}/products`, header `"Authentication": "bearer " + accessToken`.
  - Asociar script a una tienda → API 2025-03: `POST https://api.tiendanube.com/2025-03/{storeId}/scripts`, header `"Authorization": "Bearer " + accessToken`.
  - Header `"User-Agent": "GlowLab (info@techdi.com.ar)"` en TODAS las llamadas a Tiendanube.
  - `accessToken` se lee de `promonube_stores/{storeId}.accessToken`.
- **Gateo de suscripción:** `checkStoreActive(storeId)` (ya existe en `functions/index.js`, inyectado). Devuelve `Promise<boolean>`.
- **Allowlist de tiendas (piloto):** `['2547699', '6854698']` (Alto Rancho, tienda demo). Se chequea en CADA endpoint nuevo del backend (403 si no matchea) y en el frontend (ítem de menú + guard de ruta). Comentario `// TODO: quitar allowlist cuando se libere a todas las tiendas` en las 2 ubicaciones donde vive la constante.
- **Cache:** `widget.js` y `data.json` con `Cache-Control: public, max-age=60, s-maxage=60` (igual que el resto de los widgets).
- **Estilo de respuesta JSON:** `{ success: true, ... }` / `{ success: false, message }`.
- **Sin branding en el storefront:** el bundle servido a la tienda no debe contener "PromoNube" ni "GlowLab" en texto visible ni comentarios del bundle.
- **Tests:** `node --test` desde `functions/` (`cd functions && node --test variant-groups.test.js`). No hay test runner de componentes React en este repo — las tareas de frontend se verifican a mano en el dev server (mismo criterio que el resto del proyecto).
- **Commits frecuentes:** un commit por tarea como mínimo. Mensajes en español, prefijo `feat:`/`test:`/`chore:`. Terminar cada commit con:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG
  ```
- **Branch:** `feat/proximamente-module` (misma branch donde está el spec commiteado; a criterio del ejecutor crear una branch nueva `feat/grupos-variantes-sku` si prefieren mantenerlo separado del módulo Próximamente — no es un requisito duro).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `functions/variant-groups.js` | **Crear.** Constantes (`COLLECTION`, `DEFAULT_CONFIG`, `ALLOWED_STORE_IDS`, `VARIANT_GROUPS_SCRIPT_ID`), algoritmo puro (`splitSku`, `computeSkuGroups`, `deriveGroupTitle`, `diffScanWithPublished`, `buildWidgetIndex`), cliente de catálogo (`fetchAllStoreProducts`), `buildWidgetScript`, `registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive })`. |
| `functions/variant-groups.test.js` | **Crear.** Tests `node:test` de todas las funciones puras y de `fetchAllStoreProducts` (con `fetch` inyectado). |
| `functions/index.js` | **Modificar.** 2 líneas de wiring junto al bloque de `coming-soon` (~línea 773). |
| `variant-groups-version.js` (raíz del repo) | **Crear.** Bootstrap estático para Partners, molde `price-financing-version.js`, apunta a `/api/variant-groups-widget.js`. |
| `src/pages/VariantGroupsConfig.jsx` | **Crear.** Página de config: General, Escanear y revisar, Grupos publicados. |
| `src/pages/VariantGroupsConfig.css` | **Crear.** Estilos dark (`--gl-*`) desde el arranque, mismo criterio que la reescritura reciente de `ComingSoonConfig.css`. |
| `src/App.jsx` | **Modificar.** `import VariantGroupsConfig` + `<Route path="/grupos-variantes">` dentro de `<Route element={<AppLayout />}>`. |
| `src/components/Sidebar.jsx` | **Modificar.** Agregar el ítem "Grupos de Variantes" (ícono `Layers`) a `STORE_EXCLUSIVE_ITEMS['2547699']`, y crear la entrada nueva `STORE_EXCLUSIVE_ITEMS['6854698']` con el mismo ítem. |

**Endpoints nuevos (todos en `functions/variant-groups.js`):**

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/variant-groups-config?storeId=X` | Config + grupos publicados + ungrouped para el admin |
| POST | `/api/variant-groups-config` | Guardar solo settings (`{ storeId, config }`) |
| POST | `/api/variant-groups/scan` | `{ storeId }` → escanea el catálogo, devuelve propuesta diffeada. No persiste. |
| POST | `/api/variant-groups/publish` | `{ storeId, groups, ungrouped }` → persiste el estado final aprobado |
| POST | `/api/variant-groups/install` | Asocia el script a la tienda (`{ storeId }`) |
| GET | `/api/variant-groups-widget.js?store=X` | Script liviano servido a la tienda |
| GET | `/api/variant-groups-data.json?store=X` | Índice de grupos que el script pide en runtime |

---

## Modelo de datos (`promonube_variant_groups/{storeId}`)

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
      excludedProductIds: ['555555'],
      products: [
        { productId: '123456', sku: 'BCV136PT', name: 'Silla Rey Rojo', image: 'https://...', url: '/productos/silla-rey-rojo' },
        { productId: '123457', sku: 'BCV136NT', name: 'Silla Rey Natural', image: 'https://...', url: '/productos/silla-rey-natural' }
      ]
    }
  ],

  ungrouped: [
    { productId: '999999', sku: 'X1', name: 'Producto suelto', image: 'https://...', url: '/productos/producto-suelto', reason: 'sku_too_short' }
  ],

  lastScanAt: <serverTimestamp>,
  updatedAt: <serverTimestamp>
}
```

`reason` en `ungrouped`: `'no_sku'` | `'sku_too_short'` | `'single_product'`.

---

### Task 1: Algoritmo puro — `splitSku`, `computeSkuGroups`, `deriveGroupTitle`

**Files:**
- Create: `functions/variant-groups.js`
- Test: `functions/variant-groups.test.js`

**Interfaces:**
- Produces: `splitSku(sku) -> { groupKey, colorCode } | null`, `deriveGroupTitle(names) -> string`, `computeSkuGroups(products) -> { groups: [{ groupKey, title, products }], ungrouped: [...] }` donde `products: [{ productId, sku, name, image, url }]`. Usados por Task 2, 3 y las rutas de Task 5.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// functions/variant-groups.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
} = require("./variant-groups");

test("splitSku - separa raiz y color con sufijo de 2 caracteres", () => {
  assert.deepEqual(splitSku("BCV136PT"), { groupKey: "BCV136", colorCode: "PT" });
});

test("splitSku - SKU vacio o no-string da null", () => {
  assert.equal(splitSku(""), null);
  assert.equal(splitSku(null), null);
  assert.equal(splitSku(undefined), null);
});

test("splitSku - raiz muy corta (menos de 3) da null", () => {
  assert.equal(splitSku("X1"), null);
  assert.equal(splitSku("AB1"), null); // raiz "A" (1 char) < minimo 3
});

test("splitSku - raiz de exactamente 3 caracteres es valida", () => {
  assert.deepEqual(splitSku("ABCPT"), { groupKey: "ABC", colorCode: "PT" });
});

test("deriveGroupTitle - prefijo comun de 2+ palabras", () => {
  assert.equal(
    deriveGroupTitle(["Silla Rey Rojo", "Silla Rey Natural", "Silla Rey Negro"]),
    "Silla Rey"
  );
});

test("deriveGroupTitle - sin prefijo comun usa el primer nombre", () => {
  assert.equal(deriveGroupTitle(["Silla Roja", "Mesa Natural"]), "Silla Roja");
});

test("deriveGroupTitle - lista vacia da string vacio", () => {
  assert.equal(deriveGroupTitle([]), "");
});

test("computeSkuGroups - agrupa productos que comparten raiz de SKU", () => {
  const products = [
    { productId: "1", sku: "BCV136PT", name: "Silla Rey Rojo", image: "", url: "" },
    { productId: "2", sku: "BCV136NT", name: "Silla Rey Natural", image: "", url: "" },
    { productId: "3", sku: "MSA200PT", name: "Mesa Arrime Rojo", image: "", url: "" },
  ];
  const { groups, ungrouped } = computeSkuGroups(products);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupKey, "BCV136");
  assert.equal(groups[0].products.length, 2);
  assert.equal(groups[0].title, "Silla Rey");
  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].productId, "3");
  assert.equal(ungrouped[0].reason, "single_product");
});

test("computeSkuGroups - SKU invalido va a ungrouped con la razon correcta", () => {
  const products = [
    { productId: "1", sku: "", name: "Sin SKU", image: "", url: "" },
    { productId: "2", sku: "X1", name: "SKU corto", image: "", url: "" },
  ];
  const { groups, ungrouped } = computeSkuGroups(products);
  assert.equal(groups.length, 0);
  assert.equal(ungrouped.length, 2);
  assert.equal(ungrouped[0].reason, "no_sku");
  assert.equal(ungrouped[1].reason, "sku_too_short");
});

test("computeSkuGroups - varios grupos simultaneos no se mezclan", () => {
  const products = [
    { productId: "1", sku: "BCV136PT", name: "Silla Rey Rojo", image: "", url: "" },
    { productId: "2", sku: "BCV136NT", name: "Silla Rey Natural", image: "", url: "" },
    { productId: "3", sku: "MSA200PT", name: "Mesa Arrime Rojo", image: "", url: "" },
    { productId: "4", sku: "MSA200NT", name: "Mesa Arrime Natural", image: "", url: "" },
  ];
  const { groups } = computeSkuGroups(products);
  assert.equal(groups.length, 2);
  const keys = groups.map((g) => g.groupKey).sort();
  assert.deepEqual(keys, ["BCV136", "MSA200"]);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: FAIL — `Cannot find module './variant-groups'`.

- [ ] **Step 3: Implementar `functions/variant-groups.js`**

```js
"use strict";

const SKU_SUFFIX_LENGTH = 2;
const MIN_GROUP_KEY_LENGTH = 3;

function splitSku(sku) {
  if (!sku || typeof sku !== "string") return null;
  const trimmed = sku.trim();
  if (trimmed.length <= SKU_SUFFIX_LENGTH) return null;
  const groupKey = trimmed.slice(0, -SKU_SUFFIX_LENGTH);
  const colorCode = trimmed.slice(-SKU_SUFFIX_LENGTH);
  if (groupKey.length < MIN_GROUP_KEY_LENGTH) return null;
  return { groupKey, colorCode };
}

function deriveGroupTitle(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return "";
  const wordLists = list.map((n) => n.trim().split(/\s+/));
  const first = wordLists[0];
  const common = [];
  for (let i = 0; i < first.length; i++) {
    const word = first[i];
    if (wordLists.every((words) => words[i] === word)) {
      common.push(word);
    } else {
      break;
    }
  }
  if (common.length >= 2) return common.join(" ");
  return list[0];
}

function computeSkuGroups(products) {
  const buckets = new Map();
  const ungrouped = [];

  for (const product of products || []) {
    const split = splitSku(product.sku);
    if (!split) {
      ungrouped.push({ ...product, reason: product.sku ? "sku_too_short" : "no_sku" });
      continue;
    }
    if (!buckets.has(split.groupKey)) buckets.set(split.groupKey, []);
    buckets.get(split.groupKey).push(product);
  }

  const groups = [];
  for (const [groupKey, members] of buckets) {
    if (members.length < 2) {
      for (const member of members) {
        ungrouped.push({ ...member, reason: "single_product" });
      }
      continue;
    }
    groups.push({
      groupKey,
      title: deriveGroupTitle(members.map((p) => p.name)),
      products: members,
    });
  }

  return { groups, ungrouped };
}

module.exports = {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
};
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/variant-groups.js functions/variant-groups.test.js
git commit -m "feat: algoritmo de agrupado por SKU (splitSku, computeSkuGroups, deriveGroupTitle)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 2: Algoritmo puro — `diffScanWithPublished`

**Files:**
- Modify: `functions/variant-groups.js`
- Modify: `functions/variant-groups.test.js`

**Interfaces:**
- Consumes: la forma `{ groups, ungrouped }` que produce `computeSkuGroups` (Task 1); forma de `groups` publicados definida en "Modelo de datos" arriba (`{ groupKey, title, hidden, excludedProductIds, products }`).
- Produces: `diffScanWithPublished(scanResult, publishedGroups) -> { newGroups, groupsWithAdditions, removedFromCatalog, ungrouped }`. Usado por la ruta `/api/variant-groups/scan` (Task 5) y por el frontend (Task 10).

- [ ] **Step 1: Escribir los tests que fallan**

```js
// agregar a functions/variant-groups.test.js
const { diffScanWithPublished } = require("./variant-groups");

function product(id, sku, name) {
  return { productId: id, sku, name, image: "", url: "" };
}

test("diffScanWithPublished - grupo nuevo (groupKey no publicado)", () => {
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, []);
  assert.equal(diff.newGroups.length, 1);
  assert.equal(diff.newGroups[0].groupKey, "BCV136");
  assert.equal(diff.groupsWithAdditions.length, 0);
  assert.equal(diff.removedFromCatalog.length, 0);
});

test("diffScanWithPublished - producto nuevo para un grupo ya publicado", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [product("1", "BCV136PT", "Silla Rey Rojo")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.newGroups.length, 0);
  assert.equal(diff.groupsWithAdditions.length, 1);
  assert.equal(diff.groupsWithAdditions[0].newProducts.length, 1);
  assert.equal(diff.groupsWithAdditions[0].newProducts[0].productId, "2");
});

test("diffScanWithPublished - producto en excludedProductIds nunca se re-sugiere", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: ["2"],
    products: [product("1", "BCV136PT", "Silla Rey Rojo")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.groupsWithAdditions.length, 0);
});

test("diffScanWithPublished - producto publicado que ya no esta en el catalogo", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.removedFromCatalog.length, 1);
  assert.equal(diff.removedFromCatalog[0].products.length, 1);
  assert.equal(diff.removedFromCatalog[0].products[0].productId, "2");
});

test("diffScanWithPublished - grupo publicado que desaparece por completo del escaneo", () => {
  const published = [{
    groupKey: "OLD99", title: "Descontinuado", hidden: false, excludedProductIds: [],
    products: [product("9", "OLD99RJ", "Viejo Rojo")],
  }];
  const scan = { groups: [], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.removedFromCatalog.length, 1);
  assert.equal(diff.removedFromCatalog[0].groupKey, "OLD99");
});

test("diffScanWithPublished - ungrouped pasa igual", () => {
  const scan = { groups: [], ungrouped: [product("5", "X1", "Suelto")] };
  const diff = diffScanWithPublished(scan, []);
  assert.equal(diff.ungrouped.length, 1);
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: FAIL — `diffScanWithPublished is not a function`.

- [ ] **Step 3: Implementar `diffScanWithPublished`**

Agregar a `functions/variant-groups.js` (antes de `module.exports`):

```js
function diffScanWithPublished(scanResult, publishedGroups) {
  const published = new Map((publishedGroups || []).map((g) => [g.groupKey, g]));
  const newGroups = [];
  const groupsWithAdditions = [];
  const removedFromCatalog = [];

  for (const scanned of scanResult.groups) {
    const pub = published.get(scanned.groupKey);
    if (!pub) {
      newGroups.push(scanned);
      continue;
    }

    const excluded = new Set((pub.excludedProductIds || []).map(String));
    const existingIds = new Set(pub.products.map((p) => String(p.productId)));
    const newProducts = scanned.products.filter(
      (p) => !existingIds.has(String(p.productId)) && !excluded.has(String(p.productId))
    );
    if (newProducts.length) {
      groupsWithAdditions.push({
        groupKey: scanned.groupKey,
        title: pub.title,
        existingProducts: pub.products,
        newProducts,
      });
    }

    const scannedIds = new Set(scanned.products.map((p) => String(p.productId)));
    const missing = pub.products.filter((p) => !scannedIds.has(String(p.productId)));
    if (missing.length) {
      removedFromCatalog.push({ groupKey: scanned.groupKey, title: pub.title, products: missing });
    }
  }

  for (const pub of publishedGroups || []) {
    const stillScanned = scanResult.groups.some((g) => g.groupKey === pub.groupKey);
    if (!stillScanned && pub.products.length) {
      removedFromCatalog.push({ groupKey: pub.groupKey, title: pub.title, products: pub.products });
    }
  }

  return { newGroups, groupsWithAdditions, removedFromCatalog, ungrouped: scanResult.ungrouped };
}
```

Y agregar `diffScanWithPublished` al `module.exports` existente.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/variant-groups.js functions/variant-groups.test.js
git commit -m "feat: diff de re-escaneo contra grupos publicados (diffScanWithPublished)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 3: Algoritmo puro — `buildWidgetIndex`

**Files:**
- Modify: `functions/variant-groups.js`
- Modify: `functions/variant-groups.test.js`

**Interfaces:**
- Consumes: `groups` publicados (misma forma que Task 2).
- Produces: `buildWidgetIndex(groups) -> { [productId]: { groupKey, siblings: [{ productId, url, image, active }] } }`. Usado por la ruta `/api/variant-groups-data.json` (Task 6).

- [ ] **Step 1: Escribir los tests que fallan**

```js
// agregar a functions/variant-groups.test.js
const { buildWidgetIndex } = require("./variant-groups");

test("buildWidgetIndex - cada producto del grupo apunta a sus siblings", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: "img1", url: "/rojo" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "img2", url: "/natural" },
    ],
  }];
  const index = buildWidgetIndex(groups);
  assert.equal(Object.keys(index).length, 2);
  assert.equal(index["1"].groupKey, "BCV136");
  assert.equal(index["1"].siblings.length, 2);
  const self1 = index["1"].siblings.find((s) => s.productId === "1");
  assert.equal(self1.active, true);
  const other1 = index["1"].siblings.find((s) => s.productId === "2");
  assert.equal(other1.active, false);
});

test("buildWidgetIndex - excluye grupos hidden", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: true, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: "", url: "" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "", url: "" },
    ],
  }];
  assert.deepEqual(buildWidgetIndex(groups), {});
});

test("buildWidgetIndex - grupo con menos de 2 productos no genera entradas", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [{ productId: "1", sku: "BCV136PT", name: "Rojo", image: "", url: "" }],
  }];
  assert.deepEqual(buildWidgetIndex(groups), {});
});

test("buildWidgetIndex - sin grupos da objeto vacio", () => {
  assert.deepEqual(buildWidgetIndex([]), {});
  assert.deepEqual(buildWidgetIndex(undefined), {});
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: FAIL — `buildWidgetIndex is not a function`.

- [ ] **Step 3: Implementar `buildWidgetIndex`**

Agregar a `functions/variant-groups.js`:

```js
function buildWidgetIndex(groups) {
  const index = {};
  for (const group of groups || []) {
    if (group.hidden) continue;
    if (!group.products || group.products.length < 2) continue;
    for (const product of group.products) {
      index[String(product.productId)] = {
        groupKey: group.groupKey,
        siblings: group.products.map((p) => ({
          productId: String(p.productId),
          url: p.url,
          image: p.image,
          active: String(p.productId) === String(product.productId),
        })),
      };
    }
  }
  return index;
}
```

Y agregarlo al `module.exports`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/variant-groups.js functions/variant-groups.test.js
git commit -m "feat: construir el indice de grupos para el widget (buildWidgetIndex)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 4: Cliente de catálogo — `fetchAllStoreProducts`

**Files:**
- Modify: `functions/variant-groups.js`
- Modify: `functions/variant-groups.test.js`

**Interfaces:**
- Consumes: `fetch`-like función inyectable (`fetchImpl`), igual patrón que `createTiendanubeClient` en `functions/coming-soon.js`.
- Produces: `fetchAllStoreProducts({ storeId, accessToken, fetchImpl }) -> Promise<[{ productId, sku, name, image, url }]>`. Usado por la ruta `/api/variant-groups/scan` (Task 5).

- [ ] **Step 1: Escribir los tests que fallan**

```js
// agregar a functions/variant-groups.test.js
const { fetchAllStoreProducts } = require("./variant-groups");

function fakeProduct(id, sku, name) {
  return {
    id,
    name: { es: name },
    images: [{ src: "https://img/" + id }],
    variants: [{ sku }],
    canonical_url: "https://tienda/productos/" + id,
  };
}

test("fetchAllStoreProducts - mapea el shape esperado", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [fakeProduct("1", "BCV136PT", "Silla Rey Rojo")] };
  };
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products.length, 1);
  assert.deepEqual(products[0], {
    productId: "1",
    sku: "BCV136PT",
    name: "Silla Rey Rojo",
    image: "https://img/1",
    url: "https://tienda/productos/1",
  });
});

test("fetchAllStoreProducts - pagina hasta que una pagina viene incompleta", async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) {
      const page = [];
      for (let i = 0; i < 200; i++) page.push(fakeProduct(String(i), "SKU" + i + "PT", "P" + i));
      return { ok: true, json: async () => page };
    }
    if (call === 2) {
      return { ok: true, json: async () => [fakeProduct("200", "SKU200PT", "P200")] };
    }
    throw new Error("no deberia pedir una tercera pagina");
  };
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products.length, 201);
  assert.equal(call, 2);
});

test("fetchAllStoreProducts - producto sin variantes da sku vacio", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [{ id: "9", name: "Sin variante", images: [], variants: [], canonical_url: "" }],
  });
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products[0].sku, "");
});

test("fetchAllStoreProducts - respuesta no-ok lanza error", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl }));
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: FAIL — `fetchAllStoreProducts is not a function`.

- [ ] **Step 3: Implementar `fetchAllStoreProducts`**

Agregar a `functions/variant-groups.js` (después de las funciones puras, antes de `registerVariantGroupsRoutes` que se crea en Task 5):

```js
const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PRODUCTS_PER_PAGE = 200;

async function fetchAllStoreProducts({ storeId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA };
  const out = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?page=${page}&per_page=${PRODUCTS_PER_PAGE}&fields=id,name,images,variants,canonical_url`,
      { headers }
    );
    if (!res.ok) {
      const err = new Error(`TN GET products page ${page}: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;

    for (const product of items) {
      const variant = Array.isArray(product.variants) ? product.variants[0] : null;
      const name =
        typeof product.name === "object"
          ? product.name.es || Object.values(product.name)[0] || ""
          : product.name || "";
      out.push({
        productId: String(product.id),
        sku: variant && variant.sku ? String(variant.sku) : "",
        name,
        image: (product.images && product.images[0] && (product.images[0].src || product.images[0])) || "",
        url: product.canonical_url || "",
      });
    }

    if (items.length < PRODUCTS_PER_PAGE) break;
    page += 1;
  }

  return out;
}
```

Y agregar `fetchAllStoreProducts` al `module.exports`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd functions && node --test variant-groups.test.js`
Expected: PASS (23 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/variant-groups.js functions/variant-groups.test.js
git commit -m "feat: fetch paginado del catalogo completo de Tiendanube (fetchAllStoreProducts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 5: Rutas del admin — config, scan, publish, install

**Files:**
- Modify: `functions/variant-groups.js`
- Modify: `functions/index.js:773` (wiring, justo después del bloque de `coming-soon`)

**Interfaces:**
- Consumes: `computeSkuGroups`, `diffScanWithPublished`, `fetchAllStoreProducts` (Tasks 1, 2, 4); `db`, `FieldValue`, `checkStoreActive` inyectados desde `index.js`.
- Produces: `registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive })`, exportada. Los endpoints listados en la tabla de arriba (menos `widget.js`/`data.json`, que son Task 6).

- [ ] **Step 1: Agregar constantes y las 4 rutas de admin**

Agregar a `functions/variant-groups.js` (antes de `module.exports`):

```js
const COLLECTION = "promonube_variant_groups";
const TN_2025 = "https://api.tiendanube.com/2025-03";

// TODO: completar con el id real de Partners (Aplicaciones -> GlowLab #23137 -> Scripts)
const VARIANT_GROUPS_SCRIPT_ID = null;

// Piloto: solo Alto Rancho y la tienda demo.
// TODO: quitar allowlist cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ["2547699", "6854698"];

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  swatchSize: "md",
  groups: [],
  ungrouped: [],
  lastScanAt: null,
};

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

function registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive }) {
  // GET /api/variant-groups-config?storeId=X
  app.get("/api/variant-groups-config", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }

    try {
      const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
      const config = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/variant-groups-config - guarda solo settings (no toca groups/ungrouped)
  app.post("/api/variant-groups-config", async (req, res) => {
    const { storeId, config } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }
    if (!config || typeof config !== "object") {
      return res.status(400).json({ success: false, message: "config requerido" });
    }

    try {
      const settings = {
        enabled: !!config.enabled,
        showOnListing: config.showOnListing !== false,
        showOnPDP: config.showOnPDP !== false,
        swatchSize: ["sm", "md", "lg"].includes(config.swatchSize) ? config.swatchSize : "md",
        updatedAt: FieldValue.serverTimestamp(),
      };
      await db.collection(COLLECTION).doc(String(storeId)).set(settings, { merge: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/variant-groups/scan - escanea el catalogo, propone grupos, NO persiste
  app.post("/api/variant-groups/scan", async (req, res) => {
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }
    if (!(await checkStoreActive(storeId))) {
      return res.status(403).json({ success: false, message: "Plan inactivo" });
    }

    try {
      const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
      if (!storeDoc.exists) return res.status(404).json({ success: false, message: "Tienda no encontrada" });
      const accessToken = storeDoc.data().accessToken;
      if (!accessToken) return res.status(401).json({ success: false, message: "No hay token de acceso" });

      const products = await fetchAllStoreProducts({ storeId, accessToken });
      const scanResult = computeSkuGroups(products);

      const configDoc = await db.collection(COLLECTION).doc(String(storeId)).get();
      const published = configDoc.exists ? configDoc.data().groups || [] : [];
      const diff = diffScanWithPublished(scanResult, published);

      res.json({ success: true, ...diff, publishedGroups: published });
    } catch (error) {
      console.error("[VariantGroups scan]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/variant-groups/publish - persiste el estado final aprobado en la revision
  app.post("/api/variant-groups/publish", async (req, res) => {
    const { storeId, groups, ungrouped } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }
    if (!Array.isArray(groups)) return res.status(400).json({ success: false, message: "groups requerido" });

    try {
      await db.collection(COLLECTION).doc(String(storeId)).set(
        {
          groups,
          ungrouped: Array.isArray(ungrouped) ? ungrouped : [],
          lastScanAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/variant-groups/install - instala el script en la tienda (Scripts API clasica)
  app.post("/api/variant-groups/install", async (req, res) => {
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }
    if (!(await checkStoreActive(storeId))) {
      return res.status(403).json({ success: false, message: "Plan inactivo" });
    }
    if (!VARIANT_GROUPS_SCRIPT_ID) {
      return res.status(500).json({ success: false, message: "Script no registrado en Partners todavía" });
    }

    try {
      const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
      if (!storeDoc.exists) return res.status(404).json({ success: false, message: "Tienda no encontrada" });
      const accessToken = storeDoc.data().accessToken;

      const installRes = await fetch(`${TN_2025}/${storeId}/scripts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": TN_UA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script_id: VARIANT_GROUPS_SCRIPT_ID }),
      });

      if (!installRes.ok) {
        const t = await installRes.text();
        return res.status(500).json({ success: false, message: "Error TN: " + t });
      }

      const installed = await installRes.json();
      res.json({ success: true, message: "Script activado para la tienda", result: installed });
    } catch (error) {
      console.error("[VariantGroups install]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}
```

Agregar `registerVariantGroupsRoutes` al `module.exports`.

- [ ] **Step 2: Wiring en `functions/index.js`**

Justo después del bloque de `coming-soon` (línea ~773):

```js
// Grupos de Variantes por SKU - agrupa productos de Alto Rancho por SKU (piloto)
const { registerVariantGroupsRoutes } = require('./variant-groups');
registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive });
```

- [ ] **Step 3: Verificar que el módulo carga sin errores**

Run: `cd functions && node -e "require('./index.js'); console.log('OK')"`
Expected: imprime `OK` sin excepciones (Ctrl+C si queda escuchando; el objetivo es solo verificar que no rompe el require).

- [ ] **Step 4: Verificar las rutas a mano con el server local**

```bash
cd functions && node index.js
```

En otra terminal (reemplazar `<TOKEN>` por un `accessToken` real de `promonube_stores/2547699` si se quiere probar contra Tiendanube de verdad; si no, alcanza con confirmar que el allowlist funciona):

```bash
curl "http://localhost:8080/api/variant-groups-config?storeId=2547699"
# Expected: {"success":true,"config":{"enabled":false,...}}

curl "http://localhost:8080/api/variant-groups-config?storeId=999999"
# Expected: 403 {"success":false,"message":"Módulo no disponible para esta tienda"}
```

(Puerto real: el que loguee `node index.js` al arrancar — puede no ser 8080, ajustar el curl al puerto impreso.)

- [ ] **Step 5: Commit**

```bash
git add functions/variant-groups.js functions/index.js
git commit -m "feat: rutas de admin para Grupos de Variantes (config, scan, publish, install)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 6: Rutas públicas — `widget.js` + `data.json` + `buildWidgetScript`

**Files:**
- Modify: `functions/variant-groups.js`

**Interfaces:**
- Consumes: `buildWidgetIndex` (Task 3), `DEFAULT_CONFIG`, `isAllowedStore`, `COLLECTION` (Task 5).
- Produces: dos rutas nuevas dentro de `registerVariantGroupsRoutes` + función `buildWidgetScript(store, cfg)`.

- [ ] **Step 1: Agregar `buildWidgetScript` y las 2 rutas públicas**

Agregar `buildWidgetScript` a `functions/variant-groups.js` (función de nivel de módulo, junto a `fetchAllStoreProducts`):

```js
function buildWidgetScript(store, cfg) {
  return `
/**
 * PromoNube - Grupos de Variantes
 * Tienda: ${store}
 */
(function() {
  'use strict';
  if (window.__pnVariantGroupsLoaded) return;
  window.__pnVariantGroupsLoaded = true;

  var CFG = ${JSON.stringify(cfg)};
  var DATA_URL = 'https://glowlab-production.up.railway.app/api/variant-groups-data.json?store=${store}';
  var INDEX = null;
  var SWATCH_PX = { sm: 28, md: 36, lg: 44 }[CFG.swatchSize] || 36;

  function injectStyles() {
    if (document.getElementById('pn-vg-styles')) return;
    var s = document.createElement('style');
    s.id = 'pn-vg-styles';
    s.textContent = [
      '.pn-vg-row, .pn-vg-row * { box-sizing: border-box !important; }',
      '.pn-vg-row { display: flex !important; gap: 6px !important; flex-wrap: wrap !important; margin: 8px 0 !important; }',
      '.pn-vg-swatch { display: inline-block !important; width: ' + SWATCH_PX + 'px !important; height: ' + SWATCH_PX + 'px !important; border-radius: 50% !important; background-size: cover !important; background-position: center !important; border: 2px solid transparent !important; text-decoration: none !important; }',
      '.pn-vg-swatch.pn-vg-active { border-color: #111 !important; }',
      'a.pn-vg-swatch { cursor: pointer !important; }',
    ].join('');
    document.head.appendChild(s);
  }

  function loadIndex(cb) {
    if (INDEX) return cb(INDEX);
    fetch(DATA_URL).then(function(r) { return r.json(); }).then(function(data) {
      INDEX = data || {};
      cb(INDEX);
    }).catch(function() { INDEX = {}; cb(INDEX); });
  }

  function buildRow(entry) {
    var row = document.createElement('div');
    row.className = 'pn-vg-row';
    entry.siblings.forEach(function(sib) {
      var el = document.createElement(sib.active ? 'span' : 'a');
      el.className = 'pn-vg-swatch' + (sib.active ? ' pn-vg-active' : '');
      if (!sib.active) el.setAttribute('href', sib.url);
      if (sib.image) el.style.backgroundImage = 'url(' + sib.image + ')';
      row.appendChild(el);
    });
    return row;
  }

  function runPDP() {
    if (!CFG.showOnPDP) return;
    var product = window.LS && window.LS.product;
    if (!product) return;
    var entry = INDEX[String(product.id)];
    if (!entry) return;
    if (document.querySelector('.pn-vg-row')) return;
    var anchor = document.querySelector('.product-price, .js-product-price, [data-store="product-price"], h1');
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(buildRow(entry), anchor.nextSibling);
  }

  var LISTING_SELECTORS = ['[data-item-id]', '.product-item', '.item-product', '[data-product-id]'];

  function runListing() {
    if (!CFG.showOnListing) return;
    var cards = [];
    for (var i = 0; i < LISTING_SELECTORS.length; i++) {
      var found = document.querySelectorAll(LISTING_SELECTORS[i]);
      if (found.length) { cards = found; break; }
    }
    cards.forEach(function(card) {
      if (card.querySelector('.pn-vg-row')) return;
      var id = card.getAttribute('data-item-id') || card.getAttribute('data-product-id');
      if (!id) return;
      var entry = INDEX[String(id)];
      if (!entry) return;
      card.appendChild(buildRow(entry));
    });
  }

  function run() {
    injectStyles();
    loadIndex(function() {
      var isPDP = !!(window.LS && window.LS.product);
      if (isPDP) runPDP();
      else runListing();
    });
  }

  var debounceTimer = null;
  function scheduleRun() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  var observer = new MutationObserver(scheduleRun);
  observer.observe(document.body, { childList: true, subtree: true });
})();
`;
}
```

> **Nota (limitación conocida):** en el listado, `runListing` necesita que el theme exponga `data-item-id` o `data-product-id` en el card (misma lista de selectores que `price-financing.js`/`coming-soon.js`). Si el theme de Alto Rancho no lo expone, los swatches en listado no van a aparecer — solo en PDP, donde `window.LS.product.id` siempre está disponible. Se confirma en la QA manual (Task 11).

Agregar las 2 rutas dentro de `registerVariantGroupsRoutes`, después de la ruta `/api/variant-groups/install`:

```js
  // GET /api/variant-groups-widget.js?store=X - script liviano, no lleva datos embebidos
  app.get("/api/variant-groups-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store || !isAllowedStore(store)) {
      return res.send("// PromoNube Grupos de Variantes: no disponible");
    }

    try {
      if (!(await checkStoreActive(store))) {
        return res.send("// PromoNube Grupos de Variantes: plan inactivo");
      }
      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      const cfg = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      if (cfg.enabled === false) {
        return res.send("// PromoNube Grupos de Variantes: deshabilitado");
      }
      res.send(
        buildWidgetScript(store, {
          showOnListing: cfg.showOnListing !== false,
          showOnPDP: cfg.showOnPDP !== false,
          swatchSize: cfg.swatchSize || "md",
        })
      );
    } catch (error) {
      res.send("// PromoNube Grupos de Variantes: error " + error.message);
    }
  });

  // GET /api/variant-groups-data.json?store=X - datos que el script pide en runtime
  app.get("/api/variant-groups-data.json", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store || !isAllowedStore(store)) return res.json({});

    try {
      if (!(await checkStoreActive(store))) return res.json({});
      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      if (!doc.exists) return res.json({});
      const cfg = doc.data();
      if (cfg.enabled === false) return res.json({});
      res.json(buildWidgetIndex(cfg.groups || []));
    } catch (error) {
      res.json({});
    }
  });
```

- [ ] **Step 2: Verificar a mano con el server local**

```bash
cd functions && node index.js
```

```bash
curl "http://localhost:8080/api/variant-groups-widget.js?store=2547699"
# Expected: JS empieza con "// PromoNube Grupos de Variantes: deshabilitado" (enabled sigue en false por defecto)

curl "http://localhost:8080/api/variant-groups-data.json?store=999999"
# Expected: {}
```

- [ ] **Step 3: Commit**

```bash
git add functions/variant-groups.js
git commit -m "feat: widget publico (widget.js + data.json) para Grupos de Variantes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 7: Bootstrap script para Partners

**Files:**
- Create: `variant-groups-version.js` (raíz del repo)

**Interfaces:**
- Consumes: nada del repo (script standalone que se sube a mano a Tiendanube Partners).
- Produces: archivo versionado, copia funcional de `price-financing-version.js` apuntando al endpoint nuevo.

- [ ] **Step 1: Crear el archivo**

```js
// PromoNube Grupos de Variantes - Bootstrap script para subir al panel de TiendaNube Partners.
// Detecta el storeId automáticamente y carga el widget dinámico (multi-tenant).

(function() {
  'use strict';

  function getStoreId() {
    var metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) {
      return metaStoreId.content;
    }
    if (window.LS && window.LS.store && window.LS.store.id) {
      return String(window.LS.store.id);
    }
    var bodyStore = document.body && document.body.getAttribute('data-store');
    if (bodyStore) {
      return bodyStore;
    }
    console.warn('PromoNube VariantGroups: no se pudo detectar el storeId');
    return null;
  }

  if (window.__promonubeVariantGroupsBootstrap) {
    return;
  }
  window.__promonubeVariantGroupsBootstrap = true;

  var storeId = getStoreId();
  if (!storeId) {
    return;
  }

  var script = document.createElement('script');
  script.src = 'https://glowlab-production.up.railway.app/api/variant-groups-widget.js?store=' + encodeURIComponent(storeId);
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube VariantGroups: error cargando el widget');
    window.__promonubeVariantGroupsBootstrap = false;
  };
  document.head.appendChild(script);
})();
```

- [ ] **Step 2: Commit**

```bash
git add variant-groups-version.js
git commit -m "chore: bootstrap script de Grupos de Variantes para subir a Partners

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 8: Sidebar — ítem de menú exclusivo por tienda

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `STORE_EXCLUSIVE_ITEMS` (objeto ya existente en el archivo, ver `src/components/Sidebar.jsx:24-30`).
- Produces: entrada de menú visible solo para `storeId` `2547699` y `6854698`.

- [ ] **Step 1: Importar el ícono y agregar las entradas**

Modificar el import de `lucide-react` (línea 2-5):

```jsx
import {
  LayoutDashboard, Palette, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Percent, Search, Rocket, Layers
} from 'lucide-react';
```

Modificar `STORE_EXCLUSIVE_ITEMS` (líneas 24-30) — se agrega el ítem nuevo a la entrada de Alto Rancho existente, y se crea la entrada de la tienda demo:

```jsx
// Módulos exclusivos por tienda
// Piloto: Grupos de Variantes solo para Alto Rancho (2547699) y la tienda demo (6854698).
// TODO: mover a BASE_NAV_ITEMS cuando se libere a todas las tiendas.
const STORE_EXCLUSIVE_ITEMS = {
  '2547699': [
    { divider: true, exclusive: true },
    { path: '/local-stock', icon: MapPin, label: 'Stock Altorancho', exclusive: true },
    { path: '/checkout-notice', icon: MessageCircle, label: 'Aviso Checkout', exclusive: true },
    { path: '/grupos-variantes', icon: Layers, label: 'Grupos de Variantes', exclusive: true },
  ],
  '6854698': [
    { divider: true, exclusive: true },
    { path: '/grupos-variantes', icon: Layers, label: 'Grupos de Variantes', exclusive: true },
  ],
};
```

- [ ] **Step 2: Verificar en dev server**

`npm run dev` → loguear con la tienda demo (`localStorage.promonube_store_id === '6854698'`) → el ítem "Grupos de Variantes" aparece en el sidebar con el ícono de capas. Loguear con cualquier otra tienda (o borrar `promonube_store_id`) → el ítem no aparece.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add src/components/Sidebar.jsx
git commit -m "feat: item de menu Grupos de Variantes para Alto Rancho y la tienda demo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 9: Frontend — esqueleto de página + sección General

**Files:**
- Create: `src/pages/VariantGroupsConfig.jsx`
- Create: `src/pages/VariantGroupsConfig.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `apiRequest`/`API_CONFIG` de `../config`, `useToast` de `../context/ToastContext`, endpoints `GET /api/variant-groups-config` y `POST /api/variant-groups-config` (Task 5).
- Produces: componente default `VariantGroupsConfig`, estado `config` (forma `DEFAULT_CONFIG` del backend) disponible para las Tasks 10 y 11 que se agregan al mismo archivo.

- [ ] **Step 1: Ruta en `src/App.jsx`**

Agregar el import junto a los demás (después de la línea de `ComingSoonConfig`, ~línea 35):

```jsx
import VariantGroupsConfig from './pages/VariantGroupsConfig';
```

Agregar la ruta dentro de `<Route element={<AppLayout />}>`, después de `/proximamente` (~línea 83):

```jsx
          <Route path="/grupos-variantes" element={<VariantGroupsConfig />} />
```

- [ ] **Step 2: Crear `src/pages/VariantGroupsConfig.jsx` — esqueleto + General**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Layers } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';

// Piloto: solo estas dos tiendas ven el modulo (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
// TODO: quitar este guard cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ['2547699', '6854698'];

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  swatchSize: 'md',
  groups: [],
  ungrouped: [],
  lastScanAt: null,
};

export default function VariantGroupsConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  useEffect(() => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) navigate('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/variant-groups-config?storeId=${storeId}`);
      if (res?.success && res.config) {
        setConfig({ ...DEFAULT_CONFIG, ...res.config });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/variant-groups-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) toast.success('Configuración guardada');
      else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [storeId, config, toast]);

  if (loading) {
    return (
      <div className="page-container vg-page">
        <div className="vg-loading"><div className="vg-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  return (
    <div className="page-container vg-page">
      <div className="vg-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="vg-btn-save" onClick={saveSettings} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Layers size={22} /></div>
        <div>
          <h1>Grupos de Variantes</h1>
          <p>Agrupa productos por color usando el SKU y mostrá swatches en la tienda.</p>
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>General</h2>
          <label className="toggle-switch">
            <input type="checkbox" checked={!!config.enabled}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="vg-row">
          <label className="vg-check">
            <input type="checkbox" checked={config.showOnListing !== false}
              onChange={e => setConfig(c => ({ ...c, showOnListing: e.target.checked }))} /> Mostrar en listado
          </label>
          <label className="vg-check">
            <input type="checkbox" checked={config.showOnPDP !== false}
              onChange={e => setConfig(c => ({ ...c, showOnPDP: e.target.checked }))} /> Mostrar en ficha de producto
          </label>
          <div className="vg-field">
            <label>Tamaño de swatch</label>
            <select value={config.swatchSize} onChange={e => setConfig(c => ({ ...c, swatchSize: e.target.value }))}>
              <option value="sm">Chico</option>
              <option value="md">Mediano</option>
              <option value="lg">Grande</option>
            </select>
          </div>
        </div>
        <p className="vg-hint">
          {config.lastScanAt ? 'Último escaneo publicado.' : 'Todavía no escaneaste el catálogo.'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/pages/VariantGroupsConfig.css`**

```css
.vg-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 40px 60px;
  color-scheme: dark;
}

.vg-loading {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--gl-text-muted);
}
.vg-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(124, 124, 255, 0.15);
  border-top: 3px solid #7C7CFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.vg-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }

.vg-btn-save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--gl-accent-gradient);
  color: #fff;
  border: none;
  border-radius: var(--gl-radius-md);
  padding: 10px 20px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 217, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.vg-btn-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 25px rgba(0, 217, 255, 0.5); }
.vg-btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.vg-hero { display: flex; gap: 16px; align-items: center; margin-bottom: 28px; }
.vg-hero-icon {
  width: 48px; height: 48px; flex-shrink: 0;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: var(--gl-accent-gradient);
  color: #fff;
  box-shadow: 0 4px 20px rgba(0, 217, 255, 0.35);
}
.vg-hero h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
  background: var(--gl-accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.vg-hero p { margin: 0; font-size: 14px; color: var(--gl-text-secondary); }

.vg-hint { color: var(--gl-text-muted); font-size: 13px; margin: 10px 0 0; line-height: 1.5; }

.vg-page > .config-section { margin-bottom: 20px; }

.vg-row { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }
.vg-check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--gl-text-secondary); cursor: pointer; }
.vg-field { display: flex; flex-direction: column; gap: 6px; min-width: 150px; }
.vg-field label {
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--gl-text-muted);
}
.vg-field select { padding: 10px 12px; border-radius: var(--gl-radius-sm); font-size: 14px; min-width: 160px; }
```

- [ ] **Step 4: Verificar en dev server**

`npm run dev` → loguear con `localStorage.promonube_store_id = '6854698'` (tienda demo) → navegar a `/#/grupos-variantes`:
- Carga sin errores, se ve el hero con gradiente, la sección General con el toggle y los 2 checkboxes.
- Tildar/destildar "Mostrar en listado", cambiar tamaño de swatch, "Guardar" → toast de éxito.
- Recargar la página → los valores guardados persisten.
- Cambiar `promonube_store_id` a una tienda que no esté en el allowlist (ej. `'2101051'`) y navegar a `/#/grupos-variantes` a mano → redirige a `/dashboard`.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/pages/VariantGroupsConfig.jsx src/pages/VariantGroupsConfig.css src/App.jsx
git commit -m "feat: pagina Grupos de Variantes - esqueleto, guard de allowlist y seccion General

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 10: Frontend — Escanear y revisar

**Files:**
- Modify: `src/pages/VariantGroupsConfig.jsx`
- Modify: `src/pages/VariantGroupsConfig.css`

**Interfaces:**
- Consumes: `POST /api/variant-groups/scan` → `{ success, newGroups, groupsWithAdditions, removedFromCatalog, ungrouped, publishedGroups }` (Task 5); `POST /api/variant-groups/publish` (Task 5).
- Produces: estado `proposal` y `publishGroups()`, que Task 11 no necesita pero comparte el mismo `config.groups` recargado tras publicar.

Forma de trabajo del estado de revisión (local, no se manda tal cual al backend):

```js
// proposal, tal como llega de /scan:
// { newGroups: [{groupKey, title, products}],
//   groupsWithAdditions: [{groupKey, title, existingProducts, newProducts}],
//   removedFromCatalog: [{groupKey, title, products}],
//   ungrouped: [{productId, sku, name, image, url, reason}],
//   publishedGroups: [...] }
```

- [ ] **Step 1: Estado de escaneo/revisión y `runScan`**

Agregar dentro del componente `VariantGroupsConfig` (después de `saveSettings`):

```jsx
const [scanning, setScanning] = useState(false);
const [proposal, setProposal] = useState(null);
// selección editable: qué incluir de cada bucket propuesto
const [includedNewGroupProducts, setIncludedNewGroupProducts] = useState({}); // { [groupKey]: Set(productId) }
const [includedAdditions, setIncludedAdditions] = useState({}); // { [groupKey]: Set(productId) }
const [includedRemovals, setIncludedRemovals] = useState({}); // { [groupKey]: Set(productId) }
const [groupTitleEdits, setGroupTitleEdits] = useState({}); // { [groupKey]: title }
const [ungroupedAssignment, setUngroupedAssignment] = useState({}); // { [productId]: groupKey }

const runScan = async () => {
  setScanning(true);
  try {
    const res = await apiRequest('/api/variant-groups/scan', {
      method: 'POST',
      body: JSON.stringify({ storeId }),
    });
    if (!res?.success) { toast.error(res?.message || 'Error al escanear'); return; }

    setProposal(res);
    setIncludedNewGroupProducts(
      Object.fromEntries(res.newGroups.map(g => [g.groupKey, new Set(g.products.map(p => String(p.productId)))]))
    );
    setIncludedAdditions(
      Object.fromEntries(res.groupsWithAdditions.map(g => [g.groupKey, new Set(g.newProducts.map(p => String(p.productId)))]))
    );
    setIncludedRemovals(
      Object.fromEntries(res.removedFromCatalog.map(g => [g.groupKey, new Set(g.products.map(p => String(p.productId)))]))
    );
    setGroupTitleEdits(Object.fromEntries(res.newGroups.map(g => [g.groupKey, g.title])));
    setUngroupedAssignment({});
    toast.success(`Escaneo listo: ${res.newGroups.length} grupos nuevos, ${res.groupsWithAdditions.length} con novedades`);
  } catch (e) {
    toast.error('Error: ' + e.message);
  } finally {
    setScanning(false);
  }
};

const toggleInSet = (setter, groupKey, productId) => setter(prev => {
  const next = { ...prev };
  const current = new Set(next[groupKey] || []);
  const id = String(productId);
  if (current.has(id)) current.delete(id); else current.add(id);
  next[groupKey] = current;
  return next;
});
```

- [ ] **Step 2: `publishProposal` — arma el `groups` final y llama a `/publish`**

```jsx
const allGroupKeysForAssignment = () => {
  const fromNew = (proposal?.newGroups || []).map(g => g.groupKey);
  const fromPublished = (proposal?.publishedGroups || []).map(g => g.groupKey);
  return [...new Set([...fromNew, ...fromPublished])];
};

const publishProposal = async () => {
  if (!proposal) return;

  const byKey = new Map((proposal.publishedGroups || []).map(g => [g.groupKey, {
    ...g,
    products: [...g.products],
    excludedProductIds: [...(g.excludedProductIds || [])],
  }]));

  // grupos nuevos aprobados
  for (const g of proposal.newGroups) {
    const included = includedNewGroupProducts[g.groupKey] || new Set();
    const products = g.products.filter(p => included.has(String(p.productId)));
    if (products.length < 2) continue; // sin suficientes productos, no se publica
    byKey.set(g.groupKey, {
      groupKey: g.groupKey,
      title: groupTitleEdits[g.groupKey] || g.title,
      hidden: false,
      excludedProductIds: [],
      products,
    });
  }

  // adiciones a grupos ya publicados
  for (const g of proposal.groupsWithAdditions) {
    const existing = byKey.get(g.groupKey);
    if (!existing) continue;
    const included = includedAdditions[g.groupKey] || new Set();
    const toAdd = g.newProducts.filter(p => included.has(String(p.productId)));
    const notIncluded = g.newProducts.filter(p => !included.has(String(p.productId)));
    existing.products = [...existing.products, ...toAdd];
    existing.excludedProductIds = [
      ...existing.excludedProductIds,
      ...notIncluded.map(p => String(p.productId)),
    ];
  }

  // productos que ya no estan en el catalogo
  for (const g of proposal.removedFromCatalog) {
    const existing = byKey.get(g.groupKey);
    if (!existing) continue;
    const toRemove = includedRemovals[g.groupKey] || new Set();
    existing.products = existing.products.filter(p => !toRemove.has(String(p.productId)));
  }

  // sin agrupar asignados a mano a un grupo
  for (const [productId, targetKey] of Object.entries(ungroupedAssignment)) {
    if (!targetKey) continue;
    const target = byKey.get(targetKey);
    const source = proposal.ungrouped.find(p => String(p.productId) === productId);
    if (!target || !source) continue;
    if (target.products.some(p => String(p.productId) === productId)) continue;
    target.products.push({ productId: source.productId, sku: source.sku, name: source.name, image: source.image, url: source.url });
  }

  const finalGroups = [...byKey.values()].filter(g => g.products.length >= 2);
  const assignedIds = new Set(Object.keys(ungroupedAssignment).filter(id => ungroupedAssignment[id]));
  const finalUngrouped = proposal.ungrouped.filter(p => !assignedIds.has(String(p.productId)));

  try {
    const res = await apiRequest('/api/variant-groups/publish', {
      method: 'POST',
      body: JSON.stringify({ storeId, groups: finalGroups, ungrouped: finalUngrouped }),
    });
    if (res?.success) {
      toast.success('Grupos publicados');
      setProposal(null);
      loadConfig();
    } else {
      toast.error(res?.message || 'Error al publicar');
    }
  } catch (e) {
    toast.error('Error: ' + e.message);
  }
};
```

- [ ] **Step 3: JSX de la sección "Escanear y revisar"**

Agregar dentro del `return`, después de la sección "General":

```jsx
      <div className="config-section">
        <div className="section-header">
          <h2>Escanear y revisar</h2>
          <button className="vg-btn-save" onClick={runScan} disabled={scanning}>
            {scanning ? 'Leyendo catálogo…' : 'Escanear productos'}
          </button>
        </div>

        {!proposal && (
          <p className="vg-hint">Corré un escaneo para ver la propuesta de agrupado por SKU.</p>
        )}

        {proposal && (
          <div className="vg-review">
            {proposal.newGroups.map(g => (
              <div key={g.groupKey} className="vg-group-card">
                <div className="vg-group-card-head">
                  <input
                    type="text"
                    value={groupTitleEdits[g.groupKey] ?? g.title}
                    onChange={e => setGroupTitleEdits(prev => ({ ...prev, [g.groupKey]: e.target.value }))}
                  />
                  <span className="vg-tag vg-tag--new">Grupo nuevo · {g.groupKey}</span>
                </div>
                <div className="vg-prod-chips">
                  {g.products.map(p => {
                    const included = (includedNewGroupProducts[g.groupKey] || new Set()).has(String(p.productId));
                    return (
                      <label key={p.productId} className={`vg-chip ${included ? '' : 'vg-chip--off'}`}>
                        <input type="checkbox" checked={included}
                          onChange={() => toggleInSet(setIncludedNewGroupProducts, g.groupKey, p.productId)} />
                        {p.image && <img src={p.image} alt="" />}
                        <span>{p.name} · {p.sku}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {proposal.groupsWithAdditions.map(g => (
              <div key={g.groupKey} className="vg-group-card">
                <div className="vg-group-card-head">
                  <strong>{g.title}</strong>
                  <span className="vg-tag vg-tag--addition">Productos nuevos para este grupo · {g.groupKey}</span>
                </div>
                <div className="vg-prod-chips">
                  {g.existingProducts.map(p => (
                    <span key={p.productId} className="vg-chip vg-chip--static">
                      {p.image && <img src={p.image} alt="" />}
                      <span>{p.name} · {p.sku}</span>
                    </span>
                  ))}
                  {g.newProducts.map(p => {
                    const included = (includedAdditions[g.groupKey] || new Set()).has(String(p.productId));
                    return (
                      <label key={p.productId} className={`vg-chip vg-chip--highlight ${included ? '' : 'vg-chip--off'}`}>
                        <input type="checkbox" checked={included}
                          onChange={() => toggleInSet(setIncludedAdditions, g.groupKey, p.productId)} />
                        {p.image && <img src={p.image} alt="" />}
                        <span>{p.name} · {p.sku}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {proposal.removedFromCatalog.length > 0 && (
              <div className="vg-group-card vg-group-card--warn">
                <div className="vg-group-card-head"><strong>Ya no están en el catálogo</strong></div>
                {proposal.removedFromCatalog.map(g => (
                  <div key={g.groupKey} className="vg-prod-chips">
                    {g.products.map(p => {
                      const checked = (includedRemovals[g.groupKey] || new Set()).has(String(p.productId));
                      return (
                        <label key={p.productId} className="vg-chip vg-chip--danger">
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleInSet(setIncludedRemovals, g.groupKey, p.productId)} />
                          <span>{p.name} · {p.sku} — quitar del grupo "{g.title}"</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {proposal.ungrouped.length > 0 && (
              <div className="vg-group-card">
                <div className="vg-group-card-head"><strong>Sin agrupar</strong></div>
                <div className="vg-ungrouped-list">
                  {proposal.ungrouped.map(p => (
                    <div key={p.productId} className="vg-ungrouped-row">
                      {p.image && <img src={p.image} alt="" />}
                      <span className="vg-ungrouped-name">{p.name} · {p.sku || 'sin SKU'}</span>
                      <select
                        value={ungroupedAssignment[p.productId] || ''}
                        onChange={e => setUngroupedAssignment(prev => ({ ...prev, [p.productId]: e.target.value }))}
                      >
                        <option value="">Asignar a un grupo…</option>
                        {allGroupKeysForAssignment().map(key => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="vg-btn-save" onClick={publishProposal}>Publicar</button>
          </div>
        )}
      </div>
```

- [ ] **Step 4: CSS de la sección**

Agregar a `src/pages/VariantGroupsConfig.css`:

```css
.vg-review { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }

.vg-group-card {
  border: 1px solid var(--gl-border);
  border-radius: var(--gl-radius-md);
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
}
.vg-group-card--warn { border-color: rgba(239, 68, 68, 0.35); }

.vg-group-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.vg-group-card-head input[type="text"] { flex: 1; min-width: 160px; padding: 8px 10px; border-radius: var(--gl-radius-sm); font-size: 14px; font-weight: 600; }
.vg-group-card-head strong { color: var(--gl-text-primary); font-size: 14px; }

.vg-tag { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.3px; }
.vg-tag--new { background: rgba(124, 124, 255, 0.18); color: #a5a5ff; }
.vg-tag--addition { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

.vg-prod-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.vg-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: var(--gl-radius-sm);
  border: 1px solid var(--gl-border); background: rgba(255, 255, 255, 0.03);
  font-size: 13px; color: var(--gl-text-secondary); cursor: pointer;
}
.vg-chip img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
.vg-chip--static { cursor: default; opacity: 0.85; }
.vg-chip--highlight { border-color: rgba(74, 222, 128, 0.35); }
.vg-chip--danger { border-color: rgba(239, 68, 68, 0.35); }
.vg-chip--off { opacity: 0.45; text-decoration: line-through; }

.vg-ungrouped-list { display: flex; flex-direction: column; gap: 8px; }
.vg-ungrouped-row { display: flex; align-items: center; gap: 10px; }
.vg-ungrouped-row img { width: 28px; height: 28px; border-radius: 6px; object-fit: cover; }
.vg-ungrouped-name { flex: 1; font-size: 13px; color: var(--gl-text-secondary); }
.vg-ungrouped-row select { padding: 6px 10px; border-radius: var(--gl-radius-sm); font-size: 13px; }
```

- [ ] **Step 5: Verificar en dev server**

`npm run dev` con `promonube_store_id = '6854698'` (tienda demo, con productos SKU tipo Alto Rancho cargados por el usuario) → `/#/grupos-variantes`:
- "Escanear productos" → aparecen grupos nuevos con título editable y chips de producto.
- Destildar un producto de un grupo nuevo → "Publicar" → ese producto no queda en el grupo (verificar releyendo `GET /api/variant-groups-config` o recargando la página).
- Asignar un producto de "Sin agrupar" a un grupo existente → "Publicar" → aparece en ese grupo.
- Volver a "Escanear productos" después de publicar → los productos ya incluidos no aparecen como novedad; un producto que se destildó antes tampoco reaparece.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/pages/VariantGroupsConfig.jsx src/pages/VariantGroupsConfig.css
git commit -m "feat: seccion Escanear y revisar de Grupos de Variantes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

### Task 11: Frontend — Grupos publicados (lista, ocultar, editar)

**Files:**
- Modify: `src/pages/VariantGroupsConfig.jsx`
- Modify: `src/pages/VariantGroupsConfig.css`

**Interfaces:**
- Consumes: `config.groups` (cargado en Task 9 vía `GET /api/variant-groups-config`); `POST /api/variant-groups/publish` (Task 5, reutilizado para persistir ediciones puntuales).
- Produces: sección visible al final de la página; no expone nada nuevo a otras tasks.

- [ ] **Step 1: Estado y acciones de edición puntual**

Agregar dentro del componente:

```jsx
const [groupFilter, setGroupFilter] = useState('');
const [editingGroupKey, setEditingGroupKey] = useState(null);
const [editingTitle, setEditingTitle] = useState('');

const filteredGroups = config.groups.filter(g => {
  const q = groupFilter.trim().toLowerCase();
  if (!q) return true;
  return g.title.toLowerCase().includes(q) || g.groupKey.toLowerCase().includes(q) ||
    g.products.some(p => p.sku.toLowerCase().includes(q));
});

const persistGroups = async (nextGroups, nextUngrouped) => {
  try {
    const res = await apiRequest('/api/variant-groups/publish', {
      method: 'POST',
      body: JSON.stringify({ storeId, groups: nextGroups, ungrouped: nextUngrouped ?? config.ungrouped }),
    });
    if (res?.success) {
      setConfig(c => ({ ...c, groups: nextGroups, ungrouped: nextUngrouped ?? c.ungrouped }));
      toast.success('Grupo actualizado');
    } else {
      toast.error(res?.message || 'Error al guardar');
    }
  } catch (e) {
    toast.error('Error: ' + e.message);
  }
};

const toggleHidden = (groupKey) => {
  const next = config.groups.map(g => g.groupKey === groupKey ? { ...g, hidden: !g.hidden } : g);
  persistGroups(next);
};

const startEdit = (group) => { setEditingGroupKey(group.groupKey); setEditingTitle(group.title); };
const cancelEdit = () => { setEditingGroupKey(null); setEditingTitle(''); };

const saveTitle = (groupKey) => {
  const next = config.groups.map(g => g.groupKey === groupKey ? { ...g, title: editingTitle } : g);
  persistGroups(next);
  cancelEdit();
};

// Si sacar el producto deja el grupo con menos de 2 (ya no hay nada para
// swatchear), el grupo se borra y el/los producto/s que quedaban sueltos
// pasan a "sin agrupar" en vez de perderse silenciosamente.
const removeProductFromGroup = (groupKey, productId) => {
  const orphans = [];
  const next = config.groups
    .map(g => {
      if (g.groupKey !== groupKey) return g;
      const remaining = g.products.filter(p => String(p.productId) !== String(productId));
      if (remaining.length < 2) orphans.push(...remaining);
      return {
        ...g,
        products: remaining,
        excludedProductIds: [...(g.excludedProductIds || []), String(productId)],
      };
    })
    .filter(g => g.products.length >= 2);
  const nextUngrouped = [
    ...config.ungrouped,
    ...orphans.map(p => ({ ...p, reason: 'single_product' })),
  ];
  persistGroups(next, nextUngrouped);
};
```

- [ ] **Step 2: JSX de la sección "Grupos publicados"**

Agregar al final del `return`, después de la sección "Escanear y revisar":

```jsx
      <div className="config-section">
        <div className="section-header"><h2>Grupos publicados</h2></div>

        <input
          type="text"
          className="vg-search"
          placeholder="Buscar por título o SKU…"
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
        />

        {filteredGroups.length === 0 && (
          <p className="vg-hint">Todavía no hay grupos publicados.</p>
        )}

        <div className="vg-published-list">
          {filteredGroups.map(g => (
            <div key={g.groupKey} className={`vg-published-card ${g.hidden ? 'vg-published-card--hidden' : ''}`}>
              <div className="vg-published-head">
                {editingGroupKey === g.groupKey ? (
                  <>
                    <input type="text" value={editingTitle} onChange={e => setEditingTitle(e.target.value)} />
                    <button className="vg-btn-launch" onClick={() => saveTitle(g.groupKey)}>Guardar</button>
                    <button className="vg-btn-remove" onClick={cancelEdit}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <strong>{g.title}</strong>
                    <span className="vg-hint">{g.groupKey} · {g.products.length} productos</span>
                    <button className="btn-back" onClick={() => startEdit(g)}>Editar</button>
                    <button className="btn-back" onClick={() => toggleHidden(g.groupKey)}>
                      {g.hidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                  </>
                )}
              </div>
              <div className="vg-prod-chips">
                {g.products.map(p => (
                  <span key={p.productId} className="vg-chip">
                    {p.image && <img src={p.image} alt="" />}
                    <span>{p.name} · {p.sku}</span>
                    {editingGroupKey === g.groupKey && (
                      <button className="vg-chip-remove" onClick={() => removeProductFromGroup(g.groupKey, p.productId)}>×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: CSS de la sección**

Agregar a `src/pages/VariantGroupsConfig.css`:

```css
.vg-search {
  width: 100%; padding: 10px 12px; border-radius: var(--gl-radius-sm); font-size: 14px; margin-bottom: 14px;
}

.vg-published-list { display: flex; flex-direction: column; gap: 12px; }
.vg-published-card {
  border: 1px solid var(--gl-border); border-radius: var(--gl-radius-md); padding: 14px;
  background: rgba(255, 255, 255, 0.03);
}
.vg-published-card--hidden { opacity: 0.55; }

.vg-published-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.vg-published-head strong { color: var(--gl-text-primary); font-size: 14px; }
.vg-published-head input[type="text"] { flex: 1; min-width: 160px; padding: 8px 10px; border-radius: var(--gl-radius-sm); font-size: 14px; }

.vg-btn-launch {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 700;
  border-radius: var(--gl-radius-sm); border: 1px solid rgba(74, 222, 128, 0.35); background: rgba(74, 222, 128, 0.1);
  color: #4ade80; cursor: pointer;
}
.vg-btn-remove {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 13px; font-weight: 700;
  border-radius: var(--gl-radius-sm); border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08);
  color: #f87171; cursor: pointer;
}

.vg-chip-remove {
  border: none; background: transparent; color: #f87171; cursor: pointer; font-size: 14px; font-weight: 700; padding: 0 2px;
}
```

- [ ] **Step 4: Verificar en dev server**

`npm run dev` con `promonube_store_id = '6854698'`, con al menos un grupo ya publicado (correr Task 10 primero) → `/#/grupos-variantes`, sección "Grupos publicados":
- El grupo aparece con sus productos.
- Buscar por SKU filtra la lista.
- "Ocultar" → el card se ve atenuado; releer `GET /api/variant-groups-config` (o recargar) confirma `hidden: true`.
- "Editar" → cambiar el título, "Guardar" → el título nuevo persiste tras recargar.
- "Editar" → quitar un producto del grupo (botón ×) → el producto desaparece del grupo; volver a "Escanear productos" (Task 10) confirma que no se re-sugiere (quedó en `excludedProductIds`).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/pages/VariantGroupsConfig.jsx src/pages/VariantGroupsConfig.css
git commit -m "feat: seccion Grupos publicados (buscar, ocultar, editar) de Grupos de Variantes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017YM7nhz5JoY9DF3ioK7pCG"
```

---

## QA manual final (checklist end-to-end, en la tienda demo)

- [ ] Escanear detecta los grupos esperados por SKU (raíz sin los últimos 2 caracteres) y deja los SKU inválidos en "sin agrupar" con la razón correcta.
- [ ] Editar el título de un grupo nuevo antes de publicar se respeta.
- [ ] Sacar un producto de un grupo en la revisión y publicar → no aparece en `GET /api/variant-groups-data.json`.
- [ ] Volver a escanear no revive un producto que se sacó a mano (ni en la propuesta de "novedades" ni tras publicar de nuevo).
- [ ] Asignar manualmente un producto de "sin agrupar" a un grupo funciona y persiste.
- [ ] Ocultar un grupo publicado lo saca de `variant-groups-data.json` sin borrar sus datos (`hidden: true`, productos siguen en Firestore).
- [ ] Activar el módulo (`enabled: true`) y confirmar que `GET /api/variant-groups-widget.js?store=6854698` deja de responder "deshabilitado".
- [ ] Tienda fuera del allowlist: el ítem de menú no aparece en el sidebar y `/#/grupos-variantes` redirige a `/dashboard`.
- [ ] `npm run build` (raíz) sin errores.
- [ ] `cd functions && node --test variant-groups.test.js` → todos los tests pasan.

---

## Pendientes explícitos para producción (no bloquean el desarrollo)

- Completar `VARIANT_GROUPS_SCRIPT_ID` en `functions/variant-groups.js` una vez que el script "Grupos de Variantes" esté dado de alta en Tiendanube Partners (Aplicaciones → GlowLab #23137 → Scripts), apuntando a `https://glowlab-production.up.railway.app/api/variant-groups-widget.js?store=`.
- Instalar el script en Alto Rancho (`POST /api/variant-groups/install`) solo cuando el dueño decida reemplazar la app de terceros — no antes.
- Cuando se decida ofrecer el módulo a todas las tiendas: quitar `ALLOWED_STORE_IDS`/`isAllowedStore` en `functions/variant-groups.js`, el guard equivalente en `VariantGroupsConfig.jsx`, y mover el ítem de `STORE_EXCLUSIVE_ITEMS` a `BASE_NAV_ITEMS` en `Sidebar.jsx`.
