"use strict";

// Lista de Regalos: los novios arman una lista con productos de la tienda, la
// comparten y los invitados reservan un regalo y lo pagan en el checkout de
// Tiendanube. Modos A/B pagan con pedidos borrador (la direccion de los novios
// viaja precargada), modo C con el carrito normal.
// Spec: docs/superpowers/specs/2026-10-19-lista-de-regalos-design.md
// Plan: docs/superpowers/plans/2026-10-19-lista-de-regalos.md

const crypto = require("crypto");

const CONFIG_COLLECTION = "promonube_gift_registry_config";
const LISTS_COLLECTION = "promonube_gift_registries";
const OTP_COLLECTION = "promonube_gift_registry_otps";
const SESSION_COLLECTION = "promonube_gift_registry_sessions";

const TN_V1 = "https://api.tiendanube.com/v1";
const TN_UA = "GlowLab (info@techdi.com.ar)";
const PUBLIC_BASE = "https://glowlab-production.up.railway.app";
const ORDER_WEBHOOK_URL = `${PUBLIC_BASE}/api/gr/order-webhook`;

// Piloto: mismas tiendas que Grupos de Variantes / Combos.
// TODO: quitar allowlist cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ["2547699", "5320806", "6854698"];

const DELIVERY_MODES = ["couple_address", "store_pickup", "guest_choice"];
const EVENT_TYPES = ["wedding", "baby", "birthday", "housewarming", "other"];

const DEFAULT_CONFIG = {
  enabled: false,
  allowedModes: [...DELIVERY_MODES],
  reservationHours: 2,
  pagePath: "/lista-de-regalos/",
  texts: { title: "", intro: "" },
  webhookId: null,
};

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_HOUR = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEMS_PER_LIST = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAllowedStore(storeId) {
  return ALLOWED_STORE_IDS.includes(String(storeId));
}

// ---------------------------------------------------------------------------
// Funciones puras: listas, disponibilidad y vistas
// ---------------------------------------------------------------------------

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

function uniqueSlug(base, existingSlugs) {
  const taken = new Set(existingSlugs || []);
  const root = base || "lista";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

const ADDRESS_REQUIRED = ["address", "number", "city", "province", "zipcode"];
const ADDRESS_FIELDS = ["address", "number", "floor", "locality", "city", "province", "zipcode"];

function validateListInput(input, { allowedModes } = {}) {
  const errors = [];
  const src = input && typeof input === "object" ? input : {};
  const modes = allowedModes && allowedModes.length ? allowedModes : DELIVERY_MODES;

  const title = str(src.title);
  if (title.length < 2 || title.length > 80) errors.push("El nombre de la lista debe tener entre 2 y 80 caracteres.");

  const eventDate = str(src.eventDate);
  if (!isValidDate(eventDate)) errors.push("La fecha del evento no es válida.");

  const eventType = EVENT_TYPES.includes(src.eventType) ? src.eventType : "other";

  const owners = (Array.isArray(src.owners) ? src.owners : [])
    .map((o) => ({ name: str(o && o.name).slice(0, 80), email: str(o && o.email).toLowerCase() }))
    .filter((o) => o.name || o.email);
  if (owners.length < 1 || owners.length > 2) errors.push("La lista tiene que tener 1 o 2 personas a cargo.");
  if (owners.some((o) => !EMAIL_PATTERN.test(o.email))) errors.push("Hay un email inválido.");

  const deliveryMode = src.deliveryMode;
  if (!modes.includes(deliveryMode)) errors.push("El modo de entrega no está disponible.");

  let address = null;
  if (deliveryMode === "couple_address") {
    const a = src.address && typeof src.address === "object" ? src.address : {};
    address = {};
    for (const f of ADDRESS_FIELDS) address[f] = str(a[f]).slice(0, 120);
    if (ADDRESS_REQUIRED.some((f) => !address[f])) errors.push("Completá la dirección de entrega (calle, número, ciudad, provincia y CP).");
  }

  const message = str(src.message);
  if (message.length > 500) errors.push("El mensaje puede tener hasta 500 caracteres.");

  const coverImage = str(src.coverImage);
  if (coverImage && !/^https:\/\//i.test(coverImage)) errors.push("La foto de portada no es válida.");

  return {
    ok: errors.length === 0,
    errors,
    value: {
      title,
      eventDate,
      eventType,
      owners,
      deliveryMode,
      address,
      message,
      coverImage,
      public: src.public === true,
    },
  };
}

function validateItemInput(input) {
  const src = input && typeof input === "object" ? input : {};
  const productId = String(src.productId == null ? "" : src.productId);
  const variantId = String(src.variantId == null ? "" : src.variantId);
  const quantity = Number(src.quantity);
  const price = Number(src.price);
  const name = str(src.name);
  const ok =
    /^\d+$/.test(productId) &&
    /^\d+$/.test(variantId) &&
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 &&
    name.length > 0 && name.length <= 200 &&
    Number.isFinite(price) && price >= 0;
  return {
    ok,
    value: ok
      ? { productId, variantId, quantity, price: Math.round(price * 100) / 100, name, image: /^https?:\/\//i.test(str(src.image)) || str(src.image).startsWith("//") ? str(src.image) : "" }
      : null,
  };
}

function isActiveReservation(gift, now) {
  return gift.status === "reserved" && Number(gift.reservedUntil) > now;
}

function isGifted(gift) {
  return gift.status === "paid" || gift.status === "manual";
}

function itemAvailability(item, gifts, now) {
  let gifted = 0;
  let reserved = 0;
  for (const g of gifts || []) {
    if (g.itemId !== item.itemId) continue;
    if (isGifted(g)) gifted += Number(g.quantity) || 0;
    else if (isActiveReservation(g, now)) reserved += Number(g.quantity) || 0;
  }
  const wanted = Number(item.quantity) || 0;
  return { wanted, gifted, reserved, available: Math.max(0, wanted - gifted - reserved) };
}

function itemsWithAvailability(list, gifts, now) {
  return (list.items || []).map((item) => {
    const a = itemAvailability(item, gifts, now);
    return {
      itemId: item.itemId,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      image: item.image || "",
      price: item.price,
      quantity: a.wanted,
      gifted: a.gifted,
      available: a.available,
    };
  });
}

// Vista para invitados: sin datos de los novios ni de quien regalo.
function publicListView(list, gifts, now) {
  const items = itemsWithAvailability(list, gifts, now);
  const open = items.filter((i) => i.available > 0);
  const done = items.filter((i) => i.available === 0);
  return {
    slug: list.slug,
    title: list.title,
    eventType: list.eventType,
    eventDate: list.eventDate,
    message: list.message || "",
    coverImage: list.coverImage || "",
    deliveryMode: list.deliveryMode,
    items: [...open, ...done],
  };
}

// Vista de los novios: todo, mas regalos con nombre y mensaje (sin email).
function ownerListView(list, gifts, now) {
  return {
    id: list.id,
    slug: list.slug,
    status: list.status,
    title: list.title,
    eventType: list.eventType,
    eventDate: list.eventDate,
    message: list.message || "",
    coverImage: list.coverImage || "",
    deliveryMode: list.deliveryMode,
    address: list.address || null,
    public: !!list.public,
    owners: list.owners || [],
    items: itemsWithAvailability(list, gifts, now),
    gifts: (gifts || [])
      .filter((g) => isGifted(g))
      .map((g) => ({
        giftId: g.giftId,
        itemId: g.itemId,
        quantity: g.quantity,
        guestName: g.guestName || "",
        message: g.message || "",
        status: g.status,
        paidAt: g.paidAt || null,
      })),
  };
}

function giftsToExpire(gifts, now) {
  return (gifts || []).filter((g) => g.status === "reserved" && Number(g.reservedUntil) <= now);
}

// Resumen para el listado del admin.
function listSummary(list, gifts, now) {
  const items = itemsWithAvailability(list, gifts, now);
  const priceByItem = new Map((list.items || []).map((i) => [i.itemId, Number(i.price) || 0]));
  const totalPaid = (gifts || [])
    .filter(isGifted)
    .reduce((sum, g) => sum + (priceByItem.get(g.itemId) || 0) * (Number(g.quantity) || 0), 0);
  return {
    id: list.id,
    slug: list.slug,
    title: list.title,
    eventDate: list.eventDate,
    eventType: list.eventType,
    status: list.status,
    deliveryMode: list.deliveryMode,
    createdBy: list.createdBy,
    unitsWanted: items.reduce((s, i) => s + i.quantity, 0),
    unitsGifted: items.reduce((s, i) => s + i.gifted, 0),
    totalPaid: Math.round(totalPaid * 100) / 100,
    // Pagos que llegaron sobre una reserva vencida pueden dejar un item
    // regalado de mas: el comercio lo resuelve con su politica de cambios.
    overGifted: items.some((i) => i.gifted > i.quantity),
  };
}

// ---------------------------------------------------------------------------
// Funciones puras: compra y atribucion
// ---------------------------------------------------------------------------

function splitName(full) {
  const parts = str(full).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || "-", last: "-" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

// Body de POST /draft_orders. En modo A el contacto lleva el nombre de los
// novios porque el checkout usa el contacto como destinatario del envio
// (visto en la Fase 0); el email es el del invitado, que recibe el comprobante.
function buildDraftOrderPayload({ list, item, quantity, giftId, guest }) {
  const toCouple = list.deliveryMode === "couple_address";
  const contact = toCouple ? splitName(list.title) : splitName(guest.name);
  const note = [
    `Lista de regalos: ${list.title} (${list.slug})`,
    `Regalo de ${guest.name}`,
    toCouple ? `Entregar a ${list.title}` : list.deliveryMode === "store_pickup" ? "Retira en el local / entrega conjunta" : "",
  ].filter(Boolean).join(" · ");

  const body = {
    contact_name: contact.first,
    contact_lastname: contact.last,
    contact_email: guest.email,
    payment_status: "unpaid",
    note: note.slice(0, 500),
    products: [{
      variant_id: Number(item.variantId),
      quantity,
      properties: { lista: list.slug, regalo: giftId },
    }],
  };
  if (toCouple && list.address) {
    const shipping_address = {};
    for (const f of ADDRESS_FIELDS) if (list.address[f]) shipping_address[f] = list.address[f];
    body.shipping = { shipping_address };
  }
  return body;
}

const EMAIL_MATCH_WINDOW_MS = 72 * 60 * 60 * 1000;

// candidates: [{ giftId, listId, status, draftOrderId, guestEmail, productId, createdAt }]
function matchOrderToGift(order, candidates, now) {
  const pending = (candidates || []).filter((c) => c.status === "reserved" || c.status === "expired");
  const orderId = String(order.id);

  const byDraft = pending.filter((c) => c.draftOrderId && String(c.draftOrderId) === orderId);
  if (byDraft.length) return byDraft.map(({ giftId, listId }) => ({ giftId, listId }));

  const giftIds = new Set();
  for (const p of order.products || []) {
    const props = p.properties || {};
    if (props.regalo) giftIds.add(String(props.regalo));
  }
  const byProps = pending.filter((c) => giftIds.has(String(c.giftId)));
  if (byProps.length) return byProps.map(({ giftId, listId }) => ({ giftId, listId }));

  const email = str(order.contact_email).toLowerCase();
  const productIds = new Set((order.products || []).map((p) => String(p.product_id)));
  const byEmail = pending.filter((c) =>
    !c.draftOrderId &&
    email && str(c.guestEmail).toLowerCase() === email &&
    productIds.has(String(c.productId)) &&
    now - Number(c.createdAt) <= EMAIL_MATCH_WINDOW_MS
  );
  return byEmail.map(({ giftId, listId }) => ({ giftId, listId }));
}

// ---------------------------------------------------------------------------
// Auth de novios por codigo al email
// ---------------------------------------------------------------------------

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function recentSends(sends, now) {
  return (sends || []).filter((t) => now - t < 60 * 60 * 1000);
}

function canSendCode(sends, now) {
  return recentSends(sends, now).length < OTP_MAX_SENDS_PER_HOUR;
}

function otpDocId(storeId, email) {
  return `${storeId}_${sha256(email)}`;
}

function codeEmail(storeName, code) {
  const name = storeName || "la tienda";
  return {
    subject: `Tu código para tu lista de regalos: ${code}`,
    text: `Tu código para entrar a tu lista de regalos de ${name} es ${code}. Vence en 10 minutos.\n\nSi no lo pediste, ignorá este mail.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#353434">
<p style="margin:0 0 12px">Tu código para entrar a tu lista de regalos de <b>${escapeHtml(name)}</b> es:</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:0 0 12px">${code}</p>
<p style="margin:0;color:#8a8580;font-size:13px">Vence en 10 minutos. Si no lo pediste, ignorá este mail.</p>
</div>`,
  };
}

function invitationEmail(storeName, list, panelUrl) {
  const name = storeName || "la tienda";
  return {
    subject: `Tu lista de regalos "${list.title}" en ${name} está lista`,
    text: `¡Hola! ${name} creó tu lista de regalos "${list.title}". Entrá con este email para agregar productos y compartirla: ${panelUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#353434">
<p style="margin:0 0 12px">¡Hola! <b>${escapeHtml(name)}</b> creó tu lista de regalos <b>${escapeHtml(list.title)}</b>.</p>
<p style="margin:0 0 20px">Entrá con este email para agregar productos y compartirla con tus invitados.</p>
<p style="margin:0"><a href="${escapeHtml(panelUrl)}" style="background:#353434;color:#fff;padding:12px 20px;border-radius:5px;text-decoration:none;display:inline-block">Ir a mi lista</a></p>
</div>`,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function requestCode({ db, storeId, email, storeName, sendEmail, now = Date.now() }) {
  const normalized = str(email).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return { ok: false, message: "Email inválido" };
  const ref = db.collection(OTP_COLLECTION).doc(otpDocId(storeId, normalized));
  const doc = await ref.get();
  const sends = doc.exists ? recentSends(doc.data().sends, now) : [];
  if (!canSendCode(sends, now)) return { ok: false, message: "Pediste muchos códigos. Probá de nuevo en un rato." };

  const code = generateCode();
  await ref.set({
    storeId: String(storeId),
    codeHash: sha256(`${normalized}:${code}`),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    sends: [...sends, now],
  });
  await sendEmail({ to: normalized, fromName: storeName, ...codeEmail(storeName, code) });
  return { ok: true };
}

async function verifyCode({ db, storeId, email, code, now = Date.now() }) {
  const normalized = str(email).toLowerCase();
  const ref = db.collection(OTP_COLLECTION).doc(otpDocId(storeId, normalized));
  const doc = await ref.get();
  const fail = { ok: false, message: "El código no es válido o venció." };
  if (!doc.exists) return fail;
  const otp = doc.data();
  if (otp.expiresAt <= now || otp.attempts >= OTP_MAX_ATTEMPTS) return fail;
  if (otp.codeHash !== sha256(`${normalized}:${str(code)}`)) {
    await ref.update({ attempts: (otp.attempts || 0) + 1 });
    return fail;
  }
  const token = generateToken();
  await db.collection(SESSION_COLLECTION).doc(sha256(token)).set({
    storeId: String(storeId),
    email: normalized,
    expiresAt: now + SESSION_TTL_MS,
  });
  await ref.delete();
  return { ok: true, token };
}

async function getSession(db, storeId, authHeader, now = Date.now()) {
  const m = /^Bearer\s+(.+)$/i.exec(str(authHeader));
  if (!m) return null;
  const doc = await db.collection(SESSION_COLLECTION).doc(sha256(m[1])).get();
  if (!doc.exists) return null;
  const s = doc.data();
  if (s.storeId !== String(storeId) || s.expiresAt <= now) return null;
  return { email: s.email };
}

// ---------------------------------------------------------------------------
// Firestore / Tiendanube
// ---------------------------------------------------------------------------

async function loadConfig(db, storeId) {
  const doc = await db.collection(CONFIG_COLLECTION).doc(String(storeId)).get();
  return doc.exists ? { ...DEFAULT_CONFIG, ...doc.data() } : { ...DEFAULT_CONFIG };
}

async function loadGifts(listRef) {
  const snap = await listRef.collection("gifts").get();
  return snap.docs.map((d) => ({ giftId: d.id, ...d.data() }));
}

async function getStoreInfo(db, storeId) {
  const doc = await db.collection("promonube_stores").doc(String(storeId)).get();
  if (!doc.exists) return null;
  const d = doc.data();
  let baseUrl = str(d.storeUrl).replace(/\/+$/, "");
  if (!baseUrl && d.accessToken) {
    try {
      const r = await fetch(`${TN_V1}/${storeId}/store?fields=url_with_protocol,original_domain`, {
        headers: { Authentication: `bearer ${d.accessToken}`, "User-Agent": TN_UA },
      });
      if (r.ok) {
        const s = await r.json();
        baseUrl = str(s.url_with_protocol) || (s.original_domain ? `https://${s.original_domain}` : "");
      }
    } catch (_) { /* sin URL: el mail sale sin link */ }
  }
  return { accessToken: d.accessToken, storeName: d.storeName || "", baseUrl: baseUrl.replace(/\/+$/, "") };
}

async function ensureOrderWebhook({ storeId, accessToken }) {
  const headers = { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA, "Content-Type": "application/json" };
  const listRes = await fetch(`${TN_V1}/${storeId}/webhooks`, { headers });
  if (!listRes.ok) throw new Error(`TN GET webhooks: ${listRes.status}`);
  const existing = (await listRes.json()).find((w) => w.event === "order/paid" && w.url === ORDER_WEBHOOK_URL);
  if (existing) return existing.id;
  const res = await fetch(`${TN_V1}/${storeId}/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event: "order/paid", url: ORDER_WEBHOOK_URL }),
  });
  if (!res.ok) throw new Error(`TN POST webhook: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).id;
}

async function slugsInStore(db, storeId) {
  const snap = await db.collection(LISTS_COLLECTION).where("storeId", "==", String(storeId)).select("slug").get();
  return snap.docs.map((d) => d.data().slug);
}

async function createList({ db, FieldValue, storeId, value, createdBy }) {
  const slug = uniqueSlug(slugify(value.title), await slugsInStore(db, storeId));
  const ref = db.collection(LISTS_COLLECTION).doc();
  const list = {
    ...value,
    storeId: String(storeId),
    slug,
    status: "active",
    items: [],
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(list);
  return { id: ref.id, ...list };
}

function panelUrl(baseUrl, pagePath) {
  return baseUrl ? `${baseUrl}${pagePath}?panel` : "";
}

// ---------------------------------------------------------------------------
// Rutas del admin del comercio
// ---------------------------------------------------------------------------

function registerGiftRegistryRoutes(app, { db, FieldValue, checkStoreActive, sendEmail }) {
  function guard(storeId, res) {
    if (!storeId) {
      res.status(400).json({ success: false, message: "storeId requerido" });
      return false;
    }
    if (!isAllowedStore(storeId)) {
      res.status(403).json({ success: false, message: "Módulo no disponible para esta tienda" });
      return false;
    }
    return true;
  }

  async function getListForStore(storeId, listId) {
    const ref = db.collection(LISTS_COLLECTION).doc(String(listId));
    const doc = await ref.get();
    if (!doc.exists || doc.data().storeId !== String(storeId)) return null;
    return { ref, list: { id: doc.id, ...doc.data() } };
  }

  // GET /api/gift-registry/config?storeId=X
  app.get("/api/gift-registry/config", async (req, res) => {
    const { storeId } = req.query;
    if (!guard(storeId, res)) return;
    try {
      res.json({ success: true, config: await loadConfig(db, storeId) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/gift-registry/config
  app.post("/api/gift-registry/config", async (req, res) => {
    const { storeId, config } = req.body || {};
    if (!guard(storeId, res)) return;
    if (!config || typeof config !== "object") return res.status(400).json({ success: false, message: "config requerido" });
    if (!(await checkStoreActive(storeId))) return res.status(403).json({ success: false, message: "Plan inactivo" });

    const allowedModes = (Array.isArray(config.allowedModes) ? config.allowedModes : []).filter((m) => DELIVERY_MODES.includes(m));
    if (!allowedModes.length) return res.status(400).json({ success: false, message: "Elegí al menos un modo de entrega" });
    const hours = Number(config.reservationHours);
    let pagePath = str(config.pagePath) || DEFAULT_CONFIG.pagePath;
    if (!pagePath.startsWith("/")) pagePath = `/${pagePath}`;
    if (!pagePath.endsWith("/")) pagePath = `${pagePath}/`;
    if (!/^\/[a-z0-9\-/]+\/$/i.test(pagePath)) return res.status(400).json({ success: false, message: "La ruta de la página no es válida" });

    try {
      const current = await loadConfig(db, storeId);
      const next = {
        enabled: !!config.enabled,
        allowedModes,
        reservationHours: Number.isFinite(hours) ? Math.min(48, Math.max(1, Math.round(hours))) : DEFAULT_CONFIG.reservationHours,
        pagePath,
        texts: {
          title: str(config.texts && config.texts.title).slice(0, 80),
          intro: str(config.texts && config.texts.intro).slice(0, 300),
        },
        webhookId: current.webhookId || null,
      };
      if (next.enabled && !next.webhookId) {
        const info = await getStoreInfo(db, storeId);
        if (!info || !info.accessToken) return res.status(401).json({ success: false, message: "No hay token de acceso" });
        next.webhookId = await ensureOrderWebhook({ storeId, accessToken: info.accessToken });
      }
      await db.collection(CONFIG_COLLECTION).doc(String(storeId)).set(
        { ...next, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      res.json({ success: true, config: next });
    } catch (error) {
      console.error("[GiftRegistry config]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/gift-registry/lists?storeId=X
  app.get("/api/gift-registry/lists", async (req, res) => {
    const { storeId } = req.query;
    if (!guard(storeId, res)) return;
    try {
      const snap = await db.collection(LISTS_COLLECTION).where("storeId", "==", String(storeId)).get();
      const now = Date.now();
      const lists = await Promise.all(snap.docs.map(async (doc) => {
        const gifts = await loadGifts(doc.ref);
        return listSummary({ id: doc.id, ...doc.data() }, gifts, now);
      }));
      lists.sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
      res.json({ success: true, lists });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /api/gift-registry/lists/:id?storeId=X - detalle (el comercio ve emails)
  app.get("/api/gift-registry/lists/:id", async (req, res) => {
    const { storeId } = req.query;
    if (!guard(storeId, res)) return;
    try {
      const found = await getListForStore(storeId, req.params.id);
      if (!found) return res.status(404).json({ success: false, message: "Lista no encontrada" });
      const gifts = await loadGifts(found.ref);
      const now = Date.now();
      const config = await loadConfig(db, storeId);
      const info = await getStoreInfo(db, storeId);
      res.json({
        success: true,
        list: {
          ...ownerListView(found.list, gifts, now),
          createdBy: found.list.createdBy,
          publicUrl: info && info.baseUrl ? `${info.baseUrl}${config.pagePath}?lista=${found.list.slug}` : "",
        },
        gifts: gifts
          .filter((g) => g.status !== "expired")
          .map((g) => ({
            giftId: g.giftId,
            itemId: g.itemId,
            quantity: g.quantity,
            guestName: g.guestName || "",
            guestEmail: g.guestEmail || "",
            message: g.message || "",
            status: g.status,
            orderId: g.orderId || g.draftOrderId || null,
            createdAt: g.createdAt || null,
            paidAt: g.paidAt || null,
          })),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/gift-registry/lists - el comercio crea la lista por los novios
  app.post("/api/gift-registry/lists", async (req, res) => {
    const { storeId, list } = req.body || {};
    if (!guard(storeId, res)) return;
    if (!(await checkStoreActive(storeId))) return res.status(403).json({ success: false, message: "Plan inactivo" });
    try {
      const config = await loadConfig(db, storeId);
      const v = validateListInput(list, { allowedModes: config.allowedModes });
      if (!v.ok) return res.status(400).json({ success: false, message: v.errors.join(" ") });
      const created = await createList({ db, FieldValue, storeId, value: v.value, createdBy: "store" });

      const info = await getStoreInfo(db, storeId);
      const url = panelUrl(info && info.baseUrl, config.pagePath);
      let invited = false;
      if (url) {
        const mail = invitationEmail(info.storeName, created, url);
        for (const owner of created.owners) {
          try {
            await sendEmail({ to: owner.email, fromName: info.storeName, ...mail });
            invited = true;
          } catch (e) {
            console.error("[GiftRegistry invite]", e.message);
          }
        }
      }
      res.json({ success: true, id: created.id, slug: created.slug, invited });
    } catch (error) {
      console.error("[GiftRegistry create]", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/gift-registry/lists/:id/status - cerrar / reabrir
  app.post("/api/gift-registry/lists/:id/status", async (req, res) => {
    const { storeId, status } = req.body || {};
    if (!guard(storeId, res)) return;
    if (!["active", "closed"].includes(status)) return res.status(400).json({ success: false, message: "Estado inválido" });
    try {
      const found = await getListForStore(storeId, req.params.id);
      if (!found) return res.status(404).json({ success: false, message: "Lista no encontrada" });
      await found.ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/gift-registry/lists/:id/manual-gift - regalo pagado fuera de la web
  app.post("/api/gift-registry/lists/:id/manual-gift", async (req, res) => {
    const { storeId, itemId, quantity, guestName, message } = req.body || {};
    if (!guard(storeId, res)) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ success: false, message: "Cantidad inválida" });
    try {
      const found = await getListForStore(storeId, req.params.id);
      if (!found) return res.status(404).json({ success: false, message: "Lista no encontrada" });
      if (!(found.list.items || []).some((i) => i.itemId === itemId)) {
        return res.status(404).json({ success: false, message: "Regalo no encontrado" });
      }
      const now = Date.now();
      await found.ref.collection("gifts").add({
        itemId,
        quantity: qty,
        guestName: str(guestName).slice(0, 80) || "Pago en el local",
        guestEmail: "",
        message: str(message).slice(0, 500),
        status: "manual",
        draftOrderId: null,
        orderId: null,
        reservedUntil: null,
        createdAt: now,
        paidAt: now,
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

module.exports = {
  ALLOWED_STORE_IDS,
  DELIVERY_MODES,
  DEFAULT_CONFIG,
  isAllowedStore,
  slugify,
  uniqueSlug,
  validateListInput,
  validateItemInput,
  itemAvailability,
  publicListView,
  ownerListView,
  giftsToExpire,
  listSummary,
  buildDraftOrderPayload,
  matchOrderToGift,
  sha256,
  generateCode,
  generateToken,
  canSendCode,
  requestCode,
  verifyCode,
  getSession,
  registerGiftRegistryRoutes,
};
