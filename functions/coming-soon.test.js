"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_CONFIG,
  DEFAULT_STYLE,
  AR_OFFSET_MS,
  parseLaunchDate,
  isPastLaunch,
  validateLaunchDate,
  mergeConfig,
  leadsToCsv,
} = require("./coming-soon");

test("parseLaunchDate interpreta el string como hora AR (UTC-3)", () => {
  // 2026-10-01 10:00:00 AR === 2026-10-01 13:00:00 UTC
  assert.equal(parseLaunchDate("2026-10-01T10:00:00"), Date.UTC(2026, 9, 1, 13, 0, 0));
});

test("parseLaunchDate acepta el formato sin segundos", () => {
  assert.equal(parseLaunchDate("2026-10-01T10:00"), Date.UTC(2026, 9, 1, 13, 0, 0));
});

test("parseLaunchDate devuelve null para formato invalido", () => {
  assert.equal(parseLaunchDate(""), null);
  assert.equal(parseLaunchDate("mañana"), null);
  assert.equal(parseLaunchDate(undefined), null);
});

test("isPastLaunch compara contra now en ms UTC", () => {
  const launch = "2026-10-01T10:00:00"; // 13:00 UTC
  assert.equal(isPastLaunch(launch, Date.UTC(2026, 9, 1, 12, 59, 0)), false);
  assert.equal(isPastLaunch(launch, Date.UTC(2026, 9, 1, 13, 0, 0)), true);
  assert.equal(isPastLaunch(launch, Date.UTC(2026, 9, 1, 14, 0, 0)), true);
});

test("isPastLaunch devuelve false si la fecha es invalida", () => {
  assert.equal(isPastLaunch("nope", Date.now()), false);
});

test("validateLaunchDate rechaza vacio / invalido / pasado y acepta futuro", () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.equal(validateLaunchDate("", now).ok, false);
  assert.equal(validateLaunchDate("chau", now).ok, false);
  assert.equal(validateLaunchDate("2025-01-01T10:00:00", now).ok, false);
  assert.equal(validateLaunchDate("2026-06-01T10:00:00", now).ok, true);
});

test("mergeConfig completa defaults y respeta lo provisto", () => {
  const merged = mergeConfig({ enabled: true, style: { badgeText: "YA VIENE" }, products: [{ productId: "1" }] });
  assert.equal(merged.enabled, true);
  assert.equal(merged.style.badgeText, "YA VIENE");
  assert.equal(merged.style.badgeBg, DEFAULT_STYLE.badgeBg); // default preservado
  assert.equal(merged.products.length, 1);
  assert.deepEqual(merged.categories, []);
});

test("mergeConfig con undefined devuelve una copia de DEFAULT_CONFIG", () => {
  const merged = mergeConfig(undefined);
  assert.deepEqual(merged, DEFAULT_CONFIG);
  assert.notEqual(merged.style, DEFAULT_STYLE); // copia, no la misma referencia
});

test("leadsToCsv arma el CSV con header fijo y escapa campos", () => {
  const csv = leadsToCsv([
    { productId: "1", productName: 'Remera "cool"', email: "a@b.com", createdAt: "2026-01-02T03:04:05.000Z" },
    { productId: "2", productName: "Pantalón, negro", email: "c@d.com", createdAt: { _seconds: 1767325445 } },
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "producto_id,producto_nombre,email,fecha");
  assert.equal(lines[1], '1,"Remera ""cool""",a@b.com,2026-01-02T03:04:05.000Z');
  assert.ok(lines[2].startsWith('2,"Pantalón, negro",c@d.com,'));
});

test("leadsToCsv sin filas devuelve solo el header", () => {
  assert.equal(leadsToCsv([]), "producto_id,producto_nombre,email,fecha\n");
});
