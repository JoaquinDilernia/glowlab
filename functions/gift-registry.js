"use strict";

// Lista de Regalos: los novios arman una lista con productos de la tienda, la
// comparten y los invitados reservan un regalo y lo pagan en el checkout de
// Tiendanube. Modos A/B pagan con pedidos borrador (la direccion de los novios
// viaja precargada), modo C con el carrito normal.
// Spec: docs/superpowers/specs/2026-10-19-lista-de-regalos-design.md
// Plan: docs/superpowers/plans/2026-10-19-lista-de-regalos.md

const crypto = require("crypto");
const { buildStorefrontScript } = require("./gift-registry-widget");

const CONFIG_COLLECTION = "promonube_gift_registry_config";
const LISTS_COLLECTION = "promonube_gift_registries";

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
  // El email del primero es obligatorio (ahi le llega el link de edicion); el de la pareja, opcional.
  if (owners.some((o, i) => (i === 0 || o.email) && !EMAIL_PATTERN.test(o.email))) errors.push("Hay un email inválido.");

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
  // Incluye borradores: no esta confirmado que el pedido pagado conserve el id
  // del borrador, y el email del borrador es el del invitado.
  const byEmail = pending.filter((c) =>
    email && str(c.guestEmail).toLowerCase() === email &&
    productIds.has(String(c.productId)) &&
    now - Number(c.createdAt) <= EMAIL_MATCH_WINDOW_MS
  );
  return byEmail.map(({ giftId, listId }) => ({ giftId, listId }));
}

// ---------------------------------------------------------------------------
// Link privado de edicion: quien lo tiene edita la lista (sin login ni codigo)
// ---------------------------------------------------------------------------

// 192 bits: no se puede adivinar. Se guarda en la lista para que el comercio
// pueda reenviarlo si los novios lo pierden.
function generateEditKey() {
  return crypto.randomBytes(24).toString("base64url");
}

function bearerKey(authHeader) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(str(authHeader));
  return m ? m[1] : null;
}

function editUrl(baseUrl, pagePath, editKey) {
  return baseUrl && editKey ? `${baseUrl}${pagePath}?editar=${editKey}` : "";
}

function publicListUrl(baseUrl, pagePath, slug) {
  return baseUrl ? `${baseUrl}${pagePath}?lista=${slug}` : "";
}

function editLinkEmail(storeName, list, { editLink, shareLink }) {
  const name = storeName || "la tienda";
  const share = shareLink
    ? `<p style="margin:20px 0 6px">Y este es el link para compartir con tus invitados:</p>
<p style="margin:0"><a href="${escapeHtml(shareLink)}" style="color:#353434">${escapeHtml(shareLink)}</a></p>`
    : "";
  return {
    subject: `Tu lista de regalos "${list.title}" en ${name}`,
    text: `¡Tu lista de regalos "${list.title}" en ${name} está lista!\n\n` +
      `Tu link privado para editarla (guardalo y no lo compartas): ${editLink}\n` +
      (shareLink ? `\nLink para tus invitados: ${shareLink}\n` : ""),
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#353434">
<p style="margin:0 0 12px">¡Tu lista de regalos <b>${escapeHtml(list.title)}</b> en <b>${escapeHtml(name)}</b> está lista!</p>
<p style="margin:0 0 20px">Con este botón entrás a editarla cuando quieras: agregar productos, cambiar datos y ver los regalos. Guardá este mail y no lo reenvíes.</p>
<p style="margin:0"><a href="${escapeHtml(editLink)}" style="background:#353434;color:#fff;padding:12px 20px;border-radius:5px;text-decoration:none;display:inline-block">Editar mi lista</a></p>
${share}
</div>`,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Manda el link de edicion a los que tienen email. Nunca corta el flujo.
async function sendEditLink({ sendEmail, storeName, list, editLink, shareLink }) {
  const mail = editLinkEmail(storeName, list, { editLink, shareLink });
  let sent = false;
  for (const owner of list.owners || []) {
    if (!owner.email) continue;
    try {
      await sendEmail({ to: owner.email, fromName: storeName, ...mail });
      sent = true;
    } catch (e) {
      console.error("[GiftRegistry email]", e.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Panel de los novios: reglas puras
// ---------------------------------------------------------------------------

function mergeListEdit(list, input, { allowedModes }) {
  const src = input && typeof input === "object" ? input : {};
  const merged = { ...list, ...src };
  if (!Array.isArray(src.owners)) merged.owners = list.owners;
  return validateListInput(merged, { allowedModes });
}

// Si la variante ya esta en la lista, suma cantidad en vez de duplicarla.
function addItemToList(items, value, { now, newId }) {
  const current = items || [];
  const existing = current.find((i) => i.variantId === value.variantId);
  if (existing) {
    const quantity = Math.min(100, existing.quantity + value.quantity);
    const next = current.map((i) => (i === existing ? { ...i, quantity, price: value.price } : i));
    return { ok: true, items: next, item: { ...existing, quantity, price: value.price } };
  }
  if (current.length >= MAX_ITEMS_PER_LIST) return { ok: false, message: "La lista llegó al máximo de productos." };
  const item = { itemId: newId(), ...value, addedAt: now };
  return { ok: true, items: [...current, item], item };
}

// No se puede bajar por debajo de lo regalado o reservado (ni quitar el item).
function updateItemQuantity(items, itemId, quantity, gifts, now) {
  const item = (items || []).find((i) => i.itemId === itemId);
  if (!item) return { ok: false, status: 404, message: "Producto no encontrado en la lista." };
  const a = itemAvailability(item, gifts, now);
  const committed = a.gifted + a.reserved;
  if (quantity === 0) {
    if (committed > 0) return { ok: false, status: 409, message: "Ya se lo regalaron: no se puede quitar." };
    return { ok: true, items: items.filter((i) => i.itemId !== itemId) };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { ok: false, status: 400, message: "Cantidad inválida." };
  }
  if (quantity < committed) {
    return { ok: false, status: 409, message: `Ya regalaron ${committed}: no podés pedir menos.` };
  }
  return { ok: true, items: items.map((i) => (i.itemId === itemId ? { ...i, quantity } : i)) };
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  // Prefijo ' para que Excel no ejecute formulas (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Regalos recibidos, para agradecer. Separador ; porque Excel en es-AR lo espera.
function giftsCsv(list, gifts) {
  const names = new Map((list.items || []).map((i) => [i.itemId, i.name]));
  const rows = (gifts || [])
    .filter(isGifted)
    .sort((a, b) => (Number(a.paidAt) || 0) - (Number(b.paidAt) || 0))
    .map((g) => [
      g.guestName,
      names.get(g.itemId) || "",
      g.quantity,
      g.message,
      g.paidAt ? new Date(Number(g.paidAt)).toISOString().slice(0, 10) : "",
    ]);
  return [["Invitado", "Regalo", "Cantidad", "Mensaje", "Fecha"], ...rows]
    .map((r) => r.map(csvCell).join(";"))
    .join("\r\n");
}

// ---------------------------------------------------------------------------
// Invitados: reglas puras
// ---------------------------------------------------------------------------

function validateGuestInput(input) {
  const src = input && typeof input === "object" ? input : {};
  const errors = [];
  const guestName = str(src.guestName).slice(0, 80);
  const guestEmail = str(src.guestEmail).toLowerCase();
  const message = str(src.message);
  const quantity = Number(src.quantity == null ? 1 : src.quantity);
  if (guestName.length < 2) errors.push("Contanos tu nombre.");
  if (!EMAIL_PATTERN.test(guestEmail)) errors.push("Revisá tu email.");
  if (message.length > 500) errors.push("El mensaje puede tener hasta 500 caracteres.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push("Cantidad inválida.");
  return {
    ok: errors.length === 0,
    errors,
    value: { itemId: str(src.itemId), guestName, guestEmail, message, quantity },
  };
}

// Rate limit en memoria (por instancia): suficiente para frenar abuso.
function createRateLimiter({ max, windowMs }) {
  const hits = new Map();
  return function allow(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    return true;
  };
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

function tnHeaders(accessToken) {
  return { Authentication: `bearer ${accessToken}`, "User-Agent": TN_UA, "Content-Type": "application/json" };
}

async function createDraftOrder({ storeId, accessToken, payload }) {
  const res = await fetch(`${TN_V1}/${storeId}/draft_orders`, {
    method: "POST",
    headers: tnHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`TN POST draft_orders: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const draft = await res.json();
  if (!draft.checkout_url) throw new Error("TN draft_orders sin checkout_url");
  return { id: draft.id, checkoutUrl: draft.checkout_url };
}

// Cancela el borrador (el link de pago deja de funcionar). 404 = ya no existe.
async function cancelDraftOrder({ storeId, accessToken, draftOrderId }) {
  const res = await fetch(`${TN_V1}/${storeId}/draft_orders/${draftOrderId}`, {
    method: "DELETE",
    headers: tnHeaders(accessToken),
  });
  if (!res.ok && res.status !== 404) throw new Error(`TN DELETE draft_orders/${draftOrderId}: ${res.status}`);
}

async function fetchOrder({ storeId, accessToken, orderId }) {
  const res = await fetch(`${TN_V1}/${storeId}/orders/${orderId}`, { headers: tnHeaders(accessToken) });
  if (!res.ok) throw new Error(`TN GET orders/${orderId}: ${res.status}`);
  return res.json();
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
    editKey: generateEditKey(),
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(list);
  return { id: ref.id, ...list };
}

async function findListByEditKey(db, storeId, editKey) {
  const snap = await db.collection(LISTS_COLLECTION)
    .where("storeId", "==", String(storeId))
    .where("editKey", "==", editKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ref: doc.ref, list: { id: doc.id, ...doc.data() } };
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
      // Listas creadas antes del link de edicion: se les genera uno.
      let editKey = found.list.editKey;
      if (!editKey) {
        editKey = generateEditKey();
        await found.ref.update({ editKey });
      }
      const baseUrl = info && info.baseUrl;
      res.json({
        success: true,
        list: {
          ...ownerListView(found.list, gifts, now),
          createdBy: found.list.createdBy,
          publicUrl: publicListUrl(baseUrl, config.pagePath, found.list.slug),
          editUrl: editUrl(baseUrl, config.pagePath, editKey),
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
      const baseUrl = info && info.baseUrl;
      const editLink = editUrl(baseUrl, config.pagePath, created.editKey);
      const invited = editLink
        ? await sendEditLink({
          sendEmail,
          storeName: info.storeName,
          list: created,
          editLink,
          shareLink: publicListUrl(baseUrl, config.pagePath, created.slug),
        })
        : false;
      res.json({ success: true, id: created.id, slug: created.slug, invited, editUrl: editLink });
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

  registerCoupleRoutes(app, { db, FieldValue, checkStoreActive, sendEmail, guard });
  registerOrderWebhook(app, { db });
}

// Loader que se agrega al script de Grupos de Variantes (ya instalado en la
// tienda) durante el piloto, igual que Combos.
function buildLoaderSnippet(store) {
  return `
(function() {
  if (window.__pnGiftRegistryLoader) return;
  window.__pnGiftRegistryLoader = true;
  var s = document.createElement('script');
  s.src = '${PUBLIC_BASE}/api/gift-registry-widget.js?store=${store}';
  s.async = true;
  document.head.appendChild(s);
})();
`;
}

async function isGiftRegistryEnabled(db, storeId) {
  if (!isAllowedStore(storeId)) return false;
  const config = await loadConfig(db, storeId);
  return config.enabled === true;
}

// ---------------------------------------------------------------------------
// Rutas de los novios (storefront, /api/gr/*)
// ---------------------------------------------------------------------------

function clientIp(req) {
  return str(req.headers["x-forwarded-for"]).split(",")[0].trim() || req.ip || "";
}

function registerCoupleRoutes(app, { db, FieldValue, checkStoreActive, sendEmail, guard }) {
  const createLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

  // GET /api/gift-registry-widget.js?store=X
  app.get("/api/gift-registry-widget.js", async (req, res) => {
    const { store } = req.query;
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    if (!store || !isAllowedStore(store)) return res.send("// Lista de regalos: no disponible");
    try {
      const config = await loadConfig(db, store);
      if (!config.enabled || !(await checkStoreActive(store))) return res.send("// Lista de regalos: deshabilitado");
      res.send(buildStorefrontScript({ store, api: PUBLIC_BASE, config }));
    } catch (error) {
      console.error("[GiftRegistry widget]", error);
      res.send("// Lista de regalos: error interno");
    }
  });

  // Tienda habilitada + modulo activo. Devuelve la config o null (ya respondio).
  async function storefrontGuard(storeId, res) {
    if (!guard(storeId, res)) return null;
    const config = await loadConfig(db, storeId);
    if (!config.enabled) {
      res.status(403).json({ success: false, message: "La lista de regalos no está activa." });
      return null;
    }
    return config;
  }

  // Link de edicion (Authorization: Bearer <editKey>). Si la ruta tiene :id,
  // tiene que ser la lista de ese link. Devuelve { config, found } o null.
  async function ownerGuard(req, res, storeId) {
    const config = await storefrontGuard(storeId, res);
    if (!config) return null;
    const key = bearerKey(req.headers.authorization);
    const found = key && await findListByEditKey(db, storeId, key);
    if (!found) {
      res.status(401).json({ success: false, message: "Este link de edición no es válido." });
      return null;
    }
    if (req.params.id && req.params.id !== found.list.id) {
      res.status(404).json({ success: false, message: "Lista no encontrada" });
      return null;
    }
    return { config, found };
  }

  const fail = (res, error, tag) => {
    console.error(`[GiftRegistry ${tag}]`, error);
    res.status(500).json({ success: false, message: "Algo salió mal. Probá de nuevo." });
  };

  // GET /api/gr/manage?store=X - la lista del link de edicion
  app.get("/api/gr/manage", async (req, res) => {
    try {
      const ctx = await ownerGuard(req, res, req.query.store);
      if (!ctx) return;
      res.json({ success: true, list: ownerListView(ctx.found.list, await loadGifts(ctx.found.ref), Date.now()) });
    } catch (error) {
      fail(res, error, "manage");
    }
  });

  // POST /api/gr/lists - los novios crean su lista; la respuesta trae el link de edicion
  app.post("/api/gr/lists", async (req, res) => {
    const { store, list } = req.body || {};
    if (!createLimiter(clientIp(req))) return res.status(429).json({ success: false, message: "Demasiados intentos. Probá en unos minutos." });
    try {
      const config = await storefrontGuard(store, res);
      if (!config) return;
      if (!(await checkStoreActive(store))) return res.status(403).json({ success: false, message: "La lista de regalos no está disponible." });
      const v = validateListInput(list, { allowedModes: config.allowedModes });
      if (!v.ok) return res.status(400).json({ success: false, message: v.errors.join(" ") });
      const created = await createList({ db, FieldValue, storeId: store, value: v.value, createdBy: "couple" });

      const info = await getStoreInfo(db, store);
      const baseUrl = info && info.baseUrl;
      const editLink = editUrl(baseUrl, config.pagePath, created.editKey);
      const emailed = editLink
        ? await sendEditLink({
          sendEmail,
          storeName: info.storeName,
          list: created,
          editLink,
          shareLink: publicListUrl(baseUrl, config.pagePath, created.slug),
        })
        : false;
      res.json({ success: true, list: ownerListView(created, [], Date.now()), editKey: created.editKey, emailed });
    } catch (error) {
      fail(res, error, "create");
    }
  });

  app.patch("/api/gr/lists/:id", async (req, res) => {
    const { store, list } = req.body || {};
    try {
      const ctx = await ownerGuard(req, res, store);
      if (!ctx) return;
      const v = mergeListEdit(ctx.found.list, list, { allowedModes: ctx.config.allowedModes });
      if (!v.ok) return res.status(400).json({ success: false, message: v.errors.join(" ") });
      await ctx.found.ref.update({ ...v.value, updatedAt: FieldValue.serverTimestamp() });
      const gifts = await loadGifts(ctx.found.ref);
      res.json({ success: true, list: ownerListView({ ...ctx.found.list, ...v.value }, gifts, Date.now()) });
    } catch (error) {
      fail(res, error, "edit");
    }
  });

  app.post("/api/gr/lists/:id/items", async (req, res) => {
    const { store, item } = req.body || {};
    try {
      const ctx = await ownerGuard(req, res, store);
      if (!ctx) return;
      if (ctx.found.list.status !== "active") return res.status(409).json({ success: false, message: "La lista está cerrada." });
      const v = validateItemInput(item);
      if (!v.ok) return res.status(400).json({ success: false, message: "Producto inválido." });
      const r = addItemToList(ctx.found.list.items, v.value, { now: Date.now(), newId: () => crypto.randomBytes(6).toString("hex") });
      if (!r.ok) return res.status(409).json({ success: false, message: r.message });
      await ctx.found.ref.update({ items: r.items, updatedAt: FieldValue.serverTimestamp() });
      res.json({ success: true, item: r.item });
    } catch (error) {
      fail(res, error, "add-item");
    }
  });

  async function changeQuantity(req, res, quantity) {
    const store = (req.body && req.body.store) || req.query.store;
    const ctx = await ownerGuard(req, res, store);
    if (!ctx) return;
    const gifts = await loadGifts(ctx.found.ref);
    const now = Date.now();
    const r = updateItemQuantity(ctx.found.list.items, req.params.itemId, quantity, gifts, now);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await ctx.found.ref.update({ items: r.items, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true, list: ownerListView({ ...ctx.found.list, items: r.items }, gifts, now) });
  }

  app.patch("/api/gr/lists/:id/items/:itemId", async (req, res) => {
    try {
      await changeQuantity(req, res, Number(req.body && req.body.quantity));
    } catch (error) {
      fail(res, error, "qty");
    }
  });

  app.delete("/api/gr/lists/:id/items/:itemId", async (req, res) => {
    try {
      await changeQuantity(req, res, 0);
    } catch (error) {
      fail(res, error, "remove-item");
    }
  });

  // GET /api/gr/lists/:id/export.csv?store=X - con Authorization (se descarga via fetch + blob)
  app.get("/api/gr/lists/:id/export.csv", async (req, res) => {
    try {
      const ctx = await ownerGuard(req, res, req.query.store);
      if (!ctx) return;
      const csv = giftsCsv(ctx.found.list, await loadGifts(ctx.found.ref));
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="regalos-${ctx.found.list.slug}.csv"`);
      res.send("﻿" + csv);
    } catch (error) {
      fail(res, error, "export");
    }
  });

  registerGuestRoutes(app, { db, storefrontGuard, fail });
}

// ---------------------------------------------------------------------------
// Invitados (storefront, /api/gr/public/*), webhook de pago y reservas
// ---------------------------------------------------------------------------

async function findListBySlug(db, storeId, slug) {
  const snap = await db.collection(LISTS_COLLECTION)
    .where("storeId", "==", String(storeId))
    .where("slug", "==", str(slug))
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ref: doc.ref, list: { id: doc.id, ...doc.data() } };
}

// Solo portadas subidas por el modulo (Storage no tiene CORS y el canvas de
// las placas necesita la imagen del mismo origen).
function isCoverImageUrl(value) {
  let u;
  try { u = new URL(str(value)); } catch (_) { return false; }
  if (u.protocol !== "https:" || u.hostname !== "storage.googleapis.com") return false;
  const parts = u.pathname.split("/");
  return parts.length >= 5 && parts[2] === "gift-registry" && !u.pathname.includes("..");
}

function registerGuestRoutes(app, { db, storefrontGuard, fail }) {
  const reserveLimiter = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

  // GET /api/gr/cover?url=... - proxy de la portada para dibujar las placas
  app.get("/api/gr/cover", async (req, res) => {
    if (!isCoverImageUrl(req.query.url)) return res.status(400).end();
    try {
      const upstream = await fetch(str(req.query.url));
      const type = upstream.headers.get("content-type") || "";
      if (!upstream.ok || !type.startsWith("image/")) return res.status(404).end();
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      console.error("[GiftRegistry cover]", error.message);
      res.status(502).end();
    }
  });

  // GET /api/gr/public/:slug?store=X
  app.get("/api/gr/public/:slug", async (req, res) => {
    const { store } = req.query;
    try {
      if (!(await storefrontGuard(store, res))) return;
      const found = await findListBySlug(db, store, req.params.slug);
      if (!found || found.list.status !== "active") {
        return res.status(404).json({ success: false, message: "No encontramos esta lista o ya está cerrada." });
      }
      res.json({ success: true, list: publicListView(found.list, await loadGifts(found.ref), Date.now()) });
    } catch (error) {
      fail(res, error, "public");
    }
  });

  // POST /api/gr/public/:slug/reserve - el invitado elige un regalo
  app.post("/api/gr/public/:slug/reserve", async (req, res) => {
    const { store } = req.body || {};
    if (!reserveLimiter(clientIp(req))) {
      return res.status(429).json({ success: false, message: "Demasiados intentos. Probá en unos minutos." });
    }
    try {
      const config = await storefrontGuard(store, res);
      if (!config) return;
      const v = validateGuestInput(req.body);
      if (!v.ok) return res.status(400).json({ success: false, message: v.errors.join(" ") });
      const found = await findListBySlug(db, store, req.params.slug);
      if (!found || found.list.status !== "active") {
        return res.status(404).json({ success: false, message: "No encontramos esta lista o ya está cerrada." });
      }

      // Transaccion: dos invitados no pueden reservar la ultima unidad a la vez.
      const giftRef = found.ref.collection("gifts").doc();
      const now = Date.now();
      const reservation = await db.runTransaction(async (tx) => {
        const listDoc = await tx.get(found.ref);
        const list = { id: listDoc.id, ...listDoc.data() };
        const giftsSnap = await tx.get(found.ref.collection("gifts"));
        const gifts = giftsSnap.docs.map((d) => ({ giftId: d.id, ...d.data() }));
        const item = (list.items || []).find((i) => i.itemId === v.value.itemId);
        if (!item) return { error: "Este regalo ya no está en la lista.", status: 404 };
        const { available } = itemAvailability(item, gifts, now);
        if (available < v.value.quantity) {
          return {
            error: available > 0 ? `Quedan ${available} disponibles.` : "¡Alguien se te adelantó! Este regalo ya está reservado.",
            status: 409,
          };
        }
        const gift = {
          storeId: String(store),
          listId: list.id,
          itemId: item.itemId,
          productId: String(item.productId),
          variantId: String(item.variantId),
          quantity: v.value.quantity,
          guestName: v.value.guestName,
          guestEmail: v.value.guestEmail,
          message: v.value.message,
          status: "reserved",
          draftOrderId: null,
          orderId: null,
          reservedUntil: now + config.reservationHours * 60 * 60 * 1000,
          createdAt: now,
          paidAt: null,
        };
        tx.set(giftRef, gift);
        return { list, item, gift };
      });
      if (reservation.error) return res.status(reservation.status).json({ success: false, message: reservation.error });

      const { list, item, gift } = reservation;
      if (list.deliveryMode === "guest_choice") {
        return res.json({
          success: true,
          mode: "cart",
          giftId: giftRef.id,
          productId: gift.productId,
          variantId: gift.variantId,
          quantity: gift.quantity,
          reservedUntil: gift.reservedUntil,
        });
      }

      // Modos A y B: pedido borrador con el link de pago.
      try {
        const info = await getStoreInfo(db, store);
        const payload = buildDraftOrderPayload({
          list,
          item,
          quantity: gift.quantity,
          giftId: giftRef.id,
          guest: { name: gift.guestName, email: gift.guestEmail },
        });
        const draft = await createDraftOrder({ storeId: store, accessToken: info.accessToken, payload });
        await giftRef.update({ draftOrderId: String(draft.id) });
        res.json({ success: true, mode: "draft", giftId: giftRef.id, checkoutUrl: draft.checkoutUrl, reservedUntil: gift.reservedUntil });
      } catch (error) {
        await giftRef.update({ status: "expired" }).catch(() => {});
        console.error("[GiftRegistry draft]", error.message);
        res.status(502).json({ success: false, message: "No pudimos preparar el pago. Probá de nuevo en un rato." });
      }
    } catch (error) {
      fail(res, error, "reserve");
    }
  });
}

// Gifts reservados o vencidos de la tienda (candidatos a matchear un pago).
async function pendingGifts(db, storeId) {
  const lists = await db.collection(LISTS_COLLECTION).where("storeId", "==", String(storeId)).get();
  const out = [];
  for (const listDoc of lists.docs) {
    const snap = await listDoc.ref.collection("gifts").where("status", "in", ["reserved", "expired"]).get();
    for (const d of snap.docs) out.push({ ref: d.ref, giftId: d.id, listId: listDoc.id, ...d.data() });
  }
  return out;
}

// Pedido pagado -> gifts "paid". Idempotente: solo mira reservados/vencidos.
// No se confia en el body del webhook: el pedido se trae de la API.
async function processPaidOrder({ db, storeId, orderId, now = Date.now() }) {
  if (!isAllowedStore(storeId)) return { skipped: "store" };
  const config = await loadConfig(db, storeId);
  if (!config.enabled) return { skipped: "disabled" };
  const info = await getStoreInfo(db, storeId);
  if (!info || !info.accessToken) return { skipped: "token" };
  const order = await fetchOrder({ storeId, accessToken: info.accessToken, orderId });
  if (order.payment_status !== "paid") return { skipped: "unpaid" };

  const candidates = await pendingGifts(db, storeId);
  const matches = matchOrderToGift(order, candidates, now);
  for (const m of matches) {
    const c = candidates.find((x) => x.giftId === m.giftId);
    await c.ref.update({ status: "paid", orderId: String(order.id), paidAt: now });
  }
  return { matched: matches.length };
}

// Reservas vencidas -> "expired" y se cancela el borrador (best effort).
async function sweepReservations({ db, now = Date.now() }) {
  let expired = 0;
  for (const storeId of ALLOWED_STORE_IDS) {
    const config = await loadConfig(db, storeId);
    if (!config.enabled) continue;
    const gifts = giftsToExpire(await pendingGifts(db, storeId), now);
    if (!gifts.length) continue;
    const info = await getStoreInfo(db, storeId);
    for (const g of gifts) {
      await g.ref.update({ status: "expired" });
      expired++;
      if (g.draftOrderId && info && info.accessToken) {
        await cancelDraftOrder({ storeId, accessToken: info.accessToken, draftOrderId: g.draftOrderId })
          .catch((e) => console.error("[GiftRegistry sweep]", e.message));
      }
    }
  }
  return { expired };
}

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function registerOrderWebhook(app, { db }) {
  // POST /api/gr/order-webhook - Tiendanube order/paid { store_id, event, id }
  app.post("/api/gr/order-webhook", (req, res) => {
    res.sendStatus(200);
    const { store_id: storeId, id: orderId } = req.body || {};
    if (!storeId || !orderId) return;
    processPaidOrder({ db, storeId: String(storeId), orderId })
      .then((r) => { if (r.matched) console.warn(`[GiftRegistry] pedido ${orderId} (${storeId}): ${r.matched} regalo(s) pagado(s)`); })
      .catch((e) => console.error("[GiftRegistry webhook]", e.message));
  });

  const timer = setInterval(() => {
    sweepReservations({ db }).catch((e) => console.error("[GiftRegistry sweep]", e.message));
  }, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
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
  generateEditKey,
  bearerKey,
  editUrl,
  editLinkEmail,
  sendEditLink,
  mergeListEdit,
  addItemToList,
  updateItemQuantity,
  giftsCsv,
  validateGuestInput,
  createDraftOrder,
  cancelDraftOrder,
  fetchOrder,
  createRateLimiter,
  buildLoaderSnippet,
  isGiftRegistryEnabled,
  isCoverImageUrl,
  processPaidOrder,
  sweepReservations,
  registerGiftRegistryRoutes,
};
