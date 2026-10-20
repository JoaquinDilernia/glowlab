"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
  createRateLimiter,
  validateGuestInput,
  isCoverImageUrl,
} = require("./gift-registry");

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

const validList = {
  title: "Sofi y Juan",
  eventDate: "2026-12-12",
  eventType: "wedding",
  owners: [{ name: "Sofi", email: "Sofi@Mail.com" }, { name: "Juan", email: "juan@mail.com" }],
  deliveryMode: "couple_address",
  address: { address: "Av. Siempreviva", number: "742", city: "CABA", province: "Capital Federal", zipcode: "1425" },
  message: "¡Gracias!",
  coverImage: "https://img.test/a.jpg",
};

const list = {
  id: "L1",
  slug: "sofi-y-juan",
  status: "active",
  title: "Sofi y Juan",
  eventType: "wedding",
  eventDate: "2026-12-12",
  deliveryMode: "couple_address",
  address: validList.address,
  owners: [{ name: "Sofi", email: "sofi@mail.com" }],
  items: [
    { itemId: "i1", productId: "100", variantId: "1000", name: "Copa", image: "", price: 1000, quantity: 6 },
    { itemId: "i2", productId: "200", variantId: "2000", name: "Mesa", image: "", price: 50000, quantity: 1 },
  ],
};

// --- slugs ---------------------------------------------------------------

test("slugify - minusculas, sin acentos ni simbolos", () => {
  assert.equal(slugify("Sofi & Juan Pérez"), "sofi-juan-perez");
  assert.equal(slugify("  --Baby Shower!!  "), "baby-shower");
  assert.ok(slugify("a".repeat(80)).length <= 40);
});

test("uniqueSlug - agrega sufijo si ya existe", () => {
  assert.equal(uniqueSlug("sofi-y-juan", []), "sofi-y-juan");
  assert.equal(uniqueSlug("sofi-y-juan", ["sofi-y-juan", "sofi-y-juan-2"]), "sofi-y-juan-3");
  assert.equal(uniqueSlug("", []), "lista");
});

// --- validacion ------------------------------------------------------------

test("validateListInput - lista valida normaliza emails", () => {
  const v = validateListInput(validList);
  assert.equal(v.ok, true, v.errors.join(" "));
  assert.equal(v.value.owners[0].email, "sofi@mail.com");
});

test("validateListInput - modo A sin direccion completa es invalido", () => {
  const v = validateListInput({ ...validList, address: { address: "X" } });
  assert.equal(v.ok, false);
});

test("validateListInput - modo no permitido por el comercio", () => {
  const v = validateListInput(validList, { allowedModes: ["guest_choice"] });
  assert.equal(v.ok, false);
});

test("validateListInput - reglas basicas", () => {
  assert.equal(validateListInput({ ...validList, title: "A" }).ok, false);
  assert.equal(validateListInput({ ...validList, eventDate: "12/12/2026" }).ok, false);
  assert.equal(validateListInput({ ...validList, owners: [] }).ok, false);
  assert.equal(validateListInput({ ...validList, owners: [{ name: "x", email: "mal" }] }).ok, false);
  assert.equal(validateListInput({ ...validList, coverImage: "javascript:alert(1)" }).ok, false);
  assert.equal(validateListInput({ ...validList, message: "x".repeat(501) }).ok, false);
});

test("validateListInput - modos B y C no guardan direccion", () => {
  const v = validateListInput({ ...validList, deliveryMode: "store_pickup" });
  assert.equal(v.ok, true);
  assert.equal(v.value.address, null);
});

test("validateItemInput - valida ids, cantidad y precio", () => {
  const ok = validateItemInput({ productId: 100, variantId: "1000", quantity: 2, price: 10.555, name: "Copa", image: "https://x/y.jpg" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.price, 10.56);
  assert.equal(validateItemInput({ productId: "x", variantId: "1", quantity: 1, price: 1, name: "a" }).ok, false);
  assert.equal(validateItemInput({ productId: "1", variantId: "1", quantity: 0, price: 1, name: "a" }).ok, false);
  assert.equal(validateItemInput({ productId: "1", variantId: "1", quantity: 101, price: 1, name: "a" }).ok, false);
});

// --- disponibilidad --------------------------------------------------------

test("itemAvailability - pagados, manuales y reservas vigentes descuentan", () => {
  const gifts = [
    { itemId: "i1", quantity: 2, status: "paid" },
    { itemId: "i1", quantity: 1, status: "manual" },
    { itemId: "i1", quantity: 1, status: "reserved", reservedUntil: NOW + HOUR },
    { itemId: "i1", quantity: 5, status: "reserved", reservedUntil: NOW - 1 },
    { itemId: "i1", quantity: 5, status: "expired" },
    { itemId: "i2", quantity: 1, status: "paid" },
  ];
  assert.deepEqual(itemAvailability(list.items[0], gifts, NOW), { wanted: 6, gifted: 3, reserved: 1, available: 2 });
});

test("itemAvailability - nunca negativo", () => {
  const gifts = [{ itemId: "i2", quantity: 3, status: "paid" }];
  assert.equal(itemAvailability(list.items[1], gifts, NOW).available, 0);
});

test("publicListView - no expone datos de novios ni invitados; regalados al final", () => {
  const gifts = [{ giftId: "g1", itemId: "i2", quantity: 1, status: "paid", guestName: "Tia Marta", guestEmail: "marta@mail.com", message: "Felicidades" }];
  const view = publicListView(list, gifts, NOW);
  const json = JSON.stringify(view);
  for (const secret of ["sofi@mail.com", "Tia Marta", "marta@mail.com", "Felicidades", "Siempreviva", "owners"]) {
    assert.ok(!json.includes(secret), `no deberia incluir ${secret}`);
  }
  assert.deepEqual(view.items.map((i) => i.itemId), ["i1", "i2"]);
  assert.equal(view.items[1].available, 0);
});

test("ownerListView - muestra nombre y mensaje del invitado pero no su email", () => {
  const gifts = [
    { giftId: "g1", itemId: "i2", quantity: 1, status: "paid", guestName: "Tia Marta", guestEmail: "marta@mail.com", message: "Felicidades" },
    { giftId: "g2", itemId: "i1", quantity: 1, status: "reserved", reservedUntil: NOW + HOUR, guestName: "Pepe" },
  ];
  const view = ownerListView(list, gifts, NOW);
  assert.equal(view.gifts.length, 1);
  assert.equal(view.gifts[0].guestName, "Tia Marta");
  assert.ok(!JSON.stringify(view).includes("marta@mail.com"));
});

test("giftsToExpire - solo reservas vencidas", () => {
  const gifts = [
    { giftId: "a", status: "reserved", reservedUntil: NOW - 1 },
    { giftId: "b", status: "reserved", reservedUntil: NOW + 1 },
    { giftId: "c", status: "paid", reservedUntil: NOW - 1 },
  ];
  assert.deepEqual(giftsToExpire(gifts, NOW).map((g) => g.giftId), ["a"]);
});

test("listSummary - avance, total vendido y alerta de regalado de mas", () => {
  const gifts = [
    { itemId: "i1", quantity: 2, status: "paid" },
    { itemId: "i2", quantity: 2, status: "paid" },
  ];
  const s = listSummary(list, gifts, NOW);
  assert.equal(s.unitsWanted, 7);
  assert.equal(s.unitsGifted, 4);
  assert.equal(s.totalPaid, 2 * 1000 + 2 * 50000);
  assert.equal(s.overGifted, true);
});

// --- pedido borrador y atribucion -----------------------------------------

const guest = { name: "Marta Gomez", email: "marta@mail.com" };

test("buildDraftOrderPayload - modo A: direccion y contacto a nombre de los novios", () => {
  const body = buildDraftOrderPayload({ list, item: list.items[0], quantity: 2, giftId: "g1", guest });
  assert.equal(body.contact_email, "marta@mail.com");
  assert.equal(body.contact_name, "Sofi y");
  assert.equal(body.contact_lastname, "Juan");
  assert.equal(body.payment_status, "unpaid");
  assert.deepEqual(body.products, [{ variant_id: 1000, quantity: 2, properties: { lista: "sofi-y-juan", regalo: "g1" } }]);
  assert.equal(body.shipping.shipping_address.zipcode, "1425");
  assert.equal(body.shipping.cost, undefined, "el envio lo cotiza el checkout");
  assert.match(body.note, /Regalo de Marta Gomez/);
});

test("buildDraftOrderPayload - modo B: sin direccion, contacto del invitado", () => {
  const body = buildDraftOrderPayload({ list: { ...list, deliveryMode: "store_pickup" }, item: list.items[1], quantity: 1, giftId: "g2", guest });
  assert.equal(body.shipping, undefined);
  assert.equal(body.contact_name, "Marta");
  assert.equal(body.contact_lastname, "Gomez");
});

const candidates = [
  { giftId: "g1", listId: "L1", status: "reserved", draftOrderId: "555", guestEmail: "a@mail.com", productId: "100", createdAt: NOW },
  { giftId: "g2", listId: "L1", status: "expired", draftOrderId: null, guestEmail: "b@mail.com", productId: "200", createdAt: NOW },
  { giftId: "g3", listId: "L2", status: "reserved", draftOrderId: null, guestEmail: "c@mail.com", productId: "300", createdAt: NOW - 100 * HOUR },
  { giftId: "g4", listId: "L1", status: "paid", draftOrderId: "777", guestEmail: "", productId: "100", createdAt: NOW },
];

test("matchOrderToGift - por id del borrador", () => {
  assert.deepEqual(matchOrderToGift({ id: 555, products: [] }, candidates, NOW), [{ giftId: "g1", listId: "L1" }]);
});

test("matchOrderToGift - por properties del carrito (modo C), aunque la reserva haya vencido", () => {
  const order = { id: 9, contact_email: "x@mail.com", products: [{ product_id: 200, properties: { lista: "sofi-y-juan", regalo: "g2" } }] };
  assert.deepEqual(matchOrderToGift(order, candidates, NOW), [{ giftId: "g2", listId: "L1" }]);
});

test("matchOrderToGift - fallback por email + producto dentro de 72 h", () => {
  const order = { id: 9, contact_email: "B@mail.com", products: [{ product_id: 200 }] };
  assert.deepEqual(matchOrderToGift(order, candidates, NOW), [{ giftId: "g2", listId: "L1" }]);
  const viejo = { id: 9, contact_email: "c@mail.com", products: [{ product_id: 300 }] };
  assert.deepEqual(matchOrderToGift(viejo, candidates, NOW), []);
});

test("matchOrderToGift - borrador pagado con otro id: cae al email + producto", () => {
  const order = { id: 999, contact_email: "a@mail.com", products: [{ product_id: 100 }] };
  assert.deepEqual(matchOrderToGift(order, candidates, NOW), [{ giftId: "g1", listId: "L1" }]);
});

test("matchOrderToGift - un gift ya pagado no se vuelve a matchear", () => {
  assert.deepEqual(matchOrderToGift({ id: 777, products: [] }, candidates, NOW), []);
});

// --- panel de novios -------------------------------------------------------

// --- link de edicion ---------------------------------------------------------

test("generateEditKey / bearerKey - formato y lectura del header", () => {
  const key = generateEditKey();
  assert.match(key, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(generateEditKey(), key);
  assert.equal(bearerKey(`Bearer ${key}`), key);
  assert.equal(bearerKey("Bearer corto"), null);
  assert.equal(bearerKey(`Bearer ${key}' OR 1`), null);
  assert.equal(bearerKey(""), null);
});

test("editUrl - sin dominio no hay link", () => {
  assert.equal(editUrl("https://tienda.com", "/lista-de-regalos/", "abc"), "https://tienda.com/lista-de-regalos/#editar=abc");
  assert.equal(editUrl("", "/lista-de-regalos/", "abc"), "");
});

test("editLinkEmail - trae el link y escapa el nombre", () => {
  const mail = editLinkEmail("Tienda", { title: "<b>Sofi</b>" }, { editLink: "https://t.com/l/?editar=k", shareLink: "https://t.com/l/?lista=s" });
  assert.match(mail.html, /\?editar=k/);
  assert.match(mail.html, /\?lista=s/);
  assert.ok(!mail.html.includes("<b>Sofi</b>"));
  assert.match(mail.text, /\?editar=k/);
});

test("sendEditLink - salta owners sin email y no corta si falla un envio", async () => {
  const sent = [];
  const sendEmail = async (m) => {
    if (m.to === "falla@mail.com") throw new Error("SendGrid");
    sent.push(m.to);
  };
  const owners = [{ name: "Sofi", email: "falla@mail.com" }, { name: "Juan", email: "" }];
  assert.equal(await sendEditLink({ sendEmail, storeName: "T", list: { title: "S", owners }, editLink: "x" }), false);
  owners.push({ name: "Leo", email: "leo@mail.com" });
  assert.equal(await sendEditLink({ sendEmail, storeName: "T", list: { title: "S", owners }, editLink: "x" }), true);
  assert.deepEqual(sent, ["leo@mail.com"]);
});

test("publicListView / ownerListView - nunca exponen el link de edicion", () => {
  const withKey = { ...list, editKey: "SECRETO_SECRETO_SECRETO_123" };
  assert.ok(!JSON.stringify(publicListView(withKey, [], NOW)).includes("SECRETO"));
  assert.ok(!JSON.stringify(ownerListView(withKey, [], NOW)).includes("SECRETO"));
});

// --- panel de novios -------------------------------------------------------

test("validateListInput - el email de la pareja es opcional", () => {
  const v = validateListInput({ ...validList, owners: [{ name: "Sofi", email: "sofi@mail.com" }, { name: "Juan", email: "" }] });
  assert.equal(v.ok, true, v.errors.join(" "));
  assert.equal(validateListInput({ ...validList, owners: [{ name: "Sofi", email: "" }] }).ok, false);
  assert.equal(validateListInput({ ...validList, owners: [{ name: "Sofi", email: "sofi@mail.com" }, { name: "Juan", email: "mal" }] }).ok, false);
});

test("mergeListEdit - edita datos y mantiene los owners si no vienen", () => {
  const ok = mergeListEdit(list, { title: "Sofi y Juan 2027", eventDate: "2027-01-10" }, {});
  assert.equal(ok.ok, true);
  assert.equal(ok.value.title, "Sofi y Juan 2027");
  assert.equal(ok.value.owners[0].email, "sofi@mail.com");

  const out = mergeListEdit(list, { owners: [] }, {});
  assert.equal(out.ok, false);
});

test("addItemToList - suma cantidad si la variante ya esta", () => {
  const value = { productId: "100", variantId: "1000", name: "Copa", image: "", price: 1200, quantity: 2 };
  const r = addItemToList(list.items, value, { now: NOW, newId: () => "nuevo" });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].quantity, 8);
  assert.equal(r.items[0].price, 1200);

  const r2 = addItemToList(list.items, { ...value, variantId: "3000" }, { now: NOW, newId: () => "nuevo" });
  assert.equal(r2.items.length, 3);
  assert.equal(r2.item.itemId, "nuevo");
});

test("updateItemQuantity - no baja por debajo de lo regalado o reservado", () => {
  const gifts = [
    { itemId: "i1", quantity: 2, status: "paid" },
    { itemId: "i1", quantity: 1, status: "reserved", reservedUntil: NOW + HOUR },
  ];
  assert.equal(updateItemQuantity(list.items, "i1", 2, gifts, NOW).ok, false);
  assert.equal(updateItemQuantity(list.items, "i1", 3, gifts, NOW).ok, true);
  assert.equal(updateItemQuantity(list.items, "i1", 0, gifts, NOW).ok, false);
  const removed = updateItemQuantity(list.items, "i2", 0, gifts, NOW);
  assert.equal(removed.ok, true);
  assert.equal(removed.items.length, 1);
  assert.equal(updateItemQuantity(list.items, "nope", 1, gifts, NOW).status, 404);
});

test("giftsCsv - solo regalos confirmados y celdas seguras", () => {
  const csv = giftsCsv(list, [
    { itemId: "i1", quantity: 1, status: "paid", guestName: "=HYPERLINK(x)", message: "Felicidades; besos", paidAt: NOW },
    { itemId: "i2", quantity: 1, status: "reserved", guestName: "Nadie" },
  ]);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^'=HYPERLINK\(x\);Copa;1;"Felicidades; besos";2026-10-19$/);
});

test("createRateLimiter - corta al llegar al maximo y libera con el tiempo", () => {
  const allow = createRateLimiter({ max: 2, windowMs: 1000 });
  assert.equal(allow("ip", 0), true);
  assert.equal(allow("ip", 10), true);
  assert.equal(allow("ip", 20), false);
  assert.equal(allow("otra", 20), true);
  assert.equal(allow("ip", 1500), true);
});

// --- invitados -------------------------------------------------------------

test("validateGuestInput - normaliza y valida", () => {
  const ok = validateGuestInput({ itemId: "i1", guestName: " Tía Marta ", guestEmail: "Marta@Mail.com", message: "¡Felicidades!" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { itemId: "i1", guestName: "Tía Marta", guestEmail: "marta@mail.com", message: "¡Felicidades!", quantity: 1 });
  const bad = validateGuestInput({ guestName: "M", guestEmail: "x", quantity: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
});

test("isCoverImageUrl - solo portadas del modulo en Storage", () => {
  assert.equal(isCoverImageUrl("https://storage.googleapis.com/pedidos-lett-2.appspot.com/gift-registry/6854698/1-foto.webp"), true);
  assert.equal(isCoverImageUrl("https://storage.googleapis.com/pedidos-lett-2.appspot.com/images/6854698/1-foto.webp"), false);
  assert.equal(isCoverImageUrl("http://storage.googleapis.com/b/gift-registry/1/x.webp"), false);
  assert.equal(isCoverImageUrl("https://evil.com/b/gift-registry/1/x.webp"), false);
  assert.equal(isCoverImageUrl("https://storage.googleapis.com/b/gift-registry/"), false);
  assert.equal(isCoverImageUrl("no es url"), false);
});
