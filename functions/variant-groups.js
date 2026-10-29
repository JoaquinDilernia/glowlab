"use strict";

const {
  extractColorLabels,
  resolveColors,
  resolveTextures,
  resolveSwatchImage,
  sanitizePalette,
  collectDetectedColors,
} = require("./variant-colors");
const { isCombosEnabled, buildLoaderSnippet } = require("./combos");
const {
  isGiftRegistryEnabled,
  buildLoaderSnippet: buildGiftRegistryLoader,
} = require("./gift-registry");
const { getTechSheetLoader } = require("./tech-sheet");
const { getPromoTagLoader } = require("./promo-tag");
const { sanitizeSkuPrefixes, matchesSkuPrefix } = require("./sku-prefixes");

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

function diffScanWithPublished(scanResult, publishedGroups) {
  const published = new Map((publishedGroups || []).map((g) => [g.groupKey, g]));
  const newGroups = [];
  const groupsWithAdditions = [];
  const removedFromCatalog = [];

  // Todos los productIds que aparecieron en este escaneo, sea en un grupo o en
  // "sin agrupar". Un producto publicado que sigue en este set sigue existiendo
  // en el catalogo, aunque el algoritmo ya no lo agrupe automaticamente donde
  // estaba (ej. se asigno a mano a un grupo cuyo SKU no matchea) - no se marca
  // como "removido del catalogo" solo por eso.
  const allScannedIds = new Set();
  for (const g of scanResult.groups) {
    for (const p of g.products) allScannedIds.add(String(p.productId));
  }
  for (const p of scanResult.ungrouped) allScannedIds.add(String(p.productId));

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

    const missing = pub.products.filter((p) => !allScannedIds.has(String(p.productId)));
    if (missing.length) {
      removedFromCatalog.push({ groupKey: scanned.groupKey, title: pub.title, products: missing });
    }
  }

  for (const pub of publishedGroups || []) {
    const stillScanned = scanResult.groups.some((g) => g.groupKey === pub.groupKey);
    if (!stillScanned) {
      const missing = pub.products.filter((p) => !allScannedIds.has(String(p.productId)));
      if (missing.length) {
        removedFromCatalog.push({ groupKey: pub.groupKey, title: pub.title, products: missing });
      }
    }
  }

  return { newGroups, groupsWithAdditions, removedFromCatalog, ungrouped: scanResult.ungrouped };
}

function safeString(v) {
  return typeof v === "string" ? v : "";
}

const SAFE_HREF_PATTERN = /^(\/|https?:\/\/)/i;

function safeHref(url) {
  const s = safeString(url);
  return SAFE_HREF_PATTERN.test(s) ? s : "";
}

// hiddenProductIds: productos ocultos en la tienda (published: false). Se
// sacan de los siblings porque su link da 404; si el grupo queda con menos
// de 2 productos visibles no se muestra.
// colorSkuPrefixes: grupos que usan el circulo de color aunque el modo general
// sea "image" (colorMode en cada entrada).
function buildWidgetIndex(groups, palette, hiddenProductIds, colorSkuPrefixes) {
  const hidden = new Set((hiddenProductIds || []).map(String));
  const index = {};
  for (const group of groups || []) {
    if (group.hidden) continue;
    const products = (group.products || []).filter((p) => !hidden.has(String(p.productId)));
    if (products.length < 2) continue;
    const colorLabels = extractColorLabels(products.map((p) => p.name));
    for (const product of products) {
      index[String(product.productId)] = {
        groupKey: group.groupKey,
        colorMode: matchesSkuPrefix(group.groupKey, colorSkuPrefixes),
        siblings: products.map((p, i) => ({
          productId: String(p.productId),
          url: safeHref(p.url),
          image: safeString(p.image),
          colorName: colorLabels[i],
          colors: resolveColors(colorLabels[i], palette),
          textures: resolveTextures(colorLabels[i], palette),
          swatchImage: resolveSwatchImage(colorLabels[i], palette),
          active: String(p.productId) === String(product.productId),
        })),
      };
    }
  }
  return index;
}

const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PRODUCTS_PER_PAGE = 200;
const MAX_PAGES = 50;

async function fetchAllStoreProducts({ storeId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA };
  const out = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?page=${page}&per_page=${PRODUCTS_PER_PAGE}&fields=id,name,images,variants,canonical_url,published`,
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
      if (product.published === false) continue;
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

// Devuelve los ids de productos ocultos (published: false) de la tienda.
async function fetchHiddenProductIds({ storeId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA };
  const out = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?page=${page}&per_page=${PRODUCTS_PER_PAGE}&fields=id,published`,
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
      if (product.published === false) out.push(String(product.id));
    }

    if (items.length < PRODUCTS_PER_PAGE) break;
    page += 1;
  }

  return out;
}

function buildWidgetScript(store, cfg) {
  return `
/**
 * Grupos de Variantes
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
  var MOBILE_BREAKPOINT = 767;

  function maxVisibleSwatches() {
    return window.innerWidth <= MOBILE_BREAKPOINT ? 3 : 6;
  }

  function injectStyles() {
    if (document.getElementById('pn-vg-styles')) return;
    var s = document.createElement('style');
    s.id = 'pn-vg-styles';
    s.textContent = [
      '.pn-vg-row, .pn-vg-row * { box-sizing: border-box !important; }',
      '.pn-vg-row { display: flex !important; gap: 6px !important; flex-wrap: nowrap !important; align-items: center !important; margin: 8px 0 !important; }',
      // En la PDP se muestran todas las variantes (sin "+N"): se envuelve en
      // filas de hasta 6 en vez de una sola fila infinita que rompe el layout.
      '.pn-vg-row-wrap { flex-wrap: wrap !important; max-width: ' + (SWATCH_PX * 6 + 6 * 5) + 'px !important; }',
      '.pn-vg-swatch { display: inline-block !important; flex: none !important; width: ' + SWATCH_PX + 'px !important; height: ' + SWATCH_PX + 'px !important; border-radius: 50% !important; background-size: cover !important; background-position: center !important; border: 2px solid transparent !important; text-decoration: none !important; }',
      '.pn-vg-swatch.pn-vg-active { border-color: #111 !important; }',
      'a.pn-vg-swatch { cursor: pointer !important; }',
      // Modo color: el relleno va en un hijo con 2px de aire, asi el borde
      // del activo se ve aunque el color sea oscuro, y el filete interno
      // marca el contorno de los colores claros (blanco, tiza, crema).
      '.pn-vg-swatch-color { padding: 2px !important; }',
      '.pn-vg-fill { position: relative !important; display: block !important; width: 100% !important; height: 100% !important; border-radius: 50% !important; overflow: hidden !important; }',
      // El filete va en un ::after para quedar por encima de las capas.
      '.pn-vg-fill::after { content: "" !important; position: absolute !important; inset: 0 !important; border-radius: 50% !important; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15) !important; }',
      '.pn-vg-layer { position: absolute !important; inset: 0 !important; }',
      '.pn-vg-layer-2 { clip-path: polygon(100% 0, 100% 100%, 0 100%) !important; }',
      '.pn-vg-swatch-more { display: inline-flex !important; flex: none !important; align-items: center !important; justify-content: center !important; width: ' + SWATCH_PX + 'px !important; height: ' + SWATCH_PX + 'px !important; border-radius: 50% !important; background: rgba(0,0,0,0.06) !important; color: #666 !important; font-size: ' + Math.round(SWATCH_PX * 0.32) + 'px !important; font-weight: 600 !important; line-height: 1 !important; }',
    ].join('');
    document.head.appendChild(s);
  }

  // Texturas de material dibujadas con gradientes sobre el tono base, sin
  // imagenes: vetas de madera, brillo metalico, trama de rattan, carey.
  var TEXTURES = {
    // Dos tramas de vetas con angulos y pasos distintos: al cruzarse se
    // desparejan y no queda el rayado regular de una tela.
    wood: 'repeating-linear-gradient(94deg, rgba(0,0,0,0) 0 3px, rgba(0,0,0,0.12) 3px 4px, rgba(0,0,0,0) 4px 9px, rgba(0,0,0,0.07) 9px 11px), repeating-linear-gradient(87deg, rgba(255,255,255,0) 0 5px, rgba(255,255,255,0.08) 5px 7px, rgba(255,255,255,0) 7px 17px), linear-gradient(90deg, rgba(0,0,0,0.1), rgba(0,0,0,0) 35%, rgba(0,0,0,0.07) 70%, rgba(0,0,0,0))',
    metal: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 32%, rgba(0,0,0,0.2) 58%, rgba(255,255,255,0.35) 82%, rgba(0,0,0,0.12) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, rgba(0,0,0,0) 1px 2px)',
    rattan: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2) 0 1px, rgba(0,0,0,0) 1px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.2) 0 1px, rgba(0,0,0,0) 1px 4px)',
    carey: 'radial-gradient(ellipse 28% 22% at 28% 30%, rgba(25,12,4,0.85), rgba(25,12,4,0)), radial-gradient(ellipse 22% 30% at 72% 60%, rgba(25,12,4,0.75), rgba(25,12,4,0)), radial-gradient(ellipse 20% 14% at 40% 80%, rgba(25,12,4,0.65), rgba(25,12,4,0)), radial-gradient(ellipse 26% 20% at 55% 42%, rgba(214,146,54,0.65), rgba(214,146,54,0)), radial-gradient(ellipse 18% 16% at 80% 22%, rgba(214,146,54,0.6), rgba(214,146,54,0)), radial-gradient(ellipse 16% 20% at 16% 64%, rgba(214,146,54,0.55), rgba(214,146,54,0))',
  };

  function paint(hex, texture) {
    return TEXTURES[texture] ? TEXTURES[texture] + ', ' + hex : hex;
  }

  function loadIndex(cb) {
    if (INDEX) return cb(INDEX);
    fetch(DATA_URL).then(function(r) { return r.json(); }).then(function(data) {
      INDEX = data || {};
      cb(INDEX);
    }).catch(function() { INDEX = {}; cb(INDEX); });
  }

  function buildRow(entry, truncate) {
    var row = document.createElement('div');
    row.className = 'pn-vg-row' + (truncate === false ? ' pn-vg-row-wrap' : '');
    var siblings = entry.siblings;
    var maxVisible = maxVisibleSwatches();
    var visible = siblings;
    var hiddenCount = 0;
    if (truncate !== false && siblings.length > maxVisible) {
      visible = siblings.slice(0, maxVisible);
      // Si el propio producto (active) quedo fuera del recorte, se lo
      // canjea por el ultimo visible para que siempre se vea marcado.
      var activeIdx = -1;
      for (var i = 0; i < siblings.length; i++) {
        if (siblings[i].active) { activeIdx = i; break; }
      }
      if (activeIdx >= maxVisible) {
        visible[maxVisible - 1] = siblings[activeIdx];
      }
      hiddenCount = siblings.length - maxVisible;
    }
    visible.forEach(function(sib) {
      var el = document.createElement(sib.active ? 'span' : 'a');
      var colors = sib.colors || [];
      // Sin color detectado se cae a la foto, para no dejar un circulo vacio.
      var useColor = (CFG.swatchMode === 'color' || entry.colorMode === true) && colors.length > 0;
      el.className = 'pn-vg-swatch' + (useColor ? ' pn-vg-swatch-color' : '') + (sib.active ? ' pn-vg-active' : '');
      if (!sib.active) el.setAttribute('href', sib.url);
      if (sib.colorName) {
        el.setAttribute('title', sib.colorName);
        el.setAttribute('aria-label', sib.colorName);
      }
      if (useColor) {
        var fill = document.createElement('span');
        fill.className = 'pn-vg-fill';
        var textures = sib.textures || [];
        // Con foto subida en la paleta se muestra esa foto; el color de
        // atras queda de respaldo mientras carga.
        if (sib.swatchImage) {
          var photo = document.createElement('span');
          photo.className = 'pn-vg-layer';
          photo.style.background = 'url(' + sib.swatchImage + ') center / cover no-repeat, ' + colors[0];
          fill.appendChild(photo);
        } else colors.slice(0, 2).forEach(function(hex, i) {
          // Cada color va en su propia capa para que la textura no cruce la
          // diagonal del bicolor: el segundo ocupa el triangulo de abajo.
          var layer = document.createElement('span');
          layer.className = 'pn-vg-layer' + (i === 1 ? ' pn-vg-layer-2' : '');
          layer.style.background = paint(hex, textures[i]);
          fill.appendChild(layer);
        });
        el.appendChild(fill);
      } else if (sib.image) {
        el.style.backgroundImage = 'url(' + sib.image + ')';
      }
      row.appendChild(el);
    });
    if (hiddenCount > 0) {
      var more = document.createElement('span');
      more.className = 'pn-vg-swatch-more';
      more.textContent = '+' + hiddenCount;
      row.appendChild(more);
    }
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
    // En la PDP se muestran todas las variantes sin recorte ni "+N" (a
    // diferencia del listado, donde el espacio de la card es limitado).
    anchor.parentNode.insertBefore(buildRow(entry, false), anchor.nextSibling);
  }

  var LISTING_SELECTORS = ['[data-item-id]', '.product-item', '.item-product', '[data-product-id]'];

  var INFO_BLOCK_SELECTORS = ['[class*="item-description"]', '[class*="product-info"]', '[class*="item-info"]', '[class*="description"]'];

  function insertRowInCard(card, row) {
    // Insertar justo antes del bloque de nombre/precio (no al final de la
    // card) para que el swatch quede arriba de esos datos. Subir desde el
    // primer <img> hasta el hijo directo de la card no alcanza en themes con
    // carrusel de imagenes (la imagen tiene varios <img> hermanos) - se
    // busca directamente el bloque de info del producto.
    for (var i = 0; i < INFO_BLOCK_SELECTORS.length; i++) {
      var info = card.querySelector(INFO_BLOCK_SELECTORS[i]);
      if (info && info.parentNode) {
        info.parentNode.insertBefore(row, info);
        return;
      }
    }
    card.appendChild(row);
  }

  function runListing() {
    if (!CFG.showOnListing) return;
    var cards = [];
    for (var i = 0; i < LISTING_SELECTORS.length; i++) {
      var found = document.querySelectorAll(LISTING_SELECTORS[i]);
      // Se usa el selector con MAS coincidencias, no el primero que matchee
      // algo: '[data-item-id]' puede matchear items del carrito (0x0,
      // ajenos al grid de productos) antes de llegar al selector real.
      if (found.length > cards.length) cards = found;
    }
    cards.forEach(function(card) {
      if (card.querySelector('.pn-vg-row')) return;
      var id = card.getAttribute('data-item-id') || card.getAttribute('data-product-id');
      if (!id) return;
      var entry = INDEX[String(id)];
      if (!entry) return;
      insertRowInCard(card, buildRow(entry));
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

const COLLECTION = "promonube_variant_groups";
const TN_2025 = "https://api.tiendanube.com/2025-03";

// Script "Grupos de Variantes" registrado en Partners (Aplicaciones -> GlowLab #23137 -> Scripts).
const VARIANT_GROUPS_SCRIPT_ID = 10101;

// Piloto: solo Alto Rancho (minorista + mayorista) y la tienda demo.
// TODO: quitar allowlist cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ["2547699", "5320806", "6854698"];

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  swatchSize: "md",
  swatchMode: "image",
  // Grupos cuyo SKU empieza con alguno de estos prefijos usan el circulo de
  // color aunque swatchMode sea "image" (para probar en algunas lineas).
  colorSkuPrefixes: [],
  hideUnpublished: true,
  colorPalette: {},
  groups: [],
  ungrouped: [],
  lastScanAt: null,
};

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

const MAX_GROUPS = 1000;
const MAX_PRODUCTS_PER_GROUP = 500;

function isValidGroupProduct(p) {
  return (
    p &&
    typeof p === "object" &&
    (typeof p.productId === "string" || typeof p.productId === "number") &&
    typeof p.sku === "string" &&
    typeof p.name === "string"
  );
}

function isValidGroup(g) {
  return (
    g &&
    typeof g === "object" &&
    typeof g.groupKey === "string" &&
    g.groupKey.length > 0 &&
    typeof g.title === "string" &&
    Array.isArray(g.products) &&
    g.products.length <= MAX_PRODUCTS_PER_GROUP &&
    g.products.every(isValidGroupProduct) &&
    (g.excludedProductIds === undefined || Array.isArray(g.excludedProductIds))
  );
}

// Cada cuanto se re-consulta en Tiendanube que productos estan ocultos.
const HIDDEN_REFRESH_MS = 10 * 60 * 1000;

function registerVariantGroupsRoutes(app, { db, FieldValue, checkStoreActive }) {
  const hiddenRefreshes = new Map(); // storeId -> promesa en curso

  // Actualiza hiddenProductIds en Firestore. Una sola consulta por tienda a la vez.
  function refreshHiddenProducts(storeId) {
    const key = String(storeId);
    if (hiddenRefreshes.has(key)) return hiddenRefreshes.get(key);
    const job = (async () => {
      const storeDoc = await db.collection("promonube_stores").doc(key).get();
      const accessToken = storeDoc.exists ? storeDoc.data().accessToken : null;
      if (!accessToken) throw new Error("No hay token de acceso");
      const hiddenProductIds = await fetchHiddenProductIds({ storeId: key, accessToken });
      await db.collection(COLLECTION).doc(key).set(
        { hiddenProductIds, hiddenCheckedAt: Date.now() },
        { merge: true }
      );
      return hiddenProductIds;
    })().finally(() => hiddenRefreshes.delete(key));
    hiddenRefreshes.set(key, job);
    return job;
  }

  // Ocultos para el widget: la primera vez se espera la consulta; despues se
  // sirve la lista guardada y se refresca en segundo plano si esta vieja.
  async function getHiddenProductIds(storeId, cfg) {
    const checkedAt = typeof cfg.hiddenCheckedAt === "number" ? cfg.hiddenCheckedAt : 0;
    const stored = Array.isArray(cfg.hiddenProductIds) ? cfg.hiddenProductIds : [];
    if (!checkedAt) {
      try {
        return await refreshHiddenProducts(storeId);
      } catch (e) {
        console.error("[VariantGroups hidden]", e.message);
        return stored;
      }
    }
    if (Date.now() - checkedAt > HIDDEN_REFRESH_MS) {
      refreshHiddenProducts(storeId).catch((e) => console.error("[VariantGroups hidden]", e.message));
    }
    return stored;
  }

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
      // detectedColors no se persiste: se deriva de los grupos publicados.
      res.json({ success: true, config, detectedColors: collectDetectedColors(config.groups) });
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
        swatchMode: config.swatchMode === "color" ? "color" : "image",
        colorSkuPrefixes: sanitizeSkuPrefixes(config.colorSkuPrefixes),
        hideUnpublished: config.hideUnpublished !== false,
        colorPalette: sanitizePalette(config.colorPalette),
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
    // ungrouped puede venir en el body (el frontend todavia lo manda) pero se
    // ignora deliberadamente - ver comentario junto al write de abajo.
    const { storeId, groups } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!isAllowedStore(storeId)) {
      return res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
    }
    if (!Array.isArray(groups)) return res.status(400).json({ success: false, message: "groups requerido" });
    if (groups.length > MAX_GROUPS) {
      return res.status(400).json({ success: false, message: "Demasiados grupos" });
    }
    if (!groups.every(isValidGroup)) {
      return res.status(400).json({ success: false, message: "Formato de grupos inválido" });
    }

    try {
      await db.collection(COLLECTION).doc(String(storeId)).set(
        {
          groups,
          // ungrouped se re-deriva en cada /scan y no lo lee nadie de Firestore
          // (ver revision final del plan) - no tiene sentido persistirlo.
          ungrouped: [],
          lastScanAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      // Al publicar se refresca la lista de ocultos para que se vea al toque.
      refreshHiddenProducts(storeId).catch((e) => console.error("[VariantGroups hidden]", e.message));
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

  // GET /api/variant-groups-widget.js?store=X - script liviano, no lleva datos embebidos
  app.get("/api/variant-groups-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    if (!store || !isAllowedStore(store)) {
      return res.send("// Grupos de Variantes: no disponible");
    }

    try {
      if (!(await checkStoreActive(store))) {
        return res.send("// Grupos de Variantes: plan inactivo");
      }
      // Combos, Lista de regalos, la ficha tecnica y la etiqueta promo no tienen
      // script propio en Partners: se cargan desde este.
      const [combosOn, giftRegistryOn, techSheetLoader, promoTagLoader] = await Promise.all([
        isCombosEnabled(db, store),
        isGiftRegistryEnabled(db, store),
        getTechSheetLoader(db, store),
        getPromoTagLoader(db, store, { FieldValue }),
      ]);
      const combosLoader = (combosOn ? buildLoaderSnippet(store) : "") +
        (giftRegistryOn ? buildGiftRegistryLoader(store) : "") +
        techSheetLoader +
        promoTagLoader;
      const doc = await db.collection(COLLECTION).doc(String(store)).get();
      const cfg = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      if (cfg.enabled === false) {
        return res.send("// Grupos de Variantes: deshabilitado" + combosLoader);
      }
      res.send(
        combosLoader +
        buildWidgetScript(store, {
          showOnListing: cfg.showOnListing !== false,
          showOnPDP: cfg.showOnPDP !== false,
          swatchSize: cfg.swatchSize || "md",
          swatchMode: cfg.swatchMode === "color" ? "color" : "image",
        })
      );
    } catch (error) {
      console.error("[VariantGroups widget.js]", error);
      res.send("// Grupos de Variantes: error interno");
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
      const hiddenProductIds = cfg.hideUnpublished === false ? [] : await getHiddenProductIds(store, cfg);
      res.json(buildWidgetIndex(cfg.groups || [], cfg.colorPalette || {}, hiddenProductIds, sanitizeSkuPrefixes(cfg.colorSkuPrefixes)));
    } catch (error) {
      res.json({});
    }
  });
}

module.exports = {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
  diffScanWithPublished,
  buildWidgetIndex,
  sanitizeSkuPrefixes,
  fetchAllStoreProducts,
  fetchHiddenProductIds,
  isValidGroupProduct,
  isValidGroup,
  registerVariantGroupsRoutes,
};
