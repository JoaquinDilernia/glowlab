"use strict";

// Barra de anuncios (Style > "Barra de anuncios", antes "Menú superior").
// Una franja con mensajes cortos con link ("New in | Sillas", "Envío gratis"...).
// La config vive en promonube_style_config/{store}.topAnnouncementBar (se guarda
// con el resto de Style por POST /api/style-config); aca se normaliza y se arma
// el script que carga la tienda por GET /api/top-announcement-bar-widget.js.
//
// Pensada para Ipanema (Alto Rancho). Antes se metia "entre el logo y el nav",
// que en Ipanema cae adentro de .nav-desktop-container: oculto en celular.
// Ubicaciones:
//   "below-header": ultima dentro de .js-head-main (abajo del menu en compu,
//                   abajo del logo en celu). Queda fija con el header.
//   "above-logo":   justo arriba de .js-head-main.
//   "top":          primera de todo (despues de la Cuenta Regresiva si esta).
// Fuera de Ipanema cae antes/despues del primer <header>.

const MAX_MESSAGES = 12;
const FONTS = ["inherit", "Poppins", "Montserrat", "Inter", "Oswald", "Bebas Neue", "Playfair Display", "Lato", "Roboto"];
const PLACEMENTS = ["below-header", "above-logo", "top"];
const MODES = ["static", "rotate", "marquee"];
const SEPARATORS = ["|", "•", "·", "—", "/", ""];
const ALIGNS = ["left", "center", "right"];
const HIGHLIGHTS = ["none", "bold", "color", "pill"];
const VISIBILITY = ["both", "desktop", "mobile"];
const DEFAULT_TZ_OFFSET = "-03:00";

const DEFAULTS = {
  enabled: false,
  messages: [],
  placement: "below-header",
  sticky: true,
  desktopMode: "static",
  mobileMode: "rotate",
  rotateSeconds: 4,
  marqueeSpeed: 40, // px por segundo
  separator: "|",
  alignment: "center",
  messageGap: 18,
  backgroundColor: "#1a1a1a",
  textColor: "#ffffff",
  linkUnderline: "hover", // "hover" | "always" | "never"
  font: "inherit",
  fontSize: 13,
  mobileFontSize: 12,
  fontWeight: 500,
  uppercase: false,
  letterSpacing: 0.3,
  padding: 11,
  borderBottom: false,
  borderTop: false,
  borderColor: "#e3e3e3",
  visibility: "both",
};

const HEX = /^#[0-9a-f]{6}$/i;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const pick = (v, list, fb) => (list.includes(v) ? v : fb);
const hex = (v, fb) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fb);
const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
function num(v, min, max, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
}

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

// Config vieja: fontFamily "'Poppins', sans-serif" | "system-ui"; insertMode;
// borderEnabled + borderTop/Bottom/Left/Right.
function legacyFont(c) {
  if (FONTS.includes(c.font)) return c.font;
  if (c.version === 2) return "inherit";
  const m = /^'([^']+)'/.exec(String(c.fontFamily || ""));
  if (m && FONTS.includes(m[1])) return m[1];
  return "inherit";
}
function legacyPlacement(c) {
  if (PLACEMENTS.includes(c.placement)) return c.placement;
  if (c.version === 2) return "below-header";
  if (c.insertMode === "before-header" || c.insertMode === "inside-header-top") return "top";
  return "below-header";
}

function normalizeMessage(m) {
  const c = m || {};
  return {
    text: text(c.text, 120),
    link: safeUrl(c.link),
    emoji: text(c.emoji, 8),
    highlight: pick(c.highlight, HIGHLIGHTS, "none"),
    highlightColor: hex(c.highlightColor, "#ffd166"),
    startDate: toIso(c.startDate),
    endDate: toIso(c.endDate),
    newTab: c.newTab === true,
  };
}

function normalize(input) {
  const c = input || {};
  // El editor nuevo guarda version: 2. Style guarda con merge, asi que los campos
  // viejos (borderEnabled, fontFamily, insertMode) quedan en el doc: con v2 se ignoran.
  const v2 = c.version === 2;
  const legacyBorder = v2 || c.borderEnabled === undefined ? null : c.borderEnabled === true;
  return {
    version: 2,
    enabled: c.enabled === true,
    messages: (Array.isArray(c.messages) ? c.messages : [])
      .map(normalizeMessage).filter(m => m.text).slice(0, MAX_MESSAGES),
    placement: legacyPlacement(c),
    sticky: c.sticky !== false,
    desktopMode: pick(c.desktopMode, MODES, DEFAULTS.desktopMode),
    mobileMode: pick(c.mobileMode, MODES, DEFAULTS.mobileMode),
    rotateSeconds: num(c.rotateSeconds, 2, 15, DEFAULTS.rotateSeconds),
    marqueeSpeed: num(c.marqueeSpeed, 10, 150, DEFAULTS.marqueeSpeed),
    separator: SEPARATORS.includes(c.separator) ? c.separator : DEFAULTS.separator,
    alignment: pick(c.alignment, ALIGNS, DEFAULTS.alignment),
    messageGap: Math.round(num(c.messageGap, 0, 80, DEFAULTS.messageGap)),
    backgroundColor: hex(c.backgroundColor, DEFAULTS.backgroundColor),
    textColor: hex(c.textColor, DEFAULTS.textColor),
    linkUnderline: pick(c.linkUnderline, ["hover", "always", "never"], DEFAULTS.linkUnderline),
    font: legacyFont(c),
    fontSize: Math.round(num(c.fontSize, 9, 24, DEFAULTS.fontSize)),
    mobileFontSize: Math.round(num(c.mobileFontSize, 9, 22, Math.min(num(c.fontSize, 9, 24, 13), DEFAULTS.mobileFontSize))),
    fontWeight: Math.round(num(c.fontWeight, 300, 800, DEFAULTS.fontWeight) / 100) * 100,
    uppercase: c.uppercase === true,
    letterSpacing: num(c.letterSpacing, 0, 4, DEFAULTS.letterSpacing),
    padding: Math.round(num(c.padding, 2, 30, DEFAULTS.padding)),
    borderBottom: legacyBorder === false ? false : c.borderBottom === true,
    borderTop: legacyBorder === false ? false : c.borderTop === true,
    borderColor: hex(c.borderColor, DEFAULTS.borderColor),
    visibility: pick(c.visibility, VISIBILITY, DEFAULTS.visibility),
  };
}

// Mensajes que todavia pueden verse (sin vencer), para no mandar de mas.
function liveMessages(messages, now = Date.now()) {
  return messages.filter(m => {
    const end = parseDate(m.endDate);
    return !(Number.isFinite(end) && end <= now);
  });
}

function widgetPayload(cfg) {
  const c = normalize(cfg);
  return {
    ...c,
    messages: liveMessages(c.messages).map(m => ({
      ...m,
      start: Number.isFinite(parseDate(m.startDate)) ? parseDate(m.startDate) : null,
      end: Number.isFinite(parseDate(m.endDate)) ? parseDate(m.endDate) : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Script de la tienda (se serializa con toString(); no corre en el servidor).
// ---------------------------------------------------------------------------
function storefrontAnnouncement(C) {
  if (window.__pnTopAnnInit) return;
  window.__pnTopAnnInit = true;

  var ID = "pn-top-announcement-bar";
  var MQ = window.matchMedia ? window.matchMedia("(max-width: 767px)") : { matches: window.innerWidth < 768 };

  function active(now) {
    return C.messages.filter(function (m) {
      return (m.start == null || m.start <= now) && (m.end == null || m.end > now);
    });
  }

  function hexA(h, a) {
    var n = parseInt(h.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function css() {
    var b = "#" + ID;
    var font = C.font === "inherit" ? "inherit" : '"' + C.font + '", sans-serif';
    var deco = C.linkUnderline === "always" ? "underline" : "none";
    var justify = C.alignment === "left" ? "flex-start" : C.alignment === "right" ? "flex-end" : "center";
    return [
      b + "{position:relative;z-index:999;width:100%;box-sizing:border-box;background:" + C.backgroundColor + ";color:" + C.textColor + ";",
      "font-family:" + font + ";font-size:" + C.fontSize + "px;font-weight:" + C.fontWeight + ";letter-spacing:" + C.letterSpacing + "px;line-height:1.4;",
      (C.uppercase ? "text-transform:uppercase;" : ""),
      "padding:" + C.padding + "px 16px;overflow:hidden;",
      (C.borderTop ? "border-top:1px solid " + C.borderColor + ";" : ""),
      (C.borderBottom ? "border-bottom:1px solid " + C.borderColor + ";" : ""),
      "}",
      b + " *{box-sizing:border-box;font-family:inherit}",
      b + " a{color:inherit !important;text-decoration:" + deco + ";}",
      (C.linkUnderline === "hover" ? b + " a:hover{text-decoration:underline}" : ""),
      b + " .pn-ta-item{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}",
      b + " .pn-ta-bold{font-weight:800}",
      b + " .pn-ta-pill{padding:2px 10px;border-radius:999px}",
      b + " .pn-ta-sep{opacity:.5;font-weight:300;padding:0 " + C.messageGap + "px}",
      b + " .pn-ta-static{display:flex;flex-wrap:wrap;justify-content:" + justify + ";align-items:center;row-gap:4px}",
      b + " .pn-ta-static .pn-ta-noSep{padding:0 " + Math.round(C.messageGap / 2) + "px}",
      b + " .pn-ta-rotate{position:relative;display:flex;justify-content:" + justify + ";text-align:" + C.alignment + "}",
      b + " .pn-ta-rotate .pn-ta-item{transition:opacity .35s ease,transform .35s ease;white-space:normal}",
      b + " .pn-ta-rotate .pn-ta-out{opacity:0;transform:translateY(-6px)}",
      b + " .pn-ta-marquee{display:flex;width:max-content;animation:pnTaMarquee var(--pn-ta-dur,30s) linear infinite}",
      b + " .pn-ta-marquee:hover{animation-play-state:paused}",
      b + " .pn-ta-group{display:flex;align-items:center;flex-shrink:0}",
      "@keyframes pnTaMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
      "@media (max-width:767px){" + b + "{font-size:" + C.mobileFontSize + "px;padding-left:12px;padding-right:12px}}",
      "@media (prefers-reduced-motion:reduce){" + b + " .pn-ta-marquee{animation:none}}",
      ".sticky-header-wrapper.hide-announcements>" + b + ".pn-ta-lift{transform:translateY(calc(-1 * var(--announcements-height-negative, 0px)))}",
      b + ".pn-ta-gone{display:none !important}",
      b + ".pn-ta-lift{transition:transform var(--transition-normal, .3s ease)}",
    ].join("");
  }

  function item(m) {
    var el;
    if (m.link) {
      el = document.createElement("a");
      el.href = m.link;
      if (m.newTab) { el.target = "_blank"; el.rel = "noopener"; }
    } else {
      el = document.createElement("span");
    }
    el.className = "pn-ta-item";
    if (m.highlight === "bold") el.classList.add("pn-ta-bold");
    if (m.highlight === "color") { el.style.color = m.highlightColor; el.classList.add("pn-ta-bold"); }
    if (m.highlight === "pill") {
      el.classList.add("pn-ta-pill", "pn-ta-bold");
      el.style.background = m.highlightColor;
      el.style.color = contrast(m.highlightColor);
    }
    if (m.emoji) {
      var e = document.createElement("span");
      e.textContent = m.emoji;
      e.setAttribute("aria-hidden", "true");
      el.appendChild(e);
    }
    el.appendChild(document.createTextNode(m.text));
    return el;
  }

  function contrast(h) {
    var n = parseInt(h.slice(1), 16);
    var l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return l > 150 ? "#111111" : "#ffffff";
  }

  function sep() {
    var s = document.createElement("span");
    s.className = C.separator ? "pn-ta-sep" : "pn-ta-sep pn-ta-noSep";
    s.textContent = C.separator;
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  var bar = null, timer = null;

  function build() {
    if (timer) { clearInterval(timer); timer = null; }
    var list = active(Date.now());
    var mobile = MQ.matches;
    if ((C.visibility === "desktop" && mobile) || (C.visibility === "mobile" && !mobile) || !list.length) {
      if (bar) bar.style.display = "none";
      return;
    }
    bar.style.display = "";
    bar.innerHTML = "";
    var mode = mobile ? C.mobileMode : C.desktopMode;
    if (list.length === 1 && mode === "rotate") mode = "static";

    if (mode === "rotate") {
      var box = document.createElement("div");
      box.className = "pn-ta-rotate";
      var i = 0;
      var cur = item(list[0]);
      box.appendChild(cur);
      bar.appendChild(box);
      timer = setInterval(function () {
        cur.classList.add("pn-ta-out");
        setTimeout(function () {
          i = (i + 1) % list.length;
          var next = item(list[i]);
          next.classList.add("pn-ta-out");
          box.replaceChild(next, cur);
          cur = next;
          // reflow para que la transicion arranque
          void next.offsetWidth;
          next.classList.remove("pn-ta-out");
        }, 350);
      }, C.rotateSeconds * 1000);
    } else if (mode === "marquee") {
      // Un grupo con los mensajes (repetidos hasta llenar el ancho) y una copia
      // igual al lado: la animacion corre -50% y vuelve sin salto.
      var track = document.createElement("div");
      track.className = "pn-ta-marquee";
      var group = document.createElement("div");
      group.className = "pn-ta-group";
      var fill = function () { list.forEach(function (m) { group.appendChild(item(m)); group.appendChild(sep()); }); };
      fill();
      track.appendChild(group);
      bar.appendChild(track);
      requestAnimationFrame(function () {
        var reps = 0;
        while (group.scrollWidth < bar.clientWidth && reps < 8) { fill(); reps++; }
        track.appendChild(group.cloneNode(true));
        track.style.setProperty("--pn-ta-dur", Math.max(5, group.scrollWidth / C.marqueeSpeed) + "s");
      });
    } else {
      var row = document.createElement("div");
      row.className = "pn-ta-static";
      list.forEach(function (m, idx) {
        if (idx > 0) row.appendChild(sep());
        row.appendChild(item(m));
      });
      bar.appendChild(row);
    }
  }

  function fixPlaceholder() {
    var w = document.querySelector(".sticky-header-wrapper");
    var ph = document.querySelector(".sticky-header-placeholder");
    if (w && ph && w.classList.contains("is-fixed")) ph.style.height = w.offsetHeight + "px";
  }

  function mount() {
    var w = document.querySelector(".sticky-header-wrapper");
    var head = document.querySelector(".js-head-main");
    var header = document.querySelector(".js-header") || document.querySelector("header");
    var inSticky = false;
    if (C.placement === "top" && w) {
      // Despues de la Cuenta Regresiva, si esta arriba de todo
      var first = w.firstChild;
      while (first && first.id === "pn-countdown-bar") first = first.nextSibling;
      w.insertBefore(bar, first);
      bar.classList.add("pn-ta-lift");
      inSticky = true;
    } else if (C.placement === "above-logo" && head && head.parentNode) {
      head.parentNode.insertBefore(bar, head);
      inSticky = !!(w && w.contains(bar));
    } else if (C.placement === "below-header" && head) {
      head.appendChild(bar);
      inSticky = !!(w && w.contains(bar));
    } else if (header && header.parentNode) {
      if (C.placement === "below-header") header.parentNode.insertBefore(bar, header.nextSibling);
      else header.parentNode.insertBefore(bar, header);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }

    if (inSticky && !C.sticky) {
      // Igual que la Cuenta Regresiva: se oculta cuando el header pasa a fijo,
      // el tema ya reservo el alto con la barra visible.
      bar.classList.remove("pn-ta-lift");
      var sync = function () { bar.classList.toggle("pn-ta-gone", w.classList.contains("is-fixed")); };
      new MutationObserver(sync).observe(w, { attributes: true, attributeFilter: ["class"] });
      sync();
    } else {
      fixPlaceholder();
      if (window.ResizeObserver) new ResizeObserver(fixPlaceholder).observe(bar);
    }
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* viejo */ }
  }

  function init() {
    if (document.getElementById(ID)) return;
    if (C.font !== "inherit" && !document.getElementById("pn-ta-font")) {
      var l = document.createElement("link");
      l.id = "pn-ta-font";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=" + C.font.replace(/ /g, "+") + ":wght@300;400;500;600;700;800&display=swap";
      document.head.appendChild(l);
    }
    var st = document.createElement("style");
    st.id = "pn-ta-style";
    st.textContent = css();
    document.head.appendChild(st);
    bar = document.createElement("div");
    bar.id = ID;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Anuncios");
    build();
    mount();
    if (MQ.addEventListener) MQ.addEventListener("change", build);
    // Mensajes programados: se revisa cada minuto si alguno empieza o vence.
    var sig = "";
    setInterval(function () {
      var s = active(Date.now()).map(function (m) { return m.text; }).join("|");
      if (s !== sig) { sig = s; build(); }
    }, 60000);
    sig = active(Date.now()).map(function (m) { return m.text; }).join("|");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}

function buildWidgetScript(cfg) {
  return `(${storefrontAnnouncement.toString()})(${JSON.stringify(widgetPayload(cfg))});`;
}

// Config guardada con el editor nuevo => version 2. Todo lo demas sigue con el
// widget viejo (legacyHandler) para no cambiar tiendas que nadie volvio a guardar.
const usesNewWidget = (cfg) => !!cfg && cfg.version === 2;

function registerTopAnnouncementRoutes(app, { checkStoreActive, getCachedDoc, legacyHandler }) {
  app.get("/api/top-announcement-bar-widget.js", async (req, res) => {
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
      const cfg = doc.exists ? doc.data().topAnnouncementBar : null;
      if (legacyHandler && !usesNewWidget(cfg)) return legacyHandler(req, res);
      if (!cfg || cfg.enabled !== true) return res.send("// barra de anuncios apagada");
      const payload = widgetPayload(cfg);
      if (!payload.messages.length) return res.send("// sin mensajes");
      res.send(buildWidgetScript(cfg));
    } catch (error) {
      console.error("Error generando top-announcement-bar-widget:", error);
      res.status(500).send("// error");
    }
  });
}

module.exports = {
  DEFAULTS,
  FONTS,
  normalize,
  normalizeMessage,
  liveMessages,
  widgetPayload,
  buildWidgetScript,
  usesNewWidget,
  registerTopAnnouncementRoutes,
};
