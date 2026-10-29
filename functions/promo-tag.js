"use strict";

// Etiqueta Promo: un cartel (ej. "MEGA CYBER") en la esquina superior derecha
// de la foto de ciertos productos, en el listado y en la ficha. Los productos
// salen de un Excel de precios que se sube en el panel: se elige la columna y
// el valor del evento, y aca se traducen esos SKUs a IDs de producto con el
// catalogo de Tiendanube (las cards del listado solo traen el ID). Viaja
// pegado al widget de Grupos de Variantes, como la ficha tecnica.
const COLLECTION = "promonube_promo_tag";

// Piloto: solo Alto Rancho (minorista + mayorista) y la tienda demo.
const ALLOWED_STORE_IDS = ["2547699", "5320806", "6854698"];

const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PRODUCTS_PER_PAGE = 200;
const MAX_PAGES = 100;
const MAX_SKUS = 10000;
const MAX_TEXT_LENGTH = 30;

// Fuentes que se pueden elegir; "inherit" usa la de la tienda.
const FONTS = ["inherit", "Poppins", "Montserrat", "Inter", "Oswald", "Bebas Neue", "Playfair Display"];
const SIZES = {
  sm: { font: 11, padY: 4, padX: 8 },
  md: { font: 13, padY: 5, padX: 10 },
  lg: { font: 15, padY: 7, padX: 13 },
};
// Borde en px; 0 = recto. Con MAX_RADIUS ya queda como pildora a cualquier tamaño.
const MAX_RADIUS = 30;

const DEFAULT_CONFIG = {
  enabled: false,
  text: "MEGA CYBER",
  bgColor: "#111111",
  textColor: "#ffffff",
  font: "Poppins",
  size: "md",
  radius: 4,
  bold: true,
  showOnListing: true,
  showOnPDP: true,
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

function sanitizeStyle(config) {
  const c = config || {};
  const text = String(c.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  return {
    enabled: c.enabled === true,
    text: text || DEFAULT_CONFIG.text,
    bgColor: HEX_PATTERN.test(c.bgColor || "") ? c.bgColor.toLowerCase() : DEFAULT_CONFIG.bgColor,
    textColor: HEX_PATTERN.test(c.textColor || "") ? c.textColor.toLowerCase() : DEFAULT_CONFIG.textColor,
    font: FONTS.includes(c.font) ? c.font : DEFAULT_CONFIG.font,
    size: SIZES[c.size] ? c.size : DEFAULT_CONFIG.size,
    radius: Number.isFinite(Number(c.radius)) && c.radius !== "" && c.radius !== null
      ? Math.min(MAX_RADIUS, Math.max(0, Math.round(Number(c.radius))))
      : DEFAULT_CONFIG.radius,
    bold: c.bold !== false,
    showOnListing: c.showOnListing !== false,
    showOnPDP: c.showOnPDP !== false,
  };
}

// SKUs del Excel: mayuscula, sin espacios, sin repetir.
function sanitizeSkus(list) {
  const out = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const sku = String(raw == null ? "" : raw).trim().toUpperCase();
    if (sku && sku.length <= 64) out.add(sku);
    if (out.size >= MAX_SKUS) break;
  }
  return [...out];
}

// Un producto lleva la etiqueta si cualquiera de sus variantes tiene un SKU
// de la lista. Devuelve los IDs y los SKUs que no aparecen en el catalogo.
function matchSkusToProducts(products, skus) {
  const wanted = new Set(skus);
  const found = new Set();
  const productIds = [];
  for (const product of products || []) {
    let hit = false;
    for (const variant of product.variants || []) {
      const sku = String(variant.sku || "").trim().toUpperCase();
      if (sku && wanted.has(sku)) {
        found.add(sku);
        hit = true;
      }
    }
    if (hit) productIds.push(String(product.id));
  }
  return { productIds, unmatched: skus.filter((s) => !found.has(s)) };
}

async function fetchCatalogVariants({ storeId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA };
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?page=${page}&per_page=${PRODUCTS_PER_PAGE}&fields=id,variants`,
      { headers }
    );
    // TN responde 404 cuando se pide una pagina despues de la ultima
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`TN GET products page ${page}: ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    for (const p of items) {
      out.push({ id: p.id, variants: (p.variants || []).map((v) => ({ sku: v.sku })) });
    }
    if (items.length < PRODUCTS_PER_PAGE) break;
  }
  return out;
}

function buildPromoTagLoader(store, style, productIds) {
  const s = sanitizeStyle(style);
  const size = SIZES[s.size];
  const ids = {};
  for (const id of productIds || []) ids[String(id)] = 1;
  const fontFamily = s.font === "inherit" ? "inherit" : `"${s.font}", sans-serif`;
  const fontHref = s.font === "inherit"
    ? ""
    : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
  const css = [
    ".pn-pt { position: absolute !important; top: 10px !important; right: 10px !important; z-index: 100 !important;",
    ` background: ${s.bgColor} !important; color: ${s.textColor} !important;`,
    ` font-family: ${fontFamily} !important; font-size: ${size.font}px !important; font-weight: ${s.bold ? 700 : 400} !important;`,
    ` line-height: 1 !important; letter-spacing: 0.03em !important; padding: ${size.padY}px ${size.padX}px !important;`,
    ` border-radius: ${s.radius}px !important; white-space: nowrap !important; pointer-events: none !important; }`,
  ].join("");
  // JSON dentro de un <script>/JS: se escapa "<" para que un texto como
  // "</script>" no corte nada.
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

  return `
/* Etiqueta Promo - tienda ${store} */
(function() {
  'use strict';
  if (window.__pnPromoTagLoaded) return;
  window.__pnPromoTagLoaded = true;

  var IDS = ${json(ids)};
  var TEXT = ${json(s.text)};
  var SHOW_LISTING = ${s.showOnListing};
  var SHOW_PDP = ${s.showOnPDP};
  var FONT_HREF = ${json(fontHref)};
  var CSS = ${json(css)};

  function injectStyles() {
    if (document.getElementById('pn-pt-styles')) return;
    if (FONT_HREF) {
      var font = document.createElement('link');
      font.rel = 'stylesheet';
      font.href = FONT_HREF;
      document.head.appendChild(font);
    }
    var st = document.createElement('style');
    st.id = 'pn-pt-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // El cartel va en el contenedor de la foto, al lado del slot top_right que
  // deja el theme (no adentro: NubeSDK puede re-renderizar ese slot).
  // Nunca en los circulos de variantes (tambien usan fotos): se descarta
  // cualquier contenedor dentro de la fila de swatches o chico como un swatch.
  var MIN_IMAGE_PX = 80;
  function isVariantSwatch(el) {
    for (var node = el; node && node !== document.body; node = node.parentNode) {
      var cls = typeof node.className === 'string' ? node.className : '';
      if (/\\bpn-vg-(row|swatch)\\b/.test(cls) || /\\b(js-insta-variant|item-colors|variant-thumb|swatch)/i.test(cls)) return true;
    }
    return false;
  }

  function addTag(container) {
    if (!container || container.querySelector('.pn-pt')) return;
    // Ancho 0 = todavia sin layout (carrusel oculto): se etiqueta igual.
    var width = container.offsetWidth;
    if (isVariantSwatch(container) || (width > 0 && width < MIN_IMAGE_PX)) return;
    if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    var tag = document.createElement('span');
    tag.className = 'pn-pt';
    tag.textContent = TEXT;
    container.appendChild(tag);
  }

  function runListing() {
    var slots = document.querySelectorAll('[data-nubesdk-slot="product_grid_item_image_top_right"]');
    for (var i = 0; i < slots.length; i++) {
      if (IDS[slots[i].getAttribute('data-nubesdk-slot-pick')]) addTag(slots[i].parentNode);
    }
    // Themes sin slots: se busca la card por su ID y la foto adentro.
    if (slots.length) return;
    var cards = document.querySelectorAll('[data-product-id]');
    for (var j = 0; j < cards.length; j++) {
      if (!IDS[cards[j].getAttribute('data-product-id')]) continue;
      addTag(cards[j].querySelector('.product-item-image-container, [class*="item-image"]'));
    }
  }

  function runPDP() {
    if (!IDS[String(window.LS.product.id)]) return;
    var slot = document.querySelector('[data-nubesdk-slot="product_detail_image_top_right"]');
    addTag(slot ? slot.parentNode : document.querySelector('.product-images-slider, .js-product-images'));
  }

  function run() {
    injectStyles();
    if (window.LS && window.LS.product && window.LS.product.id) {
      if (SHOW_PDP) runPDP();
      // En la ficha tambien hay grillas (relacionados): se etiquetan igual.
    }
    if (SHOW_LISTING) runListing();
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  // Scroll infinito, filtros y carruseles agregan cards despues.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
`;
}

// Script para pegar al widget de variantes, o "" si esta apagado o sin productos.
async function getPromoTagLoader(db, store) {
  if (!isAllowedStore(store)) return "";
  const doc = await db.collection(COLLECTION).doc(String(store)).get();
  if (!doc.exists) return "";
  const data = doc.data();
  if (data.enabled !== true || !Array.isArray(data.productIds) || !data.productIds.length) return "";
  return buildPromoTagLoader(store, data, data.productIds);
}

// Lo que ve el panel: estilo + resumen de la carga (no la lista entera).
function publicConfig(data) {
  const d = data || {};
  return {
    ...sanitizeStyle({ ...DEFAULT_CONFIG, ...d }),
    source: d.source || null,
    skuCount: Array.isArray(d.skus) ? d.skus.length : 0,
    productCount: Array.isArray(d.productIds) ? d.productIds.length : 0,
    unmatchedSample: Array.isArray(d.unmatched) ? d.unmatched.slice(0, 30) : [],
    unmatchedCount: Array.isArray(d.unmatched) ? d.unmatched.length : 0,
  };
}

function registerPromoTagRoutes(app, { db, FieldValue, fetchImpl }) {
  function guard(storeId, res) {
    if (!storeId) {
      res.status(400).json({ success: false, message: "storeId requerido" });
      return false;
    }
    if (!isAllowedStore(storeId)) {
      res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
      return false;
    }
    return true;
  }

  // GET /api/promo-tag-config?storeId=X
  app.get("/api/promo-tag-config", async (req, res) => {
    const { storeId } = req.query;
    if (!guard(storeId, res)) return;
    try {
      const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
      res.json({ success: true, config: publicConfig(doc.exists ? doc.data() : null), fonts: FONTS });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/promo-tag-config - solo el estilo y el interruptor
  app.post("/api/promo-tag-config", async (req, res) => {
    const { storeId, config } = req.body || {};
    if (!guard(storeId, res)) return;
    if (!config || typeof config !== "object") {
      return res.status(400).json({ success: false, message: "config requerido" });
    }
    try {
      const ref = db.collection(COLLECTION).doc(String(storeId));
      await ref.set({ ...sanitizeStyle(config), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const doc = await ref.get();
      res.json({ success: true, config: publicConfig(doc.data()) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/promo-tag-skus - reemplaza la lista de productos con los SKUs del Excel
  app.post("/api/promo-tag-skus", async (req, res) => {
    const { storeId, skus, source } = req.body || {};
    if (!guard(storeId, res)) return;
    const clean = sanitizeSkus(skus);
    if (!clean.length) return res.status(400).json({ success: false, message: "No hay SKUs para cargar" });
    try {
      const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
      const accessToken = storeDoc.exists ? storeDoc.data().accessToken : null;
      if (!accessToken) return res.status(400).json({ success: false, message: "La tienda no tiene token de Tiendanube" });

      const products = await fetchCatalogVariants({ storeId, accessToken, fetchImpl });
      const { productIds, unmatched } = matchSkusToProducts(products, clean);
      const src = source && typeof source === "object" ? source : {};
      const ref = db.collection(COLLECTION).doc(String(storeId));
      await ref.set({
        skus: clean,
        productIds,
        unmatched,
        source: {
          fileName: String(src.fileName || "").slice(0, 120),
          column: String(src.column || "").slice(0, 60),
          value: String(src.value || "").slice(0, 60),
          loadedAt: Date.now(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      const doc = await ref.get();
      res.json({ success: true, config: publicConfig(doc.data()) });
    } catch (error) {
      console.error("[PromoTag skus]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

module.exports = {
  buildPromoTagLoader,
  getPromoTagLoader,
  registerPromoTagRoutes,
  sanitizeStyle,
  sanitizeSkus,
  matchSkusToProducts,
  fetchCatalogVariants,
  FONTS,
};
