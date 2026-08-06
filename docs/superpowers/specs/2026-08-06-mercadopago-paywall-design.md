# Mercado Pago como único método de pago — Spec de diseño
**Fecha:** 2026-08-06
**Estado:** Aprobado para implementación

---

## Resumen

Reemplaza el sistema de cobro actual de PromoNube (nativo de TiendaNube para apps) por Mercado Pago Suscripciones (PreApproval) como único método de pago. Un solo plan: **$60.000 ARS/mes**, con **7 días de trial gratis sin tarjeta** al instalar. Al vencer el trial sin suscripción activa, la app se bloquea por completo (dashboard y todos los módulos embebidos en la tienda, incluido Cupones). El admin panel gana dos herramientas manuales: marcar una tienda como gratis permanente, y otorgar un mes de cortesía.

### Causa raíz del bug actual

El síntoma reportado ("aparece inactivo pero hay tiendas que pagan y cobra intereses") tiene dos causas combinadas:

1. **El cobro nativo de TiendaNube nunca funcionó de forma confiable** (intereses altos, activación manual poco confiable).
2. **El paywall nunca estuvo realmente activo**: en `/auth/callback` (línea ~1036 de `functions/index.js`), cada instalación fuerza `isDemoAccount: true` con `demoExpiresAt` en el año 2099, y además crea un cargo TiendaNube de "$0 / 36500 días de trial". Es decir, toda tienda que instala la app queda con acceso PRO ilimitado gratis para siempre, sin importar si paga o no.
3. **Tres colecciones de Firestore compiten como fuente de verdad** de la suscripción (`stores/{id}/subscription/current`, `promonube_subscription/{id}`, `subscriptions/{id}`), escritas por distintos endpoints sin sincronizarse entre sí. Por ejemplo `POST /api/admin/activate-plan` escribe en `promonube_subscription/{id}` mientras que `POST /api/admin/deactivate-plan` escribe en `stores/{id}/subscription/current` — activar y desactivar una tienda tocan colecciones distintas.

Este spec corrige las tres causas.

---

## Arquitectura

### Fuente única de verdad

Todo el estado de suscripción vive exclusivamente en:

```
stores/{storeId}/subscription/current
```

Se elige esta colección (no `promonube_subscription` ni `subscriptions`) porque ya es la que lee el gating real de los scripts embebidos (`checkModuleAccess()`) y la que lista `GET /api/admin/stores` en el admin panel — es la de menor blast radius para consolidar.

**Documento nuevo (reemplaza el shape actual):**

```js
{
  status: 'trialing' | 'active' | 'past_due' | 'blocked' | 'free_forever' | 'courtesy',

  // Trial de 7 días (sin tarjeta)
  trialEndsAt: Timestamp | null,

  // Suscripción de Mercado Pago
  mpPreapprovalId: string | null,
  mpStatus: 'pending' | 'authorized' | 'paused' | 'cancelled' | null,
  currentPeriodEnd: Timestamp | null,     // próxima fecha de cobro informada por MP

  // Overrides manuales de admin
  freeForever: boolean,                   // tienda exenta de pago, indefinido
  courtesyUntil: Timestamp | null,        // mes de cortesía con fecha de fin

  // Todo o nada — ya no hay módulos parciales
  modules: {
    coupons: true, giftcards: true, spinWheel: true,
    style: true, countdown: true, popups: true
  },

  updatedAt: Timestamp
}
```

`modules` deja de variar por plan (antes Free = solo `coupons`, Pro = todos). Con un solo plan pago, `modules` es siempre el objeto completo cuando hay acceso, y no se usa cuando no lo hay (el gating corta antes).

### Regla de acceso (`checkModuleAccess`)

Reescribe la función existente en `functions/index.js`. Devuelve `hasAccess: true` si se cumple **cualquiera** de:

1. `freeForever === true`
2. `courtesyUntil` existe y es futuro
3. `status === 'trialing'` y `trialEndsAt` es futuro
4. `status === 'active'` (suscripción de MP autorizada y al día)

En cualquier otro caso (incluido "sin documento de suscripción"), `hasAccess: false` — **para todos los módulos, incluido `coupons`**, que hoy es de acceso libre incondicional. Esto es un cambio deliberado de comportamiento: antes Cupones era gratis siempre; ahora todo depende del plan único de $60.000.

Los ~9 puntos del código que hoy hacen `return res.send('// PromoNube: plan inactivo')` en los distintos scripts embebidos (ruleta, countdown, style, etc.) no cambian de mecanismo, solo heredan la nueva lógica de `checkModuleAccess`.

---

## Flujo de instalación (trial de 7 días)

En `/auth/callback`, se elimina por completo el bloque que hoy fuerza demo-forever y crea un cargo TN de $0/36500 días (líneas ~1036–1098 actuales: escritura a `subscriptions/{storeId}` con `farFuture`, escritura a `stores/{id}/subscription/current` con `isDemoAccount: true`, y el `fetch` a `recurring_application_charges`).

En su lugar, si la tienda es nueva (no existe `stores/{storeId}/subscription/current`), se crea:

```js
{
  status: 'trialing',
  trialEndsAt: now + 7 días,
  mpPreapprovalId: null,
  mpStatus: null,
  currentPeriodEnd: null,
  freeForever: false,
  courtesyUntil: null,
  modules: { coupons: true, giftcards: true, spinWheel: true, style: true, countdown: true, popups: true },
  updatedAt: now
}
```

No se pide tarjeta en este paso. Si la tienda ya tenía un documento de suscripción (reinstalación), no se pisa — se respeta el estado existente.

---

## Integración Mercado Pago — Suscripciones (PreApproval)

Se usa la API de **PreApproval** de Mercado Pago (suscripciones recurrentes con autorización de tarjeta), no Checkout Pro de pago único (que es lo que hoy arma `create-preference`, y que no genera cobro recurrente automático).

### Nuevos endpoints en `functions/index.js`

**`POST /api/mp/create-subscription`**
Body: `{ storeId, storeEmail, storeName }`. Crea un `PreApproval` en Mercado Pago:
```js
{
  reason: 'PromoNube Pro - Suscripción mensual',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 60000,
    currency_id: 'ARS'
  },
  back_url: 'https://pedidos-lett-2.web.app/#/dashboard',
  payer_email: storeEmail,
  external_reference: JSON.stringify({ storeId })
}
```
Devuelve `{ success: true, initPoint }` — el link donde el usuario autoriza la tarjeta. No se usa `auto_recurring.free_trial` porque el trial de 7 días ya se resolvió sin MP (ver sección anterior); cuando el usuario llega a este endpoint es porque el trial ya venció o quiere adelantarse, así que el cobro de MP arranca de inmediato al autorizar.

Guarda `mpPreapprovalId` y `mpStatus: 'pending'` en el doc de suscripción de la tienda al crear el PreApproval (antes de que el usuario complete la autorización), para poder correlacionar el webhook.

**`POST /api/mp/webhook`** (extiende el existente)
Agrega manejo de `type === 'preapproval'` además del `type === 'payment'` que ya existe:
- Se consulta el PreApproval por `data.id` vía SDK de MP.
- `status: 'authorized'` → `stores/{storeId}/subscription/current`: `status: 'active'`, `mpStatus: 'authorized'`, `currentPeriodEnd` calculado, `modules` completos.
- `status: 'paused'` o `'cancelled'` → `status: 'blocked'`, `mpStatus` reflejando el valor.
- El `storeId` se recupera de `external_reference` (fallback: buscar por `mpPreapprovalId` si `external_reference` no viene en el payload, como ya ocurre en webhooks de MP en la práctica).

El endpoint sigue respondiendo `200` inmediatamente y procesando en background, como ya hace hoy para pagos.

### Eliminado

- `POST /api/subscription/:storeId/create-charge` y `POST /api/subscription/confirm-charge` (cobro nativo TiendaNube).
- `POST /api/webhooks/app-charge`, `POST /api/webhooks/app-suspended`, `POST /api/webhooks/app-resumed`.
- El bloque de creación de cargo TN $0/36500 días en `/auth/callback`.
- `POST /api/mp/create-preference` dejar de usarse desde el frontend (el flujo de pago único no aplica a suscripciones recurrentes); el endpoint puede quedar sin llamar o eliminarse — se elimina junto con lo demás para no dejar código muerto.
- Endpoints y colecciones legacy: `promonube_subscription/{id}` y el uso de `subscriptions/{id}` para estado de suscripción (no se borran las colecciones de Firestore, solo dejan de escribirse/leerse).

---

## Frontend

### `PaymentGate` (nuevo componente)

Envuelve las rutas protegidas del Dashboard (todo excepto login/callback). Consulta `GET /api/subscription/:storeId/status` (endpoint existente, se actualiza para leer de la colección canónica y devolver `{ success, subscription: { status, trialEndsAt, currentPeriodEnd, freeForever, courtesyUntil, modules }, hasAccess: boolean }`, donde `hasAccess` es el resultado directo de aplicar la regla de acceso de `checkModuleAccess` al doc de la tienda) al montar:

- Si `hasAccess` es `false` → renderiza pantalla completa de pago (nueva), **nada** del Dashboard se monta detrás.
- Si `hasAccess` es `true` → renderiza `children` normalmente. Si está en trial, se muestra un banner persistente (no bloqueante) con los días restantes, reutilizando `SubscriptionBanner.jsx`.

### Pantalla de pago (nueva, reemplaza el rol de `UpgradeModal`)

Pantalla completa (no modal) con:
- Precio: $60.000 ARS/mes.
- Estado actual (trial vencido / suscripción pausada o cancelada / etc., usando el mismo copy que hoy usa `SubscriptionBanner` para casos análogos).
- Botón "Suscribirme" → llama a `POST /api/mp/create-subscription` → `window.location.href = initPoint`.

`UpgradeModal.jsx` se elimina (su único botón hoy redirige al panel de apps de TiendaNube, que es exactamente el mecanismo que se está reemplazando). `useSubscription.js` se actualiza: `changePlan`/`activateModule` (que apuntaban al viejo sistema por módulos) se eliminan; se agrega `hasAccess` derivado directo del `status` que devuelve `/status`.

### Páginas de retorno de MP

`PaymentSuccess.jsx` / `PaymentFailure.jsx` / `PaymentPending.jsx` ya existen — se revisan para que el success dispare un refetch del estado de suscripción (el webhook de MP puede llegar con un pequeño delay respecto al `back_url`, así que la página de success hace polling corto de `/status` antes de redirigir al dashboard, patrón que probablemente ya exista para el flujo de `create-preference`).

---

## Admin panel (`AdminPanel.jsx`)

Se agregan dos acciones por fila de tienda, reemplazando el selector actual "Activar Demo... (36500 días / 365 / 90 / etc.)":

- **"Marcar gratis permanente"** — toggle que escribe `freeForever: true/false` en `stores/{storeId}/subscription/current`.
- **"Dar mes de cortesía"** — botón que escribe `courtesyUntil: now + 30 días`.

Nuevos endpoints backend (bajo `requireAdminKey`, junto a los demás `/api/admin/*`):
- `POST /api/admin/set-free-forever` — `{ storeId, freeForever }`
- `POST /api/admin/grant-courtesy-month` — `{ storeId }`

Se eliminan `POST /api/admin/activate-demo` y `POST /api/admin/deactivate-demo` (mecanismo de "cuenta demo" que se reemplaza por estos dos conceptos separados), y `POST /api/admin/activate-plan` / `POST /api/admin/deactivate-plan` (escribían en la colección legacy `promonube_subscription`). El botón de acción rápida "Activar Trial Rápido" del header del admin panel se actualiza para usar `grant-courtesy-month` en vez de `activate-demo`.

La tabla de tiendas actualiza sus badges de estado (`PLAN`, `ESTADO`) para reflejar los nuevos valores de `status` (`trialing`, `active`, `past_due`, `blocked`, `free_forever`, `courtesy`) en vez de `free`/`pro`/`demo`.

---

## Migración de tiendas existentes

Nuevo endpoint one-off `POST /api/admin/reset-all-trials` (bajo `requireAdminKey`), pensado para correrse una sola vez al desplegar este cambio:

- Recorre todos los docs de `promonube_stores`.
- Para cada `storeId`, sobrescribe `stores/{storeId}/subscription/current` con `status: 'trialing'`, `trialEndsAt: now + 7 días`, limpiando `isDemoAccount`, `mpPreapprovalId`, `freeForever` y `courtesyUntil` a sus valores por defecto.
- No toca tiendas que el admin ya haya marcado manualmente como `freeForever` o `courtesy` **después** de este reset (el endpoint es para el momento del deploy; usos posteriores del admin panel prevalecen).
- Devuelve un resumen `{ processed, storeIds }` para verificar en el admin panel que corrió correctamente.

Después de correr esto una vez, el trabajo de revisar tienda por tienda (a quién dar cortesía, a quién marcar gratis) se hace manualmente desde el admin panel con las dos herramientas nuevas.

---

## Fuera de alcance

- No se migra ni se intenta recuperar el historial de cobros ya hechos por el sistema nativo de TiendaNube (`app_charges`, `promonube_payments` con `planId` viejo) — quedan como registro histórico en Firestore, sin lectura activa.
- No se implementa lógica de reintento de cobro fallido más allá de lo que Mercado Pago maneja nativamente en PreApproval (reintentos automáticos + eventual `cancelled`).
- No se toca el soporte multi-moneda existente (`PRICES_BY_COUNTRY`) más allá de eliminarlo — el precio pasa a ser un único valor fijo en ARS (`SUBSCRIPTION_PRICE_ARS = 60000`), sin lógica de país/moneda.
- No se agrega un flujo de cancelación de suscripción propio en el dashboard — el usuario cancela desde su cuenta de Mercado Pago; el webhook refleja el cambio de estado.

---

## Testing

- Backend: probar `checkModuleAccess` con cada combinación de `status`/`freeForever`/`courtesyUntil`/`trialEndsAt` (incluye casos límite: trial vence exactamente ahora, `courtesyUntil` en el pasado).
- Webhook de MP: simular payloads de `preapproval` con `authorized`, `paused`, `cancelled` contra `POST /api/mp/webhook` y verificar el doc de Firestore resultante.
- Instalación: verificar que `/auth/callback` crea `trialing` + `trialEndsAt` correcto y **no** crea cargos en TiendaNube ni marca `isDemoAccount`.
- Frontend: `PaymentGate` bloquea el dashboard completo cuando `hasAccess: false` (probado manualmente en navegador, trial vencido simulado vía Firestore).
- Migración: correr `reset-all-trials` contra un proyecto/Firestore de prueba con datos de ejemplo antes de correrlo en producción.
