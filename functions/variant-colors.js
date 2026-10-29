"use strict";

// Deteccion de color a partir del nombre del producto (Grupos de Variantes,
// modo "color"). Alto Rancho no tiene un listado de colores exactos todavia:
// se aproxima con este diccionario y el admin puede pisar cada color desde la
// paleta (colorPalette en la config). Las claves van normalizadas: minuscula,
// sin acentos, en singular masculino.
const COLOR_DICTIONARY = {
  // neutros
  "negro": "#1c1c1c",
  "blanco": "#f6f5f1",
  "blanco tiza": "#ece8df",
  "tiza": "#ece8df",
  "hueso": "#e9e1d0",
  "marfil": "#f2ead8",
  "crema": "#efe4cc",
  "crudo": "#ece3cf",
  "perlado": "#e8e4dc",
  "gris": "#8c8c8c",
  "gris claro": "#c6c6c6",
  "gris oscuro": "#4a4a4a",
  "gris perla": "#d3d4d0",
  "grafito": "#3b3d40",
  "plomo": "#6b6e72",
  "greige": "#b5ab9d",
  "beige": "#d9c7a7",
  "arena": "#d6c3a0",
  "topo": "#8b7d6b",
  "taupe": "#8b7d6b",
  "vison": "#8e7f72",
  // maderas y tierras
  "natural": "#c9a77c",
  "madera": "#a87a4f",
  "roble": "#b08657",
  "roble oscuro": "#6e4b2e",
  "ebano": "#2a201a",
  "negro ebano": "#2a201a",
  "pino": "#d8b27a",
  "cedro": "#9a5b3a",
  "nogal": "#6b4a2f",
  "wengue": "#3d2b1f",
  "petiribi": "#a6764a",
  "petribi": "#a6764a",
  "paraiso": "#9c6b45",
  "marron": "#6b4423",
  "chocolate": "#4b2e1e",
  "camel": "#b98b55",
  "caramelo": "#a8642b",
  "tabaco": "#6f4b2a",
  "mocha mousse": "#a47864",
  "mocha": "#a47864",
  "terracota": "#b4593b",
  "ladrillo": "#9c4a32",
  "habano": "#7a5230",
  "canela": "#a0643a",
  "rattan": "#c49a5c",
  "carey": "#5a3a22",
  // metales
  "plateado": "#c0c0c0",
  "plata": "#c0c0c0",
  "niquel": "#a7a9ac",
  "acero": "#9ea3a8",
  // "Azul Acero" es un tono de azul, no azul + metal
  "azul acero": "#4a6584",
  "cromo": "#b8bcc0",
  "dorado": "#c9a646",
  "oro": "#c9a646",
  "bronce": "#8c6a3f",
  "cobre": "#b5703f",
  // rojos
  "rojo": "#b3261e",
  "tomate": "#c8402c",
  "bordo": "#6d1a24",
  "vino": "#6b1f2a",
  "malbec": "#5b1a2e",
  "rosa": "#e8a9b8",
  "rosa viejo": "#c9959b",
  "fucsia": "#c2185b",
  // amarillos y naranjas
  "naranja": "#e07a2e",
  "mostaza": "#c9a227",
  "ocre": "#c08a2c",
  "ambar": "#c47f1a",
  "amarillo": "#e8c547",
  "maiz": "#e6c25a",
  // verdes
  "verde": "#4f7a4a",
  "verde seco": "#8a8f6a",
  "verde oscuro": "#2f4a33",
  "verde botella": "#1f4a35",
  "verde oliva": "#6b6b3a",
  "oliva": "#6b6b3a",
  "salvia": "#9caf88",
  "tea green": "#c9d8b6",
  "menta": "#a8d5c2",
  // azules y violetas
  "celeste": "#8fc1e3",
  "celeste frio": "#a9c8dc",
  "azul": "#2e4a8a",
  "azul marino": "#1f2a44",
  "azul profundo": "#1c2f5a",
  "azul aero": "#7cb9e8",
  "turquesa": "#3fb8af",
  "petroleo": "#1f4d5a",
  "violeta": "#6a4c93",
  "lila": "#b9a3d1",
  "transparente": "#e6eef1",
};

// Colores que son un material: el widget les dibuja una textura encima del
// tono base (vetas, brillo metalico, trama, manchas). El resto va liso.
// "Natural" queda afuera a proposito: en la tienda se usa para tusor y lino.
const COLOR_TEXTURES = {
  "madera": "wood", "roble": "wood", "roble oscuro": "wood", "pino": "wood",
  "cedro": "wood", "nogal": "wood", "wengue": "wood", "petiribi": "wood",
  "petribi": "wood", "paraiso": "wood", "ebano": "wood", "negro ebano": "wood",
  "plateado": "metal", "plata": "metal", "niquel": "metal", "acero": "metal",
  "cromo": "metal", "dorado": "metal", "oro": "metal", "bronce": "metal",
  "cobre": "metal",
  "rattan": "rattan",
  "carey": "carey",
};

const MAX_COLORS = 2;
const MAX_PHRASE_WORDS = 3;

const COLOR_TOKENS = new Set(
  Object.keys(COLOR_DICTIONARY).flatMap((k) => k.split(" "))
);

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// "negras" -> "negro", "plateados" -> "plateado", "blanca" -> "blanco".
// Solo devuelve una forma alternativa si existe en el diccionario.
function canonicalToken(token) {
  const t = normalizeText(token);
  if (COLOR_TOKENS.has(t)) return t;
  const candidates = [];
  if (t.endsWith("es")) candidates.push(t.slice(0, -2));
  if (t.endsWith("s")) candidates.push(t.slice(0, -1));
  const singular = t.endsWith("s") ? t.slice(0, -1) : t;
  if (singular.endsWith("a")) candidates.push(singular.slice(0, -1) + "o");
  return candidates.find((c) => COLOR_TOKENS.has(c)) || t;
}

function tokenize(s) {
  return String(s || "").split(/[\s/,\-+]+/).filter(Boolean);
}

function isColorToken(word) {
  return COLOR_TOKENS.has(canonicalToken(word));
}

// Busca hasta 2 colores conocidos dentro de un texto ("Tapa Negra Patas
// Petribi" -> [negro, petribi]). Prioriza la frase mas larga ("verde seco"
// antes que "verde"). Devuelve las claves del diccionario.
function findColorKeys(label) {
  const tokens = tokenize(label).map(canonicalToken);
  const found = [];
  let i = 0;
  while (i < tokens.length && found.length < MAX_COLORS) {
    let matched = 0;
    for (let n = Math.min(MAX_PHRASE_WORDS, tokens.length - i); n >= 1; n--) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (COLOR_DICTIONARY[phrase]) {
        const hex = COLOR_DICTIONARY[phrase];
        if (!found.some((k) => COLOR_DICTIONARY[k] === hex)) found.push(phrase);
        matched = n;
        break;
      }
    }
    i += matched || 1;
  }
  return found;
}

function findColors(label) {
  return findColorKeys(label).map((k) => COLOR_DICTIONARY[k]);
}

function colorKey(label) {
  return normalizeText(label).replace(/\s+/g, " ");
}

// El color es lo que queda del nombre al sacar las palabras que comparten
// todos los productos del grupo al principio y al final:
// "Mesa Comedor Brooklyn Negro 1,20 mts" / "... Petribi 1,20 mts" -> "Negro".
// Si una palabra comun es un color ("Gris Claro" / "Gris Oscuro") se devuelve
// al color en vez de quedar en el prefijo.
function extractColorLabels(names) {
  const lists = (names || []).map((n) => tokenize(n));
  if (lists.length < 2) return lists.map(() => "");
  const same = (a, b) => normalizeText(a) === normalizeText(b);
  const minLen = Math.min(...lists.map((l) => l.length));

  let prefix = 0;
  while (prefix < minLen && lists.every((l) => same(l[prefix], lists[0][prefix]))) prefix++;
  while (prefix > 0 && isColorToken(lists[0][prefix - 1])) prefix--;

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    lists.every((l) => same(l[l.length - 1 - suffix], lists[0][lists[0].length - 1 - suffix]))
  ) suffix++;
  while (suffix > 0 && isColorToken(lists[0][lists[0].length - suffix])) suffix--;

  return lists.map((l) => l.slice(prefix, l.length - suffix).join(" "));
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_PALETTE_ENTRIES = 1000;

function sanitizePalette(palette) {
  const out = {};
  if (!palette || typeof palette !== "object") return out;
  for (const [key, entry] of Object.entries(palette).slice(0, MAX_PALETTE_ENTRIES)) {
    if (!entry || typeof entry !== "object" || typeof key !== "string" || key.length > 120) continue;
    if (!HEX_PATTERN.test(entry.hex || "")) continue;
    out[key] = { hex: entry.hex.toLowerCase() };
    if (HEX_PATTERN.test(entry.hex2 || "")) out[key].hex2 = entry.hex2.toLowerCase();
  }
  return out;
}

// Colores finales de un label: lo que el admin cargo a mano en la paleta, o
// si no, lo que se detecto con el diccionario. [] = sin color (se usa la foto).
function resolveColors(label, palette) {
  const override = palette && palette[colorKey(label)];
  if (override && override.hex) return [override.hex, override.hex2].filter(Boolean);
  return findColors(label);
}

// Textura de cada color de resolveColors (misma posicion, null = liso). Sale
// del nombre, asi si el admin retoca el tono de "Petiribi" sigue siendo madera.
function resolveTextures(label, palette) {
  const textures = findColorKeys(label).map((k) => COLOR_TEXTURES[k] || null);
  return textures.slice(0, resolveColors(label, palette).length);
}

// Para la paleta del admin: un item por color distinto de los grupos publicados.
function collectDetectedColors(groups) {
  const byKey = new Map();
  for (const group of groups || []) {
    const products = group.products || [];
    const labels = extractColorLabels(products.map((p) => p.name));
    products.forEach((p, i) => {
      const label = labels[i];
      if (!label) return;
      const key = colorKey(label);
      if (!byKey.has(key)) {
        byKey.set(key, { key, label, count: 0, autoColors: findColors(label), sampleImage: p.image || "" });
      }
      byKey.get(key).count += 1;
    });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count);
}

module.exports = {
  COLOR_DICTIONARY,
  normalizeText,
  findColors,
  colorKey,
  extractColorLabels,
  sanitizePalette,
  resolveColors,
  resolveTextures,
  collectDetectedColors,
};
