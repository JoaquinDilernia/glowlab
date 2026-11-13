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

module.exports = {
  TTL_SEG, MAX_CLAVES, MAX_OPCIONES, _DATOS,
  huella, guardar, clasificar, elegidas, aOcultar, cargarCatalogo, catalogo, tiendasConCatalogo,
  formatoTn, decidir, marcarVisto, visto, borrarTodo, cantidad,
};
