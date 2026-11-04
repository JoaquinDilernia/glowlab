"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const wa = require("./style-whatsapp");

// Config real de Alto Rancho (2026-11-04), formato viejo.
const LEGACY = { enabled: true, backgroundColor: "#000000", hoverColor: "#000000" };

test("la config vieja no usa el WhatsApp nuevo", () => {
  assert.equal(wa.usesNewWhatsApp(LEGACY), false);
  assert.equal(wa.buildWhatsAppScript(LEGACY), "");
  assert.equal(wa.usesNewWhatsApp(null), false);
});

test("migra la config vieja con sus colores", () => {
  const n = wa.normalize(LEGACY);
  assert.equal(n.version, 2);
  assert.equal(n.enabled, true);
  assert.equal(n.backgroundColor, "#000000");
  assert.equal(n.hoverColor, "#000000");
  assert.equal(n.phone, "");
  assert.deepEqual(wa.normalize(n), n);
});

test("telefono: solo digitos y largo minimo", () => {
  assert.equal(wa.normalize({ phone: "+54 9 11 3144-0631" }).phone, "5491131440631");
  assert.equal(wa.normalize({ phone: "1234" }).phone, "");
});

test("valores fuera de rango vuelven a los limites o al default", () => {
  const n = wa.normalize({ offsetX: 999, size: "xl", side: "arriba", backgroundColor: "verde", hours: { from: "25:00", days: [1, 9, 1] } });
  assert.equal(n.offsetX, 200);
  assert.equal(n.size, "md");
  assert.equal(n.side, "right");
  assert.equal(n.backgroundColor, "#25d366");
  assert.equal(n.hours.from, "09:00");
  assert.deepEqual(n.hours.days, [1]);
});

// 2026-11-04 es miercoles (3). 15:00 en Argentina = 18:00 UTC.
const at = (iso) => Date.parse(iso);
test("horario de atencion en hora argentina", () => {
  const h = { enabled: true, days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" };
  assert.equal(wa.inHours(h, at("2026-11-04T18:00:00Z")), true);   // mie 15:00
  assert.equal(wa.inHours(h, at("2026-11-04T22:00:00Z")), false);  // mie 19:00
  assert.equal(wa.inHours(h, at("2026-11-08T15:00:00Z")), false);  // dom 12:00
  assert.equal(wa.inHours({ ...h, enabled: false }, at("2026-11-08T15:00:00Z")), true);
});

test("horario que cruza la medianoche", () => {
  const h = { enabled: true, days: [5], from: "20:00", to: "02:00" }; // viernes 20 a sabado 2
  assert.equal(wa.inHours(h, at("2026-11-07T00:30:00Z")), true);  // vie 21:30
  assert.equal(wa.inHours(h, at("2026-11-07T04:00:00Z")), true);  // sab 01:00
  assert.equal(wa.inHours(h, at("2026-11-07T06:00:00Z")), false); // sab 03:00
});

test("el script nuevo sale solo con version 2 y prendido", () => {
  const cfg = { version: 2, enabled: true, phone: "5491131440631", label: "¿Te ayudamos?" };
  const js = wa.buildWhatsAppScript(cfg);
  assert.match(js, /pnWhatsAppV2/);
  assert.match(js, /5491131440631/);
  assert.doesNotThrow(() => new Function(js));
  assert.equal(wa.buildWhatsAppScript({ ...cfg, enabled: false }), "");
});
