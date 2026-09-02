"use strict";

// Buscador Inteligente Pro - popup de búsqueda con fuzzy matching + fallback a IA (Anthropic).
// Módulo nuevo y aislado (no comparte nada con enhanced-search-* / customizeSearchBar,
// que quedan intactos sirviendo instalaciones viejas ya activas).

const Fuse = require("fuse.js");

const COLLECTION = "promonube_search_config";
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_CONFIG = {
  enabled: false,
  template: "minimal",
  title: "Buscar productos",
  primaryColor: "#111111",
  fontFamily: "system-ui",
  fontSize: "medium",
  aiEnabled: false,
  banners: [],
  featuredSearches: [],
};

function registerSearchRoutes(app, { db, FieldValue, checkStoreActive }) {
  app.get("/api/search-config", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
      const config = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/search-config", async (req, res) => {
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

  app.get("/api/search-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store) return res.send("// PromoNube Buscador: falta storeId");

    try {
      if (!(await checkStoreActive(store))) {
        return res.send("// PromoNube Buscador: plan inactivo");
      }
      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      const cfg = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      if (cfg.enabled === false) return res.send("// PromoNube Buscador: deshabilitado");

      const widgetConfig = {
        template: cfg.template || "minimal",
        title: cfg.title || DEFAULT_CONFIG.title,
        primaryColor: cfg.primaryColor || DEFAULT_CONFIG.primaryColor,
        fontFamily: cfg.fontFamily || DEFAULT_CONFIG.fontFamily,
        fontSize: cfg.fontSize || DEFAULT_CONFIG.fontSize,
        banners: Array.isArray(cfg.banners) ? cfg.banners.filter((b) => b && b.imageUrl) : [],
        featuredSearches: Array.isArray(cfg.featuredSearches) ? cfg.featuredSearches.filter((f) => f && f.label) : [],
      };

      res.send(buildWidgetScript(store, widgetConfig));
    } catch (error) {
      res.send("// PromoNube Buscador: error " + error.message);
    }
  });

  // GET /api/search-query?storeId=&q= - búsqueda real: catálogo cacheado + fuzzy + fallback IA
  app.get("/api/search-query", async (req, res) => {
    const { storeId, q } = req.query;
    if (!storeId || !q) return res.json({ success: true, products: [], usedAI: false });

    try {
      const [catalog, cfgDoc] = await Promise.all([
        getCachedCatalog(db, storeId),
        db.collection(COLLECTION).doc(String(storeId)).get(),
      ]);
      const cfg = cfgDoc.exists ? { ...DEFAULT_CONFIG, ...cfgDoc.data() } : DEFAULT_CONFIG;

      const fuse = new Fuse(catalog, {
        keys: ["name", "tags"],
        threshold: 0.5,
        ignoreLocation: true,
      });
      let results = fuse.search(String(q)).slice(0, 12).map((r) => r.item);
      let usedAI = false;

      if (results.length === 0 && cfg.aiEnabled && process.env.ANTHROPIC_API_KEY) {
        try {
          const aiResults = await searchWithAI(String(q), catalog);
          if (aiResults.length) {
            results = aiResults;
            usedAI = true;
          }
        } catch (aiError) {
          console.error("[Search query] AI fallback failed", aiError.message);
        }
      }

      res.json({ success: true, products: results, usedAI });
    } catch (error) {
      console.error("[Search query]", error);
      res.status(500).json({ success: false, products: [], usedAI: false, message: error.message });
    }
  });

  // POST /api/search/install - activa el script (Instalación automática apagada) para una tienda puntual
  app.post("/api/search/install", async (req, res) => {
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
        body: JSON.stringify({ script_id: SEARCH_SCRIPT_ID }),
      });

      if (!installRes.ok) {
        const t = await installRes.text();
        return res.status(500).json({ success: false, message: "Error TN: " + t });
      }
      const installed = await installRes.json();
      res.json({ success: true, message: "Script activado para la tienda", result: installed });
    } catch (error) {
      console.error("[Search install]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

// Id numérico del script "Buscador Inteligente Pro" registrado en TiendaNube Partners
// (Aplicaciones → GlowLab #23137 → Scripts). Se completa después de crearlo ahí.
let SEARCH_SCRIPT_ID = null;
function setSearchScriptId(id) { SEARCH_SCRIPT_ID = id; }

async function getCachedCatalog(db, storeId) {
  const key = `search-catalog/${storeId}`;
  const cached = _catalogCache.get(key);
  if (cached && Date.now() - cached.ts < CATALOG_CACHE_TTL_MS) return cached.data;

  const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
  if (!storeDoc.exists) return [];
  const accessToken = storeDoc.data().accessToken;
  if (!accessToken) return [];

  let allProducts = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 10) {
    const response = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/products?per_page=200&page=${page}&published=true`,
      {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "GlowLab (info@techdi.com.ar)",
        },
      }
    );
    if (!response.ok) break;
    const products = await response.json();
    if (!products.length) { hasMore = false; break; }
    allProducts = allProducts.concat(products);
    if (products.length < 200) hasMore = false;
    page++;
  }

  const catalog = allProducts.map((p) => ({
    id: p.id,
    name: (p.name && (p.name.es || Object.values(p.name)[0])) || "",
    price: (p.variants && p.variants[0] && p.variants[0].price) || null,
    image: (p.images && p.images[0] && p.images[0].src) || null,
    url: p.canonical_url || null,
    tags: p.tags || "",
  })).filter((p) => p.name);

  _catalogCache.set(key, { data: catalog, ts: Date.now() });
  return catalog;
}

const _catalogCache = new Map();

async function searchWithAI(query, catalog) {
  try {
    const compactCatalog = catalog.slice(0, 300).map((p) => `${p.id}|${p.name}`).join("\n");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Sos el buscador de una tienda online. El cliente buscó: "${query}".\n` +
            `Catálogo (id|nombre), uno por línea:\n${compactCatalog}\n\n` +
            `Devolvé SOLO un array JSON de hasta 8 ids de producto relevantes a la búsqueda, ` +
            `ordenados por relevancia. Si no hay ninguno relevante, devolvé []. Sin texto extra, solo el JSON.`,
        }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Anthropic API ${resp.status}: ${t.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "[]";
    const ids = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");
    const byId = new Map(catalog.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  } catch (error) {
    console.error("[Search AI]", error);
    throw error;
  }
}

function buildWidgetScript(store, cfg) {
  return `
/**
 * PromoNube - Buscador Inteligente Pro
 * Tienda: ${store}
 */
(function() {
  'use strict';
  if (window.__pnSearchLoaded) return;
  window.__pnSearchLoaded = true;

  var CFG = ${JSON.stringify(cfg)};
  var API_BASE = 'https://glowlab-production.up.railway.app';
  var STORE_ID = '${store}';

  var FONT_SIZES = { small: '14px', medium: '16px', large: '18px' };

  function injectStyles() {
    if (document.getElementById('pn-search-styles')) return;
    var s = document.createElement('style');
    s.id = 'pn-search-styles';
    s.textContent = [
      '.pn-search-overlay { position: fixed; inset: 0; background: rgba(20,20,20,0.55); backdrop-filter: blur(3px); z-index: 999999; display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px; opacity: 0; transition: opacity 0.18s ease; font-family: ' + CFG.fontFamily + ', system-ui, sans-serif; }',
      '.pn-search-overlay.pn-open { opacity: 1; }',
      '.pn-search-panel { background: #fff; width: 100%; max-width: 620px; border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,0.28); overflow: hidden; transform: translateY(-12px); transition: transform 0.18s ease; }',
      '.pn-search-overlay.pn-open .pn-search-panel { transform: translateY(0); }',
      '.pn-search-head { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #eee; }',
      '.pn-search-input { flex: 1; border: none; outline: none; font-size: ' + FONT_SIZES[CFG.fontSize] + '; color: #111; }',
      '.pn-search-close { border: none; background: transparent; cursor: pointer; color: #999; font-size: 20px; line-height: 1; padding: 4px; }',
      '.pn-search-body { max-height: 60vh; overflow-y: auto; padding: 8px 20px 20px; }',
      '.pn-search-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin: 16px 0 8px; }',
      '.pn-search-banners { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }',
      '.pn-search-banner img { width: 100%; border-radius: 10px; display: block; }',
      '.pn-search-featured { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }',
      '.pn-search-featured a { padding: 7px 14px; border-radius: 999px; background: #f4f4f4; color: #333; text-decoration: none; font-size: 13px; }',
      '.pn-search-featured a:hover { background: #eaeaea; }',
      '.pn-search-result { display: flex; align-items: center; gap: 12px; padding: 10px 4px; text-decoration: none; color: inherit; border-radius: 10px; }',
      '.pn-search-result:hover { background: #f7f7f7; }',
      '.pn-search-result img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; background: #f0f0f0; flex-shrink: 0; }',
      '.pn-search-result-name { font-size: 14px; color: #111; }',
      '.pn-search-result-price { font-size: 13px; color: ' + CFG.primaryColor + '; font-weight: 600; margin-top: 2px; }',
      '.pn-search-empty { color: #999; font-size: 14px; padding: 20px 4px; text-align: center; }',

      // Plantilla "Compacto": dropdown chico anclado al trigger, sin fondo oscuro, sin banners, todo mas denso
      '.pn-search-overlay.pn-tpl-compact { background: transparent; backdrop-filter: none; align-items: flex-start; justify-content: flex-start; padding: 0; }',
      '.pn-tpl-compact .pn-search-panel { position: absolute; width: 340px; max-width: 340px; border-radius: 14px; border: 1px solid #eee; box-shadow: 0 16px 44px rgba(0,0,0,0.18); }',
      '.pn-tpl-compact .pn-search-head { padding: 10px 14px; gap: 8px; }',
      '.pn-tpl-compact .pn-search-input { font-size: 14px; }',
      '.pn-tpl-compact .pn-search-body { padding: 2px 14px 12px; max-height: 44vh; }',
      '.pn-tpl-compact .pn-search-section-title { margin: 10px 0 6px; }',
      '.pn-tpl-compact .pn-search-featured a { padding: 5px 11px; font-size: 12px; }',
      '.pn-tpl-compact .pn-search-result { padding: 6px 2px; gap: 9px; }',
      '.pn-tpl-compact .pn-search-result img { width: 34px; height: 34px; border-radius: 6px; }',
      '.pn-tpl-compact .pn-search-result-name { font-size: 12.5px; }',
      '.pn-tpl-compact .pn-search-result-price { font-size: 12px; }',

      // Plantilla "Grid con banners": columna lateral fija con banners (siempre visible) + resultados en tarjetas
      '.pn-tpl-grid .pn-search-panel { max-width: 860px; display: flex; align-items: stretch; }',
      '.pn-search-side { width: 230px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; padding: 22px 16px; background: #f6f6f6; overflow-y: auto; max-height: 66vh; }',
      '.pn-search-side-banner { display: block; border-radius: 12px; overflow: hidden; }',
      '.pn-search-side-banner img { width: 100%; display: block; aspect-ratio: 3 / 4; object-fit: cover; }',
      '.pn-search-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }',
      '.pn-tpl-grid .pn-search-body { flex: 1; }',
      '.pn-search-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; margin-top: 4px; }',
      '.pn-search-result-card { display: flex; flex-direction: column; text-decoration: none; color: inherit; border-radius: 12px; padding: 8px; }',
      '.pn-search-result-card:hover { background: #f7f7f7; }',
      '.pn-search-result-card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px; background: #f0f0f0; }',
      '.pn-search-result-card .pn-search-result-name { margin-top: 8px; font-size: 13px; }',
      '.pn-search-result-card .pn-search-result-price { margin-top: 2px; }',
      '@media (max-width: 640px) { .pn-tpl-grid .pn-search-panel { flex-direction: column; } .pn-search-side { width: auto; flex-direction: row; max-height: none; } .pn-search-side-banner { flex: 1; } }',
    ].join('');
    document.head.appendChild(s);
  }

  function fmtPrice(n) {
    var num = Number(n);
    if (isNaN(num)) return '';
    return '$' + Math.round(num).toLocaleString('es-AR');
  }

  var overlay = null;
  var input = null;
  var body = null;
  var debounceTimer = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'pn-search-overlay pn-tpl-' + (CFG.template || 'minimal');

    var headBody =
      '<div class="pn-search-head">' +
        '<input class="pn-search-input" type="text" placeholder="' + CFG.title + '" />' +
        '<button class="pn-search-close" aria-label="Cerrar">&times;</button>' +
      '</div>' +
      '<div class="pn-search-body"></div>';

    if (CFG.template === 'grid' && CFG.banners && CFG.banners.length) {
      overlay.innerHTML =
        '<div class="pn-search-panel">' +
          '<div class="pn-search-side">' +
            CFG.banners.map(function(b) {
              return '<a class="pn-search-side-banner" href="' + (b.url || '#') + '"><img src="' + b.imageUrl + '" alt="" /></a>';
            }).join('') +
          '</div>' +
          '<div class="pn-search-main">' + headBody + '</div>' +
        '</div>';
    } else {
      overlay.innerHTML = '<div class="pn-search-panel">' + headBody + '</div>';
    }
    document.body.appendChild(overlay);

    input = overlay.querySelector('.pn-search-input');
    body = overlay.querySelector('.pn-search-body');
    overlay.querySelector('.pn-search-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('pn-open')) close(); });
    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (!q) { renderIdle(); return; }
      debounceTimer = setTimeout(function() { runSearch(q); }, 250);
    });
  }

  function renderIdle() {
    var html = '';
    // En "grid" los banners viven en la columna lateral fija; en "compact" no se muestran (liviano).
    if (CFG.template === 'minimal' && CFG.banners && CFG.banners.length) {
      html += '<div class="pn-search-section-title">Destacado</div><div class="pn-search-banners">' +
        CFG.banners.map(function(b) {
          return '<a class="pn-search-banner" href="' + (b.url || '#') + '"><img src="' + b.imageUrl + '" alt="" /></a>';
        }).join('') + '</div>';
    }
    if (CFG.featuredSearches && CFG.featuredSearches.length) {
      html += '<div class="pn-search-section-title">Búsquedas recomendadas</div><div class="pn-search-featured">' +
        CFG.featuredSearches.map(function(f) {
          return '<a href="' + (f.url || '#') + '">' + f.label + '</a>';
        }).join('') + '</div>';
    }
    body.innerHTML = html;
  }

  function renderResults(products, usedAI) {
    if (!products.length) {
      body.innerHTML = '<div class="pn-search-empty">Sin resultados</div>';
      return;
    }
    if (CFG.template === 'grid') {
      body.innerHTML = '<div class="pn-search-results-grid">' + products.map(function(p) {
        return '<a class="pn-search-result-card" href="' + (p.url || '#') + '">' +
          '<img src="' + (p.image || '') + '" alt="" onerror="this.style.visibility=\\'hidden\\'" />' +
          '<div class="pn-search-result-name">' + p.name + '</div>' +
          (p.price ? '<div class="pn-search-result-price">' + fmtPrice(p.price) + '</div>' : '') +
          '</a>';
      }).join('') + '</div>';
      return;
    }
    body.innerHTML = products.map(function(p) {
      return '<a class="pn-search-result" href="' + (p.url || '#') + '">' +
        '<img src="' + (p.image || '') + '" alt="" onerror="this.style.visibility=\\'hidden\\'" />' +
        '<div><div class="pn-search-result-name">' + p.name + '</div>' +
        (p.price ? '<div class="pn-search-result-price">' + fmtPrice(p.price) + '</div>' : '') +
        '</div></a>';
    }).join('');
  }

  function runSearch(q) {
    body.innerHTML = '<div class="pn-search-empty">Buscando…</div>';
    fetch(API_BASE + '/api/search-query?storeId=' + encodeURIComponent(STORE_ID) + '&q=' + encodeURIComponent(q))
      .then(function(r) { return r.json(); })
      .then(function(data) { renderResults(data.products || [], data.usedAI); })
      .catch(function() { body.innerHTML = '<div class="pn-search-empty">Error al buscar</div>'; });
  }

  function open(triggerEl) {
    if (!overlay) buildOverlay();
    renderIdle();
    overlay.classList.add('pn-open');
    document.body.style.overflow = (CFG.template === 'compact') ? '' : 'hidden';
    if (CFG.template === 'compact' && triggerEl) {
      var r = triggerEl.getBoundingClientRect();
      var panel = overlay.querySelector('.pn-search-panel');
      var panelWidth = 380;
      var left = Math.min(r.left, window.innerWidth - panelWidth - 16);
      left = Math.max(16, left);
      panel.style.top = (r.bottom + 8) + 'px';
      panel.style.left = left + 'px';
    }
    setTimeout(function() { input && input.focus(); }, 50);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('pn-open');
    document.body.style.overflow = '';
    if (input) input.value = '';
  }

  var TRIGGER_SELECTORS = [
    'header .js-search-btn', 'header button[class*="search"]', 'header a.js-search-btn',
    '.utilities-item a[href*="search"]', '.js-utilities a[href*="search"]',
    'header input[type="search"]', 'header input[name="q"]',
    'header .search-input', 'header .js-search-input', 'header .js-header-search-input',
    '[data-store="search"]', '.js-search-icon', 'a[href*="/search"]',
  ];

  function attachTriggers() {
    TRIGGER_SELECTORS.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        if (el.__pnSearchBound) return;
        el.__pnSearchBound = true;
        var evt = (el.tagName === 'INPUT') ? 'focus' : 'click';
        el.addEventListener(evt, function(e) {
          e.preventDefault();
          open(el);
        });
      });
    });
  }

  function init() {
    injectStyles();
    attachTriggers();
    var mo = new MutationObserver(function() { attachTriggers(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
}

module.exports = { registerSearchRoutes, setSearchScriptId };
