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

test("buildWidgetConfig rechaza valores no numéricos (NaN) y usa defaults", () => {
  const cfg = mergeConfig({
    style: {
      desktopVisible: "abc",
      mobileVisible: "xyz",
      borderRadius: "invalid",
      gap: "nope"
    }
  });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(Number.isFinite(widgetConfig.style.desktopVisible), true);
  assert.equal(Number.isFinite(widgetConfig.style.mobileVisible), true);
  assert.equal(Number.isFinite(widgetConfig.style.borderRadius), true);
  assert.equal(Number.isFinite(widgetConfig.style.gap), true);
  assert.equal(widgetConfig.style.desktopVisible, DEFAULT_CONFIG.style.desktopVisible);
  assert.equal(widgetConfig.style.mobileVisible, DEFAULT_CONFIG.style.mobileVisible);
  assert.equal(widgetConfig.style.borderRadius, DEFAULT_CONFIG.style.borderRadius);
  assert.equal(widgetConfig.style.gap, DEFAULT_CONFIG.style.gap);
});

test("buildWidgetConfig acepta 0 como valor válido para borderRadius y gap", () => {
  const cfg = mergeConfig({ style: { borderRadius: 0, gap: 0 } });
  const widgetConfig = buildWidgetConfig(cfg);
  assert.equal(widgetConfig.style.borderRadius, 0);
  assert.equal(widgetConfig.style.gap, 0);
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

test("buildWidgetScript usa la misma lista PRODUCT_CARD_SELECTORS verificada en coming-soon.js", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({ enabled: true, carousels: [] }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(
    script,
    /PRODUCT_CARD_SELECTORS = \['\[data-item-id\]', '\[data-product-id\]', '\.js-item-product', '\.product-item', '\.item-product'\]/
  );
});

test("buildWidgetScript inserta la grilla como hermano (findGridContainer sube hasta el contenedor con varias tarjetas) y agrega el MutationObserver de re-render", () => {
  const widgetConfig = buildWidgetConfig(mergeConfig({ enabled: true, carousels: [] }));
  const script = buildWidgetScript("123", widgetConfig);
  assert.match(script, /ancestor\.querySelectorAll\(PRODUCT_CARD_SELECTOR\)\.length >= 2/);
  assert.match(script, /grid\.parentElement\.insertBefore\(buildCarousel\(carousel\), grid\)/);
  assert.match(script, /new MutationObserver\(scheduleInit\)/);
  assert.match(script, /document\.querySelector\('\.pn-cc'\)/);
});
