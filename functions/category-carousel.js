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
    titleAlign: "center",
    desktopVisible: 4,
    mobileVisible: 2,
  },
  carousels: [],
};

const TITLE_ALIGNS = ["left", "center", "right"];

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

// Clampea un valor numérico entre min y max, maneja NaN y valores no numéricos
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

// Reduce la config guardada (con ids/nombres internos de admin) a lo mínimo
// que necesita el script del storefront, descartando carruseles sin
// categorías target o sin ninguna tile con imagen cargada.
function buildWidgetConfig(cfg) {
  const style = {
    borderRadius: clampNumber(cfg.style.borderRadius, 0, 40, DEFAULT_CONFIG.style.borderRadius),
    gap: clampNumber(cfg.style.gap, 0, 48, DEFAULT_CONFIG.style.gap),
    titleFontFamily: cfg.style.titleFontFamily || DEFAULT_CONFIG.style.titleFontFamily,
    titleFontSize: cfg.style.titleFontSize || DEFAULT_CONFIG.style.titleFontSize,
    titleColor: cfg.style.titleColor || DEFAULT_CONFIG.style.titleColor,
    titleAlign: TITLE_ALIGNS.includes(cfg.style.titleAlign) ? cfg.style.titleAlign : DEFAULT_CONFIG.style.titleAlign,
    desktopVisible: clampNumber(cfg.style.desktopVisible, 2, 8, DEFAULT_CONFIG.style.desktopVisible),
    mobileVisible: clampNumber(cfg.style.mobileVisible, 1, 4, DEFAULT_CONFIG.style.mobileVisible),
  };

  const carousels = (Array.isArray(cfg.carousels) ? cfg.carousels : [])
    .filter((c) => c && Array.isArray(c.categoryIds) && c.categoryIds.length
      && Array.isArray(c.tiles) && c.tiles.some((t) => t && t.imageUrl))
    .map((c) => ({
      heading: (c.heading || "").trim(),
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
const HEADING_FONT_SIZES_CSS = { small: "16px", medium: "19px", large: "22px" };

function buildWidgetScript(store, cfg) {
  const selectorMap = getClientSelectorMap();
  const st = cfg.style;
  const fontSize = FONT_SIZES_CSS[st.titleFontSize];
  const headingFontSize = HEADING_FONT_SIZES_CSS[st.titleFontSize];

  // Pre-compute CSS values
  const tileWidth = `calc((100% - ${st.desktopVisible - 1} * ${st.gap}px) / ${st.desktopVisible})`;
  const mobileTileWidth = `calc((100% - ${st.mobileVisible - 1} * ${st.gap}px) / ${st.mobileVisible})`;

  const cssText = [
    `.pn-cc { width: 100%; box-sizing: border-box; margin: 0 0 28px; font-family: ${st.titleFontFamily}, system-ui, sans-serif; }`,
    `.pn-cc-heading { margin: 0 0 14px; font-size: ${headingFontSize}; font-weight: 700; text-align: ${st.titleAlign}; color: ${st.titleColor}; }`,
    `.pn-cc-row { position: relative; }`,
    `.pn-cc-track { display: flex; gap: ${st.gap}px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; }`,
    `.pn-cc-track::-webkit-scrollbar { display: none; }`,
    `.pn-cc-tile { flex: 0 0 ${tileWidth}; scroll-snap-align: start; text-decoration: none; color: inherit; }`,
    `.pn-cc-tile img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: ${st.borderRadius}px; display: block; background: #f0f0f0; }`,
    `.pn-cc-tile-title { margin-top: 10px; text-align: ${st.titleAlign}; font-size: ${fontSize}; font-weight: 600; color: ${st.titleColor}; }`,
    `.pn-cc-arrow { position: absolute; top: 38%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; border: 1px solid #eee; background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.14); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; color: #333; z-index: 2; }`,
    `.pn-cc-arrow-prev { left: -14px; }`,
    `.pn-cc-arrow-next { right: -14px; }`,
    `@media (max-width: 640px) { .pn-cc-tile { flex-basis: ${mobileTileWidth}; } .pn-cc-arrow { display: none; } }`,
  ].join('\n');

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
  var PRODUCT_CARD_SELECTORS = ['[data-item-id]', '[data-product-id]', '.js-item-product', '.product-item', '.item-product'];
  var PRODUCT_CARD_SELECTOR = PRODUCT_CARD_SELECTORS.join(',');

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

  // Heurística sin selector verificado para el theme: en el markup típico de
  // Tiendanube cada tarjeta está envuelta en su propia columna dentro de la
  // grilla (ej. <div class="row"><div class="col-6"><div class="item
  // js-item-product">...), así que el padre inmediato de UNA tarjeta es esa
  // columna, no la grilla. Se sube por los ancestros hasta encontrar el que
  // contiene 2 o más tarjetas -- ese sí es la grilla/listado real.
  function findGridContainer() {
    var card = null;
    for (var i = 0; i < PRODUCT_CARD_SELECTORS.length; i++) {
      card = document.querySelector(PRODUCT_CARD_SELECTORS[i]);
      if (card) break;
    }
    if (!card) return null;

    var ancestor = card.parentElement;
    while (ancestor) {
      if (ancestor.querySelectorAll(PRODUCT_CARD_SELECTOR).length >= 2) return ancestor;
      ancestor = ancestor.parentElement;
    }
    return null;
  }

  // Devuelve la grilla/listado de productos en sí (nunca una tarjeta ni su
  // wrapper): si el theme tiene gridSelector verificado, ese selector ya
  // apunta directo a la grilla; si no, findGridContainer() hace el walk-up.
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
    var s = document.createElement('style');
    s.id = 'pn-cc-styles';
    s.textContent = ${JSON.stringify(cssText)};
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
    if (carousel.heading) {
      var heading = document.createElement('div');
      heading.className = 'pn-cc-heading';
      heading.textContent = carousel.heading;
      wrap.appendChild(heading);
    }
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
    // Idempotencia: __pnCategoryCarouselLoaded solo evita que el SCRIPT se
    // cargue dos veces -- init() se vuelve a llamar en cada mutación del
    // MutationObserver (grillas que se re-renderizan por lazy-load, filtros,
    // orden, infinite scroll), así que hace falta este guard separado para
    // no insertar el carrusel duplicado.
    if (document.querySelector('.pn-cc')) return;
    if (!(window.LS && window.LS.category && window.LS.category.id)) return;
    var carousel = findCarouselForCategory(window.LS.category.id);
    if (!carousel) return;

    // findAnchorTarget() devuelve la grilla de productos en sí (no una
    // tarjeta ni su wrapper de columna) -- el carrusel se inserta como
    // hermano, inmediatamente antes de la grilla completa.
    var grid = findAnchorTarget();
    if (!grid || !grid.parentElement) return;

    injectStyles();
    grid.parentElement.insertBefore(buildCarousel(carousel), grid);
  }

  var debounceTimer = null;
  function scheduleInit() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(init, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var observer = new MutationObserver(scheduleInit);
  observer.observe(document.body, { childList: true, subtree: true });
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
