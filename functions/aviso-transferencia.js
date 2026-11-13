"use strict";

// Aviso de transferencia (Alto Rancho, 13/11/2026): cuando el cliente elige pagar por transferencia en el
// checkout, debajo de los medios de pago aparecen dos carteles: uno sobre la transferencia inmediata y otro que
// pide no pagar y escribir por WhatsApp a quien quiera pagar sin retenciones. El script del checkout (NubeSDK) está
// en nube-sdk-aviso-transferencia/ y lee esta config; los cambios del panel no necesitan subir el script de nuevo.

const ALLOWED_STORES = ["2547699"];
const COLECCION = "promonube_aviso_transferencia";
const COLOR = /^#[0-9a-fA-F]{6}$/;

const DEFAULT = Object.freeze({
  enabled: false,
  titulo1: "Transferencia inmediata",
  texto1: "Realizá la transferencia de forma inmediata (no programada) para que podamos confirmar tu pedido.",
  titulo2: "¿Querés pagar sin retenciones?",
  texto2: "Por favor no realices el pago: escribinos por WhatsApp y te ayudamos a hacerlo sin retenciones.",
  botonTexto: "Escribinos por WhatsApp",
  whatsappPhone: "5491131440631",
  whatsappMessage: "Hola! Quiero pagar por transferencia sin retenciones.",
  bgColor: "#ffffff",
  borderColor: "#dddddd",
  textColor: "#111111",
  buttonBgColor: "#25d366",
  buttonTextColor: "#ffffff",
  // palabras que identifican el medio de pago (en el nombre que ve el cliente)
  palabras: ["transferencia"],
});
const LARGOS = { titulo1: 80, texto1: 400, titulo2: 80, texto2: 400, botonTexto: 60, whatsappMessage: 300 };

const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
const permitida = (sid) => ALLOWED_STORES.includes(str(sid));

/** Solo claves conocidas, con tipo y largo válidos; lo inválido vuelve al default. */
function limpiarConfig(c) {
  const out = { ...DEFAULT, palabras: [...DEFAULT.palabras] };
  if (!c || typeof c !== "object") return out;
  if (typeof c.enabled === "boolean") out.enabled = c.enabled;
  for (const [k, max] of Object.entries(LARGOS)) if (typeof c[k] === "string") out[k] = c[k].trim().slice(0, max);
  for (const k of ["bgColor", "borderColor", "textColor", "buttonBgColor", "buttonTextColor"]) {
    if (c[k] !== undefined) out[k] = COLOR.test(str(c[k])) ? str(c[k]) : DEFAULT[k];
  }
  if (c.whatsappPhone !== undefined) {
    const tel = str(c.whatsappPhone).replace(/\D/g, "").slice(0, 20);
    out.whatsappPhone = tel || DEFAULT.whatsappPhone;
  }
  if (Array.isArray(c.palabras)) {
    const p = c.palabras.map((x) => str(x).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 10);
    if (p.length) out.palabras = p;
  }
  return out;
}

/** ¿El medio de pago elegido es una transferencia? (por su tipo o por las palabras en el nombre) */
function esTransferencia(sel, palabras) {
  if (!sel || typeof sel !== "object") return false;
  const tipo = `${str(sel.method_type)} ${str(sel.type)} ${str(sel.method)}`.toLowerCase();
  if (/wire|transfer/.test(tipo)) return true;
  const nombre = `${str(sel.name)} ${str(sel.method_name)} ${str(sel.template)}`.toLowerCase();
  return (palabras || []).some((p) => p && nombre.includes(p));
}

function cors(res) {
  return res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
}

function crearServicio({ db }) {
  const doc = (sid) => db.collection(COLECCION).doc(str(sid));

  async function leer(sid) {
    if (!permitida(sid)) return { ...limpiarConfig(null), enabled: false };
    const d = await doc(sid).get();
    return limpiarConfig(d.exists ? d.data() : null);
  }

  // GET /api/aviso-transferencia/config?storeId= (público: lo lee el script del checkout)
  async function configPublica(req, res) {
    cors(res);
    res.set("Cache-Control", "public, max-age=60");
    try {
      return res.json({ success: true, config: await leer(req.query && req.query.storeId) });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // POST /api/aviso-transferencia/config {storeId, config}
  async function guardar(req, res) {
    const { storeId, config } = req.body || {};
    if (!str(storeId)) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!permitida(storeId)) return res.status(403).json({ success: false, message: "Módulo exclusivo de Alto Rancho" });
    try {
      const actual = await leer(storeId);
      const nueva = limpiarConfig({ ...actual, ...(config || {}) });
      await doc(storeId).set({ ...nueva, updatedAt: new Date().toISOString() }, { merge: true });
      return res.json({ success: true, config: nueva });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return { configPublica, guardar, leer };
}

function registerAvisoTransferenciaRoutes(app, { db }) {
  const s = crearServicio({ db });
  app.options("/api/aviso-transferencia/config", (req, res) => cors(res).status(204).end());
  app.get("/api/aviso-transferencia/config", s.configPublica);
  app.post("/api/aviso-transferencia/config", s.guardar);
  return s;
}

module.exports = { ALLOWED_STORES, DEFAULT, limpiarConfig, esTransferencia, crearServicio, registerAvisoTransferenciaRoutes };
