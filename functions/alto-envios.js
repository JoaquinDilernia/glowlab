"use strict";

// Envíos agrupados de Alto Rancho (desplegables en carrito/checkout + filtro real del checkout).
// Portado de la app "Altorancho Envios Checkout" que armó logística de Alto Rancho (paquete del 12/11/2026,
// filtro.py + app.py). La lógica es la misma; cambia dónde corre (GlowLab en Railway + Firestore).
// Diseño: docs/superpowers/specs/2026-11-13-alto-envios-design.md
//
// Ocultar opciones SOLO con datos reales: el callback de Reglas de negocio (shipping/before-filter) no trae
// precios ni plazos. El script del checkout (NubeSDK) sí los ve y los manda a /api/alto-envios/foto. Cuando
// TiendaNube pregunta qué mostrar, se busca una cotización real para:
//   1. el mismo carrito, el mismo CP y los mismos productos/cantidades, o si no
//   2. el mismo CP y los mismos productos/cantidades (otro cliente que cotizó lo mismo).
// Si no hay datos (o están vencidos) NO se oculta nada. Nunca se adivina.
// Criterio: para Zipnova y Envío Nube, por grupo (a domicilio / punto de retiro) quedan la más barata y la más
// rápida; envío propio y retiro en locales se muestran siempre todos. Grupos de 1 o 2 opciones no se tocan.
// OJO (probado por logística el 27/10/2026): filtered_options son las opciones que QUEDAN en el checkout.

const TTL_SEG = 12 * 3600;      // una cotización vieja no sirve (cambian tarifas)
const MAX_CLAVES = 5000;
const MAX_OPCIONES = 60;        // una foto real trae ~10-20 opciones

const _DATOS = new Map();       // clave (string) -> { ts, opciones: {code: opcion} }
const _VISTOS = new Map();      // "store|cart" -> ts
const _CATALOGO = new Map();    // storeId -> { code: {id, option_id, carrier} }

const ahoraSeg = () => Date.now() / 1000;
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v, def) => { const n = Number(v); return v === null || v === undefined || v === "" || Number.isNaN(n) ? def : n; };

function recortar(mapa, max) {
  if (mapa.size <= max) return;
  const orden = [...mapa.entries()].sort((a, b) => (a[1].ts ?? a[1]) - (b[1].ts ?? b[1]));
  for (const [k] of orden.slice(0, mapa.size - max)) mapa.delete(k);
}

/** Productos y cantidades del carrito, en un orden fijo (sirve para comparar carritos). */
function huella(items) {
  const partes = [];
  for (const it of items || []) {
    const vid = str(it && (it.variant_id || it.id));
    if (vid) partes.push(`${vid}x${str(it.quantity || 1)}`);
  }
  return partes.sort().join(",");
}

/** La clave del carrito lleva la huella: si cambia una cantidad, el carrito conserva el id pero cambia el peso. */
function claves(storeId, cartId, zipcode, h) {
  const s = str(storeId), c = str(cartId), z = str(zipcode);
  const out = [];
  if (s && c && z) out.push(["carrito", s, c, z, h]);
  if (s && z && h) out.push(["combo", s, z, h]);
  return out;
}
const k2s = (k) => JSON.stringify(k);

/** Guarda las opciones de una foto del checkout; mezcla con las que había (no se pierden las ya ocultas). */
function guardar(foto, ahora) {
  ahora = ahora === undefined ? ahoraSeg() : ahora;
  const ops = ((foto && foto.opciones) || []).filter((o) => o && typeof o === "object" && o.code);
  if (!ops.length) return 0;
  const ks = claves(foto.store_id, foto.cart_id, foto.zipcode, huella(foto.items || []));
  for (const k of ks) {
    const previo = _DATOS.get(k2s(k));
    const base = previo && ahora - previo.ts < TTL_SEG ? { ...previo.opciones } : {};
    for (const o of ops.slice(0, MAX_OPCIONES)) base[str(o.code).slice(0, 80)] = o;
    if (Object.keys(base).length > MAX_OPCIONES) return 0;   // tope por clave (memoria del servicio)
    _DATOS.set(k2s(k), { ts: ahora, opciones: base });
  }
  recortar(_DATOS, MAX_CLAVES);
  return ks.length;
}

/** [grupo, transportista]: grupo = local | punto | domicilio. */
function clasificar(o) {
  const code = str(o.code).toLowerCase(), method = str(o.method).toLowerCase();
  const texto = `${code} ${str(o.name).toLowerCase()} ${str(o.original_name).toLowerCase()}`;
  if (method === "pickup-point" || code.startsWith("pickup-point")) return ["local", "Local"];
  const grupo = str(o.type).toLowerCase() === "pickup" ? "punto" : "domicilio";
  if (texto.includes("zippin") || texto.includes("zipnova")) return [grupo, "Zipnova"];
  if (code.startsWith("ne-") || texto.includes("envío nube") || texto.includes("envio nube")) return [grupo, "Envío Nube"];
  if (method === "table" || /^\d+$/.test(code)) return [grupo, "Envío propio"];
  return [grupo, "Otro"];
}

function minPor(lista, clave) {
  let mejor = null, km = null;
  for (const o of lista) {
    const k = clave(o);
    if (mejor === null || cmpTuplas(k, km) < 0) { mejor = o; km = k; }
  }
  return mejor;
}
function cmpTuplas(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/** La más barata y la más rápida de una lista (pueden ser la misma). */
function elegidas(lista) {
  if (!lista.length) return [];
  const barata = minPor(lista, (o) => [num(o.price, 9e12), num(o.max_days, 999), num(o.min_days, 999)]);
  const conDias = lista.filter((o) => o.max_days !== null && o.max_days !== undefined);
  const rapida = conDias.length ? minPor(conDias, (o) => [num(o.max_days, 999), num(o.min_days, 999), num(o.price, 9e12)]) : barata;
  return rapida === barata ? [barata] : [barata, rapida];
}

/** Dentro de cada grupo+transportista (solo Zipnova y Envío Nube), las que no son ni la más barata ni la más rápida. */
function aOcultar(opciones) {
  const grupos = new Map();
  for (const o of opciones) {
    const [g, t] = clasificar(o);
    if ((t === "Zipnova" || t === "Envío Nube") && (g === "domicilio" || g === "punto")) {
      const k = `${g}|${t}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(o);
    }
  }
  const fuera = [];
  for (const lista of grupos.values()) {
    if (lista.length <= 2) continue;
    const quedan = new Set(elegidas(lista));
    for (const o of lista) if (!quedan.has(o)) fuera.push(o);
  }
  return fuera;
}

/** Catálogo de una tienda a partir de GET shipping_carriers/options. Devuelve cuántas opciones. */
function cargarCatalogo(storeId, carriers) {
  const mapa = {};
  for (const c of carriers || []) {
    if (!c || typeof c !== "object") continue;
    for (const o of c.options || []) {
      if (o && typeof o === "object" && o.code) mapa[str(o.code)] = { id: c.id, option_id: o.id, carrier: str(c.name) };
    }
  }
  _CATALOGO.set(str(storeId), mapa);
  return Object.keys(mapa).length;
}
const catalogo = (storeId) => ({ ...(_CATALOGO.get(str(storeId)) || {}) });
const tiendasConCatalogo = () => [..._CATALOGO.keys()];

/** Una opción en el formato de filtered_options. En NubeSDK el envío propio llega con code "7620339" y en el
 *  catálogo es "table-7620339". null si no está en el catálogo (entonces no se manda ninguna lista). */
function formatoTn(o, cat) {
  const code = str(o.code);
  for (const c of [code, "table-" + code]) {
    const e = cat[c];
    if (e) return { id: e.id, option_id: e.option_id, code: c };
  }
  return null;
}

/** Qué contestarle a TiendaNube. {mostrar, fuente: carrito|combo|sin_datos|sin_catalogo, ocultas}. mostrar vacío = no filtrar. */
function decidir(storeId, cartId, zipcode, items, ahora) {
  ahora = ahora === undefined ? ahoraSeg() : ahora;
  for (const k of claves(storeId, cartId, zipcode, huella(items))) {
    const d = _DATOS.get(k2s(k));
    if (!d || ahora - d.ts >= TTL_SEG) continue;
    const todas = Object.values(d.opciones);
    const ocultar = new Set(aOcultar(todas).map((o) => str(o.code)));
    if (!ocultar.size) return { mostrar: [], fuente: k[0], ocultas: 0 };
    const cat = catalogo(storeId);
    const mostrar = [];
    for (const o of todas) {
      if (ocultar.has(str(o.code))) continue;
      const f = formatoTn(o, cat);
      if (f === null) return { mostrar: [], fuente: "sin_catalogo", ocultas: 0, falta: str(o.code) };
      mostrar.push(f);
    }
    return { mostrar, fuente: k[0], ocultas: ocultar.size };
  }
  return { mostrar: [], fuente: "sin_datos", ocultas: 0 };
}

// ---- carritos por los que TiendaNube preguntó: solo se aceptan fotos de esos (una foto inventada no oculta nada) ----
function marcarVisto(storeId, cartId, ahora) {
  const s = str(storeId), c = str(cartId);
  if (!s || !c) return;
  _VISTOS.set(`${s}|${c}`, ahora === undefined ? ahoraSeg() : ahora);
  recortar(_VISTOS, MAX_CLAVES);
}
function visto(storeId, cartId, ahora) {
  ahora = ahora === undefined ? ahoraSeg() : ahora;
  const ts = _VISTOS.get(`${str(storeId)}|${str(cartId)}`);
  return ts !== undefined && ahora - ts < TTL_SEG;
}

function borrarTodo() { _DATOS.clear(); _VISTOS.clear(); }
const cantidad = () => _DATOS.size;

// ======================================================================= servicio (rutas) ====
// La regla (callback de TiendaNube) tiene 800 ms: se resuelve todo en memoria y nunca espera a Firestore ni a
// TiendaNube. Config, catálogo y fotos se cargan/refrescan en segundo plano.

const COL_CONFIG = "promonube_alto_envios";
const COL_FOTOS = "promonube_alto_envios_fotos";
const TN_API = "https://api.tiendanube.com/v1";
const EVENTO_ENVIO = "shipping/before-filter";
const USER_AGENT = "GlowLab (info@techdi.com.ar)";
const DEFAULT_BASE = "https://glowlab-production.up.railway.app";
const CONFIG_SEG = 30;
const CATALOGO_SEG = 3600;
const MAX_FOTO = 64 * 1024;
const FOTOS_POR_MIN = 120;
const MAX_DECISIONES = 200;
const MAX_RECUPERAR = 300;

const fs = require("fs");
const path = require("path");
const WIDGET_JS = path.join(__dirname, "alto-envios-widget.js");

function cors(res) {
  return res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
}

/** Servicio con sus dependencias inyectadas (db = Firestore, fetchFn = fetch) para poder probarlo sin red. */
function crearServicio({ db, fetchFn = globalThis.fetch, base = process.env.ALTO_ENVIOS_BASE || DEFAULT_BASE } = {}) {
  const config = new Map();              // storeId -> {enabled, ocultar, install}
  const estado = { configTs: 0, catalogoTs: 0, fotosMin: 0, fotosN: 0, aceptadas: 0, rechazadas: 0 };
  const decisiones = [];                 // memoria circular: {t, storeId, fuente, ocultas, mostradas, ms}
  const consultas = new Map();           // storeId -> {n, ultima}
  let widgetCache = null;

  const cfg = (sid) => config.get(str(sid)) || { enabled: false, ocultar: false };

  async function refrescarConfig() {
    estado.configTs = Date.now();
    try {
      const snap = await db.collection(COL_CONFIG).get();
      snap.docs.forEach((d) => config.set(str(d.id), d.data() || {}));
    } catch (e) { console.warn("[alto-envios] no pude leer la config:", e.message); }
  }
  function refrescarSiHaceFalta() {
    if (Date.now() - estado.configTs > CONFIG_SEG * 1000) refrescarConfig();
    if (Date.now() - estado.catalogoTs > CATALOGO_SEG * 1000) cargarCatalogos();
  }

  async function ponerConfig(sid, cambios) {
    const nuevo = { ...cfg(sid), ...cambios };
    config.set(str(sid), nuevo);
    await db.collection(COL_CONFIG).doc(str(sid)).set({ ...cambios, updatedAt: new Date().toISOString() }, { merge: true });
    return nuevo;
  }

  async function token(sid) {
    const d = await db.collection("promonube_stores").doc(str(sid)).get();
    return d.exists ? (d.data() || {}).accessToken : null;
  }

  async function tn(metodo, sid, ruta, tok, body) {
    const r = await fetchFn(`${TN_API}/${sid}/${ruta}`, {
      method: metodo,
      headers: { Authentication: `bearer ${tok}`, "User-Agent": USER_AGENT, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let datos = null;
    try { datos = r.status === 204 ? null : await r.json(); } catch { datos = null; }
    return { status: r.status, datos };
  }

  async function cargarCatalogoDe(sid) {
    const tok = await token(sid);
    if (!tok) return { status: 0, n: 0, error: "la tienda no tiene token de GlowLab" };
    const { status, datos } = await tn("GET", sid, "shipping_carriers/options", tok);
    if (status === 200 && Array.isArray(datos)) return { status, n: cargarCatalogo(sid, datos) };
    return { status, n: 0, error: JSON.stringify(datos || "").slice(0, 200) };
  }

  /** Catálogo de cada tienda con la función prendida (enabled u ocultar). Se refresca cada hora. */
  async function cargarCatalogos() {
    estado.catalogoTs = Date.now();
    for (const [sid, c] of config) {
      if (!c.enabled && !c.ocultar) continue;
      try {
        const r = await cargarCatalogoDe(sid);
        if (r.error) console.warn(`[alto-envios] catálogo ${sid}: ${r.status} ${r.error}`);
      } catch (e) { console.warn(`[alto-envios] catálogo ${sid}:`, e.message); }
    }
  }

  /** Recupera las fotos de las últimas 12 h (Railway reinicia el proceso y la memoria se pierde). */
  async function recuperarFotos() {
    const desde = ahoraSeg() - TTL_SEG;
    let n = 0;
    try {
      const snap = await db.collection(COL_FOTOS).where("ts", ">=", desde).orderBy("ts", "desc").limit(MAX_RECUPERAR).get();
      const docs = snap.docs.map((d) => d.data()).sort((a, b) => a.ts - b.ts);
      for (const d of docs) n += guardar(d.foto || {}, d.ts) ? 1 : 0;
      // limpieza oportunista de las viejas
      const viejas = await db.collection(COL_FOTOS).where("ts", "<", desde).limit(200).get();
      await Promise.all(viejas.docs.map((d) => d.ref.delete()));
    } catch (e) { console.warn("[alto-envios] no pude recuperar fotos:", e.message); }
    return n;
  }

  function anotar(d) {
    decisiones.unshift(d);
    if (decisiones.length > MAX_DECISIONES) decisiones.length = MAX_DECISIONES;
  }

  // ---- POST /api/alto-envios/regla: callback shipping/before-filter ----
  async function regla(req, res) {
    const t0 = process.hrtime.bigint();
    refrescarSiHaceFalta();
    const p = req.body && typeof req.body === "object" ? req.body : {};
    const sid = str(p.store_id);
    marcarVisto(sid, p.cart_id);            // habilita la foto de este carrito
    if (sid) {
      const c = consultas.get(sid) || { n: 0, ultima: null };
      consultas.set(sid, { n: c.n + 1, ultima: new Date().toISOString() });
    }
    let respuesta = null, dec = null;
    if (sid && cfg(sid).ocultar === true) {
      const envio = p.shipping && typeof p.shipping === "object" ? p.shipping : {};
      dec = decidir(sid, p.cart_id, envio.postalcode, p.products || []);
      // filtered_options = las opciones que QUEDAN; vacío = no se filtra nada
      if (dec.mostrar.length) respuesta = { command: "filter_shipping_options", detail: { filtered_options: dec.mostrar } };
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    anotar({ t: new Date().toISOString(), storeId: sid, cp: str((p.shipping || {}).postalcode), fuente: dec ? dec.fuente : "apagado",
      ocultas: dec ? dec.ocultas : 0, mostradas: dec ? dec.mostrar.length : 0, ...(dec && dec.falta ? { falta: dec.falta } : {}), ms: Math.round(ms * 10) / 10 });
    if (!respuesta) return res.status(204).end();
    return res.status(200).json(respuesta);
  }

  // ---- POST /api/alto-envios/foto: cotización real que vio el script del checkout ----
  async function foto(req, res) {
    cors(res);
    if (req.method === "OPTIONS") return res.status(204).end();
    const min = Math.floor(Date.now() / 60000);
    if (estado.fotosMin !== min) { estado.fotosMin = min; estado.fotosN = 0; }
    if (++estado.fotosN > FOTOS_POR_MIN) return res.status(429).end();
    const crudo = Buffer.isBuffer(req.body) ? req.body.toString("utf8")
      : typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(crudo, "utf8") > MAX_FOTO) return res.status(413).end();
    let p;
    try { p = JSON.parse(crudo || "{}"); } catch { return res.status(400).end(); }
    if (!p || typeof p !== "object") return res.status(400).end();
    // solo carritos por los que TiendaNube ya nos consultó: una foto inventada no puede ocultar nada
    if (!visto(p.store_id, p.cart_id)) { estado.rechazadas++; return res.status(403).end(); }
    const opciones = Array.isArray(p.opciones) ? p.opciones : [];
    const limpia = { store_id: p.store_id, cart_id: p.cart_id, zipcode: p.zipcode, items: Array.isArray(p.items) ? p.items : [], opciones };
    if (guardar(limpia)) {
      estado.aceptadas++;
      db.collection(COL_FOTOS).add({ storeId: str(p.store_id), ts: ahoraSeg(), foto: limpia })
        .catch((e) => console.warn("[alto-envios] no pude guardar la foto:", e.message));
    }
    return res.status(204).end();
  }

  // ---- GET /api/alto-envios/config?storeId= (público: lo consulta el script del checkout) ----
  async function configPublica(req, res) {
    cors(res);
    refrescarSiHaceFalta();
    return res.json({ success: true, enabled: cfg(req.query.storeId).enabled === true });
  }

  // ---- GET /api/alto-envios-widget.js?store= (script del carrito y del producto) ----
  async function widget(req, res) {
    refrescarSiHaceFalta();
    res.type("application/javascript");
    res.set("Cache-Control", "public, max-age=300");
    if (cfg(req.query.store).enabled !== true) return res.send("/* GlowLab · envíos agrupados: apagado */");
    if (widgetCache === null) widgetCache = fs.readFileSync(WIDGET_JS, "utf8");
    return res.send(widgetCache);
  }

  // ---- POST /api/alto-envios/install {storeId}: regla de envíos + catálogo ----
  async function install(req, res) {
    const sid = str((req.body || {}).storeId);
    if (!sid) return res.status(400).json({ success: false, message: "storeId requerido" });
    try {
      const tok = await token(sid);
      if (!tok) return res.status(404).json({ success: false, message: "La tienda no tiene GlowLab instalado" });
      const r = await tn("PUT", sid, "business_rules/integrations/shipping", tok, { url: `${base}/api/alto-envios/regla`, event: EVENTO_ENVIO });
      const cat = await cargarCatalogoDe(sid);
      const inst = {
        at: new Date().toISOString(),
        regla: { status: r.status, respuesta: r.datos ? JSON.stringify(r.datos).slice(0, 500) : null },
        catalogo: cat.n, catalogoStatus: cat.status, ...(cat.error ? { catalogoError: cat.error } : {}),
      };
      await ponerConfig(sid, { install: inst });
      return res.json({ success: r.status < 300, install: inst });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  // ---- estado para el panel ----
  function salud(sid) {
    sid = str(sid);
    const c = consultas.get(sid) || { n: 0, ultima: null };
    return {
      config: cfg(sid), consultas: c.n, ultimaConsulta: c.ultima,
      catalogo: Object.keys(catalogo(sid)).length, cotizaciones: cantidad(),
      fotos: { aceptadas: estado.aceptadas, rechazadas: estado.rechazadas },
      decisiones: decisiones.filter((d) => d.storeId === sid).slice(0, 50),
    };
  }

  return { regla, foto, configPublica, widget, install, salud, ponerConfig, refrescarConfig, cargarCatalogos, recuperarFotos, cfg };
}

function registerAltoEnviosRoutes(app, { db }) {
  const express = require("express");
  const s = crearServicio({ db });
  // la foto llega como text/plain (el script la manda así para evitar el preflight de CORS)
  app.options("/api/alto-envios/foto", s.foto);
  app.post("/api/alto-envios/foto", express.text({ type: () => true, limit: "1mb" }), s.foto);
  app.post("/api/alto-envios/regla", s.regla);
  app.get("/api/alto-envios/config", s.configPublica);
  app.post("/api/alto-envios/config", async (req, res) => {
    const { storeId, enabled, ocultar } = req.body || {};
    if (!storeId) return res.status(400).json({ success: false, message: "storeId requerido" });
    const cambios = {};
    if (typeof enabled === "boolean") cambios.enabled = enabled;
    if (typeof ocultar === "boolean") cambios.ocultar = ocultar;
    try {
      const c = await s.ponerConfig(storeId, cambios);
      if (c.enabled || c.ocultar) s.cargarCatalogos();
      res.json({ success: true, config: c });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });
  app.get("/api/alto-envios-widget.js", s.widget);
  app.post("/api/alto-envios/install", s.install);
  app.get("/api/alto-envios/salud", (req, res) => res.json({ success: true, ...s.salud(req.query.storeId) }));
  // al arrancar: config, cotizaciones guardadas y catálogo (en segundo plano)
  s.refrescarConfig().then(() => Promise.all([s.recuperarFotos(), s.cargarCatalogos()]))
    .catch((e) => console.warn("[alto-envios] arranque:", e.message));
  return s;
}

module.exports = {
  TTL_SEG, MAX_CLAVES, MAX_OPCIONES, _DATOS,
  huella, guardar, clasificar, elegidas, aOcultar, cargarCatalogo, catalogo, tiendasConCatalogo,
  formatoTn, decidir, marcarVisto, visto, borrarTodo, cantidad,
  crearServicio, registerAltoEnviosRoutes,
};
