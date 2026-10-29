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
    querySelector(sel) { return sel === ".pn-pt" ? this.children.find((c) => c.className === "pn-pt") || null : null; },
  };
  return node;
}

function runLoader({ ids, slots, pdpId }) {
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
  vm.runInNewContext(buildPromoTagLoader("1", { text: "MEGA CYBER" }, ids), {
    window, document, MutationObserver: function() { this.observe = () => {}; }, setTimeout, clearTimeout,
  });
}

test("loader - etiqueta la foto del producto en la lista", () => {
  const image = el("product-item-image-container", 300, null);
  const slot = el("js-nubesdk-slot", 0, image);
  slot.attrs["data-nubesdk-slot-pick"] = "272261523";
  const other = el("product-item-image-container", 300, null);
  const otherSlot = el("js-nubesdk-slot", 0, other);
  otherSlot.attrs["data-nubesdk-slot-pick"] = "1";
  runLoader({ ids: ["272261523"], slots: [slot, otherSlot] });
  assert.equal(image.children.length, 1);
  assert.equal(image.children[0].className, "pn-pt");
  assert.equal(image.children[0].textContent, "MEGA CYBER");
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
