# Lista de Regalos — Spec de diseño
**Fecha:** 2026-10-19
**Estado:** Fase 0 validada (2026-10-19). Listo para planificar la implementación.
**Alcance:** piloto en Alto Rancho + tienda demo (allowlist, igual que Grupos de Variantes). Después se libera a todas las tiendas como módulo pago.

---

## Resumen

Los novios (o cualquier evento: baby shower, cumpleaños, mudanza) arman una
lista de productos de la tienda y la comparten por link, QR o placas listas
para WhatsApp/invitación. Los invitados ven qué falta y qué ya se regaló,
eligen un regalo y lo pagan directo en la tienda. Los novios ven en su panel
quién les regaló qué, con el mensaje de cada uno.

La lista vive **dentro del dominio de la tienda** (página `/lista-de-regalos/`
+ nuestro script), así el pago es el checkout de siempre de Tiendanube.

## Decisiones tomadas (con el cliente, 2026-10-19)

| Tema | Decisión |
|---|---|
| Quién arma la lista | Los novios desde un panel web **y** el comercio desde el admin (cuando van al local). |
| Entrega | La eligen los novios al crear la lista, entre 3 modos (ver abajo). |
| Aporte en dinero | **No.** La gift card es un producto más que se puede sumar a la lista. |
| Cambios y devoluciones | Políticas habituales de la tienda; la lista no da crédito. |
| Alcance | Primero Alto Rancho; después general. |

## Modos de entrega

| Modo | Qué ve el invitado | Cómo se compra | Cómo sabemos que se regaló |
|---|---|---|---|
| **A. Envío a casa de los novios** | "Se envía a los novios" | **Pedido borrador** (Draft Orders API) con la dirección de los novios ya cargada → el invitado paga en el `checkout_url` | El pedido borrador es nuestro: sabemos exactamente qué regalo es |
| **B. La tienda los junta y entrega** | "Se retira en el local / lo entrega la tienda" | Pedido borrador; el invitado elige el retiro en local nativo (gratis) | Igual que A |
| **C. El invitado elige** | Checkout normal (envío o retiro a elección) | Carrito normal | Reserva + webhook `order/paid` (ver "Atribución") |

Por qué pedidos borrador en A y B: el checkout normal de Tiendanube **no deja
que una app precargue la dirección**. Con el pedido borrador la dirección de los
novios llega precargada al checkout estándar, que **cotiza los envíos reales**
a ese CP y ofrece los retiros en local (validado en Alto Rancho). No hay costo
de envío fijo: el invitado paga el envío real como en cualquier compra.

## Fase 0 — Validación técnica (antes de construir)

En la tienda demo, verificar:

1. **Pago de un pedido borrador**: crear uno por API, abrir `checkout_url` como
   invitado y confirmar qué medios de pago ofrece, si el invitado puede cargar
   sus datos de contacto y si al pagar el borrador pasa solo a pedido.
2. **Webhook**: que `order/paid` llegue para un pedido que nació como borrador y
   con qué id (el doc indica que el pedido conserva el id del borrador).
3. **Modo C**: si las `properties` de un ítem agregado con `POST /comprar/`
   llegan al pedido (atribución exacta). Si no llegan, se usa la reserva.
4. **Página de la tienda**: crear `/lista-de-regalos/` por API (permiso
   Contents) o, si no se puede, que el comercio la cree a mano una vez.

Si el punto 1 falla (ej. el borrador no se puede pagar online), los modos A y B
pasan a usar el carrito normal con retiro en local / envío a cargo del
invitado y se avisa al cliente antes de seguir.

## Actores y pantallas

### Novios (en la tienda, `/lista-de-regalos/`)
- **Entrar sin contraseña**: ponen su email y reciben un código de 6 dígitos
  (SendGrid, ya integrado). La sesión queda en el navegador.
- **Crear lista**: tipo de evento, nombres, fecha, foto de portada, mensaje,
  modo de entrega y (modo A) dirección. Puede haber 2 emails dueños (los dos novios).
- **Agregar productos**: botón **"Agregar a mi lista"** en la ficha de producto
  (solo aparece con sesión de novios), con cantidad. Si el producto es de un
  grupo de color (Grupos de Variantes), eligen el color ahí mismo.
- **Panel**: ítems con avance ("3 de 12 copas"), regalos recibidos con nombre y
  mensaje del invitado, exportar a CSV para los agradecimientos, editar
  datos, cerrar la lista.
- **Compartir**: link corto (`/lista-de-regalos/?l=sofi-y-juan`), QR en PNG
  y 2 placas (historia de Instagram y tarjeta para imprimir), generadas
  con la foto y los nombres en la estética de la tienda.

### Invitados (`/lista-de-regalos/?l=slug`)
- Portada con nombres, fecha, mensaje y foto.
- Grilla de regalos: **disponibles** primero, **ya regalados** al final y atenuados.
  No se muestra quién regaló.
- "Lo regalo yo" → nombre, email, mensaje y cantidad (si el ítem es de varias
  unidades) → se **reserva** y va a pagar (borrador en A/B, carrito en C).
- Buscar una lista por nombre de los novios (solo listas marcadas como públicas).

### Comercio (admin PromoNube)
- Activar módulo, textos, modos de entrega permitidos y horas de reserva.
- Listado de listas con estado, fecha del evento y total vendido.
- Crear una lista por los novios (les llega el email para entrar).
- Detalle de una lista: regalos, **marcar a mano** un regalo como pagado
  (ej. pagó en el local) y, en modo B, "pendientes de entrega".

## Atribución y reservas

- Al tocar "Lo regalo yo" se crea un `gift` en estado `reserved` que **descuenta
  disponibilidad** durante N horas (default 2, configurable). Así dos invitados
  no compran lo mismo.
- **A/B**: el `gift` guarda el id del pedido borrador. Con `order/paid` de ese
  id → `paid`.
- **C**: con `order/paid`, se busca un `gift` reservado del mismo email del
  comprador que incluya ese producto → `paid`. Si se confirma lo del punto 3
  de la Fase 0, se usan las `properties` del ítem en vez del email.
- Reserva vencida sin pago → `expired` y vuelve a estar disponible. El borrador
  impago se borra (`DELETE /draft_orders/{id}`).
- Si un invitado paga después de vencida la reserva, igual se registra (puede
  quedar un ítem "regalado de más": se muestra al comercio para que lo resuelva
  con su política de cambios).

## Datos (Firestore)

- `promonube_gift_registry_config/{storeId}`: settings del comercio.
- `promonube_gift_registries/{listId}`: `storeId`, `slug` (único por tienda),
  `owners[] {name, email}`, `eventType`, `eventDate`, `title`, `message`,
  `coverImage`, `deliveryMode` (`couple_address` | `store_pickup` |
  `guest_choice`), `address`, `public`, `status` (`active` | `closed`),
  `items[] {itemId, productId, variantId, name, image, price, quantity}`.
- `promonube_gift_registries/{listId}/gifts/{giftId}`: `itemId`, `quantity`,
  `guestName`, `guestEmail`, `message`, `status` (`reserved` | `paid` |
  `expired` | `manual`), `draftOrderId`, `orderId`, `reservedUntil`, `createdAt`.
- Disponibilidad de un ítem = `quantity` − regalos `paid`/`manual` − reservas vigentes.

## Backend

Módulo `functions/gift-registry.js` (mismo patrón que `combos.js`): rutas del
admin, rutas públicas del storefront (con rate limit: login por código y
reservas), envío de códigos por SendGrid, creación de pedidos borrador y un
hook en el webhook de pedidos existente (`/api/webhooks/order`) para marcar
pagos. Un cron (o barrido perezoso al leer la lista) vence reservas.

**Script en Partners:** como módulo general necesita su propio script
registrado en Partners (lo sube el dueño de la app, igual que el de Grupos de
Variantes #10101). Durante el piloto se puede cargar desde el script ya
instalado, como Combos.

## Fuera de alcance (v1)

- Aportes en dinero / "luna de miel".
- Crédito o cambios gestionados por la lista.
- Precio congelado: el invitado paga el precio vigente del producto.
- Multi-idioma.

## Plan por etapas

0. Validación técnica en la demo (arriba).
1. Backend + datos + admin del comercio (crear listas desde el local).
2. Panel de novios en la tienda + botón "Agregar a mi lista" en la ficha.
3. Página del invitado + reservas + pedidos borrador + webhook.
4. Compartir: QR y placas.

## Riesgos

- Pago de pedidos borrador desde el storefront (Fase 0, punto 1): es lo que
  sostiene los modos A y B.
- En el checkout del borrador el invitado puede cambiar la dirección precargada.
  Se avisa en la página de la lista y el comercio ve la dirección en el pedido.
- Stock: una reserva no bloquea stock en Tiendanube; si se agota antes de que
  el invitado pague, el checkout lo rechaza como siempre.

## Resultados Fase 0 (2026-10-19, tienda demo 6854698)

- **Crear borrador**: OK (`POST /v1/{store}/draft_orders` → 201). Devuelve
  `checkout_url` y acepta `properties` por producto.
- **Checkout del borrador**: abre el checkout v3 normal **directo en el paso
  Pago**, con email del invitado y dirección de los novios precargados. El
  envío figura como "Nos comunicaremos para coordinar la entrega · Gratis" y el
  ítem muestra las `properties` (ej. "lista: sofi-y-juan").
  Ojo: el invitado puede tocar "Cambiar" en dirección y envío.
- **Medios de pago**: en el borrador solo aparece "A convenir". **No concluyente**:
  la demo no tiene medios de pago ni envíos reales configurados (el checkout
  normal también muestra solo "coordinar la entrega"). Hay que repetir en una
  tienda con Mercado Pago / Pago Nube (Alto Rancho).
- **Modo C**: las `properties` mandadas en `POST /comprar/` llegan al checkout
  normal (se ven en el resumen) aunque la respuesta JSON no las devuelva.
  Falta confirmar que llegan al pedido / webhook.
- **Borrar borrador**: `DELETE` lo deja en `status: cancelled` pero sigue con
  `checkout_enabled: true`. Hay que verificar que un borrador cancelado no se
  pueda pagar antes de usar DELETE para vencer reservas.
- La app **no** tiene el permiso `read_payments` (no podemos listar medios de pago por API).

### Repetición en Alto Rancho (2026-10-19, borrador #2098267155, cancelado)

- El checkout del borrador es el **checkout normal completo** (Datos → Entrega → Pago),
  no un flujo reducido: muestra la dirección de los novios como opción
  seleccionable y **cotiza los envíos reales** a ese CP (Envío Nube, Andreani,
  Cabify, etc.) **y los retiros en local gratis** (Belgrano, San Isidro).
  → Modo A no necesita costo de envío fijo: el invitado paga el envío real.
  → Modo B puede ser "retiro en local" nativo.
- Para llegar a Pago el checkout pide teléfono y DNI/CUIT del destinatario
  (facturación). No se cargaron en la tienda real, así que **no se vio la
  pantalla de medios de pago**. La tienda tiene Pago Nube y Mercado Pago
  (tarjetas, transferencia, billetera, ticket); al ser el checkout estándar es
  muy probable que aparezcan, pero falta verlo (o confirmarlo con la primera
  compra real del piloto).
- **Borrador cancelado (DELETE)**: el `checkout_url` pasa a dar 404 → no se
  puede pagar. Sirve para vencer reservas.
- Ojo: el destinatario sale como "Invitado Prueba" (el contacto del borrador).
  En modo A conviene que el contacto sea el invitado (factura) y mandar los
  nombres de los novios como destinatario si la API lo permite; si no, va en la nota.

### Confirmación de pago (2026-10-19, borrador #2098269625, cancelado)

El dueño abrió el link del borrador: dirección precargada, elección de envío y
**paso de Pago con los medios de pago normales**, todo OK. Validación cerrada.
