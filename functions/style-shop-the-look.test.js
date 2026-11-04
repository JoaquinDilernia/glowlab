"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const stl = require("./style-shop-the-look");

// Forma de la config vieja (la que guardaba el editor anterior)
const LEGACY = {
  enabled: true, title: "Shop the Look", hotspotColor: "#ffffff", hotspotTextColor: "#111111", hotspotLabelMode: "number",
  hotspotAnimation: "pulse", hoverCardButtonBg: "#111111", hoverCardButtonLabel: "Comprar", injectSelector: ".footer", injectPosition: "before",
  looks: [{ id: "look_1", imageUrl: "https://x.com/a.jpg", hotspots: [
    { x: 40.123, y: 55, productId: "123", productName: "Silla", productImage: "https://x.com/s.jpg", productPrice: "$1.000", productUrl: "/productos/silla" },
    { x: "x", y: 10 },
  ] }, { id: "sin-foto", imageUrl: "", hotspots: [] }],
};

test("migra la config vieja sin perder datos", () => {
  const n = stl.normalize(LEGACY);
  assert.equal(stl.usesNewShopTheLook(LEGACY), false);
  assert.equal(n.layout, "hotspots");
  assert.equal(n.dotStyle, "number");
  assert.equal(n.buttonLabel, "Comprar");
  assert.equal(n.accentColor, "#111111");
  assert.equal(n.injectSelector, ".footer");
  assert.equal(n.hideSoldOut, false);
  assert.equal(n.looks.length, 1);
  assert.deepEqual(n.looks[0].hotspots.map((h) => [h.x, h.productId]), [[40.1, "123"]]);
});

const API_PRODUCT = {
  id: 123, name: { es: "Silla Budapest" }, handle: { es: "silla-budapest" }, published: true,
  canonical_url: "https://altorancho.com/productos/silla-budapest/",
  images: [{ src: "https://cdn/x.jpg" }],
  variants: [{ price: "269990.00", promotional_price: "199990.00", stock_management: true, stock: 2 }],
};

test("arma precio, tachado y stock desde la API", () => {
  const p = stl.productInfo(API_PRODUCT);
  assert.equal(p.name, "Silla Budapest");
  assert.equal(p.price, "$199.990");
  assert.equal(p.compareAt, "$269.990");
  assert.equal(p.available, true);
  const agotado = stl.productInfo({ ...API_PRODUCT, variants: [{ price: "10", stock_management: true, stock: 0 }] });
  assert.equal(agotado.available, false);
});

test("datos vivos; los agotados se ocultan; si la API falla usa lo guardado", async () => {
  const cfg = { ...stl.normalize(LEGACY), version: 2, enabled: true, hideSoldOut: true, looks: [{ imageUrl: "https://x.com/a.jpg", hotspots: [
    { x: 10, y: 10, productId: "123", productName: "viejo", productUrl: "/productos/viejo" },
    { x: 20, y: 20, productId: "456", productName: "agotado", productUrl: "/p" },
    { x: 30, y: 30, productId: "789", productName: "Guardado", productPrice: "$5", productUrl: "/productos/g" },
  ] }] };
  const fetchProduct = async (id) => {
    if (id === "123") return API_PRODUCT;
    if (id === "456") return { ...API_PRODUCT, id: 456, variants: [{ price: "1", stock_management: true, stock: 0 }] };
    throw new Error("timeout");
  };
  const p = await stl.livePayload(cfg, fetchProduct);
  assert.deepEqual(p.looks[0].items.map((i) => i.name), ["Silla Budapest", "Guardado"]);
  assert.equal(p.looks[0].items[0].price, "$199.990");
});

test("el script solo sale con version 2 y compila", async () => {
  const fetchProduct = async () => API_PRODUCT;
  assert.equal(await stl.buildShopTheLookScript(LEGACY, { fetchProduct }), "");
  const cfg = { version: 2, enabled: true, placement: { sectionId: "banners_1", position: "after" }, looks: [{ imageUrl: "https://x.com/a.jpg", hotspots: [{ x: 10, y: 10, productId: "123" }] }] };
  const js = await stl.buildShopTheLookScript(cfg, { fetchProduct });
  assert.ok(js.includes("banners_1"));
  assert.doesNotThrow(() => new vm.Script(js));
});

test("lee las secciones de primer nivel de Ipanema", () => {
  const html = `
  <section id="ns-section-header" class="ns-section" data-section-id="header" data-section-type="header"></section>
  <section class="ns-section" data-section-id="banners_1" data-section-type="banners">
    <div data-block-id="banner_a" data-block-type="banner"><h2>Muebles</h2><source data-srcset="https://cdn/x/webp/640.webp 640w"></div>
  </section>
  <section class="ns-section" data-section-id="product-list_2" data-section-type="product-list"></section>
  <section class="ns-section" data-section-id="cart_drawer" data-section-type="cart-drawer"></section>`;
  const out = stl.parseHomeSections(html);
  assert.deepEqual(out.map((s) => [s.sectionId, s.type, s.title]), [["banners_1", "banners", "Muebles"], ["product-list_2", "product-list", ""]]);
  assert.equal(out[0].thumb, "https://cdn/x/webp/640.webp");
});
