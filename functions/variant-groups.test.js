"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
  diffScanWithPublished,
} = require("./variant-groups");

test("splitSku - separa raiz y color con sufijo de 2 caracteres", () => {
  assert.deepEqual(splitSku("BCV136PT"), { groupKey: "BCV136", colorCode: "PT" });
});

test("splitSku - SKU vacio o no-string da null", () => {
  assert.equal(splitSku(""), null);
  assert.equal(splitSku(null), null);
  assert.equal(splitSku(undefined), null);
});

test("splitSku - raiz muy corta (menos de 3) da null", () => {
  assert.equal(splitSku("X1"), null);
  assert.equal(splitSku("AB1"), null); // raiz "A" (1 char) < minimo 3
});

test("splitSku - raiz de exactamente 3 caracteres es valida", () => {
  assert.deepEqual(splitSku("ABCPT"), { groupKey: "ABC", colorCode: "PT" });
});

test("deriveGroupTitle - prefijo comun de 2+ palabras", () => {
  assert.equal(
    deriveGroupTitle(["Silla Rey Rojo", "Silla Rey Natural", "Silla Rey Negro"]),
    "Silla Rey"
  );
});

test("deriveGroupTitle - sin prefijo comun usa el primer nombre", () => {
  assert.equal(deriveGroupTitle(["Silla Roja", "Mesa Natural"]), "Silla Roja");
});

test("deriveGroupTitle - lista vacia da string vacio", () => {
  assert.equal(deriveGroupTitle([]), "");
});

test("computeSkuGroups - agrupa productos que comparten raiz de SKU", () => {
  const products = [
    { productId: "1", sku: "BCV136PT", name: "Silla Rey Rojo", image: "", url: "" },
    { productId: "2", sku: "BCV136NT", name: "Silla Rey Natural", image: "", url: "" },
    { productId: "3", sku: "MSA200PT", name: "Mesa Arrime Rojo", image: "", url: "" },
  ];
  const { groups, ungrouped } = computeSkuGroups(products);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].groupKey, "BCV136");
  assert.equal(groups[0].products.length, 2);
  assert.equal(groups[0].title, "Silla Rey");
  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].productId, "3");
  assert.equal(ungrouped[0].reason, "single_product");
});

test("computeSkuGroups - SKU invalido va a ungrouped con la razon correcta", () => {
  const products = [
    { productId: "1", sku: "", name: "Sin SKU", image: "", url: "" },
    { productId: "2", sku: "X1", name: "SKU corto", image: "", url: "" },
  ];
  const { groups, ungrouped } = computeSkuGroups(products);
  assert.equal(groups.length, 0);
  assert.equal(ungrouped.length, 2);
  assert.equal(ungrouped[0].reason, "no_sku");
  assert.equal(ungrouped[1].reason, "sku_too_short");
});

test("computeSkuGroups - varios grupos simultaneos no se mezclan", () => {
  const products = [
    { productId: "1", sku: "BCV136PT", name: "Silla Rey Rojo", image: "", url: "" },
    { productId: "2", sku: "BCV136NT", name: "Silla Rey Natural", image: "", url: "" },
    { productId: "3", sku: "MSA200PT", name: "Mesa Arrime Rojo", image: "", url: "" },
    { productId: "4", sku: "MSA200NT", name: "Mesa Arrime Natural", image: "", url: "" },
  ];
  const { groups } = computeSkuGroups(products);
  assert.equal(groups.length, 2);
  const keys = groups.map((g) => g.groupKey).sort();
  assert.deepEqual(keys, ["BCV136", "MSA200"]);
});

function product(id, sku, name) {
  return { productId: id, sku, name, image: "", url: "" };
}

test("diffScanWithPublished - grupo nuevo (groupKey no publicado)", () => {
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, []);
  assert.equal(diff.newGroups.length, 1);
  assert.equal(diff.newGroups[0].groupKey, "BCV136");
  assert.equal(diff.groupsWithAdditions.length, 0);
  assert.equal(diff.removedFromCatalog.length, 0);
});

test("diffScanWithPublished - producto nuevo para un grupo ya publicado", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [product("1", "BCV136PT", "Silla Rey Rojo")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.newGroups.length, 0);
  assert.equal(diff.groupsWithAdditions.length, 1);
  assert.equal(diff.groupsWithAdditions[0].newProducts.length, 1);
  assert.equal(diff.groupsWithAdditions[0].newProducts[0].productId, "2");
});

test("diffScanWithPublished - producto en excludedProductIds nunca se re-sugiere", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: ["2"],
    products: [product("1", "BCV136PT", "Silla Rey Rojo")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.groupsWithAdditions.length, 0);
});

test("diffScanWithPublished - producto publicado que ya no esta en el catalogo", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("2", "BCV136NT", "Silla Rey Natural")],
  }];
  const scan = { groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo")] }], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.removedFromCatalog.length, 1);
  assert.equal(diff.removedFromCatalog[0].products.length, 1);
  assert.equal(diff.removedFromCatalog[0].products[0].productId, "2");
});

test("diffScanWithPublished - grupo publicado que desaparece por completo del escaneo", () => {
  const published = [{
    groupKey: "OLD99", title: "Descontinuado", hidden: false, excludedProductIds: [],
    products: [product("9", "OLD99RJ", "Viejo Rojo")],
  }];
  const scan = { groups: [], ungrouped: [] };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.removedFromCatalog.length, 1);
  assert.equal(diff.removedFromCatalog[0].groupKey, "OLD99");
});

test("diffScanWithPublished - ungrouped pasa igual", () => {
  const scan = { groups: [], ungrouped: [product("5", "X1", "Suelto")] };
  const diff = diffScanWithPublished(scan, []);
  assert.equal(diff.ungrouped.length, 1);
});
