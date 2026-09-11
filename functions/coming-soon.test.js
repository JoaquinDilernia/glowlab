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

// Task 3: Cliente de API Tiendanube

const { createTiendanubeClient, applyStockPlan } = require("./coming-soon");

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || null, body: opts.body ? JSON.parse(opts.body) : null });
    const match = routes.find((r) => url.includes(r.match) && (r.method || "GET") === (opts.method || "GET"));
    if (!match) return { ok: false, status: 500, text: async () => "no route" };
    // Support conditional behavior: if match has a shouldFail function, call it to decide
    if (match.shouldFail && match.shouldFail(calls.length)) {
      const err = new Error(`Network error on attempt ${calls.length}`);
      throw err;
    }
    return { ok: match.ok !== false, status: match.status || 200, json: async () => match.json, text: async () => JSON.stringify(match.json || "") };
  };
  fn.calls = calls;
  return fn;
}

test("getProductVariants devuelve variants y manda los headers correctos", async () => {
  const fetchImpl = fakeFetch([
    { match: "/v1/900/products/1", json: { id: 1, variants: [{ id: 11, stock: 5, stock_management: true }] } },
  ]);
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl });
  const variants = await client.getProductVariants("1");
  assert.equal(variants.length, 1);
  assert.match(fetchImpl.calls[0].url, /api\.tiendanube\.com\/v1\/900\/products\/1$/);
  assert.equal(fetchImpl.calls[0].headers['Authentication'], 'bearer TOK');
  assert.equal(fetchImpl.calls[0].headers['User-Agent'], 'GlowLab (info@techdi.com.ar)');
});

test("getProductVariants lanza Error con .status 404", async () => {
  const fetchImpl = fakeFetch([{ match: "/v1/900/products/999", ok: false, status: 404 }]);
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl });
  await assert.rejects(() => client.getProductVariants("999"), (e) => e.status === 404);
});

test("applyStockPlan corre los PUT en serie y cuenta aplicados", async () => {
  const fetchImpl = fakeFetch([{ match: "/variants/", method: "PUT", json: { ok: true } }]);
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl });
  const res = await applyStockPlan(client, "1", [
    { variantId: "11", stock: 0, stockManagement: true },
    { variantId: "12", stock: 0, stockManagement: true },
  ]);
  assert.equal(res.applied, 2);
  assert.equal(res.errors.length, 0);
  assert.deepEqual(fetchImpl.calls[0].body, { stock: 0, stock_management: true });
});

test("applyStockPlan reintenta variante que falla en primer intento pero sucede en segundo", async () => {
  const fetchImpl = fakeFetch([
    { match: "/variants/11", method: "PUT", shouldFail: (attempt) => attempt === 1, json: { ok: true } },
  ]);
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl });
  const res = await applyStockPlan(client, "1", [
    { variantId: "11", stock: 0, stockManagement: true },
  ]);
  assert.equal(res.applied, 1);
  assert.equal(res.errors.length, 0);
  assert.equal(fetchImpl.calls.length, 2); // dos intentos
});

test("applyStockPlan no cuenta variante que siempre falla", async () => {
  const fetchImpl = fakeFetch([
    { match: "/variants/11", method: "PUT", shouldFail: () => true, json: { ok: true } },
  ]);
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl });
  const res = await applyStockPlan(client, "1", [
    { variantId: "11", stock: 0, stockManagement: true },
  ]);
  assert.equal(res.applied, 0);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].variantId, "11");
  assert.ok(res.errors[0].message.includes("Network error"));
});

test("applyStockPlan no reintenta error HTTP con .status (ej. 422)", async () => {
  let callCount = 0;
  const customFetch = async (url, opts = {}) => {
    callCount++;
    if (url.includes("/variants/11")) {
      const err = new Error("Unprocessable Entity");
      err.status = 422;
      throw err;
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const client = createTiendanubeClient({ storeId: "900", accessToken: "TOK", fetchImpl: customFetch });
  const res = await applyStockPlan(client, "1", [
    { variantId: "11", stock: 0, stockManagement: true },
  ]);
  assert.equal(res.applied, 0);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].variantId, "11");
  assert.equal(callCount, 1); // solo un intento, sin reintento
});

// --- Task 4: orquestación pause/restore/reconcile ---

const { pauseProductInConfig, restoreProductInConfig, reconcileStore } = require("./coming-soon");

function fakeClient(variantsByProduct, { throw404, fail422 } = {}) {
  const puts = [];
  return {
    puts,
    async getProductVariants(productId) {
      if (throw404 && throw404.includes(String(productId))) { const e = new Error("404"); e.status = 404; throw e; }
      return variantsByProduct[String(productId)] || [];
    },
    async putVariant(productId, variantId, { stock, stockManagement }) {
      if (fail422 && fail422.includes(String(variantId))) {
        const e = new Error("Unprocessable Entity"); e.status = 422; throw e;
      }
      puts.push({ productId, variantId, body: { stock, stock_management: stockManagement } });
      return {};
    },
  };
}

test("pauseProductInConfig guarda snapshot y pone stock 0", async () => {
  const config = { products: [{ productId: "1", status: "scheduled", stockSnapshot: [] }] };
  const client = fakeClient({ "1": [{ id: 11, stock: 7, stock_management: true }] });
  const out = await pauseProductInConfig(config, "1", client);
  assert.deepEqual(out.products[0].stockSnapshot, [{ variantId: "11", stock: 7, stockManagement: true }]);
  assert.ok(out.products[0].pausedAt);
  assert.deepEqual(client.puts[0].body, { stock: 0, stock_management: true });
  assert.deepEqual(config.products[0].stockSnapshot, []); // no mutó el original
});

test("pauseProductInConfig ante 404 quita el producto", async () => {
  const config = { products: [{ productId: "9", status: "scheduled" }] };
  const client = fakeClient({}, { throw404: ["9"] });
  const out = await pauseProductInConfig(config, "9", client);
  assert.equal(out.products.length, 0);
});

test("restoreProductInConfig restaura stock intacto y marca launched", async () => {
  const config = { products: [{ productId: "1", status: "scheduled", stockSnapshot: [{ variantId: "11", stock: 7, stockManagement: true }] }] };
  const client = fakeClient({ "1": [{ id: 11, stock: 0, stock_management: true }] });
  const out = await restoreProductInConfig(config, "1", client);
  assert.equal(out.products[0].status, "launched");
  assert.ok(out.products[0].launchedAt);
  assert.deepEqual(client.puts[0].body, { stock: 7, stock_management: true });
});

test("reconcileStore lanza solo los vencidos", async () => {
  const now = Date.UTC(2026, 5, 1, 0, 0, 0);
  const config = { products: [
    { productId: "1", status: "scheduled", launchDate: "2026-05-01T10:00:00", stockSnapshot: [{ variantId: "11", stock: 3, stockManagement: true }] },
    { productId: "2", status: "scheduled", launchDate: "2026-07-01T10:00:00", stockSnapshot: [] },
  ] };
  const client = fakeClient({ "1": [{ id: 11, stock: 0, stock_management: true }], "2": [] });
  const { config: out, changed } = await reconcileStore({ config, client, nowMs: now });
  assert.equal(changed, true);
  assert.equal(out.products.find((p) => p.productId === "1").status, "launched");
  assert.equal(out.products.find((p) => p.productId === "2").status, "scheduled");
});

test("pauseProductInConfig ante fallo parcial (422) deja lastError y sigue scheduled", async () => {
  const config = { products: [{ productId: "1", status: "scheduled", stockSnapshot: [] }] };
  const client = fakeClient(
    { "1": [{ id: 11, stock: 5, stock_management: true }, { id: 12, stock: 3, stock_management: true }] },
    { fail422: ["12"] }
  );
  const out = await pauseProductInConfig(config, "1", client);
  assert.equal(out.products[0].status, "scheduled");
  assert.equal(typeof out.products[0].lastError, "string");
  assert.match(out.products[0].lastError, /12/);
});

test("restoreProductInConfig ante fallo parcial (422) deja lastError y sigue launched", async () => {
  const config = { products: [{ productId: "1", status: "scheduled", stockSnapshot: [
    { variantId: "11", stock: 5, stockManagement: true },
    { variantId: "12", stock: 3, stockManagement: true },
  ] }] };
  const client = fakeClient(
    { "1": [{ id: 11, stock: 0, stock_management: true }, { id: 12, stock: 0, stock_management: true }] },
    { fail422: ["12"] }
  );
  const out = await restoreProductInConfig(config, "1", client);
  assert.equal(out.products[0].status, "launched");
  assert.equal(typeof out.products[0].lastError, "string");
  assert.match(out.products[0].lastError, /12/);
});

test("reconcileStore sin vencidos no cambia nada", async () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  const config = { products: [{ productId: "2", status: "scheduled", launchDate: "2026-07-01T10:00:00", stockSnapshot: [] }] };
  const { changed } = await reconcileStore({ config, client: fakeClient({ "2": [] }), nowMs: now });
  assert.equal(changed, false);
});

const { buildWidgetScript } = require("./coming-soon");

test("buildWidgetScript devuelve un IIFE con el store y sin branding", () => {
  const js = buildWidgetScript("12345", {
    style: DEFAULT_STYLE,
    products: [{ productId: "1", launchDate: "2026-07-01T10:00:00", message: "" }],
    apiBase: "https://glowlab-production.up.railway.app",
  });
  assert.equal(typeof js, "string");
  assert.match(js, /12345/);
  assert.match(js, /__pnComingSoonLoaded/);
  assert.equal(/PromoNube|GlowLab|promonube|glowlab/i.test(js.replace(/glowlab-production/g, "")), false);
});

test("buildWidgetScript embebe los productos como JSON", () => {
  const js = buildWidgetScript("1", { style: DEFAULT_STYLE, products: [{ productId: "99", launchDate: "2026-07-01T10:00:00", message: "hey" }], apiBase: "x" });
  assert.match(js, /"productId":"99"/);
});

const { runSchedulerPass } = require("./coming-soon");

function fakeDb(docsByStore, stores) {
  const saved = {};
  return {
    saved,
    collection(name) {
      return {
        async get() {
          return { docs: Object.entries(docsByStore).map(([id, data]) => ({ id, data: () => data })) };
        },
        doc(id) {
          return {
            async get() {
              if (name === "promonube_stores") return { exists: !!stores[id], data: () => stores[id] };
              return { exists: !!docsByStore[id], data: () => docsByStore[id] };
            },
            async set(v) { saved[id] = v; },
          };
        },
      };
    },
  };
}

test("runSchedulerPass reconcilia solo las tiendas con productos vencidos", async () => {
  const now = Date.UTC(2026, 5, 1, 0, 0, 0);
  const db = fakeDb(
    {
      "900": { enabled: true, products: [{ productId: "1", status: "scheduled", launchDate: "2026-05-01T00:00:00", stockSnapshot: [{ variantId: "11", stock: 4, stockManagement: true }] }] },
      "901": { enabled: true, products: [{ productId: "2", status: "scheduled", launchDate: "2026-09-01T00:00:00", stockSnapshot: [] }] },
    },
    { "900": { accessToken: "T" }, "901": { accessToken: "T" } }
  );
  const clientFactory = () => ({
    async getProductVariants() { return [{ id: 11, stock: 0, stock_management: true }]; },
    async putVariant() { return {}; },
  });
  const FieldValue = { serverTimestamp: () => "TS" };
  const res = await runSchedulerPass({ db, FieldValue, nowMs: now, clientFactory });
  assert.equal(res.storesReconciled, 1);
  assert.equal(db.saved["900"].products[0].status, "launched");
  assert.equal(db.saved["901"], undefined);
});

const { isValidEmail } = require("./coming-soon");
test("isValidEmail", () => {
  assert.equal(isValidEmail("a@b.com"), true);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("x@" + "y".repeat(300) + ".com"), false);
});
