# Sacar Cupones (manual) y Gift Cards — Spec de diseño
**Fecha:** 2026-08-07
**Estado:** Aprobado para implementación

---

## Resumen

Primera de tres iniciativas para relanzar PromoNube (simplificar módulos → mejorar diseño → vender bien en el catálogo de TiendaNube). Esta etapa saca la gestión manual de **Cupones** y todo **Gift Cards** de la app, más una limpieza gratis de una feature muerta ("Promotions") encontrada en el camino.

**Hallazgo clave que determina el alcance:** Cupones no es una feature aislada. La **Ruleta de Premios** crea cupones reales de TiendaNube como mecanismo de entrega de premios, y dos Cloud Functions programadas (`cleanupExpiredCoupons`, `recomputeWheelStats`, ambas en `functions/index.js` ~línea 18055) dependen de esa infraestructura para funcionar. Por eso esta etapa saca **solo la pantalla de gestión manual de cupones** (crear/listar/editar/analytics a mano) — la creación y el tracking de cupones que hace la Ruleta internamente queda intacta, sin cambios.

Gift Cards, en cambio, sí se saca por completo: existen dos generaciones de código (v1 y v2) y parte de v1 ya está huérfana en la práctica (páginas que ningún flujo de la UI actual enlaza, solo alcanzables tipeando la URL a mano) — se borran ambas versiones enteras.

---

## Alcance — Frontend

### Cupones (gestión manual)
Borrar:
- `src/pages/CreateCoupon.jsx`
- `src/pages/CouponsList.jsx`
- `src/pages/CouponAnalytics.jsx`
- `src/components/CouponUsageModal.jsx`

Quitar de `src/App.jsx`: rutas `/create-coupon`, `/coupons`, `/coupon-analytics/:couponId` y sus imports.
Quitar de `src/components/Sidebar.jsx`: la entrada "Cupones".
Quitar de `src/pages/Dashboard.jsx`: la tarjeta "Cupones" del array `mainFeatures`.

### Gift Cards (completo — v1 y v2, vivo y huérfano)
Borrar:
- `src/pages/GiftCardV2.jsx` (la única página de gift cards realmente alcanzable desde la navegación)
- `src/pages/GiftCardDetail.jsx`, `src/pages/CreateGiftCard.jsx`, `src/pages/GiftCardTemplates.jsx` (rutas registradas pero sin ningún link real hacia ellas en la UI actual — igual se borran, no solo se dejan huérfanas)
- `src/pages/GiftCardsMain.jsx`, `src/pages/GiftCardsList.jsx`, `src/pages/GiftCardProducts.jsx`, `src/pages/SoldGiftCards.jsx`, `src/pages/UseGiftCard.jsx` (ya huérfanos hoy, ni siquiera están importados en `App.jsx`)

Quitar de `src/App.jsx`: rutas `/gift-cards`, `/gift-card/:giftCardId`, `/create-gift-card`, `/gift-card-templates` y sus imports.
Quitar de `src/components/Sidebar.jsx`: la entrada "Gift Cards".
Quitar de `src/pages/Dashboard.jsx`: la tarjeta "Gift Cards" del array `mainFeatures`.

### Bonus — "Promotions" (muerta, sin ruta, sin relación con Cupones)
Borrar:
- `src/pages/CreatePromotion.jsx`
- `src/pages/PromotionsList.jsx`

Ninguna de las dos está importada en `App.jsx` hoy — no hay ruta que quitar, solo los archivos.

---

## Alcance — Backend (`functions/index.js`)

### Cupones — se borra solo el CRUD manual, se conserva todo lo que usa la Ruleta

Borrar estos endpoints (todo su único consumidor es el frontend que se borra arriba):
- `POST /api/coupons/create`
- `POST /api/coupons/create-bulk`
- `POST /api/coupons/import` (ya estaba muerto — `CouponsList.jsx` llamaba a `/api/coupons/bulk`, que nunca existió; de todos modos se borra junto con el resto del CRUD)
- `GET /api/coupons`
- `GET /api/coupons/with-cap` (sin consumidor en ningún lado, ya muerto)
- `PATCH /api/coupons/:couponId/toggle`
- `DELETE /api/coupons/:couponId`
- `GET /api/coupons/:couponId/usage`
- `GET /api/coupons/usage`

**No se toca:**
- La creación de cupones dentro del endpoint de giro de la Ruleta (`POST /api/spin-wheel/:wheelId/spin`) — sigue escribiendo en `promonube_coupons` con `source: 'spin_wheel'` exactamente igual que hoy.
- El bloque de tracking de uso de cupones dentro de `POST /api/webhooks/order` (el webhook real de TiendaNube) — sigue escribiendo en `coupon_usage` y actualizando `promonube_coupons.currentUses` igual que hoy. Como ya no va a haber forma de crear cupones fuera de la Ruleta, este bloque en la práctica solo va a ver cupones de la Ruleta de ahora en más — comportamiento correcto sin necesidad de tocar el código.
- Los endpoints de analíticas de la Ruleta (`/api/spin-wheel/:wheelId/analytics`, `/export`, `/recompute-stats`) y `src/pages/SpinWheelAnalytics.jsx`, que leen `promonube_coupons`/`coupon_usage` para mostrar `couponsUsed`, `totalRevenue`, `totalDiscount`, etc.
- Las Cloud Functions programadas `cleanupExpiredCoupons` y `recomputeWheelStats`.
- Las colecciones `promonube_coupons` y `coupon_usage` (siguen existiendo y en uso).
- Los bloques de cupones dentro de los webhooks de GDPR (`/api/webhooks/customers/redact`, `/api/webhooks/customers/data-request`) — los datos de cupones de un cliente siguen siendo redactables, sin importar que ahora todos vengan de la Ruleta.

### Gift Cards — se borra todo, v1 y v2

Borrar estos endpoints completos:
- `POST /api/giftcards/create`
- `GET /api/giftcards`
- `GET /api/giftcard-products`
- `DELETE /api/giftcard-products/:productId`
- `GET /api/giftcards/sold`
- `GET /api/giftcards/:giftCardId`
- `GET /api/giftcards/:giftCardId/transactions`
- `PUT /api/giftcards/:giftCardId/update-email`
- `PUT /api/giftcards/:giftCardId/mark-used`
- `GET /api/giftcards/:code/balance`
- `POST /api/giftcards/redeem`
- `POST /api/giftcards/:id/reload`
- `GET /api/giftcard-v2/config`
- `POST /api/giftcard-v2/setup`
- `PUT /api/giftcard-v2/config`
- `GET /api/giftcard-v2/orders`
- `POST /api/giftcard-v2/resend-email`
- `POST /api/giftcard-v2/upload-image`
- `PUT /api/giftcard-v2/design`
- `POST /api/giftcards/resend-email`
- `GET /api/giftcard-templates`
- `POST /api/giftcard-templates/create`
- `PUT /api/giftcard-templates/:templateId/set-default`
- `DELETE /api/giftcard-templates/:templateId`

Borrar también:
- El webhook completamente muerto `POST /webhook/order-paid` (nunca registrado ante TiendaNube — el que de verdad usa la app es `POST /api/webhooks/order` — su único contenido son bloques de gift cards y cupones, se borra entero).
- Dentro de `POST /api/webhooks/order` (el webhook real, que sí queda): los bloques de detección/generación de gift cards v1 y v2 (creación del gift card, nota de pedido, email, creación de cupón asociado para el gift card). El bloque de tracking de cupones que sigue en esa misma función (sección aparte) no se toca, según lo descrito arriba.
- La llamada a `installDefaultTemplates(storeId)` dentro de `/auth/callback` (el flujo de instalación) — hoy sembraba templates de gift card por defecto en cada tienda nueva; deja de tener sentido.
- Los bloques de gift cards dentro de los webhooks de GDPR (`/api/webhooks/store/redact`, `/api/webhooks/customers/redact`, `/api/webhooks/customers/data-request`).

### Bonus — Promotions (muerta)

Borrar:
- `POST /api/promotions/create`
- `GET /api/promotions`

### Ajuste compartido — lista de módulos

En `ALL_MODULES` (usada por `buildFullModulesObject()` para el campo `modules` de la suscripción), sacar `'coupons'` y `'giftcards'`. Este cambio es cosmético — el acceso de la app es todo-o-nada (`hasAccess` booleano), nada depende de estos flags individuales salvo las etiquetas de módulos que se muestran en la tabla de `src/pages/AdminPanel.jsx` (que dejan de renderizarse para esos dos, sin romper nada).

---

## Fuera de alcance

- No se borran las colecciones `promonube_coupons` ni `coupon_usage` de Firestore — siguen en uso por la Ruleta.
- No se migra ni se borra manualmente ningún dato existente de gift cards o cupones en Firestore — quedan como registros huérfanos inertes (nadie los va a leer ni escribir de nuevo), consistente con la decisión de "no hay uso real, sacar de raíz sin preocuparse por migración."
- No se corrige el bug preexistente y no relacionado de `promonube_coupon_usage` (colección que los webhooks de GDPR leen pero que nunca se escribe en ningún lado) — queda igual que está.
- No se toca nada de Ruleta más allá de lo explícitamente descrito como "no se toca" arriba — sigue funcionando exactamente igual que hoy, con su propia UI y sus propios endpoints intactos.
- No es parte de esta etapa: rediseño visual ni trabajo de catálogo de TiendaNube — son las etapas 2 y 3, se abordan por separado.

---

## Testing

- Frontend: `npm run build` sin errores nuevos; confirmar visualmente que "Cupones" y "Gift Cards" ya no aparecen en el Sidebar ni en las tarjetas del Dashboard.
- Backend: `node -c functions/index.js`; grep de `api/coupons`, `api/giftcards`, `giftcard-v2`, `api/promotions`, `webhook/order-paid` en todo `functions/index.js` — no debe quedar ningún `app.get/post/put/patch/delete` registrado para esas rutas.
- Verificar que `POST /api/spin-wheel/:wheelId/spin` sigue creando cupones (`source: 'spin_wheel'`) sin cambios — no debe aparecer en ningún diff de esta tarea.
- Verificar que el bloque de tracking de uso de cupones dentro de `POST /api/webhooks/order` sigue presente y sin cambios.
- Girar una ruleta de prueba end-to-end (si hay entorno disponible) y confirmar que el cupón ganado se genera y that `SpinWheelAnalytics` sigue mostrando `couponsUsed`/`totalRevenue`/`totalDiscount` correctamente.
