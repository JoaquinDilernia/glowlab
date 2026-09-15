# Carrusel de Categorías Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new "Carrusel de Categorías" module — a configurable carousel of square image tiles (image + title + link), targeted per Tiendanube category, that replaces the native fixed category banner the admin is disabling manually in Tiendanube.

**Architecture:** Follows the exact pattern of the existing `search.js` / `coming-soon.js` modules: a standalone `functions/category-carousel.js` file exporting `registerCategoryCarouselRoutes`, mounted in `functions/index.js`, serving a storefront widget script (`buildWidgetScript`) that detects the current category via `window.LS.category.id` and injects the carousel above the product grid. A companion `functions/category-anchor-selectors.js` (mirroring `theme-menu-selectors.js`) resolves per-theme DOM selectors for where to inject, falling back to a generic heuristic when a theme isn't mapped yet. Admin config lives in a new `src/pages/CategoryCarouselConfig.jsx`, following `SearchConfig.jsx`'s shape (banners-array + `useImageUpload` + live preview).

**Tech Stack:** Node.js/Express (functions/), React + Vite (src/), Firestore, `node:test` for backend unit tests (no DOM/browser tests in this repo — generated client script content is tested via string/regex assertions on the server-side builder function, same convention as `functions/search.test.js`).

**Spec:** `docs/superpowers/specs/2026-09-15-category-carousel-design.md`

## Global Constraints

- No shared helper modules between widgets in this repo — small helpers like `normalizeUrl` are duplicated per module (confirmed convention, see spec §4).
- Style (borders, typography, spacing, visible-count) is global per store, applied to all carousels — content (categories, tiles) is per-carousel. Do not add per-carousel style overrides.
- Category detection on the storefront uses `window.LS.category.id`, never URL parsing.
- Injection point uses `functions/category-anchor-selectors.js`'s per-theme map with a `null`-selector default that triggers a generic heuristic scan — do not attempt to hardcode every theme's selector now.
- The native Tiendanube category banner is NOT touched by this module (admin removes it manually per category in Tiendanube).
- Follow existing code style: CommonJS in `functions/`, `"use strict"` at the top, Spanish comments/strings matching the rest of the codebase.

---

## Task 1: Category anchor selectors (per-theme injection point map)

**Files:**
- Create: `functions/category-anchor-selectors.js`
- Test: `functions/category-anchor-selectors.test.js`

**Interfaces:**
- Consumes: nothing (pure module, no deps).
- Produces: `resolveCategoryAnchorSelectors(themeCode)` → `{ gridSelector: string|null }`, `getClientSelectorMap()` → `{ [themeCode]: {gridSelector}, __default__: {gridSelector: null} }`, `DEFAULT_ANCHOR_SELECTOR`, `CATEGORY_ANCHOR_SELECTORS`. Task 2 imports `getClientSelectorMap` to embed into the generated widget script.

- [ ] **Step 1: Write the failing test**

Create `functions/category-anchor-selectors.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_ANCHOR_SELECTOR,
  resolveCategoryAnchorSelectors,
  getClientSelectorMap,
} = require("./category-anchor-selectors");

test("resolveCategoryAnchorSelectors devuelve DEFAULT (null) para un theme sin mapear", () => {
  assert.deepEqual(resolveCategoryAnchorSelectors("rio"), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors("cualquier_cosa"), DEFAULT_ANCHOR_SELECTOR);
});

test("resolveCategoryAnchorSelectors devuelve DEFAULT para theme undefined/null/vacío", () => {
  assert.deepEqual(resolveCategoryAnchorSelectors(undefined), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors(null), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors(""), DEFAULT_ANCHOR_SELECTOR);
});

test("getClientSelectorMap incluye __default__ para que el script del storefront tenga fallback", () => {
  const map = getClientSelectorMap();
  assert.deepEqual(map.__default__, DEFAULT_ANCHOR_SELECTOR);
});

test("DEFAULT_ANCHOR_SELECTOR.gridSelector es null (heurística genérica en el storefront)", () => {
  assert.equal(DEFAULT_ANCHOR_SELECTOR.gridSelector, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `functions/`): `node --test category-anchor-selectors.test.js`
Expected: FAIL — `Cannot find module './category-anchor-selectors'`

- [ ] **Step 3: Write minimal implementation**

Create `functions/category-anchor-selectors.js`:

```js
"use strict";

// Selectores del contenedor de grilla de productos por theme, para insertar
// el Carrusel de Categorias justo antes. Arranca vacio (cualquier theme usa
// DEFAULT_ANCHOR_SELECTOR) -> el script del storefront usa el heuristico
// generico (ver category-carousel.js, PRODUCT_CARD_SELECTORS). Se completa
// a medida que se verifican themes reales contra tiendas de clientes, mismo
// patron que theme-menu-selectors.js.
const CATEGORY_ANCHOR_SELECTORS = {
  // theme_code: { gridSelector: '...verificado contra una tienda real...' },
};

// null = "no tengo selector determinístico para este theme todavía": el
// script del storefront usa el escaneo heurístico genérico.
const DEFAULT_ANCHOR_SELECTOR = {
  gridSelector: null,
};

function resolveCategoryAnchorSelectors(themeCode) {
  if (themeCode && Object.prototype.hasOwnProperty.call(CATEGORY_ANCHOR_SELECTORS, themeCode)) {
    return CATEGORY_ANCHOR_SELECTORS[themeCode];
  }
  return DEFAULT_ANCHOR_SELECTOR;
}

function getClientSelectorMap() {
  return Object.assign({}, CATEGORY_ANCHOR_SELECTORS, { __default__: DEFAULT_ANCHOR_SELECTOR });
}

module.exports = {
  CATEGORY_ANCHOR_SELECTORS,
  DEFAULT_ANCHOR_SELECTOR,
  resolveCategoryAnchorSelectors,
  getClientSelectorMap,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test category-anchor-selectors.test.js`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/category-anchor-selectors.js functions/category-anchor-selectors.test.js
git commit -m "feat: selectores de anclaje por theme para Carrusel de Categorías"
```

---

## Task 2: Core module logic (config merge, URL normalization, widget builder)

**Files:**
- Create: `functions/category-carousel.js`
- Test: `functions/category-carousel.test.js`

**Interfaces:**
- Consumes: `getClientSelectorMap` from Task 1 (`./category-anchor-selectors`).
- Produces: `registerCategoryCarouselRoutes(app, { db, FieldValue, checkStoreActive })`, `setCategoryCarouselScriptId(id)`, `buildWidgetScript(store, widgetConfig)`, `buildWidgetConfig(mergedConfig)`, `mergeConfig(storedDocDataOrNull)`, `normalizeUrl(url)`, `DEFAULT_CONFIG`. Task 3 (functions/index.js) consumes `registerCategoryCarouselRoutes` and `setCategoryCarouselScriptId`.

- [ ] **Step 1: Write the failing test**

Create `functions/category-carousel.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mergeConfig,
  normalizeUrl,
  buildWidgetConfig,
  buildWidgetScript,
  matchCarouselForCategory,
  DEFAULT_CONFIG,
} = require("./category-carousel");

test("mergeConfig completa los defaults cuando no hay doc en Firestore", () => {
  assert.deepEqual(mergeConfig(null), DEFAULT_CONFIG);
});

test("mergeConfig completa los campos de style que falten sin pisar los que sí vinieron", () => {
  const merged = mergeConfig({ enabled: true, style: { gap: 24 } });
  assert.equal(merged.enabled, true);
  assert.equal(merged.style.gap, 24);
  assert.equal(merged.style.borderRadius, DEFAULT_CONFIG.style.borderRadius);
  assert.equal(merged.style.desktopVisible, DEFAULT_CONFIG.style.desktopVisible);
});

test("mergeConfig usa [] si carousels no vino o no es array", () => {
  assert.deepEqual(mergeConfig({}).carousels, []);
  assert.deepEqual(mergeConfig({ carousels: "nope" }).carousels, []);
});

test("normalizeUrl agrega la barra inicial si falta", () => {
  assert.equal(normalizeUrl("productos/silla"), "/productos/silla");
});

test("normalizeUrl deja intactas las URLs absolutas, con barra inicial o con #", () => {
  assert.equal(normalizeUrl("https://ejemplo.com/x"), "https://ejemplo.com/x");
  assert.equal(normalizeUrl("/productos/silla"), "/productos/silla");
  assert.equal(normalizeUrl("#"), "#");
});

test("normalizeUrl devuelve # para valores vacíos o inválidos", () => {
  assert.equal(normalizeUrl(""), "#");
  assert.equal(normalizeUrl("   "), "#");
  assert.equal(normalizeUrl(null), "#");
  assert.equal(normalizeUrl(undefined), "#");
});

test("buildWidgetConfig descarta carruseles sin categorías o sin ninguna tile con imagen", () => {
  const cfg = mergeConfig({
    enabled: true,
    carousels: [
      { categoryIds: [], tiles: [{ imageUrl: "a.jpg" }] },
      { categoryIds: ["1"], tiles: [{ imageUrl: "" }] },
      { categoryIds: ["2"], tiles: [{ imageUrl: "b.jpg", title: "Sillas", url: "sillas" }] },
    ],
  });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(widgetConfig.carousels.length, 1);
  assert.deepEqual(widgetConfig.carousels[0].categoryIds, ["2"]);
  assert.equal(widgetConfig.carousels[0].tiles[0].url, "/sillas");
});

test("buildWidgetConfig clampea desktopVisible y mobileVisible a rangos razonables", () => {
  const cfg = mergeConfig({ style: { desktopVisible: 99, mobileVisible: 0 } });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(widgetConfig.style.desktopVisible, 8);
  assert.equal(widgetConfig.style.mobileVisible, 1);
});

test("buildWidgetScript incluye el ancho de tarjeta calculado a partir de desktopVisible/gap/borderRadius", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({
    enabled: true,
    style: { desktopVisible: 3, gap: 20, borderRadius: 8 },
    carousels: [{ categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A" }] }],
  }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(script, /calc\(\(100% - 2 \* 20px\) \/ 3\)/);
  assert.match(script, /border-radius: 8px/);
});

test("buildWidgetScript detecta la categoría vía window.LS.category.id, no la URL", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({ enabled: true, carousels: [] }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(script, /window\.LS && window\.LS\.category && window\.LS\.category\.id/);
});

test("matchCarouselForCategory devuelve el carrusel cuyo categoryIds incluye la categoría actual", () => {
  const carousels = [
    { categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A", url: "#" }] },
    { categoryIds: ["2", "3"], tiles: [{ imageUrl: "b.jpg", title: "B", url: "#" }] },
  ];
  assert.equal(matchCarouselForCategory(carousels, "3"), carousels[1]);
  assert.equal(matchCarouselForCategory(carousels, 3), carousels[1]); // compara como string
});

test("matchCarouselForCategory devuelve null si ningún carrusel targetea esa categoría", () => {
  const carousels = [{ categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A", url: "#" }] }];
  assert.equal(matchCarouselForCategory(carousels, "999"), null);
  assert.equal(matchCarouselForCategory([], "1"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `functions/`): `node --test category-carousel.test.js`
Expected: FAIL — `Cannot find module './category-carousel'`

- [ ] **Step 3: Write minimal implementation**

Create `functions/category-carousel.js`:

```js
"use strict";

// Carrusel de Categorías - reemplaza el banner fijo nativo de Tiendanube
// (que el admin desactiva a mano, categoría por categoría) por un carrusel
// de tarjetas cuadradas configurable, targeteado por categoría real de
// Tiendanube. Módulo nuevo y aislado, sigue el mismo patrón de search.js.
// Ver docs/superpowers/specs/2026-09-15-category-carousel-design.md

const { getClientSelectorMap } = require("./category-anchor-selectors");

const COLLECTION = "promonube_category_carousel_config";

const DEFAULT_CONFIG = {
  enabled: false,
  style: {
    borderRadius: 12,
    gap: 16,
    titleFontFamily: "system-ui",
    titleFontSize: "medium",
    titleColor: "#111111",
    desktopVisible: 4,
    mobileVisible: 2,
  },
  carousels: [],
};

function mergeConfig(stored) {
  const s = stored || {};
  return {
    ...DEFAULT_CONFIG,
    ...s,
    style: { ...DEFAULT_CONFIG.style, ...(s.style || {}) },
    carousels: Array.isArray(s.carousels) ? s.carousels : [],
  };
}

// Si el admin cargo la URL sin la barra inicial (ej. "productos/silla" en
// vez de "/productos/silla"), el link navega relativo a la pagina actual en
// vez de a la raiz del sitio - se normaliza al servir el widget. Mismo
// helper que functions/search.js:30, duplicado a proposito: no hay modulo
// de utils compartido entre widgets en este repo.
function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  return "/" + trimmed;
}

// Reduce la config guardada (con ids/nombres internos de admin) a lo mínimo
// que necesita el script del storefront, descartando carruseles sin
// categorías target o sin ninguna tile con imagen cargada.
function buildWidgetConfig(cfg) {
  const style = {
    borderRadius: Number(cfg.style.borderRadius) || DEFAULT_CONFIG.style.borderRadius,
    gap: Number(cfg.style.gap) || DEFAULT_CONFIG.style.gap,
    titleFontFamily: cfg.style.titleFontFamily || DEFAULT_CONFIG.style.titleFontFamily,
    titleFontSize: cfg.style.titleFontSize || DEFAULT_CONFIG.style.titleFontSize,
    titleColor: cfg.style.titleColor || DEFAULT_CONFIG.style.titleColor,
    desktopVisible: Math.min(8, Math.max(2, Number(cfg.style.desktopVisible) || DEFAULT_CONFIG.style.desktopVisible)),
    mobileVisible: Math.min(4, Math.max(1, Number(cfg.style.mobileVisible) || DEFAULT_CONFIG.style.mobileVisible)),
  };

  const carousels = (Array.isArray(cfg.carousels) ? cfg.carousels : [])
    .filter((c) => c && Array.isArray(c.categoryIds) && c.categoryIds.length
      && Array.isArray(c.tiles) && c.tiles.some((t) => t && t.imageUrl))
    .map((c) => ({
      categoryIds: c.categoryIds.map(String),
      tiles: c.tiles
        .filter((t) => t && t.imageUrl)
        .map((t) => ({ imageUrl: t.imageUrl, title: t.title || "", url: normalizeUrl(t.url) })),
    }));

  return { enabled: !!cfg.enabled, style, carousels };
}

// Misma lógica que la función homónima embebida en buildWidgetScript (ver
// más abajo) — duplicada a propósito (no hay módulo compartido entre
// servidor y el script del storefront en este repo) para poder testear el
// matching sin necesitar un DOM/browser real.
function matchCarouselForCategory(carousels, categoryId) {
  for (let i = 0; i < carousels.length; i++) {
    const c = carousels[i];
    if (c.categoryIds.some((id) => String(id) === String(categoryId))) return c;
  }
  return null;
}

function registerCategoryCarouselRoutes(app, { db, FieldValue, checkStoreActive }) {
  app.get("/api/category-carousel-config", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
      res.json({ success: true, config: mergeConfig(doc.exists ? doc.data() : null) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/category-carousel-config", async (req, res) => {
    const { storeId, config } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!config || typeof config !== "object") return res.status(400).json({ success: false, message: "config requerido" });
    try {
      await db.collection(COLLECTION).doc(String(storeId)).set({
        ...config,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/category-carousel-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store) return res.send("// PromoNube Carrusel de Categorias: falta storeId");

    try {
      if (!(await checkStoreActive(store))) {
        return res.send("// PromoNube Carrusel de Categorias: plan inactivo");
      }
      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      const cfg = mergeConfig(doc.exists ? doc.data() : null);
      if (!cfg.enabled) return res.send("// PromoNube Carrusel de Categorias: deshabilitado");

      const widgetConfig = buildWidgetConfig(cfg);
      if (!widgetConfig.carousels.length) {
        return res.send("// PromoNube Carrusel de Categorias: sin carruseles configurados");
      }

      res.send(buildWidgetScript(store, widgetConfig));
    } catch (error) {
      res.send("// PromoNube Carrusel de Categorias: error " + error.message);
    }
  });

  // POST /api/category-carousel/install - activa el script para una tienda puntual
  app.post("/api/category-carousel/install", async (req, res) => {
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!(await checkStoreActive(storeId))) return res.status(403).json({ success: false, message: "Plan inactivo" });

    try {
      const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
      if (!storeDoc.exists) return res.status(404).json({ success: false, message: "Store no encontrada" });
      const accessToken = storeDoc.data().accessToken;

      const installRes = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/scripts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": "GlowLab (info@techdi.com.ar)",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script_id: CATEGORY_CAROUSEL_SCRIPT_ID }),
      });

      if (!installRes.ok) {
        const t = await installRes.text();
        return res.status(500).json({ success: false, message: "Error TN: " + t });
      }
      const installed = await installRes.json();
      res.json({ success: true, message: "Script activado para la tienda", result: installed });
    } catch (error) {
      console.error("[Category carousel install]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

// Id numérico del script "Carrusel de Categorías" registrado en TiendaNube
// Partners (Aplicaciones → GlowLab #23137 → Scripts). Se completa después
// de crearlo ahí (mismo flujo que SEARCH_SCRIPT_ID en functions/index.js).
let CATEGORY_CAROUSEL_SCRIPT_ID = null;
function setCategoryCarouselScriptId(id) { CATEGORY_CAROUSEL_SCRIPT_ID = id; }

const FONT_SIZES_CSS = { small: "13px", medium: "15px", large: "17px" };

function buildWidgetScript(store, cfg) {
  const selectorMap = getClientSelectorMap();
  return `
/**
 * PromoNube - Carrusel de Categorias
 * Tienda: ${store}
 */
(function() {
  'use strict';
  if (window.__pnCategoryCarouselLoaded) return;
  window.__pnCategoryCarouselLoaded = true;

  var CFG = ${JSON.stringify(cfg)};
  var ANCHOR_SELECTORS = ${JSON.stringify(selectorMap)};
  var FONT_SIZES = ${JSON.stringify(FONT_SIZES_CSS)};
  var PRODUCT_CARD_SELECTORS = ['.js-item-product', '[data-product-id]', '.product-item', '.js-product-item'];

  function detectThemeCode() {
    try {
      return (window.LS && window.LS.theme && window.LS.theme.code) || null;
    } catch (e) {
      return null;
    }
  }

  function getAnchorSelector(themeCode) {
    if (themeCode && Object.prototype.hasOwnProperty.call(ANCHOR_SELECTORS, themeCode)) {
      return ANCHOR_SELECTORS[themeCode];
    }
    return ANCHOR_SELECTORS.__default__;
  }

  function findGridContainer() {
    for (var i = 0; i < PRODUCT_CARD_SELECTORS.length; i++) {
      var card = document.querySelector(PRODUCT_CARD_SELECTORS[i]);
      if (card && card.parentElement) return card.parentElement;
    }
    return null;
  }

  function findAnchorTarget() {
    var sel = getAnchorSelector(detectThemeCode());
    if (sel && sel.gridSelector) {
      var el = document.querySelector(sel.gridSelector);
      if (el) return el;
    }
    return findGridContainer();
  }

  function injectStyles() {
    if (document.getElementById('pn-cc-styles')) return;
    var st = CFG.style;
    var s = document.createElement('style');
    s.id = 'pn-cc-styles';
    s.textContent = [
      '.pn-cc { margin: 0 0 28px; font-family: ' + st.titleFontFamily + ', system-ui, sans-serif; }',
      '.pn-cc-row { position: relative; }',
      '.pn-cc-track { display: flex; gap: ' + st.gap + 'px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; }',
      '.pn-cc-track::-webkit-scrollbar { display: none; }',
      '.pn-cc-tile { flex: 0 0 calc((100% - ' + (st.desktopVisible - 1) + ' * ' + st.gap + 'px) / ' + st.desktopVisible + '); scroll-snap-align: start; text-decoration: none; color: inherit; }',
      '.pn-cc-tile img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: ' + st.borderRadius + 'px; display: block; background: #f0f0f0; }',
      '.pn-cc-tile-title { margin-top: 10px; text-align: center; font-size: ' + FONT_SIZES[st.titleFontSize] + '; font-weight: 600; color: ' + st.titleColor + '; }',
      '.pn-cc-arrow { position: absolute; top: 38%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; border: 1px solid #eee; background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.14); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; color: #333; z-index: 2; }',
      '.pn-cc-arrow-prev { left: -14px; }',
      '.pn-cc-arrow-next { right: -14px; }',
      '@media (max-width: 640px) { .pn-cc-tile { flex-basis: calc((100% - ' + (st.mobileVisible - 1) + ' * ' + st.gap + 'px) / ' + st.mobileVisible + '); } .pn-cc-arrow { display: none; } }',
    ].join('\\n');
    document.head.appendChild(s);
  }

  function scrollByPage(track, dir) {
    var tile = track.querySelector('.pn-cc-tile');
    if (!tile) return;
    var tileWidth = tile.getBoundingClientRect().width + CFG.style.gap;
    track.scrollBy({ left: dir * tileWidth * CFG.style.desktopVisible, behavior: 'smooth' });
  }

  function buildCarousel(carousel) {
    var wrap = document.createElement('div');
    wrap.className = 'pn-cc';
    var row = document.createElement('div');
    row.className = 'pn-cc-row';
    var track = document.createElement('div');
    track.className = 'pn-cc-track';
    carousel.tiles.forEach(function(t) {
      var a = document.createElement('a');
      a.className = 'pn-cc-tile';
      a.href = t.url;
      a.innerHTML = '<img src="' + t.imageUrl + '" alt="" onerror="this.style.visibility=\\'hidden\\'" />' +
        '<div class="pn-cc-tile-title">' + t.title + '</div>';
      track.appendChild(a);
    });
    row.appendChild(track);

    if (carousel.tiles.length > CFG.style.desktopVisible) {
      var prev = document.createElement('button');
      prev.className = 'pn-cc-arrow pn-cc-arrow-prev';
      prev.setAttribute('aria-label', 'Anterior');
      prev.innerHTML = '&#8249;';
      var next = document.createElement('button');
      next.className = 'pn-cc-arrow pn-cc-arrow-next';
      next.setAttribute('aria-label', 'Siguiente');
      next.innerHTML = '&#8250;';
      prev.addEventListener('click', function() { scrollByPage(track, -1); });
      next.addEventListener('click', function() { scrollByPage(track, 1); });
      row.appendChild(prev);
      row.appendChild(next);
    }

    wrap.appendChild(row);
    return wrap;
  }

  function findCarouselForCategory(categoryId) {
    for (var i = 0; i < CFG.carousels.length; i++) {
      var c = CFG.carousels[i];
      for (var j = 0; j < c.categoryIds.length; j++) {
        if (c.categoryIds[j] === String(categoryId)) return c;
      }
    }
    return null;
  }

  function init() {
    if (!(window.LS && window.LS.category && window.LS.category.id)) return;
    var carousel = findCarouselForCategory(window.LS.category.id);
    if (!carousel) return;

    var target = findAnchorTarget();
    if (!target || !target.parentElement) return;

    injectStyles();
    target.parentElement.insertBefore(buildCarousel(carousel), target);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
}

module.exports = {
  registerCategoryCarouselRoutes,
  setCategoryCarouselScriptId,
  buildWidgetScript,
  buildWidgetConfig,
  matchCarouselForCategory,
  mergeConfig,
  normalizeUrl,
  DEFAULT_CONFIG,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test category-carousel.test.js`
Expected: PASS, 11/11 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/category-carousel.js functions/category-carousel.test.js
git commit -m "feat: módulo Carrusel de Categorías (config, widget builder, rutas)"
```

---

## Task 3: Mount the module in `functions/index.js`

**Files:**
- Modify: `functions/index.js:161` (script id constant, right after `SEARCH_SCRIPT_ID`)
- Modify: `functions/index.js:775-778` (module mounting, right after the Grupos de Variantes block)

**Interfaces:**
- Consumes: `registerCategoryCarouselRoutes`, `setCategoryCarouselScriptId` from Task 2 (`./category-carousel`).
- Produces: the routes become live on the shared Express `app` — Task 6 (frontend) calls them via `apiRequest`.

- [ ] **Step 1: Add the script id constant**

In `functions/index.js`, right after line 161 (`const SEARCH_SCRIPT_ID = 9847;`), add:

```js

// Id numérico del script "Carrusel de Categorías" en TiendaNube Partners
// (GlowLab #23137 → Scripts). null hasta crearlo ahí — el endpoint de
// instalación falla con un error claro de Tiendanube mientras tanto.
const CATEGORY_CAROUSEL_SCRIPT_ID = null;
```

- [ ] **Step 2: Mount the module**

In `functions/index.js`, right after the Grupos de Variantes block (currently ending around line 777 with `registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive });`), add:

```js

// Carrusel de Categorías - reemplaza el banner fijo nativo de Tiendanube por
// un carrusel de tarjetas configurable, targeteado por categoría
const { registerCategoryCarouselRoutes, setCategoryCarouselScriptId } = require('./category-carousel');
registerCategoryCarouselRoutes(app, { db, FieldValue, checkStoreActive });
setCategoryCarouselScriptId(CATEGORY_CAROUSEL_SCRIPT_ID);
```

- [ ] **Step 3: Verify syntax**

Run (from `functions/`): `node --check index.js`
Expected: no output (exit code 0).

- [ ] **Step 4: Run the full backend test suite to check for regressions**

Run (from `functions/`): `node --test *.test.js`
Expected: PASS, all tests (existing 86 + the 4 new ones from Task 1 + the 11 new ones from Task 2 = 101).

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: montar el módulo Carrusel de Categorías en la app"
```

---

## Task 4: Admin config page — `CategoryCarouselConfig.jsx`

**Files:**
- Create: `src/pages/CategoryCarouselConfig.jsx`
- Create: `src/pages/CategoryCarouselConfig.css`

**Interfaces:**
- Consumes: `apiRequest` (`../config`), `useToast` (`../context/ToastContext`), `useImageUpload` (`../hooks/useImageUpload`), `buildCategoryTree`/`flattenTreeForSelect` (`../utils/categoryTree`) — all existing. Backend routes from Task 2/3: `GET/POST /api/category-carousel-config`, `GET /api/tiendanube/categories`.
- Produces: default-exported `CategoryCarouselConfig` component. Task 5 imports it into `src/App.jsx`.

- [ ] **Step 1: Create the CSS file**

Create `src/pages/CategoryCarouselConfig.css`:

```css
.ccc-page {
  padding: 24px 40px 60px;
}

.ccc-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto 20px;
}

.ccc-btn-save {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--gl-accent-gradient);
  color: #fff;
  box-shadow: 0 4px 15px rgba(0, 217, 255, 0.3);
}
.ccc-btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0, 217, 255, 0.45); }
.ccc-btn-save:disabled { opacity: 0.6; cursor: wait; }

.ccc-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto 28px;
}

.ccc-hero-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gl-accent-gradient);
  color: #fff;
  box-shadow: 0 4px 20px rgba(0, 217, 255, 0.35);
}

.ccc-hero h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 700;
  background: var(--gl-accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.ccc-hero p {
  margin: 0;
  font-size: 14px;
  color: var(--gl-text-secondary);
}

.ccc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
  align-items: start;
}

.ccc-form-section { display: flex; flex-direction: column; gap: 4px; }

.ccc-block-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--gl-text-muted);
  margin: 22px 0 12px;
}

.ccc-block-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 22px;
}

.ccc-btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--gl-border-input);
  background: rgba(255, 255, 255, 0.04);
  color: var(--gl-text-accent);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.ccc-btn-add:hover { background: rgba(0, 217, 255, 0.1); border-color: rgba(0, 217, 255, 0.4); }

.ccc-btn-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  cursor: pointer;
}
.ccc-btn-remove:hover { background: rgba(239, 68, 68, 0.18); }

.ccc-carousel-card {
  border: 1px solid var(--gl-border);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.ccc-carousel-head {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.ccc-carousel-head input[type="text"] { flex: 1; }

.ccc-cat-picker {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--gl-border-input);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 12px;
}

.ccc-cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--gl-text-secondary);
  cursor: pointer;
}

.ccc-tile-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--gl-border);
  border-radius: 12px;
  padding: 8px;
  margin-bottom: 8px;
}

.ccc-tile-thumb {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1.5px dashed var(--gl-border-input);
  background: rgba(255, 255, 255, 0.03);
  color: var(--gl-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
}
.ccc-tile-thumb img { width: 100%; height: 100%; object-fit: cover; }

.ccc-tile-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.ccc-tile-fields input { width: 100%; }

.ccc-hint { font-size: 12px; color: var(--gl-text-muted); margin: 4px 0 0; }

/* Preview */
.ccc-preview-col { position: sticky; top: 24px; }
.ccc-preview-sticky { display: flex; flex-direction: column; gap: 16px; }

.ccc-preview-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gl-text-muted);
}

.ccc-preview-panel {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.35);
  padding: 20px;
}

.ccc-preview-track {
  display: flex;
  overflow-x: auto;
}

.ccc-preview-tile { flex-shrink: 0; text-decoration: none; }
.ccc-preview-tile img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: #f0f0f0; }
.ccc-preview-tile-title { margin-top: 8px; text-align: center; font-weight: 600; }

.ccc-preview-empty { color: #999; font-size: 13px; text-align: center; padding: 30px 0; }

.ccc-loading {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--gl-text-muted);
}

.ccc-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(124, 124, 255, 0.15);
  border-top: 3px solid #7C7CFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 900px) {
  .ccc-layout { grid-template-columns: 1fr; }
  .ccc-preview-col { position: static; }
}
```

- [ ] **Step 2: Create the component**

Create `src/pages/CategoryCarouselConfig.jsx`:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, LayoutGrid, Eye, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { useImageUpload } from '../hooks/useImageUpload';
import { buildCategoryTree, flattenTreeForSelect } from '../utils/categoryTree';
import './StyleConfig.css';
import './CategoryCarouselConfig.css';

const DEFAULT_STYLE = {
  borderRadius: 12,
  gap: 16,
  titleFontFamily: 'system-ui',
  titleFontSize: 'medium',
  titleColor: '#111111',
  desktopVisible: 4,
  mobileVisible: 2,
};

const DEFAULT_CONFIG = { enabled: false, style: DEFAULT_STYLE, carousels: [] };

const FONT_OPTIONS = [
  { value: 'system-ui', label: 'System (nativa)' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Georgia', serif", label: 'Georgia' },
];

function newId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function CategoryCarouselConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const { upload, uploading } = useImageUpload(storeId, 'category-carousel');
  const fileInputRef = useRef(null);
  const pendingTarget = useRef(null); // { carouselIndex, tileIndex }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [catRows, setCatRows] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/category-carousel-config?storeId=${storeId}`);
        if (res?.success && res.config) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...res.config,
            style: { ...DEFAULT_STYLE, ...(res.config.style || {}) },
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/tiendanube/categories?storeId=${storeId}`);
        const flat = Array.isArray(res) ? res : (res.categories || res.data || []);
        setCatRows(flattenTreeForSelect(buildCategoryTree(flat)));
      } catch (e) { console.error(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStyle = (key, value) => setConfig(c => ({ ...c, style: { ...c.style, [key]: value } }));

  const addCarousel = () => {
    setConfig(c => ({ ...c, carousels: [...c.carousels, { id: newId('cc'), name: '', categoryIds: [], tiles: [] }] }));
  };
  const patchCarousel = (i, patch) => {
    setConfig(c => ({ ...c, carousels: c.carousels.map((car, idx) => idx === i ? { ...car, ...patch } : car) }));
  };
  const removeCarousel = (i) => {
    setConfig(c => ({ ...c, carousels: c.carousels.filter((_, idx) => idx !== i) }));
  };

  const toggleCategory = (carouselIndex, categoryId) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, idx) => {
        if (idx !== carouselIndex) return car;
        const has = car.categoryIds.includes(categoryId);
        return { ...car, categoryIds: has ? car.categoryIds.filter(id => id !== categoryId) : [...car.categoryIds, categoryId] };
      }),
    }));
  };

  const addTile = (carouselIndex) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, idx) => idx === carouselIndex
        ? { ...car, tiles: [...car.tiles, { id: newId('t'), imageUrl: '', title: '', url: '' }] }
        : car),
    }));
  };
  const patchTile = (carouselIndex, tileIndex, patch) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, ci) => ci !== carouselIndex ? car : {
        ...car,
        tiles: car.tiles.map((t, ti) => ti === tileIndex ? { ...t, ...patch } : t),
      }),
    }));
  };
  const removeTile = (carouselIndex, tileIndex) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, ci) => ci !== carouselIndex ? car : {
        ...car,
        tiles: car.tiles.filter((_, ti) => ti !== tileIndex),
      }),
    }));
  };

  const pickTileImage = (carouselIndex, tileIndex) => {
    pendingTarget.current = { carouselIndex, tileIndex };
    fileInputRef.current?.click();
  };
  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingTarget.current) return;
    const { carouselIndex, tileIndex } = pendingTarget.current;
    const url = await upload(file);
    if (url) patchTile(carouselIndex, tileIndex, { imageUrl: url });
    pendingTarget.current = null;
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/category-carousel-config', {
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
      <div className="page-container ccc-page">
        <div className="ccc-loading">
          <div className="ccc-spinner" />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  const previewCarousel = config.carousels.find(c => c.tiles.some(t => t.imageUrl));
  const previewTiles = previewCarousel ? previewCarousel.tiles.filter(t => t.imageUrl) : [];
  const tileWidthPct = 100 / config.style.desktopVisible;

  return (
    <div className="page-container ccc-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />

      <div className="ccc-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="ccc-btn-save" onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="ccc-hero">
        <div className="ccc-hero-icon"><LayoutGrid size={22} /></div>
        <div>
          <h1>Carrusel de Categorías</h1>
          <p>Reemplazá el banner fijo de cada categoría por un carrusel de tarjetas con imagen, título y link.</p>
        </div>
      </div>

      <div className="ccc-layout">
        <div className="config-section ccc-form-section">
          <div className="section-header ccc-section-header">
            <h2>General</h2>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="ccc-block-title">Diseño (aplica a todos los carruseles)</div>
          <div className="form-row">
            <div className="form-group">
              <label>Radio de bordes (px)</label>
              <input type="number" min={0} max={40} value={config.style.borderRadius}
                onChange={e => handleStyle('borderRadius', Math.min(40, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div className="form-group">
              <label>Espacio entre tarjetas (px)</label>
              <input type="number" min={0} max={48} value={config.style.gap}
                onChange={e => handleStyle('gap', Math.min(48, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Imágenes visibles — desktop</label>
              <input type="number" min={2} max={8} value={config.style.desktopVisible}
                onChange={e => handleStyle('desktopVisible', Math.min(8, Math.max(2, Number(e.target.value) || 2)))} />
            </div>
            <div className="form-group">
              <label>Imágenes visibles — celular</label>
              <input type="number" min={1} max={4} value={config.style.mobileVisible}
                onChange={e => handleStyle('mobileVisible', Math.min(4, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipografía del título</label>
              <select value={config.style.titleFontFamily} onChange={e => handleStyle('titleFontFamily', e.target.value)}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tamaño del título</label>
              <select value={config.style.titleFontSize} onChange={e => handleStyle('titleFontSize', e.target.value)}>
                <option value="small">Chico</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Color del título</label>
            <div className="sc-color-row">
              <input type="color" value={config.style.titleColor} onChange={e => handleStyle('titleColor', e.target.value)} />
              <input type="text" value={config.style.titleColor} onChange={e => handleStyle('titleColor', e.target.value)} />
            </div>
          </div>

          <div className="ccc-block-title-row">
            <div className="ccc-block-title" style={{ margin: 0 }}>Carruseles por categoría</div>
            <button onClick={addCarousel} className="ccc-btn-add"><Plus size={14} /> Agregar carrusel</button>
          </div>
          <p className="ccc-hint">Cada carrusel tiene sus propias categorías destino y sus propias tarjetas. El diseño de arriba se aplica a todos por igual.</p>

          {config.carousels.map((carousel, ci) => (
            <div key={carousel.id} className="ccc-carousel-card">
              <div className="ccc-carousel-head">
                <input type="text" placeholder="Nombre interno (ej: Living)" value={carousel.name}
                  onChange={e => patchCarousel(ci, { name: e.target.value })} />
                <button onClick={() => removeCarousel(ci)} className="ccc-btn-remove"><Trash2 size={16} /></button>
              </div>

              <label className="ccc-hint" style={{ display: 'block', marginBottom: 6 }}>Categorías donde se muestra</label>
              <div className="ccc-cat-picker">
                {catRows.length === 0 && <p className="ccc-hint">No se pudieron cargar las categorías de la tienda.</p>}
                {catRows.map(row => (
                  <label key={row.id} className="ccc-cat-row" style={{ paddingLeft: row.depth * 16 }}>
                    <input type="checkbox" checked={carousel.categoryIds.includes(row.id)}
                      onChange={() => toggleCategory(ci, row.id)} />
                    {row.name}
                  </label>
                ))}
              </div>

              <div className="ccc-block-title-row" style={{ marginTop: 0 }}>
                <label className="ccc-hint" style={{ margin: 0 }}>Tarjetas</label>
                <button onClick={() => addTile(ci)} className="ccc-btn-add"><Plus size={14} /> Agregar tarjeta</button>
              </div>
              {carousel.tiles.map((tile, ti) => (
                <div key={tile.id} className="ccc-tile-card">
                  <button className="ccc-tile-thumb" onClick={() => pickTileImage(ci, ti)} disabled={uploading}>
                    {tile.imageUrl ? <img src={tile.imageUrl} alt="" /> : <ImageIcon size={16} />}
                  </button>
                  <div className="ccc-tile-fields">
                    <input type="text" placeholder="Título (ej: Sillas)" value={tile.title}
                      onChange={e => patchTile(ci, ti, { title: e.target.value })} />
                    <input type="text" placeholder="URL (ej: /categorias/sillas)" value={tile.url}
                      onChange={e => patchTile(ci, ti, { url: e.target.value })} />
                  </div>
                  <button onClick={() => removeTile(ci, ti)} className="ccc-btn-remove"><Trash2 size={16} /></button>
                </div>
              ))}
              {carousel.tiles.length === 0 && <p className="ccc-hint">Sin tarjetas todavía.</p>}
            </div>
          ))}
          {config.carousels.length === 0 && <p className="ccc-hint">Sin carruseles todavía. Agregá uno para empezar.</p>}
        </div>

        <div className="ccc-preview-col">
          <div className="ccc-preview-sticky">
            <div className="ccc-preview-label"><Eye size={15} /> Vista previa</div>
            <div className="ccc-preview-panel">
              {previewTiles.length === 0 ? (
                <div className="ccc-preview-empty">Cargá tarjetas en algún carrusel para ver la vista previa</div>
              ) : (
                <div className="ccc-preview-track" style={{ gap: config.style.gap, fontFamily: config.style.titleFontFamily }}>
                  {previewTiles.map((t, i) => (
                    <a key={i} className="ccc-preview-tile" style={{ flex: `0 0 calc(${tileWidthPct}% - ${config.style.gap * (config.style.desktopVisible - 1) / config.style.desktopVisible}px)` }}>
                      <img src={t.imageUrl} alt="" style={{ borderRadius: config.style.borderRadius }} />
                      <div className="ccc-preview-tile-title" style={{ color: config.style.titleColor }}>{t.title}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="ccc-hint">
              <strong>Para activarlo:</strong> guardá los cambios. Se aplica arriba del listado de productos en las categorías que elegiste, reemplazando el banner nativo (que desactivás vos desde el panel de Tiendanube).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryCarouselConfig;
```

- [ ] **Step 3: Lint the new files**

Run: `npx eslint src/pages/CategoryCarouselConfig.jsx`
Expected: no errors (warnings about the pre-existing `baseline-browser-mapping` data notice are fine, same as every other lint run in this repo).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CategoryCarouselConfig.jsx src/pages/CategoryCarouselConfig.css
git commit -m "feat: panel admin del Carrusel de Categorías"
```

---

## Task 5: Wire the page into routing, sidebar and dashboard

**Files:**
- Modify: `src/App.jsx:34` (import), `src/App.jsx:86` (route)
- Modify: `src/components/Sidebar.jsx:1-21` (icon import + nav item)
- Modify: `src/pages/Dashboard.jsx` (feature tile)

**Interfaces:**
- Consumes: `CategoryCarouselConfig` default export from Task 4.
- Produces: the module becomes reachable at `/carrusel-categorias` from the sidebar and the dashboard, same as every other module.

- [ ] **Step 1: Add the route in `src/App.jsx`**

Add the import next to the other page imports (after line 34, `import SearchConfig from './pages/SearchConfig';`):

```js
import CategoryCarouselConfig from './pages/CategoryCarouselConfig';
```

Add the route next to the other routes (after line 86, `<Route path="/buscador-inteligente" element={<SearchConfig />} />`):

```jsx
          <Route path="/carrusel-categorias" element={<CategoryCarouselConfig />} />
```

- [ ] **Step 2: Add the sidebar entry in `src/components/Sidebar.jsx`**

Add `LayoutGrid` to the `lucide-react` import (line 2-5):

```js
import {
  LayoutDashboard, Palette, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Percent, Search, Rocket, Layers, LayoutGrid
} from 'lucide-react';
```

Add the nav item to `BASE_NAV_ITEMS`, right after the Buscador Inteligente Pro entry (line 17):

```js
  { path: '/carrusel-categorias', icon: LayoutGrid, label: 'Carrusel de Categorías' },
```

- [ ] **Step 3: Add the dashboard tile in `src/pages/Dashboard.jsx`**

Replace the existing `lucide-react` import at line 3:

```js
import { Palette, Rocket, ChevronRight, ShoppingBag, Search, Percent } from 'lucide-react';
```

with:

```js
import { Palette, Rocket, ChevronRight, ShoppingBag, Search, Percent, LayoutGrid } from 'lucide-react';
```

Add a new entry to the `mainFeatures` array, right after the "Buscador Inteligente Pro" entry:

```js
    {
      icon: LayoutGrid,
      title: 'Carrusel de Categorías',
      description: 'Reemplazá el banner fijo de cada categoría por un carrusel de tarjetas con imagen, título y link, con diseño personalizable y adaptado a celular.',
      path: '/carrusel-categorias',
      large: true,
      badge: '🔥 Nuevo'
    },
```

- [ ] **Step 4: Build the frontend to verify there are no import/route errors**

Run: `npm run build`
Expected: build succeeds (same pre-existing warnings as always — `@import` order and the CSS minify warning unrelated to these files — no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/Sidebar.jsx src/pages/Dashboard.jsx
git commit -m "feat: agregar Carrusel de Categorías al sidebar, dashboard y router"
```

---

## Task 6: Final verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full backend test suite**

Run (from `functions/`): `node --test *.test.js`
Expected: PASS, all tests (existing + the 15 new ones from Tasks 1-2).

- [ ] **Step 2: Run the frontend lint**

Run: `npx eslint src/pages/CategoryCarouselConfig.jsx src/App.jsx src/components/Sidebar.jsx src/pages/Dashboard.jsx`
Expected: no errors.

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: succeeds, `dist/` produced.

- [ ] **Step 4: Manual smoke test in the admin panel**

Start the dev server (`npm run dev`), log in, open `/carrusel-categorias` from the sidebar:
- Toggle enabled on/off.
- Change a style field (e.g. border radius) and confirm the live preview updates.
- Add a carousel, pick 1-2 categories from the picker, add a tile with an uploaded image + title + url.
- Save, reload the page, confirm the saved config comes back.

- [ ] **Step 5: Note the manual deployment prerequisite for the user**

Before `/api/category-carousel/install` can work in production, a new script must be registered in Tiendanube Partners (Aplicaciones → GlowLab #23137 → Scripts) and `CATEGORY_CAROUSEL_SCRIPT_ID` in `functions/index.js` updated with the real id — same manual step as was done for `SEARCH_SCRIPT_ID` (commit `60a3864`, "chore: set real Buscador Inteligente Pro script id"). This is not a code task; flag it to the user so they can do it from the Tiendanube Partners portal.
