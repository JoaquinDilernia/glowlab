"use strict";

// Stock en locales (Alto Rancho) leyendo Odoo directo, por UBICACION.
//
// En Odoo cada local es un deposito con (entre otras) dos ubicaciones:
//   XX/Stock       -> lo que se puede llevar en el momento
//   XX/Exhibicion  -> lo que esta exhibido en el local (se ve, no se lleva)
// Entrada/Salida y depositos externos (ej "AL/RL/Stock", Alcorta en Rolon) no cuentan.
//
// La API vieja (lett.exemax.ar/odoo-api/get-product) solo da el total por
// deposito, sin separar exhibicion: por eso un producto solo exhibido salia
// como "Disponible". Si Odoo no esta configurado (variables ODOO_*), index.js
// sigue usando esa API vieja.

// code = prefijo de las ubicaciones del local en Odoo.
const LOCALES = [
  { name: "Belgrano", code: "BL" },
  { name: "Las Lomas", code: "LL" },
  { name: "Alcorta", code: "AL" },
];

const stripAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// "BL/Exhibicion" | "LL/Exhibición" -> { code: "BL", kind: "exhibition" }; otras -> null
function classifyLocation(completeName) {
  const parts = stripAccents(completeName).trim().split("/");
  if (parts.length !== 2) return null; // "AL/RL/Stock" es otro deposito
  const [code, loc] = parts.map((p) => p.trim().toLowerCase());
  if (loc === "stock") return { code: code.toUpperCase(), kind: "stock" };
  if (loc === "exhibicion") return { code: code.toUpperCase(), kind: "exhibition" };
  return null;
}

// quants de stock.quant (location_id = [id, "BL/Stock"]) -> por local
function summarizeQuants(quants, locales = LOCALES) {
  const out = locales.map((l) => ({ warehouse: l.name, code: l.code, stockQty: 0, exhibitedQty: 0 }));
  const byCode = new Map(out.map((o) => [o.code, o]));
  for (const q of quants || []) {
    const loc = classifyLocation(Array.isArray(q.location_id) ? q.location_id[1] : q.location_id);
    if (!loc) continue;
    const row = byCode.get(loc.code);
    if (!row) continue;
    const qty = Number(q.quantity) || 0;
    if (loc.kind === "stock") row.stockQty += Math.max(0, qty - (Number(q.reserved_quantity) || 0));
    else row.exhibitedQty += Math.max(0, qty);
  }
  return out.map((r) => ({
    ...r,
    stockQty: Math.floor(r.stockQty),
    exhibitedQty: Math.floor(r.exhibitedQty),
    qty: Math.floor(r.stockQty), // compat con el widget viejo: qty = lo que se lleva
  }));
}

// Cliente JSON-RPC minimo (mismo esquema que odoo-sync-server).
function createOdooClient({ url, db, login, password, fetchImpl = fetch }) {
  let cookie = "";
  let authing = null;

  async function rpc(endpoint, params) {
    const headers = { "Content-Type": "application/json" };
    if (cookie) headers.Cookie = cookie;
    const res = await fetchImpl(url.replace(/\/+$/, "") + endpoint, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params }),
    });
    const sc = res.headers.get("set-cookie");
    const m = sc && /session_id=([^;]+)/.exec(sc);
    if (m) cookie = "session_id=" + m[1];
    const json = await res.json();
    if (json.error) {
      const err = new Error((json.error.data && json.error.data.message) || json.error.message || "Odoo error");
      err.sessionExpired = /session|expired|login/i.test(JSON.stringify(json.error).slice(0, 500));
      throw err;
    }
    return json.result;
  }

  async function authenticate() {
    if (!authing) {
      authing = (async () => {
        cookie = "";
        const r = await rpc("/web/session/authenticate", { db, login, password });
        if (!r || !r.uid) throw new Error("Odoo: no se pudo autenticar");
      })().finally(() => { authing = null; });
    }
    return authing;
  }

  async function searchRead(model, domain, fields, limit = 200) {
    const call = () => rpc("/web/dataset/call_kw", {
      model, method: "search_read", args: [domain], kwargs: { fields, limit, context: { lang: "es_AR" } },
    });
    if (!cookie) await authenticate();
    try {
      return await call();
    } catch (e) {
      if (!e.sessionExpired) throw e;
      await authenticate();
      return call();
    }
  }

  return { searchRead, authenticate };
}

async function getLocalStock(client, sku, locales = LOCALES) {
  const prods = await client.searchRead("product.product", [["default_code", "=", sku]], ["id"], 20);
  if (!prods.length) return summarizeQuants([], locales);
  const codes = locales.map((l) => l.code + "/");
  const quants = await client.searchRead(
    "stock.quant",
    [["product_id", "in", prods.map((p) => p.id)], ["location_id.usage", "=", "internal"]],
    ["location_id", "quantity", "reserved_quantity"],
    500
  );
  return summarizeQuants(quants.filter((q) => codes.some((c) => String(q.location_id && q.location_id[1]).startsWith(c))), locales);
}

function odooConfigFromEnv(env = process.env) {
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_PASSWORD } = env;
  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_PASSWORD) return null;
  return { url: ODOO_URL, db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD };
}

module.exports = {
  LOCALES,
  classifyLocation,
  summarizeQuants,
  createOdooClient,
  getLocalStock,
  odooConfigFromEnv,
};
