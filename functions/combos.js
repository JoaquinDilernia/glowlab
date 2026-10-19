"use strict";

// Combos: "1 Mesa Nova (cualquier color) + 4 Sillas Rey (cualquier color) = 15% off".
// Las kits nativas de Tiendanube son de componentes fijos y no se pueden crear
// por API, asi que cada combinacion de colores seria una kit a mano. En vez de
// eso usamos la Discounts API: Tiendanube nos manda el carrito en cada cambio
// (callback) y respondemos el descuento de los combos completos que contiene.
// Docs: https://tiendanube.github.io/api-documentation/resources/discounts

const { extractColorLabels, resolveColors } = require("./variant-colors");

const COLLECTION = "promonube_combos";
const VARIANT_GROUPS_COLLECTION = "promonube_variant_groups";
const TN_V1 = "https://api.tiendanube.com/v1";
const TN_2025 = "https://api.tiendanube.com/2025-03";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PUBLIC_BASE = "https://glowlab-production.up.railway.app";
const CALLBACK_URL = `${PUBLIC_BASE}/api/discounts/callback`;

// Piloto: mismas tiendas que Grupos de Variantes (del que depende).
const ALLOWED_STORE_IDS = ["2547699", "5320806", "6854698"];

const MAX_COMBOS = 100;
const MAX_ITEMS_PER_COMBO = 10;
const MAX_ITEM_QUANTITY = 50;
const STATE_TTL_MS = 60 * 1000;
const WIDGET_DATA_TTL_MS = 5 * 60 * 1000;
const IDS_PER_REQUEST = 50;

const DEFAULT_CONFIG = {
  enabled: false,
  combinesWithCoupons: false,
  combos: [],
  promotionId: null,
};

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Logica pura (testeada en combos.test.js)
// ---------------------------------------------------------------------------

function isValidComboItem(item) {
  if (!item || typeof item !== "object") return false;
  const qty = Number(item.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_QUANTITY) return false;
  if (item.type === "group") return typeof item.groupKey === "string" && item.groupKey.length > 0;
  if (item.type === "product") return typeof item.productId === "string" && /^\d+$/.test(item.productId);
  return false;
}

function isValidCombo(combo) {
  if (!combo || typeof combo !== "object") return false;
  const pct = Number(combo.discountPercent);
  return (
    typeof combo.id === "string" && combo.id.length > 0 &&
    typeof combo.name === "string" && combo.name.trim().length > 0 &&
    Number.isFinite(pct) && pct > 0 && pct < 100 &&
    Array.isArray(combo.items) &&
    combo.items.length >= 1 && combo.items.length <= MAX_ITEMS_PER_COMBO &&
    combo.items.every(isValidComboItem) &&
    // un combo de 1 solo item con cantidad 1 no es un combo
    combo.items.reduce((sum, it) => sum + Number(it.quantity), 0) >= 2
  );
}

function sanitizeCombo(combo) {
  return {
    id: combo.id,
    name: combo.name.trim().slice(0, 120),
    active: combo.active !== false,
    discountPercent: round2(Number(combo.discountPercent)),
    items: combo.items.map((it) => ({
      type: it.type,
      ...(it.type === "group" ? { groupKey: it.groupKey } : { productId: it.productId }),
      label: typeof it.label === "string" ? it.label.slice(0, 120) : "",
      quantity: Number(it.quantity),
    })),
  };
}

// Productos (ids string) que cuentan para un item del combo.
function itemProductIds(item, groupsByKey) {
  if (item.type === "product") return [String(item.productId)];
  const group = groupsByKey.get(item.groupKey);
  if (!group || group.hidden) return [];
  return group.products.map((p) => String(p.productId));
}

// Arma la mayor cantidad de combos completos posible con las unidades del
// carrito. Cada unidad cuenta para un solo combo. Los combos con mayor %
// van primero. Devuelve el descuento total y el detalle por combo.
function findCombosInCart(cartProducts, combos, groupsByKey) {
  const lines = (cartProducts || []).map((p) => ({
    lineItem: String(p.id),
    productId: String(p.product_id),
    price: Number(p.price) || 0,
    remaining: Number(p.quantity) || 0,
  }));

  const sorted = (combos || [])
    .filter((c) => c.active !== false)
    .slice()
    .sort((a, b) => b.discountPercent - a.discountPercent);

  const applied = [];
  for (const combo of sorted) {
    const itemSets = combo.items.map((it) => new Set(itemProductIds(it, groupsByKey)));
    let sets = 0;
    let discount = 0;

    for (;;) {
      // Reservar las unidades de un combo; si falta alguna se devuelven.
      const taken = [];
      let complete = true;
      for (let i = 0; i < combo.items.length && complete; i++) {
        let needed = combo.items[i].quantity;
        for (const line of lines) {
          if (needed === 0) break;
          if (line.remaining === 0 || !itemSets[i].has(line.productId)) continue;
          const use = Math.min(line.remaining, needed);
          line.remaining -= use;
          needed -= use;
          taken.push({ line, units: use });
        }
        if (needed > 0) complete = false;
      }
      if (!complete) {
        for (const t of taken) t.line.remaining += t.units;
        break;
      }
      const setValue = taken.reduce((sum, t) => sum + t.line.price * t.units, 0);
      discount += (setValue * combo.discountPercent) / 100;
      sets += 1;
    }

    if (sets > 0) applied.push({ comboId: combo.id, name: combo.name, sets, discount: round2(discount) });
  }

  const totalDiscount = round2(applied.reduce((sum, a) => sum + a.discount, 0));
  return { totalDiscount, applied };
}

function displayText(applied) {
  const parts = applied.map((a) => (a.sets > 1 ? `${a.name} x${a.sets}` : a.name));
  const text = `Combo: ${parts.join(" + ")}`.slice(0, 140);
  return { "es-ar": text, es: text };
}

// Respuesta al callback de la Discounts API. state = { config, groupsByKey }.
// Usamos una sola promocion "cross_items" por tienda con un monto fijo: el
// descuento total de los combos sobre el carrito.
function buildCallbackResponse(payload, state) {
  const promotionId = state && state.config && state.config.promotionId;
  if (!promotionId) return { status: 204 };

  const alreadyApplied = (payload.promotions || []).some((p) => p && p.id === promotionId);
  // Solo actuamos en el tier de la promocion (cross_items).
  if (payload.execution_tier && payload.execution_tier !== "cross_items") return { status: 204 };

  const enabled = state.config.enabled !== false;
  const result = enabled
    ? findCombosInCart(payload.products, state.config.combos, state.groupsByKey)
    : { totalDiscount: 0, applied: [] };

  if (result.totalDiscount <= 0) {
    if (!alreadyApplied) return { status: 204 };
    return {
      status: 200,
      body: { commands: [{ command: "remove_discount", specs: { scope: "cart", promotion_ids: [promotionId] } }] },
    };
  }

  return {
    status: 200,
    body: {
      commands: [{
        command: "create_or_update_discount",
        specs: {
          promotion_id: promotionId,
          currency: payload.currency || "ARS",
          display_text: displayText(result.applied),
          discount_specs: { type: "fixed", amount: result.totalDiscount.toFixed(2) },
        },
      }],
    },
  };
}

// Datos para la card de la PDP: los combos activos donde aparece productId,
// con las opciones (colores) de cada item ya resueltas.
function buildWidgetCombos(productId, config, groupsByKey, productsById, palette) {
  const pid = String(productId);
  const out = [];
  for (const combo of config.combos || []) {
    if (combo.active === false) continue;
    const items = combo.items.map((item) => {
      const ids = itemProductIds(item, groupsByKey);
      const group = item.type === "group" ? groupsByKey.get(item.groupKey) : null;
      const names = ids.map((id) => (productsById[id] && productsById[id].name) || "");
      const colorLabels = group ? extractColorLabels(names) : ids.map(() => "");
      const options = ids
        .map((id, i) => {
          const p = productsById[id];
          if (!p) return null;
          return {
            productId: id,
            variantId: p.variantId,
            name: p.name,
            colorName: colorLabels[i],
            colors: colorLabels[i] ? resolveColors(colorLabels[i], palette) : [],
            image: p.image,
            price: p.price,
            available: p.available,
            url: p.url,
          };
        })
        .filter(Boolean);
      return {
        label: item.label || (group && group.title) || (options[0] && options[0].name) || "",
        quantity: item.quantity,
        options,
      };
    });
    const containsProduct = items.some((it) => it.options.some((o) => o.productId === pid));
    const everyItemBuyable = items.every((it) => it.options.some((o) => o.available));
    if (containsProduct && everyItemBuyable) {
      out.push({ id: combo.id, name: combo.name, discountPercent: combo.discountPercent, items });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Acceso a Firestore / Tiendanube con cache en memoria (el callback tiene 800ms)
// ---------------------------------------------------------------------------

function createStateCache(db) {
  const cache = new Map();

  async function loadState(storeId) {
    const [comboDoc, vgDoc, storeDoc] = await Promise.all([
      db.collection(COLLECTION).doc(String(storeId)).get(),
      db.collection(VARIANT_GROUPS_COLLECTION).doc(String(storeId)).get(),
      db.collection("promonube_stores").doc(String(storeId)).get(),
    ]);
    const installed = storeDoc.exists && storeDoc.data().active !== false;
    const config = comboDoc.exists ? { ...DEFAULT_CONFIG, ...comboDoc.data() } : { ...DEFAULT_CONFIG };
    const vg = vgDoc.exists ? vgDoc.data() : {};
    const groupsByKey = new Map((vg.groups || []).map((g) => [g.groupKey, g]));
    return { installed, config, groupsByKey, palette: vg.colorPalette || {}, swatchMode: vg.swatchMode || "image" };
  }

  return {
    async get(storeId) {
      const key = String(storeId);
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < STATE_TTL_MS) return hit.state;
      const state = await loadState(key);
      cache.set(key, { at: Date.now(), state });
      return state;
    },
    invalidate(storeId) {
      cache.delete(String(storeId));
    },
  };
}

async function fetchProductsByIds({ storeId, accessToken, ids, fetchImpl }) {
  const doFetch = fetchImpl || globalThis.fetch;
  const out = {};
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + IDS_PER_REQUEST);
    const res = await doFetch(
      `${TN_V1}/${storeId}/products?ids=${chunk.join(",")}&per_page=${IDS_PER_REQUEST}&fields=id,name,images,variants,canonical_url,published`,
      { headers: { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA } }
    );
    if (!res.ok) throw new Error(`TN GET products ids: ${res.status}`);
    const items = await res.json();
    for (const p of Array.isArray(items) ? items : []) {
      if (p.published === false) continue;
      const variants = Array.isArray(p.variants) ? p.variants : [];
      // Alto Rancho carga cada color como producto aparte, casi siempre con
      // una sola variante: se usa la primera con stock.
      const variant = variants.find((v) => v.stock === null || Number(v.stock) > 0) || variants[0];
      if (!variant) continue;
      const price = Number(variant.promotional_price) > 0 ? Number(variant.promotional_price) : Number(variant.price);
      const name = typeof p.name === "object" ? p.name.es || Object.values(p.name)[0] || "" : p.name || "";
      out[String(p.id)] = {
        name,
        variantId: String(variant.id),
        price: round2(price) || 0,
        available: variant.stock === null || Number(variant.stock) > 0,
        image: (p.images && p.images[0] && p.images[0].src) || "",
        url: p.canonical_url || "",
      };
    }
  }
  return out;
}

function allComboProductIds(config, groupsByKey) {
  const ids = new Set();
  for (const combo of config.combos || []) {
    if (combo.active === false) continue;
    for (const item of combo.items) for (const id of itemProductIds(item, groupsByKey)) ids.add(id);
  }
  return [...ids];
}

async function tnRequest(storeId, accessToken, method, path, body) {
  const res = await fetch(`${TN_2025}/${storeId}${path}`, {
    method,
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": TN_UA,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TN ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function promotionCombinationSettings(config) {
  return {
    combines_with_cart_amount_discounts: !!config.combinesWithCoupons,
    combines_with_quantity_discounts: false,
    combines_with_app_discounts: true,
    combines_with_free_shipping: true,
    combines_with_price_discounts: true,
  };
}

// Deja la tienda lista para recibir callbacks: registra la URL (idempotente)
// y crea la promocion "Combos" si todavia no existe. Devuelve el promotionId.
async function ensureDiscountSetup({ storeId, accessToken, config }) {
  await tnRequest(storeId, accessToken, "PUT", "/discounts/callbacks", { url: CALLBACK_URL });

  const listed = await tnRequest(storeId, accessToken, "GET", "/promotions");
  const existing = ((listed && listed.data) || []).find((p) => p.id === config.promotionId);
  const active = !!config.enabled && (config.combos || []).some((c) => c.active !== false);
  const settings = promotionCombinationSettings(config);

  if (existing) {
    await tnRequest(storeId, accessToken, "PATCH", `/promotions/${existing.id}`, { active, ...settings });
    return existing.id;
  }

  const created = await tnRequest(storeId, accessToken, "POST", "/promotions", {
    name: "Combos",
    description: "Descuento por comprar los productos de un combo",
    allocation_type: "cross_items",
    active,
    ...settings,
  });
  return created.data.id;
}

// ---------------------------------------------------------------------------
// Widget de la PDP
// ---------------------------------------------------------------------------

function buildWidgetScript(store) {
  return `
/**
 * Combos - card en la ficha de producto
 * Tienda: ${store}
 */
(function() {
  'use strict';
  if (window.__pnCombosLoaded) return;
  window.__pnCombosLoaded = true;

  var product = window.LS && window.LS.product;
  if (!product) return;

  var DATA_URL = '${PUBLIC_BASE}/api/combos-data.json?store=${store}&product=' + encodeURIComponent(product.id);
  var CURRENT = String(product.id);

  function money(n) {
    return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function injectStyles() {
    if (document.getElementById('pn-cb-styles')) return;
    var s = document.createElement('style');
    s.id = 'pn-cb-styles';
    s.textContent = [
      '.pn-cb, .pn-cb * { box-sizing: border-box !important; font-family: inherit !important; }',
      '.pn-cb { margin: 24px 0 !important; color: #353434 !important; }',
      '.pn-cb-title { font-size: 16px !important; font-weight: 600 !important; margin: 0 0 12px !important; }',
      '.pn-cb-card { border: 1px solid #e7e2db !important; border-radius: 8px !important; background: #fff !important; padding: 16px !important; margin-bottom: 12px !important; }',
      '.pn-cb-head { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; margin-bottom: 12px !important; }',
      '.pn-cb-name { font-size: 15px !important; font-weight: 600 !important; margin: 0 !important; }',
      '.pn-cb-badge { flex: none !important; background: #f3efe9 !important; color: #353434 !important; border-radius: 999px !important; padding: 3px 10px !important; font-size: 12px !important; font-weight: 600 !important; }',
      '.pn-cb-item { display: flex !important; gap: 12px !important; align-items: center !important; padding: 10px 0 !important; border-top: 1px solid #f1ede7 !important; }',
      '.pn-cb-thumb { flex: none !important; width: 56px !important; height: 56px !important; border-radius: 6px !important; background-color: #f6f4f1 !important; background-position: center !important; background-size: cover !important; background-repeat: no-repeat !important; }',
      '.pn-cb-info { flex: 1 !important; min-width: 0 !important; }',
      '.pn-cb-label { font-size: 14px !important; line-height: 1.3 !important; margin: 0 0 2px !important; }',
      '.pn-cb-qty { color: #8a8580 !important; font-weight: 400 !important; }',
      '.pn-cb-color { font-size: 12px !important; color: #8a8580 !important; margin: 0 0 6px !important; }',
      '.pn-cb-sw { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; }',
      '.pn-cb-dot { width: 24px !important; height: 24px !important; padding: 2px !important; border-radius: 50% !important; border: 1.5px solid transparent !important; background: none !important; cursor: pointer !important; }',
      '.pn-cb-dot span { display: block !important; width: 100% !important; height: 100% !important; border-radius: 50% !important; background-size: cover !important; background-position: center !important; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15) !important; }',
      '.pn-cb-dot.is-on { border-color: #353434 !important; }',
      '.pn-cb-dot[disabled] { opacity: 0.3 !important; cursor: not-allowed !important; }',
      '.pn-cb-price { flex: none !important; font-size: 13px !important; text-align: right !important; white-space: nowrap !important; }',
      '.pn-cb-foot { border-top: 1px solid #f1ede7 !important; padding-top: 12px !important; display: flex !important; align-items: flex-end !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important; }',
      '.pn-cb-was { font-size: 13px !important; color: #8a8580 !important; text-decoration: line-through !important; }',
      '.pn-cb-total { font-size: 20px !important; font-weight: 600 !important; line-height: 1.2 !important; }',
      '.pn-cb-save { font-size: 12px !important; color: #4f7a4a !important; font-weight: 600 !important; }',
      '.pn-cb-btn { flex: 1 1 200px !important; background: #353434 !important; color: #fff !important; border: none !important; border-radius: 5px !important; padding: 12px 16px !important; font-size: 15px !important; cursor: pointer !important; transition: opacity 0.15s ease !important; }',
      '.pn-cb-btn:hover { opacity: 0.88 !important; }',
      '.pn-cb-btn[disabled] { opacity: 0.5 !important; cursor: wait !important; }',
      '.pn-cb-msg { width: 100% !important; font-size: 12px !important; color: #b3261e !important; margin: 0 !important; }',
    ].join('');
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function dotFill(opt, swatchMode) {
    var fill = el('span');
    var colors = opt.colors || [];
    if (swatchMode === 'color' && colors.length) {
      fill.style.background = colors.length > 1
        ? 'linear-gradient(135deg, ' + colors[0] + ' 50%, ' + colors[1] + ' 50%)'
        : colors[0];
    } else if (opt.image) {
      fill.style.backgroundImage = 'url(' + opt.image + ')';
    }
    return fill;
  }

  function renderCombo(combo, swatchMode) {
    var card = el('div', 'pn-cb-card');
    var head = el('div', 'pn-cb-head');
    head.appendChild(el('p', 'pn-cb-name', combo.name));
    head.appendChild(el('span', 'pn-cb-badge', '-' + combo.discountPercent + '%'));
    card.appendChild(head);

    // Seleccion inicial: el producto que se esta viendo, si no el primero con stock.
    var selected = combo.items.map(function(item) {
      var cur = item.options.filter(function(o) { return o.productId === CURRENT && o.available; })[0];
      return cur || item.options.filter(function(o) { return o.available; })[0];
    });

    var was = el('div', 'pn-cb-was');
    var total = el('div', 'pn-cb-total');
    var save = el('div', 'pn-cb-save');

    function refreshTotals() {
      var sum = 0;
      combo.items.forEach(function(item, i) { sum += selected[i].price * item.quantity; });
      var final = sum * (1 - combo.discountPercent / 100);
      was.textContent = 'Por separado ' + money(sum);
      total.textContent = money(final);
      save.textContent = 'Ahorrás ' + money(sum - final);
    }

    combo.items.forEach(function(item, i) {
      var row = el('div', 'pn-cb-item');
      var thumb = el('div', 'pn-cb-thumb');
      var info = el('div', 'pn-cb-info');
      var label = el('p', 'pn-cb-label', item.label + ' ');
      label.appendChild(el('span', 'pn-cb-qty', 'x' + item.quantity));
      var colorText = el('p', 'pn-cb-color');
      var price = el('div', 'pn-cb-price');
      info.appendChild(label);
      info.appendChild(colorText);

      function paint() {
        var opt = selected[i];
        thumb.style.backgroundImage = opt.image ? 'url(' + opt.image + ')' : '';
        colorText.textContent = opt.colorName || '';
        price.textContent = money(opt.price * item.quantity);
      }

      if (item.options.length > 1) {
        var sw = el('div', 'pn-cb-sw');
        item.options.forEach(function(opt) {
          var dot = el('button', 'pn-cb-dot' + (opt === selected[i] ? ' is-on' : ''));
          dot.type = 'button';
          dot.title = opt.colorName || opt.name;
          dot.setAttribute('aria-label', opt.colorName || opt.name);
          if (!opt.available) dot.disabled = true;
          dot.appendChild(dotFill(opt, swatchMode));
          dot.addEventListener('click', function() {
            selected[i] = opt;
            var dots = sw.querySelectorAll('.pn-cb-dot');
            for (var k = 0; k < dots.length; k++) dots[k].classList.remove('is-on');
            dot.classList.add('is-on');
            paint();
            refreshTotals();
          });
          sw.appendChild(dot);
        });
        info.appendChild(sw);
      }

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(price);
      card.appendChild(row);
      paint();
    });

    var foot = el('div', 'pn-cb-foot');
    var prices = el('div');
    prices.appendChild(was);
    prices.appendChild(total);
    prices.appendChild(save);
    var btn = el('button', 'pn-cb-btn', 'Agregar combo al carrito');
    btn.type = 'button';
    var msg = el('p', 'pn-cb-msg');
    btn.addEventListener('click', function() {
      btn.disabled = true;
      btn.textContent = 'Agregando…';
      msg.textContent = '';
      addAll(combo.items.map(function(item, i) {
        return { productId: selected[i].productId, variantId: selected[i].variantId, quantity: item.quantity };
      })).then(function() {
        window.location.href = '/comprar/';
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = 'Agregar combo al carrito';
        msg.textContent = 'No pudimos agregar el combo. Probá de nuevo.';
      });
    });
    foot.appendChild(prices);
    foot.appendChild(btn);
    foot.appendChild(msg);
    card.appendChild(foot);

    refreshTotals();
    return card;
  }

  // Se agregan de a uno (el carrito de Tiendanube no acepta varios por request).
  function addAll(lines) {
    return lines.reduce(function(prev, line) {
      return prev.then(function() {
        var body = 'add_to_cart=' + encodeURIComponent(line.productId) +
          '&variant_id=' + encodeURIComponent(line.variantId) +
          '&quantity=' + encodeURIComponent(line.quantity);
        return fetch('/comprar/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: body
        }).then(function(r) { return r.json(); }).then(function(res) {
          if (!res || res.success === false) throw new Error('add_to_cart');
        });
      });
    }, Promise.resolve());
  }

  function mount(data) {
    if (!data || !data.combos || !data.combos.length) return;
    if (document.querySelector('.pn-cb')) return;
    var anchor = document.querySelector('.js-product-form, form[action*="/comprar"]');
    if (!anchor || !anchor.parentNode) return;
    injectStyles();
    var wrap = el('section', 'pn-cb');
    wrap.appendChild(el('p', 'pn-cb-title', data.combos.length > 1 ? 'Combos disponibles' : 'Combo disponible'));
    data.combos.forEach(function(combo) { wrap.appendChild(renderCombo(combo, data.swatchMode)); });
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  }

  function start() {
    fetch(DATA_URL).then(function(r) { return r.json(); }).then(mount).catch(function() {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
`;
}

// Loader que se agrega al final del script de Grupos de Variantes (ya
// instalado en la tienda) para no registrar otro script en Partners.
function buildLoaderSnippet(store) {
  return `
(function() {
  if (window.__pnCombosLoader) return;
  window.__pnCombosLoader = true;
  var s = document.createElement('script');
  s.src = '${PUBLIC_BASE}/api/combos-widget.js?store=${store}';
  s.async = true;
  document.head.appendChild(s);
})();
`;
}

async function isCombosEnabled(db, storeId) {
  if (!isAllowedStore(storeId)) return false;
  const doc = await db.collection(COLLECTION).doc(String(storeId)).get();
  return doc.exists && doc.data().enabled === true && (doc.data().combos || []).some((c) => c.active !== false);
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

function registerCombosRoutes(app, { db, FieldValue, checkStoreActive }) {
  const stateCache = createStateCache(db);
  const widgetCache = new Map(); // storeId -> { at, productsById }

  async function getAccessToken(storeId) {
    const storeDoc = await db.collection("promonube_stores").doc(String(storeId)).get();
    return storeDoc.exists ? storeDoc.data().accessToken : null;
  }

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

  // GET /api/combos-config?storeId=X
  app.get("/api/combos-config", async (req, res) => {
    const { storeId } = req.query;
    if (!guard(storeId, res)) return;
    try {
      const [doc, vgDoc] = await Promise.all([
        db.collection(COLLECTION).doc(String(storeId)).get(),
        db.collection(VARIANT_GROUPS_COLLECTION).doc(String(storeId)).get(),
      ]);
      const config = doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : DEFAULT_CONFIG;
      const groups = ((vgDoc.exists && vgDoc.data().groups) || [])
        .filter((g) => !g.hidden)
        .map((g) => ({
          groupKey: g.groupKey,
          title: g.title,
          count: g.products.length,
          image: (g.products[0] && g.products[0].image) || "",
        }));
      res.json({ success: true, config, groups });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/combos-config - guarda combos y deja la Discounts API configurada
  app.post("/api/combos-config", async (req, res) => {
    const { storeId, config } = req.body || {};
    if (!guard(storeId, res)) return;
    if (!config || typeof config !== "object" || !Array.isArray(config.combos)) {
      return res.status(400).json({ success: false, message: "config requerido" });
    }
    if (config.combos.length > MAX_COMBOS) {
      return res.status(400).json({ success: false, message: "Demasiados combos" });
    }
    const invalid = config.combos.find((c) => !isValidCombo(c));
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: `Revisá el combo "${(invalid && invalid.name) || "sin nombre"}": necesita nombre, un descuento entre 1 y 99% y al menos 2 unidades en total.`,
      });
    }
    if (!(await checkStoreActive(storeId))) {
      return res.status(403).json({ success: false, message: "Plan inactivo" });
    }

    try {
      const ref = db.collection(COLLECTION).doc(String(storeId));
      const current = await ref.get();
      const next = {
        enabled: !!config.enabled,
        combinesWithCoupons: !!config.combinesWithCoupons,
        combos: config.combos.map(sanitizeCombo),
        promotionId: (current.exists && current.data().promotionId) || null,
      };

      const accessToken = await getAccessToken(storeId);
      if (!accessToken) return res.status(401).json({ success: false, message: "No hay token de acceso" });
      // Solo se toca Tiendanube si ya hay promocion o si hay algo para activar.
      if (next.promotionId || next.enabled) {
        next.promotionId = await ensureDiscountSetup({ storeId, accessToken, config: next });
      }

      await ref.set({ ...next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      stateCache.invalidate(storeId);
      widgetCache.delete(String(storeId));
      res.json({ success: true, promotionId: next.promotionId });
    } catch (error) {
      console.error("[Combos save]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/combos/search-products?storeId=X&q=silla - para sumar productos sueltos
  app.get("/api/combos/search-products", async (req, res) => {
    const { storeId, q } = req.query;
    if (!guard(storeId, res)) return;
    if (!q || String(q).trim().length < 2) return res.json({ success: true, products: [] });
    try {
      const accessToken = await getAccessToken(storeId);
      const r = await fetch(
        `${TN_V1}/${storeId}/products?q=${encodeURIComponent(String(q).trim())}&per_page=20&fields=id,name,images,published`,
        { headers: { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA } }
      );
      // TN devuelve 404 cuando la busqueda no tiene resultados
      if (r.status === 404) return res.json({ success: true, products: [] });
      if (!r.ok) throw new Error(`TN search: ${r.status}`);
      const items = await r.json();
      res.json({
        success: true,
        products: (Array.isArray(items) ? items : []).filter((p) => p.published !== false).map((p) => ({
          productId: String(p.id),
          name: typeof p.name === "object" ? p.name.es || Object.values(p.name)[0] || "" : p.name || "",
          image: (p.images && p.images[0] && p.images[0].src) || "",
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/discounts/callback - Tiendanube manda el carrito en cada cambio.
  // Tiene 800ms: se responde con config cacheada y sin llamar a Tiendanube.
  app.post("/api/discounts/callback", async (req, res) => {
    const payload = req.body || {};
    const storeId = String(payload.store_id || "");
    try {
      if (!isAllowedStore(storeId)) return res.status(310).end();
      const state = await stateCache.get(storeId);
      // App desinstalada: la doc pide responder 310 a cualquier carrito.
      if (!state.installed) return res.status(310).end();

      const out = buildCallbackResponse(payload, state);
      if (out.status === 204) return res.status(204).end();
      res.status(out.status).json(out.body);
    } catch (error) {
      console.error("[Combos callback]", error);
      // Ante un error no aplicamos nada: el carrito queda como esta.
      res.status(204).end();
    }
  });

  // GET /api/combos-widget.js?store=X
  app.get("/api/combos-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    if (!store || !isAllowedStore(store)) return res.send("// Combos: no disponible");
    try {
      if (!(await isCombosEnabled(db, store))) return res.send("// Combos: deshabilitado");
      res.send(buildWidgetScript(store));
    } catch (error) {
      res.send("// Combos: error interno");
    }
  });

  // GET /api/combos-data.json?store=X&product=Y - combos del producto para la card
  app.get("/api/combos-data.json", async (req, res) => {
    const { store, product } = req.query;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    if (!store || !product || !isAllowedStore(store)) return res.json({ combos: [] });
    try {
      if (!(await checkStoreActive(store))) return res.json({ combos: [] });
      const state = await stateCache.get(store);
      if (!state.config.enabled) return res.json({ combos: [] });

      let cached = widgetCache.get(String(store));
      if (!cached || Date.now() - cached.at > WIDGET_DATA_TTL_MS) {
        const accessToken = await getAccessToken(store);
        const ids = allComboProductIds(state.config, state.groupsByKey);
        const productsById = await fetchProductsByIds({ storeId: store, accessToken, ids });
        cached = { at: Date.now(), productsById };
        widgetCache.set(String(store), cached);
      }
      res.json({
        swatchMode: state.swatchMode,
        combos: buildWidgetCombos(product, state.config, state.groupsByKey, cached.productsById, state.palette),
      });
    } catch (error) {
      console.error("[Combos data]", error);
      res.json({ combos: [] });
    }
  });
}

module.exports = {
  isValidCombo,
  sanitizeCombo,
  itemProductIds,
  findCombosInCart,
  buildCallbackResponse,
  buildWidgetCombos,
  fetchProductsByIds,
  buildWidgetScript,
  buildLoaderSnippet,
  isCombosEnabled,
  registerCombosRoutes,
};
