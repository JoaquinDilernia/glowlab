"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { buildTechSheetLoader, getTechSheetLoader, sanitizeTitle } = require("./tech-sheet");

// DOM minimo: galeria con slides (posiciones desordenadas y duplicadas como
// las arma el slider) y el bloque de descripcion.
function run(skus) {
  const inserted = [];
  const slide = (pos, href) => ({
    getAttribute: (n) => (n === "data-image-position" ? String(pos) : null),
    querySelector: (sel) => (sel === "a[href]" ? { getAttribute: () => href } : null),
  });
  const block = { parentNode: { insertBefore: (el) => inserted.push(el) } };
  const mkEl = (tag) => ({ tag, children: [], appendChild(c) { this.children.push(c); } });
  const document = {
    readyState: "complete",
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: mkEl,
    querySelectorAll: () => [slide(0, "//cdn/a.webp"), slide(13, "//cdn/ficha.webp"), slide(2, "//cdn/b.webp"), slide(13, "//cdn/ficha.webp")],
    querySelector: (sel) => (sel === ".pn-ts" ? null : block),
  };
  const LS = { template: "product", product: { name: "Escritorio" }, variants: skus.map((sku) => ({ sku })) };
  const window = { LS };
  vm.runInNewContext(buildTechSheetLoader("1"), { window, LS, document });
  return inserted;
}

test("ficha tecnica - SKU con M o I muestra la ultima foto", () => {
  const [details] = run(["MEC011PT"]);
  assert.equal(details.className, "pn-ts");
  assert.equal(details.children[0].textContent, "Dimensiones");
  assert.equal(details.children[1].src, "https://cdn/ficha.webp");
  assert.equal(run(["ime034pl"]).length, 1);
});

test("ficha tecnica - otros SKU no muestran nada", () => {
  assert.equal(run(["DPE001PE"]).length, 0);
  assert.equal(run([]).length, 0);
});

const fakeDb = (data) => ({
  collection: () => ({ doc: () => ({ get: async () => ({ exists: !!data, data: () => data }) }) }),
});

test("getTechSheetLoader - apagado, sin prefijos o tienda ajena no carga nada", async () => {
  assert.equal(await getTechSheetLoader(fakeDb(null), "2547699"), "");
  assert.equal(await getTechSheetLoader(fakeDb({ enabled: false, skuPrefixes: ["M"] }), "2547699"), "");
  assert.equal(await getTechSheetLoader(fakeDb({ enabled: true, skuPrefixes: [] }), "2547699"), "");
  assert.equal(await getTechSheetLoader(fakeDb({ enabled: true, skuPrefixes: ["M"] }), "999"), "");
});

test("getTechSheetLoader - prendido usa los prefijos y el titulo guardados", async () => {
  const js = await getTechSheetLoader(fakeDb({ enabled: true, skuPrefixes: ["m", "i"], title: "Medidas" }), "2547699");
  assert.match(js, /var PREFIXES = \["M","I"\]/);
  assert.match(js, /var TITLE = "Medidas"/);
});

test("sanitizeTitle - vacio vuelve a Dimensiones y no deja cerrar el script", () => {
  assert.equal(sanitizeTitle("  "), "Dimensiones");
  assert.ok(!buildTechSheetLoader("1", { title: "</script>x" }).includes("</script>"));
});
