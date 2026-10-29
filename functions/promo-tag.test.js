"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const {
  buildPromoTagLoader,
  getPromoTagLoader,
  sanitizeStyle,
  sanitizeSkus,
  matchSkusToProducts,
  sanitizeRefs,
  expandCategoryIds,
  matchCategoriesToProducts,
  fetchCatalogVariants,
} = require("./promo-tag");

test("sanitizeSkus - mayuscula, sin espacios ni repetidos", () => {
  assert.deepEqual(sanitizeSkus([" bct037ma", "BCT037MA", "", null, "BTE266BO", "bte266bo "]), ["BCT037MA", "BTE266BO"]);
  assert.deepEqual(sanitizeSkus("nope"), []);
});

test("matchSkusToProducts - el producto entra si alguna variante coincide", () => {
  const products = [
    { id: 1, variants: [{ sku: "MEC011PT" }, { sku: "MEC011NB" }] },
    { id: 2, variants: [{ sku: "DPE001PE" }] },
    { id: 3, variants: [{ sku: "mec012pt" }] },
  ];
  const r = matchSkusToProducts(products, ["MEC011NB", "MEC012PT", "ZZZ999"]);
  assert.deepEqual(r.productIds, ["1", "3"]);
  assert.deepEqual(r.unmatched, ["ZZZ999"]);
});

test("sanitizeStyle - valores invalidos vuelven al default", () => {
  const s = sanitizeStyle({ enabled: true, text: "  ", bgColor: "red", textColor: "#FFFFFF", font: "Comic Sans", size: "xl", radius: 99 });
  assert.equal(s.enabled, true);
  assert.equal(s.text, "MEGA CYBER");
  assert.equal(s.bgColor, "#111111");
  assert.equal(s.textColor, "#ffffff");
  assert.equal(s.font, "Poppins");
  assert.equal(s.size, "md");
  assert.equal(s.radius, 30);
  assert.equal(sanitizeStyle({ radius: 0 }).radius, 0);
  assert.equal(sanitizeStyle({ radius: "abc" }).radius, 4);
  assert.equal(sanitizeStyle({}).radius, 4);
});

test("fetchCatalogVariants - pagina hasta la ultima y corta en 404", async () => {
  const pages = { 1: Array.from({ length: 200 }, (_, i) => ({ id: i, variants: [{ sku: "A" + i }] })), 2: [{ id: 999, variants: [{ sku: "B" }] }] };
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    if (!pages[page]) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => pages[page] };
  };
  const out = await fetchCatalogVariants({ storeId: "1", accessToken: "t", fetchImpl });
  assert.equal(out.length, 201);
});

const fakeDb = (data) => ({
  collection: () => ({ doc: () => ({ get: async () => ({ exists: !!data, data: () => data }) }) }),
});

test("getPromoTagLoader - apagado, sin productos o tienda ajena no carga nada", async () => {
  assert.equal(await getPromoTagLoader(fakeDb(null), "2547699"), "");
  assert.equal(await getPromoTagLoader(fakeDb({ enabled: false, productIds: ["1"] }), "2547699"), "");
  assert.equal(await getPromoTagLoader(fakeDb({ enabled: true, productIds: [] }), "2547699"), "");
  assert.equal(await getPromoTagLoader(fakeDb({ enabled: true, productIds: ["1"] }), "999"), "");
  assert.match(await getPromoTagLoader(fakeDb({ enabled: true, productIds: ["1"] }), "2547699"), /pn-pt/);
});

test("buildPromoTagLoader - el texto no puede cerrar el script", () => {
  assert.ok(!buildPromoTagLoader("1", { text: "</script><b>" }, ["1"]).includes("</script>"));
});

// DOM minimo para correr el script: contenedores con ancho y clases.
function el(cls, width, parent) {
  const node = {
    className: cls, offsetWidth: width, parentNode: parent || null, children: [], style: {}, attrs: {},
    getAttribute(n) { return this.attrs[n] || null; },
    appendChild(c) { this.children.push(c); c.parentNode = this; },
    // Solo selectores de una clase (".pn-pt-wrap"), buscando en profundidad.
    querySelector(sel) {
      const cls = sel.slice(1);
      for (const c of this.children) {
        if (String(c.className).split(" ").includes(cls)) return c;
        const deep = c.querySelector(sel);
        if (deep) return deep;
      }
      return null;
    },
  };
  return node;
}

// Corre uno o varios loaders en la misma pagina.
function runLoaders(loaders, { slots, pdpId }) {
  const body = el("", 1000);
  const document = {
    readyState: "complete", body,
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: () => el("", 0),
    querySelectorAll: (sel) => (sel.includes("product_grid_item_image_top_right") ? slots : []),
    querySelector: () => null,
  };
  const window = { LS: pdpId ? { product: { id: pdpId } } : undefined, getComputedStyle: () => ({ position: "relative" }) };
  const ctx = { window, document, MutationObserver: function() { this.observe = () => {}; }, setTimeout, clearTimeout };
  vm.createContext(ctx);
  for (const code of loaders) vm.runInContext(code, ctx);
}

function runLoader({ ids, slots, pdpId }) {
  runLoaders([buildPromoTagLoader("1", { text: "MEGA CYBER" }, ids)], { slots, pdpId });
}

const tagsIn = (image) => image.children[0].children.map((t) => [t.className, t.textContent]);

test("loader - etiqueta la foto del producto en la lista", () => {
  const image = el("product-item-image-container", 300, null);
  const slot = el("js-nubesdk-slot", 0, image);
  slot.attrs["data-nubesdk-slot-pick"] = "272261523";
  const other = el("product-item-image-container", 300, null);
  const otherSlot = el("js-nubesdk-slot", 0, other);
  otherSlot.attrs["data-nubesdk-slot-pick"] = "1";
  runLoader({ ids: ["272261523"], slots: [slot, otherSlot] });
  assert.equal(image.children.length, 1);
  assert.equal(image.children[0].className, "pn-pt-wrap");
  assert.deepEqual(tagsIn(image), [["pn-pt-promo", "MEGA CYBER"]]);
  assert.equal(other.children.length, 0);
});

test("loader - nunca etiqueta un circulo de variante", () => {
  const row = el("pn-vg-row", 200, null);
  const swatch = el("pn-vg-swatch", 36, row);
  const slotInSwatch = el("js-nubesdk-slot", 0, swatch);
  slotInSwatch.attrs["data-nubesdk-slot-pick"] = "5";
  const tiny = el("foto-chica", 40, null);
  const slotTiny = el("js-nubesdk-slot", 0, tiny);
  slotTiny.attrs["data-nubesdk-slot-pick"] = "5";
  runLoader({ ids: ["5"], slots: [slotInSwatch, slotTiny] });
  assert.equal(swatch.children.length, 0);
  assert.equal(tiny.children.length, 0);
});

test("loader - las dos etiquetas se apilan en la misma esquina", () => {
  const both = el("product-item-image-container", 300, null);
  const slotBoth = el("js-nubesdk-slot", 0, both);
  slotBoth.attrs["data-nubesdk-slot-pick"] = "7";
  const onlyCat = el("product-item-image-container", 300, null);
  const slotCat = el("js-nubesdk-slot", 0, onlyCat);
  slotCat.attrs["data-nubesdk-slot-pick"] = "8";
  runLoaders([
    buildPromoTagLoader("1", { text: "MEGA CYBER" }, ["7"], "promo"),
    buildPromoTagLoader("1", { text: "ÚLTIMAS UNIDADES" }, ["7", "8"], "cat"),
  ], { slots: [slotBoth, slotCat] });
  assert.equal(both.children.length, 1);
  assert.deepEqual(tagsIn(both), [["pn-pt-promo", "MEGA CYBER"], ["pn-pt-cat", "ÚLTIMAS UNIDADES"]]);
  assert.deepEqual(tagsIn(onlyCat), [["pn-pt-cat", "ÚLTIMAS UNIDADES"]]);
});

test("expandCategoryIds - incluye subcategorias a cualquier profundidad", () => {
  const cats = [
    { id: 1, parent: null }, { id: 2, parent: 1 }, { id: 3, parent: 2 }, { id: 4, parent: null }, { id: 5, parent: 4 },
  ];
  assert.deepEqual([...expandCategoryIds(cats, ["1"])].sort(), ["1", "2", "3"]);
  assert.deepEqual([...expandCategoryIds(cats, [5])], ["5"]);
});

test("matchCategoriesToProducts - categorias + productos a mano, sin repetir", () => {
  const products = [
    { id: 10, categories: [3] }, { id: 11, categories: [4] }, { id: 12, categories: [] },
  ];
  assert.deepEqual(matchCategoriesToProducts(products, new Set(["3"]), ["12", "10"]).sort(), ["10", "12"]);
});

test("sanitizeRefs - solo IDs numericos, sin repetir y con tope", () => {
  const out = sanitizeRefs([{ id: "1", name: "A" }, { id: 1, name: "dup" }, { id: "x" }, null, { id: 2, image: "javascript:x" }], 10, true);
  assert.deepEqual(out, [{ id: "1", name: "A", image: "" }, { id: "2", name: "", image: "" }]);
  assert.equal(sanitizeRefs([{ id: 1 }, { id: 2 }, { id: 3 }], 2).length, 2);
});

test("getPromoTagLoader - con las dos encendidas carga las dos", async () => {
  const docs = {
    "2547699": { enabled: true, productIds: ["1"], text: "MEGA CYBER" },
    "2547699_cat": { enabled: true, productIds: ["2"], text: "ÚLTIMAS UNIDADES", categories: [], resolvedAt: Date.now() },
  };
  const db = { collection: () => ({ doc: (id) => ({ get: async () => ({ exists: !!docs[id], data: () => docs[id] }) }) }) };
  const out = await getPromoTagLoader(db, "2547699");
  assert.match(out, /pn-pt-promo/);
  assert.match(out, /pn-pt-cat/);
});
