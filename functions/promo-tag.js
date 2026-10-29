"use strict";

// Etiqueta Promo: un cartel (ej. "MEGA CYBER") en la esquina superior derecha
// de la foto de ciertos productos, en el listado y en la ficha. Los productos
// salen de un Excel de precios que se sube en el panel: se elige la columna y
// el valor del evento, y aca se traducen esos SKUs a IDs de producto con el
// catalogo de Tiendanube (las cards del listado solo traen el ID). Viaja
// pegado al widget de Grupos de Variantes, como la ficha tecnica.
//
// Hay una segunda etiqueta ("cat", ej. "ULTIMAS UNIDADES") que funciona igual
// pero sus productos se eligen por categoria (con subcategorias) o a mano. Si
// un producto tiene las dos, se apilan en la esquina en vez de pisarse.
const COLLECTION = "promonube_promo_tag";

// Piloto: solo Alto Rancho (minorista + mayorista) y la tienda demo.
const ALLOWED_STORE_IDS = ["2547699", "5320806", "6854698"];

const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PRODUCTS_PER_PAGE = 200;
const MAX_PAGES = 100;
const MAX_SKUS = 10000;
const MAX_TEXT_LENGTH = 30;
const MAX_CATEGORIES = 50;
const MAX_MANUAL_PRODUCTS = 500;
// La etiqueta por categoria se recalcula sola cada tanto, para que los
// productos nuevos de la categoria tambien la lleven.
const CATALOG_REFRESH_MS = 6 * 60 * 60 * 1000;

// Fuentes que se pueden elegir; "inherit" usa la de la tienda.
const FONTS = ["inherit", "Poppins", "Montserrat", "Inter", "Oswald", "Bebas Neue", "Playfair Display"];
const SIZES = {
  sm: { font: 11, padY: 4, padX: 8 },
  md: { font: 13, padY: 5, padX: 10 },
  lg: { font: 15, padY: 7, padX: 13 },
};
// Borde en px; 0 = recto. Con MAX_RADIUS ya queda como pildora a cualquier tamaño.
const MAX_RADIUS = 30;
// En celular el cartel se achica a esta proporcion del tamaño elegido.
const MOBILE_SCALE = 0.6;

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

// docSuffix: el doc de Firestore es `${storeId}${docSuffix}`.
// order: lugar en la pila cuando un producto tiene las dos etiquetas.
const SLOTS = {
  promo: { docSuffix: "", order: 0, defaults: DEFAULT_CONFIG },
  cat: { docSuffix: "_cat", order: 1, defaults: { ...DEFAULT_CONFIG, text: "ÚLTIMAS UNIDADES" } },
};

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

function slotKey(slot) {
  return Object.prototype.hasOwnProperty.call(SLOTS, slot) ? slot : "promo";
}

function slotDoc(db, store, slot) {
  return db.collection(COLLECTION).doc(String(store) + SLOTS[slotKey(slot)].docSuffix);
}

function sanitizeStyle(config, defaults = DEFAULT_CONFIG) {
  const c = config || {};
  const text = String(c.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  return {
    enabled: c.enabled === true,
    text: text || defaults.text,
    bgColor: HEX_PATTERN.test(c.bgColor || "") ? c.bgColor.toLowerCase() : defaults.bgColor,
    textColor: HEX_PATTERN.test(c.textColor || "") ? c.textColor.toLowerCase() : defaults.textColor,
    font: FONTS.includes(c.font) ? c.font : defaults.font,
    size: SIZES[c.size] ? c.size : defaults.size,
    radius: Number.isFinite(Number(c.radius)) && c.radius !== "" && c.radius !== null
      ? Math.min(MAX_RADIUS, Math.max(0, Math.round(Number(c.radius))))
      : defaults.radius,
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

// Categorias / productos elegidos en el panel: { id, name[, image] }, sin repetir.
function sanitizeRefs(list, max, withImage) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const id = String((raw && raw.id) == null ? "" : raw.id).trim();
    if (!/^\d{1,20}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const ref = { id, name: String(raw.name || "").slice(0, 120) };
    if (withImage) ref.image = /^https:\/\//.test(raw.image || "") ? String(raw.image).slice(0, 500) : "";
    out.push(ref);
    if (out.length >= max) break;
  }
  return out;
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

// Las categorias elegidas mas todas sus subcategorias (a cualquier profundidad).
function expandCategoryIds(allCategories, selectedIds) {
  const children = new Map();
  for (const c of allCategories || []) {
    const parent = c.parent == null ? "" : String(c.parent);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(String(c.id));
  }
  const out = new Set();
  const stack = (selectedIds || []).map(String);
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) || []));
  }
  return out;
}

// Productos de esas categorias + los elegidos a mano, sin repetir.
function matchCategoriesToProducts(products, categoryIds, manualIds) {
  const out = new Set((manualIds || []).map(String));
  for (const product of products || []) {
    if ((product.categories || []).some((id) => categoryIds.has(String(id)))) out.add(String(product.id));
  }
  return [...out];
}

async function fetchCatalogPages({ storeId, accessToken, fetchImpl, path, fields }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA };
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/${path}?page=${page}&per_page=${PRODUCTS_PER_PAGE}&fields=${fields}`,
      { headers }
    );
    // TN responde 404 cuando se pide una pagina despues de la ultima
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`TN GET ${path} page ${page}: ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items);
    if (items.length < PRODUCTS_PER_PAGE) break;
  }
  return out;
}

async function fetchCatalogVariants(opts) {
  const items = await fetchCatalogPages({ ...opts, path: "products", fields: "id,variants" });
  return items.map((p) => ({ id: p.id, variants: (p.variants || []).map((v) => ({ sku: v.sku })) }));
}

async function fetchCatalogCategories(opts) {
  const items = await fetchCatalogPages({ ...opts, path: "products", fields: "id,categories" });
  return items.map((p) => ({ id: p.id, categories: (p.categories || []).map((c) => (c && c.id != null ? c.id : c)) }));
}

async function fetchStoreCategories(opts) {
  const items = await fetchCatalogPages({ ...opts, path: "categories", fields: "id,parent" });
  return items.map((c) => ({ id: c.id, parent: c.parent }));
}

async function getAccessToken(db, storeId) {
  const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
  return storeDoc.exists ? storeDoc.data().accessToken : null;
}

// Recalcula los productos de la etiqueta por categoria y los guarda.
async function resolveCatalogSlot({ db, FieldValue, fetchImpl, storeId, categories, products }) {
  const accessToken = await getAccessToken(db, storeId);
  if (!accessToken) throw new Error("La tienda no tiene token de Tiendanube");
  let productIds = products.map((p) => p.id);
  if (categories.length) {
    const opts = { storeId, accessToken, fetchImpl };
    const [allCategories, catalog] = await Promise.all([fetchStoreCategories(opts), fetchCatalogCategories(opts)]);
    const wanted = expandCategoryIds(allCategories, categories.map((c) => c.id));
    productIds = matchCategoriesToProducts(catalog, wanted, productIds);
  }
  const ref = slotDoc(db, storeId, "cat");
  await ref.set({
    categories,
    products,
    productIds,
    resolvedAt: Date.now(),
    updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date(),
  }, { merge: true });
  return ref;
}

function buildPromoTagLoader(store, style, productIds, slot = "promo") {
  const key = slotKey(slot);
  const s = sanitizeStyle(style, SLOTS[key].defaults);
  const size = SIZES[s.size];
  const ids = {};
  for (const id of productIds || []) ids[String(id)] = 1;
  const fontFamily = s.font === "inherit" ? "inherit" : `"${s.font}", sans-serif`;
  const fontHref = s.font === "inherit"
    ? ""
    : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
  // La pila de la esquina es comun a las dos etiquetas; cada una pone su cartel adentro.
  const css = [
    ".pn-pt-wrap { position: absolute !important; top: 10px !important; right: 10px !important; z-index: 100 !important;",
    " display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 6px !important; pointer-events: none !important; }",
    `.pn-pt-${key} { display: block !important; order: ${SLOTS[key].order} !important;`,
    ` background: ${s.bgColor} !important; color: ${s.textColor} !important;`,
    ` font-family: ${fontFamily} !important; font-size: ${size.font}px !important; font-weight: ${s.bold ? 700 : 400} !important;`,
    ` line-height: 1 !important; letter-spacing: 0.03em !important; padding: ${size.padY}px ${size.padX}px !important;`,
    ` border-radius: ${s.radius}px !important; white-space: nowrap !important; pointer-events: none !important; }`,
    // En celular las cards son angostas (2 por fila): el cartel va mas chico.
    "@media (max-width: 767px) {",
    " .pn-pt-wrap { top: 6px !important; right: 6px !important; gap: 4px !important; }",
    ` .pn-pt-${key} { font-size: ${Math.round(size.font * MOBILE_SCALE)}px !important;`,
    ` padding: ${Math.round(size.padY * MOBILE_SCALE)}px ${Math.round(size.padX * MOBILE_SCALE)}px !important;`,
    ` border-radius: ${Math.round(s.radius * MOBILE_SCALE)}px !important; }`,
    "}",
  ].join("");
  // JSON dentro de un <script>/JS: se escapa "<" para que un texto como
  // "</script>" no corte nada.
  const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

  return `
/* Etiqueta Promo (${key}) - tienda ${store} */
(function() {
  'use strict';
  var SLOT = ${json(key)};
  window.__pnPromoTagLoaded = window.__pnPromoTagLoaded || {};
  if (window.__pnPromoTagLoaded[SLOT]) return;
  window.__pnPromoTagLoaded[SLOT] = true;

  var IDS = ${json(ids)};
  var TEXT = ${json(s.text)};
  var SHOW_LISTING = ${s.showOnListing};
  var SHOW_PDP = ${s.showOnPDP};
  var FONT_HREF = ${json(fontHref)};
  var CSS = ${json(css)};
  var TAG_CLASS = 'pn-pt-' + SLOT;

  function injectStyles() {
    if (document.getElementById('pn-pt-styles-' + SLOT)) return;
    if (FONT_HREF) {
      var font = document.createElement('link');
      font.rel = 'stylesheet';
      font.href = FONT_HREF;
      document.head.appendChild(font);
    }
    var st = document.createElement('style');
    st.id = 'pn-pt-styles-' + SLOT;
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
    if (!container || container.querySelector('.' + TAG_CLASS)) return;
    // Ancho 0 = todavia sin layout (carrusel oculto): se etiqueta igual.
    var width = container.offsetWidth;
    if (isVariantSwatch(container) || (width > 0 && width < MIN_IMAGE_PX)) return;
    if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    var wrap = container.querySelector('.pn-pt-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'pn-pt-wrap';
      container.appendChild(wrap);
    }
    var tag = document.createElement('span');
    tag.className = TAG_CLASS;
    tag.textContent = TEXT;
    wrap.appendChild(tag);
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

// Recalculos en curso, para no lanzar dos a la vez por la misma tienda.
const refreshing = new Set();

// La etiqueta por categoria se recalcula en segundo plano si quedo vieja;
// mientras tanto se sirve la lista que ya estaba.
function refreshCatalogSlotIfStale({ db, FieldValue, fetchImpl }, store, data) {
  if (!Array.isArray(data.categories) || !data.categories.length) return;
  if (Date.now() - (data.resolvedAt || 0) < CATALOG_REFRESH_MS || refreshing.has(store)) return;
  refreshing.add(store);
  resolveCatalogSlot({
    db, FieldValue, fetchImpl, storeId: store,
    categories: data.categories, products: Array.isArray(data.products) ? data.products : [],
  })
    .catch((e) => console.error("[PromoTag cat refresh]", store, e.message))
    .finally(() => refreshing.delete(store));
}

// Script para pegar al widget de variantes, o "" si esta apagado o sin productos.
async function getPromoTagLoader(db, store, { FieldValue, fetchImpl } = {}) {
  if (!isAllowedStore(store)) return "";
  const docs = await Promise.all(Object.keys(SLOTS).map((slot) => slotDoc(db, store, slot).get()));
  let out = "";
  Object.keys(SLOTS).forEach((slot, i) => {
    if (!docs[i].exists) return;
    const data = docs[i].data();
    if (data.enabled !== true) return;
    if (slot === "cat") refreshCatalogSlotIfStale({ db, FieldValue, fetchImpl }, String(store), data);
    if (!Array.isArray(data.productIds) || !data.productIds.length) return;
    out += buildPromoTagLoader(store, data, data.productIds, slot);
  });
  return out;
}

// Lo que ve el panel: estilo + resumen de la carga (no la lista entera).
function publicConfig(data, slot = "promo") {
  const d = data || {};
  const key = slotKey(slot);
  const base = {
    ...sanitizeStyle({ ...SLOTS[key].defaults, ...d }, SLOTS[key].defaults),
    productCount: Array.isArray(d.productIds) ? d.productIds.length : 0,
  };
  if (key === "cat") {
    return {
      ...base,
      categories: Array.isArray(d.categories) ? d.categories : [],
      products: Array.isArray(d.products) ? d.products : [],
      resolvedAt: d.resolvedAt || null,
    };
  }
  return {
    ...base,
    source: d.source || null,
    skuCount: Array.isArray(d.skus) ? d.skus.length : 0,
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

  // GET /api/promo-tag-config?storeId=X[&slot=cat]
  app.get("/api/promo-tag-config", async (req, res) => {
    const { storeId } = req.query;
    const slot = slotKey(req.query.slot);
    if (!guard(storeId, res)) return;
    try {
      const doc = await slotDoc(db, storeId, slot).get();
      let data = doc.exists ? doc.data() : null;
      // La etiqueta nueva arranca con el diseño de la promo (mismos colores),
      // con su propio texto y apagada.
      if (!data && slot !== "promo") {
        const promo = await slotDoc(db, storeId, "promo").get();
        if (promo.exists) {
          data = { ...sanitizeStyle(promo.data()), text: SLOTS[slot].defaults.text, enabled: false };
        }
      }
      res.json({ success: true, config: publicConfig(data, slot), fonts: FONTS });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/promo-tag-config - solo el estilo y el interruptor
  app.post("/api/promo-tag-config", async (req, res) => {
    const { storeId, config } = req.body || {};
    const slot = slotKey((req.body || {}).slot);
    if (!guard(storeId, res)) return;
    if (!config || typeof config !== "object") {
      return res.status(400).json({ success: false, message: "config requerido" });
    }
    try {
      const ref = slotDoc(db, storeId, slot);
      await ref.set({ ...sanitizeStyle(config, SLOTS[slot].defaults), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const doc = await ref.get();
      res.json({ success: true, config: publicConfig(doc.data(), slot) });
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
      const accessToken = await getAccessToken(db, storeId);
      if (!accessToken) return res.status(400).json({ success: false, message: "La tienda no tiene token de Tiendanube" });

      const products = await fetchCatalogVariants({ storeId, accessToken, fetchImpl });
      const { productIds, unmatched } = matchSkusToProducts(products, clean);
      const src = source && typeof source === "object" ? source : {};
      const ref = slotDoc(db, storeId, "promo");
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

  // POST /api/promo-tag-catalog - categorias y productos de la etiqueta "cat";
  // se recalcula la lista de productos con el catalogo actual.
  app.post("/api/promo-tag-catalog", async (req, res) => {
    const { storeId } = req.body || {};
    if (!guard(storeId, res)) return;
    const categories = sanitizeRefs((req.body || {}).categories, MAX_CATEGORIES, false);
    const products = sanitizeRefs((req.body || {}).products, MAX_MANUAL_PRODUCTS, true);
    try {
      const ref = await resolveCatalogSlot({ db, FieldValue, fetchImpl, storeId: String(storeId), categories, products });
      const doc = await ref.get();
      res.json({ success: true, config: publicConfig(doc.data(), "cat") });
    } catch (error) {
      console.error("[PromoTag catalog]", error);
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
  sanitizeRefs,
  matchSkusToProducts,
  expandCategoryIds,
  matchCategoriesToProducts,
  fetchCatalogVariants,
  FONTS,
};
