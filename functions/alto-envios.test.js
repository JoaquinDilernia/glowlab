"use strict";

// Pruebas portadas de test_app.py (paquete de logística de Alto Rancho, 12/11/2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./alto-envios");

const op = (code, price, mx, mn = 1, type = "ship", method = "api_77") =>
  ({ code, price, max_days: mx, min_days: mn, type, method, name: code });
const ITEMS = [{ variant_id: 5, quantity: 2 }];
const FOTO = {
  store_id: 8431701, cart_id: "999", zipcode: "1642", items: ITEMS,
  opciones: [
    op("zippin_standard_1", 100, 4), op("zippin_standard_2", 300, 1), op("zippin_standard_3", 200, 5),
    op("ne-correo-arg-clasico-domicilio", 150, 6, 1, "ship", "api_88"), op("ne-andreani-domicilio", 160, 6, 1, "ship", "api_88"),
    op("ne-correo-arg-expreso-domicilio", 250, 3, 1, "ship", "api_88"),
    op("7620339", 19500, 3, 1, "ship", "table"), op("7620500", 30000, 3, 1, "ship", "table"), op("7620501", 40000, 3, 1, "ship", "table"),
    op("01ULID", 0, 3, 1, "pickup", "pickup-point"), op("01ULID2", 0, 3, 1, "pickup", "pickup-point"),
    op("01ULID3", 0, 3, 1, "pickup", "pickup-point"),
  ],
};
const CATALOGO = [
  { id: "cd6c8a5d", name: "Zipnova", options: [1, 2, 3].map((i) => ({ id: String(31784330 + i), code: `zippin_standard_${i}` })) },
  { id: "ab12", name: "Envío Nube", options: [{ id: "555", code: "ne-andreani-domicilio" }, { id: "556", code: "ne-correo-arg-clasico-domicilio" }, { id: "557", code: "ne-correo-arg-expreso-domicilio" }] },
  { id: "d579", name: "Personalizado", options: ["7620339", "7620500", "7620501"].map((c) => ({ id: c, code: "table-" + c })) },
  { id: "2ebc", name: "Locale", options: ["01ULID", "01ULID2", "01ULID3"].map((c) => ({ id: c, code: c })) },
];

test("huella: productos y cantidades en orden fijo", () => {
  assert.equal(F.huella([{ variant_id: 9, quantity: 1 }, { variant_id: 5, quantity: 2 }]), "5x2,9x1");
  assert.equal(F.huella([{ id: 3 }]), "3x1");
  assert.equal(F.huella([]), "");
});

test("clasificar", () => {
  assert.deepEqual(F.clasificar(op("01ULID", 0, 3, 1, "pickup", "pickup-point")), ["local", "Local"]);
  assert.deepEqual(F.clasificar(op("zippin_pickup_1", 0, 3, 1, "pickup")), ["punto", "Zipnova"]);
  assert.deepEqual(F.clasificar(op("ne-andreani-domicilio", 1, 3)), ["domicilio", "Envío Nube"]);
  assert.deepEqual(F.clasificar(op("7620339", 1, 3, 1, "ship", "table")), ["domicilio", "Envío propio"]);
});

test("decidir: sin catálogo no manda lista", () => {
  F.borrarTodo();
  F.guardar(FOTO);
  const d = F.decidir(8431701, "999", "1642", ITEMS);
  assert.equal(d.fuente, "sin_catalogo");
  assert.deepEqual(d.mostrar, []);
  assert.ok(d.falta);
});

test("decidir: con catálogo, deja todo menos lo que no es ni más barato ni más rápido", () => {
  F.borrarTodo();
  F.guardar(FOTO);
  assert.equal(F.cargarCatalogo(8431701, CATALOGO), 12);
  const d = F.decidir(8431701, "999", "1642", ITEMS);
  assert.equal(d.fuente, "carrito");
  assert.equal(d.ocultas, 2);
  assert.deepEqual(d.mostrar.map((o) => o.code).sort(), [
    "zippin_standard_1", "zippin_standard_2", "ne-correo-arg-clasico-domicilio", "ne-correo-arg-expreso-domicilio",
    "table-7620339", "table-7620500", "table-7620501", "01ULID", "01ULID2", "01ULID3"].sort());
  const m = Object.fromEntries(d.mostrar.map((o) => [o.code, o]));
  assert.deepEqual(m.zippin_standard_1, { id: "cd6c8a5d", option_id: "31784331", code: "zippin_standard_1" });
  assert.deepEqual(m["table-7620339"], { id: "d579", option_id: "7620339", code: "table-7620339" });
  assert.deepEqual(m["01ULID"], { id: "2ebc", option_id: "01ULID", code: "01ULID" });
});

test("decidir: combo, otro CP, cambio de cantidad y vencida", () => {
  F.borrarTodo();
  F.guardar(FOTO);
  F.cargarCatalogo(8431701, CATALOGO);
  assert.equal(F.decidir(8431701, "1000", "1642", [{ variant_id: 5, quantity: 2 }]).fuente, "combo");
  assert.deepEqual(F.decidir(8431701, "1000", "1704", ITEMS), { mostrar: [], fuente: "sin_datos", ocultas: 0 });
  assert.deepEqual(F.decidir(8431701, "999", "1642", [{ variant_id: 5, quantity: 3 }]), { mostrar: [], fuente: "sin_datos", ocultas: 0 });
  assert.equal(F.decidir(8431701, "999", "1642", ITEMS, Date.now() / 1000 + F.TTL_SEG + 1).fuente, "sin_datos");
});

test("una foto con menos opciones no borra las anteriores", () => {
  F.borrarTodo();
  F.guardar(FOTO);
  F.cargarCatalogo(8431701, CATALOGO);
  F.guardar({ ...FOTO, opciones: FOTO.opciones.slice(0, 2) });
  assert.equal(F.decidir(8431701, "999", "1642", ITEMS).ocultas, 2);
});

test("grupos de 2 o menos no se tocan", () => {
  F.borrarTodo();
  F.guardar({ ...FOTO, opciones: [op("zippin_standard_1", 100, 4), op("zippin_standard_2", 300, 1), op("01ULID", 0, 3, 1, "pickup", "pickup-point")] });
  assert.deepEqual(F.decidir(8431701, "999", "1642", ITEMS), { mostrar: [], fuente: "carrito", ocultas: 0 });
});

test("tope de opciones por clave", () => {
  F.borrarTodo();
  F.guardar({ store_id: 9, cart_id: 9, zipcode: "1000", items: [{ variant_id: 1 }], opciones: Array.from({ length: 200 }, (_, i) => ({ code: `x${i}`, price: i })) });
  assert.ok(F._DATOS.size > 0);
  for (const d of F._DATOS.values()) assert.ok(Object.keys(d.opciones).length <= F.MAX_OPCIONES);
});

test("visto: solo carritos consultados y no vencidos", () => {
  F.borrarTodo();
  assert.equal(F.visto(1, "a"), false);
  F.marcarVisto(1, "a");
  assert.equal(F.visto("1", "a"), true);
  assert.equal(F.visto(1, "a", Date.now() / 1000 + F.TTL_SEG + 1), false);
});

// ------------------------------------------------------------------ rutas (servicio) ----

// Firestore falso: colecciones -> Map(id -> data). Alcanza para lo que usa el servicio.
function dbFalsa(inicial = {}) {
  const cols = new Map(Object.entries(inicial).map(([c, docs]) => [c, new Map(Object.entries(docs))]));
  let auto = 0;
  const col = (name) => { if (!cols.has(name)) cols.set(name, new Map()); return cols.get(name); };
  const snapDoc = (m, id) => ({ id, exists: m.has(id), data: () => m.get(id) });
  const query = (name, filtros = [], lim = Infinity) => ({
    where: (f, op, v) => query(name, [...filtros, [f, op, v]], lim),
    orderBy: () => query(name, filtros, lim),
    limit: (n) => query(name, filtros, n),
    get: async () => {
      const m = col(name);
      const docs = [...m.entries()].filter(([, d]) => filtros.every(([f, op, v]) => (op === ">=" ? d[f] >= v : op === "<" ? d[f] < v : d[f] === v)))
        .slice(0, lim).map(([id]) => ({ ...snapDoc(m, id), ref: { delete: async () => m.delete(id) } }));
      return { docs, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  });
  return {
    cols,
    collection: (name) => ({
      ...query(name),
      doc: (id) => ({
        get: async () => snapDoc(col(name), String(id)),
        set: async (data, opt) => { const m = col(name); m.set(String(id), opt && opt.merge ? { ...(m.get(String(id)) || {}), ...data } : data); },
      }),
      add: async (data) => { col(name).set(`a${++auto}`, data); return { id: `a${auto}` }; },
    }),
  };
}

function resFalsa() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.status = (s) => { r.statusCode = s; return r; };
  r.set = (k, v) => { if (typeof k === "object") Object.assign(r.headers, k); else r.headers[k] = v; return r; };
  r.setHeader = r.set;
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.sendStatus = (s) => { r.statusCode = s; return r; };
  r.type = (t) => { r.headers["Content-Type"] = t; return r; };
  return r;
}

const SID = "2547699";
function servicio(extra = {}) {
  const llamadas = [];
  const fetchFn = async (url, opt = {}) => {
    llamadas.push({ url, ...opt });
    if (url.endsWith("/shipping_carriers/options")) return { status: 200, ok: true, json: async () => CATALOGO, text: async () => "" };
    return { status: 204, ok: true, json: async () => ({}), text: async () => "" };
  };
  const db = dbFalsa({ promonube_stores: { [SID]: { accessToken: "tok" } }, ...extra });
  const s = F.crearServicio({ db, fetchFn, base: "https://api.example.com" });
  return { s, db, llamadas };
}
const pedido = { store_id: SID, cart_id: 999, shipping: { postalcode: "1642" }, products: ITEMS };
const fotoSid = { ...FOTO, store_id: Number(SID) };

test("regla: con ocultar apagado contesta 204 aunque haya datos", async () => {
  F.borrarTodo();
  const { s } = servicio();
  await s.ponerConfig(SID, { enabled: true, ocultar: false });
  F.cargarCatalogo(SID, CATALOGO);
  F.marcarVisto(SID, "999"); F.guardar(fotoSid);
  const r = resFalsa();
  await s.regla({ body: pedido }, r);
  assert.equal(r.statusCode, 204);
});

test("regla: con ocultar prendido manda las que quedan; otra tienda o sin datos → 204", async () => {
  F.borrarTodo();
  const { s } = servicio();
  await s.ponerConfig(SID, { enabled: true, ocultar: true });
  F.cargarCatalogo(SID, CATALOGO);
  F.guardar(fotoSid);
  const r = resFalsa();
  await s.regla({ body: pedido }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.command, "filter_shipping_options");
  assert.equal(r.body.detail.filtered_options.length, 10);
  const r2 = resFalsa();
  await s.regla({ body: { ...pedido, store_id: "1" } }, r2);
  assert.equal(r2.statusCode, 204);
  const r3 = resFalsa();
  await s.regla({ body: { ...pedido, shipping: { postalcode: "5000" } } }, r3);
  assert.equal(r3.statusCode, 204);
  assert.equal(s.salud(SID).decisiones[0].fuente, "sin_datos");
  assert.equal(s.salud(SID).consultas, 3 - 1);   // la de la otra tienda no cuenta para esta
});

test("foto: sin consulta previa → 403; con consulta → 204 y se guarda; grande → 413", async () => {
  F.borrarTodo();
  const { s, db } = servicio();
  const r = resFalsa();
  await s.foto({ method: "POST", body: JSON.stringify(fotoSid) }, r);
  assert.equal(r.statusCode, 403);
  assert.equal(F.cantidad(), 0);
  await s.regla({ body: pedido }, resFalsa());          // TiendaNube preguntó por el carrito 999
  const r2 = resFalsa();
  await s.foto({ method: "POST", body: JSON.stringify(fotoSid) }, r2);
  assert.equal(r2.statusCode, 204);
  assert.equal(r2.headers["Access-Control-Allow-Origin"], "*");
  assert.ok(F.cantidad() > 0);
  await new Promise((ok) => setImmediate(ok));
  assert.equal(db.cols.get("promonube_alto_envios_fotos").size, 1);
  const r3 = resFalsa();
  await s.foto({ method: "POST", body: "x".repeat(65 * 1024) }, r3);
  assert.equal(r3.statusCode, 413);
  const r4 = resFalsa();
  await s.foto({ method: "POST", body: "{roto" }, r4);
  assert.equal(r4.statusCode, 400);
});

test("recuperarFotos: después de un reinicio vuelven las cotizaciones de las últimas 12 h", async () => {
  F.borrarTodo();
  const ahora = Date.now() / 1000;
  const { s } = servicio({ promonube_alto_envios_fotos: {
    f1: { storeId: SID, ts: ahora - 3600, foto: fotoSid },
    f2: { storeId: SID, ts: ahora - F.TTL_SEG - 10, foto: { ...fotoSid, zipcode: "9999" } },
  } });
  const n = await s.recuperarFotos();
  assert.equal(n, 1);
  F.cargarCatalogo(SID, CATALOGO);
  assert.equal(F.decidir(SID, "999", "1642", ITEMS).fuente, "carrito");
  assert.equal(F.decidir(SID, "999", "9999", ITEMS).fuente, "sin_datos");
});

test("install: registra la regla con el token de la tienda y carga el catálogo", async () => {
  F.borrarTodo();
  const { s, llamadas, db } = servicio();
  const r = resFalsa();
  await s.install({ body: { storeId: SID } }, r);
  assert.equal(r.body.success, true);
  const put = llamadas.find((x) => x.method === "PUT");
  assert.equal(put.url, `https://api.tiendanube.com/v1/${SID}/business_rules/integrations/shipping`);
  assert.deepEqual(JSON.parse(put.body), { url: "https://api.example.com/api/alto-envios/regla", event: "shipping/before-filter" });
  assert.equal(put.headers.Authentication, "bearer tok");
  assert.equal(r.body.install.catalogo, 12);
  assert.ok(!JSON.stringify(r.body).includes("tok\""));
  assert.equal(db.cols.get("promonube_alto_envios").get(SID).install.regla.status, 204);
});

test("config pública y widget apagado", async () => {
  const { s } = servicio();
  await s.ponerConfig(SID, { enabled: false, ocultar: false });
  const r = resFalsa();
  await s.configPublica({ query: { storeId: SID } }, r);
  assert.equal(r.body.success, true);
  assert.equal(r.body.enabled, false);
  const w = resFalsa();
  await s.widget({ query: { store: SID } }, w);
  assert.ok(!String(w.body).includes("alto-env"));
  await s.ponerConfig(SID, { enabled: true });
  const w2 = resFalsa();
  await s.widget({ query: { store: SID } }, w2);
  assert.ok(String(w2.body).includes("alto-env"));
});

test("solo Alto Rancho: otra tienda no se instala, no se prende ni recibe el widget", async () => {
  const { s, llamadas } = servicio({ promonube_stores: { [SID]: { accessToken: "tok" }, "1": { accessToken: "otro" } } });
  const r = resFalsa();
  await s.install({ body: { storeId: "1" } }, r);
  assert.equal(r.statusCode, 403);
  assert.equal(llamadas.length, 0);
  await assert.rejects(() => s.ponerConfig("1", { enabled: true }));
  const w = resFalsa();
  await s.widget({ query: { store: "1" } }, w);
  assert.ok(!String(w.body).includes("alto-env"));
});

test("la foto que se guarda en Firestore no lleva campos undefined (Firestore los rechaza)", async () => {
  F.borrarTodo();
  const { s, db } = servicio();
  await s.regla({ body: { store_id: SID, cart_id: 5 } }, resFalsa());
  const sinCp = { store_id: Number(SID), cart_id: 5, items: [{ variant_id: 1 }], opciones: [{ code: "a", price: 1 }] };
  // sin CP no hay clave de carrito: se agrega uno para que se guarde y se fuerza un campo sin valor
  const r = resFalsa();
  await s.foto({ method: "POST", body: { ...sinCp, zipcode: "1000", items: undefined } }, r);
  assert.equal(r.statusCode, 204);
  await new Promise((ok) => setImmediate(ok));
  const guardadas = [...(db.cols.get("promonube_alto_envios_fotos") || new Map()).values()];
  assert.equal(guardadas.length, 1);
  const hayUndefined = (o) => o === undefined || (o && typeof o === "object" && Object.values(o).some(hayUndefined));
  assert.equal(hayUndefined(guardadas[0]), false);
});

// ------------------------------------------------------------------ diseño ----

test("limpiarEstilo: solo claves conocidas, colores válidos, tamaños en rango y textos cortos", () => {
  const e = F.limpiarEstilo({
    fuente: "Poppins", tamano: 99, radio: -3, colorTexto: "#123abc", colorElegida: "rojo",
    tituloDomicilio: "A domicilio" + "x".repeat(200), mostrarIconos: false, hackeo: "<script>",
  });
  assert.equal(e.fuente, "Poppins");
  assert.equal(e.tamano, 16);
  assert.equal(e.radio, 0);
  assert.equal(e.colorTexto, "#123abc");
  assert.equal(e.colorElegida, F.DEFAULT_ESTILO.colorElegida);
  assert.equal(e.tituloDomicilio.length, 60);
  assert.equal(e.mostrarIconos, false);
  assert.equal("hackeo" in e, false);
  assert.equal(F.limpiarEstilo({ fuente: "Comic Sans" }).fuente, "inherit");
  assert.deepEqual(F.limpiarEstilo(null), F.DEFAULT_ESTILO);
});

test("config pública y widget llevan el diseño", async () => {
  const { s } = servicio();
  await s.ponerConfig(SID, { enabled: true, estilo: F.limpiarEstilo({ tituloLocal: "Retirá en Belgrano </script>" }) });
  const r = resFalsa();
  await s.configPublica({ query: { storeId: SID } }, r);
  assert.equal(r.body.estilo.tituloLocal, "Retirá en Belgrano </script>");
  assert.equal(r.body.estilo.tamano, F.DEFAULT_ESTILO.tamano);
  const w = resFalsa();
  await s.widget({ query: { store: SID } }, w);
  const js = String(w.body);
  assert.ok(js.startsWith("window.__altoEnviosCfg="));
  assert.ok(js.includes("Retirá en Belgrano"));
  assert.ok(!js.includes("</script>"));   // escapado: no puede cortar un <script> inline
});

test("install: activa en la tienda los dos scripts del Portal (tienda #12611 y checkout #12612)", async () => {
  const { s, llamadas } = servicio();
  const r = resFalsa();
  await s.install({ body: { storeId: SID } }, r);
  const posts = llamadas.filter((x) => x.method === "POST" && x.url === `https://api.tiendanube.com/2025-03/${SID}/scripts`);
  assert.deepEqual(posts.map((p) => JSON.parse(p.body).script_id).sort(), [12611, 12612]);
  assert.equal(posts[0].headers.Authorization, "Bearer tok");
  assert.deepEqual(Object.keys(r.body.install.scripts).sort(), ["checkout", "tienda"]);
});
