"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  COLOR_DICTIONARY: D,
  findColors,
  colorKey,
  extractColorLabels,
  sanitizePalette,
  resolveColors,
  resolveTextures,
  collectDetectedColors,
} = require("./variant-colors");

test("extractColorLabels - saca prefijo y sufijo comunes (color en el medio)", () => {
  assert.deepEqual(
    extractColorLabels([
      "Mesa Comedor Brooklyn Negro 1,20 mts",
      "Mesa Comedor Brooklyn Petribi 1,20 mts",
      "Mesa Comedor Brooklyn Tapa Negra Patas Petribi 1,20 mts",
    ]),
    ["Negro", "Petribi", "Tapa Negra Patas Petribi"]
  );
});

test("extractColorLabels - color de varias palabras al final", () => {
  assert.deepEqual(
    extractColorLabels(["Mesa Ratona Baja Redonda Nova Celeste Frio", "Mesa Ratona Baja Redonda Nova Greige"]),
    ["Celeste Frio", "Greige"]
  );
});

test("extractColorLabels - una palabra de color comun no queda en el prefijo", () => {
  assert.deepEqual(
    extractColorLabels(["Vaso Carson Verde Botella", "Vaso Carson Verde Oscuro"]),
    ["Verde Botella", "Verde Oscuro"]
  );
});

test("extractColorLabels - menos de 2 nombres no tiene con que comparar", () => {
  assert.deepEqual(extractColorLabels(["Silla Rey Rojo"]), [""]);
  assert.deepEqual(extractColorLabels(undefined), []);
});

test("findColors - frase mas larga primero", () => {
  assert.deepEqual(findColors("Verde Seco"), [D["verde seco"]]);
  assert.deepEqual(findColors("Mocha Mousse"), [D["mocha mousse"]]);
});

test("findColors - genero, plural y acentos", () => {
  assert.deepEqual(findColors("Blancas"), [D.blanco]);
  assert.deepEqual(findColors("Plateados"), [D.plateado]);
  assert.deepEqual(findColors("Marrón"), [D.marron]);
});

test("findColors - bicolor (max 2) e ignora palabras que no son color", () => {
  assert.deepEqual(findColors("Tapa Negra Patas Petribi"), [D.negro, D.petribi]);
  assert.deepEqual(findColors("Malbec y Azul"), [D.malbec, D.azul]);
  assert.deepEqual(findColors("Rayado Malbec"), [D.malbec]);
});

test("findColors - sin color conocido da []", () => {
  assert.deepEqual(findColors("100"), []);
  assert.deepEqual(findColors(""), []);
});

test("resolveColors - la paleta del admin pisa al diccionario", () => {
  const palette = { [colorKey("Greige")]: { hex: "#aabbcc" } };
  assert.deepEqual(resolveColors("Greige", palette), ["#aabbcc"]);
  assert.deepEqual(resolveColors("Negro", palette), [D.negro]);
  assert.deepEqual(resolveColors("Zebra", { zebra: { hex: "#000000", hex2: "#ffffff" } }), ["#000000", "#ffffff"]);
});

test("sanitizePalette - descarta hex invalidos y entradas basura", () => {
  assert.deepEqual(
    sanitizePalette({
      greige: { hex: "#AABBCC", hex2: "rojo" },
      mal: { hex: "url(x)" },
      nulo: null,
    }),
    { greige: { hex: "#aabbcc" } }
  );
  assert.deepEqual(sanitizePalette("x"), {});
});

test("collectDetectedColors - agrupa por color entre grupos y cuenta productos", () => {
  const groups = [
    { products: [{ name: "Silla Rey Negro" }, { name: "Silla Rey Natural" }] },
    { products: [{ name: "Mesa Nova Negro" }, { name: "Mesa Nova Zebra" }] },
  ];
  const detected = collectDetectedColors(groups);
  const negro = detected.find((d) => d.key === "negro");
  assert.equal(negro.count, 2);
  assert.deepEqual(negro.autoColors, [D.negro]);
  const zebra = detected.find((d) => d.key === "zebra");
  assert.deepEqual(zebra.autoColors, []);
});

test("resolveTextures - materiales con textura, colores lisos en null", () => {
  assert.deepEqual(resolveTextures("Petiribi", {}), ["wood"]);
  assert.deepEqual(resolveTextures("Negro Ébano", {}), ["wood"]);
  assert.deepEqual(resolveTextures("Tapa Negra Pata Petribi", {}), [null, "wood"]);
  assert.deepEqual(resolveTextures("Dorados", {}), ["metal"]);
  assert.deepEqual(resolveTextures("Verde", {}), [null]);
  assert.deepEqual(resolveTextures("Natural", {}), [null]);
  assert.deepEqual(resolveTextures("Zebra", {}), []);
});

test("resolveTextures - Azul Acero es un azul liso, no azul + metal", () => {
  assert.deepEqual(findColors("Azul Acero"), [D["azul acero"]]);
  assert.deepEqual(resolveTextures("Azul Acero", {}), [null]);
});

test("resolveTextures - retocar el tono en la paleta mantiene la textura", () => {
  const palette = { petiribi: { hex: "#aa7744" } };
  assert.deepEqual(resolveColors("Petiribi", palette), ["#aa7744"]);
  assert.deepEqual(resolveTextures("Petiribi", palette), ["wood"]);
  // Si la paleta deja un solo color, la textura del segundo no sobra
  assert.deepEqual(resolveTextures("Madera y Blanco", { "madera y blanco": { hex: "#ffffff" } }), ["wood"]);
});
