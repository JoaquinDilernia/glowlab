"use strict";

// Style > Barra de encabezado, rehecha para Ipanema (Alto Rancho).
//
// Es la franja finita de arriba de todo con links a los otros sitios
// (altorancho. | altomayorista. | decoradoras | prensa). La version vieja se
// insertaba antes de <header> (afuera del header fijo de Ipanema) y le ponia
// position/z-index !important a todo header y nav de la tienda.
//
// La nueva se monta como la Barra de anuncios: dentro de .sticky-header-wrapper,
// con "estas aca" automatico segun el dominio, separador, dispositivos y fuente.
// Solo las configs del editor nuevo (version: 2) usan este codigo; las viejas
// siguen con el handler viejo de index.js.

const HEX = /^#[0-9a-f]{6}$/i;
const FONTS = ["inherit", "Poppins", "Montserrat", "Inter", "Oswald", "Lato", "Roboto"];
const SEPARATORS = ["|", "·", "/", "•", ""];
const ALIGNMENTS = ["left", "center", "right", "space-between"];
const PLACEMENTS = ["top", "above-logo"];
const DEVICES = ["both", "desktop", "mobile"];
const MAX_ITEMS = 12;

const DEFAULTS = {
  enabled: false,
  version: 2,
  items: [],
  placement: "top",
  sticky: false,
  alignment: "left",
  separator: "|",
  backgroundColor: "#fafafa",
  textColor: "#353434",
  accentColor: "#353434",
  borderBottom: true,
  borderColor: "#e6e6e6",
  font: "inherit",
  fontSize: 12,
  mobileFontSize: 11,
  padding: 7,
  uppercase: false,
  letterSpacing: 0.2,
  currentStyle: "bold", // bold | underline | pill
  autoCurrent: true,
  mobileMode: "scroll", // scroll | hide
};

const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const hexOr = (v, fb) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);
const pick = (v, list, fb) => (list.includes(v) ? v : fb);
function num(v, min, max, fb, step = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.min(max, Math.max(min, Math.round(n / step) * step));
}
function safeLink(value) {
  const s = text(value, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return "https://" + s;
  return "";
}

// fontFamily viejo "'Poppins', sans-serif" | "system-ui" -> "Poppins" | "inherit"
function legacyFont(c) {
  if (FONTS.includes(c.font)) return c.font;
  const m = /'([^']+)'/.exec(String(c.fontFamily || ""));
  return m && FONTS.includes(m[1]) ? m[1] : "inherit";
}

function normalizeItem(i) {
  const c = i || {};
  return {
    text: text(c.text, 60),
    icon: text(c.icon, 8),
    link: safeLink(c.link),
    newTab: c.newTab === true,
    current: c.current === true || c.active === true, // "active" = campo viejo
    side: c.side === "right" || c.position === "right" ? "right" : "left",
    devices: pick(c.devices, DEVICES, "both"),
    hidden: c.hidden === true,
  };
}

function normalize(input) {
  const c = input || {};
  const isNew = c.version === 2;
  return {
    ...DEFAULTS,
    enabled: c.enabled === true,
    items: (Array.isArray(c.items) ? c.items : []).slice(0, MAX_ITEMS).map(normalizeItem),
    placement: pick(c.placement, PLACEMENTS, DEFAULTS.placement),
    sticky: c.sticky === true,
    alignment: pick(c.alignment, ALIGNMENTS, DEFAULTS.alignment),
    separator: SEPARATORS.includes(c.separator) ? c.separator : DEFAULTS.separator,
    backgroundColor: hexOr(c.backgroundColor, DEFAULTS.backgroundColor),
    textColor: hexOr(c.textColor, DEFAULTS.textColor),
    accentColor: hexOr(c.accentColor, hexOr(c.textColor, DEFAULTS.accentColor)),
    borderBottom: isNew ? c.borderBottom !== false : true,
    borderColor: hexOr(c.borderColor, DEFAULTS.borderColor),
    font: legacyFont(c),
    fontSize: num(c.fontSize, 10, 16, DEFAULTS.fontSize),
    mobileFontSize: num(c.mobileFontSize, 9, 15, DEFAULTS.mobileFontSize),
    padding: num(c.padding, 3, 16, DEFAULTS.padding),
    uppercase: c.uppercase === true,
    letterSpacing: num(c.letterSpacing, 0, 3, DEFAULTS.letterSpacing, 0.1),
    currentStyle: pick(c.currentStyle, ["bold", "underline", "pill"], DEFAULTS.currentStyle),
    autoCurrent: c.autoCurrent !== false,
    mobileMode: pick(c.mobileMode, ["scroll", "hide"], DEFAULTS.mobileMode),
    version: 2,
  };
}

const usesNewTopHeader = (cfg) => !!cfg && cfg.version === 2;

function payload(cfg) {
  const n = normalize(cfg);
  return { ...n, items: n.items.filter((i) => !i.hidden && i.text) };
}

// ----------------------------------------------------------------------------
// Script de la tienda. Se serializa con toString(): no usar nada de afuera.
function storefrontTopHeader(C) {
  var ID = "pn-top-header";
  if (window.__pnTopHeaderV2 || document.getElementById(ID)) return;
  window.__pnTopHeaderV2 = true;
  if (!C.items.length) return;

  var host = location.hostname.replace(/^www\./, "");
  function hostOf(link) {
    try { return new URL(link, location.href).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }
  // "Estas aca": marcado a mano, o el link que apunta a este mismo dominio.
  var anyManual = C.items.some(function (i) { return i.current; });
  function isCurrent(it) {
    if (it.current) return true;
    return !anyManual && C.autoCurrent && it.link && hostOf(it.link) === host;
  }

  var b = "#" + ID;
  var justify = { left: "flex-start", center: "center", right: "flex-end", "space-between": "space-between" }[C.alignment];
  var css = [
    b + "{background:" + C.backgroundColor + ";color:" + C.textColor + ";font-size:" + C.fontSize + "px;line-height:1.3;" +
      "padding:" + C.padding + "px 24px;" + (C.borderBottom ? "border-bottom:1px solid " + C.borderColor + ";" : "") +
      (C.font !== "inherit" ? "font-family:'" + C.font + "',sans-serif;" : "") +
      (C.uppercase ? "text-transform:uppercase;" : "") + "letter-spacing:" + C.letterSpacing + "px;box-sizing:border-box;width:100%;position:relative;z-index:2}",
    b + " .pn-th-row{display:flex;align-items:center;justify-content:" + justify + ";gap:24px;max-width:100%}",
    b + " .pn-th-group{display:flex;align-items:center;flex-wrap:nowrap}",
    b + " .pn-th-sep{opacity:.35;padding:0 10px;font-weight:300}",
    b + " .pn-th-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:inherit;text-decoration:none;opacity:.78;transition:opacity .2s ease}",
    b + " a.pn-th-item:hover{opacity:1}",
    b + " .pn-th-cur{opacity:1;color:" + C.accentColor + "}",
    b + " .pn-th-cur.pn-th-bold{font-weight:700}",
    b + " .pn-th-cur.pn-th-underline{text-decoration:underline;text-underline-offset:3px}",
    b + " .pn-th-cur.pn-th-pill{background:" + C.accentColor + ";color:" + C.backgroundColor + ";padding:2px 9px;border-radius:999px}",
    "@media (max-width:767px){" + b + "{font-size:" + C.mobileFontSize + "px;padding-left:12px;padding-right:12px;" +
      (C.mobileMode === "hide" ? "display:none !important" : "overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none") + "}" +
      b + "::-webkit-scrollbar{display:none}" + b + " .pn-th-row{width:max-content;min-width:100%;justify-content:flex-start;gap:14px}" +
      b + " .pn-th-desktop{display:none !important}}",
    "@media (min-width:768px){" + b + " .pn-th-mobile{display:none !important}}",
    ".sticky-header-wrapper.hide-announcements>" + b + ".pn-th-lift{transform:translateY(calc(-1 * var(--announcements-height-negative, 0px)))}",
    b + ".pn-th-lift{transition:transform var(--transition-normal, .3s ease)}",
    b + ".pn-th-gone{display:none !important}",
  ].join("");

  function group(list) {
    var g = document.createElement("div");
    g.className = "pn-th-group";
    list.forEach(function (it, i) {
      if (i > 0 && C.separator) {
        var s = document.createElement("span");
        s.className = "pn-th-sep" + (it.devices !== "both" ? " pn-th-" + it.devices : "");
        s.textContent = C.separator;
        g.appendChild(s);
      }
      var el = document.createElement(it.link ? "a" : "span");
      if (it.link) {
        el.href = it.link;
        if (it.newTab) { el.target = "_blank"; el.rel = "noopener"; }
      }
      el.className = "pn-th-item" + (isCurrent(it) ? " pn-th-cur pn-th-" + C.currentStyle : "") + (it.devices !== "both" ? " pn-th-" + it.devices : "");
      if (isCurrent(it)) el.setAttribute("aria-current", "page");
      if (it.icon) { var ic = document.createElement("span"); ic.textContent = it.icon; el.appendChild(ic); }
      el.appendChild(document.createTextNode(it.text));
      g.appendChild(el);
    });
    return g;
  }

  function fixPlaceholder() {
    var w = document.querySelector(".sticky-header-wrapper");
    var ph = document.querySelector(".sticky-header-placeholder");
    if (w && ph && w.classList.contains("is-fixed")) ph.style.height = w.offsetHeight + "px";
  }

  function init() {
    if (document.getElementById(ID)) return;
    if (C.font !== "inherit" && !document.getElementById("pn-th-font")) {
      var l = document.createElement("link");
      l.id = "pn-th-font";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=" + C.font.replace(/ /g, "+") + ":wght@300;400;500;600;700&display=swap";
      document.head.appendChild(l);
    }
    var st = document.createElement("style");
    st.id = "pn-th-style";
    st.textContent = css;
    document.head.appendChild(st);

    var bar = document.createElement("div");
    bar.id = ID;
    var row = document.createElement("div");
    row.className = "pn-th-row";
    var left = C.items.filter(function (i) { return i.side !== "right"; });
    var right = C.items.filter(function (i) { return i.side === "right"; });
    if (C.alignment === "space-between") {
      row.appendChild(group(left));
      if (right.length) row.appendChild(group(right));
    } else {
      row.appendChild(group(left.concat(right)));
    }
    bar.appendChild(row);

    var w = document.querySelector(".sticky-header-wrapper");
    var head = document.querySelector(".js-head-main");
    var header = document.querySelector(".js-header") || document.querySelector("header");
    var inSticky = false;
    if (C.placement === "top" && w) {
      w.insertBefore(bar, w.firstChild); // arriba de todo, antes que cualquier otra franja
      bar.classList.add("pn-th-lift");
      inSticky = true;
    } else if (C.placement === "above-logo" && head && head.parentNode) {
      head.parentNode.insertBefore(bar, head);
      inSticky = !!(w && w.contains(bar));
    } else if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }

    if (inSticky && !C.sticky) {
      // Al bajar, el header queda fijo sin esta franja.
      bar.classList.remove("pn-th-lift");
      var sync = function () { bar.classList.toggle("pn-th-gone", w.classList.contains("is-fixed")); };
      new MutationObserver(sync).observe(w, { attributes: true, attributeFilter: ["class"] });
      sync();
    } else {
      fixPlaceholder();
      if (window.ResizeObserver) new ResizeObserver(fixPlaceholder).observe(bar);
    }
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* viejo */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}

function buildTopHeaderScript(cfg) {
  const p = payload(cfg);
  return `;(function(){try{(${storefrontTopHeader.toString()})(${JSON.stringify(p)});}catch(e){console.error("PromoNube encabezado",e)}})();\n`;
}

function registerTopHeaderRoute(app, { checkStoreActive, getCachedDoc, legacyHandler }) {
  app.get("/api/top-header-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    try {
      if (!store) return res.send("// storeId requerido");
      if (!(await checkStoreActive(store))) {
        res.setHeader("Cache-Control", "no-store");
        return res.send("// plan inactivo");
      }
      const doc = await getCachedDoc("promonube_style_config", store);
      const cfg = doc.exists ? doc.data().topHeader : null;
      if (legacyHandler && !usesNewTopHeader(cfg)) return legacyHandler(req, res);
      if (!cfg || cfg.enabled !== true) return res.send("// encabezado apagado");
      if (!payload(cfg).items.length) return res.send("// sin links");
      res.send(buildTopHeaderScript(cfg));
    } catch (error) {
      console.error("Error generando top-header-widget:", error);
      res.status(500).send("// error");
    }
  });
}

module.exports = {
  DEFAULTS,
  FONTS,
  normalize,
  usesNewTopHeader,
  payload,
  buildTopHeaderScript,
  registerTopHeaderRoute,
};
