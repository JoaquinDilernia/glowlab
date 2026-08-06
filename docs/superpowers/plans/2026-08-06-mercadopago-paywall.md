# Mercado Pago como único método de pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PromoNube's broken TiendaNube-native billing with Mercado Pago recurring subscriptions (PreApproval) as the sole payment method — $60.000 ARS/mes, 7 días de trial sin tarjeta, bloqueo total de la app al vencer, y herramientas de admin para tiendas gratis/cortesía.

**Architecture:** One canonical Firestore doc per store (`stores/{storeId}/subscription/current`) evaluated by a single pure access-rule function (`evaluateAccess`), shared by the embedded-script gate (`checkStoreActive`) and the dashboard gate (`checkModuleAccess` / `GET /api/subscription/:storeId/status`). Mercado Pago's PreApproval API handles recurring billing after the (self-managed) 7-day trial. A new `PaymentGate` React component blocks the entire authenticated app when access is lost.

**Tech Stack:** Node 22 (Express, firebase-admin, `mercadopago` SDK v2.11.0) on the backend deployed to Railway (`cd functions && node index.js`); React 19 + Vite + react-router-dom on the frontend.

## Global Constraints

- Single plan, single currency: **$60.000 ARS/mes**, no more per-country pricing.
- Trial: **7 días, sin pedir tarjeta**, otorgado una vez por tienda en la instalación.
- Al vencer trial/suscripción: bloqueo total, incluido el módulo Cupones (ya no hay módulo gratis).
- Fuente única de verdad: `stores/{storeId}/subscription/current` (no `promonube_subscription`, no `subscriptions`).
- Cobro recurrente: Mercado Pago **PreApproval** (no Checkout Pro / `Preference`, que es pago único).
- `functions/index.js` has a **pre-existing text-encoding issue**: many Spanish comments/console.log strings render with `?` or `�` in place of accented characters and emoji when read through the tooling. This is cosmetic (does not affect runtime behavior) and is **not** part of this plan's scope to fix. For tasks that surgically edit a short, precise block, this plan gives the exact literal `old_string`/`new_string` (transcribed character-for-character from the tool's own view of the file). For the one task that deletes several hundred lines of legacy billing code in one shot (Task 7), instead of transcribing that much corrupted text verbatim, the plan gives exact line numbers and the exact route strings being removed — **read that exact range with the Read tool first**, confirm it matches the endpoints listed, then delete it.
- No new test framework is introduced for the whole app (none exists today — no jest/mocha/vitest, no test files, no CI). Node 22 ships a built-in test runner (`node --test`), used only for the one new pure-logic module (`subscriptionAccess.js`) where it's cheap and valuable. All Express endpoint changes are verified manually with `curl` against a locally-running server (`cd functions && node index.js`), matching how this codebase has been developed to date. Local runs need `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Firestore service account), `MP_ACCESS_TOKEN` (use MP's **sandbox/test** access token, never production, while developing), and `ADMIN_KEY` set as environment variables.
- Frontend dev server: `npm run dev` (Vite) from the repo root; set `VITE_API_URL` to point at the local backend if testing end-to-end.

---

## Task 1: Pure subscription-access rule module

**Files:**
- Create: `functions/subscriptionAccess.js`
- Test: `functions/subscriptionAccess.test.js`

**Interfaces:**
- Produces: `evaluateAccess(subscriptionData, now = new Date())` → `{ hasAccess: boolean, reason: string, until?: Date }`. `subscriptionData` is the raw Firestore doc data (or `null`) from `stores/{storeId}/subscription/current`. Accepts Firestore `Timestamp`-like objects (anything with a `.toDate()` method) or ISO strings for date fields. `SUBSCRIPTION_PRICE_ARS` (number, `60000`).
- Consumes: nothing (zero dependencies, pure function).

This is the single access rule used everywhere in the backend (Task 2 wires it into both `checkStoreActive` and `checkModuleAccess`), so every other backend task depends on this file existing first.

- [ ] **Step 1: Write the failing test**

Create `functions/subscriptionAccess.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAccess, SUBSCRIPTION_PRICE_ARS } = require('./subscriptionAccess');

test('price constant is 60000 ARS', () => {
  assert.equal(SUBSCRIPTION_PRICE_ARS, 60000);
});

test('no subscription doc -> no access', () => {
  const result = evaluateAccess(null);
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'no_subscription');
});

test('freeForever true -> access regardless of status', () => {
  const result = evaluateAccess({ freeForever: true, status: 'blocked' });
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'free_forever');
});

test('courtesyUntil in the future -> access regardless of status', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ courtesyUntil: '2026-08-10T00:00:00Z', status: 'blocked' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'courtesy');
});

test('courtesyUntil in the past -> falls through to status evaluation', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ courtesyUntil: '2026-01-01T00:00:00Z', status: 'active' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'active');
});

test('trialing with future trialEndsAt -> access', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: '2026-08-10T00:00:00Z' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'trialing');
});

test('trialing with past trialEndsAt -> no access', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: '2026-08-01T00:00:00Z' }, now);
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'trial_expired');
});

test('trialing with no trialEndsAt -> no access', () => {
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: null });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'trial_expired');
});

test('active status -> access', () => {
  const result = evaluateAccess({ status: 'active' });
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'active');
});

test('blocked status -> no access, reason echoes status', () => {
  const result = evaluateAccess({ status: 'blocked' });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'blocked');
});

test('past_due status -> no access', () => {
  const result = evaluateAccess({ status: 'past_due' });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'past_due');
});

test('accepts Firestore Timestamp-like objects via toDate()', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const fakeTimestamp = { toDate: () => new Date('2026-08-10T00:00:00Z') };
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: fakeTimestamp }, now);
  assert.equal(result.hasAccess, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && node --test subscriptionAccess.test.js`
Expected: FAIL — `Cannot find module './subscriptionAccess'`

- [ ] **Step 3: Write the implementation**

Create `functions/subscriptionAccess.js`:

```js
const SUBSCRIPTION_PRICE_ARS = 60000;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function evaluateAccess(subscriptionData, now = new Date()) {
  if (!subscriptionData) {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  if (subscriptionData.freeForever === true) {
    return { hasAccess: true, reason: 'free_forever' };
  }

  const courtesyUntil = toDate(subscriptionData.courtesyUntil);
  if (courtesyUntil && courtesyUntil > now) {
    return { hasAccess: true, reason: 'courtesy', until: courtesyUntil };
  }

  if (subscriptionData.status === 'trialing') {
    const trialEndsAt = toDate(subscriptionData.trialEndsAt);
    if (trialEndsAt && trialEndsAt > now) {
      return { hasAccess: true, reason: 'trialing', until: trialEndsAt };
    }
    return { hasAccess: false, reason: 'trial_expired' };
  }

  if (subscriptionData.status === 'active') {
    return { hasAccess: true, reason: 'active' };
  }

  return { hasAccess: false, reason: subscriptionData.status || 'inactive' };
}

module.exports = { evaluateAccess, SUBSCRIPTION_PRICE_ARS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && node --test subscriptionAccess.test.js`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add functions/subscriptionAccess.js functions/subscriptionAccess.test.js
git commit -m "feat: add pure subscription access-rule module"
```

---

## Task 2: Rewire the gating functions and simplify the plan constants

**Files:**
- Modify: `functions/index.js` (multiple regions, listed below)

**Interfaces:**
- Consumes: `evaluateAccess`, `SUBSCRIPTION_PRICE_ARS` from Task 1's `functions/subscriptionAccess.js`.
- Produces: `checkStoreActive(storeId)` → `Promise<boolean>` (signature unchanged, used by 11 existing call sites — untouched by this task). `checkModuleAccess(storeId, moduleName)` → `Promise<{hasAccess, reason, plan?}>` (signature unchanged). `buildFullModulesObject()` → `{coupons: true, giftcards: true, spinWheel: true, style: true, countdown: true, popups: true}`, used by Tasks 3, 5, 6, 8. `MODULES`, `ALL_MODULES` stay as they are today (only `PLANS`, `PRICES_BY_COUNTRY`, `getPlanPrice`, `modulesArrayToObject` are removed here).

This is the core bug fix: today `checkStoreActive` (gates the 11 embedded-script routes) and `checkModuleAccess` (gates the dashboard) implement **two different, inconsistent** rules. This task makes both call the same `evaluateAccess`.

- [ ] **Step 1: Add the require for the new module**

In `functions/index.js`, right after line 10:

old_string:
```js
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
```

new_string:
```js
const { MercadoPagoConfig, Preference, Payment, PreApproval } = require('mercadopago');
const { evaluateAccess, SUBSCRIPTION_PRICE_ARS } = require('./subscriptionAccess');
```

(`PreApproval` is imported here too since Task 4 and Task 5 both need it.)

- [ ] **Step 2: Rewrite `checkStoreActive` to use `evaluateAccess`**

old_string:
```js
async function checkStoreActive(storeId) {
  const result = await getCachedData(`sub:${storeId}`, async () => {
    const subDoc = await db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current').get();
    if (!subDoc.exists) return { active: false };
    const data = subDoc.data();
    const status = data?.status;
    if (status === 'active') return { active: true };
    if (status === 'demo') {
      const expires = data.demoExpiresAt ? new Date(data.demoExpiresAt) : null;
      return { active: !expires || expires > new Date() };
    }
    if (status === 'trial') {
      const expires = data.expiresAt ? new Date(data.expiresAt) : null;
      return { active: !expires || expires > new Date() };
    }
    return { active: false };
  });
  return result.active;
}
```

new_string:
```js
async function checkStoreActive(storeId) {
  const result = await getCachedData(`sub:${storeId}`, async () => {
    const subDoc = await db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current').get();
    const data = subDoc.exists ? subDoc.data() : null;
    return evaluateAccess(data);
  });
  return result.hasAccess;
}
```

- [ ] **Step 3: Replace the plan/pricing constants block**

old_string:
```js
// ============================================
// PLAN �NICO PRO - Todo incluido
// ============================================

// Precios por pa�s (mensuales) - PLAN �NICO
const PRICES_BY_COUNTRY = {
  ARS: 30000,  // Argentina (configurado en Partner Panel)
  MXN: 1500,   // M�xico
  COP: 135000, // Colombia
  CLP: 33000   // Chile
};

// Funci�n para obtener precio seg�n moneda de la tienda
function getPlanPrice(currency = 'ARS') {
  return PRICES_BY_COUNTRY[currency] || PRICES_BY_COUNTRY.ARS;
}

// M�dulos incluidos en el plan PRO (todos activos)
const ALL_MODULES = ['coupons', 'giftcards', 'spinWheel', 'style', 'countdown', 'popups'];

const MODULES = {
  coupons: { name: 'Cupones Inteligentes', included: true },
  giftcards: { name: 'Gift Cards', included: true },
  spinWheel: { name: 'Ruleta de Premios', included: true },
  style: { name: 'Style Pro', included: true },
  countdown: { name: 'Cuenta Regresiva', included: true },
  popups: { name: 'Pop-ups', included: true }
};

// Plan �nico PRO con todo incluido
const PLANS = {
  free: { 
    name: 'Free (Trial)', 
    modules: ['coupons'],
    price: 0
  },
  pro: { 
    name: 'PromoNube Pro',
    modules: ALL_MODULES,
    getPriceFor: (currency) => getPlanPrice(currency),
    description: 'Todas las funcionalidades incluidas'
  }
};

// Alias para compatibilidad (todos mapean a 'pro')
PLANS.unlimited = PLANS.pro;
PLANS.ruleta = PLANS.pro;
PLANS.giftcards = PLANS.pro;
PLANS.countdown = PLANS.pro;
PLANS.style = PLANS.pro;

// Helper: Convertir array de m�dulos a objeto {moduleName: true}
function modulesArrayToObject(modulesArray) {
  const modulesObj = {};
  modulesArray.forEach(mod => {
    modulesObj[mod] = true;
  });
  return modulesObj;
}
```

new_string:
```js
// ============================================
// PLAN UNICO PRO - $60.000 ARS/mes
// ============================================

const ALL_MODULES = ['coupons', 'giftcards', 'spinWheel', 'style', 'countdown', 'popups'];

const MODULES = {
  coupons: { name: 'Cupones Inteligentes', included: true },
  giftcards: { name: 'Gift Cards', included: true },
  spinWheel: { name: 'Ruleta de Premios', included: true },
  style: { name: 'Style Pro', included: true },
  countdown: { name: 'Cuenta Regresiva', included: true },
  popups: { name: 'Pop-ups', included: true }
};

// Unico plan, todo o nada: devuelve el objeto de modulos completo.
function buildFullModulesObject() {
  const modules = {};
  ALL_MODULES.forEach(mod => { modules[mod] = true; });
  return modules;
}
```

- [ ] **Step 4: Rewrite `checkModuleAccess` to use `evaluateAccess`**

old_string:
```js
// Verificar acceso a un m�dulo
async function checkModuleAccess(storeId, moduleName) {
  try {
    // Cupones siempre gratis
    if (moduleName === 'coupons') {
      return { hasAccess: true, reason: 'free_module' };
    }

    // Consultar suscripci�n del store
    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      // Sin suscripci�n = solo acceso a cupones
      return { hasAccess: false, reason: 'no_subscription' };
    }

    const subscription = subscriptionDoc.data();

    // ? DEMO: Si es cuenta demo Y no ha expirado, dar acceso total
    if (subscription.isDemoAccount) {
      const expiresAt = new Date(subscription.demoExpiresAt);
      const now = new Date();
      
      if (now < expiresAt) {
        return { 
          hasAccess: true, 
          reason: 'demo_account',
          expiresAt: subscription.demoExpiresAt
        };
      } else {
        // Demo expirado - desactivar autom�ticamente
        console.log(`?? Demo expirado para store ${storeId}, desactivando...`);
        await subscriptionRef.update({
          status: 'inactive',
          plan: 'free',
          modules: { coupons: true },
          isDemoAccount: false,
          demoExpired: true,
          updatedAt: new Date().toISOString()
        });
        return { hasAccess: false, reason: 'demo_expired' };
      }
    }

    // Verificar estado de la suscripci�n
    if (subscription.status === 'suspended') {
      return { hasAccess: false, reason: 'payment_suspended', message: 'Regulariza el pago en tu panel de TiendaNube' };
    }

    if (subscription.status !== 'active') {
      return { hasAccess: false, reason: 'inactive_subscription', status: subscription.status };
    }

    // Verificar si el m�dulo est? activo
    const hasModule = subscription.modules && subscription.modules[moduleName] === true;
    
    return { 
      hasAccess: hasModule, 
      reason: hasModule ? 'active' : 'module_not_included',
      plan: subscription.plan 
    };
  } catch (error) {
    console.error('Error verificando acceso al m�dulo:', error);
    return { hasAccess: false, reason: 'error', error: error.message };
  }
}
```

new_string:
```js
// Verificar acceso (plan unico, todo o nada — moduleName se ignora salvo
// para logging; se mantiene en la firma por compatibilidad con callers existentes)
async function checkModuleAccess(storeId, moduleName) {
  try {
    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    const subscriptionDoc = await subscriptionRef.get();
    const data = subscriptionDoc.exists ? subscriptionDoc.data() : null;

    const access = evaluateAccess(data);

    if (!access.hasAccess) {
      return access;
    }

    return {
      hasAccess: true,
      reason: access.reason,
      plan: 'pro'
    };
  } catch (error) {
    console.error('Error verificando acceso:', error);
    return { hasAccess: false, reason: 'error', error: error.message };
  }
}
```

- [ ] **Step 5: Remove the now-unused `initializeStoreSubscription` helper**

It only wrote to the legacy `promonube_subscription` collection and was called solely by the old `GET /api/subscription/:storeId` endpoint removed in Task 7.

old_string:
```js
async function initializeStoreSubscription(storeId) {
  try {
    const subscriptionRef = db.collection('promonube_subscription').doc(storeId.toString());
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      await subscriptionRef.set({
        plan: 'free',
        status: 'active',
        modules: {
          coupons: true,
          giftcards: false,
          spinWheel: true,
          style: true,
          countdown: true,
          popups: true
        },
        createdAt: FieldValue.serverTimestamp(),
        trialEndsAt: null,
        nextBillingDate: null,
        mpSubscriptionId: null
      });
      console.log('? Suscripci�n FREE inicializada para store', storeId);
    }
  } catch (error) {
    console.error('Error inicializando suscripci�n:', error);
  }
}
```

new_string: *(delete entirely — remove the whole block, replacing it with nothing)*

- [ ] **Step 6: Sanity-check the file still parses**

Run: `cd functions && node -c index.js`
Expected: no output (syntax OK). This does **not** verify runtime correctness (that needs env vars — covered in later tasks' manual checks), just that the edits didn't break JS syntax.

- [ ] **Step 7: Commit**

```bash
git add functions/index.js
git commit -m "refactor: unify subscription gating on evaluateAccess, simplify plan constants"
```

---

## Task 3: Fix the install flow — real 7-day trial instead of forced demo-forever

**Files:**
- Modify: `functions/index.js` (`/auth/callback` handler)

**Interfaces:**
- Consumes: `buildFullModulesObject()` from Task 2.
- Produces: nothing new consumed by later tasks — this is the root-cause fix described in the spec (every install today grants free PRO access until year 2099 and creates a fake $0 TiendaNube charge).

- [ ] **Step 1: Read the current block to confirm line numbers haven't shifted**

Run: Read `functions/index.js` around line 1030–1110 (the exact line numbers may have moved slightly after Task 2's edits since they're earlier in the file — search for the comment `// Siempre actualizar` to relocate it).

- [ ] **Step 2: Replace the demo-forever grant + fake TN charge with a real trial**

old_string (this is the literal current text — encoding artifacts preserved intentionally, see Global Constraints):
```js
    // Siempre actualizar suscripci�n a plan PRO ilimitado (enterprise)
    const farFuture = new Date('2099-12-31T00:00:00.000Z');
    const allModules = {
      coupons: true, giftCards: true, spinWheel: true, countdown: true,
      badges: true, style: true, integrations: true, popups: true,
      announcementBar: true, topHeader: true, menu: true, banners: true
    };

    await db.collection("subscriptions").doc(storeId).set({
      storeId,
      plan: "enterprise",
      status: "active",
      price: 0,
      currency: "ARS",
      startDate: FieldValue.serverTimestamp(),
      endDate: admin.firestore.Timestamp.fromDate(farFuture),
      trialDays: 36500,
      isDemoAccount: true,
      demoExpiresAt: farFuture.toISOString(),
      features: { maxPromos: 999, analytics: true, automation: true },
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      plan: 'pro',
      status: "demo",
      modules: allModules,
      isDemoAccount: true,
      demoExpiresAt: farFuture.toISOString(),
      activatedBy: "install",
      activatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Intentar crear cargo con trial de 36500 d�as (no bloquea si falla)
    try {
      const chargeRes = await fetch(`https://api.tiendanube.com/v1/${storeId}/recurring_application_charges`, {
        method: 'POST',
        headers: {
          'Authentication': `bearer ${access_token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'PromoNube (contacto@promonube.com)'
        },
        body: JSON.stringify({
          name: 'PromoNube Pro - Todo Incluido',
          price: '0',
          trial_days: 36500,
          return_url: `${process.env.FRONTEND_URL || 'https://pedidos-lett-2.web.app'}/#/dashboard`
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.id) {
        console.log(`? Cargo gratuito creado para ${storeId}: ID ${chargeData.id}`);
        // Si tiene confirmation_url, activarlo
        if (chargeData.confirmation_url) {
          await fetch(`https://api.tiendanube.com/v1/${storeId}/recurring_application_charges/${chargeData.id}/activate`, {
            method: 'POST',
            headers: {
              'Authentication': `bearer ${access_token}`,
              'User-Agent': 'PromoNube (contacto@promonube.com)'
            }
          });
        }
      } else {
        console.log(`??  No se pudo crear cargo para ${storeId}:`, chargeRes.status, JSON.stringify(chargeData).substring(0,100));
      }
    } catch (chargeErr) {
      console.log(`??  Error creando cargo (no cr�tico): ${chargeErr.message}`);
    }

    console.log(`? Suscripci�n PRO ilimitada activada para: ${storeId}`);
```

new_string:
```js
    // Instalacion nueva: crear trial de 7 dias sin pedir tarjeta.
    // Si la tienda ya tenia una suscripcion (reinstalacion), se respeta tal cual esta.
    const subscriptionRef = db.collection("stores").doc(storeId).collection("subscription").doc("current");
    const existingSubscription = await subscriptionRef.get();

    if (!existingSubscription.exists) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      await subscriptionRef.set({
        status: 'trialing',
        trialEndsAt: trialEndsAt.toISOString(),
        mpPreapprovalId: null,
        mpStatus: null,
        currentPeriodEnd: null,
        freeForever: false,
        courtesyUntil: null,
        modules: buildFullModulesObject(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log(`Trial de 7 dias creado para: ${storeId}`);
    } else {
      console.log(`Store ${storeId} ya tenia suscripcion, no se modifica`);
    }
```

- [ ] **Step 3: Verify no other code in this handler depends on the removed `subscriptions` collection write**

Run: Grep `functions/index.js` for `db.collection("subscriptions")` — the only remaining reads of that collection should be in `/store-info` (untouched, out of scope, just returns `null` for new stores now, which is a pre-existing ancillary info field not used for gating) and `/dev-login` (dev-only tool, also out of scope).

- [ ] **Step 4: Manual verification**

Run: `cd functions && node -c index.js` (syntax check).
Then, with env vars set (`GOOGLE_APPLICATION_CREDENTIALS_JSON`, a **sandbox** TiendaNube app config if available), start the server: `cd functions && node index.js`, and either trigger a real OAuth install against a test store, or directly write a fresh `stores/{testId}/subscription/current` doc via the Firebase console to confirm `checkStoreActive('testId')` (call it from a Node REPL requiring `./index.js` is impractical since it starts an Express server — instead, verify via the `/api/subscription/:storeId/status` endpoint from Task 6, which is the practical way to observe `evaluateAccess` end-to-end) returns `status: 'trialing'` with `trialEndsAt` ~7 days out.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "fix: grant a real 7-day trial on install instead of free PRO forever"
```

---

## Task 4: Mercado Pago PreApproval — create subscription endpoint

**Files:**
- Modify: `functions/index.js` (add new endpoint near the existing `/api/mp/*` routes)

**Interfaces:**
- Consumes: `mpClient`, `MP_ACCESS_TOKEN` (existing module-level vars), `PreApproval` (imported in Task 2 Step 1), `SUBSCRIPTION_PRICE_ARS` (from Task 1, required in Task 2 Step 1).
- Produces: `POST /api/mp/create-subscription` — body `{ storeId }` → `{ success: true, preapprovalId, initPoint }`. Consumed by Task 10's `SubscribeWall.jsx`.

- [ ] **Step 1: Add the endpoint**

Insert immediately before the `// POST /api/mp/webhook` comment (search for it — its exact line number will have shifted after Tasks 2–3's edits):

```js
// POST /api/mp/create-subscription - Crear suscripcion recurrente (PreApproval)
app.post('/api/mp/create-subscription', async (req, res) => {
  try {
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId es requerido' });
    }

    if (!MP_ACCESS_TOKEN || !mpClient) {
      return res.status(500).json({
        success: false,
        error: 'Mercado Pago no esta configurado. Contacta al administrador.'
      });
    }

    const storeDoc = await db.collection('promonube_stores').doc(storeId.toString()).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada' });
    }
    const storeData = storeDoc.data();
    const payerEmail = storeData.email;
    if (!payerEmail) {
      return res.status(400).json({ success: false, error: 'La tienda no tiene email configurado' });
    }

    const preApproval = new PreApproval(mpClient);
    const frontendUrl = process.env.FRONTEND_URL || 'https://pedidos-lett-2.web.app';

    const result = await preApproval.create({
      body: {
        reason: 'PromoNube Pro - Suscripcion mensual',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: SUBSCRIPTION_PRICE_ARS,
          currency_id: 'ARS'
        },
        back_url: `${frontendUrl}/#/payment-success`,
        payer_email: payerEmail,
        external_reference: JSON.stringify({ storeId: storeId.toString() })
      }
    });

    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    await subscriptionRef.set({
      mpPreapprovalId: result.id,
      mpStatus: result.status || 'pending',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      preapprovalId: result.id,
      initPoint: result.init_point
    });
  } catch (error) {
    console.error('Error creando suscripcion MP:', error);
    console.error('Response:', error.response?.data);
    res.status(500).json({
      success: false,
      error: 'Error al crear la suscripcion',
      details: error.message || 'Error desconocido'
    });
  }
});

```

- [ ] **Step 2: Manual verification**

Run: `cd functions && node -c index.js` then start the server with a **sandbox** `MP_ACCESS_TOKEN` and a test store doc in `promonube_stores` that has an `email` field, then:

```bash
curl -X POST http://localhost:8080/api/mp/create-subscription \
  -H "Content-Type: application/json" \
  -d '{"storeId":"<test-store-id>"}'
```

Expected: `{"success":true,"preapprovalId":"...","initPoint":"https://www.mercadopago.com..."}`. Open `initPoint` in a browser — it should show Mercado Pago's subscription-authorization page for $60.000 ARS/mes.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: add Mercado Pago PreApproval create-subscription endpoint"
```

---

## Task 5: Mercado Pago webhook — handle subscription status changes

**Files:**
- Modify: `functions/index.js` (`POST /api/mp/webhook`)

**Interfaces:**
- Consumes: `PreApproval`, `buildFullModulesObject()`.
- Produces: updates `stores/{storeId}/subscription/current` on `authorized` → `active`, `paused`/`cancelled` → `blocked`.

This fully replaces the existing webhook body, which today only handles one-time `payment` events tied to `create-preference` (removed in Task 7) and references the removed `PLANS`/`modulesArrayToObject`.

- [ ] **Step 1: Replace the webhook handler**

old_string:
```js
// POST /api/mp/webhook - Webhook para notificaciones de MP
app.post('/api/mp/webhook', async (req, res) => {
  try {
    console.log('?? Webhook MP recibido:', req.body);
    console.log('?? Headers:', req.headers);

    const { type, data } = req.body;

    // Validaci�n opcional de firma (si quieres mayor seguridad)
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    
    if (xSignature) {
      console.log('?? Signature recibida:', xSignature);
      // La validaci�n de firma es opcional pero recomendada para producci�n
      // Por ahora logueamos para debugging
    }

    // Responder r�pido a MP (200 dentro de 10 segundos)
    res.status(200).send('OK');

    // Procesar en background
    if (type === 'payment') {
      const paymentId = data.id;
      
      console.log('?? Procesando pago:', paymentId);

      // Obtener informaci�n del pago desde MP
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: paymentId });

      console.log('?? Estado del pago:', paymentData.status);
      console.log('?? Metadata:', paymentData.metadata);

      // Si el pago est? aprobado, activar el plan
      if (paymentData.status === 'approved') {
        const storeId = paymentData.metadata?.store_id;
        const planId = paymentData.metadata?.plan_id;

        if (!storeId || !planId) {
          console.error('? Faltan datos en metadata:', paymentData.metadata);
          return;
        }

        console.log(`? Pago aprobado - Activando plan ${planId} para store ${storeId}`);

        // Actualizar documento de pago
        const paymentRef = db.collection('promonube_payments').doc(paymentData.id.toString());
        await paymentRef.update({
          status: 'approved',
          paymentData: {
            id: paymentData.id,
            status: paymentData.status,
            statusDetail: paymentData.status_detail,
            transactionAmount: paymentData.transaction_amount,
            payer: paymentData.payer,
            paymentMethodId: paymentData.payment_method_id,
            dateApproved: paymentData.date_approved
          },
          approvedAt: FieldValue.serverTimestamp()
        });

        // Activar plan en la suscripci�n
        const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
        const subscriptionDoc = await subscriptionRef.get();

        const plan = PLANS[planId];
        if (!plan) {
          console.error('? Plan no encontrado:', planId);
          return;
        }

        // Calcular fecha de expiraci�n (30 d�as)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        if (subscriptionDoc.exists) {
          // Actualizar suscripci�n existente
          await subscriptionRef.update({
            plan: planId,
            modules: modulesArrayToObject(plan.modules),
            status: 'active',
            activatedAt: FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            lastPaymentId: paymentData.id.toString(),
            lastPaymentAmount: paymentData.transaction_amount
          });
        } else {
          // Crear nueva suscripci�n
          await subscriptionRef.set({
            storeId: storeId,
            plan: planId,
            modules: modulesArrayToObject(plan.modules),
            status: 'active',
            activatedAt: FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            lastPaymentId: paymentData.id.toString(),
            lastPaymentAmount: paymentData.transaction_amount,
            createdAt: FieldValue.serverTimestamp()
          });
        }

        console.log(`?? Plan ${planId} activado exitosamente para store ${storeId}`);
        console.log(`?? Expira el: ${expiresAt.toISOString()}`);

      } else if (payment.status === 'rejected') {
        console.log('? Pago rechazado:', payment.status_detail);
        
        // Actualizar estado del pago
        const paymentRef = db.collection('promonube_payments').doc(payment.id.toString());
        await paymentRef.update({
          status: 'rejected',
          statusDetail: payment.status_detail,
          rejectedAt: FieldValue.serverTimestamp()
        });

      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        console.log('? Pago pendiente:', payment.status_detail);
        
        // Actualizar estado del pago
        const paymentRef = db.collection('promonube_payments').doc(payment.id.toString());
        await paymentRef.update({
          status: payment.status,
          statusDetail: payment.status_detail
        });
      }

    }

  } catch (error) {
    console.error('? Error en webhook MP:', error);
  }
});
```

new_string:
```js
// POST /api/mp/webhook - Notificaciones de Mercado Pago (suscripciones PreApproval)
app.post('/api/mp/webhook', async (req, res) => {
  try {
    console.log('Webhook MP recibido:', req.body);

    const { type } = req.body;
    const data = req.body.data || {};

    // Responder rapido a MP (200 dentro de 10 segundos)
    res.status(200).send('OK');

    // MP nombra el topic distinto segun el tipo de integracion de webhooks
    // (IPN clasico vs Webhooks v2); se manejan ambos de forma defensiva.
    // NOTA: verificar el valor real de `type` en los logs de Railway la
    // primera vez que se dispare un webhook real y ajustar esta lista si hace falta.
    const PREAPPROVAL_TYPES = ['preapproval', 'subscription_preapproval'];

    if (!PREAPPROVAL_TYPES.includes(type) || !data.id) {
      return;
    }

    const preApproval = new PreApproval(mpClient);
    const preapprovalData = await preApproval.get({ id: data.id });

    let storeId = null;
    try {
      const parsedRef = JSON.parse(preapprovalData.external_reference || '{}');
      storeId = parsedRef.storeId;
    } catch (parseErr) {
      console.error('No se pudo parsear external_reference:', preapprovalData.external_reference);
    }

    if (!storeId) {
      console.error('Webhook de preapproval sin storeId identificable:', preapprovalData.id);
      return;
    }

    const subscriptionRef = db.collection('stores').doc(storeId).collection('subscription').doc('current');

    if (preapprovalData.status === 'authorized') {
      await subscriptionRef.set({
        status: 'active',
        mpPreapprovalId: preapprovalData.id,
        mpStatus: 'authorized',
        currentPeriodEnd: preapprovalData.next_payment_date || null,
        modules: buildFullModulesObject(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      invalidateConfigCache(storeId);
      console.log(`Suscripcion autorizada para store ${storeId}`);
    } else if (preapprovalData.status === 'paused' || preapprovalData.status === 'cancelled') {
      await subscriptionRef.set({
        status: 'blocked',
        mpStatus: preapprovalData.status,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      invalidateConfigCache(storeId);
      console.log(`Suscripcion ${preapprovalData.status} para store ${storeId}`);
    } else {
      await subscriptionRef.set({
        mpStatus: preapprovalData.status,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error en webhook MP:', error);
  }
});
```

- [ ] **Step 2: Manual verification**

With a sandbox `MP_ACCESS_TOKEN`, complete a test subscription authorization end-to-end (using Task 4's `initPoint` and MP's test cards), then check the Railway/local logs to see the actual `req.body` MP sends — confirm the `type` field value matches one of `PREAPPROVAL_TYPES`, and check Firestore that `stores/{storeId}/subscription/current` now has `status: 'active'`.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: handle Mercado Pago preapproval webhook events"
```

---

## Task 6: Rewrite the canonical subscription-status endpoint

**Files:**
- Modify: `functions/index.js` (`GET /api/subscription/:storeId/status`)

**Interfaces:**
- Consumes: `evaluateAccess`, `buildFullModulesObject()`.
- Produces: `GET /api/subscription/:storeId/status` → `{ success: true, subscription: { status, trialEndsAt, mpStatus, currentPeriodEnd, freeForever, courtesyUntil, modules }, hasAccess: boolean, accessReason: string }`. This is the endpoint Task 9's `useSubscription.js` hook and Task 14's `PaymentSuccess.jsx` poll against.

This endpoint already reads from the canonical `stores/{storeId}/subscription/current` collection — it just needs its response reshaped and the dead `app_charges`/`lastCharge` logic (tied to the removed TiendaNube-native billing) dropped.

- [ ] **Step 1: Replace the endpoint**

old_string:
```js
// GET /api/subscription/:storeId/status
// Consulta el estado completo de la suscripci�n incluyendo �ltimo cargo
app.get("/api/subscription/:storeId/status", async (req, res) => {
  const { storeId } = req.params;

  try {
    console.log(`?? Consultando estado completo para store ${storeId}`);

    // Obtener suscripci�n actual
    const subscriptionDoc = await db.collection("stores")
      .doc(storeId)
      .collection("subscription")
      .doc("current")
      .get();

    const subscription = subscriptionDoc.exists
      ? subscriptionDoc.data()
      : { plan: 'free', status: 'inactive', modules: { coupons: true } };

    // Para planes pro/trial, asegurar que los m�dulos nuevos est�n incluidos
    const storedModules = subscription.modules || {};
    if (subscription.plan === 'trial' || subscription.plan === 'pro' || subscription.isDemoAccount) {
      for (const mod of ALL_MODULES) {
        if (storedModules[mod] === undefined) storedModules[mod] = true;
      }
      subscription.modules = storedModules;
    }

    // Obtener �ltimo cargo
    const chargesSnapshot = await db.collection("app_charges")
      .where("storeId", "==", storeId)
      .get();

    const charges = [];
    chargesSnapshot.forEach(doc => {
      charges.push({ id: doc.id, ...doc.data() });
    });

    // Ordenar por fecha
    charges.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    const lastCharge = charges.length > 0 ? charges[0] : null;
    const activeCharge = charges.find(c => c.status === 'accepted');

    res.json({ 
      success: true,
      subscription: {
        ...subscription,
        lastCharge: lastCharge,
        activeCharge: activeCharge,
        hasActivePayment: !!activeCharge,
        totalCharges: charges.length
      }
    });

  } catch (error) {
    console.error("? Error consultando estado:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
```

new_string:
```js
// GET /api/subscription/:storeId/status
// Estado de suscripcion + resultado de la regla de acceso unica
app.get("/api/subscription/:storeId/status", async (req, res) => {
  const { storeId } = req.params;

  try {
    const subscriptionDoc = await db.collection("stores")
      .doc(storeId)
      .collection("subscription")
      .doc("current")
      .get();

    const data = subscriptionDoc.exists ? subscriptionDoc.data() : null;
    const access = evaluateAccess(data);

    const toIso = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      return value.toDate ? value.toDate().toISOString() : null;
    };

    const subscription = {
      status: data?.status || 'trialing',
      trialEndsAt: toIso(data?.trialEndsAt),
      mpStatus: data?.mpStatus || null,
      currentPeriodEnd: toIso(data?.currentPeriodEnd),
      freeForever: data?.freeForever || false,
      courtesyUntil: toIso(data?.courtesyUntil),
      modules: access.hasAccess ? buildFullModulesObject() : {}
    };

    res.json({
      success: true,
      subscription,
      hasAccess: access.hasAccess,
      accessReason: access.reason
    });

  } catch (error) {
    console.error("Error consultando estado:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
```

- [ ] **Step 2: Manual verification**

```bash
curl http://localhost:8080/api/subscription/<test-store-id>/status
```

Expected for a freshly-installed test store (from Task 3): `{"success":true,"subscription":{"status":"trialing","trialEndsAt":"<7 days out>",...},"hasAccess":true,"accessReason":"trialing"}`.

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: rewrite subscription status endpoint around evaluateAccess"
```

---

## Task 7: Remove the broken TiendaNube-native billing system

**Files:**
- Modify: `functions/index.js` (multiple deletions)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (pure removal). No later task depends on anything removed here.

Per the approved spec, TiendaNube's native app-billing is being deleted entirely, not just stopped. This removes, by exact route:

| Method | Route | Why |
|---|---|---|
| `POST` | `/api/subscription/:storeId/create-charge` | Creates a TN native recurring charge |
| `POST` | `/api/subscription/confirm-charge` | Confirms a TN native charge |
| `GET` | `/api/subscription/:storeId/charges` | Lists TN native charges (dead once the above are gone) |
| `GET` | `/api/subscription/:storeId/charge/:chargeId` | TN native charge detail (same) |
| `POST` | `/api/webhooks/app-charge` | TN webhook for native charge status |
| `POST` | `/api/webhooks/app-suspended` | TN webhook for native suspension |
| `POST` | `/api/webhooks/app-resumed` | TN webhook for native resume |
| `POST` | `/api/admin/force-charge` | Manually forces a TN native $0/36500-day charge |
| `GET` | `/api/subscription/:storeId` | Old status endpoint reading the abandoned `promonube_subscription` collection (superseded by Task 6's `/status`) |
| `POST` | `/api/subscription/:storeId/activate` | Per-module activation — obsolete now that it's all-or-nothing |
| `POST` | `/api/subscription/:storeId/deactivate` | Per-module deactivation — same |
| `POST` | `/api/subscription/:storeId/change-plan` | Multi-plan switch — obsolete, single plan now |
| `GET` | `/api/subscription/:storeId/check/:module` | Per-module check — superseded by `/status`'s `hasAccess` |
| `POST` | `/api/mp/create-preference` | One-time Checkout Pro payment — superseded by Task 4's `create-subscription` (recurring) |

- [ ] **Step 1: Delete the create-charge/confirm-charge/charges-list/charge-detail block**

Read `functions/index.js` and locate the section starting at the comment `// ============================================` immediately followed by `// TIENDANUBE APP CHARGES (Sistema de Cobros)`, through `app.post("/api/subscription/:storeId/create-charge", ...)`, `app.post("/api/subscription/confirm-charge", ...)`, `app.get("/api/subscription/:storeId/charges", ...)`, ending right before the (now-rewritten, from Task 6) `GET /api/subscription/:storeId/status` endpoint. Confirm the block you're looking at contains exactly those three route handlers (`create-charge`, `confirm-charge`, `charges`) plus their section header comment, then delete the entire block.

- [ ] **Step 2: Delete the `charge/:chargeId` detail endpoint**

Immediately after Task 6's rewritten `/status` endpoint, locate `app.get("/api/subscription/:storeId/charge/:chargeId", ...)` (ends right before an unrelated `POST /api/giftcards/resend-email` section). Delete this entire handler.

- [ ] **Step 3: Delete the three TiendaNube-native webhooks**

Locate, in order: `app.post("/api/webhooks/app-charge", ...)`, `app.post("/api/webhooks/app-suspended", ...)`, `app.post("/api/webhooks/app-resumed", ...)`. These three are contiguous, immediately followed by `// POST /api/admin/activate-demo`. Delete all three handlers (keep the `activate-demo`/`deactivate-demo` endpoints for now — those are replaced in Task 8, not deleted here, to keep this task focused purely on TiendaNube-native billing removal).

- [ ] **Step 4: Delete `force-charge`**

Locate `app.post('/api/admin/force-charge', requireAdminKey, ...)` (starts with the comment `// POST /api/admin/force-charge - Forzar creacion...`, ends right before an unrelated `// NUBECATEGORIES ENDPOINTS` section). Delete the entire handler and its two-line explanatory comment above it.

- [ ] **Step 5: Delete the old `GET /api/subscription/:storeId` (promonube_subscription version)**

old_string:
```js
// GET /api/subscription/:storeId - Obtener suscripci�n actual
app.get('/api/subscription/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      // Inicializar suscripci�n FREE si no existe
      await initializeStoreSubscription(storeId);
      const newDoc = await subscriptionRef.get();
      return res.json({
        success: true,
        subscription: newDoc.data(),
        availableModules: MODULES,
        availablePlans: PLANS
      });
    }

    res.json({
      success: true,
      subscription: subscriptionDoc.data(),
      availableModules: MODULES,
      availablePlans: PLANS
    });
  } catch (error) {
    console.error('Error obteniendo suscripci�n:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

```

new_string: *(delete entirely)*

- [ ] **Step 6: Delete the per-module activate/deactivate/change-plan/check endpoints**

old_string:
```js
// POST /api/subscription/:storeId/activate - Activar m�dulo individual
app.post('/api/subscription/:storeId/activate', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { moduleName } = req.body;

    if (!MODULES[moduleName]) {
      return res.status(400).json({ success: false, error: 'M�dulo no v�lido' });
    }

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    await subscriptionRef.set({
      [`modules.${moduleName}`]: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `M�dulo ${MODULES[moduleName].name} activado`,
      module: moduleName
    });
  } catch (error) {
    console.error('Error activando m�dulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/subscription/:storeId/deactivate - Desactivar m�dulo
app.post('/api/subscription/:storeId/deactivate', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { moduleName } = req.body;

    if (moduleName === 'coupons') {
      return res.status(400).json({ success: false, error: 'No se puede desactivar Cupones (m�dulo gratuito)' });
    }

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    await subscriptionRef.set({
      [`modules.${moduleName}`]: false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `M�dulo ${MODULES[moduleName]?.name || moduleName} desactivado`,
      module: moduleName
    });
  } catch (error) {
    console.error('Error desactivando m�dulo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/subscription/:storeId/change-plan - Cambiar plan
app.post('/api/subscription/:storeId/change-plan', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { planId } = req.body;

    if (!PLANS[planId]) {
      return res.status(400).json({ success: false, error: 'Plan no v�lido' });
    }

    const plan = PLANS[planId];
    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    
    // Crear objeto de m�dulos basado en el plan
    const modules = {
      coupons: true, // Siempre activo
      giftcards: plan.modules.includes('giftcards'),
      spinWheel: plan.modules.includes('spinWheel'),
      style: plan.modules.includes('style'),
      countdown: plan.modules.includes('countdown')
    };

    await subscriptionRef.set({
      plan: planId,
      modules: modules,
      status: 'active',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({
      success: true,
      message: `Plan cambiado a ${plan.name}`,
      plan: planId,
      modules: modules
    });
  } catch (error) {
    console.error('Error cambiando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/subscription/:storeId/check/:module - Verificar acceso a m�dulo
app.get('/api/subscription/:storeId/check/:module', async (req, res) => {
  try {
    const { storeId, module } = req.params;
    const accessCheck = await checkModuleAccess(storeId, module);

    res.json({
      success: true,
      hasAccess: accessCheck.hasAccess,
      reason: accessCheck.reason,
      module: module,
      moduleName: MODULES[module]?.name || module
    });
  } catch (error) {
    console.error('Error verificando acceso:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

```

new_string: *(delete entirely)*

- [ ] **Step 7: Delete `POST /api/mp/create-preference`**

Locate the handler starting `// POST /api/mp/create-preference - Crear preferencia de pago` / `app.post('/api/mp/create-preference', async (req, res) => {`. By this point in the plan, Task 4 has already inserted `POST /api/mp/create-subscription` immediately after this handler (before the webhook), so `create-preference` now ends right before the `// POST /api/mp/create-subscription` comment, not before the webhook. Delete only the `create-preference` handler — leave `create-subscription` and the webhook untouched.

- [ ] **Step 8: Verify the file still parses and nothing references removed identifiers**

Run: `cd functions && node -c index.js`
Run: Grep `functions/index.js` for `PLANS[`, `PLANS.`, `getPlanPrice`, `modulesArrayToObject`, `initializeStoreSubscription`, `app_charges` — expect zero remaining matches (all were only used inside the code just deleted, plus Task 2 already removed the `PLANS` constant itself and Task 2 Step 5 removed `initializeStoreSubscription`).

- [ ] **Step 9: Commit**

```bash
git add functions/index.js
git commit -m "remove: delete broken TiendaNube-native billing and obsolete per-module endpoints"
```

---

## Task 8: Admin endpoints — free-forever, courtesy month, and the one-time trial reset

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `requireAdminKey` (existing middleware), `buildFullModulesObject()`.
- Produces: `POST /api/admin/set-free-forever` (`{storeId, freeForever}`), `POST /api/admin/grant-courtesy-month` (`{storeId}`), `POST /api/admin/reset-all-trials` (no body). Also updates `GET /api/admin/stores`' subscription field mapping. Consumed by Task 15's `AdminPanel.jsx`.

- [ ] **Step 1: Remove `activate-demo` and `deactivate-demo`**

old_string:
```js
// POST /api/admin/activate-demo
// Activa o EXTIENDE una tienda DEMO con plan PRO completo (sin cobro)
app.post("/api/admin/activate-demo", async (req, res) => {
  const { storeId, expirationDays } = req.body;
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey; // Acepta header o body

  // Validar clave de admin
  const ADMIN_KEY = process.env.ADMIN_KEY || 'demo-secret-2026';
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  }

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    console.log(`?? Activando/Extendiendo tienda DEMO: ${storeId}`);

    // Obtener suscripci�n actual para verificar si ya existe demo
    const currentSub = await db.collection("stores").doc(storeId).collection("subscription").doc("current").get();
    let expirationDate;

    if (expirationDays) {
      // Modo D�AS: Calcular desde hoy O desde fecha de expiraci�n actual si est? vigente
      const days = parseInt(expirationDays);
      const now = new Date();
      
      if (currentSub.exists && currentSub.data().demoExpiresAt) {
        const currentExpiration = new Date(currentSub.data().demoExpiresAt);
        
        // Si la demo actual A�N NO expir?, EXTENDER desde esa fecha
        if (currentExpiration > now) {
          expirationDate = new Date(currentExpiration.getTime() + days * 24 * 60 * 60 * 1000);
          console.log(`?? Extendiendo demo vigente: ${currentExpiration.toISOString()} + ${days} d�as = ${expirationDate.toISOString()}`);
        } else {
          // Si ya expir?, calcular desde HOY
          expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          console.log(`?? Demo expirada. Nueva desde HOY + ${days} d�as = ${expirationDate.toISOString()}`);
        }
      } else {
        // No hay demo previa, calcular desde HOY
        expirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        console.log(`?? Nueva demo desde HOY + ${days} d�as = ${expirationDate.toISOString()}`);
      }
    } else {
      // Default: 30 d�as desde hoy
      expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Activar TODOS los m�dulos
    const modules = {};
    ALL_MODULES.forEach(moduleName => {
      modules[moduleName] = true;
    });

    // Activar plan PRO DEMO
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      plan: 'pro',
      status: "demo",
      modules: modules,
      isDemoAccount: true,
      demoExpiresAt: expirationDate.toISOString(),
      activatedBy: "admin",
      activatedAt: currentSub.exists && currentSub.data().activatedAt ? currentSub.data().activatedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Marcar tienda como demo
    await db.collection("promonube_stores").doc(storeId).update({
      isDemoAccount: true,
      demoExpiresAt: expirationDate.toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`? Tienda DEMO actualizada: ${storeId} hasta ${expirationDate.toISOString()}`);

    invalidateConfigCache(storeId);

    res.json({ 
      success: true, 
      message: "Tienda DEMO activada/extendida",
      storeId,
      expiresAt: expirationDate.toISOString(),
      modules
    });

  } catch (error) {
    console.error("? Error activando demo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/deactivate-demo
// Desactiva una tienda DEMO y vuelve a FREE
app.post("/api/admin/deactivate-demo", async (req, res) => {
  const { storeId } = req.body;
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey; // Acepta header o body

  const ADMIN_KEY = process.env.ADMIN_KEY || 'demo-secret-2026';
  
  if (adminKey !== ADMIN_KEY) {
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  }

  if (!storeId) {
    return res.json({ success: false, message: "storeId requerido" });
  }

  try {
    console.log(`?? Desactivando tienda DEMO: ${storeId}`);

    // Volver a plan FREE
    await db.collection("stores").doc(storeId).collection("subscription").doc("current").set({
      plan: 'free',
      status: "inactive",
      modules: { coupons: true },
      isDemoAccount: false,
      demoExpiresAt: null,
      deactivatedBy: "admin",
      deactivatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Desmarcar como demo
    await db.collection("promonube_stores").doc(storeId).update({
      isDemoAccount: false,
      demoExpiresAt: null,
      updatedAt: new Date().toISOString()
    });

    console.log(`? Tienda DEMO desactivada: ${storeId}`);

    res.json({ 
      success: true, 
      message: "Tienda DEMO desactivada, vuelto a plan FREE"
    });

  } catch (error) {
    console.error("? Error desactivando demo:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

```

new_string:
```js
// POST /api/admin/set-free-forever - Marcar/desmarcar tienda como gratis permanente
app.post('/api/admin/set-free-forever', requireAdminKey, async (req, res) => {
  try {
    const { storeId, freeForever } = req.body;
    if (!storeId || typeof freeForever !== 'boolean') {
      return res.status(400).json({ success: false, error: 'storeId y freeForever (boolean) son requeridos' });
    }

    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    await subscriptionRef.set({
      freeForever,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    invalidateConfigCache(storeId.toString());

    res.json({ success: true, message: freeForever ? 'Tienda marcada como gratis permanente' : 'Tienda ya no es gratis permanente' });
  } catch (error) {
    console.error('Error en set-free-forever:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/grant-courtesy-month - Otorgar 30 dias de cortesia
app.post('/api/admin/grant-courtesy-month', requireAdminKey, async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ success: false, error: 'storeId es requerido' });
    }

    const courtesyUntil = new Date();
    courtesyUntil.setDate(courtesyUntil.getDate() + 30);

    const subscriptionRef = db.collection('stores').doc(storeId.toString()).collection('subscription').doc('current');
    await subscriptionRef.set({
      courtesyUntil: courtesyUntil.toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    invalidateConfigCache(storeId.toString());

    res.json({ success: true, message: 'Mes de cortesia otorgado', courtesyUntil: courtesyUntil.toISOString() });
  } catch (error) {
    console.error('Error en grant-courtesy-month:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

```

- [ ] **Step 2: Remove `activate-plan` and `deactivate-plan`, add `reset-all-trials`**

old_string:
```js
app.post('/api/admin/activate-plan', requireAdminKey, async (req, res) => {
  try {
    const { storeId, planId } = req.body;

    if (!storeId || !planId) {
      return res.status(400).json({ success: false, error: 'Faltan par�metros' });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan inv�lido' });
    }

    // Calcular fecha de expiraci�n (30 d�as)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const subscriptionRef = db.collection('promonube_subscription').doc(storeId);
    await subscriptionRef.set({
      storeId: storeId,
      plan: planId,
      modules: modulesArrayToObject(plan.modules),
      status: 'active',
      activatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
      manuallyActivated: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`????? Plan ${planId} activado manualmente para store ${storeId}`);

    res.json({
      success: true,
      message: `Plan ${plan.name} activado hasta ${expiresAt.toLocaleDateString()}`
    });
  } catch (error) {
    console.error('Error activando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/deactivate-plan - Desactivar plan
app.post('/api/admin/deactivate-plan', requireAdminKey, async (req, res) => {
  try {
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'Falta storeId' });
    }

    const subscriptionRef = db.collection('stores').doc(storeId).collection('subscription').doc('current');
    const subDoc = await subscriptionRef.get();
    if (!subDoc.exists) {
      return res.status(404).json({ success: false, error: 'No se encontro suscripcion' });
    }
    await subscriptionRef.update({
      status: 'inactive',
      deactivatedAt: FieldValue.serverTimestamp()
    });

    invalidateConfigCache(storeId);

    // Eliminar todos los scripts de PromoNube de la tienda
    const removeResult = await removeAllStoreScripts(storeId);


    res.json({ success: true, message: 'Plan desactivado exitosamente', scriptsRemoved: removeResult.removed || 0 });
  } catch (error) {
    console.error('Error desactivando plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

new_string:
```js
// POST /api/admin/reset-all-trials - Uso unico al desplegar el nuevo sistema de
// suscripciones: reinicia todas las tiendas a un trial de 7 dias limpio.
app.post('/api/admin/reset-all-trials', requireAdminKey, async (req, res) => {
  try {
    const storesSnapshot = await db.collection('promonube_stores').get();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const storeIds = [];
    const batchSize = 400;
    let batch = db.batch();
    let opsInBatch = 0;

    for (const storeDoc of storesSnapshot.docs) {
      const storeId = storeDoc.id;
      const subscriptionRef = db.collection('stores').doc(storeId).collection('subscription').doc('current');
      batch.set(subscriptionRef, {
        status: 'trialing',
        trialEndsAt: trialEndsAt.toISOString(),
        mpPreapprovalId: null,
        mpStatus: null,
        currentPeriodEnd: null,
        freeForever: false,
        courtesyUntil: null,
        modules: buildFullModulesObject(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      storeIds.push(storeId);
      opsInBatch++;

      if (opsInBatch >= batchSize) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    storeIds.forEach(id => invalidateConfigCache(id));

    res.json({ success: true, processed: storeIds.length, storeIds });
  } catch (error) {
    console.error('Error en reset-all-trials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Step 3: Update `GET /api/admin/stores`' subscription field mapping**

old_string:
```js
      // Obtener suscripci�n actual desde stores/{storeId}/subscription/current
      let subscription = null;
      try {
        const subDoc = await db.collection('stores').doc(storeId).collection('subscription').doc('current').get();
        if (subDoc.exists) {
          const subData = subDoc.data();
          
          // Formatear fechas correctamente
          let activatedAt = null;
          if (subData.activatedAt) {
            activatedAt = typeof subData.activatedAt === 'string' ? subData.activatedAt : subData.activatedAt.toDate?.().toISOString();
          }
          
          let expiresAt = null;
          if (subData.demoExpiresAt) {
            expiresAt = typeof subData.demoExpiresAt === 'string' ? subData.demoExpiresAt : subData.demoExpiresAt.toDate?.().toISOString();
          } else if (subData.expiresAt) {
            expiresAt = typeof subData.expiresAt === 'string' ? subData.expiresAt : subData.expiresAt.toDate?.().toISOString();
          }
          
          // Formatear createdAt/installedAt
          let createdAt = null;
          if (subData.createdAt) {
            createdAt = typeof subData.createdAt === 'string' ? subData.createdAt : subData.createdAt.toDate?.().toISOString();
          } else if (subData.installedAt) {
            createdAt = typeof subData.installedAt === 'string' ? subData.installedAt : subData.installedAt.toDate?.().toISOString();
          } else if (storeData.installedAt) {
            createdAt = typeof storeData.installedAt === 'string' ? storeData.installedAt : storeData.installedAt.toDate?.().toISOString();
          }

          subscription = {
            plan: subData.plan || 'free',
            status: subData.status || 'inactive',
            modules: subData.modules || { coupons: true },
            isDemoAccount: subData.isDemoAccount || false,
            activatedAt: activatedAt,
            createdAt: createdAt,
            expiresAt: expiresAt,
            updatedAt: subData.updatedAt
          };
        }
      } catch (err) {
        console.log(`No se pudo obtener suscripci�n para store ${storeId}:`, err.message);
      }
      
      // Si no hay suscripci�n, usar datos de instalaci�n de promonube_stores
      if (!subscription && storeData.installedAt) {
        const installedDate = typeof storeData.installedAt === 'string' ? storeData.installedAt : storeData.installedAt.toDate?.().toISOString();
        subscription = {
          plan: 'free',
          status: 'inactive',
          modules: { coupons: true },
          isDemoAccount: false,
          createdAt: installedDate
        };
      }

      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription: subscription || {
          plan: 'free',
          status: 'inactive',
          modules: { coupons: true },
          isDemoAccount: false
        }
      });
```

new_string:
```js
      // Obtener suscripcion actual desde stores/{storeId}/subscription/current
      const toIso = (value) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        return value.toDate ? value.toDate().toISOString() : null;
      };

      let subscription = null;
      try {
        const subDoc = await db.collection('stores').doc(storeId).collection('subscription').doc('current').get();
        if (subDoc.exists) {
          const subData = subDoc.data();
          subscription = {
            status: subData.status || 'trialing',
            trialEndsAt: toIso(subData.trialEndsAt),
            mpPreapprovalId: subData.mpPreapprovalId || null,
            mpStatus: subData.mpStatus || null,
            currentPeriodEnd: toIso(subData.currentPeriodEnd),
            freeForever: subData.freeForever || false,
            courtesyUntil: toIso(subData.courtesyUntil),
            modules: subData.modules || {},
            createdAt: toIso(subData.createdAt) || toIso(storeData.installedAt)
          };
        }
      } catch (err) {
        console.log(`No se pudo obtener suscripcion para store ${storeId}:`, err.message);
      }

      if (!subscription) {
        subscription = {
          status: 'trialing',
          trialEndsAt: null,
          mpPreapprovalId: null,
          mpStatus: null,
          currentPeriodEnd: null,
          freeForever: false,
          courtesyUntil: null,
          modules: {},
          createdAt: toIso(storeData.installedAt)
        };
      }

      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription
      });
```

- [ ] **Step 4: Manual verification**

```bash
curl -X POST http://localhost:8080/api/admin/set-free-forever \
  -H "Content-Type: application/json" -H "x-admin-key: <ADMIN_KEY>" \
  -d '{"storeId":"<test-store-id>","freeForever":true}'

curl -X POST http://localhost:8080/api/admin/grant-courtesy-month \
  -H "Content-Type: application/json" -H "x-admin-key: <ADMIN_KEY>" \
  -d '{"storeId":"<test-store-id>"}'

curl http://localhost:8080/api/admin/stores -H "x-admin-key: <ADMIN_KEY>"
```

Expected: each returns `{"success":true,...}`; the `stores` list shows the test store with `freeForever: true` and a `courtesyUntil` date ~30 days out.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: admin free-forever/courtesy-month endpoints, remove legacy demo/plan admin endpoints"
```

---

## Task 9: Frontend — rewrite the `useSubscription` hook

**Files:**
- Modify: `src/hooks/useSubscription.js`

**Interfaces:**
- Consumes: `GET /api/subscription/:storeId/status` (Task 6).
- Produces: `useSubscription()` → `{ subscription, hasAccess: boolean|null, loading, error, reload }`. `hasAccess` is `null` while `loading` is `true` (distinguishes "still checking" from "checked, no access" — Task 11's `PaymentGate` depends on this distinction). Consumed by Task 11 (`PaymentGate`), Task 12 (`Dashboard.jsx`), Task 13 (`Sidebar.jsx`).

**Breaking change from the current hook:** `hasAccess` used to be a function `hasAccess(moduleName) => boolean`; it is now a plain boolean (all-or-nothing access). `changePlan` and `activateModule` are removed (no per-module or per-plan actions left). Every consumer is updated in this plan (Tasks 12, 13) — do not merge Task 9 without also merging those.

- [ ] **Step 1: Rewrite the hook**

Full replacement of `src/hooks/useSubscription.js`:

```js
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../config';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [hasAccess, setHasAccess] = useState(null); // null = still loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSubscription = useCallback(async () => {
    const storeId = localStorage.getItem('promonube_store_id');

    if (!storeId) {
      setError('No store ID found');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest(`/api/subscription/${storeId}/status`);

      if (data.success) {
        setSubscription(data.subscription);
        setHasAccess(data.hasAccess);
        setError(null);
      } else {
        setError('Failed to load subscription');
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  return {
    subscription,
    hasAccess,
    loading,
    error,
    reload: loadSubscription
  };
}
```

- [ ] **Step 2: Manual verification**

This hook has no standalone test harness — its correctness is verified in context by Tasks 11/12/13's manual browser checks. For now, confirm it at least compiles: `npm run build` from the repo root should not report errors originating from `useSubscription.js` (it will still report errors in `Dashboard.jsx`/`Sidebar.jsx` until Tasks 12–13 land — that's expected at this point in the plan).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.js
git commit -m "refactor: simplify useSubscription hook to boolean hasAccess"
```

---

## Task 10: Frontend — the paywall screen (`SubscribeWall`)

**Files:**
- Create: `src/components/SubscribeWall.jsx`
- Create: `src/components/SubscribeWall.css`

**Interfaces:**
- Consumes: `POST /api/mp/create-subscription` (Task 4), `apiRequest` from `src/config.js`.
- Produces: `<SubscribeWall subscription={subscription} />` — a full-screen component with no children/render-prop API. Consumed by Task 11's `PaymentGate.jsx`.

- [ ] **Step 1: Create the component**

```jsx
import { useState } from 'react';
import { Crown, Check, Loader2 } from 'lucide-react';
import { apiRequest } from '../config';
import './SubscribeWall.css';

const STATUS_COPY = {
  trial_expired: 'Tu período de prueba de 7 días terminó.',
  blocked: 'Tu suscripción fue pausada o cancelada en Mercado Pago.',
  past_due: 'Hubo un problema con tu último cobro.',
  no_subscription: 'Todavía no activaste tu suscripción.'
};

function SubscribeWall({ subscription }) {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const reason = subscription?.status || 'no_subscription';
  const message = STATUS_COPY[reason] || STATUS_COPY.no_subscription;

  const handleSubscribe = async () => {
    const storeId = localStorage.getItem('promonube_store_id');
    setLoadingCheckout(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest('/api/mp/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ storeId })
      });
      if (data.success && data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        setErrorMsg(data.error || 'No se pudo iniciar la suscripción');
        setLoadingCheckout(false);
      }
    } catch (err) {
      console.error('Error creando suscripción:', err);
      setErrorMsg('No se pudo conectar con Mercado Pago. Intentá de nuevo.');
      setLoadingCheckout(false);
    }
  };

  return (
    <div className="subscribe-wall">
      <div className="subscribe-wall-card">
        <Crown size={48} className="subscribe-wall-icon" />
        <h1>Suscribite para continuar</h1>
        <p className="subscribe-wall-message">{message}</p>

        <div className="subscribe-wall-price">
          <span className="currency">ARS</span>
          <span className="amount">$60.000</span>
          <span className="period">/mes</span>
        </div>

        <ul className="subscribe-wall-features">
          <li><Check size={18} /> Cupones Inteligentes</li>
          <li><Check size={18} /> Gift Cards</li>
          <li><Check size={18} /> Ruleta de Premios</li>
          <li><Check size={18} /> Cuenta Regresiva</li>
          <li><Check size={18} /> Style Pro</li>
          <li><Check size={18} /> Pop-ups</li>
        </ul>

        {errorMsg && <div className="subscribe-wall-error">{errorMsg}</div>}

        <button
          className="btn-subscribe-wall"
          onClick={handleSubscribe}
          disabled={loadingCheckout}
        >
          {loadingCheckout ? <Loader2 size={20} className="spinner" /> : 'Suscribirme con Mercado Pago'}
        </button>

        <p className="subscribe-wall-note">
          Se te va a pedir que autorices una tarjeta en Mercado Pago. El cobro es mensual y automático.
        </p>
      </div>
    </div>
  );
}

export default SubscribeWall;
```

- [ ] **Step 2: Create the stylesheet**

```css
.subscribe-wall {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #7C7CFF 0%, #6969FF 100%);
}

.subscribe-wall-card {
  background: var(--gl-bg-card);
  border-radius: 24px;
  padding: 48px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.subscribe-wall-icon {
  color: #F59E0B;
  margin-bottom: 16px;
}

.subscribe-wall-card h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--gl-text-primary);
  margin-bottom: 12px;
}

.subscribe-wall-message {
  font-size: 16px;
  color: var(--gl-text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.subscribe-wall-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 24px;
}

.subscribe-wall-price .currency {
  font-size: 14px;
  color: var(--gl-text-secondary);
  font-weight: 600;
}

.subscribe-wall-price .amount {
  font-size: 40px;
  font-weight: 800;
  color: var(--gl-text-primary);
}

.subscribe-wall-price .period {
  font-size: 16px;
  color: var(--gl-text-secondary);
}

.subscribe-wall-features {
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.subscribe-wall-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--gl-text-primary);
  font-size: 15px;
}

.subscribe-wall-features li svg {
  color: #10B981;
  flex-shrink: 0;
}

.subscribe-wall-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #EF4444;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn-subscribe-wall {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #7C7CFF, #6969FF);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.btn-subscribe-wall:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(124, 124, 255, 0.3);
}

.btn-subscribe-wall:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-subscribe-wall .spinner {
  animation: subscribe-wall-spin 1s linear infinite;
}

@keyframes subscribe-wall-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.subscribe-wall-note {
  margin-top: 16px;
  font-size: 13px;
  color: var(--gl-text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SubscribeWall.jsx src/components/SubscribeWall.css
git commit -m "feat: add full-screen subscribe wall for blocked stores"
```

---

## Task 11: Frontend — `PaymentGate`, wire into routing, remove `UpgradeModal`

**Files:**
- Create: `src/components/PaymentGate.jsx`
- Modify: `src/components/AppLayout.jsx`
- Delete: `src/components/UpgradeModal.jsx`
- Delete: `src/components/UpgradeModal.css`

**Interfaces:**
- Consumes: `useSubscription()` (Task 9), `<SubscribeWall />` (Task 10).
- Produces: `<PaymentGate />` — no props, reads `useLocation()` itself, renders either `<Outlet />` (access granted or on an exempt path), a loading spinner, or `<SubscribeWall />`.

`/admin` is exempted from the gate: it has its own separate `x-admin-key` authentication and must stay reachable even if the store's own subscription is blocked (otherwise there'd be no way to grant a courtesy month to a blocked store from inside the app).

- [ ] **Step 1: Create `PaymentGate.jsx`**

```jsx
import { Outlet, useLocation } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import SubscribeWall from './SubscribeWall';

const GATE_EXEMPT_PATHS = ['/admin'];

function PaymentGate() {
  const location = useLocation();
  const { subscription, hasAccess, loading } = useSubscription();

  if (GATE_EXEMPT_PATHS.some(path => location.pathname.startsWith(path))) {
    return <Outlet />;
  }

  if (loading || hasAccess === null) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SubscribeWall subscription={subscription} />;
  }

  return <Outlet />;
}

export default PaymentGate;
```

(`.loading-container`/`.spinner-large` classes already exist globally — used the same way in `Dashboard.jsx`'s own loading state.)

- [ ] **Step 2: Wire it into `AppLayout.jsx`**

old_string:
```jsx
      {/* Page content */}
      <div className="app-layout-content">
        <Outlet />
      </div>
```

new_string:
```jsx
      {/* Page content */}
      <div className="app-layout-content">
        <PaymentGate />
      </div>
```

And add the import at the top of `src/components/AppLayout.jsx`:

old_string:
```jsx
import Sidebar from './Sidebar';
import './AppLayout.css';
```

new_string:
```jsx
import Sidebar from './Sidebar';
import PaymentGate from './PaymentGate';
import './AppLayout.css';
```

- [ ] **Step 3: Delete `UpgradeModal`**

Run:
```bash
rm src/components/UpgradeModal.jsx src/components/UpgradeModal.css
```

(Task 12, done next, rewrites the one remaining file that imports it — `Dashboard.jsx`. Do not run `npm run build` as a checkpoint until after Task 12, since it will still fail on the now-broken import until then. That's expected and fine to leave broken between these two tasks in the same PR/branch — just don't ship this task in isolation.)

- [ ] **Step 4: Commit**

```bash
git add -A src/components/PaymentGate.jsx src/components/AppLayout.jsx
git rm src/components/UpgradeModal.jsx src/components/UpgradeModal.css
git commit -m "feat: add PaymentGate that blocks the app when subscription access is lost"
```

---

## Task 12: Frontend — simplify `Dashboard.jsx` for all-or-nothing access

**Files:**
- Modify: `src/pages/Dashboard.jsx` (full rewrite — see rationale below)

**Interfaces:**
- Consumes: `useSubscription()` (Task 9's new shape), `<SubscriptionBanner subscription={subscription} />` (existing component, untouched).
- Produces: nothing new consumed elsewhere.

**Why a full rewrite instead of a diff:** `Dashboard.jsx` today implements per-module locking (`isModuleBlocked`, `feature.available`, `feature.blocked`, lock overlays, an `UpgradeModal` trigger) that only made sense under the old per-module plan system. Since `PaymentGate` (Task 11) now blocks the *entire* route before `Dashboard` ever mounts, every feature card is always unlocked whenever this component renders — the lock UI, `showUpgradeModal` state, `handleFeatureClick`'s branch, `handleChargeReturn` (calls the now-deleted `confirm-charge` endpoint), and the dead `handleSelectPlan` (unused, opened the old TiendaNube apps panel) all become either dead or actively broken. These are removed together because they're interdependent — removing `isModuleBlocked` without also removing every `feature.blocked`/`feature.available` reference leaves the file in a broken intermediate state.

- [ ] **Step 1: Rewrite the file**

Full replacement of `src/pages/Dashboard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, CreditCard, Sparkles, Clock, Palette, Shield, BadgeCheck, Bell, Rocket, ChevronRight, ShoppingBag, Image } from 'lucide-react';
import { apiRequest } from '../config';
import { useSubscription } from '../hooks/useSubscription';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AdminPanel from '../components/AdminPanel';
import OnboardingWizard from '../components/OnboardingWizard';
import './Dashboard.css';

const STATUS_BADGE_LABEL = {
  trialing: '🎁 TRIAL',
  active: '⚡ PRO',
  courtesy: '🎉 CORTESÍA',
  free_forever: '💚 GRATIS'
};

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    typeof window !== 'undefined' && !localStorage.getItem('gl_onboarding_done')
  );
  const { subscription, reload } = useSubscription();

  useEffect(() => {
    loadStoreInfo();

    const handleFocus = () => reload();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadStoreInfo = async () => {
    const storeId = localStorage.getItem('promonube_store_id');

    if (!storeId) {
      navigate('/');
      return;
    }

    try {
      const data = await apiRequest(`/store-info?storeId=${storeId}`);

      if (data.success) {
        setStoreInfo(data);
      } else {
        console.error('Error loading store info:', data);
        navigate('/');
      }
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('promonube_store_id');
    localStorage.removeItem('promonube_user_id');
    navigate('/');
  };

  // PaymentGate ya garantiza acceso antes de que este componente se monte —
  // todos los módulos están disponibles siempre que el Dashboard se renderiza.
  const mainFeatures = [
    {
      icon: Palette,
      title: 'Style',
      description: 'Mejorá el diseño de tu web y llevá tu tienda a nivel profesional sin tocar código. Personalizá banners, botones, menús, íconos y categorías para destacarte y vender más.',
      path: '/style',
      featured: true,
      badge: '⭐ Recomendado'
    },
    {
      icon: Clock,
      title: 'Cuenta Regresiva',
      description: 'Creá temporizadores para anunciar lanzamientos, promociones o eventos. Generá urgencia (FOMO) mostrando cuándo empieza o termina una oferta, evento o flash sale.',
      path: '/countdown'
    },
    {
      icon: BadgeCheck,
      title: 'Badges en Productos',
      description: 'Destacá productos con etiquetas visuales: Nuevo, Descuento, Envío Gratis, Últimas Unidades, Novedad, etc. Ideal para comunicar información clave sin texto extra.',
      path: '/badges',
      badge: '✨ Nuevo'
    },
    {
      icon: Tag,
      title: 'Cupones',
      description: 'Creá cupones de descuento masivos en segundos. Generá múltiples cupones con distintas reglas (prefijos, descuentos, usos) sin hacerlo manualmente, ideal para juegos, campañas o influencers.',
      path: '/coupons'
    },
    {
      icon: Sparkles,
      title: 'Ruleta de Descuentos',
      description: 'Sumá una ruleta personalizada para aumentar la tasa de conversión. El diferencial: cada cupón es único por usuario y se desactiva automáticamente si no se usa, brindando más seguridad al dueño de la tienda.',
      path: '/spin-wheel'
    },
    {
      icon: CreditCard,
      title: 'Gift Cards',
      description: 'Creá gift cards con diseño personalizado e identidad propia. Diferencialas por evento, fecha o campaña. Simples, visuales y listas para vender.',
      path: '/gift-cards'
    },
    {
      icon: ShoppingBag,
      title: 'Shop the Look',
      description: 'Marcá productos directamente sobre una imagen y dejá que tus clientes los agreguen al carrito sin salir. Ideal para lookbooks, outfits y colecciones.',
      path: '/shop-the-look',
      badge: '✨ Nuevo'
    },
    {
      icon: Image,
      title: 'Banner Home',
      description: 'Agregá un banner personalizado en tu home con imagen de fondo, textos y botones. Controlá el ancho, la posición y el diseño para destacar tus campañas.',
      path: '/banner',
      badge: '✨ Nuevo'
    },
    {
      icon: Bell,
      title: 'Pop-ups',
      description: 'Mostrá ofertas y capturá emails con pop-ups personalizados. Targeting por página, exit intent, delay y más triggers. Aumentá conversiones desde el primer día.',
      path: '/popups',
      badge: '✨ Nuevo'
    }
  ];

  const handleFeatureClick = (feature) => {
    localStorage.setItem('gl_onboarding_done', '1');
    navigate(feature.path);
  };

  // Mostrar panel de admin si el usuario presiona Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAdminPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Cargando tu workspace...</p>
      </div>
    );
  }

  const statusBadgeLabel = STATUS_BADGE_LABEL[subscription?.status] || '⚡ PRO';

  return (
    <div className="dashboard-container">
      {/* Panel de Admin (oculto por defecto, Ctrl+Shift+A para mostrar) */}
      {showAdminPanel && (
        <div className="admin-panel-overlay">
          <AdminPanel />
          <button
            className="close-admin-panel"
            onClick={() => setShowAdminPanel(false)}
          >
            ✕ Cerrar
          </button>
        </div>
      )}

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="brand">
              <div className="brand-left">
                <div className="brand-name">{storeInfo?.store?.storeName || 'Mi tienda'}</div>
                <span className="plan-badge-inline">
                  {statusBadgeLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="header-center">
            <span className="app-title">GlowLab</span>
          </div>

          <div className="header-right">
            <button
              className="btn-admin-access"
              onClick={() => setShowAdminPanel(true)}
              title="Panel Admin (Ctrl+Shift+A)"
            >
              <Shield size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Subscription Status Banner */}
        <SubscriptionBanner subscription={subscription} />

        {/* Welcome Banner — botón para reabrir el tour si ya lo cerró */}
        {!showOnboarding && localStorage.getItem('gl_onboarding_done') && (
          <div className="welcome-banner welcome-banner-compact">
            <div className="wb-left">
              <Rocket size={20} className="wb-icon" />
              <span className="wb-title-compact">¿Necesitás ayuda para empezar?</span>
            </div>
            <button
              className="wb-cta"
              onClick={() => { localStorage.removeItem('gl_onboarding_done'); setShowOnboarding(true); }}
            >
              Ver tour rápido <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Modules Section */}
        <div className="modules-header">
          <h2>Módulos</h2>
          <p className="modules-subtitle">Activá los que necesites, funciona sin instalar nada extra en tu tienda</p>
        </div>

        {/* Main Features Grid */}
        <div className="features-grid-modern">
          {mainFeatures.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={index}
                className={`feature-card-modern ${feature.featured ? 'featured' : ''}`}
                onClick={() => handleFeatureClick(feature)}
                style={{ cursor: 'pointer' }}
              >
                {feature.badge && (
                  <div className={`module-badge ${feature.featured ? 'featured-badge' : 'active-badge'}`}>{feature.badge}</div>
                )}

                <div className="feature-card-gradient" style={{ background: feature.gradient }}></div>
                <div className="feature-card-content">
                  <div className="feature-icon-large">
                    <Icon size={32} strokeWidth={2} />
                  </div>
                  <h3 className="feature-title-modern">{feature.title}</h3>
                  <p className="feature-description-modern">{feature.description}</p>

                  <button className="btn-feature-modern">
                    Abrir {feature.title}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Onboarding Wizard - usuario nuevo */}
      {showOnboarding && (
        <OnboardingWizard
          storeId={localStorage.getItem('promonube_store_id')}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
```

Notes on what intentionally did **not** carry over from the old file: `handleChargeReturn` (called the deleted `/api/subscription/confirm-charge`), `handleSelectPlan` (dead code, never called), the `toast` import/`useToast()` call (only used inside the two removed handlers), and the `Lock` icon import (only used by the removed lock overlay). `handleLogout` is kept as-is even though it was already unused before this change (pre-existing, unrelated to this feature — not in scope to clean up here).

- [ ] **Step 2: Manual verification in the browser**

Run: `npm run dev` from the repo root, with `VITE_API_URL` pointed at your local backend from earlier tasks.
1. Log in as a test store whose `stores/{id}/subscription/current` has `status: 'trialing'` and a future `trialEndsAt` (from Task 3's install flow, or set manually in Firestore).
2. Navigate to `/dashboard` — expect the full module grid with no lock overlays, and the header badge showing "🎁 TRIAL".
3. Click any feature card (e.g. "Style") — expect direct navigation to `/style`, no modal.
4. In Firestore, edit that same test store's doc to `status: 'blocked'`, reload `/dashboard` in the browser (or wait for the `focus` listener to refetch) — expect `PaymentGate` (Task 11) to intercept and show `SubscribeWall` instead of the Dashboard.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "refactor: simplify Dashboard for all-or-nothing subscription access"
```

---

## Task 13: Frontend — update `Sidebar.jsx` badge

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `useSubscription()` (Task 9's new shape — `subscription.status` instead of `subscription.plan`/`subscription.isDemoAccount`).

- [ ] **Step 1: Update the badge helpers**

old_string:
```jsx
  const getPlanClass = () => {
    if (subscription?.isDemoAccount) return 'demo';
    if (subscription?.plan === 'pro') return 'pro';
    return 'free';
  };

  const getPlanLabel = () => {
    if (subscription?.isDemoAccount) return '👑 DEMO';
    if (subscription?.plan === 'pro') return '⚡ PRO';
    return '📦 FREE';
  };
```

new_string:
```jsx
  const getPlanClass = () => {
    if (subscription?.status === 'active') return 'pro';
    if (subscription?.freeForever || subscription?.status === 'courtesy') return 'demo';
    return 'free';
  };

  const getPlanLabel = () => {
    if (subscription?.status === 'active') return '⚡ PRO';
    if (subscription?.freeForever) return '💚 GRATIS';
    if (subscription?.status === 'courtesy') return '🎉 CORTESÍA';
    if (subscription?.status === 'trialing') return '🎁 TRIAL';
    return '📦 FREE';
  };
```

- [ ] **Step 2: Manual verification**

With the dev server running (from Task 12's Step 2), confirm the sidebar footer badge shows "🎁 TRIAL" for the trialing test store, matching the header badge in `Dashboard.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "refactor: update Sidebar plan badge for new subscription status values"
```

---

## Task 14: Frontend — `PaymentSuccess.jsx` polling

**Files:**
- Modify: `src/pages/PaymentSuccess.jsx`

**Interfaces:**
- Consumes: `GET /api/subscription/:storeId/status` (Task 6).

**Why:** MP's webhook (Task 5) can land a moment after MP redirects the browser back to `back_url`. Today's `PaymentSuccess.jsx` doesn't check anything — it just shows a static "success" message keyed off old per-plan names (`promopack`/`premiumpack`/`unlimited`, which no longer exist) and redirects after a fixed 5s. This rewrite polls `/status` until `hasAccess` flips true (or times out), and drops the dead plan-name lookup.

- [ ] **Step 1: Rewrite the component**

Full replacement of `src/pages/PaymentSuccess.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../config';
import './PaymentSuccess.css';

const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

function PaymentSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'confirmed' | 'timeout'

  useEffect(() => {
    const storeId = localStorage.getItem('promonube_store_id');
    if (!storeId) {
      navigate('/dashboard');
      return;
    }

    let cancelled = false;

    const poll = async (attempt) => {
      try {
        const data = await apiRequest(`/api/subscription/${storeId}/status`);
        if (data.success && data.hasAccess) {
          if (!cancelled) setStatus('confirmed');
          return;
        }
      } catch (err) {
        console.error('Error consultando estado de suscripción:', err);
      }

      if (cancelled) return;

      if (attempt >= POLL_ATTEMPTS) {
        setStatus('timeout');
        return;
      }

      setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
    };

    poll(1);

    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (status !== 'confirmed') return;
    const timer = setTimeout(() => navigate('/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  return (
    <div className="payment-result-container">
      <div className="payment-result-card success">
        <div className="success-icon-wrapper">
          <CheckCircle size={80} className="success-icon" />
        </div>

        <h1 className="result-title">
          {status === 'confirmed' ? '¡Suscripción Activa! 🎉' : 'Confirmando tu pago...'}
        </h1>

        <p className="result-message">
          {status === 'checking' && 'Estamos confirmando tu suscripción con Mercado Pago, un momento.'}
          {status === 'confirmed' && 'Tu suscripción a PromoNube Pro ya está activa.'}
          {status === 'timeout' && 'El pago se está procesando. Puede demorar unos minutos en reflejarse — si no ves los cambios, volvé a entrar al dashboard en breve.'}
        </p>

        {(status === 'checking' || status === 'confirmed') && (
          <div className="countdown-redirect">
            <Loader2 size={16} className="spinner" />
            <span>{status === 'checking' ? 'Verificando...' : 'Redirigiendo al dashboard...'}</span>
          </div>
        )}

        <button
          className="btn-return"
          onClick={() => navigate('/dashboard')}
        >
          Ir al Dashboard
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default PaymentSuccess;
```

- [ ] **Step 2: Manual verification**

Complete a sandbox subscription authorization (Task 4/5's flow), let MP redirect to `/#/payment-success`. Expect: "Confirmando tu pago..." briefly, then (once the webhook lands and `hasAccess` is `true`) "¡Suscripción Activa! 🎉" followed by an automatic redirect to `/dashboard` after 2s.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PaymentSuccess.jsx
git commit -m "feat: poll subscription status on payment-success before redirecting"
```

---

## Task 15: Frontend — `AdminPanel.jsx` free-forever / courtesy-month controls

**Files:**
- Modify: `src/pages/AdminPanel.jsx`

**Interfaces:**
- Consumes: `POST /api/admin/set-free-forever`, `POST /api/admin/grant-courtesy-month`, `POST /api/admin/reset-all-trials`, updated `GET /api/admin/stores` shape (all from Task 8).

- [ ] **Step 1: Replace the demo-day quick-action bar with free-forever/courtesy actions**

old_string:
```jsx
  const [quickStoreId, setQuickStoreId] = useState('');
  const [quickDays, setQuickDays] = useState('36500');
  const [loading, setLoading] = useState(false);
```

new_string:
```jsx
  const [quickStoreId, setQuickStoreId] = useState('');
  const [loading, setLoading] = useState(false);
```

old_string:
```jsx
  const activateDemo = async (storeId, days = 30) => {
    if (!confirm(`¿Activar demo de ${days} días para store ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await fetch('https://apipromonube-jlfopowzaq-uc.a.run.app/api/admin/activate-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          storeId,
          expirationDays: parseInt(days)
        })
      }).then(r => r.json());

      if (response.success) {
        toast.success(`Demo activada hasta ${new Date(response.expiresAt).toLocaleDateString()}`);
        loadStores();
      } else {
        toast.error('Error: ' + response.message);
      }
    } catch (error) {
      toast.error('Error activando demo');
    } finally {
      setProcessingStore(null);
    }
  };

  const deactivateDemo = async (storeId) => {
    if (!confirm(`¿Desactivar demo para store ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/deactivate-plan', {
        method: 'POST',
        body: JSON.stringify({ storeId })
      });

      if (response.success) {
        toast.success('Demo desactivada');
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error desactivando demo');
    } finally {
      setProcessingStore(null);
    }
  };
```

new_string:
```jsx
  const setFreeForever = async (storeId, freeForever) => {
    const verb = freeForever ? 'marcar como gratis permanente' : 'quitar el estado de gratis permanente de';
    if (!confirm(`¿Confirmás ${verb} la tienda ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/set-free-forever', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ storeId, freeForever })
      });

      if (response.success) {
        toast.success(response.message);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error actualizando la tienda');
    } finally {
      setProcessingStore(null);
    }
  };

  const grantCourtesyMonth = async (storeId) => {
    if (!confirm(`¿Dar un mes de cortesía a la tienda ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/grant-courtesy-month', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ storeId })
      });

      if (response.success) {
        toast.success(`Cortesía otorgada hasta ${new Date(response.courtesyUntil).toLocaleDateString()}`);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error otorgando cortesía');
    } finally {
      setProcessingStore(null);
    }
  };

  const resetAllTrials = async () => {
    if (!confirm('Esto reinicia TODAS las tiendas a un trial de 7 días, incluidas las que ya pagaban. Es para usar UNA SOLA VEZ al desplegar el nuevo sistema de pagos. ¿Confirmás?')) return;

    setLoading(true);
    try {
      const response = await apiRequest('/api/admin/reset-all-trials', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });

      if (response.success) {
        toast.success(`${response.processed} tiendas reiniciadas a trial de 7 días`);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error reiniciando trials');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Replace the top quick-action bar**

old_string:
```jsx
      {/* Quick Action - Activar Trial */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
        border: '1px solid rgba(102,126,234,0.35)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <Sparkles size={18} color="#667eea" />
        <strong style={{color:'rgba(255,255,255,0.9)', fontSize:'14px', whiteSpace:'nowrap'}}>Activar Trial Rápido:</strong>
        <input
          type="text"
          placeholder="Store ID (ej: 5320806)"
          value={quickStoreId}
          onChange={e => setQuickStoreId(e.target.value)}
          style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(102,126,234,0.4)', background:'rgba(255,255,255,0.08)', color:'#fff', width:'180px', outline:'none'}}
        />
        <select value={quickDays} onChange={e => setQuickDays(e.target.value)}
          style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(102,126,234,0.4)', background:'rgba(20,20,40,0.95)', color:'#fff', cursor:'pointer'}}>
          <option value="36500">♾️ Ilimitado (100 años)</option>
          <option value="365">365 días</option>
          <option value="90">90 días</option>
          <option value="30">30 días</option>
        </select>
        <button
          onClick={() => { if (quickStoreId) activateDemo(quickStoreId, parseInt(quickDays)); }}
          disabled={!quickStoreId || processingStore === quickStoreId}
          style={{padding:'8px 20px', borderRadius:'8px', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', border:'none', cursor:'pointer', fontWeight:'600', opacity: !quickStoreId ? 0.5 : 1}}
        >
          {processingStore === quickStoreId ? 'Activando...' : '✨ Activar'}
        </button>
      </div>
```

new_string:
```jsx
      {/* Quick Actions - Gratis permanente / Mes de cortesía */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
        border: '1px solid rgba(102,126,234,0.35)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <Sparkles size={18} color="#667eea" />
        <strong style={{color:'rgba(255,255,255,0.9)', fontSize:'14px', whiteSpace:'nowrap'}}>Acción rápida:</strong>
        <input
          type="text"
          placeholder="Store ID (ej: 5320806)"
          value={quickStoreId}
          onChange={e => setQuickStoreId(e.target.value)}
          style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(102,126,234,0.4)', background:'rgba(255,255,255,0.08)', color:'#fff', width:'180px', outline:'none'}}
        />
        <button
          onClick={() => { if (quickStoreId) setFreeForever(quickStoreId, true); }}
          disabled={!quickStoreId || processingStore === quickStoreId}
          style={{padding:'8px 20px', borderRadius:'8px', background:'linear-gradient(135deg,#10B981,#059669)', color:'#fff', border:'none', cursor:'pointer', fontWeight:'600', opacity: !quickStoreId ? 0.5 : 1}}
        >
          💚 Gratis permanente
        </button>
        <button
          onClick={() => { if (quickStoreId) grantCourtesyMonth(quickStoreId); }}
          disabled={!quickStoreId || processingStore === quickStoreId}
          style={{padding:'8px 20px', borderRadius:'8px', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', border:'none', cursor:'pointer', fontWeight:'600', opacity: !quickStoreId ? 0.5 : 1}}
        >
          🎉 Mes de cortesía
        </button>
        <button
          onClick={resetAllTrials}
          disabled={loading}
          style={{padding:'8px 20px', borderRadius:'8px', background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.4)', cursor:'pointer', fontWeight:'600', marginLeft:'auto'}}
          title="Uso único al desplegar el nuevo sistema de pagos"
        >
          ⚠️ Resetear todas a trial (7 días)
        </button>
      </div>
```

- [ ] **Step 3: Update the stats cards and table rendering for the new subscription shape**

old_string:
```jsx
  const stats = {
    totalStores: stores.length,
    activeStores: stores.filter(s => s.subscription?.status === 'active' || s.subscription?.status === 'demo').length,
    demoAccounts: stores.filter(s => s.subscription?.isDemoAccount).length,
    uninstalls: uninstalls.length
  };
```

new_string:
```jsx
  const stats = {
    totalStores: stores.length,
    activeStores: stores.filter(s => s.subscription?.status === 'active').length,
    freeForeverStores: stores.filter(s => s.subscription?.freeForever).length,
    uninstalls: uninstalls.length
  };
```

old_string:
```jsx
        <div className="stat-card">
          <div className="stat-icon demo">
            <Sparkles size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.demoAccounts}</span>
            <span className="stat-label">Cuentas DEMO</span>
          </div>
        </div>
```

new_string:
```jsx
        <div className="stat-card">
          <div className="stat-icon demo">
            <Sparkles size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.freeForeverStores}</span>
            <span className="stat-label">Gratis Permanente</span>
          </div>
        </div>
```

old_string:
```jsx
              {filteredStores.map((store) => {
                const sub = store.subscription || {};
                const isDemo = sub.isDemoAccount;
                const isActive = sub.status === 'active' || sub.status === 'demo';
                const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
                const isExpired = expiresAt && expiresAt < new Date();
                const modules = sub.modules || {};

                return (
                  <tr key={store.storeId} className={isDemo ? 'demo-row' : ''}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="store-id">{store.storeId}</td>
                    <td>
                      <span className={`plan-badge ${sub.plan || 'free'}`}>
                        {isDemo ? '👑 DEMO' : sub.plan === 'pro' ? '⚡ PRO' : '📦 FREE'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${isActive && !isExpired ? 'active' : 'inactive'}`}>
                        {isExpired ? '❌ Expirado' : isActive ? '✅ Activo' : '⏸️ Inactivo'}
                      </span>
                    </td>
                    <td className="modules-cell">
                      <div className="modules-list">
                        {modules.coupons && <span className="module-tag">coupons</span>}
                        {modules.giftcards && <span className="module-tag">giftcards</span>}
                        {modules.spinWheel && <span className="module-tag">spinWheel</span>}
                        {modules.countdown && <span className="module-tag">countdown</span>}
                        {modules.style && <span className="module-tag">style</span>}
                      </div>
                    </td>
                    <td>
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td className={isExpired ? 'expired-date' : ''}>
                      {expiresAt ? expiresAt.toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {!isDemo ? (
                          <select
                            onChange={(e) => {
                              const days = parseInt(e.target.value);
                              if (days) activateDemo(store.storeId, days);
                              e.target.value = '';
                            }}
                            disabled={processingStore === store.storeId}
                            className="action-select"
                          >
                            <option value="">Activar Demo...</option>
                            <option value="36500">♾️ Ilimitado</option>
                            <option value="365">365 días</option>
                            <option value="90">90 días</option>
                            <option value="60">60 días</option>
                            <option value="30">30 días</option>
                            <option value="15">15 días</option>
                            <option value="7">7 días</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => deactivateDemo(store.storeId)}
                            disabled={processingStore === store.storeId}
                            className="btn-deactivate-small"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
```

new_string:
```jsx
              {filteredStores.map((store) => {
                const sub = store.subscription || {};
                const statusLabel = {
                  active: '⚡ Activo',
                  trialing: '🎁 Trial',
                  courtesy: '🎉 Cortesía',
                  blocked: '❌ Bloqueado',
                  past_due: '⚠️ Pago pendiente'
                }[sub.status] || sub.status || '-';
                const modules = sub.modules || {};
                const untilDate = sub.status === 'trialing' ? sub.trialEndsAt
                  : sub.status === 'courtesy' ? sub.courtesyUntil
                  : sub.currentPeriodEnd;

                return (
                  <tr key={store.storeId} className={sub.freeForever ? 'demo-row' : ''}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="store-id">{store.storeId}</td>
                    <td>
                      <span className={`plan-badge ${sub.freeForever ? 'pro' : 'free'}`}>
                        {sub.freeForever ? '💚 GRATIS' : statusLabel}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${sub.freeForever || sub.status === 'active' || sub.status === 'trialing' || sub.status === 'courtesy' ? 'active' : 'inactive'}`}>
                        {sub.freeForever ? '✅ Gratis permanente' : statusLabel}
                      </span>
                    </td>
                    <td className="modules-cell">
                      <div className="modules-list">
                        {modules.coupons && <span className="module-tag">coupons</span>}
                        {modules.giftcards && <span className="module-tag">giftcards</span>}
                        {modules.spinWheel && <span className="module-tag">spinWheel</span>}
                        {modules.countdown && <span className="module-tag">countdown</span>}
                        {modules.style && <span className="module-tag">style</span>}
                      </div>
                    </td>
                    <td>
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td>
                      {untilDate ? new Date(untilDate).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {!sub.freeForever ? (
                          <button
                            onClick={() => setFreeForever(store.storeId, true)}
                            disabled={processingStore === store.storeId}
                            className="action-select"
                          >
                            💚 Marcar gratis
                          </button>
                        ) : (
                          <button
                            onClick={() => setFreeForever(store.storeId, false)}
                            disabled={processingStore === store.storeId}
                            className="btn-deactivate-small"
                          >
                            Quitar gratis
                          </button>
                        )}
                        <button
                          onClick={() => grantCourtesyMonth(store.storeId)}
                          disabled={processingStore === store.storeId}
                          className="action-select"
                        >
                          🎉 Cortesía
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
```

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, navigate to `/admin`, log in with the admin key.
1. Confirm the table renders without console errors and shows the new status labels for the seeded test stores.
2. Use the top quick-action bar to mark a store "Gratis permanente" — confirm the toast, the row updating (`💚 GRATIS` badge), and re-querying `GET /api/admin/stores` (via the Network tab) shows `freeForever: true`.
3. Grant a courtesy month to another store — confirm the toast shows a date ~30 days out, and the row's last column updates.
4. **Do not** click "Resetear todas a trial" against production data during this check — verify it only against local/test Firestore data, since it touches every store.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminPanel.jsx
git commit -m "feat: replace demo controls in AdminPanel with free-forever/courtesy-month actions"
```

---

## Final integration check (not a separate task — run after Task 15)

- [ ] `cd functions && node -c index.js` — syntax OK.
- [ ] `cd functions && node --test subscriptionAccess.test.js` — all tests pass.
- [ ] `npm run build` from the repo root — no compile errors (this is the first point where every frontend file touched by this plan is consistent with every other — Tasks 9, 11, 12, 13 all had to land together for the build to be clean).
- [ ] `npm run lint` from the repo root — no new lint errors introduced by this plan's files.
- [ ] End-to-end manual pass in the browser against the local backend (sandbox MP token): fresh install → 7-day trial dashboard access → force `trialEndsAt` into the past in Firestore → confirm `PaymentGate` blocks with `SubscribeWall` → click subscribe → complete MP sandbox authorization → confirm `PaymentSuccess` polling flips to confirmed → confirm `/dashboard` is reachable again.
- [ ] Confirm in Railway's environment variables that `MP_ACCESS_TOKEN` is switched to the **production** token only when ready to go live (this plan's manual-verification steps all assume the sandbox token during development).
