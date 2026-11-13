"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("./aviso-transferencia");

function dbFalsa(inicial = {}) {
  const docs = new Map(Object.entries(inicial));
  return {
    docs,
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: docs.has(String(id)), data: () => docs.get(String(id)) }),
        set: async (data, opt) => { docs.set(String(id), opt && opt.merge ? { ...(docs.get(String(id)) || {}), ...data } : data); },
      }),
    }),
  };
}
function resFalsa() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.status = (s) => { r.statusCode = s; return r; };
  r.set = (k, v) => { if (typeof k === "object") Object.assign(r.headers, k); else r.headers[k] = v; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
const SID = "2547699";

test("limpiarConfig: textos recortados, colores válidos, teléfono solo dígitos, palabras en minúscula", () => {
  const c = A.limpiarConfig({
    enabled: true, titulo1: "x".repeat(200), bgColor: "rojo", textColor: "#123456",
    whatsappPhone: "+54 9 11 3144-0631", palabras: [" Transferencia ", "", "CBU"], otra: "basura",
  });
  assert.equal(c.enabled, true);
  assert.equal(c.titulo1.length, 80);
  assert.equal(c.bgColor, A.DEFAULT.bgColor);
  assert.equal(c.textColor, "#123456");
  assert.equal(c.whatsappPhone, "5491131440631");
  assert.deepEqual(c.palabras, ["transferencia", "cbu"]);
  assert.equal(c.otra, undefined);
  assert.equal(A.limpiarConfig(null).enabled, false);
});

test("esTransferencia: por nombre o tipo del medio de pago elegido", () => {
  const P = ["transferencia"];
  assert.equal(A.esTransferencia({ name: "Transferencia bancaria (20% OFF)" }, P), true);
  assert.equal(A.esTransferencia({ method_type: "wire_transfer", name: "Depósito" }, P), true);
  assert.equal(A.esTransferencia({ name: "Mercado Pago", method_type: "credit_card" }, P), false);
  assert.equal(A.esTransferencia(null, P), false);
});

test("config pública: solo Alto Rancho; otra tienda queda apagada", async () => {
  const db = dbFalsa({ [SID]: { enabled: true, titulo1: "Hola" } });
  const s = A.crearServicio({ db });
  const r = resFalsa();
  await s.configPublica({ query: { storeId: SID } }, r);
  assert.equal(r.body.config.enabled, true);
  assert.equal(r.body.config.titulo1, "Hola");
  assert.equal(r.body.config.titulo2, A.DEFAULT.titulo2);
  assert.equal(r.headers["Access-Control-Allow-Origin"], "*");
  const r2 = resFalsa();
  await s.configPublica({ query: { storeId: "1" } }, r2);
  assert.equal(r2.body.config.enabled, false);
});

test("guardar: limpia lo que llega y rechaza otras tiendas", async () => {
  const db = dbFalsa();
  const s = A.crearServicio({ db });
  const r = resFalsa();
  await s.guardar({ body: { storeId: SID, config: { enabled: true, texto2: "No pagues", bgColor: "nope" } } }, r);
  assert.equal(r.body.success, true);
  assert.equal(db.docs.get(SID).texto2, "No pagues");
  assert.equal(db.docs.get(SID).bgColor, A.DEFAULT.bgColor);
  const r2 = resFalsa();
  await s.guardar({ body: { storeId: "1", config: { enabled: true } } }, r2);
  assert.equal(r2.statusCode, 403);
});
