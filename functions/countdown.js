"use strict";

// Cuenta Regresiva: una barra con un contador hasta una fecha (fin de una promo,
// lanzamiento, evento). Se puede programar el inicio; fuera de la ventana
// [inicio, fin) no se muestra. Si hay varias activas a la vez se muestra la que
// termina antes.
//
// El script que ve la tienda lo carga el script de Partners "countdown-widget"
// (fetch + eval de GET /api/countdown-widget.js?store=X), asi que cambiar este
// archivo alcanza: no hay que subir una version nueva en Partners.
//
// Ubicacion "header": pensada para la plantilla Ipanema (Alto Rancho). Ipanema
// mete los avisos de arriba y el header (.js-head-main) en un
// .sticky-header-wrapper que se vuelve fijo al bajar y esconde los avisos. La
// barra va justo arriba de .js-head-main, dentro de ese wrapper, asi queda fija
// pegada al header mientras se scrollea. En otras plantillas cae arriba del
// primer <header>.

const COLLECTION = "promonube_countdowns";
const DEFAULT_TZ_OFFSET = "-03:00"; // Argentina, para fechas viejas sin zona

const FONTS = ["inherit", "Poppins", "Montserrat", "Inter", "Oswald", "Bebas Neue", "Playfair Display"];
const PLACEMENTS = ["header", "top", "bottom"];
const TIMER_STYLES = ["boxes", "inline", "clock"];
const SIZE_KEYS = ["sm", "md", "lg"];
const PAGES = ["all", "home"];

// Mismos valores que SIZES en src/components/CountdownBarPreview.jsx (vista previa).
// msg/digit/label en px; padY padding vertical de la barra; box = ancho minimo de cada cajita.
const SIZES = {
  sm: { msg: 13, digit: 15, label: 9, padY: 7, box: 34, btn: 12 },
  md: { msg: 15, digit: 18, label: 10, padY: 9, box: 40, btn: 13 },
  lg: { msg: 17, digit: 22, label: 11, padY: 12, box: 48, btn: 14 },
};
// Tamaño de letra a mano (px), pisa al del tamaño elegido. null = el del tamaño.
const FONT_PX = { msg: [10, 36], digit: [10, 48] };
// En celular todo se achica a esta proporcion.
const MOBILE_SCALE = 0.85;

const DEFAULTS = {
  name: "Mi cuenta regresiva",
  enabled: true,
  startDate: null,
  endDate: null,
  message: "Últimas horas de la promo",
  buttonText: "",
  buttonUrl: "",
  placement: "header",
  timerStyle: "boxes",
  size: "md",
  messageSize: null,
  digitSize: null,
  font: "inherit",
  backgroundColor: "#353434",
  textColor: "#ffffff",
  timerColor: "#ffffff",
  boxColor: "#ffffff",
  buttonColor: "#ffffff",
  buttonTextColor: "#353434",
  showLabels: true,
  showCloseButton: true,
  hideButtonOnMobile: false,
  pages: "all",
};

const HEX = /^#[0-9a-f]{6}$/i;
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function fontPx(value, [min, max]) {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function hex(value, fallback) {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;
}

function text(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

// Fechas: las nuevas se guardan en ISO con zona (el panel manda toISOString).
// Las viejas venian del <input datetime-local> sin zona ("2026-05-17T23:59") y
// el servidor (UTC) las leia 3 horas antes: se toman como hora argentina.
function parseDate(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  const s = String(value).trim();
  if (LOCAL_DT.test(s)) return Date.parse(s + DEFAULT_TZ_OFFSET);
  return Date.parse(s);
}

function toIso(value) {
  const ms = parseDate(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Solo links relativos de la tienda o http(s): nada de javascript:.
function safeUrl(value) {
  const s = text(value, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "/" + s.replace(/^\/+/, "");
}

// Los docs viejos tenian position top/bottom + pushContent; se mapean.
function legacyPlacement(c) {
  if (PLACEMENTS.includes(c.placement)) return c.placement;
  if (c.position === "bottom") return "bottom";
  if (c.position === "top") return "top";
  return DEFAULTS.placement;
}

function normalize(input) {
  const c = input || {};
  // Docs viejos: el icono iba aparte del mensaje (y a veces tambien adentro).
  const icon = c.icon && !c.placement ? String(c.icon) : "";
  const rawMsg = c.message != null ? String(c.message) : DEFAULTS.message;
  const legacyIcon = icon && !rawMsg.trim().startsWith(icon) ? icon + " " : "";
  return {
    name: text(c.name, 80) || DEFAULTS.name,
    enabled: c.enabled !== false,
    startDate: toIso(c.startDate),
    endDate: toIso(c.endDate),
    message: text(legacyIcon + rawMsg, 120),
    buttonText: text(c.buttonText, 30),
    buttonUrl: safeUrl(c.buttonUrl),
    placement: legacyPlacement(c),
    timerStyle: pick(c.timerStyle, TIMER_STYLES, DEFAULTS.timerStyle),
    size: pick(c.size, SIZE_KEYS, DEFAULTS.size),
    messageSize: fontPx(c.messageSize, FONT_PX.msg),
    digitSize: fontPx(c.digitSize, FONT_PX.digit),
    font: pick(c.font, FONTS, DEFAULTS.font),
    backgroundColor: hex(c.backgroundColor, DEFAULTS.backgroundColor),
    textColor: hex(c.textColor, DEFAULTS.textColor),
    timerColor: hex(c.timerColor, DEFAULTS.timerColor),
    boxColor: hex(c.boxColor, hex(c.timerColor, DEFAULTS.boxColor)),
    buttonColor: hex(c.buttonColor, DEFAULTS.buttonColor),
    buttonTextColor: hex(c.buttonTextColor, DEFAULTS.buttonTextColor),
    showLabels: c.showLabels !== false,
    showCloseButton: c.showCloseButton !== false,
    hideButtonOnMobile: c.hideButtonOnMobile === true,
    pages: pick(c.pages, PAGES, DEFAULTS.pages),
  };
}

function validate(cd) {
  const end = parseDate(cd.endDate);
  if (!Number.isFinite(end)) return "Falta la fecha de fin";
  const start = parseDate(cd.startDate);
  if (Number.isFinite(start) && start >= end) return "El inicio tiene que ser antes del fin";
  return null;
}

// "scheduled" | "live" | "ended" | "paused"
function statusOf(cd, now = Date.now()) {
  if (cd.enabled === false) return "paused";
  const end = parseDate(cd.endDate);
  if (!Number.isFinite(end) || end <= now) return "ended";
  const start = parseDate(cd.startDate);
  if (Number.isFinite(start) && start > now) return "scheduled";
  return "live";
}

// Las que todavia pueden mostrarse (en vivo o programadas), la que termina antes primero.
// El script de la tienda vuelve a mirar las fechas, asi una programada aparece
// en su horario aunque la respuesta este cacheada.
function upcomingForWidget(list, now = Date.now()) {
  return list
    .filter(cd => { const s = statusOf(cd, now); return s === "live" || s === "scheduled"; })
    .sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));
}

// La que se esta mostrando ahora en la tienda (para marcarla en el panel).
function currentlyShown(list, now = Date.now()) {
  const live = list.filter(cd => statusOf(cd, now) === "live");
  live.sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));
  return live[0] || null;
}

function widgetPayload(id, raw) {
  const cd = normalize(raw);
  return {
    id,
    v: String(raw.updatedAt || ""),
    start: Number.isFinite(parseDate(cd.startDate)) ? parseDate(cd.startDate) : null,
    end: parseDate(cd.endDate),
    message: cd.message,
    buttonText: cd.buttonText,
    buttonUrl: cd.buttonUrl,
    placement: cd.placement,
    timerStyle: cd.timerStyle,
    size: cd.size,
    msgPx: cd.messageSize,
    digitPx: cd.digitSize,
    font: cd.font,
    bg: cd.backgroundColor,
    fg: cd.textColor,
    timer: cd.timerColor,
    box: cd.boxColor,
    btnBg: cd.buttonColor,
    btnFg: cd.buttonTextColor,
    labels: cd.showLabels,
    close: cd.showCloseButton,
    hideBtnMobile: cd.hideButtonOnMobile,
    pages: cd.pages,
  };
}

// ---------------------------------------------------------------------------
// Script de la tienda. Esta funcion NO corre en el servidor: se serializa con
// toString() y se manda al navegador con los datos como argumentos.
// ---------------------------------------------------------------------------
function storefrontCountdown(LIST, API, SIZES, MOBILE_SCALE) {
  if (window.__pnCountdownInit) return;
  window.__pnCountdownInit = true;

  var ID = "pn-countdown-bar";
  var MOBILE_MQ = "(max-width: 767px)";

  function pickLive() {
    var now = Date.now();
    for (var i = 0; i < LIST.length; i++) {
      var c = LIST[i];
      if (c.end > now && (c.start == null || c.start <= now) && !wasClosed(c) && pageMatches(c)) return c;
    }
    return null;
  }

  function nextStart() {
    var now = Date.now(), best = null;
    for (var i = 0; i < LIST.length; i++) {
      var c = LIST[i];
      if (c.start != null && c.start > now && (best == null || c.start < best)) best = c.start;
    }
    return best;
  }

  function pageMatches(c) {
    if (c.pages !== "home") return true;
    var b = document.body;
    return location.pathname === "/" || (b && b.classList.contains("template-home"));
  }

  function closedKey(c) { return "pn_cd_closed_" + c.id + "_" + c.v; }
  function wasClosed(c) {
    try { return sessionStorage.getItem(closedKey(c)) === "1"; } catch (e) { return false; }
  }

  function track(c, action) {
    if (action === "impression") {
      var k = "pn_cd_seen_" + c.id;
      try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch (e) { /* sin storage */ }
    }
    try {
      fetch(API + "/api/countdowns/" + encodeURIComponent(c.id) + "/track", {
        method: "POST", keepalive: true, credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action }),
      }).catch(function () {});
    } catch (e) { /* nada */ }
  }

  function css(c) {
    var base = SIZES[c.size] || SIZES.md;
    // Letra a mano: las cajitas y las etiquetas acompañan el tamaño de los numeros.
    var digit = c.digitPx || base.digit;
    var s = {
      msg: c.msgPx || base.msg, digit: digit, padY: base.padY, btn: base.btn,
      box: Math.max(base.box, Math.round(digit * 2.2)), label: Math.max(base.label, Math.round(digit * 0.5)),
    };
    var m = MOBILE_SCALE;
    var font = c.font === "inherit" ? "inherit" : '"' + c.font + '", sans-serif';
    var r = function (n) { return Math.round(n * m) + "px"; };
    var bar = "#" + ID;
    return [
      bar + "{position:relative;z-index:1001;width:100%;box-sizing:border-box;background:" + c.bg + ";color:" + c.fg + ";font-family:" + font + ";",
      "padding:" + s.padY + "px 48px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 18px;line-height:1.2;text-align:center;",
      "animation:pnCdIn .35s cubic-bezier(.16,1,.3,1)}",
      bar + ".pn-cd-bottom{position:fixed;left:0;right:0;bottom:0;z-index:9990;padding-bottom:calc(" + s.padY + "px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 16px rgba(0,0,0,.15);animation-name:pnCdUp}",
      bar + " *{box-sizing:border-box;font-family:inherit}",
      bar + " .pn-cd-msg{font-size:" + s.msg + "px;font-weight:600;letter-spacing:.01em;margin:0}",
      bar + " .pn-cd-timer{display:flex;align-items:center;gap:4px;color:" + c.timer + ";font-variant-numeric:tabular-nums}",
      bar + " .pn-cd-unit{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}",
      bar + " .pn-cd-num{font-size:" + s.digit + "px;font-weight:700}",
      bar + " .pn-cd-lbl{font-size:" + s.label + "px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;opacity:.75;margin-top:3px}",
      bar + " .pn-cd-sep{font-size:" + s.digit + "px;font-weight:700;opacity:.6;padding:0 1px}",
      bar + ".pn-cd-boxes .pn-cd-unit{min-width:" + s.box + "px;padding:5px 4px;border-radius:6px;border:1px solid " + hexA(c.box, 0.35) + ";background:" + hexA(c.box, 0.12) + "}",
      bar + ".pn-cd-boxes .pn-cd-sep," + bar + ".pn-cd-inline .pn-cd-sep{display:none}",
      bar + ".pn-cd-inline .pn-cd-timer{gap:7px}",
      bar + ".pn-cd-inline .pn-cd-unit{flex-direction:row;align-items:baseline;gap:1px}",
      bar + ".pn-cd-inline .pn-cd-lbl{margin:0;text-transform:none;font-size:" + Math.round(s.digit * 0.7) + "px;opacity:.8;letter-spacing:0}",
      bar + " .pn-cd-btn{display:inline-block;background:" + c.btnBg + ";color:" + c.btnFg + ";font-size:" + s.btn + "px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;",
      "text-decoration:none;padding:8px 18px;border-radius:999px;white-space:nowrap;transition:transform .15s ease,opacity .15s ease}",
      bar + " .pn-cd-btn:hover{opacity:.9;transform:translateY(-1px);color:" + c.btnFg + ";text-decoration:none}",
      bar + " .pn-cd-close{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:30px;height:30px;display:flex;align-items:center;justify-content:center;",
      "background:transparent;border:0;padding:0;margin:0;color:" + c.fg + ";opacity:.7;cursor:pointer;border-radius:50%}",
      bar + " .pn-cd-close:hover{opacity:1;background:" + hexA(c.fg, 0.12) + "}",
      bar + ".pn-cd-bottom .pn-cd-close{top:12px;transform:none}",
      "@keyframes pnCdIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}",
      "@keyframes pnCdUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}",
      "@media " + MOBILE_MQ + "{",
      bar + "{padding:" + r(s.padY) + " 40px " + r(s.padY) + " 12px;gap:6px 10px}",
      bar + ".pn-cd-bottom{padding-bottom:calc(" + r(s.padY) + " + env(safe-area-inset-bottom,0px))}",
      bar + " .pn-cd-msg{font-size:" + r(s.msg) + ";flex-basis:100%}",
      bar + ".pn-cd-short .pn-cd-msg{flex-basis:auto}",
      bar + " .pn-cd-num," + bar + " .pn-cd-sep{font-size:" + r(s.digit) + "}",
      bar + ".pn-cd-boxes .pn-cd-unit{min-width:" + r(s.box) + ";padding:4px 3px}",
      bar + " .pn-cd-btn{font-size:" + r(s.btn) + ";padding:6px 12px}",
      bar + ".pn-cd-hide-btn-m .pn-cd-btn{display:none}",
      bar + " .pn-cd-close{right:4px}",
      "}",
    ].join("");
  }

  function hexA(h, a) {
    var n = parseInt(h.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function loadFont(c) {
    if (c.font === "inherit" || document.getElementById("pn-cd-font")) return;
    var l = document.createElement("link");
    l.id = "pn-cd-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + c.font.replace(/ /g, "+") + ":wght@500;600;700&display=swap";
    document.head.appendChild(l);
  }

  // Ipanema: si el header ya esta fijo, el placeholder que reserva su lugar
  // quedo medido sin la barra; se corrige para que no tape el contenido.
  function fixStickyPlaceholder() {
    var w = document.querySelector(".sticky-header-wrapper");
    var ph = document.querySelector(".sticky-header-placeholder");
    if (w && ph && w.classList.contains("is-fixed")) ph.style.height = w.offsetHeight + "px";
  }

  function mount(bar, c) {
    if (c.placement === "bottom") {
      bar.classList.add("pn-cd-bottom");
      document.body.appendChild(bar);
      return;
    }
    var head = document.querySelector(".js-head-main");
    var header = document.querySelector(".js-header") || document.querySelector("header");
    if (c.placement === "header" && head && head.parentNode) {
      head.parentNode.insertBefore(bar, head);
    } else if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    fixStickyPlaceholder();
    // El tema recalcula donde arranca el header fijo en el resize.
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* IE */ }
    if (window.ResizeObserver) new ResizeObserver(fixStickyPlaceholder).observe(bar);
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var UNITS = [
    { k: "d", lbl: "días", short: "d" },
    { k: "h", lbl: "hs", short: "h" },
    { k: "m", lbl: "min", short: "m" },
    { k: "s", lbl: "seg", short: "s" },
  ];

  function render(c) {
    var bar = el("div", "pn-cd-" + c.timerStyle);
    bar.id = ID;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Cuenta regresiva");
    if (c.hideBtnMobile) bar.classList.add("pn-cd-hide-btn-m");
    if (c.message.length <= 22) bar.classList.add("pn-cd-short");

    if (c.message) bar.appendChild(el("p", "pn-cd-msg", c.message));

    var timer = el("div", "pn-cd-timer");
    timer.setAttribute("aria-hidden", "true");
    var nums = {}, units = {};
    UNITS.forEach(function (u, i) {
      if (i > 0) timer.appendChild(el("span", "pn-cd-sep", ":"));
      var unit = el("span", "pn-cd-unit");
      nums[u.k] = el("span", "pn-cd-num", "00");
      unit.appendChild(nums[u.k]);
      if (c.timerStyle === "inline" || (c.timerStyle === "boxes" && c.labels)) {
        unit.appendChild(el("span", "pn-cd-lbl", c.timerStyle === "inline" ? u.short : u.lbl));
      }
      units[u.k] = unit;
      timer.appendChild(unit);
    });
    bar.appendChild(timer);

    if (c.buttonText && c.buttonUrl) {
      var a = el("a", "pn-cd-btn", c.buttonText);
      a.href = c.buttonUrl;
      a.addEventListener("click", function () { track(c, "click"); });
      bar.appendChild(a);
    }

    if (c.close) {
      var x = el("button", "pn-cd-close");
      x.type = "button";
      x.setAttribute("aria-label", "Cerrar");
      x.innerHTML = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
      x.addEventListener("click", function () {
        try { sessionStorage.setItem(closedKey(c), "1"); } catch (e) { /* sin storage */ }
        teardown();
        schedule();
      });
      bar.appendChild(x);
    }

    return { bar: bar, nums: nums, units: units, timer: timer };
  }

  var current = null, tickId = null, waitId = null;

  function teardown() {
    if (tickId) clearInterval(tickId);
    tickId = null;
    if (current && current.view.bar.parentNode) current.view.bar.parentNode.removeChild(current.view.bar);
    var st = document.getElementById("pn-cd-style");
    if (st) st.parentNode.removeChild(st);
    current = null;
    fixStickyPlaceholder();
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* IE */ }
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function tick() {
    var c = current.c, v = current.view;
    var left = c.end - Date.now();
    if (left <= 0) { teardown(); schedule(); return; }
    var t = Math.floor(left / 1000);
    var d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    // Sin dias cuando falta menos de uno (y su separador)
    var showDays = d > 0;
    v.units.d.style.display = showDays ? "" : "none";
    if (v.units.d.nextSibling) v.units.d.nextSibling.style.display = showDays ? "" : "none";
    v.nums.d.textContent = String(d);
    v.nums.h.textContent = pad(h);
    v.nums.m.textContent = pad(m);
    v.nums.s.textContent = pad(s);
    v.timer.setAttribute("title", (showDays ? d + " días " : "") + h + " h " + m + " min");
  }

  function show(c) {
    var st = document.createElement("style");
    st.id = "pn-cd-style";
    st.textContent = css(c);
    document.head.appendChild(st);
    loadFont(c);
    var view = render(c);
    current = { c: c, view: view };
    tick();
    mount(view.bar, c);
    tickId = setInterval(tick, 1000);
    track(c, "impression");
  }

  // Muestra la que corresponda ahora y, si no hay, espera a la proxima programada.
  function schedule() {
    if (waitId) clearTimeout(waitId);
    waitId = null;
    if (current) return;
    var c = pickLive();
    if (c) { show(c); return; }
    var ns = nextStart();
    // setTimeout no aguanta mas de ~24 dias; nadie deja la pestaña abierta tanto.
    if (ns != null && ns - Date.now() < 2147483000) waitId = setTimeout(schedule, Math.max(0, ns - Date.now()) + 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  else schedule();
}

function buildWidgetScript(list, apiBase) {
  const args = [JSON.stringify(list), JSON.stringify(apiBase), JSON.stringify(SIZES), JSON.stringify(MOBILE_SCALE)];
  return `(${storefrontCountdown.toString()})(${args.join(",")});`;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
function registerCountdownRoutes(app, deps) {
  const { db, FieldValue, getCachedData, invalidate, checkStoreActive, getStoreById,
    registerScript, unregisterScript, apiBase } = deps;
  const col = () => db.collection(COLLECTION);
  const cacheKey = storeId => `countdowns:${storeId}:enabled`;

  async function owned(req, res, storeId) {
    if (!storeId) { res.status(400).json({ success: false, message: "storeId requerido" }); return null; }
    const ref = col().doc(req.params.countdownId);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ success: false, message: "Cuenta regresiva no encontrada" }); return null; }
    if (String(doc.data().storeId) !== String(storeId)) { res.status(403).json({ success: false, message: "Acceso denegado" }); return null; }
    return { ref, doc };
  }

  // Script de Tiendanube viejo (script tags). Hoy la tienda lo carga por
  // Partners; esto queda por las tiendas que lo tenian instalado asi.
  async function syncScript(storeId) {
    try {
      const store = await getStoreById(storeId);
      if (!store) return;
      const active = await col().where("storeId", "==", String(storeId)).where("enabled", "==", true).limit(1).get();
      if (active.empty) await unregisterScript(store);
      else await registerScript(store);
    } catch (e) {
      console.error("countdown syncScript:", e.message);
    }
  }

  function serialize(doc) {
    const data = doc.data();
    const cd = normalize(data);
    return {
      ...cd,
      countdownId: doc.id,
      id: doc.id,
      status: statusOf(cd),
      impressions: data.impressions || 0,
      clicks: data.clicks || 0,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    };
  }

  app.get("/api/countdowns", async (req, res) => {
    const { storeId } = req.query;
    if (!storeId) return res.json({ success: false, message: "storeId requerido" });
    try {
      const snap = await col().where("storeId", "==", String(storeId)).get();
      const countdowns = snap.docs.map(serialize)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const shown = currentlyShown(countdowns);
      res.json({ success: true, countdowns, shownId: shown ? shown.id : null });
    } catch (error) {
      console.error("Error listando countdowns:", error);
      res.status(500).json({ success: false, message: "Error al obtener las cuentas regresivas" });
    }
  });

  app.get("/api/countdown/:countdownId", async (req, res) => {
    try {
      const found = await owned(req, res, req.query.storeId);
      if (!found) return;
      res.json({ success: true, countdown: serialize(found.doc) });
    } catch (error) {
      console.error("Error obteniendo countdown:", error);
      res.status(500).json({ success: false, message: "Error al obtener la cuenta regresiva" });
    }
  });

  app.post("/api/countdowns/create", async (req, res) => {
    const { storeId, ...body } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const cd = normalize(body);
      const err = validate(cd);
      if (err) return res.status(400).json({ success: false, message: err });
      const countdownId = `countdown_${Date.now()}`;
      const now = new Date().toISOString();
      await col().doc(countdownId).set({ storeId: String(storeId), ...cd, impressions: 0, clicks: 0, createdAt: now, updatedAt: now });
      invalidate(cacheKey(storeId));
      if (cd.enabled) syncScript(storeId);
      res.json({ success: true, countdownId });
    } catch (error) {
      console.error("Error creando countdown:", error);
      res.status(500).json({ success: false, message: "Error al crear la cuenta regresiva" });
    }
  });

  app.put("/api/countdowns/:countdownId", async (req, res) => {
    const { storeId, ...body } = req.body || {};
    try {
      const found = await owned(req, res, storeId);
      if (!found) return;
      const cd = normalize(body);
      const err = validate(cd);
      if (err) return res.status(400).json({ success: false, message: err });
      // Se reescribe entero (sin los campos viejos: position, pushContent, icon...)
      // conservando las metricas.
      const prev = found.doc.data();
      await found.ref.set({
        storeId: String(storeId), ...cd,
        impressions: prev.impressions || 0, clicks: prev.clicks || 0,
        createdAt: prev.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      invalidate(cacheKey(storeId));
      if (cd.enabled !== (prev.enabled !== false)) syncScript(storeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error actualizando countdown:", error);
      res.status(500).json({ success: false, message: "Error al guardar la cuenta regresiva" });
    }
  });

  app.post("/api/countdowns/:countdownId/duplicate", async (req, res) => {
    const { storeId } = req.body || {};
    try {
      const found = await owned(req, res, storeId);
      if (!found) return;
      const cd = normalize(found.doc.data());
      const countdownId = `countdown_${Date.now()}`;
      const now = new Date().toISOString();
      await col().doc(countdownId).set({
        storeId: String(storeId), ...cd, name: text(`${cd.name} (copia)`, 80), enabled: false,
        impressions: 0, clicks: 0, createdAt: now, updatedAt: now,
      });
      res.json({ success: true, countdownId });
    } catch (error) {
      console.error("Error duplicando countdown:", error);
      res.status(500).json({ success: false, message: "Error al duplicar" });
    }
  });

  app.delete("/api/countdowns/:countdownId", async (req, res) => {
    try {
      const found = await owned(req, res, req.query.storeId);
      if (!found) return;
      const wasEnabled = found.doc.data().enabled !== false;
      await found.ref.delete();
      invalidate(cacheKey(req.query.storeId));
      if (wasEnabled) syncScript(req.query.storeId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error eliminando countdown:", error);
      res.status(500).json({ success: false, message: "Error al eliminar" });
    }
  });

  // Antes la lista no mandaba `enabled` y esto fallaba; si no viene, se invierte.
  app.patch("/api/countdowns/:countdownId/toggle", async (req, res) => {
    const { storeId, enabled } = req.body || {};
    try {
      const found = await owned(req, res, storeId);
      if (!found) return;
      const next = typeof enabled === "boolean" ? enabled : found.doc.data().enabled === false;
      await found.ref.update({ enabled: next, updatedAt: new Date().toISOString() });
      invalidate(cacheKey(storeId));
      syncScript(storeId);
      res.json({ success: true, enabled: next });
    } catch (error) {
      console.error("Error toggle countdown:", error);
      res.status(500).json({ success: false, message: "Error al cambiar el estado" });
    }
  });

  app.post("/api/countdowns/:countdownId/track", async (req, res) => {
    const action = req.body && req.body.action;
    const field = action === "impression" ? "impressions" : action === "click" ? "clicks" : null;
    if (!field) return res.json({ success: false });
    try {
      const ref = col().doc(req.params.countdownId);
      await ref.update({ [field]: FieldValue.increment(1) });
      res.json({ success: true });
    } catch (error) {
      // doc borrado: no es un error real
      res.json({ success: false });
    }
  });

  app.get("/api/countdown-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    try {
      if (!store) return res.send("// storeId requerido");
      if (!(await checkStoreActive(store))) {
        res.setHeader("Cache-Control", "no-store");
        return res.send("// plan inactivo");
      }
      const snap = await getCachedData(cacheKey(store), () =>
        col().where("storeId", "==", String(store)).where("enabled", "==", true).get());
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const list = upcomingForWidget(raw.map(r => ({ ...normalize(r), id: r.id, updatedAt: r.updatedAt })))
        .map(cd => widgetPayload(cd.id, cd));
      if (!list.length) return res.send("// sin cuentas regresivas activas");
      res.send(buildWidgetScript(list, apiBase));
    } catch (error) {
      console.error("Error generando countdown widget:", error);
      res.status(500).send("// error");
    }
  });
}

module.exports = {
  COLLECTION,
  DEFAULTS,
  FONTS,
  SIZES,
  MOBILE_SCALE,
  parseDate,
  toIso,
  safeUrl,
  normalize,
  validate,
  statusOf,
  upcomingForWidget,
  currentlyShown,
  widgetPayload,
  buildWidgetScript,
  registerCountdownRoutes,
};
