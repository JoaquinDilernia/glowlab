"use strict";

// Style > Menú principal, rehecho para Ipanema (Alto Rancho).
//
// La config vive en promonube_style_config/{store}.menu (se guarda con el resto
// de Style). El editor nuevo guarda version: 2. Solo esas configs usan este
// codigo: las viejas siguen con customizeMenu() de index.js tal cual, asi
// ninguna tienda cambia al deployar.
//
// Cambios respecto del viejo:
// - Cada ajuste apunta a un item por su NOMBRE ("Alto Cyber.") ademas de por
//   posicion ("1", "1.2"): si reordenan el menu el ajuste sigue al item.
// - Estilos por CSS con clases (no style inline re-aplicado cada 100ms).
// - Etiqueta ("NUEVO"), formato pastilla, ocultar item, programar fechas,
//   solo compu / solo celu, imagen promo dentro del desplegable.
// - Se re-aplica si la plantilla re-dibuja el menu (MutationObserver).
//
// GET /api/style/menu-tree?storeId=X lee el menu real de la tienda (HTML
// publico de la home) para que el panel muestre la lista de items.

const MAX_ITEMS = 40;
const DEFAULT_TZ_OFFSET = "-03:00";
const HEX = /^#[0-9a-f]{6}$/i;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const WEIGHTS = [300, 400, 500, 600, 700, 800];
const DEVICES = ["both", "desktop", "mobile"];
const LOOKS = ["text", "pill"];

const ITEM_DEFAULTS = {
  target: { mode: "text", text: "", parent: "", position: "" },
  emoji: "",
  emojiPosition: "before",
  color: null,
  fontWeight: null,
  fontSize: null,
  uppercase: false,
  look: "text",
  pillColor: "#8aa1c4",
  pillTextColor: "#ffffff",
  badge: "",
  badgeColor: "#353434",
  badgeTextColor: "#ffffff",
  hidden: false,
  devices: "both",
  startDate: null,
  endDate: null,
  imageUrl: "",
  imageMobileUrl: "",
  imageLink: "",
  imageCaption: "",
  imageOnMobile: true,
};

const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const hexOr = (v, fb) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);
const pick = (v, list, fb) => (list.includes(v) ? v : fb);

function parseDate(value) {
  if (value == null || value === "") return NaN;
  const s = String(value).trim();
  return Date.parse(LOCAL_DT.test(s) ? s + DEFAULT_TZ_OFFSET : s);
}
function toIso(value) {
  const ms = parseDate(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function safeUrl(value) {
  const s = text(value, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "/" + s.replace(/^\/+/, "");
}
function imageUrl(value) {
  const s = text(value, 1000);
  return /^https?:\/\//i.test(s) ? s : "";
}

// "bold" | "700" | 700 | "normal" -> numero o null (= el de la plantilla)
function weight(v) {
  if (v == null || v === "" || v === "normal") return null;
  if (v === "bold") return 700;
  const n = Number(v);
  return WEIGHTS.includes(n) ? n : null;
}
// "16px" | "16" | 16 | "1.2rem" -> px o null. rem/em se pasan a px con base 16.
function fontPx(v) {
  if (v == null || v === "") return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px|rem|em)?\s*$/i.exec(String(v));
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2] && m[2].toLowerCase() !== "px") n *= 16;
  return Math.min(32, Math.max(9, Math.round(n)));
}
function position(v) {
  const s = text(v, 10);
  return /^\d{1,2}(\.\d{1,2})?$/.test(s) ? s : "";
}

function normalizeTarget(t, legacyPosition) {
  const c = t || {};
  const pos = position(c.position != null ? c.position : legacyPosition);
  const txt = text(c.text, 80);
  let mode = pick(c.mode, ["text", "position"], null);
  if (!mode) mode = txt ? "text" : "position";
  return { mode, text: txt, parent: text(c.parent, 80), position: pos };
}

function normalizeItem(input) {
  const c = input || {};
  const d = ITEM_DEFAULTS;
  return {
    target: normalizeTarget(c.target, c.position),
    emoji: text(c.emoji, 8),
    emojiPosition: c.emojiPosition === "after" ? "after" : "before",
    color: hexOr(c.color, null),
    fontWeight: weight(c.fontWeight),
    fontSize: fontPx(c.fontSize),
    uppercase: c.uppercase === true,
    look: pick(c.look, LOOKS, d.look),
    pillColor: hexOr(c.pillColor, d.pillColor),
    pillTextColor: hexOr(c.pillTextColor, d.pillTextColor),
    badge: text(c.badge, 14),
    badgeColor: hexOr(c.badgeColor, d.badgeColor),
    badgeTextColor: hexOr(c.badgeTextColor, d.badgeTextColor),
    hidden: c.hidden === true,
    devices: pick(c.devices, DEVICES, d.devices),
    startDate: toIso(c.startDate),
    endDate: toIso(c.endDate),
    imageUrl: imageUrl(c.imageUrl),
    imageMobileUrl: imageUrl(c.imageMobileUrl),
    imageLink: safeUrl(c.imageLink),
    imageCaption: text(c.imageCaption, 60),
    // Config vieja: la imagen de celu solo salia si cargaban imageMobileUrl.
    imageOnMobile: c.imageOnMobile === undefined ? !!imageUrl(c.imageMobileUrl) || !imageUrl(c.imageUrl) : c.imageOnMobile === true,
  };
}

function normalize(input) {
  const c = input || {};
  const items = (Array.isArray(c.items) ? c.items : []).slice(0, MAX_ITEMS).map(normalizeItem);
  return { enabled: c.enabled === true, version: 2, items };
}

const usesNewMenu = (cfg) => !!cfg && cfg.version === 2;

// Lo que viaja a la tienda: solo items con a quien apuntar y algo que hacer.
function hasEffect(i) {
  return !!(i.emoji || i.color || i.fontWeight || i.fontSize || i.uppercase || i.look === "pill" ||
    i.badge || i.hidden || i.imageUrl || i.imageMobileUrl);
}
function menuPayload(cfg) {
  const n = normalize(cfg);
  const items = n.items.filter((i) => (i.target.mode === "text" ? i.target.text : i.target.position) && hasEffect(i));
  return { items };
}

// ----------------------------------------------------------------------------
// Script de la tienda. Se serializa con toString(): no usar nada de afuera.
function storefrontMenu(P) {
  if (window.pnMenuV2) return;
  window.pnMenuV2 = true;
  var ITEMS = P.items || [];
  if (!ITEMS.length) return;

  function norm(s) {
    return String(s || "").normalize("NFD").replace(new RegExp("[\u0300-\u036f]", "g"), "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function live(it) {
    var now = Date.now();
    if (it.startDate && now < Date.parse(it.startDate)) return false;
    if (it.endDate && now >= Date.parse(it.endDate)) return false;
    return true;
  }
  function labelOf(el) {
    if (!el) return "";
    if (el.hasAttribute("data-pn-label")) return el.getAttribute("data-pn-label");
    var t = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) t += n.nodeValue;
      else if (n.nodeType === 1 && !/^(svg|img)$/i.test(n.tagName) && !n.classList.contains("nav-list-arrow")) t += n.textContent;
    }
    t = t.replace(/\s+/g, " ").trim();
    el.setAttribute("data-pn-label", t);
    return t;
  }
  function q(root, sel) { return root ? Array.prototype.slice.call(root.querySelectorAll(sel)) : []; }

  // Arbol del menu: [{ el, label, panel (donde va la imagen), children: [{el,label}] }]
  function desktopTree() {
    var list = document.querySelector(".js-nav-desktop-list");
    if (list) {
      return q(list, ":scope > li").map(function (li) {
        var a = li.querySelector(":scope > a, :scope > .nav-list-link");
        return {
          el: a, li: li, label: labelOf(a),
          panel: li.querySelector(".desktop-dropdown-container"),
          children: q(li, ".desktop-list-subitems > li > .nav-list-link").map(function (s) { return { el: s, label: labelOf(s) }; }),
        };
      }).filter(function (x) { return x.el; });
    }
    // Otras plantillas: primer <ul> del header que no este adentro de un <li>
    var uls = q(document, "header ul").filter(function (u) { return !u.closest("li") && !u.closest("#nav-hamburger"); });
    if (!uls.length) return [];
    return q(uls[0], ":scope > li").map(function (li) {
      var a = li.querySelector(":scope > a") || li.querySelector("a");
      return {
        el: a, li: li, label: labelOf(a), panel: li.querySelector("ul") ? li.querySelector("ul").parentElement : null,
        children: q(li, "ul > li > a").map(function (s) { return { el: s, label: labelOf(s) }; }),
      };
    }).filter(function (x) { return x.el; });
  }
  function mobileTree() {
    var ham = document.getElementById("nav-hamburger");
    if (!ham) return [];
    var top = q(ham, ".nav-list > .nav-item > .nav-list-link");
    if (!top.length) top = q(ham, "ul > li > a").filter(function (a) { return !a.closest("li li"); });
    return top.map(function (a) {
      var id = a.getAttribute("data-target");
      var panel = id ? document.querySelector(id) : null;
      var body = panel ? panel.querySelector(".modal-body") : (a.closest("li") ? a.closest("li").querySelector("ul") : null);
      var kids = panel
        ? q(body, ":scope > .nav-item > .nav-list-link").filter(function (s) { return s.tagName !== "A" || !/^ver todo/i.test(labelOf(s)); })
        : q(body, ":scope > li > a");
      return { el: a, li: a.closest(".nav-item, li"), label: labelOf(a), panel: body, children: kids.map(function (s) { return { el: s, label: labelOf(s) }; }) };
    });
  }

  function find(tree, t) {
    if (t.mode === "position") {
      var p = String(t.position).split(".");
      var main = tree[Number(p[0]) - 1];
      if (!main) return null;
      if (p.length === 1) return { node: main, top: true };
      var kid = main.children[Number(p[1]) - 1];
      return kid ? { node: kid, top: false } : null;
    }
    var want = norm(t.text);
    var parent = norm(t.parent);
    if (!parent) {
      for (var i = 0; i < tree.length; i++) if (norm(tree[i].label) === want) return { node: tree[i], top: true };
    }
    for (var j = 0; j < tree.length; j++) {
      if (parent && norm(tree[j].label) !== parent) continue;
      for (var k = 0; k < tree[j].children.length; k++) {
        if (norm(tree[j].children[k].label) === want) return { node: tree[j].children[k], top: false };
      }
    }
    return null;
  }

  function css() {
    var out = [
      ".pn-mi-label{display:inline}",
      ".pn-mi-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;font-size:9px;line-height:1.3;font-weight:700;letter-spacing:.04em;text-transform:uppercase;vertical-align:middle;white-space:nowrap}",
      ".pn-mi-pill .pn-mi-label{padding:3px 10px;border-radius:999px}",
      ".pn-mi-promo{display:block;flex:0 0 260px;max-width:260px;margin-left:auto;text-decoration:none;color:inherit}",
      ".pn-mi-promo img{display:block;width:100%;height:auto;border-radius:6px}",
      ".pn-mi-promo span{display:block;margin-top:8px;font-size:13px;font-weight:600;text-align:center}",
      ".pn-mi-has-promo{display:flex !important;gap:32px;align-items:flex-start}",
      ".pn-mi-has-promo > ul{flex:1;min-width:0}",
      ".pn-mi-promo-m{display:block;padding:16px;text-decoration:none;color:inherit}",
      ".pn-mi-promo-m img{display:block;width:100%;height:auto;border-radius:6px}",
      ".pn-mi-promo-m span{display:block;margin-top:8px;font-size:14px;font-weight:600;text-align:center}",
    ];
    ITEMS.forEach(function (it, i) {
      var s = ".pn-mi-" + i, r = [];
      if (it.color && it.look !== "pill") r.push("color:" + it.color + " !important");
      if (it.fontWeight) r.push("font-weight:" + it.fontWeight + " !important");
      if (it.fontSize) r.push("font-size:" + it.fontSize + "px !important");
      if (it.uppercase) r.push("text-transform:uppercase !important");
      if (r.length) out.push(s + "," + s + " .pn-mi-label{" + r.join(";") + "}");
      if (it.look === "pill") out.push(s + " .pn-mi-label{background:" + it.pillColor + ";color:" + it.pillTextColor + " !important}");
      if (it.badge) out.push(s + " .pn-mi-badge{background:" + it.badgeColor + ";color:" + it.badgeTextColor + " !important}");
      if (it.hidden) out.push(s + "-hide{display:none !important}");
    });
    var st = document.createElement("style");
    st.id = "pn-menu-v2-css";
    st.textContent = out.join("\n");
    document.head.appendChild(st);
  }

  function decorate(el, it, i) {
    el.classList.add("pn-mi-" + i);
    if (it.look === "pill") el.classList.add("pn-mi-pill");
    if (el.getAttribute("data-pn-mi") === String(i)) return;
    el.setAttribute("data-pn-mi", String(i));
    var label = labelOf(el);
    // Reemplazamos solo el nodo de texto del nombre: el link de celu es flex
    // (texto + flecha) y reescribir el innerHTML borraria los listeners de la plantilla.
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; },
    });
    var node = walker.nextNode();
    if (!node) return;
    var span = document.createElement("span");
    span.className = "pn-mi-label";
    span.textContent = it.emoji ? (it.emojiPosition === "after" ? label + " " + it.emoji : it.emoji + " " + label) : label;
    node.parentNode.replaceChild(span, node);
    if (it.badge) {
      var b = document.createElement("span");
      b.className = "pn-mi-badge";
      b.textContent = it.badge;
      span.parentNode.insertBefore(b, span.nextSibling);
    }
  }

  function promo(it, mobile) {
    var src = mobile ? (it.imageMobileUrl || it.imageUrl) : (it.imageUrl || it.imageMobileUrl);
    if (!src) return null;
    var a = document.createElement(it.imageLink ? "a" : "div");
    a.className = mobile ? "pn-mi-promo-m" : "pn-mi-promo";
    if (it.imageLink) a.href = it.imageLink;
    var img = document.createElement("img");
    img.src = src;
    img.alt = it.imageCaption || "";
    img.loading = "lazy";
    a.appendChild(img);
    if (it.imageCaption) {
      var cap = document.createElement("span");
      cap.textContent = it.imageCaption;
      a.appendChild(cap);
    }
    return a;
  }

  function apply() {
    var trees = [{ tree: desktopTree(), mobile: false }, { tree: mobileTree(), mobile: true }];
    ITEMS.forEach(function (it, i) {
      if (!live(it)) return;
      trees.forEach(function (T) {
        if (it.devices === "desktop" && T.mobile) return;
        if (it.devices === "mobile" && !T.mobile) return;
        var hit = find(T.tree, it.target);
        if (!hit) return;
        var n = hit.node;
        decorate(n.el, it, i);
        if (it.hidden) (hit.top && n.li ? n.li : (n.el.closest("li, .nav-item") || n.el)).classList.add("pn-mi-" + i + "-hide");
        var wantsImg = hit.top && n.panel && (T.mobile ? it.imageOnMobile : true);
        if (wantsImg && !n.panel.querySelector(T.mobile ? ".pn-mi-promo-m" : ".pn-mi-promo")) {
          var p = promo(it, T.mobile);
          if (p) {
            n.panel.appendChild(p);
            if (!T.mobile) n.panel.classList.add("pn-mi-has-promo");
          }
        }
      });
    });
  }

  css();
  apply();
  // La plantilla puede volver a dibujar el menu (o cargarlo tarde): re-aplicar.
  var pending = null;
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.closest && t.closest(".pn-mi-promo, .pn-mi-promo-m")) continue;
      if (pending) return;
      pending = setTimeout(function () { pending = null; apply(); }, 150);
      return;
    }
  });
  var roots = [document.querySelector(".js-header, header"), document.getElementById("nav-hamburger")];
  roots.forEach(function (r) { if (r) mo.observe(r, { childList: true, subtree: true }); });
  window.addEventListener("load", apply);
}

function buildMenuScript(cfg) {
  if (!usesNewMenu(cfg) || cfg.enabled !== true) return "";
  const payload = menuPayload(cfg);
  if (!payload.items.length) return "";
  const run = `(${storefrontMenu.toString()})(${JSON.stringify(payload)});`;
  return `\n;(function(){var go=function(){try{${run}}catch(e){console.error("PromoNube menu",e)}};` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n`;
}

// ----------------------------------------------------------------------------
// Menu real de la tienda (para el selector del panel), desde el HTML publico.

const ACCENTS = { aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü" };

function decode(s) {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&([A-Za-z]+);/g, (m, k) => ACCENTS[k] || m)
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ").trim();
}

// Devuelve el <ul> balanceado que arranca en `start` (indice de "<ul").
function balancedUl(html, start) {
  const re = /<\/?ul\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}
// Hijos <li> directos de un <ul> (string).
function directLis(ul) {
  const inner = ul.replace(/^<ul\b[^>]*>/i, "").replace(/<\/ul>\s*$/i, "");
  const out = [];
  const re = /<\/?li\b[^>]*>/gi;
  let depth = 0, from = -1, m;
  while ((m = re.exec(inner))) {
    if (m[0][1] === "/") {
      depth--;
      if (depth === 0 && from >= 0) { out.push(inner.slice(from, re.lastIndex)); from = -1; }
    } else {
      if (depth === 0) from = m.index;
      depth++;
    }
  }
  return out;
}
function firstLinkText(li) {
  const m = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(li);
  return m ? decode(m[1]) : "";
}

function parseMenuTree(html) {
  const s = String(html || "");
  // Ipanema: <ul class="js-nav-desktop-list nav-desktop-list ...">
  let at = s.search(/<ul[^>]*class="[^"]*js-nav-desktop-list\b/i);
  if (at < 0) {
    const h = s.search(/<header\b/i);
    if (h >= 0) at = s.slice(h).search(/<ul\b/i) + h;
  }
  if (at < 0) return [];
  const ul = balancedUl(s, at);
  return directLis(ul).map((li) => {
    const label = firstLinkText(li);
    const subStart = li.search(/<ul[^>]*class="[^"]*desktop-list-subitems\b/i);
    const anyUl = subStart >= 0 ? subStart : li.slice(1).search(/<ul\b/i) + 1;
    const children = anyUl > 0 ? directLis(balancedUl(li, anyUl)).map(firstLinkText).filter(Boolean) : [];
    return { label, children };
  }).filter((x) => x.label);
}

function storeHomeUrl(store) {
  const c = store || {};
  const domains = Array.isArray(c.domains) ? c.domains : [];
  const raw = String(c.storeUrl || c.url || c.domain || c.url_with_protocol || domains[0] || c.original_domain || "").trim();
  if (!raw) return null;
  const u = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  try { return new URL(u).origin + "/"; } catch (e) { return null; }
}

// URL publica de la tienda: del doc, o (si no la tiene) de la API de Tiendanube.
async function resolveStoreUrl(storeId, { getStoreDoc, getCachedData }) {
  const store = await getStoreDoc(storeId);
  let url = storeHomeUrl(store);
  if (!url && store && store.accessToken) {
    url = await getCachedData(`store-url:${storeId}`, async () => {
      const r = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
        headers: { Authentication: `bearer ${store.accessToken}`, "User-Agent": "GlowLab (info@techdi.com.ar)" },
      });
      return r.ok ? storeHomeUrl(await r.json()) : null;
    });
  }
  return url;
}

function registerStyleMenuRoutes(app, { getStoreDoc, getCachedData }) {
  // Style > Banners (editor v2): bloques de banner de la home para elegir en el panel.
  app.get("/api/style/home-banners", async (req, res) => {
    const storeId = String(req.query.storeId || "");
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const url = await resolveStoreUrl(storeId, { getStoreDoc, getCachedData });
      if (!url) return res.json({ success: true, banners: [], message: "La tienda no tiene URL cargada" });
      const banners = await getCachedData(`home-banners:${storeId}`, async () => {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (GlowLab banner reader)" }, redirect: "follow" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return require("./style-banners").parseHomeBanners(await r.text());
      });
      res.json({ success: true, url, banners });
    } catch (error) {
      console.error("home-banners:", error.message);
      res.json({ success: false, banners: [], message: "No se pudieron leer los banners de la tienda" });
    }
  });

  app.get("/api/style/menu-tree", async (req, res) => {
    const storeId = String(req.query.storeId || "");
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const url = await resolveStoreUrl(storeId, { getStoreDoc, getCachedData });
      if (!url) return res.json({ success: true, tree: [], message: "La tienda no tiene URL cargada" });
      const tree = await getCachedData(`menu-tree:${storeId}`, async () => {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (GlowLab menu reader)" }, redirect: "follow" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return parseMenuTree(await r.text());
      });
      res.json({ success: true, url, tree });
    } catch (error) {
      console.error("menu-tree:", error.message);
      res.json({ success: false, tree: [], message: "No se pudo leer el menú de la tienda" });
    }
  });
}

module.exports = {
  ITEM_DEFAULTS,
  normalize,
  normalizeItem,
  usesNewMenu,
  menuPayload,
  buildMenuScript,
  parseMenuTree,
  storeHomeUrl,
  registerStyleMenuRoutes,
};
