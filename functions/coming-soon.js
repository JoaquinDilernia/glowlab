"use strict";

// Módulo "Próximamente" (Coming Soon). Aislado, no comparte estado con otros módulos.
// Patrón calcado de price-financing.js / search.js.

const COLLECTION = "promonube_coming_soon";

// Id numérico del script "Próximamente" registrado en Tiendanube Partners
// (Aplicaciones → GlowLab #23137 → Scripts). Se completa después de crearlo ahí.
// TODO(deploy): reemplazar null por el id real antes de activar el módulo en tiendas.
const COMING_SOON_SCRIPT_ID = null;

// launchDate se guarda como 'YYYY-MM-DDTHH:mm:ss' y se interpreta como hora de
// Argentina (UTC-3, sin horario de verano).
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

const DEFAULT_STYLE = {
  badgeText: "PRÓXIMAMENTE",
  badgeShape: "ribbon",
  badgePosition: "top-left",
  badgeBg: "#111111",
  badgeTextColor: "#ffffff",
  badgeFontFamily: "inherit",
  badgeFontSize: 12,
  badgeUppercase: true,
  priceReplaceText: "Disponible pronto",
  priceReplaceColor: "#111111",
  priceReplaceFontSize: 14,
  priceShowDate: true,
  countdownEnabled: true,
  countdownLayout: "boxes",
  countdownUnits: ["days", "hours", "minutes", "seconds"],
  countdownDigitsColor: "#111111",
  countdownLabelsColor: "#777777",
  countdownAccentColor: "#111111",
  countdownFontFamily: "inherit",
  countdownSize: "md",
  countdownHeading: "Lanzamiento en",
  notifyEnabled: true,
  notifyHeading: "¿Querés que te avisemos?",
  notifyPlaceholder: "Tu email",
  notifyButtonText: "Avisarme",
  notifySuccessText: "¡Listo! Te avisamos cuando esté disponible.",
  notifyBg: "#f5f5f5",
  notifyTextColor: "#111111",
  notifyButtonBg: "#111111",
  notifyButtonTextColor: "#ffffff",
};

const DEFAULT_CONFIG = {
  enabled: false,
  style: DEFAULT_STYLE,
  categories: [],
  products: [],
};

const LAUNCH_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseLaunchDate(value) {
  if (typeof value !== "string") return null;
  const m = value.match(LAUNCH_DATE_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (Number.isNaN(utc)) return null;
  return utc + AR_OFFSET_MS; // hora AR -> epoch UTC
}

function isPastLaunch(launchDate, nowMs) {
  const t = parseLaunchDate(launchDate);
  if (t === null) return false;
  return t <= nowMs;
}

function validateLaunchDate(value, nowMs) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "Falta la fecha de lanzamiento" };
  }
  const t = parseLaunchDate(value);
  if (t === null) return { ok: false, error: "Formato de fecha inválido" };
  if (t <= nowMs) return { ok: false, error: "La fecha de lanzamiento ya pasó" };
  return { ok: true, error: null };
}

function mergeConfig(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: r.enabled === true,
    style: { ...DEFAULT_STYLE, ...(r.style && typeof r.style === "object" ? r.style : {}) },
    categories: Array.isArray(r.categories) ? r.categories : [],
    products: Array.isArray(r.products) ? r.products : [],
  };
}

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toIso(createdAt) {
  if (!createdAt) return "";
  if (typeof createdAt === "string") return createdAt;
  if (createdAt instanceof Date) return createdAt.toISOString();
  if (typeof createdAt._seconds === "number") return new Date(createdAt._seconds * 1000).toISOString();
  if (typeof createdAt.toDate === "function") return createdAt.toDate().toISOString();
  return "";
}

function leadsToCsv(rows) {
  const header = "producto_id,producto_nombre,email,fecha";
  const body = (rows || []).map((r) =>
    [csvCell(r.productId), csvCell(r.productName), csvCell(r.email), csvCell(toIso(r.createdAt))].join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

function snapshotVariants(currentVariants) {
  return (currentVariants || []).map((v) => ({
    variantId: String(v.id),
    stock: Number(v.stock) || 0,
    stockManagement: v.stock_management !== false,
  }));
}

function buildStockPausePlan(currentVariants) {
  return (currentVariants || []).map((v) => ({
    variantId: String(v.id),
    stock: 0,
    stockManagement: true,
  }));
}

function buildStockRestorePlan(snapshot, currentVariants) {
  const currentById = new Map((currentVariants || []).map((v) => [String(v.id), v]));
  const plan = [];
  for (const snap of snapshot || []) {
    const cur = currentById.get(String(snap.variantId));
    if (!cur) continue; // variante borrada
    const curStock = Number(cur.stock) || 0;
    if (curStock !== 0) continue; // el dueño la editó a mano
    plan.push({ variantId: String(snap.variantId), stock: snap.stock, stockManagement: snap.stockManagement });
  }
  return plan;
}

function diffProducts(prevProducts, nextProducts) {
  const prevById = new Map((prevProducts || []).map((p) => [String(p.productId), p]));
  const nextById = new Map((nextProducts || []).map((p) => [String(p.productId), p]));

  const toPause = [];
  for (const [id, np] of nextById) {
    const pp = prevById.get(id);
    if (!pp) { toPause.push(id); continue; }
    if (pp.status === "launched" && np.status === "scheduled") toPause.push(id);
  }

  const toRestore = [];
  for (const [id, pp] of prevById) {
    if (pp.status === "scheduled" && !nextById.has(id)) toRestore.push(id);
  }

  return { toPause, toRestore };
}

function pickLocalized(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.es || Object.values(value)[0] || "";
  return String(value);
}

function expandCategoryToProducts(categoryProducts, opts) {
  const existing = opts.existingIds || new Set();
  const out = [];
  for (const p of categoryProducts || []) {
    const id = String(p.id);
    if (existing.has(id)) continue;
    out.push({
      productId: id,
      productName: pickLocalized(p.name),
      productImage: (p.images && p.images[0] && (p.images[0].src || p.images[0])) || "",
      launchDate: opts.launchDate,
      message: opts.message || "",
      source: "category",
      sourceCategoryId: String(opts.categoryId),
      status: "scheduled",
      stockSnapshot: [],
      pausedAt: null,
      launchedAt: null,
      lastError: null,
    });
  }
  return out;
}

function propagateCategoryDate(products, categoryId, newDate) {
  return (products || []).map((p) =>
    p.source === "category" && String(p.sourceCategoryId) === String(categoryId) && p.status !== "launched"
      ? { ...p, launchDate: newDate }
      : p
  );
}

function shapeWidgetProducts(products, nowMs) {
  return (products || [])
    .filter((p) => p.status === "scheduled" && !isPastLaunch(p.launchDate, nowMs))
    .map((p) => ({ productId: String(p.productId), launchDate: p.launchDate, message: p.message || "" }));
}

module.exports = {
  COLLECTION,
  COMING_SOON_SCRIPT_ID,
  AR_OFFSET_MS,
  DEFAULT_STYLE,
  DEFAULT_CONFIG,
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
};
