"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const sb = require("./style-banners");

test("configs viejas (carrusel) no usan el motor nuevo", () => {
  const legacy = { enabled: true, slides: [{ buttons: [{ text: "Ver" }] }] };
  assert.equal(sb.usesNewBanners(legacy), false);
  assert.equal(sb.buildBannersScript(legacy), "");
});

test("normaliza y limpia valores", () => {
  const n = sb.normalize({ enabled: true, items: [{ blockId: "banner_jyhz\"><x", position: "nope", overlay: 300, textColor: "red", buttons: [{ text: "Ver", url: "javascript:alert(1)", style: "x" }, {}, {}, {}] }] });
  const it = n.items[0];
  assert.equal(n.version, 2);
  assert.equal(it.blockId, "banner_jyhzx");
  assert.equal(it.position, "center");
  assert.equal(it.overlay, 70);
  assert.equal(it.textColor, "#ffffff");
  assert.equal(it.buttons.length, 3);
  assert.equal(it.buttons[0].url, "/javascript:alert(1)");
  assert.equal(it.buttons[0].style, "solid");
});

test("el payload saca items vacios, apagados o sin bloque", () => {
  const p = sb.payload({ version: 2, enabled: true, items: [
    { blockId: "banner_a", title: "Hola" },
    { blockId: "banner_b" },
    { blockId: "banner_c", title: "Off", enabled: false },
    { title: "Sin bloque" },
    { blockId: "banner_d", buttons: [{ text: "" }, { text: "Comprar", url: "/sillas" }] },
  ] });
  assert.deepEqual(p.items.map((i) => i.blockId), ["banner_a", "banner_d"]);
  assert.equal(p.items[1].buttons.length, 1);
  assert.equal(p.items[0].thumb, undefined);
});

test("el script se arma solo con version 2 y algo para mostrar", () => {
  assert.equal(sb.buildBannersScript({ version: 2, enabled: false, items: [{ blockId: "banner_a", title: "x" }] }), "");
  assert.equal(sb.buildBannersScript({ version: 2, enabled: true, items: [] }), "");
  const js = sb.buildBannersScript({ version: 2, enabled: true, items: [{ blockId: "banner_a", title: "Cyber" }] });
  assert.ok(js.includes("banner_a"));
  assert.doesNotThrow(() => new vm.Script(js));
});

test("lee los banners de la home de Ipanema", () => {
  const html = `
  <div class="banner-block position-relative" id="ns-block-banner_jyhz" data-block-id="banner_jyhz" data-block-type="banner">
    <a href="https://altorancho.com/sillas/"><picture><source data-srcset="https://acdn-us.mitiendanube.com/stores/002/547/699/media/62ad-fotos/webp/320.webp 320w, https://acdn-us.mitiendanube.com/stores/002/547/699/media/62ad-fotos/webp/640.webp 640w"></picture></a>
  </div>
  <div class="banner-block" id="ns-block-banner_k3kc" data-block-id="banner_k3kc" data-block-type="banner">
    <img data-src="https://acdn-us.mitiendanube.com/stores/002/547/699/media/hero.gif">
  </div>
  <div data-block-id="slider_1" data-block-type="slider"></div>`;
  const out = sb.parseHomeBanners(html);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { blockId: "banner_jyhz", thumb: "https://acdn-us.mitiendanube.com/stores/002/547/699/media/62ad-fotos/webp/640.webp", link: "https://altorancho.com/sillas/" });
  assert.equal(out[1].thumb, "https://acdn-us.mitiendanube.com/stores/002/547/699/media/hero.gif");
});
