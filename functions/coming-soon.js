"use strict";

// Módulo "Próximamente" (Coming Soon). Aislado, no comparte estado con otros módulos.
// Patrón calcado de price-financing.js / search.js.

const COLLECTION = "promonube_coming_soon";

// Id numérico del script "Próximamente" registrado en Tiendanube Partners
// (Aplicaciones → GlowLab #23137 → Scripts).
const COMING_SOON_SCRIPT_ID = 10094;

// launchDate se guarda como 'YYYY-MM-DDTHH:mm:ss' y se interpreta como hora de
// Argentina (UTC-3, sin horario de verano).
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

const DEFAULT_STYLE = {
  badgeText: "PRÓXIMAMENTE",
  badgeShape: "ribbon",
  badgePosition: "top-left",
  badgeBg: "#111111",
  badgeTextColor: "#ffffff",
  badgeFontFamily: "inherit",
  badgeFontSize: 12,
  badgeUppercase: true,
  priceReplaceText: "Disponible pronto",
  priceReplaceColor: "#111111",
  priceReplaceFontSize: 14,
  priceShowDate: true,
  countdownEnabled: true,
  countdownLayout: "boxes",
  countdownUnits: ["days", "hours", "minutes", "seconds"],
  countdownDigitsColor: "#111111",
  countdownLabelsColor: "#777777",
  countdownAccentColor: "#111111",
  countdownFontFamily: "inherit",
  countdownSize: "md",
  countdownHeading: "Lanzamiento en",
  notifyEnabled: true,
  notifyHeading: "¿Querés que te avisemos?",
  notifyPlaceholder: "Tu email",
  notifyButtonText: "Avisarme",
  notifySuccessText: "¡Listo! Te avisamos cuando esté disponible.",
  notifyBg: "#f5f5f5",
  notifyTextColor: "#111111",
  notifyButtonBg: "#111111",
  notifyButtonTextColor: "#ffffff",
};

const DEFAULT_CONFIG = {
  enabled: false,
  style: DEFAULT_STYLE,
  categories: [],
  products: [],
};

const LAUNCH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseLaunchDate(value) {
  if (typeof value !== "string") return null;
  const m = value.match(LAUNCH_DATE_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (Number.isNaN(utc)) return null;
  return utc + AR_OFFSET_MS; // hora AR -> epoch UTC
}

function isPastLaunch(launchDate, nowMs) {
  const t = parseLaunchDate(launchDate);
  if (t === null) return false;
  return t <= nowMs;
}

function validateLaunchDate(value, nowMs) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "Falta la fecha de lanzamiento" };
  }
  const t = parseLaunchDate(value);
  if (t === null) return { ok: false, error: "Formato de fecha inválido" };
  if (t <= nowMs) return { ok: false, error: "La fecha de lanzamiento ya pasó" };
  return { ok: true, error: null };
}

function mergeConfig(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: r.enabled === true,
    style: { ...DEFAULT_STYLE, ...(r.style && typeof r.style === "object" ? r.style : {}) },
    categories: Array.isArray(r.categories) ? r.categories : [],
    products: Array.isArray(r.products) ? r.products : [],
  };
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toIso(createdAt) {
  if (!createdAt) return "";
  if (typeof createdAt === "string") return createdAt;
  if (createdAt instanceof Date) return createdAt.toISOString();
  if (typeof createdAt._seconds === "number") return new Date(createdAt._seconds * 1000).toISOString();
  if (typeof createdAt.toDate === "function") return createdAt.toDate().toISOString();
  return "";
}

function leadsToCsv(rows) {
  const header = "producto_id,producto_nombre,email,fecha";
  const body = (rows || []).map((r) =>
    [csvCell(r.productId), csvCell(r.productName), csvCell(r.email), csvCell(toIso(r.createdAt))].join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

function snapshotVariants(currentVariants) {
  return (currentVariants || []).map((v) => ({
    variantId: String(v.id),
    stock: Number(v.stock) || 0,
    stockManagement: v.stock_management !== false,
  }));
}

function buildStockPausePlan(currentVariants) {
  return (currentVariants || []).map((v) => ({
    variantId: String(v.id),
    stock: 0,
    stockManagement: true,
  }));
}

function buildStockRestorePlan(snapshot, currentVariants) {
  const currentById = new Map((currentVariants || []).map((v) => [String(v.id), v]));
  const plan = [];
  for (const snap of snapshot || []) {
    const cur = currentById.get(String(snap.variantId));
    if (!cur) continue; // variante borrada
    const curStock = Number(cur.stock) || 0;
    if (curStock !== 0) continue; // el dueño la editó a mano
    plan.push({ variantId: String(snap.variantId), stock: snap.stock, stockManagement: snap.stockManagement });
  }
  return plan;
}

function diffProducts(prevProducts, nextProducts) {
  const prevById = new Map((prevProducts || []).map((p) => [String(p.productId), p]));
  const nextById = new Map((nextProducts || []).map((p) => [String(p.productId), p]));

  const toPause = [];
  for (const [id, np] of nextById) {
    const pp = prevById.get(id);
    if (!pp) { toPause.push(id); continue; }
    if (pp.status === "launched" && np.status === "scheduled") toPause.push(id);
  }

  const toRestore = [];
  for (const [id, pp] of prevById) {
    if (pp.status === "scheduled" && !nextById.has(id)) toRestore.push(id);
  }

  return { toPause, toRestore };
}

function pickLocalized(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.es || Object.values(value)[0] || "";
  return String(value);
}

function expandCategoryToProducts(categoryProducts, opts) {
  const existing = opts.existingIds || new Set();
  const out = [];
  for (const p of categoryProducts || []) {
    const id = String(p.id);
    if (existing.has(id)) continue;
    out.push({
      productId: id,
      productName: pickLocalized(p.name),
      productImage: (p.images && p.images[0] && (p.images[0].src || p.images[0])) || "",
      launchDate: opts.launchDate,
      message: opts.message || "",
      source: "category",
      sourceCategoryId: String(opts.categoryId),
      status: "scheduled",
      stockSnapshot: [],
      pausedAt: null,
      launchedAt: null,
      lastError: null,
    });
  }
  return out;
}

function propagateCategoryDate(products, categoryId, newDate) {
  return (products || []).map((p) =>
    p.source === "category" && String(p.sourceCategoryId) === String(categoryId) && p.status !== "launched"
      ? { ...p, launchDate: newDate }
      : p
  );
}

function shapeWidgetProducts(products, nowMs) {
  return (products || [])
    .filter((p) => p.status === "scheduled" && !isPastLaunch(p.launchDate, nowMs))
    .map((p) => ({ productId: String(p.productId), launchDate: p.launchDate, message: p.message || "" }));
}

const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";

function createTiendanubeClient({ storeId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { "Authentication": `bearer ${accessToken}`, "User-Agent": TN_UA, "Content-Type": "application/json" };

  async function getProductVariants(productId) {
    const res = await doFetch(`${TN_V1}/${storeId}/products/${productId}`, { headers });
    if (!res.ok) {
      const err = new Error(`TN GET product ${productId}: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return Array.isArray(data.variants) ? data.variants : [];
  }

  async function putVariant(productId, variantId, { stock, stockManagement }) {
    const res = await doFetch(`${TN_V1}/${storeId}/products/${productId}/variants/${variantId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ stock, stock_management: stockManagement }),
    });
    if (!res.ok) {
      const err = new Error(`TN PUT variant ${variantId}: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  return { getProductVariants, putVariant };
}

async function applyStockPlan(client, productId, plan) {
  let applied = 0;
  const errors = [];
  for (const item of plan) {
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await client.putVariant(productId, item.variantId, item);
        applied++;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // No reintento si es error HTTP (con .status); solo reintenta errores de transporte
        if (e.status !== undefined) break;
      }
    }
    if (lastErr) errors.push({ variantId: item.variantId, message: lastErr.message });
  }
  return { applied, errors };
}

function cloneConfig(config) {
  return {
    ...config,
    products: (config.products || []).map((p) => ({
      ...p,
      stockSnapshot: (p.stockSnapshot || []).map((s) => ({ ...s })),
    })),
  };
}

async function pauseProductInConfig(config, productId, client) {
  const next = cloneConfig(config);
  const idx = next.products.findIndex((p) => String(p.productId) === String(productId));
  if (idx === -1) return next;
  try {
    const current = await client.getProductVariants(productId);
    next.products[idx].stockSnapshot = snapshotVariants(current);
    const plan = buildStockPausePlan(current);
    const result = await applyStockPlan(client, productId, plan);
    next.products[idx].status = "scheduled";
    next.products[idx].pausedAt = new Date().toISOString();
    next.products[idx].lastError = result.errors.length
      ? `No se pudieron pausar ${result.errors.length} variante(s): ${result.errors.map((e) => e.variantId).join(", ")}`
      : null;
  } catch (e) {
    if (e.status === 404) { next.products.splice(idx, 1); return next; }
    next.products[idx].lastError = e.message;
  }
  return next;
}

async function restoreProductInConfig(config, productId, client) {
  const next = cloneConfig(config);
  const idx = next.products.findIndex((p) => String(p.productId) === String(productId));
  if (idx === -1) return next;
  try {
    const current = await client.getProductVariants(productId);
    const plan = buildStockRestorePlan(next.products[idx].stockSnapshot || [], current);
    const result = await applyStockPlan(client, productId, plan);
    next.products[idx].status = "launched";
    next.products[idx].launchedAt = new Date().toISOString();
    next.products[idx].lastError = result.errors.length
      ? `No se pudieron restaurar ${result.errors.length} variante(s): ${result.errors.map((e) => e.variantId).join(", ")}`
      : null;
  } catch (e) {
    if (e.status === 404) { next.products.splice(idx, 1); return next; }
    next.products[idx].lastError = e.message;
  }
  return next;
}

async function reconcileStore({ config, client, nowMs }) {
  let working = config;
  let changed = false;
  const due = (config.products || []).filter(
    (p) => p.status === "scheduled" && isPastLaunch(p.launchDate, nowMs)
  );
  for (const p of due) {
    working = await restoreProductInConfig(working, p.productId, client);
    changed = true;
  }
  return { config: working, changed };
}

// ---------------------------------------------------------------------------
// Widget servido a la tienda. Bundle sin ningún branding ("PromoNube"/"GlowLab"):
// el único literal permitido es el hostname del API base.
// ---------------------------------------------------------------------------

function buildWidgetScript(store, payload) {
  var data = {
    store: String(store),
    apiBase: payload.apiBase,
    style: payload.style,
    products: payload.products,
    offsetMs: AR_OFFSET_MS,
  };
  return `
/* Coming Soon widget. Store: ${store} */
(function () {
  'use strict';
  if (window.__pnComingSoonLoaded) return;
  if (/\\/checkout(\\/|$|\\?)/.test(location.pathname + location.search)) return;
  window.__pnComingSoonLoaded = true;

  var D = ${JSON.stringify(data)};
  var S = D.style;
  var TARGET = {};
  D.products.forEach(function (p) { TARGET[String(p.productId)] = p; });
  var SIZES = { sm: 11, md: 14, lg: 18 };

  function launchMs(iso) {
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/.exec(iso);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0) + D.offsetMs;
  }
  function fmtDate(iso) {
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(iso);
    return m ? (m[3] + '/' + m[2]) : '';
  }

  function injectStyles() {
    if (document.getElementById('pn-cs-styles')) return;
    var pos = {
      'top-left': 'top:8px;left:8px;', 'top-right': 'top:8px;right:8px;',
      'bottom-left': 'bottom:8px;left:8px;', 'bottom-right': 'bottom:8px;right:8px;'
    }[S.badgePosition] || 'top:8px;left:8px;';
    var radius = S.badgeShape === 'pill' ? '999px' : (S.badgeShape === 'corner' ? '0' : '4px');
    var s = document.createElement('style');
    s.id = 'pn-cs-styles';
    s.textContent = [
      '.pn-cs-badge{position:absolute;z-index:20;' + pos + 'background:' + S.badgeBg + ' !important;color:' + S.badgeTextColor + ' !important;',
      'font-family:' + S.badgeFontFamily + ';font-size:' + S.badgeFontSize + 'px !important;font-weight:700;padding:5px 10px;border-radius:' + radius + ';',
      'letter-spacing:.4px;line-height:1;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.18);' + (S.badgeUppercase ? 'text-transform:uppercase;' : '') + '}',
      '.pn-cs-price-tag{color:' + S.priceReplaceColor + ' !important;font-size:' + S.priceReplaceFontSize + 'px !important;font-weight:600;margin:6px 0;}',
      '.pn-cs-hidden{display:none !important;}',
      '.pn-cs-cd{margin:14px 0;font-family:' + S.countdownFontFamily + ';}',
      '.pn-cs-cd-head{font-size:13px;color:' + S.countdownLabelsColor + ';margin-bottom:6px;}',
      '.pn-cs-cd-row{display:flex;gap:8px;}',
      '.pn-cs-cd-box{background:transparent;border:1px solid ' + S.countdownAccentColor + ';border-radius:8px;padding:6px 10px;text-align:center;min-width:46px;}',
      '.pn-cs-cd-inline .pn-cs-cd-box{border:none;padding:0;min-width:0;}',
      '.pn-cs-cd-num{font-size:' + SIZES[S.countdownSize] + 'px;font-weight:700;color:' + S.countdownDigitsColor + ';}',
      '.pn-cs-cd-lbl{font-size:10px;text-transform:uppercase;color:' + S.countdownLabelsColor + ';}',
      '.pn-cs-notify{margin:14px 0;padding:14px;border-radius:10px;background:' + S.notifyBg + ';color:' + S.notifyTextColor + ';}',
      '.pn-cs-notify h4{margin:0 0 8px;font-size:14px;color:inherit;}',
      '.pn-cs-notify form{display:flex;gap:8px;}',
      '.pn-cs-notify input{flex:1;padding:9px 12px;border:1px solid rgba(0,0,0,.15);border-radius:8px;font-size:14px;}',
      '.pn-cs-notify button{padding:9px 16px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;background:' + S.notifyButtonBg + ';color:' + S.notifyButtonTextColor + ';}',
      '.pn-cs-notify-ok{font-size:13px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function makeBadge() {
    var b = document.createElement('div');
    b.className = 'pn-cs-badge';
    b.textContent = S.badgeText;
    return b;
  }

  // Muchos temas envuelven la imagen en un <a> de click (position:static,
  // 0x0 de por sí) dentro de un contenedor con el truco padding-bottom para
  // el aspect-ratio (position:relative, con el tamaño real). La imagen,
  // position:absolute, se ancla a ese contenedor saltando el <a> estático.
  // Si forzáramos position:relative en el <a>, pasaría a ser el ancestro
  // posicionado más cercano y la imagen colapsaría a 0x0 (rompe el click a
  // la PDP). Por eso subimos hasta el ancestro que YA tiene tamaño
  // renderizado y anclamos el badge ahí, sin tocar el <a> para nada.
  function findVisualContainer(img) {
    var node = img.parentElement;
    while (node && node !== document.body) {
      if (node.offsetWidth > 0 && node.offsetHeight > 0) return node;
      node = node.parentElement;
    }
    return img.parentElement;
  }

  function ensureRelative(el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  }

  // ---- listado ----
  var CARD_SELECTORS = ['[data-item-id]', '[data-product-id]', '.js-item-product', '.product-item', '.item-product'];
  var PRICE_SELECTORS = ['.js-price-display', '.js-product-price', '.product-price', '.price', '[data-store="product-price"]', '.item-price'];
  var BUY_SELECTORS = ['.js-addtocart', '[data-store="product-buy-button"]', 'button[type="submit"].js-addtocart', '.js-product-form-submit', 'form[data-store="product-form"] button[type="submit"]'];

  function cardProductId(card) {
    return card.getAttribute('data-item-id') || card.getAttribute('data-product-id') ||
      (function () {
        var a = card.querySelector('a[href*="/products/"], a[href*="/producto/"]');
        var m = a && /\\/produc[a-z]*\\/(\\d+)/.exec(a.getAttribute('href') || '');
        return m ? m[1] : null;
      })();
  }

  function applyListing() {
    CARD_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (card) {
        if (card.getAttribute('data-pn-cs') === '1') return;
        var id = cardProductId(card);
        if (!id || !TARGET[id]) return;
        card.setAttribute('data-pn-cs', '1');
        var img = card.querySelector('img');
        var imgWrap = img && findVisualContainer(img);
        if (imgWrap) { ensureRelative(imgWrap); imgWrap.appendChild(makeBadge()); }
        else { ensureRelative(card); card.appendChild(makeBadge()); }
        PRICE_SELECTORS.forEach(function (ps) { card.querySelectorAll(ps).forEach(function (n) { n.classList.add('pn-cs-hidden'); }); });
        BUY_SELECTORS.forEach(function (bs) { card.querySelectorAll(bs).forEach(function (n) { n.setAttribute('disabled', 'disabled'); n.style.pointerEvents = 'none'; n.style.opacity = '.5'; }); });
      });
    });
  }

  // ---- PDP ----
  var cdTimer = null;

  function applyPdp(id) {
    var entry = TARGET[id];
    var name = document.querySelector('.product-name, h1[itemprop="name"], [data-store="product-name"], h1');
    if (name && !document.querySelector('.pn-cs-badge')) {
      var nb = makeBadge(); nb.style.position = 'static'; nb.style.display = 'inline-block'; nb.style.marginBottom = '8px';
      name.parentNode.insertBefore(nb, name);
    }

    var priceBlock = document.querySelector('.js-price-display, .product-detail-price, .js-product-detail-price, [data-store="product-price"], .product-price');
    if (priceBlock && !document.querySelector('.pn-cs-price-tag')) {
      priceBlock.classList.add('pn-cs-hidden');
      var tag = document.createElement('div');
      tag.className = 'pn-cs-price-tag';
      tag.textContent = (entry.message || S.priceReplaceText) + (S.priceShowDate ? ' · ' + fmtDate(entry.launchDate) : '');
      priceBlock.parentNode.insertBefore(tag, priceBlock.nextSibling);
    }

    var form = document.querySelector('form[data-store="product-form"], .js-product-form, form.js-product-form');
    var anchor = form || priceBlock;
    if (form) { form.querySelectorAll('button, input[type="submit"]').forEach(function (b) { b.setAttribute('disabled', 'disabled'); b.style.pointerEvents = 'none'; b.style.opacity = '.5'; }); }

    if (S.countdownEnabled && anchor && !document.querySelector('.pn-cs-cd')) {
      var cd = document.createElement('div');
      cd.className = 'pn-cs-cd' + (S.countdownLayout === 'inline' ? ' pn-cs-cd-inline' : '');
      cd.innerHTML = '<div class="pn-cs-cd-head">' + S.countdownHeading + '</div><div class="pn-cs-cd-row"></div>';
      anchor.parentNode.insertBefore(cd, anchor.nextSibling);
      startCountdown(cd.querySelector('.pn-cs-cd-row'), launchMs(entry.launchDate));
    }

    if (S.notifyEnabled && anchor && !document.querySelector('.pn-cs-notify')) {
      var box = document.createElement('div');
      box.className = 'pn-cs-notify';
      box.innerHTML = '<h4>' + S.notifyHeading + '</h4><form><input type="email" required placeholder="' + S.notifyPlaceholder + '"><button type="submit">' + S.notifyButtonText + '</button></form>';
      anchor.parentNode.insertBefore(box, (document.querySelector('.pn-cs-cd') || anchor).nextSibling);
      box.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var email = box.querySelector('input').value.trim();
        if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return;
        fetch(D.apiBase + '/api/coming-soon/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store: D.store, productId: id, email: email })
        }).then(function () { box.innerHTML = '<div class="pn-cs-notify-ok">' + S.notifySuccessText + '</div>'; })
          .catch(function () { box.innerHTML = '<div class="pn-cs-notify-ok">' + S.notifySuccessText + '</div>'; });
      });
    }
  }

  var UNIT_MS = { days: 864e5, hours: 36e5, minutes: 6e4, seconds: 1e3 };
  var UNIT_LBL = { days: 'días', hours: 'hs', minutes: 'min', seconds: 'seg' };

  function startCountdown(row, target) {
    if (target == null) return;
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { clearInterval(cdTimer); location.reload(); return; }
      var html = '';
      var rem = diff;
      S.countdownUnits.forEach(function (u) {
        var v = Math.floor(rem / UNIT_MS[u]); rem -= v * UNIT_MS[u];
        html += '<div class="pn-cs-cd-box"><div class="pn-cs-cd-num">' + v + '</div><div class="pn-cs-cd-lbl">' + UNIT_LBL[u] + '</div></div>';
      });
      row.innerHTML = html;
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  function run() {
    injectStyles();
    var ls = window.LS || {};
    var pid = ls.product && String(ls.product.id);
    if (pid && TARGET[pid]) applyPdp(pid);
    else applyListing();
  }

  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(run, 120); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && e.target.closest('form[data-store="product-form"], .js-product-form')) schedule();
  }, true);
})();
`;
}

// ---------------------------------------------------------------------------
// Rutas Express: GET/POST /api/coming-soon-config + GET /api/coming-soon-widget.js
// (los endpoints install / launch / subscribe / leads.csv se suman en Tasks 6-7).
// ---------------------------------------------------------------------------

async function loadStore(db, storeId) {
  const doc = await db.collection("promonube_stores").doc(String(storeId)).get();
  return doc.exists ? doc.data() : null;
}

async function getConfig(db, storeId) {
  const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
  return mergeConfig(doc.exists ? doc.data() : undefined);
}

async function saveConfig(db, FieldValue, storeId, config) {
  await db.collection(COLLECTION).doc(String(storeId)).set(
    { ...config, updatedAt: FieldValue.serverTimestamp() },
    { merge: false }
  );
}

const API_BASE = "https://glowlab-production.up.railway.app";

const TN_UA_PUBLIC = "PromoNube App (contacto@promonube.com)";
const CATEGORY_PRODUCTS_MAX_PAGES = 10;
const CATEGORY_PRODUCTS_PER_PAGE = 200;

async function fetchCategoryProducts({ storeId, categoryId, accessToken, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const headers = { "Authentication": `bearer ${accessToken}`, "User-Agent": TN_UA_PUBLIC };
  const out = [];
  let page = 1;
  while (page <= CATEGORY_PRODUCTS_MAX_PAGES) {
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?category_id=${categoryId}&page=${page}&per_page=${CATEGORY_PRODUCTS_PER_PAGE}&fields=id,name,canonical_url,images,variants`,
      { headers }
    );
    if (!res.ok) {
      const err = new Error(`TN GET category products page ${page}: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items);
    if (items.length < CATEGORY_PRODUCTS_PER_PAGE) break;
    page++;
  }
  return out;
}

function registerComingSoonRoutes(app, { db, FieldValue, checkStoreActive }) {
  // GET productos de una categoría completa, para "Agregar categoría" / "Actualizar
  // productos" en el panel. Endpoint propio (no el de Flash Sale, que devuelve
  // un shape distinto {productIds, featuredProducts} truncado a 10 items).
  app.get("/api/coming-soon/category-products", async (req, res) => {
    const { storeId, categoryId } = req.query;
    if (!storeId || !categoryId) return res.status(400).json({ success: false, message: "storeId y categoryId requeridos" });
    try {
      const store = await loadStore(db, storeId);
      if (!store || !store.accessToken) return res.status(404).json({ success: false, message: "Tienda sin token" });
      const products = await fetchCategoryProducts({ storeId, categoryId, accessToken: store.accessToken });
      res.json({ success: true, products });
    } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  });

  // GET config (admin)
  app.get("/api/coming-soon-config", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      let config = await getConfig(db, storeId);
      const store = await loadStore(db, storeId);
      if (store && store.accessToken && (config.products || []).some((p) => p.status === "scheduled" && isPastLaunch(p.launchDate, Date.now()))) {
        const client = createTiendanubeClient({ storeId, accessToken: store.accessToken });
        const r = await reconcileStore({ config, client, nowMs: Date.now() });
        if (r.changed) { config = r.config; await saveConfig(db, FieldValue, storeId, config); }
      }
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST config (admin) — diff -> pausar / restaurar
  app.post("/api/coming-soon-config", async (req, res) => {
    const { storeId, config: incoming } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!incoming || typeof incoming !== "object") return res.status(400).json({ success: false, message: "config requerido" });

    try {
      const now = Date.now();
      const prev = await getConfig(db, storeId);
      let next = mergeConfig(incoming);

      // validar fechas de productos scheduled
      for (const p of next.products) {
        if (p.status === "launched") continue;
        const v = validateLaunchDate(p.launchDate, now);
        if (!v.ok) return res.status(400).json({ success: false, message: `"${p.productName || p.productId}": ${v.error}` });
      }

      const store = await loadStore(db, storeId);
      if (!store || !store.accessToken) return res.status(404).json({ success: false, message: "Tienda sin token" });
      const client = createTiendanubeClient({ storeId, accessToken: store.accessToken });

      const wasEnabled = prev.enabled;
      const { toPause, toRestore } = diffProducts(prev.products, next.products);
      const pauseIds = next.enabled
        ? (wasEnabled ? toPause : next.products.filter((p) => p.status === "scheduled").map((p) => String(p.productId)))
        : [];

      // Productos quitados: hay que restaurarles el stock ANTES de sacarlos (spec
      // "Flujo de guardado" 3b). Como el cliente ya no los manda en `next` y
      // restoreProductInConfig es un no-op si el producto no está en el config,
      // reinsertamos temporalmente la entrada de `prev` (con su stockSnapshot)
      // para poder restaurar, y después la sacamos del array final.
      for (const id of toRestore) {
        const prevEntry = prev.products.find((p) => String(p.productId) === String(id));
        if (!prevEntry) continue;
        const staged = { ...next, products: [...next.products, prevEntry] };
        const restored = await restoreProductInConfig(staged, id, client);
        next = { ...restored, products: restored.products.filter((p) => String(p.productId) !== String(id)) };
      }
      for (const id of pauseIds) {
        next = await pauseProductInConfig(next, id, client);
      }
      // si el modulo se apagó, restaurar todos los scheduled que quedaban en prev
      if (wasEnabled && !next.enabled) {
        for (const p of prev.products.filter((x) => x.status === "scheduled")) {
          next = await restoreProductInConfig(next, p.productId, client);
        }
      }

      await saveConfig(db, FieldValue, storeId, next);
      res.json({ success: true, config: next });
    } catch (error) {
      console.error("[ComingSoon POST config]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET widget.js (storefront)
  app.get("/api/coming-soon-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    if (!store) return res.send("// coming soon: falta store");
    try {
      if (!(await checkStoreActive(store))) return res.send("// coming soon: inactivo");
      let config = await getConfig(db, store);
      if (config.enabled === false) return res.send("// coming soon: off");

      const storeDoc = await loadStore(db, store);
      if (storeDoc && storeDoc.accessToken && config.products.some((p) => p.status === "scheduled" && isPastLaunch(p.launchDate, Date.now()))) {
        const client = createTiendanubeClient({ storeId: store, accessToken: storeDoc.accessToken });
        const r = await reconcileStore({ config, client, nowMs: Date.now() });
        if (r.changed) { config = r.config; await saveConfig(db, FieldValue, store, config); }
      }

      const products = shapeWidgetProducts(config.products, Date.now());
      if (!products.length) return res.send("// coming soon: sin productos");
      res.send(buildWidgetScript(store, { style: config.style, products, apiBase: API_BASE }));
    } catch (error) {
      res.send("// coming soon: error " + error.message);
    }
  });

  // POST launch (admin) — "lanzar ahora"
  app.post("/api/coming-soon/launch", async (req, res) => {
    const { storeId, productId } = req.body || {};
    if (!storeId || !productId) return res.status(400).json({ success: false, message: "storeId y productId requeridos" });
    try {
      const store = await loadStore(db, storeId);
      if (!store || !store.accessToken) return res.status(404).json({ success: false, message: "Tienda sin token" });
      const config = await getConfig(db, storeId);
      const client = createTiendanubeClient({ storeId, accessToken: store.accessToken });
      const next = await restoreProductInConfig(config, productId, client);
      await saveConfig(db, FieldValue, storeId, next);
      res.json({ success: true, config: next });
    } catch (error) {
      console.error("[ComingSoon launch]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  const _subLimiter = new Map(); // key -> { count, windowStart }
  function rateLimited(key) {
    const now = Date.now();
    const rec = _subLimiter.get(key);
    if (!rec || now - rec.windowStart > 60000) { _subLimiter.set(key, { count: 1, windowStart: now }); return false; }
    rec.count++;
    return rec.count > 5;
  }

  // POST subscribe (storefront) — lead "avisame"
  app.post("/api/coming-soon/subscribe", async (req, res) => {
    const { store, productId, email } = req.body || {};
    if (!store || !productId || !isValidEmail(email)) return res.status(400).json({ success: false, message: "Datos inválidos" });
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
    if (rateLimited(`${ip}:${store}`)) return res.status(429).json({ success: false, message: "Demasiados intentos" });
    try {
      await db.collection(COLLECTION).doc(String(store)).collection("leads").add({
        productId: String(productId),
        email: email.trim().toLowerCase(),
        createdAt: FieldValue.serverTimestamp(),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[ComingSoon subscribe]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET leads.csv (admin) — export de leads capturados
  app.get("/api/coming-soon/leads.csv", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).send("storeId requerido");
    try {
      const [config, leadsSnap] = await Promise.all([
        getConfig(db, storeId),
        db.collection(COLLECTION).doc(String(storeId)).collection("leads").orderBy("createdAt", "desc").limit(5000).get(),
      ]);
      const nameById = new Map((config.products || []).map((p) => [String(p.productId), p.productName || ""]));
      const rows = leadsSnap.docs.map((d) => {
        const x = d.data();
        return { productId: x.productId, productName: nameById.get(String(x.productId)) || "", email: x.email, createdAt: x.createdAt };
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="leads-proximamente.csv"');
      res.send(leadsToCsv(rows));
    } catch (error) {
      console.error("[ComingSoon leads.csv]", error);
      res.status(500).send("error: " + error.message);
    }
  });

  // POST install (admin) — asocia el script a la tienda en Tiendanube Partners
  app.post("/api/coming-soon/install", async (req, res) => {
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (COMING_SOON_SCRIPT_ID == null) return res.status(503).json({ success: false, message: "Script no configurado todavía" });
    if (!(await checkStoreActive(storeId))) return res.status(403).json({ success: false, message: "Plan inactivo" });
    try {
      const store = await loadStore(db, storeId);
      if (!store || !store.accessToken) return res.status(404).json({ success: false, message: "Store no encontrada" });
      const r = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/scripts`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${store.accessToken}`, "User-Agent": TN_UA, "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: COMING_SOON_SCRIPT_ID }),
      });
      if (!r.ok) return res.status(500).json({ success: false, message: "Error TN: " + (await r.text()) });
      res.json({ success: true, result: await r.json() });
    } catch (error) {
      console.error("[ComingSoon install]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

function isValidEmail(s) {
  return typeof s === "string" && s.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

async function runSchedulerPass({ db, FieldValue, nowMs, clientFactory }) {
  const factory = clientFactory || createTiendanubeClient;
  const snap = await db.collection(COLLECTION).get();
  let storesReconciled = 0;
  for (const doc of snap.docs) {
    const storeId = doc.id;
    try {
      const config = mergeConfig(doc.data());
      const hasDue = (config.products || []).some((p) => p.status === "scheduled" && isPastLaunch(p.launchDate, nowMs));
      if (!hasDue) continue;
      const store = await db.collection("promonube_stores").doc(storeId).get();
      if (!store.exists || !store.data().accessToken) continue;
      const client = factory({ storeId, accessToken: store.data().accessToken });
      const r = await reconcileStore({ config, client, nowMs });
      if (r.changed) {
        await db.collection(COLLECTION).doc(storeId).set({ ...r.config, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
        storesReconciled++;
      }
    } catch (e) {
      console.error(`[ComingSoon scheduler] store ${storeId}:`, e.message);
    }
  }
  return { storesReconciled };
}

function startComingSoonScheduler({ db, FieldValue, intervalMs }) {
  const ms = intervalMs || 5 * 60 * 1000;
  const timer = setInterval(() => {
    runSchedulerPass({ db, FieldValue, nowMs: Date.now() }).catch((e) =>
      console.error("[ComingSoon scheduler] pass failed:", e.message)
    );
  }, ms);
  if (timer.unref) timer.unref();
  console.log(`[ComingSoon] scheduler activo cada ${ms / 1000}s`);
  return { stop: () => clearInterval(timer) };
}

module.exports = {
  COLLECTION,
  COMING_SOON_SCRIPT_ID,
  AR_OFFSET_MS,
  DEFAULT_STYLE,
  DEFAULT_CONFIG,
  TN_V1,
  TN_UA,
  parseLaunchDate,
  isPastLaunch,
  validateLaunchDate,
  mergeConfig,
  leadsToCsv,
  snapshotVariants,
  buildStockPausePlan,
  buildStockRestorePlan,
  diffProducts,
  expandCategoryToProducts,
  propagateCategoryDate,
  shapeWidgetProducts,
  createTiendanubeClient,
  applyStockPlan,
  pauseProductInConfig,
  restoreProductInConfig,
  reconcileStore,
  buildWidgetScript,
  registerComingSoonRoutes,
  runSchedulerPass,
  startComingSoonScheduler,
  isValidEmail,
};
