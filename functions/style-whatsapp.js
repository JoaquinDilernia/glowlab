"use strict";

// Style > WhatsApp, rehecho para Ipanema (Alto Rancho).
//
// El modulo viejo solo pintaba el boton de WhatsApp de la plantilla (2 colores).
// El nuevo dibuja un boton propio y esconde el de la plantilla: numero (si no se
// carga, usa el de la plantilla), mensaje precargado con {producto}, etiqueta al
// lado, globito de saludo, horario de atencion, posicion/tamaño/colores.
//
// La config vive en promonube_style_config/{store}.whatsapp. Solo las configs
// guardadas con el editor nuevo (version: 2) usan este codigo; las viejas siguen
// con customizeWhatsApp() de index.js tal cual, asi ninguna tienda cambia al deployar.

const HEX = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SIZES = { sm: 48, md: 56, lg: 64 };

const DEFAULTS = {
  enabled: false,
  phone: "",
  message: "",
  productMessage: "Hola! Quiero consultar por {producto}",
  label: "",
  labelMode: "desktop", // "none" | "desktop" | "always"
  greeting: "",
  greetingDelay: 6,
  side: "right",
  offsetX: 20,
  offsetY: 20,
  mobileOffsetY: 16,
  size: "md",
  shape: "circle",
  backgroundColor: "#25d366",
  iconColor: "#ffffff",
  hoverColor: "#1ebe5b",
  pulse: false,
  devices: "both",
  hours: { enabled: false, days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" },
};

const text = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
const hexOr = (v, fb) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);
const pick = (v, list, fb) => (list.includes(v) ? v : fb);
function num(v, min, max, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
}
// Solo digitos; "+54 9 11 3144-0631" -> "5491131440631". Menos de 8 digitos = vacio.
function phone(v) {
  const d = String(v == null ? "" : v).replace(/\D/g, "").slice(0, 16);
  return d.length >= 8 ? d : "";
}

function normalizeHours(h) {
  const c = h || {};
  const d = DEFAULTS.hours;
  const days = Array.isArray(c.days)
    ? [...new Set(c.days.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort()
    : d.days;
  return {
    enabled: c.enabled === true,
    days,
    from: TIME.test(c.from) ? c.from : d.from,
    to: TIME.test(c.to) ? c.to : d.to,
  };
}

// Config vieja: { enabled, backgroundColor, hoverColor } pintando el boton de la plantilla.
function normalize(input) {
  const c = input || {};
  const d = DEFAULTS;
  return {
    enabled: c.enabled === true,
    version: 2,
    phone: phone(c.phone),
    message: text(c.message, 300),
    productMessage: c.productMessage === undefined ? d.productMessage : text(c.productMessage, 300),
    label: text(c.label, 40),
    labelMode: pick(c.labelMode, ["none", "desktop", "always"], d.labelMode),
    greeting: text(c.greeting, 140),
    greetingDelay: num(c.greetingDelay, 0, 120, d.greetingDelay),
    side: c.side === "left" ? "left" : "right",
    offsetX: num(c.offsetX, 0, 200, d.offsetX),
    offsetY: num(c.offsetY, 0, 300, d.offsetY),
    mobileOffsetY: num(c.mobileOffsetY, 0, 300, d.mobileOffsetY),
    size: pick(c.size, Object.keys(SIZES), d.size),
    shape: c.shape === "rounded" ? "rounded" : "circle",
    backgroundColor: hexOr(c.backgroundColor, d.backgroundColor),
    iconColor: hexOr(c.iconColor, d.iconColor),
    hoverColor: hexOr(c.hoverColor, hexOr(c.backgroundColor, d.hoverColor)),
    pulse: c.pulse === true,
    devices: pick(c.devices, ["both", "desktop", "mobile"], d.devices),
    hours: normalizeHours(c.hours),
  };
}

const usesNewWhatsApp = (cfg) => !!cfg && cfg.version === 2;

// Hora de Argentina (UTC-3, sin horario de verano) -> { day, minutes }
function argentinaClock(ms) {
  const d = new Date(ms - 3 * 3600 * 1000);
  return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
// Dentro del horario? Si "to" < "from" cruza la medianoche (ej 20:00 a 02:00).
function inHours(hours, ms) {
  if (!hours || !hours.enabled) return true;
  const { day, minutes } = argentinaClock(ms);
  const from = toMin(hours.from);
  const to = toMin(hours.to);
  if (from === to) return hours.days.includes(day);
  if (from < to) return hours.days.includes(day) && minutes >= from && minutes < to;
  const prevDay = (day + 6) % 7;
  return (hours.days.includes(day) && minutes >= from) || (hours.days.includes(prevDay) && minutes < to);
}

function widgetPayload(cfg) {
  const n = normalize(cfg);
  return { ...n, px: SIZES[n.size] };
}

// ----------------------------------------------------------------------------
// Script de la tienda. Se serializa con toString(): no usar nada de afuera.
function storefrontWhatsApp(C) {
  if (window.pnWhatsAppV2) return;
  window.pnWhatsAppV2 = true;

  var mobile = window.matchMedia("(max-width: 767px)").matches;
  if (C.devices === "desktop" && mobile) return;
  if (C.devices === "mobile" && !mobile) return;

  function inHours(h) {
    if (!h || !h.enabled) return true;
    var d = new Date(Date.now() - 3 * 3600 * 1000);
    var day = d.getUTCDay(), min = d.getUTCHours() * 60 + d.getUTCMinutes();
    var f = h.from.split(":"), t = h.to.split(":");
    var from = +f[0] * 60 + +f[1], to = +t[0] * 60 + +t[1];
    if (from === to) return h.days.indexOf(day) >= 0;
    if (from < to) return h.days.indexOf(day) >= 0 && min >= from && min < to;
    return (h.days.indexOf(day) >= 0 && min >= from) || (h.days.indexOf((day + 6) % 7) >= 0 && min < to);
  }

  var themeBtns = Array.prototype.slice.call(document.querySelectorAll(
    ".btn-whatsapp, .whatsapp-button, .js-btn-fixed-bottom, a[href*='wa.me'], a[href*='api.whatsapp.com']"
  )).filter(function (el) {
    if (el.closest("footer, .footer, #footer")) return false;
    if (el.classList.contains("btn-whatsapp") || el.classList.contains("whatsapp-button")) return true;
    var p = getComputedStyle(el).position;
    return p === "fixed" || p === "absolute";
  });

  function numberFrom(el) {
    var href = (el && el.getAttribute("href")) || "";
    var m = /wa\.me\/(\d+)/.exec(href) || /[?&]phone=(\d+)/.exec(href);
    return m ? m[1] : "";
  }
  var phone = C.phone;
  for (var i = 0; !phone && i < themeBtns.length; i++) phone = numberFrom(themeBtns[i]);
  if (!phone) return; // sin numero no hay boton: dejamos el de la plantilla como esta

  if (!inHours(C.hours)) {
    // Fuera de horario no se muestra ningun boton.
    themeBtns.forEach(function (el) { el.style.setProperty("display", "none", "important"); });
    return;
  }

  function productName() {
    try { if (window.LS && LS.product && LS.product.name) return LS.product.name; } catch (e) {}
    var el = document.querySelector(".js-product-name, [data-store^='product-name'], .product-name, #product-name");
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function href() {
    var prod = productName();
    var msg = prod && C.productMessage ? C.productMessage : C.message;
    msg = (msg || "").replace(/\{producto\}/gi, prod).replace(/\{url\}/gi, location.href);
    return "https://wa.me/" + phone + (msg ? "?text=" + encodeURIComponent(msg) : "");
  }

  var side = C.side === "left" ? "left" : "right";
  var px = C.px;
  var radius = C.shape === "rounded" ? Math.round(px * 0.3) + "px" : "50%";
  var css = [
    ".btn-whatsapp,.pn-wa-hide{display:none !important}",
    "#pn-wa{position:fixed;" + side + ":" + C.offsetX + "px;bottom:" + C.offsetY + "px;z-index:9990;display:flex;align-items:center;gap:10px;flex-direction:" + (side === "left" ? "row" : "row-reverse") + ";font-family:inherit}",
    "@media (max-width:767px){#pn-wa{bottom:" + C.mobileOffsetY + "px;" + side + ":" + Math.min(C.offsetX, 16) + "px}}",
    "#pn-wa a.pn-wa-btn{width:" + px + "px;height:" + px + "px;border-radius:" + radius + ";background:" + C.backgroundColor + ";display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.18);transition:transform .2s ease,background .2s ease;flex-shrink:0}",
    "#pn-wa a.pn-wa-btn:hover{background:" + C.hoverColor + ";transform:scale(1.06)}",
    "#pn-wa a.pn-wa-btn svg{width:" + Math.round(px * 0.52) + "px;height:" + Math.round(px * 0.52) + "px;fill:" + C.iconColor + "}",
    "#pn-wa .pn-wa-label{background:#fff;color:#353434;font-size:13px;font-weight:600;padding:8px 14px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.12);white-space:nowrap;text-decoration:none}",
    C.labelMode === "desktop" ? "@media (max-width:767px){#pn-wa .pn-wa-label{display:none}}" : "",
    "#pn-wa .pn-wa-bubble{position:absolute;bottom:" + (px + 12) + "px;" + side + ":0;width:max-content;max-width:240px;background:#fff;color:#353434;font-size:13px;line-height:1.4;padding:12px 30px 12px 14px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.16);opacity:0;transform:translateY(8px);transition:opacity .3s ease,transform .3s ease;pointer-events:none}",
    "#pn-wa .pn-wa-bubble.show{opacity:1;transform:none;pointer-events:auto}",
    "#pn-wa .pn-wa-bubble button{position:absolute;top:6px;right:8px;border:0;background:none;font-size:16px;line-height:1;color:#8a8a8a;cursor:pointer;padding:2px}",
    C.pulse ? "#pn-wa a.pn-wa-btn{animation:pnWaPulse 2.4s ease-out infinite}@keyframes pnWaPulse{0%{box-shadow:0 0 0 0 " + C.backgroundColor + "88}70%{box-shadow:0 0 0 14px " + C.backgroundColor + "00}100%{box-shadow:0 0 0 0 " + C.backgroundColor + "00}}" : "",
  ].join("\n");
  var st = document.createElement("style");
  st.id = "pn-wa-css";
  st.textContent = css;
  document.head.appendChild(st);
  themeBtns.forEach(function (el) { el.classList.add("pn-wa-hide"); });

  var wrap = document.createElement("div");
  wrap.id = "pn-wa";
  var a = document.createElement("a");
  a.className = "pn-wa-btn";
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("aria-label", "Escribinos por WhatsApp");
  a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.83 9.83 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z"/></svg>';
  var refresh = function () { a.href = href(); };
  refresh();
  a.addEventListener("mouseenter", refresh);
  a.addEventListener("touchstart", refresh, { passive: true });
  wrap.appendChild(a);

  if (C.label && C.labelMode !== "none") {
    var lab = document.createElement("a");
    lab.className = "pn-wa-label";
    lab.textContent = C.label;
    lab.target = "_blank";
    lab.rel = "noopener";
    lab.href = a.href;
    lab.addEventListener("mouseenter", function () { lab.href = href(); });
    wrap.appendChild(lab);
  }

  if (C.greeting) {
    var KEY = "pn_wa_greet_closed";
    var closed = false;
    try { closed = sessionStorage.getItem(KEY) === "1"; } catch (e) {}
    if (!closed) {
      var b = document.createElement("div");
      b.className = "pn-wa-bubble";
      b.textContent = C.greeting;
      var x = document.createElement("button");
      x.type = "button";
      x.setAttribute("aria-label", "Cerrar");
      x.textContent = "×";
      x.addEventListener("click", function () {
        b.classList.remove("show");
        try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
      });
      b.appendChild(x);
      b.addEventListener("click", function (e) { if (e.target !== x) { refresh(); window.open(a.href, "_blank", "noopener"); } });
      wrap.appendChild(b);
      setTimeout(function () { b.classList.add("show"); }, C.greetingDelay * 1000);
    }
  }

  document.body.appendChild(wrap);
}

function buildWhatsAppScript(cfg) {
  if (!usesNewWhatsApp(cfg) || cfg.enabled !== true) return "";
  const run = `(${storefrontWhatsApp.toString()})(${JSON.stringify(widgetPayload(cfg))});`;
  return `\n;(function(){var go=function(){try{${run}}catch(e){console.error("PromoNube whatsapp",e)}};` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n`;
}

module.exports = {
  DEFAULTS,
  SIZES,
  normalize,
  usesNewWhatsApp,
  inHours,
  widgetPayload,
  buildWhatsAppScript,
};
