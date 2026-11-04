"use strict";

// Style > Shop the Look, rehecho para Ipanema (Alto Rancho).
//
// La version vieja (customizeShopTheLook en index.js) buscaba ".banner, .slider,
// .hero..." para ubicarse (no existen en Ipanema) o pedia un selector CSS, y
// guardaba nombre/foto/precio del producto al asignarlo: si cambiaba el precio o
// se agotaba, el punto seguia mostrando lo viejo.
//
// La nueva:
//  - se ubica antes/despues de una seccion de la home elegida de una lista
//    (data-block-id de Ipanema);
//  - pide nombre, precio, precio tachado, foto y stock a Tiendanube al armar el
//    script (cache), y puede ocultar los productos agotados;
//  - tiene dos disenos: "hotspots" (foto con puntos) y "split" (foto + lista).
// Solo las configs del editor nuevo (version: 2) usan este codigo.

const HEX = /^#[0-9a-f]{6}$/i;
const LAYOUTS = ["split", "hotspots"];
const MAX_LOOKS = 6;
const MAX_HOTSPOTS = 12;

const DEFAULTS = {
  enabled: false,
  version: 2,
  title: "Shop the Look",
  subtitle: "",
  layout: "split",
  placement: { sectionId: "", position: "after" },
  injectSelector: "", // config vieja: se respeta si no se eligio seccion
  injectPosition: "after",
  dotColor: "#ffffff",
  dotTextColor: "#353434",
  dotStyle: "number", // number | plus | dot
  pulse: true,
  accentColor: "#353434",
  buttonLabel: "Ver producto",
  showPrice: true,
  hideSoldOut: true,
  imageSide: "left",
  looks: [],
};

const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const hexOr = (v, fb) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);
const pick = (v, list, fb) => (list.includes(v) ? v : fb);
const pct = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : null; };
const httpsUrl = (v) => (/^https:\/\//i.test(String(v || "")) ? String(v).slice(0, 600) : "");

function normalizeHotspot(h) {
  const c = h || {};
  const x = pct(c.x), y = pct(c.y);
  if (x == null || y == null) return null;
  return {
    x, y,
    productId: String(c.productId || "").replace(/\D/g, "").slice(0, 20),
    // Se guardan para el panel y como respaldo si Tiendanube no responde.
    productName: text(c.productName, 120),
    productImage: httpsUrl(c.productImage),
    productPrice: text(c.productPrice, 30),
    productUrl: text(c.productUrl, 300),
    label: text(c.label, 12),
  };
}

function normalizeLook(l) {
  const c = l || {};
  return {
    id: text(c.id, 40) || "look",
    imageUrl: httpsUrl(c.imageUrl),
    mobileImageUrl: httpsUrl(c.mobileImageUrl),
    caption: text(c.caption, 120),
    hotspots: (Array.isArray(c.hotspots) ? c.hotspots : []).map(normalizeHotspot).filter(Boolean).slice(0, MAX_HOTSPOTS),
  };
}

function normalize(input) {
  const c = input || {};
  const isNew = c.version === 2;
  const pl = c.placement || {};
  return {
    ...DEFAULTS,
    enabled: c.enabled === true,
    title: c.title == null ? DEFAULTS.title : text(c.title, 80),
    subtitle: text(c.subtitle, 200),
    layout: isNew ? pick(c.layout, LAYOUTS, DEFAULTS.layout) : "hotspots", // la vieja era solo puntos
    placement: { sectionId: text(pl.sectionId, 80).replace(/[^\w-]/g, ""), position: pl.position === "before" ? "before" : "after" },
    injectSelector: text(c.injectSelector, 200),
    injectPosition: pick(c.injectPosition, ["before", "after", "prepend", "append"], "after"),
    dotColor: hexOr(c.dotColor, hexOr(c.hotspotColor, DEFAULTS.dotColor)),
    dotTextColor: hexOr(c.dotTextColor, hexOr(c.hotspotTextColor, DEFAULTS.dotTextColor)),
    dotStyle: pick(c.dotStyle, ["number", "plus", "dot"], c.hotspotLabelMode === "plus" ? "plus" : c.hotspotLabelMode === "number" ? "number" : DEFAULTS.dotStyle),
    pulse: isNew ? c.pulse !== false : (c.hotspotAnimation || "pulse") === "pulse",
    accentColor: hexOr(c.accentColor, hexOr(c.hoverCardButtonBg, DEFAULTS.accentColor)),
    buttonLabel: text(c.buttonLabel || c.hoverCardButtonLabel, 30) || DEFAULTS.buttonLabel,
    showPrice: c.showPrice !== false,
    hideSoldOut: isNew ? c.hideSoldOut !== false : false,
    imageSide: c.imageSide === "right" ? "right" : "left",
    looks: (Array.isArray(c.looks) ? c.looks : []).map(normalizeLook).filter((l) => l.imageUrl).slice(0, MAX_LOOKS),
    version: 2,
  };
}

const usesNewShopTheLook = (cfg) => !!cfg && cfg.version === 2;

// ----------------------------------------------------------------------------
// Datos vivos del producto (Tiendanube Admin API)
const pickLang = (v) => (v && typeof v === "object" ? v.es || Object.values(v)[0] || "" : v || "");

function formatPrice(p) {
  const n = parseFloat(String(p == null ? "" : p).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  const dec = n % 1 !== 0;
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 });
}

// Producto de la API -> lo que necesita la tienda
function productInfo(p) {
  if (!p || !p.id) return null;
  const vs = Array.isArray(p.variants) ? p.variants : [];
  const avail = vs.filter((v) => v.stock_management === false || v.stock == null || Number(v.stock) > 0);
  const base = avail[0] || vs[0] || {};
  const promo = parseFloat(base.promotional_price);
  const price = parseFloat(base.price);
  const hasPromo = Number.isFinite(promo) && promo > 0 && Number.isFinite(price) && promo < price;
  const compare = parseFloat(base.compare_at_price);
  const handle = pickLang(p.handle);
  const img = Array.isArray(p.images) && p.images[0] ? p.images[0].src || "" : "";
  return {
    name: text(pickLang(p.name), 120),
    price: formatPrice(hasPromo ? promo : price),
    compareAt: hasPromo ? formatPrice(price) : Number.isFinite(compare) && compare > price ? formatPrice(compare) : "",
    image: httpsUrl(img),
    url: p.canonical_url || (handle ? "/productos/" + handle + "/" : ""),
    available: p.published !== false && (vs.length === 0 || avail.length > 0),
  };
}

// fetchProduct(id) -> producto crudo de la API (o null). Con cache afuera.
async function livePayload(cfg, fetchProduct) {
  const n = normalize(cfg);
  const ids = [...new Set(n.looks.flatMap((l) => l.hotspots.map((h) => h.productId)).filter(Boolean))];
  const info = {};
  await Promise.all(ids.map(async (id) => {
    try { info[id] = productInfo(await fetchProduct(id)); } catch (e) { info[id] = null; }
  }));
  const looks = n.looks.map((l) => ({
    imageUrl: l.imageUrl,
    mobileImageUrl: l.mobileImageUrl,
    caption: l.caption,
    items: l.hotspots.map((h) => {
      const live = h.productId ? info[h.productId] : null;
      const p = live || {
        name: h.productName, price: h.productPrice, compareAt: "", image: h.productImage, url: h.productUrl, available: true,
      };
      return { x: h.x, y: h.y, label: h.label, ...p };
    }).filter((it) => it.name && it.url && (!n.hideSoldOut || it.available)),
  })).filter((l) => l.items.length || n.layout === "hotspots");
  return {
    title: n.title, subtitle: n.subtitle, layout: n.layout, placement: n.placement,
    injectSelector: n.placement.sectionId ? "" : n.injectSelector, injectPosition: n.injectPosition,
    dotColor: n.dotColor, dotTextColor: n.dotTextColor, dotStyle: n.dotStyle, pulse: n.pulse,
    accentColor: n.accentColor, buttonLabel: n.buttonLabel, showPrice: n.showPrice, imageSide: n.imageSide,
    looks,
  };
}

// ----------------------------------------------------------------------------
// Script de la tienda. Se serializa con toString(): no usar nada de afuera.
function storefrontShopTheLook(P) {
  if (window.__pnStlV2 || !P.looks.length) return;
  window.__pnStlV2 = true;

  var A = P.accentColor;
  var hover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  var css = [
    ".pn-stl2{max-width:1400px;margin:48px auto;padding:0 16px;box-sizing:border-box;color:#353434}",
    ".pn-stl2 *{box-sizing:border-box}",
    ".pn-stl2-head{text-align:center;margin-bottom:24px}",
    ".pn-stl2-head h2{margin:0 0 6px;font-size:24px;font-weight:600;letter-spacing:-.01em}",
    ".pn-stl2-head p{margin:0;font-size:14px;opacity:.7}",
    ".pn-stl2-look+.pn-stl2-look{margin-top:40px}",
    ".pn-stl2-split{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:32px;align-items:start}",
    ".pn-stl2-right .pn-stl2-media{order:2}",
    ".pn-stl2-media{position:relative;line-height:0}",
    ".pn-stl2-media img.pn-stl2-img{display:block !important;width:100% !important;height:auto !important;max-height:none !important}",
    ".pn-stl2-cap{margin:10px 0 0;font-size:13px;line-height:1.4;opacity:.7}",
    ".pn-stl2-dot{position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;border:0;padding:0;cursor:pointer;" +
      "background:" + P.dotColor + ";color:" + P.dotTextColor + ";font:600 13px/1 inherit;display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 2px 10px rgba(0,0,0,.3);transition:transform .2s ease;z-index:2}",
    ".pn-stl2-dot.pn-stl2-small{width:16px;height:16px;border:3px solid rgba(255,255,255,.6);background-clip:padding-box}",
    ".pn-stl2-dot:hover,.pn-stl2-dot.pn-on{transform:translate(-50%,-50%) scale(1.15)}",
    P.pulse ? ".pn-stl2-dot::before{content:'';position:absolute;inset:0;border-radius:50%;background:" + P.dotColor + ";opacity:.5;animation:pnStl2P 2s ease-out infinite;z-index:-1}@keyframes pnStl2P{from{transform:scale(1);opacity:.5}to{transform:scale(2.1);opacity:0}}" : "",
    ".pn-stl2-list{display:flex;flex-direction:column;gap:2px}",
    ".pn-stl2-item{display:grid;grid-template-columns:76px 1fr;gap:14px;align-items:center;padding:10px;border-radius:6px;text-decoration:none !important;color:inherit !important;transition:background .2s ease}",
    ".pn-stl2-item:hover,.pn-stl2-item.pn-on{background:rgba(53,52,52,.06)}",
    ".pn-stl2-item img{width:76px;height:76px;object-fit:cover;display:block;background:#f2f2f2}",
    ".pn-stl2-num{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;font-size:11px;margin-right:6px;background:" + A + ";color:#fff;vertical-align:1px}",
    ".pn-stl2-name{font-size:14px;line-height:1.35;margin:0 0 4px}",
    ".pn-stl2-price{font-size:14px;font-weight:600}",
    ".pn-stl2-price s{font-weight:400;opacity:.55;margin-left:8px;font-size:13px}",
    ".pn-stl2-go{display:inline-block;margin-top:4px;font-size:12px;text-decoration:underline;text-underline-offset:3px;opacity:.75}",
    ".pn-stl2-card{position:fixed;z-index:99999;width:230px;background:#fff;color:#353434;box-shadow:0 14px 40px rgba(0,0,0,.25);border-radius:6px;overflow:hidden;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease;pointer-events:none}",
    ".pn-stl2-card.pn-vis{opacity:1;transform:none;pointer-events:auto}",
    ".pn-stl2-card img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#f2f2f2}",
    ".pn-stl2-card div{padding:12px 14px 14px}",
    ".pn-stl2-btn{display:block;margin-top:10px;padding:10px;text-align:center;background:" + A + ";color:#fff !important;text-decoration:none !important;font-size:13px;font-weight:600;border-radius:4px}",
    ".pn-stl2-ov{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}",
    ".pn-stl2-sheet{background:#fff;width:100%;max-width:480px;border-radius:14px 14px 0 0;padding:16px;display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;animation:pnStl2Up .2s ease}",
    ".pn-stl2-sheet img{width:96px;height:96px;object-fit:cover;background:#f2f2f2}",
    ".pn-stl2-sheet .pn-stl2-btn{grid-column:1/-1;margin:0;padding:13px}",
    "@keyframes pnStl2Up{from{transform:translateY(30px);opacity:0}}",
    "@media (max-width:767px){.pn-stl2{margin:32px auto}.pn-stl2-head h2{font-size:20px}" +
      ".pn-stl2-split{display:block}.pn-stl2-list{flex-direction:row;overflow-x:auto;gap:10px;margin-top:14px;scroll-snap-type:x mandatory;scrollbar-width:none}" +
      ".pn-stl2-item{grid-template-columns:1fr;width:150px;flex:0 0 150px;padding:0;scroll-snap-align:start;align-content:start}.pn-stl2-item img{width:150px;height:150px}" +
      ".pn-stl2-go{display:none}.pn-stl2-dot{width:26px;height:26px;font-size:12px}}",
  ].join("");
  var st = document.createElement("style");
  st.id = "pn-stl2-css";
  st.textContent = css;
  document.head.appendChild(st);

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function priceEl(it) {
    var p = el("div", "pn-stl2-price", it.price || "");
    if (it.compareAt) p.appendChild(el("s", "", it.compareAt));
    return p;
  }
  function dotLabel(it, i) { return it.label || (P.dotStyle === "number" ? String(i + 1) : P.dotStyle === "plus" ? "+" : ""); }

  var card = null, hideT = null;
  function hideCard() { if (card) { var c = card; card = null; c.classList.remove("pn-vis"); setTimeout(function () { c.remove(); }, 160); } }
  function showCard(dot, it) {
    clearTimeout(hideT); hideCard();
    var c = el("div", "pn-stl2-card");
    if (it.image) { var im = el("img"); im.src = it.image; im.alt = ""; c.appendChild(im); }
    var b = el("div");
    b.appendChild(el("div", "pn-stl2-name", it.name));
    if (P.showPrice && it.price) b.appendChild(priceEl(it));
    var a = el("a", "pn-stl2-btn", P.buttonLabel); a.href = it.url; b.appendChild(a);
    c.appendChild(b);
    document.body.appendChild(c);
    var r = dot.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight;
    var left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    var top = r.top - h - 12 < 8 ? r.bottom + 12 : r.top - h - 12;
    c.style.left = left + "px"; c.style.top = Math.max(8, Math.min(top, innerHeight - h - 8)) + "px";
    c.addEventListener("mouseenter", function () { clearTimeout(hideT); });
    c.addEventListener("mouseleave", function () { hideT = setTimeout(hideCard, 150); });
    card = c;
    requestAnimationFrame(function () { c.classList.add("pn-vis"); });
  }
  window.addEventListener("scroll", hideCard, { passive: true });

  function sheet(it) {
    var ov = el("div", "pn-stl2-ov");
    var s = el("div", "pn-stl2-sheet");
    if (it.image) { var im = el("img"); im.src = it.image; im.alt = ""; s.appendChild(im); }
    var b = el("div");
    b.appendChild(el("div", "pn-stl2-name", it.name));
    if (P.showPrice && it.price) b.appendChild(priceEl(it));
    s.appendChild(b);
    var a = el("a", "pn-stl2-btn", P.buttonLabel); a.href = it.url; s.appendChild(a);
    ov.appendChild(s);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  var section = el("section", "pn-stl2");
  if (P.title || P.subtitle) {
    var head = el("div", "pn-stl2-head");
    if (P.title) head.appendChild(el("h2", "", P.title));
    if (P.subtitle) head.appendChild(el("p", "", P.subtitle));
    section.appendChild(head);
  }

  P.looks.forEach(function (look) {
    var split = P.layout === "split" && look.items.length;
    var wrap = el("div", "pn-stl2-look" + (split ? " pn-stl2-split" + (P.imageSide === "right" ? " pn-stl2-right" : "") : ""));
    var media = el("div", "pn-stl2-media");
    var pic = document.createElement("picture");
    if (look.mobileImageUrl) { var so = document.createElement("source"); so.media = "(max-width:767px)"; so.srcset = look.mobileImageUrl; pic.appendChild(so); }
    var img = el("img", "pn-stl2-img"); img.src = look.imageUrl; img.alt = P.title || "Shop the Look"; img.loading = "lazy";
    pic.appendChild(img);
    media.appendChild(pic);
    var rows = [];
    var list = split ? el("div", "pn-stl2-list") : null;

    look.items.forEach(function (it, i) {
      var dot = el("button", "pn-stl2-dot" + (P.dotStyle === "dot" && !it.label ? " pn-stl2-small" : ""), dotLabel(it, i));
      dot.type = "button";
      dot.style.left = it.x + "%"; dot.style.top = it.y + "%";
      dot.setAttribute("aria-label", it.name);
      media.appendChild(dot);
      if (list) {
        var row = el("a", "pn-stl2-item"); row.href = it.url;
        var im = el("img"); im.src = it.image || ""; im.alt = ""; im.loading = "lazy"; row.appendChild(im);
        var info = el("div");
        var nm = el("div", "pn-stl2-name");
        if (P.dotStyle === "number") nm.appendChild(el("span", "pn-stl2-num", String(i + 1)));
        nm.appendChild(document.createTextNode(it.name));
        info.appendChild(nm);
        if (P.showPrice && it.price) info.appendChild(priceEl(it));
        info.appendChild(el("span", "pn-stl2-go", P.buttonLabel));
        row.appendChild(info);
        row.addEventListener("mouseenter", function () { dot.classList.add("pn-on"); });
        row.addEventListener("mouseleave", function () { dot.classList.remove("pn-on"); });
        list.appendChild(row);
        rows.push(row);
      }
      if (hover && !list) {
        dot.addEventListener("mouseenter", function () { showCard(dot, it); });
        dot.addEventListener("mouseleave", function () { hideT = setTimeout(hideCard, 150); });
      }
      if (list && hover) {
        dot.addEventListener("mouseenter", function () { rows[i].classList.add("pn-on"); });
        dot.addEventListener("mouseleave", function () { rows[i].classList.remove("pn-on"); });
      }
      dot.addEventListener("click", function () {
        if (list) {
          // Lleva a su producto en la lista (en celu se desliza hasta el)
          rows.forEach(function (r) { r.classList.remove("pn-on"); });
          rows[i].classList.add("pn-on");
          if (innerWidth < 768) list.scrollTo({ left: rows[i].offsetLeft - list.offsetLeft, behavior: "smooth" });
          else rows[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
        } else if (!hover) sheet(it);
        else location.href = it.url;
      });
    });

    var left = el("div");
    left.appendChild(media);
    if (look.caption) left.appendChild(el("p", "pn-stl2-cap", look.caption));
    wrap.appendChild(left);
    if (list) wrap.appendChild(list);
    section.appendChild(wrap);
  });

  function mount() {
    var target = null, pos = "after";
    if (P.placement.sectionId) {
      target = document.querySelector('[data-section-id="' + P.placement.sectionId + '"]');
      pos = P.placement.position;
      if (!target) return false; // la seccion esta en la home: en otras paginas no se muestra
    } else if (P.injectSelector) {
      try { target = document.querySelector(P.injectSelector); } catch (e) { target = null; }
      pos = P.injectPosition;
    }
    if (!target) {
      var foot = document.querySelector("footer, .js-footer");
      if (!foot || !foot.parentNode) return false;
      foot.parentNode.insertBefore(section, foot);
      return true;
    }
    if (pos === "before") target.parentNode.insertBefore(section, target);
    else if (pos === "prepend") target.insertBefore(section, target.firstChild);
    else if (pos === "append") target.appendChild(section);
    else target.parentNode.insertBefore(section, target.nextSibling);
    return true;
  }
  if (!mount()) window.__pnStlV2 = false;
}

async function buildShopTheLookScript(cfg, { fetchProduct }) {
  if (!usesNewShopTheLook(cfg) || cfg.enabled !== true) return "";
  const p = await livePayload(cfg, fetchProduct);
  if (!p.looks.length) return "";
  const run = `(${storefrontShopTheLook.toString()})(${JSON.stringify(p)});`;
  return `\n;(function(){var go=function(){try{${run}}catch(e){console.error("PromoNube shop the look",e)}};` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n`;
}

// ----------------------------------------------------------------------------
// Secciones de la home (para elegir donde va), desde el HTML publico.
// Secciones de primer nivel de Ipanema: <section data-section-id data-section-type>.
// (Los data-block-id estan anidados: el titulo y boton de un banner van adentro.)
const SKIP_SECTIONS = /^(announcement-bar|navigation-bar|header|footer|newsletter-popup|cart-drawer)/;

function parseHomeSections(html) {
  const s = String(html || "");
  const re = /<section\b[^>]*data-section-id="([\w-]+)"[^>]*data-section-type="([\w-]+)"/g;
  const starts = [];
  let m;
  while ((m = re.exec(s))) starts.push({ id: m[1], type: m[2], at: m.index });
  return starts.map((b, i) => {
    const seg = s.slice(b.at, Math.min(i + 1 < starts.length ? starts[i + 1].at : s.length, b.at + 40000));
    const h = /<(?:h[1-4]|strong)\b[^>]*>([\s\S]*?)<\/(?:h[1-4]|strong)>/i.exec(seg);
    const title = h ? h[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;|&\w+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    const img = /(https:\/\/[^"\s]+\/webp\/640\.webp)/.exec(seg) || /data-src="(https:\/\/[^"]+)"/.exec(seg);
    return { sectionId: b.id, type: b.type, title, thumb: img ? img[1] : "" };
  }).filter((x) => !SKIP_SECTIONS.test(x.type));
}

module.exports = {
  DEFAULTS,
  normalize,
  usesNewShopTheLook,
  productInfo,
  livePayload,
  buildShopTheLookScript,
  parseHomeSections,
};
