"use strict";

// Style > Banners, rehecho para Ipanema (Alto Rancho).
//
// El modulo viejo ponia botones sobre los slides del carrusel principal de la
// home (.js-home-main-slider-container). Ipanema no tiene ese carrusel: los
// banners son bloques de seccion (data-block-type="banner", data-block-id unico).
// El nuevo apunta a un bloque por su id y le suma encima titulo, bajada y hasta
// 3 botones, con posicion, oscurecido y estilos.
//
// Solo las configs guardadas con el editor nuevo (version: 2) usan este codigo;
// las viejas siguen con customizeBanners() de index.js tal cual.

const HEX = /^#[0-9a-f]{6}$/i;
const POSITIONS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"];
const BTN_STYLES = ["solid", "outline", "link"];
const SIZES = ["sm", "md", "lg"];
const MAX_ITEMS = 30;
const MAX_BUTTONS = 3;

const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const hexOr = (v, fb) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);
const pick = (v, list, fb) => (list.includes(v) ? v : fb);
function num(v, min, max, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
}
function safeUrl(value) {
  const s = text(value, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "/" + s.replace(/^\/+/, "");
}

function normalizeButton(b) {
  const c = b || {};
  return {
    text: text(c.text, 40),
    url: safeUrl(c.url),
    newTab: c.newTab === true,
    style: pick(c.style, BTN_STYLES, "solid"),
    bg: hexOr(c.bg, "#ffffff"),
    color: hexOr(c.color, "#353434"),
  };
}

function normalizeItem(i) {
  const c = i || {};
  return {
    blockId: text(c.blockId, 60).replace(/[^\w-]/g, ""),
    thumb: /^https:\/\//.test(String(c.thumb || "")) ? String(c.thumb).slice(0, 500) : "",
    enabled: c.enabled !== false,
    title: text(c.title, 80),
    subtitle: text(c.subtitle, 160),
    textColor: hexOr(c.textColor, "#ffffff"),
    position: pick(c.position, POSITIONS, "center"),
    mobilePosition: pick(c.mobilePosition, POSITIONS.concat(["same"]), "same"),
    align: pick(c.align, ["left", "center", "right"], "center"),
    overlay: num(c.overlay, 0, 70, 0),
    size: pick(c.size, SIZES, "md"),
    radius: num(c.radius, 0, 40, 4),
    uppercase: c.uppercase === true,
    buttons: (Array.isArray(c.buttons) ? c.buttons : []).slice(0, MAX_BUTTONS).map(normalizeButton),
  };
}

function normalize(input) {
  const c = input || {};
  return {
    enabled: c.enabled === true,
    version: 2,
    items: (Array.isArray(c.items) ? c.items : []).slice(0, MAX_ITEMS).map(normalizeItem),
  };
}

const usesNewBanners = (cfg) => !!cfg && cfg.version === 2;

function payload(cfg) {
  const n = normalize(cfg);
  return {
    items: n.items
      .filter((i) => i.enabled && i.blockId && (i.title || i.subtitle || i.buttons.some((b) => b.text)))
      .map((i) => ({ ...i, thumb: undefined, buttons: i.buttons.filter((b) => b.text) })),
  };
}

// ----------------------------------------------------------------------------
// Script de la tienda. Se serializa con toString(): no usar nada de afuera.
function storefrontBanners(P) {
  if (window.pnBannersV2) return;
  window.pnBannersV2 = true;
  var ITEMS = P.items || [];
  if (!ITEMS.length) return;

  var SIZE = { sm: [18, 13, 12, "8px 16px"], md: [26, 15, 14, "11px 24px"], lg: [36, 17, 15, "14px 30px"] };
  function place(pos) {
    var v = pos.indexOf("top") === 0 ? "flex-start" : pos.indexOf("bottom") === 0 ? "flex-end" : "center";
    var h = /left$/.test(pos) ? "flex-start" : /right$/.test(pos) ? "flex-end" : "center";
    return "justify-content:" + v + ";align-items:" + h;
  }

  var css = [
    ".pn-bn{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;padding:clamp(16px,4vw,48px);pointer-events:none}",
    ".pn-bn-box{display:flex;flex-direction:column;gap:10px;max-width:min(560px,100%);pointer-events:auto}",
    ".pn-bn h2{margin:0;line-height:1.1;font-weight:700;color:inherit}",
    ".pn-bn p{margin:0;line-height:1.4;color:inherit;opacity:.92}",
    ".pn-bn-btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}",
    ".pn-bn-btn{display:inline-block;text-decoration:none !important;font-weight:600;letter-spacing:.02em;transition:transform .2s ease,opacity .2s ease;border:1.5px solid transparent;line-height:1.2}",
    ".pn-bn-btn:hover{transform:translateY(-1px);opacity:.9}",
    ".pn-bn-link{padding:0 !important;border:0 !important;background:none !important;text-decoration:underline !important;text-underline-offset:4px}",
  ];
  ITEMS.forEach(function (it, i) {
    var s = ".pn-bn-" + i, z = SIZE[it.size] || SIZE.md;
    css.push(s + "{color:" + it.textColor + ";" + place(it.position) + ";text-align:" + it.align + (it.overlay ? ";background:rgba(0,0,0," + (it.overlay / 100) + ")" : "") + "}");
    css.push(s + " .pn-bn-box{align-items:" + (it.align === "left" ? "flex-start" : it.align === "right" ? "flex-end" : "center") + "}");
    css.push(s + " h2{font-size:" + z[0] + "px" + (it.uppercase ? ";text-transform:uppercase" : "") + "}");
    css.push(s + " p{font-size:" + z[1] + "px}");
    css.push(s + " .pn-bn-btn{font-size:" + z[2] + "px;padding:" + z[3] + ";border-radius:" + it.radius + "px}");
    if (it.mobilePosition && it.mobilePosition !== "same") {
      css.push("@media (max-width:767px){" + s + "{" + place(it.mobilePosition) + "}" + s + " h2{font-size:" + Math.round(z[0] * 0.75) + "px}}");
    } else {
      css.push("@media (max-width:767px){" + s + " h2{font-size:" + Math.round(z[0] * 0.75) + "px}}");
    }
  });
  var st = document.createElement("style");
  st.id = "pn-banners-v2-css";
  st.textContent = css.join("\n");
  document.head.appendChild(st);

  function build(it, i) {
    var block = document.querySelector('[data-block-id="' + it.blockId + '"]');
    if (!block || block.querySelector(".pn-bn")) return !!block;
    // Ipanema: la foto va en .banner-image-container y el epigrafe abajo; el texto va sobre la foto.
    var host = block.querySelector(".banner-image-container") || block;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    var wrap = document.createElement("div");
    wrap.className = "pn-bn pn-bn-" + i;
    var box = document.createElement("div");
    box.className = "pn-bn-box";
    if (it.title) { var h = document.createElement("h2"); h.textContent = it.title; box.appendChild(h); }
    if (it.subtitle) { var p = document.createElement("p"); p.textContent = it.subtitle; box.appendChild(p); }
    if (it.buttons.length) {
      var row = document.createElement("div");
      row.className = "pn-bn-btns";
      it.buttons.forEach(function (b) {
        var a = document.createElement("a");
        a.className = "pn-bn-btn" + (b.style === "link" ? " pn-bn-link" : "");
        a.textContent = b.text;
        a.href = b.url || "#";
        if (b.newTab) { a.target = "_blank"; a.rel = "noopener"; }
        if (b.style === "solid") { a.style.background = b.bg; a.style.color = b.color; a.style.borderColor = b.bg; }
        else if (b.style === "outline") { a.style.borderColor = b.bg; a.style.color = b.bg; }
        else { a.style.color = b.bg; }
        row.appendChild(a);
      });
      box.appendChild(row);
    }
    wrap.appendChild(box);
    host.appendChild(wrap);
    return true;
  }

  var pending = ITEMS.map(function (it, i) { return [it, i]; });
  function run() { pending = pending.filter(function (x) { return !build(x[0], x[1]); }); }
  run();
  // Secciones que cargan tarde (lazy): reintentar unos segundos.
  var tries = 0;
  var t = setInterval(function () { run(); if (!pending.length || ++tries > 20) clearInterval(t); }, 500);
}

function buildBannersScript(cfg) {
  if (!usesNewBanners(cfg) || cfg.enabled !== true) return "";
  const p = payload(cfg);
  if (!p.items.length) return "";
  const run = `(${storefrontBanners.toString()})(${JSON.stringify(p)});`;
  return `\n;(function(){var go=function(){try{${run}}catch(e){console.error("PromoNube banners",e)}};` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n`;
}

// ----------------------------------------------------------------------------
// Banners de la home (para elegir en el panel), desde el HTML publico.
function parseHomeBanners(html) {
  const s = String(html || "");
  const re = /data-block-id="([\w-]+)"\s+data-block-type="banner"/g;
  const starts = [];
  let m;
  while ((m = re.exec(s))) starts.push({ id: m[1], at: m.index });
  return starts.map((b, i) => {
    const seg = s.slice(b.at, i + 1 < starts.length ? Math.min(starts[i + 1].at, b.at + 12000) : b.at + 12000);
    const webp = /(https:\/\/[^"\s]+\/webp\/640\.webp)/.exec(seg);
    const any = /data-src="(https:\/\/[^"]+)"/.exec(seg) || /srcset="(https:\/\/[^"\s]+)/.exec(seg);
    const link = /<a\b[^>]*href="(https?:\/\/[^"]+)"/.exec(seg);
    return { blockId: b.id, thumb: (webp && webp[1]) || (any && any[1]) || "", link: link ? link[1] : "" };
  });
}

module.exports = {
  POSITIONS,
  normalize,
  usesNewBanners,
  payload,
  buildBannersScript,
  parseHomeBanners,
};
