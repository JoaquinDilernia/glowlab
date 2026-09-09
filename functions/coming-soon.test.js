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
  snapshotVariants,
  buildStockPausePlan,
  buildStockRestorePlan,
  diffProducts,
  expandCategoryToProducts,
  propagateCategoryDate,
  shapeWidgetProducts,
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

test("snapshotVariants normaliza id/stock/stock_management", () => {
  assert.deepEqual(
    snapshotVariants([{ id: 111, stock: 8, stock_management: true }, { id: 222, stock: null, stock_management: false }]),
    [{ variantId: "111", stock: 8, stockManagement: true }, { variantId: "222", stock: 0, stockManagement: false }]
  );
});

test("buildStockPausePlan pone todo en 0 con stock_management on", () => {
  assert.deepEqual(
    buildStockPausePlan([{ id: 111 }, { id: 222 }]),
    [{ variantId: "111", stock: 0, stockManagement: true }, { variantId: "222", stock: 0, stockManagement: true }]
  );
});

test("buildStockRestorePlan restaura solo variantes intactas (stock 0) que siguen existiendo", () => {
  const snapshot = [
    { variantId: "111", stock: 8, stockManagement: true },
    { variantId: "222", stock: 3, stockManagement: true },
    { variantId: "333", stock: 5, stockManagement: false },
  ];
  const current = [
    { id: 111, stock: 0, stock_management: true },   // intacta -> restaurar a 8
    { id: 222, stock: 4, stock_management: true },    // el dueño la editó -> NO tocar
    // 333 fue borrada -> omitir
  ];
  assert.deepEqual(buildStockRestorePlan(snapshot, current), [
    { variantId: "111", stock: 8, stockManagement: true },
  ]);
});

test("buildStockRestorePlan con snapshot vacio devuelve plan vacio", () => {
  assert.deepEqual(buildStockRestorePlan([], [{ id: 1, stock: 0 }]), []);
});

test("diffProducts detecta productos a pausar y a restaurar", () => {
  const prev = [
    { productId: "A", status: "scheduled" },
    { productId: "B", status: "scheduled" },
    { productId: "C", status: "launched" },
  ];
  const next = [
    { productId: "A", status: "scheduled" }, // sin cambios
    { productId: "C", status: "scheduled" }, // relanzado -> pausar
    { productId: "D", status: "scheduled" }, // nuevo -> pausar
    // B se quitó -> restaurar
  ];
  assert.deepEqual(diffProducts(prev, next), { toPause: ["C", "D"], toRestore: ["B"] });
});

test("diffProducts con prev vacio pausa todos los nuevos", () => {
  assert.deepEqual(
    diffProducts([], [{ productId: "X", status: "scheduled" }]),
    { toPause: ["X"], toRestore: [] }
  );
});

test("expandCategoryToProducts arma items product y omite los ya existentes", () => {
  const catProducts = [
    { id: 10, name: { es: "Uno" }, images: [{ src: "u.jpg" }], variants: [{ id: 1 }] },
    { id: 11, name: "Dos", images: [], variants: [] },
  ];
  const out = expandCategoryToProducts(catProducts, {
    launchDate: "2026-12-01T09:00:00",
    message: "verano",
    categoryId: "987",
    existingIds: new Set(["11"]),
  });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], {
    productId: "10",
    productName: "Uno",
    productImage: "u.jpg",
    launchDate: "2026-12-01T09:00:00",
    message: "verano",
    source: "category",
    sourceCategoryId: "987",
    status: "scheduled",
    stockSnapshot: [],
    pausedAt: null,
    launchedAt: null,
    lastError: null,
  });
});

test("propagateCategoryDate solo cambia los de esa categoria no lanzados", () => {
  const products = [
    { productId: "1", source: "category", sourceCategoryId: "987", status: "scheduled", launchDate: "2026-01-01T00:00:00" },
    { productId: "2", source: "category", sourceCategoryId: "987", status: "launched", launchDate: "2026-01-01T00:00:00" },
    { productId: "3", source: "category", sourceCategoryId: "555", status: "scheduled", launchDate: "2026-01-01T00:00:00" },
    { productId: "4", source: "manual", sourceCategoryId: null, status: "scheduled", launchDate: "2026-01-01T00:00:00" },
  ];
  const out = propagateCategoryDate(products, "987", "2026-12-31T12:00:00");
  assert.equal(out[0].launchDate, "2026-12-31T12:00:00");
  assert.equal(out[1].launchDate, "2026-01-01T00:00:00");
  assert.equal(out[2].launchDate, "2026-01-01T00:00:00");
  assert.equal(out[3].launchDate, "2026-01-01T00:00:00");
});

test("shapeWidgetProducts filtra launched / fechas pasadas y no filtra datos sensibles", () => {
  const now = Date.UTC(2026, 5, 1, 0, 0, 0);
  const products = [
    { productId: "1", status: "scheduled", launchDate: "2026-07-01T10:00:00", message: "hola", stockSnapshot: [{ variantId: "x" }] },
    { productId: "2", status: "scheduled", launchDate: "2026-05-01T10:00:00", message: "" }, // pasada
    { productId: "3", status: "launched", launchDate: "2026-07-01T10:00:00", message: "" },
  ];
  assert.deepEqual(shapeWidgetProducts(products, now), [
    { productId: "1", launchDate: "2026-07-01T10:00:00", message: "hola" },
  ]);
});
