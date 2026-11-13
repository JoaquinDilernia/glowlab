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
      if (o && typeof o === "object" && o.code) mapa[str(o.code)] = { id: c.id, option_id: o.id, carrier: str(c.name), nombre: str(o.name) };
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
  // en el checkout los locales llegan como "pickup-point_<código>" y en el catálogo son "<código>"
  for (const c of [code, "table-" + code, code.replace(/^pickup-point[_-]/, "")]) {
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

// ---- regla de locales por SKU (13/11/2026): reemplaza a la app "reglas de negocio avanzadas" ----
// Ej.: sin retiro en Belgrano si el carrito tiene muebles o sillas (SKU que empiezan con M). TiendaNube no manda el
// SKU en la consulta (solo product_id y variant_id): los SKU de la tienda se tienen en memoria (se bajan cada hora).
const _SKUS = new Map();   // "store|v<variant_id>" -> sku ; "store|p<product_id>" -> [skus]
const MAX_REGLAS = 10;

function cargarSkus(storeId, productos) {
  const sid = str(storeId);
  let n = 0;
  for (const p of productos || []) {
    if (!p || typeof p !== "object") continue;
    const lista = [];
    for (const v of p.variants || []) {
      const sku = str(v && v.sku);
      if (v && v.id !== undefined && sku) { _SKUS.set(`${sid}|v${str(v.id)}`, sku); lista.push(sku); n++; }
    }
    if (p.id !== undefined) _SKUS.set(`${sid}|p${str(p.id)}`, lista);
  }
  return n;
}

/** SKU de los productos del carrito; faltan = product_id de los que no hay datos en memoria. */
function skusDelCarrito(storeId, items) {
  const sid = str(storeId);
  const skus = [], faltan = [];
  for (const it of items || []) {
    if (!it || typeof it !== "object") continue;
    const v = _SKUS.get(`${sid}|v${str(it.variant_id)}`);
    if (v) { skus.push(v); continue; }
    const p = _SKUS.get(`${sid}|p${str(it.product_id)}`);
    if (p) { skus.push(...p); continue; }
    if (str(it.product_id)) faltan.push(str(it.product_id));
  }
  return { skus, faltan };
}

/** Solo reglas con al menos un local y un prefijo; prefijos en mayúscula. */
function limpiarReglas(reglas) {
  if (!Array.isArray(reglas)) return [];
  const out = [];
  for (const r of reglas.slice(0, MAX_REGLAS)) {
    if (!r || typeof r !== "object") continue;
    const locales = (Array.isArray(r.locales) ? r.locales : []).map((x) => str(x).slice(0, 80)).filter(Boolean);
    const prefijos = (Array.isArray(r.prefijos) ? r.prefijos : []).map((x) => str(x).toUpperCase().slice(0, 30)).filter(Boolean);
    if (!locales.length || !prefijos.length) continue;
    out.push({ activa: r.activa === true, locales, prefijos, nombre: str(r.nombre).slice(0, 60) });
  }
  return out;
}

/** Códigos de catálogo que hay que sacar según las reglas activas que aplican a estos SKU. */
function localesAQuitar(reglas, skus) {
  const fuera = new Set();
  const SK = skus.map((x) => str(x).toUpperCase());
  for (const r of reglas || []) {
    if (!r.activa) continue;
    if (SK.some((sku) => r.prefijos.some((p) => sku.startsWith(p)))) r.locales.forEach((c) => fuera.add(c));
  }
  return fuera;
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

function borrarTodo() { _DATOS.clear(); _VISTOS.clear(); _SKUS.clear(); }
const cantidad = () => _DATOS.size;

// ======================================================================= servicio (rutas) ====
// La regla (callback de TiendaNube) tiene 800 ms: se resuelve todo en memoria y nunca espera a Firestore ni a
// TiendaNube. Config, catálogo y fotos se cargan/refrescan en segundo plano.

// Exclusivo de Alto Rancho: cualquier otra tienda queda apagada y no se puede instalar ni prender.
const ALLOWED_STORES = ["2547699"];
const permitida = (sid) => ALLOWED_STORES.includes(str(sid));

// Diseño editable desde el panel. Los defaults son el diseño de diseño gráfico de Alto Rancho (13/11/2026).
// fondoTitulo = fondo de los grupos; fondoTituloElegida = fondo de la opción elegida.
const FUENTES = ["inherit", "Poppins", "Montserrat", "Inter", "Playfair Display", "Oswald"];
const DEFAULT_ESTILO = Object.freeze({
  fuente: "Poppins", tamano: 14, radio: 10, mostrarIconos: true,
  colorTexto: "#111111", colorElegida: "#111111", colorBorde: "#dddddd",
  fondoTitulo: "#ffffff", fondoTituloElegida: "#f4f4f4",
  ecoFondo: "#E2EFDA", ecoTexto: "#2E6B1F", rapFondo: "#DDEBF7", rapTexto: "#1F4E79",
  pregunta: "¿cómo querés recibirlo?",
  tituloDomicilio: "Envío a domicilio", tituloLocal: "Retiro en nuestros locales", tituloPunto: "Entrega en punto de retiro",
  textoEco: "más económico", textoRap: "más rápido",
});
const COLOR = /^#[0-9a-fA-F]{6}$/;

// Íconos de los grupos: Material Symbols de Google (Outlined, 24px, viewBox "0 -960 960 960"), pedidos por
// marketing el 13/11/2026: local_shipping (domicilio), storefront (locales) y pin_drop (punto de retiro), más
// chevron_right / expand_more / expand_less para la flecha de los desplegables.
const ICONOS = Object.freeze({
  domicilio: "M155-195q-35-35-35-85H40v-440q0-33 23.5-56.5T120-800h560v160h120l120 160v200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q280-263 280-280t-11.5-28.5Q257-320 240-320t-28.5 11.5Q200-297 200-280t11.5 28.5Q223-240 240-240t28.5-11.5ZM120-360h32q17-18 39-29t49-11q27 0 49 11t39 29h272v-360H120v360Zm628.5 108.5Q760-263 760-280t-11.5-28.5Q737-320 720-320t-28.5 11.5Q680-297 680-280t11.5 28.5Q703-240 720-240t28.5-11.5ZM680-440h170l-90-120h-80v120ZM360-540Z",
  local: "M841-518v318q0 33-23.5 56.5T761-120H201q-33 0-56.5-23.5T121-200v-318q-23-21-35.5-54t-.5-72l42-136q8-26 28.5-43t47.5-17h556q27 0 47 16.5t29 43.5l42 136q12 39-.5 71T841-518Zm-272-42q27 0 41-18.5t11-41.5l-22-140h-78v148q0 21 14 36.5t34 15.5Zm-180 0q23 0 37.5-15.5T441-612v-148h-78l-22 140q-4 24 10.5 42t37.5 18Zm-178 0q18 0 31.5-13t16.5-33l22-154h-78l-40 134q-6 20 6.5 43t41.5 23Zm540 0q29 0 42-23t6-43l-42-134h-76l22 154q3 20 16.5 33t31.5 13ZM201-200h560v-282q-5 2-6.5 2H751q-27 0-47.5-9T663-518q-18 18-41 28t-49 10q-27 0-50.5-10T481-518q-17 18-39.5 28T393-480q-29 0-52.5-10T299-518q-21 21-41.5 29.5T211-480h-4.5q-2.5 0-5.5-2v282Zm560 0H201h560Z",
  abrir: "M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z",
  derecha: "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z",
  cerrar: "m296-345-56-56 240-240 240 240-56 56-184-184-184 184Z",
  punto: "M480-301q99-80 149.5-154T680-594q0-90-56-148t-144-58q-88 0-144 58t-56 148q0 65 50.5 139T480-301Zm0 101Q339-304 269.5-402T200-594q0-125 78-205.5T480-880q124 0 202 80.5T760-594q0 94-69.5 192T480-200Zm0-320q33 0 56.5-23.5T560-600q0-33-23.5-56.5T480-680q-33 0-56.5 23.5T400-600q0 33 23.5 56.5T480-520ZM200-80v-80h560v80H200Zm280-520Z",
});
const svgIcono = (nombre, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960"><path fill="${color}" d="${ICONOS[nombre]}"/></svg>`;

/** Solo claves conocidas, con tipo y rango válidos; lo inválido vuelve al default. */
function limpiarEstilo(e) {
  const out = { ...DEFAULT_ESTILO };
  if (!e || typeof e !== "object") return out;
  for (const [k, def] of Object.entries(DEFAULT_ESTILO)) {
    const v = e[k];
    if (v === undefined || v === null) continue;
    if (k === "fuente") out[k] = FUENTES.includes(v) ? v : "inherit";
    else if (k === "tamano") out[k] = Math.min(16, Math.max(12, Math.round(num(v, def))));
    else if (k === "radio") out[k] = Math.min(16, Math.max(0, Math.round(num(v, def))));
    else if (typeof def === "boolean") out[k] = v === true;
    else if (k.startsWith("color") || k.endsWith("Fondo") || k.endsWith("Texto") || k.startsWith("fondo")) out[k] = COLOR.test(String(v)) ? String(v) : def;
    else out[k] = String(v).slice(0, 60);
  }
  return out;
}

const COL_CONFIG = "promonube_alto_envios";
const COL_FOTOS = "promonube_alto_envios_fotos";
const TN_API = "https://api.tiendanube.com/v1";
const EVENTO_ENVIO = "shipping/before-filter";
// Scripts del Portal (GlowLab #23137 → Scripts). Los "auto instalados" creados después de que la tienda instaló
// la app no se agregan solos: se activan por API (POST /2025-03/{store}/scripts {script_id}).
const SCRIPTS_PORTAL = { tienda: 12611, checkout: 12612 };
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
  const estado = { configTs: 0, catalogoTs: 0, fotosMin: 0, fotosN: 0, aceptadas: 0, rechazadas: 0, skus: new Map() };
  const decisiones = [];                 // memoria circular: {t, storeId, fuente, ocultas, mostradas, ms}
  const consultas = new Map();           // storeId -> {n, ultima}
  let widgetCache = null;

  const APAGADO = { enabled: false, ocultar: false };
  const cfg = (sid) => (permitida(sid) && config.get(str(sid))) || APAGADO;

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
    if (!permitida(sid)) throw new Error("Módulo exclusivo de Alto Rancho");
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

  const reglasActivas = (c) => limpiarReglas(c && c.reglasLocales).filter((r) => r.activa);

  /** Catálogo (y SKU, si hay reglas de locales) de cada tienda con algo prendido. Se refresca cada hora. */
  async function cargarCatalogos() {
    estado.catalogoTs = Date.now();
    for (const [sid, c] of config) {
      if (!permitida(sid)) continue;
      const reglas = reglasActivas(c).length > 0;
      if (!c.enabled && !c.ocultar && !reglas) continue;
      try {
        const r = await cargarCatalogoDe(sid);
        if (r.error) console.warn(`[alto-envios] catálogo ${sid}: ${r.status} ${r.error}`);
        if (reglas) await cargarProductos(sid);
      } catch (e) { console.warn(`[alto-envios] catálogo ${sid}:`, e.message); }
    }
  }

  /** SKU de todos los productos de la tienda (de a 200 por página). */
  async function cargarProductos(sid) {
    const tok = await token(sid);
    if (!tok) return 0;
    let n = 0;
    for (let page = 1; page <= 100; page++) {
      const { status, datos } = await tn("GET", sid, `products?per_page=200&page=${page}&fields=id,variants`, tok);
      if (status !== 200 || !Array.isArray(datos)) break;
      n += cargarSkus(sid, datos);
      if (datos.length < 200) break;
    }
    estado.skus.set(str(sid), { n, at: new Date().toISOString() });
    return n;
  }

  /** Un producto que no estaba en memoria (recién creado): se busca en el momento (la regla le pone tope). */
  async function buscarProducto(sid, pid) {
    try {
      const tok = await token(sid);
      if (!tok) return;
      const { status, datos } = await tn("GET", sid, `products/${encodeURIComponent(pid)}?fields=id,variants`, tok);
      if (status === 200 && datos) cargarSkus(sid, [datos]);
    } catch { /* sin datos: la regla no aplica */ }
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
    const c = cfg(sid);
    const reglas = reglasActivas(c);
    if (sid && (c.ocultar === true || reglas.length)) {
      const envio = p.shipping && typeof p.shipping === "object" ? p.shipping : {};
      const items = Array.isArray(p.products) ? p.products : [];
      // filtered_options = las opciones que QUEDAN; vacío = no se filtra nada
      let mostrar = [];
      if (c.ocultar === true) { dec = decidir(sid, p.cart_id, envio.postalcode, items); mostrar = dec.mostrar; }
      if (reglas.length) {
        let { skus, faltan } = skusDelCarrito(sid, items);
        if (faltan.length) {
          // tope de 400 ms (TiendaNube espera 800): si no llega, ese producto no cuenta y queda para la próxima
          await Promise.race([Promise.all(faltan.slice(0, 5).map((pid) => buscarProducto(sid, pid))), new Promise((r) => setTimeout(r, 400))]);
          ({ skus } = skusDelCarrito(sid, items));
        }
        const fuera = localesAQuitar(reglas, skus);
        if (fuera.size) {
          // sin cotización real: todas las opciones del catálogo (TiendaNube muestra solo las que aplican)
          const base = mostrar.length ? mostrar
            : Object.entries(catalogo(sid)).map(([code, e]) => ({ id: e.id, option_id: e.option_id, code }));
          const quedan = base.filter((o) => !fuera.has(str(o.code)));
          if (quedan.length && quedan.length < base.length) {
            dec = { ...(dec || {}), mostrar: quedan, fuente: "regla_local", ocultas: ((dec && dec.ocultas) || 0) + (base.length - quedan.length) };
            mostrar = quedan;
          } else if (!dec) dec = { mostrar: [], fuente: "regla_sin_cambios", ocultas: 0 };
        } else if (!dec) dec = { mostrar: [], fuente: "regla_no_aplica", ocultas: 0 };
      }
      if (mostrar.length) respuesta = { command: "filter_shipping_options", detail: { filtered_options: mostrar } };
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
    const c = cfg(req.query.storeId);
    return res.json({ success: true, enabled: c.enabled === true, estilo: limpiarEstilo(c.estilo) });
  }

  // ---- GET /api/alto-envios-widget.js?store= (script del carrito y del producto) ----
  async function widget(req, res) {
    refrescarSiHaceFalta();
    res.type("application/javascript");
    res.set("Cache-Control", "public, max-age=300");
    if (cfg(req.query.store).enabled !== true) return res.send("/* GlowLab · envíos agrupados: apagado */");
    if (widgetCache === null) widgetCache = fs.readFileSync(WIDGET_JS, "utf8");
    // el diseño va adelante del script; "<" escapado para que un texto no pueda cerrar un <script>
    const datos = JSON.stringify(limpiarEstilo(cfg(req.query.store).estilo)).replace(/</g, "\x5cu003c");
    return res.send(`window.__altoEnviosCfg=${datos};
window.__altoEnviosIconos=${JSON.stringify(ICONOS)};
` + widgetCache);
  }

  // ---- GET /api/alto-envios/icono/:nombre.svg?c=RRGGBB (los íconos del checkout: NubeSDK solo dibuja <img>) ----
  function icono(req, res) {
    const nombre = str(req.params && req.params.nombre).replace(/.svg$/, "");
    if (!Object.prototype.hasOwnProperty.call(ICONOS, nombre)) return res.status(404).send("");
    const c = "#" + str(req.query && req.query.c).replace(/^#/, "");
    res.type("image/svg+xml");
    res.set({ "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
    return res.send(svgIcono(nombre, COLOR.test(c) ? c : DEFAULT_ESTILO.colorTexto));
  }

  // ---- POST /api/alto-envios/install {storeId}: regla de envíos + catálogo ----
  async function install(req, res) {
    const sid = str((req.body || {}).storeId);
    if (!sid) return res.status(400).json({ success: false, message: "storeId requerido" });
    if (!permitida(sid)) return res.status(403).json({ success: false, message: "Módulo exclusivo de Alto Rancho" });
    try {
      const tok = await token(sid);
      if (!tok) return res.status(404).json({ success: false, message: "La tienda no tiene GlowLab instalado" });
      const r = await tn("PUT", sid, "business_rules/integrations/shipping", tok, { url: `${base}/api/alto-envios/regla`, event: EVENTO_ENVIO });
      const cat = await cargarCatalogoDe(sid);
      const scripts = {};
      for (const [nombre, id] of Object.entries(SCRIPTS_PORTAL)) {
        try {
          const rs = await fetchFn(`https://api.tiendanube.com/2025-03/${sid}/scripts`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tok}`, "User-Agent": USER_AGENT, "Content-Type": "application/json" },
            body: JSON.stringify({ script_id: id }),
          });
          let txt = "";
          try { txt = await rs.text(); } catch { txt = ""; }
          scripts[nombre] = { id, status: rs.status, ...(rs.status >= 300 ? { respuesta: String(txt).slice(0, 300) } : {}) };
        } catch (e) { scripts[nombre] = { id, status: 0, respuesta: e.message }; }
      }
      const inst = {
        at: new Date().toISOString(),
        regla: { status: r.status, respuesta: r.datos ? JSON.stringify(r.datos).slice(0, 500) : null },
        catalogo: cat.n, catalogoStatus: cat.status, scripts, ...(cat.error ? { catalogoError: cat.error } : {}),
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
      opcionesCatalogo: Object.entries(catalogo(sid)).map(([code, e]) => ({ code, nombre: e.nombre, carrier: e.carrier })),
      skus: estado.skus.get(sid) || null,
      fotos: { aceptadas: estado.aceptadas, rechazadas: estado.rechazadas },
      decisiones: decisiones.filter((d) => d.storeId === sid).slice(0, 50),
    };
  }

  return { regla, foto, configPublica, widget, icono, install, cargarProductos, salud, ponerConfig, refrescarConfig, cargarCatalogos, recuperarFotos, cfg };
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
    if (!permitida(storeId)) return res.status(403).json({ success: false, message: "Módulo exclusivo de Alto Rancho" });
    const cambios = {};
    if (typeof enabled === "boolean") cambios.enabled = enabled;
    if (typeof ocultar === "boolean") cambios.ocultar = ocultar;
    if (req.body && req.body.estilo !== undefined) cambios.estilo = limpiarEstilo(req.body.estilo);
    if (req.body && req.body.reglasLocales !== undefined) cambios.reglasLocales = limpiarReglas(req.body.reglasLocales);
    try {
      const c = await s.ponerConfig(storeId, cambios);
      if (c.enabled || c.ocultar || cambios.reglasLocales) s.cargarCatalogos();
      res.json({ success: true, config: c });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });
  app.get("/api/alto-envios-widget.js", s.widget);
  app.get("/api/alto-envios/icono/:nombre", s.icono);
  app.post("/api/alto-envios/install", s.install);
  app.get("/api/alto-envios/salud", (req, res) => res.json({ success: true, ...s.salud(req.query.storeId) }));
  // al arrancar: config, cotizaciones guardadas y catálogo (en segundo plano)
  s.refrescarConfig().then(() => Promise.all([s.recuperarFotos(), s.cargarCatalogos()]))
    .catch((e) => console.warn("[alto-envios] arranque:", e.message));
  return s;
}

module.exports = {
  TTL_SEG, MAX_CLAVES, MAX_OPCIONES, ALLOWED_STORES, DEFAULT_ESTILO, FUENTES, ICONOS, limpiarReglas, cargarSkus, skusDelCarrito, localesAQuitar, limpiarEstilo, _DATOS,
  huella, guardar, clasificar, elegidas, aOcultar, cargarCatalogo, catalogo, tiendasConCatalogo,
  formatoTn, decidir, marcarVisto, visto, borrarTodo, cantidad,
  crearServicio, registerAltoEnviosRoutes,
};
