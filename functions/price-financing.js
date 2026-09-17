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
const PRICE_FINANCING_SCRIPT_ID = 9837;

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  cashDiscountPercent: 0,
  transferDiscountPercent: 0,
  transferLabel: "por transferencia",
  cashLabel: "en efectivo",
  installmentsFreeLabel: "cuotas sin interés de",
  installmentsPaidLabel: "cuotas de",
  customMessage: "",
  installmentPlans: [],
  cartProgressBar: { enabled: false },
  discountColorEnabled: false,
  discountColor: "#e11d48",
  blockFontFamily: "inherit",
  blockFontSize: 13,
  blockDiscountColor: "#16a34a",
  blockDiscountBold: true,
  blockInstallmentsColor: "#444444",
};

const BLOCK_FONT_FAMILIES = [
  "inherit", "system-ui", "'Poppins', sans-serif", "'Inter', sans-serif",
  "'Playfair Display', serif", "'Space Grotesk', sans-serif", "'Georgia', serif",
];

function isHexColor(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

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
        transferLabel: cfg.transferLabel || DEFAULT_CONFIG.transferLabel,
        cashLabel: cfg.cashLabel || DEFAULT_CONFIG.cashLabel,
        installmentsFreeLabel: cfg.installmentsFreeLabel || DEFAULT_CONFIG.installmentsFreeLabel,
        installmentsPaidLabel: cfg.installmentsPaidLabel || DEFAULT_CONFIG.installmentsPaidLabel,
        customMessage: cfg.customMessage || "",
        installmentPlans: Array.isArray(cfg.installmentPlans) ? cfg.installmentPlans : [],
        cartProgressBar: { enabled: !!(cfg.cartProgressBar && cfg.cartProgressBar.enabled) },
        discountColorEnabled: !!cfg.discountColorEnabled,
        discountColor: isHexColor(cfg.discountColor) ? cfg.discountColor : DEFAULT_CONFIG.discountColor,
        blockFontFamily: BLOCK_FONT_FAMILIES.includes(cfg.blockFontFamily) ? cfg.blockFontFamily : DEFAULT_CONFIG.blockFontFamily,
        blockFontSize: clampNumber(cfg.blockFontSize, 10, 20, DEFAULT_CONFIG.blockFontSize),
        blockDiscountColor: isHexColor(cfg.blockDiscountColor) ? cfg.blockDiscountColor : DEFAULT_CONFIG.blockDiscountColor,
        blockDiscountBold: cfg.blockDiscountBold !== false,
        blockInstallmentsColor: isHexColor(cfg.blockInstallmentsColor) ? cfg.blockInstallmentsColor : DEFAULT_CONFIG.blockInstallmentsColor,
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
    var blockFontFamily = CFG.blockFontFamily === 'inherit' ? 'inherit' : CFG.blockFontFamily + ', inherit';
    s.textContent = [
      '.pn-pf-block, .pn-pf-block * { box-sizing: border-box !important; font-family: ' + blockFontFamily + '; }',
      '.pn-pf-block { margin: 6px 0 !important; font-size: ' + CFG.blockFontSize + 'px !important; line-height: 1.4 !important; }',
      '.pn-pf-block .pn-pf-line { margin: 2px 0 !important; }',
      '.pn-pf-block .pn-pf-discount { color: ' + CFG.blockDiscountColor + ' !important; font-weight: ' + (CFG.blockDiscountBold ? 600 : 400) + ' !important; }',
      '.pn-pf-block .pn-pf-installments { color: ' + CFG.blockInstallmentsColor + ' !important; }',
      '.pn-pf-block .pn-pf-message { color: #777 !important; font-size: ' + Math.max(10, CFG.blockFontSize - 1) + 'px !important; }',
      '.pn-pf-progress { margin: 10px 0 !important; font-size: ' + CFG.blockFontSize + 'px !important; }',
      '.pn-pf-progress-bar { height: 6px !important; border-radius: 999px !important; background: #eee !important; overflow: hidden !important; margin-top: 4px !important; }',
      '.pn-pf-progress-fill { height: 100% !important; background: ' + CFG.blockDiscountColor + ' !important; }',
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
      lines.push('<div class="pn-pf-line pn-pf-discount">$' + fmt(transferPrice) + ' ' + CFG.transferLabel + ' (' + transferPct + '% OFF)</div>');
    }
    if (cashPct > 0) {
      var cashPrice = price * (1 - cashPct / 100);
      lines.push('<div class="pn-pf-line pn-pf-discount">$' + fmt(cashPrice) + ' ' + CFG.cashLabel + ' (' + cashPct + '% OFF)</div>');
    }
    // Se muestra un solo plan: el de más cuotas cuyo "monto mínimo" el
    // precio de este producto alcanza a cubrir (12 si llega, sino 6, sino
    // 3, según los mínimos configurados) -- no se apilan todos los planes.
    var bestPlan = null;
    (CFG.installmentPlans || [])
      .filter(function(p) { return p && p.months; })
      .sort(function(a, b) { return b.months - a.months; })
      .some(function(p) {
        if (price >= (p.minAmount || 0)) { bestPlan = p; return true; }
        return false;
      });
    if (bestPlan) {
      var perMonth = price / bestPlan.months;
      if (bestPlan.interestFree) {
        lines.push('<div class="pn-pf-line pn-pf-installments">Hasta ' + bestPlan.months + ' ' + CFG.installmentsFreeLabel + ' $' + fmt(perMonth) + '</div>');
      } else {
        var rate = Number(bestPlan.interestRate) || 0;
        var withInterest = perMonth * (1 + rate / 100);
        lines.push('<div class="pn-pf-line pn-pf-installments">' + bestPlan.months + ' ' + CFG.installmentsPaidLabel + ' $' + fmt(withInterest) + '</div>');
      }
    }
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

  // Precio/precio tachado son del propio theme (no los crea este módulo);
  // <del> es la convención semántica más común para el precio anterior, el
  // resto son clases vistas en distintos themes de Tiendanube. Si no hay
  // tachado cerca, el producto no tiene descuento nativo y no se toca nada.
  // .js-compare-price-display es la clase real verificada contra una tienda
  // real (Alto Rancho, theme ipanema) tanto en listado como en PDP -- el
  // resto queda como respaldo genérico para otros themes.
  var OLD_PRICE_SELECTORS = ['.js-compare-price-display', 'del', 's', 'strike', '.js-price-before', '.price-old', '.old-price', '.js-original-price'];

  function findOldPriceNode(scope) {
    // Tiendanube deja el span del precio tachado en el HTML aunque el
    // producto NO tenga descuento (con style="display:none") -- sin este
    // chequeo de visibilidad, todos los productos se detectaban como "con
    // descuento".
    for (var i = 0; i < OLD_PRICE_SELECTORS.length; i++) {
      var candidates = scope.querySelectorAll(OLD_PRICE_SELECTORS[i]);
      for (var j = 0; j < candidates.length; j++) {
        if (isVisible(candidates[j])) return candidates[j];
      }
    }
    return null;
  }

  function colorizeDiscount(scope, priceNode) {
    if (!CFG.discountColorEnabled) return;
    // Busca el tachado cerca del precio (no en toda la página) subiendo un
    // par de niveles desde el precio, para no confundir con un <del> de
    // otra parte de la tarjeta/página.
    var searchScope = priceNode || scope;
    for (var i = 0; i < 2 && searchScope && searchScope.parentElement; i++) {
      searchScope = searchScope.parentElement;
    }
    var oldPriceNode = findOldPriceNode(searchScope || scope);
    if (!oldPriceNode) return;
    if (priceNode) priceNode.style.setProperty('color', CFG.discountColor, 'important');
    oldPriceNode.style.setProperty('color', CFG.discountColor, 'important');
  }

  function applyTo(scope, lsProduct) {
    var priceNode = findPriceNode(scope);
    colorizeDiscount(scope, priceNode);
    if (scope.querySelector('.pn-pf-block')) return;
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
    var existing = document.querySelector('.pn-pf-progress');
    var plans = (CFG.installmentPlans || []).filter(function(p) { return p && p.minAmount > 0; });
    var cart = window.LS && window.LS.cart;

    // '#cart'/'.cart' matcheaban el ícono del carrito (símbolo SVG oculto) o
    // el botón "Agregar al carrito" (ambos tienen clase "cart" en el theme
    // ipanema) antes de llegar al drawer real -- la barra se insertaba en un
    // nodo invisible. '.js-ajax-cart-list' es la lista real de ítems dentro
    // del modal de carrito estándar de Tiendanube (#modal-cart), verificado
    // contra Alto Rancho -- se inserta justo debajo de esa lista.
    var anchor = document.querySelector('#modal-cart .js-ajax-cart-list, .js-ajax-cart-list, [data-cart-total], .cart-summary, .cart-total, .js-cart-total');

    if (!plans.length || !cart || !anchor) {
      if (existing) existing.remove();
      return;
    }

    // LS.cart no tiene "total": el campo real es "subtotal", en centavos
    // (verificado contra Alto Rancho: $169.990 -> subtotal 16999000). Sin
    // este ajuste "total" quedaba siempre en 0 y la barra mostraba el monto
    // mínimo completo del plan en vez de lo que realmente falta.
    var total = (Number(cart.subtotal) || 0) / 100;
    if (total <= 0) {
      // cart.items a veces queda con entradas fantasma justo después de
      // vaciar el carrito (subtotal ya en 0 pero items.length todavía > 0)
      // -- no tiene sentido invitar a sumar cuotas sin interés a un carrito
      // vacío.
      if (existing) existing.remove();
      return;
    }
    plans.sort(function(a, b) { return a.minAmount - b.minAmount; });
    var next = null;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].minAmount > total) { next = plans[i]; break; }
    }
    if (!next) {
      if (existing) existing.remove();
      return;
    }

    var remaining = next.minAmount - total;
    var pct = Math.min(100, Math.round((total / next.minAmount) * 100));
    var html = 'Te faltan $' + fmt(remaining) + ' para acceder a ' + next.months + ' cuotas sin interés' +
      '<div class="pn-pf-progress-bar"><div class="pn-pf-progress-fill" style="width:' + pct + '%"></div></div>';

    // La barra vieja se quedaba con los números de la primera inserción y
    // nunca se actualizaba al cambiar el carrito (guard "ya existe, no
    // toco nada"). Ahora se actualiza el contenido en cada corrida en vez
    // de solo chequear si ya existe.
    if (existing) {
      existing.innerHTML = html;
      return;
    }
    var container = anchor.parentElement;
    if (!container) return;
    var bar = document.createElement('div');
    bar.className = 'pn-pf-progress';
    bar.innerHTML = html;
    container.insertBefore(bar, anchor.nextSibling);
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
