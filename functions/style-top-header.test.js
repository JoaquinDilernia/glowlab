"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const th = require("./style-top-header");

// Config real de Alto Rancho (vieja, apagada)
const LEGACY = {
  enabled: false, fontFamily: "'Poppins', sans-serif", alignment: "left", backgroundColor: "#fafafa", textColor: "#353434",
  items: [
    { icon: "", text: "altorancho.", link: "https://altorancho.com/", position: "left", active: true },
    { icon: "", text: "altomayorista.", link: "https://loginmayorista.altorancho.com/", position: "left", active: false },
    { icon: "", text: "prensa", link: "https://prensa.altorancho.com/", position: "right", active: false },
  ],
};

test("migra la config vieja sin perder nada", () => {
  const n = th.normalize(LEGACY);
  assert.equal(n.version, 2);
  assert.equal(n.enabled, false);
  assert.equal(n.font, "Poppins");
  assert.equal(n.alignment, "left");
  assert.equal(n.backgroundColor, "#fafafa");
  assert.deepEqual(n.items.map((i) => [i.text, i.current, i.side]), [["altorancho.", true, "left"], ["altomayorista.", false, "left"], ["prensa", false, "right"]]);
  assert.equal(th.usesNewTopHeader(LEGACY), false);
});

test("limpia links y valores", () => {
  const n = th.normalize({ version: 2, fontSize: 99, alignment: "x", items: [{ text: "a", link: "javascript:alert(1)" }, { text: "b", link: "deco.altorancho.com" }] });
  assert.equal(n.fontSize, 16);
  assert.equal(n.alignment, "left");
  assert.equal(n.items[0].link, "");
  assert.equal(n.items[1].link, "https://deco.altorancho.com");
});

test("el payload saca ocultos y vacios; el script compila", () => {
  const p = th.payload({ version: 2, enabled: true, items: [{ text: "a" }, { text: "" }, { text: "c", hidden: true }] });
  assert.deepEqual(p.items.map((i) => i.text), ["a"]);
  assert.doesNotThrow(() => new vm.Script(th.buildTopHeaderScript({ version: 2, enabled: true, items: [{ text: "altorancho.", link: "https://altorancho.com/" }] })));
});

function fakeApp() {
  const routes = {};
  return { routes, get: (p, h) => { routes[p] = h; } };
}
function fakeRes() {
  return { body: "", headers: {}, setHeader(k, v) { this.headers[k] = v; }, send(b) { this.body = b; return this; }, status() { return this; } };
}

test("configs viejas van al handler viejo; las nuevas al motor nuevo", async () => {
  for (const [cfg, expectLegacy] of [[LEGACY, true], [{ ...th.normalize(LEGACY), enabled: true }, false]]) {
    const app = fakeApp();
    let legacy = false;
    th.registerTopHeaderRoute(app, {
      checkStoreActive: async () => true,
      getCachedDoc: async () => ({ exists: true, data: () => ({ topHeader: cfg }) }),
      legacyHandler: (req, res) => { legacy = true; res.send("// viejo"); },
    });
    const res = fakeRes();
    await app.routes["/api/top-header-widget.js"]({ query: { store: "2547699" } }, res);
    assert.equal(legacy, expectLegacy);
    if (!expectLegacy) assert.ok(res.body.includes("pn-top-header"));
  }
});
