"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ta = require("./top-announcement");

// Config real de Alto Rancho (2026-11-04), formato viejo.
const LEGACY = {
  borderBottom: true, padding: 11, borderTop: false, borderLeft: false, borderRight: false, borderWidth: 1,
  borderStyle: "solid", borderEnabled: true, backgroundColor: "#ffffff", borderColor: "#c7c7c7",
  fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 12, textColor: "#353434", enabled: true,
  messages: [
    { link: "https://altorancho.com/sillas/new-in3/", text: "New in | Sillas " },
    { text: "New in | Inalámbricas", link: "https://altorancho.com/iluminacion41/lamparas-inalambricas/new-in-1gtoi/" },
    { text: "The Rey Collection.", link: "https://altorancho.com/sillas/sillas1/silla-rey/" },
  ],
};

test("migra la config vieja sin perder nada", () => {
  const n = ta.normalize(LEGACY);
  assert.equal(n.enabled, true);
  assert.equal(n.font, "Poppins");
  assert.equal(n.fontWeight, 700);
  assert.equal(n.fontSize, 12);
  assert.equal(n.placement, "below-header");
  assert.equal(n.borderBottom, true);
  assert.equal(n.borderTop, false);
  assert.equal(n.borderColor, "#c7c7c7");
  assert.equal(n.messages.length, 3);
  assert.equal(n.messages[0].text, "New in | Sillas");
  assert.equal(n.mobileMode, "rotate");
  assert.deepEqual(ta.normalize(n), n);
});

test("insertMode viejo y bordes apagados", () => {
  assert.equal(ta.normalize({ insertMode: "before-header" }).placement, "top");
  assert.equal(ta.normalize({ insertMode: "auto" }).placement, "below-header");
  assert.equal(ta.normalize({ borderEnabled: false, borderBottom: true }).borderBottom, false);
  assert.equal(ta.normalize({ fontFamily: "system-ui" }).font, "inherit");
});

test("mensajes: links seguros, vacios afuera, programados", () => {
  const n = ta.normalize({ messages: [
    { text: "  ", link: "/x" },
    { text: "Hola", link: "javascript:alert(1)" },
    { text: "Cyber", startDate: "2026-11-10T00:00", endDate: "2026-11-12T23:59" },
  ] });
  assert.equal(n.messages.length, 2);
  assert.equal(n.messages[0].link, "/javascript:alert(1)");
  assert.equal(n.messages[1].startDate, "2026-11-10T03:00:00.000Z");
  const now = Date.parse("2026-11-20T00:00:00Z");
  assert.equal(ta.liveMessages(n.messages, now).length, 1);
});

test("el script se genera valido y sin branding", () => {
  const js = ta.buildWidgetScript(LEGACY);
  assert.doesNotThrow(() => new Function(js));
  assert.ok(!/promonube|glowlab/i.test(js));
});

test("v2 ignora los campos viejos que quedan en el doc", () => {
  const n = ta.normalize({ version: 2, borderEnabled: false, borderBottom: true, insertMode: "before-header", fontFamily: "'Poppins', sans-serif" });
  assert.equal(n.borderBottom, true);
  assert.equal(n.placement, "below-header");
  assert.equal(n.font, "inherit");
});

test("solo la config del editor nuevo usa el widget nuevo", () => {
  assert.equal(ta.usesNewWidget(LEGACY), false);
  assert.equal(ta.usesNewWidget(null), false);
  assert.equal(ta.usesNewWidget({ ...LEGACY, version: 2 }), true);
});

test("la ruta manda las configs viejas al handler viejo", async () => {
  const routes = {};
  const app = { get: (p, h) => { routes[p] = h; } };
  let legacyCalled = 0;
  let cfg = LEGACY;
  ta.registerTopAnnouncementRoutes(app, {
    checkStoreActive: async () => true,
    getCachedDoc: async () => ({ exists: true, data: () => ({ topAnnouncementBar: cfg }) }),
    legacyHandler: (req, res) => { legacyCalled++; res.send("// legacy"); },
  });
  const res = () => ({ out: "", setHeader() {}, status() { return this; }, send(x) { this.out = x; } });
  const r1 = res();
  await routes["/api/top-announcement-bar-widget.js"]({ query: { store: "1" } }, r1);
  assert.equal(r1.out, "// legacy");
  cfg = { ...LEGACY, version: 2 };
  const r2 = res();
  await routes["/api/top-announcement-bar-widget.js"]({ query: { store: "1" } }, r2);
  assert.equal(legacyCalled, 1);
  assert.notEqual(r2.out, "// legacy");
});
