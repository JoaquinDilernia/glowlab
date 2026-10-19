"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidCombo,
  findCombosInCart,
  buildCallbackResponse,
  buildWidgetCombos,
  buildWidgetScript,
} = require("./combos");

const groupsByKey = new Map([
  ["MESA", { groupKey: "MESA", title: "Mesa Nova", products: [{ productId: "m1", name: "Mesa Nova Negro" }, { productId: "m2", name: "Mesa Nova Greige" }] }],
  ["SILLA", { groupKey: "SILLA", title: "Silla Rey", products: [{ productId: "s1", name: "Silla Rey Negro" }, { productId: "s2", name: "Silla Rey Natural" }] }],
]);

const comedor = {
  id: "c1", name: "Comedor Nova", active: true, discountPercent: 10,
  items: [{ type: "group", groupKey: "MESA", quantity: 1 }, { type: "group", groupKey: "SILLA", quantity: 4 }],
};

function line(id, productId, price, quantity) {
  return { id, product_id: productId, price: String(price), quantity };
}

test("isValidCombo - acepta un combo bien formado", () => {
  assert.equal(isValidCombo(comedor), true);
});

test("isValidCombo - rechaza descuento fuera de rango, sin items o con 1 sola unidad", () => {
  assert.equal(isValidCombo({ ...comedor, discountPercent: 0 }), false);
  assert.equal(isValidCombo({ ...comedor, discountPercent: 100 }), false);
  assert.equal(isValidCombo({ ...comedor, items: [] }), false);
  assert.equal(isValidCombo({ ...comedor, items: [{ type: "product", productId: "1", quantity: 1 }] }), false);
  assert.equal(isValidCombo({ ...comedor, items: [{ type: "otro", quantity: 2 }] }), false);
  assert.equal(isValidCombo({ ...comedor, name: "  " }), false);
});

test("findCombosInCart - mesa + 4 sillas mezclando colores arma 1 combo", () => {
  const cart = [line(1, "m2", 1000, 1), line(2, "s1", 100, 2), line(3, "s2", 100, 2)];
  const r = findCombosInCart(cart, [comedor], groupsByKey);
  assert.equal(r.applied.length, 1);
  assert.equal(r.applied[0].sets, 1);
  assert.equal(r.totalDiscount, 140); // 10% de 1000 + 4*100
});

test("findCombosInCart - incompleto (3 sillas) no descuenta", () => {
  const cart = [line(1, "m1", 1000, 1), line(2, "s1", 100, 3)];
  assert.equal(findCombosInCart(cart, [comedor], groupsByKey).totalDiscount, 0);
});

test("findCombosInCart - unidades de sobra no se descuentan", () => {
  const cart = [line(1, "m1", 1000, 1), line(2, "s1", 100, 6)];
  assert.equal(findCombosInCart(cart, [comedor], groupsByKey).totalDiscount, 140);
});

test("findCombosInCart - 2 combos completos", () => {
  const cart = [line(1, "m1", 1000, 2), line(2, "s1", 100, 8)];
  const r = findCombosInCart(cart, [comedor], groupsByKey);
  assert.equal(r.applied[0].sets, 2);
  assert.equal(r.totalDiscount, 280);
});

test("findCombosInCart - una unidad no cuenta para dos combos; gana el de mayor %", () => {
  const sillasPar = {
    id: "c2", name: "Par de sillas", active: true, discountPercent: 20,
    items: [{ type: "group", groupKey: "SILLA", quantity: 2 }],
  };
  const cart = [line(1, "m1", 1000, 1), line(2, "s1", 100, 4)];
  const r = findCombosInCart(cart, [comedor, sillasPar], groupsByKey);
  // primero "Par de sillas" (20%) se lleva las 4 sillas en 2 sets; el comedor queda sin sillas
  assert.deepEqual(r.applied.map((a) => [a.comboId, a.sets]), [["c2", 2]]);
  assert.equal(r.totalDiscount, 80);
});

test("findCombosInCart - combo inactivo o grupo oculto no aplica", () => {
  const cart = [line(1, "m1", 1000, 1), line(2, "s1", 100, 4)];
  assert.equal(findCombosInCart(cart, [{ ...comedor, active: false }], groupsByKey).totalDiscount, 0);
  const hidden = new Map(groupsByKey);
  hidden.set("SILLA", { ...groupsByKey.get("SILLA"), hidden: true });
  assert.equal(findCombosInCart(cart, [comedor], hidden).totalDiscount, 0);
});

test("findCombosInCart - item de producto suelto", () => {
  const combo = {
    id: "c3", name: "Mesa + lampara", active: true, discountPercent: 50,
    items: [{ type: "group", groupKey: "MESA", quantity: 1 }, { type: "product", productId: "777", quantity: 1 }],
  };
  const cart = [line(1, "m1", 1000, 1), line(2, "777", 200, 1)];
  assert.equal(findCombosInCart(cart, [combo], groupsByKey).totalDiscount, 600);
});

const state = { installed: true, config: { enabled: true, promotionId: "promo-1", combos: [comedor] }, groupsByKey };

test("buildCallbackResponse - aplica un descuento fijo cross_items con 2 decimales", () => {
  const out = buildCallbackResponse({
    execution_tier: "cross_items", currency: "ARS", promotions: [],
    products: [line(1, "m1", 1000.5, 1), line(2, "s2", 100, 4)],
  }, state);
  assert.equal(out.status, 200);
  const cmd = out.body.commands[0];
  assert.equal(cmd.command, "create_or_update_discount");
  assert.equal(cmd.specs.promotion_id, "promo-1");
  assert.deepEqual(cmd.specs.discount_specs, { type: "fixed", amount: "140.05" });
  assert.equal(cmd.specs.display_text["es-ar"], "Combo: Comedor Nova");
});

test("buildCallbackResponse - sin combo y sin descuento previo responde 204", () => {
  const out = buildCallbackResponse({ execution_tier: "cross_items", promotions: [], products: [line(1, "m1", 1000, 1)] }, state);
  assert.equal(out.status, 204);
});

test("buildCallbackResponse - si el combo se rompe, saca el descuento que ya estaba", () => {
  const out = buildCallbackResponse({
    execution_tier: "cross_items",
    promotions: [{ id: "promo-1", line_items: [] }],
    products: [line(1, "m1", 1000, 1), line(2, "s1", 100, 1)],
  }, state);
  assert.deepEqual(out.body.commands, [{ command: "remove_discount", specs: { scope: "cart", promotion_ids: ["promo-1"] } }]);
});

test("buildCallbackResponse - modulo deshabilitado saca el descuento aplicado", () => {
  const off = { ...state, config: { ...state.config, enabled: false } };
  const out = buildCallbackResponse({
    execution_tier: "cross_items",
    promotions: [{ id: "promo-1", line_items: [] }],
    products: [line(1, "m1", 1000, 1), line(2, "s1", 100, 4)],
  }, off);
  assert.equal(out.body.commands[0].command, "remove_discount");
});

test("buildCallbackResponse - otro tier o sin promocion registrada responde 204", () => {
  const cart = { products: [line(1, "m1", 1000, 1), line(2, "s1", 100, 4)], promotions: [] };
  assert.equal(buildCallbackResponse({ ...cart, execution_tier: "line_item" }, state).status, 204);
  assert.equal(buildCallbackResponse({ ...cart, execution_tier: "cross_items" }, { ...state, config: { ...state.config, promotionId: null } }).status, 204);
});

test("buildWidgetCombos - devuelve el combo del producto con opciones y colores", () => {
  const productsById = {
    m1: { name: "Mesa Nova Negro", variantId: "v1", price: 1000, available: true, image: "", url: "" },
    m2: { name: "Mesa Nova Greige", variantId: "v2", price: 1000, available: false, image: "", url: "" },
    s1: { name: "Silla Rey Negro", variantId: "v3", price: 100, available: true, image: "", url: "" },
    s2: { name: "Silla Rey Natural", variantId: "v4", price: 100, available: true, image: "", url: "" },
  };
  const combos = buildWidgetCombos("s2", state.config, groupsByKey, productsById, {});
  assert.equal(combos.length, 1);
  assert.equal(combos[0].items[0].label, "Mesa Nova");
  assert.deepEqual(combos[0].items[1].options.map((o) => o.colorName), ["Negro", "Natural"]);
  assert.equal(combos[0].items[1].options[0].colors.length, 1);
});

test("buildWidgetCombos - no muestra el combo si el producto no participa o un item no tiene stock", () => {
  const productsById = {
    m1: { name: "Mesa Nova Negro", variantId: "v1", price: 1000, available: false },
    s1: { name: "Silla Rey Negro", variantId: "v3", price: 100, available: true },
  };
  assert.equal(buildWidgetCombos("999", state.config, groupsByKey, productsById, {}).length, 0);
  assert.equal(buildWidgetCombos("s1", state.config, groupsByKey, productsById, {}).length, 0);
});

test("buildWidgetScript - genera JS valido", () => {
  assert.doesNotThrow(() => new Function(buildWidgetScript("2547699")));
});
