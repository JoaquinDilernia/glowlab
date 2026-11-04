"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sm = require("./style-menu");

// Config real de Alto Rancho (2026-11-04), formato viejo.
const LEGACY = {
  enabled: true,
  items: [{
    position: "1", emoji: "🔥", emojiPosition: "before", color: "#8aa1c4", fontWeight: "700", fontSize: "",
    imageUrl: "", imageLink: "https://altorancho.com/the-sale-edit/", megaMenu: false, imageMobileUrl: "",
  }],
};

test("la config vieja no usa el menu nuevo", () => {
  assert.equal(sm.usesNewMenu(LEGACY), false);
  assert.equal(sm.buildMenuScript(LEGACY), "");
  assert.equal(sm.usesNewMenu(null), false);
});

test("migra la config vieja sin perder nada", () => {
  const n = sm.normalize(LEGACY);
  assert.equal(n.version, 2);
  assert.equal(n.enabled, true);
  const it = n.items[0];
  assert.deepEqual(it.target, { mode: "position", text: "", parent: "", position: "1" });
  assert.equal(it.emoji, "🔥");
  assert.equal(it.color, "#8aa1c4");
  assert.equal(it.fontWeight, 700);
  assert.equal(it.fontSize, null);
  assert.equal(it.imageLink, "https://altorancho.com/the-sale-edit/");
  assert.deepEqual(sm.normalize(n), n);
});

test("valores viejos de letra y grosor", () => {
  assert.equal(sm.normalizeItem({ fontWeight: "bold" }).fontWeight, 700);
  assert.equal(sm.normalizeItem({ fontWeight: "normal" }).fontWeight, null);
  assert.equal(sm.normalizeItem({ fontSize: "16px" }).fontSize, 16);
  assert.equal(sm.normalizeItem({ fontSize: "1.2rem" }).fontSize, 19);
  assert.equal(sm.normalizeItem({ fontSize: "nada" }).fontSize, null);
  assert.equal(sm.normalizeItem({ color: "rgba(1,2,3,1)" }).color, null);
  assert.equal(sm.normalizeItem({ position: "1.2.3" }).target.position, "");
});

test("el payload deja afuera items sin destino o sin efecto", () => {
  const p = sm.menuPayload({
    version: 2, enabled: true,
    items: [
      { target: { mode: "text", text: "SALE" }, badge: "Hot" },
      { target: { mode: "text", text: "" }, badge: "x" },
      { target: { mode: "text", text: "Sillas" } },
    ],
  });
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].badge, "Hot");
});

test("el script nuevo sale solo con version 2 y prendido", () => {
  const cfg = { version: 2, enabled: true, items: [{ target: { mode: "text", text: "SALE" }, color: "#ff0000" }] };
  const js = sm.buildMenuScript(cfg);
  assert.match(js, /pnMenuV2/);
  assert.match(js, /"SALE"/);
  assert.doesNotThrow(() => new Function(js));
  assert.equal(sm.buildMenuScript({ ...cfg, enabled: false }), "");
});

test("lee el menu de Ipanema del HTML", () => {
  const html = `<header><ul class="js-nav-desktop-list nav-desktop-list list-unstyled">
    <li class="nav-item nav-main-item nav-dropdown"><a href="/alto-cyber/" class="nav-list-link "> Alto Cyber. <svg></svg></a>
      <div class="js-desktop-dropdown"><div class="desktop-dropdown-container"><ul class="desktop-list-subitems list-unstyled">
        <li class="nav-item"><a class="nav-list-link nav-list-link-heading">Muebles hasta 30%OFF</a>
          <ul class="list-subitems"><li class="nav-item"><a class="nav-list-link">Escritorios</a></li></ul></li>
        <li class="nav-item"><a class="nav-list-link nav-list-link-heading">Iluminaci&oacute;n &amp; deco</a></li>
      </ul></div></div></li>
    <li class="nav-item nav-main-item"><a href="/gift/" class="nav-list-link">Gift Card</a></li>
  </ul></header>`;
  const tree = sm.parseMenuTree(html);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].label, "Alto Cyber.");
  assert.equal(tree[0].children.length, 2);
  assert.deepEqual(tree[0].children, ["Muebles hasta 30%OFF", "Iluminación & deco"]);
  assert.deepEqual(tree[1], { label: "Gift Card", children: [] });
});

test("URL de la home de la tienda", () => {
  assert.equal(sm.storeHomeUrl({ url: "altorancho.com" }), "https://altorancho.com/");
  assert.equal(sm.storeHomeUrl({ storeUrl: "https://altorancho.com/algo" }), "https://altorancho.com/");
  assert.equal(sm.storeHomeUrl({}), null);
});

test("URL de la home desde la respuesta de Tiendanube", () => {
  assert.equal(sm.storeHomeUrl({ url_with_protocol: "https://altorancho.com" }), "https://altorancho.com/");
  assert.equal(sm.storeHomeUrl({ domains: ["altorancho.com"], original_domain: "altorancho.mitiendanube.com" }), "https://altorancho.com/");
  assert.equal(sm.storeHomeUrl({ original_domain: "altorancho.mitiendanube.com" }), "https://altorancho.mitiendanube.com/");
});
