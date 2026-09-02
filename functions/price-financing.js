"use strict";

// Precios y Cuotas - descuento efectivo/transferencia + planes de cuotas,
// mostrados en el listado de productos, la página de producto y (opcional)
// una barra de progreso en el carrito hacia el próximo plan sin interés.
// Entrega al storefront vía script legacy (bootstrap subido y registrado en
// Tiendanube Partners como "Precios y Cuotas PromoNube" #9835), no usa NubeSDK.
// Una vez publicada la app, los scripts ad-hoc por API ya no se pueden crear
// dinámicamente — deben existir en el catálogo de la app en Partners primero.
// Con "Instalación automática" apagada, cada tienda se activa vía
// POST /2025-03/{storeId}/scripts { script_id } (ver /api/price-financing/install).
//
// Un doc por store en `promonube_price_financing`. GET/POST /api/price-financing-config
// son para el admin React. GET /api/price-financing-widget.js es el script que se
// instala en la tienda (público, gateado por suscripción activa).

const COLLECTION = "promonube_price_financing";

// Id numérico del script "Precios y Cuotas PromoNube" registrado en
// TiendaNube Partners (Aplicaciones → GlowLab #23137 → Scripts).
const PRICE_FINANCING_SCRIPT_ID = 9835;

const DEFAULT_CONFIG = {
  enabled: true,
  showOnListing: true,
  showOnPDP: true,
  cashDiscountPercent: 0,
  transferDiscountPercent: 0,
  customMessage: "",
  installmentPlans: [],
  cartProgressBar: { enabled: false },
};

function registerPriceFinancingRoutes(app, { db, FieldValue, checkStoreActive, HOSTING_URL }) {
  // GET /api/price-financing-config?storeId=X - config para el admin
  app.get("/api/price-financing-config", async (req, res) => {
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

  // POST /api/price-financing-config - guardar config
  app.post("/api/price-financing-config", async (req, res) => {
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

  // GET /api/price-financing-widget.js?store=X - script servido a la tienda
  app.get("/api/price-financing-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store) {
      return res.send("// PromoNube Precios y Cuotas: falta storeId");
    }

    try {
      if (!(await checkStoreActive(store))) {
        return res.send("// PromoNube Precios y Cuotas: plan inactivo");
      }

      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      const cfg = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;

      if (cfg.enabled === false) {
        return res.send("// PromoNube Precios y Cuotas: deshabilitado");
      }

      const widgetConfig = {
        showOnListing: cfg.showOnListing !== false,
        showOnPDP: cfg.showOnPDP !== false,
        cashDiscountPercent: Number(cfg.cashDiscountPercent) || 0,
        transferDiscountPercent: Number(cfg.transferDiscountPercent) || 0,
        customMessage: cfg.customMessage || "",
        installmentPlans: Array.isArray(cfg.installmentPlans) ? cfg.installmentPlans : [],
        cartProgressBar: { enabled: !!(cfg.cartProgressBar && cfg.cartProgressBar.enabled) },
      };

      res.send(buildWidgetScript(store, widgetConfig));
    } catch (error) {
      res.send("// PromoNube Precios y Cuotas: error " + error.message);
    }
  });

  // POST /api/price-financing/install - instala el script en TiendaNube (Scripts API clásica)
  app.post("/api/price-financing/install", async (req, res) => {
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!(await checkStoreActive(storeId))) return res.status(403).json({ success: false, message: "Plan inactivo" });

    try {
      const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
      if (!storeDoc.exists) return res.status(404).json({ success: false, message: "Store no encontrada" });

      const accessToken = storeDoc.data().accessToken;

      // Activa (asocia) el script "Precios y Cuotas PromoNube" ya registrado en
      // Partners (id fijo, no auto-instalado) para esta tienda puntual.
      // Docs: https://tiendanube.github.io/api-documentation/resources/script
      const installRes = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/scripts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "User-Agent": "GlowLab (info@techdi.com.ar)",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script_id: PRICE_FINANCING_SCRIPT_ID,
        }),
      });

      if (!installRes.ok) {
        const t = await installRes.text();
        return res.status(500).json({ success: false, message: "Error TN: " + t });
      }

      const installed = await installRes.json();
      res.json({ success: true, message: "Script activado para la tienda", result: installed });
    } catch (error) {
      console.error("[PriceFinancing install]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

function buildWidgetScript(store, cfg) {
  return `
/**
 * PromoNube - Precios y Cuotas
 * Tienda: ${store}
 */
(function() {
  'use strict';
  if (window.__pnPriceFinancingLoaded) return;
  window.__pnPriceFinancingLoaded = true;

  var CFG = ${JSON.stringify(cfg)};

  function injectStyles() {
    if (document.getElementById('pn-pf-styles')) return;
    var s = document.createElement('style');
    s.id = 'pn-pf-styles';
    s.textContent = [
      '.pn-pf-block, .pn-pf-block * { box-sizing: border-box !important; font-family: inherit; }',
      '.pn-pf-block { margin: 6px 0 !important; font-size: 13px !important; line-height: 1.4 !important; }',
      '.pn-pf-block .pn-pf-line { margin: 2px 0 !important; }',
      '.pn-pf-block .pn-pf-discount { color: #16a34a !important; font-weight: 600 !important; }',
      '.pn-pf-block .pn-pf-installments { color: #444 !important; }',
      '.pn-pf-block .pn-pf-message { color: #777 !important; font-size: 12px !important; }',
      '.pn-pf-progress { margin: 10px 0 !important; font-size: 13px !important; }',
      '.pn-pf-progress-bar { height: 6px !important; border-radius: 999px !important; background: #eee !important; overflow: hidden !important; margin-top: 4px !important; }',
      '.pn-pf-progress-fill { height: 100% !important; background: #16a34a !important; }',
    ].join('');
    document.head.appendChild(s);
  }

  function fmt(n) {
    try {
      return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } catch (e) {
      return String(Math.round(n));
    }
  }

  function parsePrice(text) {
    if (!text) return null;
    var cleaned = String(text).replace(/[^0-9.,]/g, '');
    if (!cleaned) return null;
    // es-AR: punto = miles, coma = decimales
    if (cleaned.indexOf(',') !== -1) {
      cleaned = cleaned.replace(/\\./g, '').replace(',', '.');
    } else if ((cleaned.match(/\\./g) || []).length > 1) {
      cleaned = cleaned.replace(/\\./g, '');
    }
    var n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  var PRICE_SELECTORS = [
    '.js-price-with-discount', '.js-price-display',
    '.js-product-price', '.product-detail-price', '.js-product-detail-price',
    '[data-store="product-price"]', '.product-price', '.price-detail', '.js-compat-price',
  ];

  function isVisible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findPriceNode(scope) {
    for (var i = 0; i < PRICE_SELECTORS.length; i++) {
      var candidates = scope.querySelectorAll(PRICE_SELECTORS[i]);
      for (var j = 0; j < candidates.length; j++) {
        if (isVisible(candidates[j])) return candidates[j];
      }
    }
    return null;
  }

  function extractPrice(priceNode, lsProduct) {
    if (lsProduct && lsProduct.variants && lsProduct.variants[0] && lsProduct.variants[0].price) {
      var p = Number(lsProduct.variants[0].price);
      if (!isNaN(p) && p > 0) return p;
    }
    if (priceNode) {
      var parsed = parsePrice(priceNode.textContent);
      if (parsed) return parsed;
    }
    return null;
  }

  function buildBlock(price) {
    var block = document.createElement('div');
    block.className = 'pn-pf-block';
    var lines = [];

    var transferPct = CFG.transferDiscountPercent;
    var cashPct = CFG.cashDiscountPercent;
    if (transferPct > 0) {
      var transferPrice = price * (1 - transferPct / 100);
      lines.push('<div class="pn-pf-line pn-pf-discount">$' + fmt(transferPrice) + ' por transferencia (' + transferPct + '% OFF)</div>');
    }
    if (cashPct > 0) {
      var cashPrice = price * (1 - cashPct / 100);
      lines.push('<div class="pn-pf-line pn-pf-discount">$' + fmt(cashPrice) + ' en efectivo (' + cashPct + '% OFF)</div>');
    }
    (CFG.installmentPlans || []).forEach(function(plan) {
      if (!plan || !plan.months) return;
      var perMonth = price / plan.months;
      if (plan.interestFree) {
        lines.push('<div class="pn-pf-line pn-pf-installments">Hasta ' + plan.months + ' cuotas sin interés de $' + fmt(perMonth) + '</div>');
      } else {
        var rate = Number(plan.interestRate) || 0;
        var withInterest = perMonth * (1 + rate / 100);
        lines.push('<div class="pn-pf-line pn-pf-installments">' + plan.months + ' cuotas de $' + fmt(withInterest) + '</div>');
      }
    });
    if (CFG.customMessage) {
      lines.push('<div class="pn-pf-line pn-pf-message">' + CFG.customMessage + '</div>');
    }

    if (!lines.length) return null;
    block.innerHTML = lines.join('');
    return block;
  }

  var INLINE_TAGS = { SPAN: 1, STRONG: 1, B: 1, EM: 1, I: 1, A: 1, SMALL: 1, LABEL: 1 };

  function blockLevelAncestor(el) {
    var node = el;
    while (node.parentElement && INLINE_TAGS[node.tagName]) {
      node = node.parentElement;
    }
    return node;
  }

  function applyTo(scope, lsProduct) {
    if (scope.querySelector('.pn-pf-block')) return;
    var priceNode = findPriceNode(scope);
    var price = extractPrice(priceNode, lsProduct);
    if (!price) return;
    var block = buildBlock(price);
    if (!block) return;
    var anchor = priceNode ? blockLevelAncestor(priceNode) : scope;
    anchor.parentNode ? anchor.parentNode.insertBefore(block, anchor.nextSibling) : scope.appendChild(block);
  }

  function runPDP() {
    if (!CFG.showOnPDP) return;
    var lsProduct = window.LS && window.LS.product;
    applyTo(document, lsProduct);
  }

  var LISTING_SELECTORS = ['[data-item-id]', '.product-item', '.item-product', '[data-product-id]'];

  function runListing() {
    if (!CFG.showOnListing) return;
    var cards = [];
    for (var i = 0; i < LISTING_SELECTORS.length; i++) {
      var found = document.querySelectorAll(LISTING_SELECTORS[i]);
      if (found.length) { cards = found; break; }
    }
    cards.forEach(function(card) { applyTo(card, null); });
  }

  function runCartProgress() {
    if (!CFG.cartProgressBar || !CFG.cartProgressBar.enabled) return;
    var plans = (CFG.installmentPlans || []).filter(function(p) { return p && p.minAmount > 0; });
    if (!plans.length) return;
    var cart = window.LS && window.LS.cart;
    if (!cart) return;
    var total = Number(cart.total) || 0;
    plans.sort(function(a, b) { return a.minAmount - b.minAmount; });
    var next = null;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].minAmount > total) { next = plans[i]; break; }
    }
    if (!next) return;

    var container = document.querySelector('[data-cart-total], .cart-total, .js-cart-total, .cart-summary, #cart, .cart');
    if (!container || container.querySelector('.pn-pf-progress')) return;

    var remaining = next.minAmount - total;
    var pct = Math.min(100, Math.round((total / next.minAmount) * 100));
    var bar = document.createElement('div');
    bar.className = 'pn-pf-progress';
    bar.innerHTML = 'Te faltan $' + fmt(remaining) + ' para acceder a ' + next.months + ' cuotas sin interés' +
      '<div class="pn-pf-progress-bar"><div class="pn-pf-progress-fill" style="width:' + pct + '%"></div></div>';
    container.insertBefore(bar, container.firstChild);
  }

  function run() {
    injectStyles();
    var isPDP = !!(window.LS && window.LS.product);
    var isCart = !!(window.LS && window.LS.cart);
    if (isPDP) runPDP();
    else runListing();
    if (isCart) runCartProgress();
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

module.exports = { registerPriceFinancingRoutes };
