"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  splitSku,
  deriveGroupTitle,
  computeSkuGroups,
  diffScanWithPublished,
  buildWidgetIndex,
  fetchAllStoreProducts,
  isValidGroup,
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

test("diffScanWithPublished - producto asignado a mano con SKU no coincidente no se marca como removido si sigue en ungrouped", () => {
  const published = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [product("1", "BCV136PT", "Silla Rey Rojo"), product("99", "", "Gift Card")],
  }];
  const scan = {
    groups: [{ groupKey: "BCV136", title: "Silla Rey", products: [product("1", "BCV136PT", "Silla Rey Rojo")] }],
    ungrouped: [{ ...product("99", "", "Gift Card"), reason: "no_sku" }],
  };
  const diff = diffScanWithPublished(scan, published);
  assert.equal(diff.removedFromCatalog.length, 0);
  assert.equal(diff.groupsWithAdditions.length, 0);
});

test("diffScanWithPublished - ungrouped pasa igual", () => {
  const scan = { groups: [], ungrouped: [product("5", "X1", "Suelto")] };
  const diff = diffScanWithPublished(scan, []);
  assert.equal(diff.ungrouped.length, 1);
});

test("buildWidgetIndex - cada producto del grupo apunta a sus siblings", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: "img1", url: "/rojo" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "img2", url: "/natural" },
    ],
  }];
  const index = buildWidgetIndex(groups);
  assert.equal(Object.keys(index).length, 2);
  assert.equal(index["1"].groupKey, "BCV136");
  assert.equal(index["1"].siblings.length, 2);
  const self1 = index["1"].siblings.find((s) => s.productId === "1");
  assert.equal(self1.active, true);
  const other1 = index["1"].siblings.find((s) => s.productId === "2");
  assert.equal(other1.active, false);
});

test("buildWidgetIndex - excluye grupos hidden", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: true, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: "", url: "" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "", url: "" },
    ],
  }];
  assert.deepEqual(buildWidgetIndex(groups), {});
});

test("buildWidgetIndex - grupo con menos de 2 productos no genera entradas", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [{ productId: "1", sku: "BCV136PT", name: "Rojo", image: "", url: "" }],
  }];
  assert.deepEqual(buildWidgetIndex(groups), {});
});

test("buildWidgetIndex - sin grupos da objeto vacio", () => {
  assert.deepEqual(buildWidgetIndex([]), {});
  assert.deepEqual(buildWidgetIndex(undefined), {});
});

test("buildWidgetIndex - descarta un url con esquema no seguro (ej. javascript:)", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: "img1", url: "javascript:alert(1)" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "img2", url: "/productos/natural" },
    ],
  }];
  const index = buildWidgetIndex(groups);
  const sib1 = index["1"].siblings.find((s) => s.productId === "1");
  assert.equal(sib1.url, "");
  const sib2 = index["1"].siblings.find((s) => s.productId === "2");
  assert.equal(sib2.url, "/productos/natural");
});

test("buildWidgetIndex - acepta url absoluta http(s) y descarta url/image no-string", () => {
  const groups = [{
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [
      { productId: "1", sku: "BCV136PT", name: "Rojo", image: undefined, url: "https://tienda.com/rojo" },
      { productId: "2", sku: "BCV136NT", name: "Natural", image: "img2", url: null },
    ],
  }];
  const index = buildWidgetIndex(groups);
  const sib1 = index["1"].siblings.find((s) => s.productId === "1");
  assert.equal(sib1.url, "https://tienda.com/rojo");
  assert.equal(sib1.image, "");
  const sib2 = index["1"].siblings.find((s) => s.productId === "2");
  assert.equal(sib2.url, "");
});

test("isValidGroup - acepta un grupo bien formado", () => {
  assert.equal(isValidGroup({
    groupKey: "BCV136", title: "Silla Rey", hidden: false, excludedProductIds: [],
    products: [{ productId: "1", sku: "BCV136PT", name: "Rojo" }],
  }), true);
});

test("isValidGroup - rechaza groupKey vacio, products no-array, o producto sin sku", () => {
  assert.equal(isValidGroup({ groupKey: "", title: "x", products: [] }), false);
  assert.equal(isValidGroup({ groupKey: "X", title: "x", products: "no-array" }), false);
  assert.equal(isValidGroup({ groupKey: "X", title: "x", products: [{ productId: "1", name: "Rojo" }] }), false);
});

test("isValidGroup - excludedProductIds opcional pero debe ser array si esta presente", () => {
  assert.equal(isValidGroup({ groupKey: "X", title: "x", products: [], excludedProductIds: "no-array" }), false);
  assert.equal(isValidGroup({ groupKey: "X", title: "x", products: [] }), true);
});

function fakeProduct(id, sku, name) {
  return {
    id,
    name: { es: name },
    images: [{ src: "https://img/" + id }],
    variants: [{ sku }],
    canonical_url: "https://tienda/productos/" + id,
  };
}

test("fetchAllStoreProducts - mapea el shape esperado", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [fakeProduct("1", "BCV136PT", "Silla Rey Rojo")] };
  };
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products.length, 1);
  assert.deepEqual(products[0], {
    productId: "1",
    sku: "BCV136PT",
    name: "Silla Rey Rojo",
    image: "https://img/1",
    url: "https://tienda/productos/1",
  });
});

test("fetchAllStoreProducts - pagina hasta que una pagina viene incompleta", async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) {
      const page = [];
      for (let i = 0; i < 200; i++) page.push(fakeProduct(String(i), "SKU" + i + "PT", "P" + i));
      return { ok: true, json: async () => page };
    }
    if (call === 2) {
      return { ok: true, json: async () => [fakeProduct("200", "SKU200PT", "P200")] };
    }
    throw new Error("no deberia pedir una tercera pagina");
  };
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products.length, 201);
  assert.equal(call, 2);
});

test("fetchAllStoreProducts - producto sin variantes da sku vacio", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [{ id: "9", name: "Sin variante", images: [], variants: [], canonical_url: "" }],
  });
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(products[0].sku, "");
});

test("fetchAllStoreProducts - respuesta no-ok lanza error", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });
  await assert.rejects(() => fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl }));
});

test("fetchAllStoreProducts - no supera MAX_PAGES aunque el API devuelva paginas llenas para siempre", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    const page = [];
    for (let i = 0; i < 200; i++) {
      page.push({ id: String(calls * 1000 + i), name: "P", images: [], variants: [{ sku: "SKU" + i + "PT" }], canonical_url: "" });
    }
    return { ok: true, json: async () => page };
  };
  const products = await fetchAllStoreProducts({ storeId: "111", accessToken: "tok", fetchImpl });
  assert.equal(calls, 50);
  assert.equal(products.length, 50 * 200);
});
