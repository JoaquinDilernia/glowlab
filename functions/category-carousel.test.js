"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mergeConfig,
  normalizeUrl,
  buildWidgetConfig,
  buildWidgetScript,
  matchCarouselForCategory,
  DEFAULT_CONFIG,
} = require("./category-carousel");

test("mergeConfig completa los defaults cuando no hay doc en Firestore", () => {
  assert.deepEqual(mergeConfig(null), DEFAULT_CONFIG);
});

test("mergeConfig completa los campos de style que falten sin pisar los que sí vinieron", () => {
  const merged = mergeConfig({ enabled: true, style: { gap: 24 } });
  assert.equal(merged.enabled, true);
  assert.equal(merged.style.gap, 24);
  assert.equal(merged.style.borderRadius, DEFAULT_CONFIG.style.borderRadius);
  assert.equal(merged.style.desktopVisible, DEFAULT_CONFIG.style.desktopVisible);
});

test("mergeConfig usa [] si carousels no vino o no es array", () => {
  assert.deepEqual(mergeConfig({}).carousels, []);
  assert.deepEqual(mergeConfig({ carousels: "nope" }).carousels, []);
});

test("normalizeUrl agrega la barra inicial si falta", () => {
  assert.equal(normalizeUrl("productos/silla"), "/productos/silla");
});

test("normalizeUrl deja intactas las URLs absolutas, con barra inicial o con #", () => {
  assert.equal(normalizeUrl("https://ejemplo.com/x"), "https://ejemplo.com/x");
  assert.equal(normalizeUrl("/productos/silla"), "/productos/silla");
  assert.equal(normalizeUrl("#"), "#");
});

test("normalizeUrl devuelve # para valores vacíos o inválidos", () => {
  assert.equal(normalizeUrl(""), "#");
  assert.equal(normalizeUrl("   "), "#");
  assert.equal(normalizeUrl(null), "#");
  assert.equal(normalizeUrl(undefined), "#");
});

test("buildWidgetConfig descarta carruseles sin categorías o sin ninguna tile con imagen", () => {
  const cfg = mergeConfig({
    enabled: true,
    carousels: [
      { categoryIds: [], tiles: [{ imageUrl: "a.jpg" }] },
      { categoryIds: ["1"], tiles: [{ imageUrl: "" }] },
      { categoryIds: ["2"], tiles: [{ imageUrl: "b.jpg", title: "Sillas", url: "sillas" }] },
    ],
  });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(widgetConfig.carousels.length, 1);
  assert.deepEqual(widgetConfig.carousels[0].categoryIds, ["2"]);
  assert.equal(widgetConfig.carousels[0].tiles[0].url, "/sillas");
});

test("buildWidgetConfig clampea desktopVisible y mobileVisible a rangos razonables", () => {
  const cfg = mergeConfig({ style: { desktopVisible: 99, mobileVisible: 0 } });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(widgetConfig.style.desktopVisible, 8);
  assert.equal(widgetConfig.style.mobileVisible, 1);
});

test("buildWidgetScript incluye el ancho de tarjeta calculado a partir de desktopVisible/gap/borderRadius", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({
    enabled: true,
    style: { desktopVisible: 3, gap: 20, borderRadius: 8 },
    carousels: [{ categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A" }] }],
  }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(script, /calc\(\(100% - 2 \* 20px\) \/ 3\)/);
  assert.match(script, /border-radius: 8px/);
});

test("buildWidgetScript detecta la categoría vía window.LS.category.id, no la URL", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({ enabled: true, carousels: [] }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(script, /window\.LS && window\.LS\.category && window\.LS\.category\.id/);
});

test("matchCarouselForCategory devuelve el carrusel cuyo categoryIds incluye la categoría actual", () => {
  const carousels = [
    { categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A", url: "#" }] },
    { categoryIds: ["2", "3"], tiles: [{ imageUrl: "b.jpg", title: "B", url: "#" }] },
  ];
  assert.equal(matchCarouselForCategory(carousels, "3"), carousels[1]);
  assert.equal(matchCarouselForCategory(carousels, 3), carousels[1]); // compara como string
});

test("matchCarouselForCategory devuelve null si ningún carrusel targetea esa categoría", () => {
  const carousels = [{ categoryIds: ["1"], tiles: [{ imageUrl: "a.jpg", title: "A", url: "#" }] }];
  assert.equal(matchCarouselForCategory(carousels, "999"), null);
  assert.equal(matchCarouselForCategory([], "1"), null);
});
