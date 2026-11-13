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
