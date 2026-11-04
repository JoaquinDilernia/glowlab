"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cd = require("./countdown");

test("parseDate: fechas viejas sin zona se leen como hora argentina", () => {
  assert.equal(cd.parseDate("2026-05-17T23:59"), Date.parse("2026-05-18T02:59:00Z"));
  assert.equal(cd.parseDate("2026-05-17T23:59:00.000Z"), Date.parse("2026-05-17T23:59:00Z"));
  assert.ok(Number.isNaN(cd.parseDate("")));
  assert.ok(Number.isNaN(cd.parseDate(null)));
});

test("normalize: defaults, colores y links seguros", () => {
  const n = cd.normalize({ backgroundColor: "red", buttonUrl: "javascript:alert(1)", size: "xl" });
  assert.equal(n.backgroundColor, cd.DEFAULTS.backgroundColor);
  assert.equal(n.buttonUrl, "/javascript:alert(1)");
  assert.equal(n.size, "md");
  assert.equal(cd.safeUrl("//evil.com"), "/evil.com");
  assert.equal(cd.safeUrl("https://altorancho.com/hotdays"), "https://altorancho.com/hotdays");
  assert.equal(cd.safeUrl("hotdays"), "/hotdays");
});

test("normalize: docs viejos (position, icon) se migran sin duplicar el icono", () => {
  const n = cd.normalize({ position: "bottom", icon: "⚡", message: "⚡ Últimas horas", timerColor: "#ff0000" });
  assert.equal(n.placement, "bottom");
  assert.equal(n.message, "⚡ Últimas horas");
  assert.equal(n.boxColor, "#ff0000");
  const m = cd.normalize({ position: "top", icon: "🚀", message: "Lanzamiento en:" });
  assert.equal(m.placement, "top");
  assert.equal(m.message, "🚀 Lanzamiento en:");
  // ya normalizado: no vuelve a tocarlo
  assert.deepEqual(cd.normalize(n), n);
});

test("validate", () => {
  assert.equal(cd.validate(cd.normalize({})), "Falta la fecha de fin");
  assert.match(cd.validate(cd.normalize({ startDate: "2026-01-02T00:00Z", endDate: "2026-01-01T00:00Z" })), /antes/);
  assert.equal(cd.validate(cd.normalize({ endDate: "2026-01-01T00:00Z" })), null);
});

test("statusOf y orden para el widget", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const live = { id: "a", enabled: true, endDate: "2026-11-05T00:00:00Z" };
  const soon = { id: "b", enabled: true, endDate: "2026-11-04T18:00:00Z" };
  const sched = { id: "c", enabled: true, startDate: "2026-11-06T00:00:00Z", endDate: "2026-11-07T00:00:00Z" };
  const ended = { id: "d", enabled: true, endDate: "2026-11-01T00:00:00Z" };
  const paused = { id: "e", enabled: false, endDate: "2026-12-01T00:00:00Z" };
  assert.equal(cd.statusOf(live, now), "live");
  assert.equal(cd.statusOf(sched, now), "scheduled");
  assert.equal(cd.statusOf(ended, now), "ended");
  assert.equal(cd.statusOf(paused, now), "paused");
  assert.deepEqual(cd.upcomingForWidget([live, sched, ended, paused, soon], now).map(x => x.id), ["b", "a", "c"]);
  assert.equal(cd.currentlyShown([live, sched, soon], now).id, "b");
  assert.equal(cd.currentlyShown([sched], now), null);
});

test("buildWidgetScript genera JS valido", () => {
  const p = cd.widgetPayload("x", { ...cd.normalize({ endDate: "2026-12-01T00:00:00Z", message: "Hola" }), updatedAt: "u" });
  assert.equal(p.end, Date.parse("2026-12-01T00:00:00Z"));
  assert.equal(p.start, null);
  const js = cd.buildWidgetScript([p], "https://api.example");
  assert.doesNotThrow(() => new Function(js));
  assert.ok(!/promonube|glowlab/i.test(js.replace(/__pnCountdownInit|pn-|pn_/g, "")), "sin branding en la tienda");
});
