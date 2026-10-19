# Lista de Regalos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los novios (o cualquier evento) armen una lista de regalos con productos de la tienda, la compartan por link/QR/placas, y que los invitados la vean, reserven un regalo y lo paguen en el checkout normal de Tiendanube, con el regalo marcado como "regalado" automáticamente al pagarse.

**Architecture:** Módulo backend aislado (`functions/gift-registry.js` + `functions/gift-registry-widget.js`) con colecciones Firestore propias, registrado en `functions/index.js` igual que `combos.js`. Toda la lógica de negocio (disponibilidad, reservas, armado del pedido borrador, atribución de pedidos) son funciones puras testeadas con `node:test`. El storefront es un único script (`/api/gift-registry-widget.js`) que monta 3 vistas en el dominio de la tienda: panel de novios, página del invitado y botón "Agregar a mi lista" en la ficha. Modos A/B pagan con **pedidos borrador** (Draft Orders API → `checkout_url`), modo C con el carrito normal + `properties`. Los pagos se detectan con un webhook `order/paid` propio apuntando a Railway.

**Tech Stack:** Node 22 + Express 4 (CommonJS) en Railway · Firestore (`firebase-admin`) · SendGrid (`@sendgrid/mail`, ya inicializado en `index.js`) · React 19 + Vite (admin) · `node:test` · API Tiendanube v1 (`Authentication: bearer`).

**Spec:** `docs/superpowers/specs/2026-10-19-lista-de-regalos-design.md` (incluye resultados de la Fase 0).

## Global Constraints

- **Allowlist (piloto):** `['2547699', '5320806', '6854698']`, igual que Grupos de Variantes y Combos. Se chequea en cada endpoint (403) y en el frontend (menú + guard). `// TODO: quitar allowlist cuando se libere a todas las tiendas`.
- **Base URL backend:** `https://glowlab-production.up.railway.app`.
- **Tiendanube:** v1 con `Authentication: bearer <token>` y `User-Agent: GlowLab (info@techdi.com.ar)` en todas las llamadas. Token en `promonube_stores/{storeId}.accessToken`.
- **Pedidos borrador (validado en Fase 0):** `POST /v1/{store}/draft_orders` → `checkout_url`. `DELETE /v1/{store}/draft_orders/{id}` lo deja `cancelled` y el link da 404. El checkout del borrador cotiza envíos reales y ofrece retiro en local.
- **Webhook propio:** `order/paid` → `https://glowlab-production.up.railway.app/api/gr/order-webhook`. **No** se tocan los webhooks existentes (`/api/webhooks/order` en Cloud Run, maneja gift cards).
- **Privacidad:** la vista pública nunca expone emails de los novios ni quién regaló qué. El panel de los novios sí ve nombre + mensaje del invitado (no su email).
- **Sesión de novios:** login por código de 6 dígitos al email (vence en 10 min, máx 5 intentos, máx 5 envíos por hora por email). Token opaco de 32 bytes; en Firestore se guarda solo su SHA-256. Vence a los 30 días.
- **Sin branding** en el storefront (ni "PromoNube" ni "GlowLab").
- **Estilo storefront:** hereda la tipografía del theme (`font-family: inherit`), colores neutros como la card de Combos (`#353434`, bordes `#e7e2db`, fondo `#f3efe9` para chips).
- **Respuestas JSON:** `{ success: true, ... }` / `{ success: false, message }`.
- **Tests:** `cd functions && node --test gift-registry.test.js`. El front se verifica a mano (no hay runner de componentes).
- **Commits:** uno por tarea, en español, `feat:`/`test:`/`fix:`, en `main`. Terminar con:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `functions/gift-registry.js` | **Crear.** Constantes, funciones puras, cliente Tiendanube (borradores, pedidos, webhooks), auth por código, rutas admin + storefront + webhook, sweeper de reservas. |
| `functions/gift-registry-widget.js` | **Crear.** `buildStorefrontScript(store, cfg)`: el JS del storefront (3 vistas). Separado por tamaño. |
| `functions/gift-registry.test.js` | **Crear.** Tests de todas las funciones puras. |
| `functions/index.js` | **Modificar.** Registrar rutas inyectando `{ db, FieldValue, checkStoreActive, sendEmail }`. `sendEmail` es un wrapper sobre `sgMail.send` ya inicializado. |
| `functions/variant-groups.js` | **Modificar.** Durante el piloto, el loader del widget de lista se agrega al script de Grupos de Variantes (mismo mecanismo que Combos: `isGiftRegistryEnabled` + `buildLoaderSnippet`). |
| `src/pages/GiftRegistryConfig.jsx` + `.css` | **Crear.** Admin del comercio: configuración, listado de listas, detalle, crear lista para los novios, marcar pago manual. |
| `src/App.jsx` / `src/components/Sidebar.jsx` | **Modificar.** Ruta `/lista-regalos` + ítem exclusivo "Lista de Regalos" (ícono `Gift`). |

## Modelo de datos

```
promonube_gift_registry_config/{storeId}
  enabled: bool
  allowedModes: ['couple_address','store_pickup','guest_choice']
  reservationHours: number (default 2, 1..48)
  pagePath: string (default '/lista-de-regalos/')
  texts: { title, intro }               // opcionales
  webhookId: number|null                 // id del webhook order/paid propio
  updatedAt

promonube_gift_registries/{listId}       // listId = auto id
  storeId, slug (único por tienda), status: 'active'|'closed'
  eventType: 'wedding'|'baby'|'birthday'|'housewarming'|'other'
  title (ej. "Sofi y Juan"), eventDate (YYYY-MM-DD), message, coverImage
  owners: [{ name, email }]  (1..2, email en minúscula)
  deliveryMode: 'couple_address'|'store_pickup'|'guest_choice'
  address: { address, number, floor, locality, city, province, zipcode } | null
  public: bool (aparece en el buscador)
  items: [{ itemId, productId, variantId, name, image, price, quantity, addedAt }]
  createdBy: 'couple'|'store', createdAt, updatedAt

promonube_gift_registries/{listId}/gifts/{giftId}
  itemId, quantity, guestName, guestEmail, message
  status: 'reserved'|'paid'|'expired'|'manual'
  draftOrderId|null, orderId|null, reservedUntil (ms), createdAt, paidAt|null

promonube_gift_registry_otps/{storeId}_{sha256(email)}
  codeHash, expiresAt, attempts, sends: [ms timestamps de la última hora]

promonube_gift_registry_sessions/{sha256(token)}
  storeId, email, expiresAt
```

Disponibilidad de un ítem = `quantity` − Σ(`paid` + `manual`) − Σ(`reserved` con `reservedUntil > now`).

---

## Etapa 1 — Base, lógica pura y admin del comercio

### Task 1: Funciones puras de la lista

**Files:** Create `functions/gift-registry.js` (solo la sección pura + exports), `functions/gift-registry.test.js`.

- [ ] `slugify(text)`: minúsculas, sin acentos, `[a-z0-9-]`, guiones simples, máx 40 chars. Test: `"Sofi & Juan Pérez"` → `"sofi-juan-perez"`.
- [ ] `uniqueSlug(base, existingSlugs)`: `base`, `base-2`, `base-3`…
- [ ] `validateListInput(input, { allowedModes })` → `{ ok, errors[], value }`. Reglas: `title` 2..80; `eventDate` ISO válida; `owners` 1..2 con email válido (minúscula); `deliveryMode` ∈ allowedModes; `address` obligatoria si `couple_address` (calle, número, ciudad, provincia, CP); `message` ≤ 500; `coverImage` URL https o vacía. Tests por cada regla.
- [ ] `validateItemInput(input)`: `productId`/`variantId` numéricos como string, `quantity` entero 1..100, `name` ≤ 200, `price` ≥ 0.
- [ ] `itemAvailability(item, gifts, now)` → `{ wanted, gifted, reserved, available }`. Tests: reservas vencidas no cuentan; `manual` cuenta como regalado; `available` nunca < 0.
- [ ] `publicListView(list, gifts, now)`: devuelve `title, eventType, eventDate, message, coverImage, deliveryMode, slug, items[] { itemId, productId, variantId, name, image, price, quantity, gifted, available }`, con disponibles primero y regalados al final. **Test explícito: el JSON no contiene `owners`, `guestName`, `guestEmail` ni `address`.**
- [ ] `ownerListView(list, gifts, now)`: todo lo de la lista + `gifts[] { itemId, quantity, guestName, message, status, paidAt }` (sin `guestEmail`).
- [ ] `giftsToExpire(gifts, now)` → gifts `reserved` con `reservedUntil <= now`.
- [ ] Commit `feat(lista-regalos): logica pura de listas, disponibilidad y vistas`.

### Task 2: Funciones puras de compra y atribución

- [ ] `buildDraftOrderPayload({ list, item, quantity, guest })` → body de `POST /draft_orders`:
  - `contact_email` = email del invitado (recibe el comprobante).
  - `contact_name`/`contact_lastname` = **nombres de los novios** en modo A (así el destinatario del envío sale a nombre de ellos; la Fase 0 mostró que el destinatario es el contacto). En modo B, los del invitado.
  - `payment_status: 'unpaid'`, `products: [{ variant_id, quantity, properties: { lista: slug, regalo: giftId } }]`.
  - `note`: `"Lista de regalos: {title} ({slug}) · Regalo de {guestName}"` + en modo A `"· Entregar a {title}"`.
  - Modo A: `shipping.shipping_address` = dirección de la lista, sin `cost` (lo cotiza el checkout).
  - Tests: modo A con dirección, modo B sin dirección, properties siempre presentes.
- [ ] `matchOrderToGift(order, candidates)`: candidatos = gifts `reserved`/`expired` de listas de la tienda.
  1. Por `draftOrderId === order.id` (modos A/B; el pedido conserva el id del borrador).
  2. Por `properties.regalo` en `order.products[]` (modo C).
  3. Fallback: mismo `guestEmail` que `order.contact_email` + mismo `productId`, reservado en las últimas 72 h.
  Devuelve `[{ giftId, listId }]`. Tests de los 3 caminos y de "no matchea".
- [ ] Commit `feat(lista-regalos): armado de pedido borrador y atribucion de pedidos`.

### Task 3: Auth de novios por código (puro + Firestore)

- [ ] Puras: `generateCode()` (6 dígitos con `crypto.randomInt`), `sha256(s)`, `generateToken()` (`crypto.randomBytes(32).toString('base64url')`), `canSendCode(sends, now)` (máx 5 en 60 min). Tests.
- [ ] `requestCode({ db, storeId, email, sendEmail })`: valida email, rate limit, guarda `codeHash` + `expiresAt` (10 min) + `attempts: 0`, manda el mail (asunto "Tu código para tu lista de regalos", cuerpo simple con el código y el nombre de la tienda). **Siempre responde igual** exista o no una lista (no filtra qué emails tienen lista).
- [ ] `verifyCode({ db, storeId, email, code })`: máx 5 intentos, compara hash, crea sesión (30 días), borra el OTP. Devuelve `{ token }`.
- [ ] `getSession(db, storeId, bearer)` → `{ email }` o null.
- [ ] Commit `feat(lista-regalos): login de novios por codigo al email`.

### Task 4: Rutas del admin del comercio

Todas con guard de allowlist y `storeId`:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/gift-registry/config?storeId` | Config + estado del webhook |
| POST | `/api/gift-registry/config` | Guardar config. Si `enabled` y no hay `webhookId` → registra `order/paid` (`POST /v1/{store}/webhooks`) y guarda el id |
| GET | `/api/gift-registry/lists?storeId` | Listas con `title, slug, eventDate, status, deliveryMode, itemsCount, giftedCount, totalPaid` |
| GET | `/api/gift-registry/lists/:id?storeId` | `ownerListView` + email de los novios + gifts con `guestEmail` (el comercio sí lo ve) |
| POST | `/api/gift-registry/lists` | Crear lista para los novios (`createdBy: 'store'`) y mandarles mail de invitación con el link al panel |
| POST | `/api/gift-registry/lists/:id/status` | Cerrar / reabrir |
| POST | `/api/gift-registry/gifts/:giftId/manual` | Marcar regalo pagado a mano (`{ listId, itemId, quantity, guestName, message }` crea un gift `manual`) |

- [ ] Implementar + registrar en `index.js` con `sendEmail` inyectado.
- [ ] Test manual con curl contra el server local (`node index.js` con credenciales locales) en la tienda demo.
- [ ] Commit `feat(lista-regalos): rutas del admin`.

### Task 5: Admin — página `GiftRegistryConfig`

- [ ] Ruta `/lista-regalos`, ítem "Lista de Regalos" (`Gift`) en `STORE_EXCLUSIVE_ITEMS` de las 3 tiendas, guard de allowlist (molde `CombosConfig.jsx`).
- [ ] Sección **General**: activar, modos permitidos (3 checkboxes), horas de reserva, ruta de la página (`/lista-de-regalos/`) con instrucción "Creá en Tiendanube una página con esa URL (Contenidos → Páginas) y dejala vacía".
- [ ] Sección **Listas**: tabla (nombre, fecha del evento, modo, avance "8/20", total vendido, estado) con buscador y orden por fecha del evento.
- [ ] **Detalle** (panel lateral): ítems con avance, regalos (invitado, email, mensaje, estado, pedido), botón "Marcar como regalado" por ítem, cerrar/reabrir lista, link público para copiar.
- [ ] **Crear lista para los novios**: formulario (nombres, emails, evento, fecha, modo, dirección si A) → crea y manda la invitación.
- [ ] Verificar lint + `vite build` + a mano en el dev server.
- [ ] Commit `feat(lista-regalos): admin del comercio`.

## Etapa 2 — Panel de los novios en la tienda

### Task 6: Rutas de los novios (storefront)

Base `/api/gr/*`, CORS ya abierto (`cors({ origin: true })`). Auth con `Authorization: Bearer <token>` salvo login.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/gr/auth/request-code` | `{ store, email }` |
| POST | `/api/gr/auth/verify` | `{ store, email, code }` → `{ token }` |
| GET | `/api/gr/me?store` | Listas donde el email es owner (`ownerListView`) |
| POST | `/api/gr/lists` | Crear (`createdBy: 'couple'`, owner[0] = email de la sesión) |
| PATCH | `/api/gr/lists/:id` | Editar datos (solo owners) |
| POST | `/api/gr/lists/:id/items` | Agregar ítem (si el `variantId` ya está, suma cantidad) |
| PATCH / DELETE | `/api/gr/lists/:id/items/:itemId` | Cambiar cantidad / quitar (no se puede bajar por debajo de lo ya regalado) |
| GET | `/api/gr/lists/:id/export.csv` | Regalos para agradecer: invitado, regalo, cantidad, mensaje, fecha |

- [ ] Rate limit simple en memoria por IP para `/auth/*` (20/10 min).
- [ ] Tests de las reglas de negocio nuevas (no bajar cantidad por debajo de regalado; solo owners editan) como funciones puras.
- [ ] Commit `feat(lista-regalos): rutas del panel de novios`.

### Task 7: Widget storefront — esqueleto, router y login

`functions/gift-registry-widget.js` → `buildStorefrontScript(store, cfg)`; ruta `GET /api/gift-registry-widget.js?store` (cache 60 s, "deshabilitado" si no está activo).

- [ ] Router por URL: si `location.pathname === cfg.pagePath` **o** hay `?lista=` en cualquier página → monta la app de la lista (en la página vacía de Tiendanube, dentro del contenedor principal del theme; si se usa `?lista=` en otra página, monta un overlay a pantalla completa). En la ficha de producto (`LS.product`) → botón "Agregar a mi lista".
- [ ] Vistas dentro de la página: `?lista=slug` → invitado; sin `lista` → home (crear / ingresar / buscar una lista); `?panel` → panel de novios.
- [ ] Login: email → código → guarda token en `localStorage` (`pn_gr_token_{store}`) con try/catch.
- [ ] Estilos con prefijo `.pn-gr-` y `!important` como los otros widgets; heredar fuente del theme.
- [ ] Verificación: inyectar en la ficha/página de la demo como se hizo con Combos y probar login real con un email propio.
- [ ] Commit `feat(lista-regalos): widget storefront base y login`.

### Task 8: Panel de novios — crear y editar lista

- [ ] Formulario de creación: tipo de evento, título, fecha, mensaje, foto (subida con el endpoint existente `/api/upload-image-base64`), modo de entrega (solo los permitidos) con explicación de cada uno, dirección si A, "aparecer en el buscador".
- [ ] Panel: portada, ítems con avance y controles de cantidad/quitar, regalos recibidos (nombre + mensaje), exportar CSV, botón "Compartir" (Etapa 4) y "Seguir agregando productos" (link a la tienda).
- [ ] Commit `feat(lista-regalos): panel de novios`.

### Task 9: Botón "Agregar a mi lista" en la ficha

- [ ] Solo con sesión activa y lista `active`. Se ubica debajo del botón de compra.
- [ ] Toma `LS.product.id`, la variante seleccionada (`LS.variants` + selects del form), nombre, imagen y precio. Cantidad con stepper.
- [ ] Si los novios tienen más de una lista, elegir a cuál.
- [ ] Feedback: "Agregado a tu lista · Ver mi lista".
- [ ] Commit `feat(lista-regalos): boton agregar a mi lista en la ficha`.

## Etapa 3 — Invitados, compra y atribución

### Task 10: Rutas públicas del invitado

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/gr/public/:slug?store` | `publicListView` (404 si no existe o está cerrada) |
| GET | `/api/gr/search?store&q` | Listas `public: true` y `active` por título (máx 10) |
| POST | `/api/gr/public/:slug/reserve` | `{ store, itemId, quantity, guestName, guestEmail, message }` |

`reserve` en una **transacción** de Firestore: recalcula disponibilidad, crea el gift `reserved` con `reservedUntil = now + reservationHours`. Luego:
- Modos A/B: crea el borrador (`buildDraftOrderPayload`), guarda `draftOrderId`, responde `{ mode: 'draft', checkoutUrl }`. Si Tiendanube falla → el gift pasa a `expired` y se responde error.
- Modo C: responde `{ mode: 'cart', giftId, productId, variantId, quantity }`.

- [ ] Rate limit por IP (10 reservas / 10 min).
- [ ] Commit `feat(lista-regalos): rutas publicas y reservas`.

### Task 11: Página del invitado

- [ ] Portada (foto, título, fecha, mensaje), aviso del modo de entrega:
  - A: "El regalo se envía a {title}. En el checkout no cambies la dirección de entrega; en facturación podés cargar tus datos."
  - B: "Elegí retiro en el local al pagar."
  - C: "Elegí cómo recibirlo al pagar."
- [ ] Grilla de regalos (disponibles primero; regalados atenuados con "¡Ya lo regalaron!"), precio vigente, cantidad disponible.
- [ ] "Lo regalo yo" → modal (nombre, email, mensaje, cantidad si > 1) → `reserve` → A/B: `location.href = checkoutUrl`; C: `POST /comprar/` con `properties[lista]` y `properties[regalo]` → `/comprar/`.
- [ ] Buscador de listas en el home.
- [ ] Commit `feat(lista-regalos): pagina del invitado`.

### Task 12: Webhook de pago y sweeper de reservas

- [ ] `POST /api/gr/order-webhook`: responde 200 al instante; en background trae el pedido (`GET /v1/{store}/orders/{id}`), si `payment_status === 'paid'` busca candidatos de esa tienda y aplica `matchOrderToGift` → gifts `paid` con `orderId` y `paidAt`. Idempotente (si ya está `paid`, no hace nada).
- [ ] Sweeper (`setInterval` cada 10 min, arranca con el server): gifts `reserved` vencidos → `expired`; si tienen `draftOrderId`, `DELETE` del borrador (best effort, loguea errores).
- [ ] Si llega un pago de un gift `expired`, igual se marca `paid` (puede dejar un ítem regalado de más: el admin lo muestra con una alerta).
- [ ] Commit `feat(lista-regalos): webhook de pago y vencimiento de reservas`.

## Etapa 4 — Compartir

### Task 13: Link, QR y placas

- [ ] Link: `{storeUrl}{pagePath}?lista={slug}` con botón copiar y "Compartir por WhatsApp" (`https://wa.me/?text=`).
- [ ] QR: generado en el navegador con `qrcode` desde cdnjs (versión fija), descargable en PNG.
- [ ] Placas (canvas en el navegador, descarga PNG): **Historia** 1080×1920 y **Tarjeta** 1200×1800 (para imprimir), con foto, título, fecha, QR y link corto, en la estética de la tienda (fondo claro, tipografía del theme si está cargada, si no sans-serif).
- [ ] Commit `feat(lista-regalos): compartir con link, QR y placas`.

## Cierre del piloto

### Task 14: Loader e instalación en la tienda

- [ ] `isGiftRegistryEnabled` + `buildLoaderSnippet` y engancharlo en el script de Grupos de Variantes (igual que Combos).
- [ ] En Alto Rancho: crear la página vacía `/lista-de-regalos/` (lo hace el comercio) y activar el módulo desde el admin (registra el webhook).
- [ ] Commit `feat(lista-regalos): carga desde el script instalado`.

## QA manual end-to-end (demo primero, después Alto Rancho)

1. Comercio crea una lista modo A para un email propio → llega la invitación.
2. Novios entran con código, editan la lista, agregan 3 productos desde la ficha (uno con cantidad 6).
3. Invitado abre el link en otro navegador → ve los 3 ítems → "Lo regalo yo" en uno → llega al checkout con la dirección de los novios y el destinatario a nombre de ellos.
4. Pagar un ítem barato (lo hace el dueño) → el webhook lo marca regalado → el invitado lo ve atenuado y el panel muestra nombre + mensaje.
5. Reservar sin pagar → pasado el tiempo de reserva vuelve a estar disponible y el link del borrador da 404.
6. Modo C con carrito normal → el pedido trae `properties` y se atribuye.
7. Marcar un regalo a mano desde el admin.
8. Exportar CSV, descargar QR y placas.
9. Revisar en mobile (375 px) las 3 vistas.

## Pendientes explícitos (no bloquean)

- Script propio en Partners cuando se libere a todas las tiendas (hoy se carga desde Grupos de Variantes).
- Plan pago / gateo por suscripción al salir del piloto.
- Recordatorios por mail a los novios (ej. "te regalaron X").
