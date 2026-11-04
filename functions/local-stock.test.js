"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ls = require("./local-stock");

test("clasifica ubicaciones de los locales", () => {
  assert.deepEqual(ls.classifyLocation("BL/Stock"), { code: "BL", kind: "stock" });
  assert.deepEqual(ls.classifyLocation("LL/Exhibicion"), { code: "LL", kind: "exhibition" });
  assert.deepEqual(ls.classifyLocation("AL/Exhibición"), { code: "AL", kind: "exhibition" });
  assert.equal(ls.classifyLocation("BL/Salida"), null);
  assert.equal(ls.classifyLocation("BL/Entrada"), null);
  assert.equal(ls.classifyLocation("AL/RL/Stock"), null); // Alcorta en Rolon: no es el local
});

const q = (loc, quantity, reserved = 0) => ({ location_id: [1, loc], quantity, reserved_quantity: reserved });

test("separa lo que se lleva de lo exhibido, por local", () => {
  const out = ls.summarizeQuants([
    q("BL/Stock", 1),
    q("BL/Exhibicion", 1),
    q("LL/Stock", 0),
    q("LL/Exhibicion", 2),
    q("AL/RL/Stock", 9),
    q("RL/Stock", 5),
    q("BL/Salida", 3),
  ]);
  const by = Object.fromEntries(out.map((r) => [r.warehouse, r]));
  assert.deepEqual([by.Belgrano.stockQty, by.Belgrano.exhibitedQty], [1, 1]);
  assert.deepEqual([by["Las Lomas"].stockQty, by["Las Lomas"].exhibitedQty], [0, 2]);
  assert.deepEqual([by.Alcorta.stockQty, by.Alcorta.exhibitedQty], [0, 0]);
  assert.equal(by.Belgrano.qty, 1);
});

test("lo reservado no se puede llevar", () => {
  const [bl] = ls.summarizeQuants([q("BL/Stock", 3, 2), q("BL/Stock", 1, 5)]);
  assert.equal(bl.stockQty, 1);
});

test("getLocalStock consulta producto y quants", async () => {
  const calls = [];
  const client = {
    async searchRead(model, domain) {
      calls.push(model);
      if (model === "product.product") return domain[0][2] === "TMA023CH" ? [{ id: 57330 }] : [];
      return [q("BL/Stock", 1), q("LL/Exhibicion", 1), q("EC/Stock", 4)];
    },
  };
  const out = await ls.getLocalStock(client, "TMA023CH");
  assert.deepEqual(calls, ["product.product", "stock.quant"]);
  assert.equal(out.find((r) => r.warehouse === "Belgrano").stockQty, 1);
  assert.equal(out.find((r) => r.warehouse === "Las Lomas").exhibitedQty, 1);
  const none = await ls.getLocalStock(client, "NOEXISTE");
  assert.ok(none.every((r) => r.stockQty === 0 && r.exhibitedQty === 0));
});

test("sin variables ODOO_* no hay config (se usa la API vieja)", () => {
  assert.equal(ls.odooConfigFromEnv({}), null);
  assert.deepEqual(ls.odooConfigFromEnv({ ODOO_URL: "u", ODOO_DB: "d", ODOO_LOGIN: "l", ODOO_PASSWORD: "p" }), { url: "u", db: "d", login: "l", password: "p" });
});
