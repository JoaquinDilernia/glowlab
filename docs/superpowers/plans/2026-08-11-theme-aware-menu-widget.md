# Theme-Aware Menu Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GlowLab style-widget's menu customization (`customizeMenu()`) detect the client store's Tiendanube theme and use the correct DOM selectors for that theme, instead of hardcoded selectors tuned only for the "Rio" theme — and start recording which themes real installs are using so future theme support can be prioritized.

**Architecture:** Every Tiendanube storefront exposes `window.LS.theme` (`{code, name, custom}`) client-side — this is a reliable, zero-guessing signal for which theme is rendering the page. We add a small server-side selector-config module (`functions/theme-menu-selectors.js`) mapping known theme `code`s to verified DOM selectors. The `/api/style-widget.js` endpoint embeds that map as JSON into the generated client script; `customizeMenu()` reads `window.LS.theme.code`, looks up the matching selector set, and uses it directly — falling back to the existing heuristic scan (today's behavior, unchanged) for themes not yet mapped. A new lightweight beacon reports each detected theme back to `promonube_stores/{storeId}.detectedTheme` in Firestore, throttled to once per browser per day.

**Tech Stack:** Node.js 22 (Express, Firebase Admin/Firestore) in `functions/index.js`; plain browser JS (no framework) for the injected/eval'd widget script; Node's built-in `node:test` runner for the new pure-logic unit tests (no new dependency).

## Global Constraints

- Production for this backend runs on **Railway** (`glowlab-production.up.railway.app`), not Firebase Functions/Cloud Run — `firebase deploy` does NOT update prod. Deploy by pushing to whatever branch/remote Railway is tracking (check `railway status` / the Railway dashboard if unsure) before doing any live verification against real stores.
- Do not change the existing heuristic desktop/mobile menu-detection behavior — it must remain the fallback path for any theme code not explicitly mapped (including `custom: true` bespoke themes), so no currently-working store regresses.
- Reference stores used for verification (both real, live, already-inspected in this session):
  - `https://altorancho.com/` — theme `rio` (works today, must keep working — regression check).
  - `https://tallertextildoscoyotes.mitiendanube.com/` — theme `new_linkedman` ("Simple") — currently broken, target of this fix.
- Verified selector data (confirmed live via browser inspection, do not re-derive):
  - **rio**: mobile `#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a` (8/8 links matched); desktop container `.js-nav-desktop-list.nav-desktop-list`, items are its direct `<li>` children (8/8 matched).
  - **new_linkedman**: mobile `#nav-hamburger ul.list-items > li > a` (6/6 links matched); desktop container `.js-desktop-nav-first-level`, items are its direct `<li>` children (6/6 matched).
  - Desktop link resolution per `<li>` (works for both themes, keep as shared helper, not per-theme config): try `:scope > a`, then `:scope > div.nav-item-container > a`, then first `a` anywhere inside.
- `functions/index.js` cannot be `require()`'d standalone in a local/dev shell — module load calls `admin.storage().bucket()` which throws without real Firebase credentials (`Bucket name not specified or invalid`), unrelated to this plan's changes. Use `node --check functions/index.js` (parses syntax only, does not execute) for any local sanity check instead of `node -e "require(...)"`.

---

## Task 1: `theme-menu-selectors.js` — theme → selector config module

**Files:**
- Create: `functions/theme-menu-selectors.js`
- Create: `functions/theme-menu-selectors.test.js`
- Modify: `functions/package.json` (add `test` script)

**Interfaces:**
- Produces (used by Task 2):
  - `resolveMenuSelectors(themeCode: string|null|undefined) -> { mobileLinkSelector: string|null, desktopContainerSelector: string|null }`
  - `getClientSelectorMap() -> { [themeCode: string]: {mobileLinkSelector, desktopContainerSelector}, __default__: {mobileLinkSelector: null, desktopContainerSelector: null} }` — JSON-serializable, safe to embed via `JSON.stringify()` into the generated browser script.
  - `THEME_MENU_SELECTORS`, `DEFAULT_MENU_SELECTORS` (exported constants, used directly by the tests).

- [ ] **Step 1: Write the failing tests**

Create `functions/theme-menu-selectors.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveMenuSelectors,
  DEFAULT_MENU_SELECTORS,
  getClientSelectorMap,
} = require("./theme-menu-selectors");

test("resolveMenuSelectors returns the verified Rio selector set", () => {
  const sel = resolveMenuSelectors("rio");
  assert.equal(
    sel.mobileLinkSelector,
    "#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a"
  );
  assert.equal(sel.desktopContainerSelector, ".js-nav-desktop-list.nav-desktop-list");
});

test("resolveMenuSelectors returns the verified Simple (new_linkedman) selector set", () => {
  const sel = resolveMenuSelectors("new_linkedman");
  assert.equal(sel.mobileLinkSelector, "#nav-hamburger ul.list-items > li > a");
  assert.equal(sel.desktopContainerSelector, ".js-desktop-nav-first-level");
});

test("resolveMenuSelectors falls back to DEFAULT for unknown or missing theme codes", () => {
  assert.deepEqual(resolveMenuSelectors("some_unmapped_theme"), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(undefined), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(null), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(""), DEFAULT_MENU_SELECTORS);
});

test("DEFAULT_MENU_SELECTORS selectors are null so the client script knows to use the legacy heuristic scan", () => {
  assert.equal(DEFAULT_MENU_SELECTORS.mobileLinkSelector, null);
  assert.equal(DEFAULT_MENU_SELECTORS.desktopContainerSelector, null);
});

test("getClientSelectorMap embeds every known theme plus a __default__ fallback entry", () => {
  const map = getClientSelectorMap();
  assert.ok(map.rio);
  assert.ok(map.new_linkedman);
  assert.deepEqual(map.__default__, DEFAULT_MENU_SELECTORS);
  // must be plain-JSON-serializable (no functions/undefined) since it gets embedded via JSON.stringify
  assert.equal(JSON.stringify(map).includes("function"), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test functions/theme-menu-selectors.test.js`
Expected: FAIL — `Cannot find module './theme-menu-selectors'`

- [ ] **Step 3: Write the module**

Create `functions/theme-menu-selectors.js`:

```js
"use strict";

// Selectores verificados manualmente contra tiendas reales (ver plan
// docs/superpowers/plans/2026-08-11-theme-aware-menu-widget.md).
// Agregar un theme nuevo acá NO requiere tocar customizeMenu() en index.js.
const THEME_MENU_SELECTORS = {
  rio: {
    mobileLinkSelector:
      "#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a",
    desktopContainerSelector: ".js-nav-desktop-list.nav-desktop-list",
  },
  new_linkedman: {
    mobileLinkSelector: "#nav-hamburger ul.list-items > li > a",
    desktopContainerSelector: ".js-desktop-nav-first-level",
  },
};

// null = "no tengo selector determinístico para este theme todavía":
// le dice al script en el browser que use el scan heurístico legacy.
const DEFAULT_MENU_SELECTORS = {
  mobileLinkSelector: null,
  desktopContainerSelector: null,
};

function resolveMenuSelectors(themeCode) {
  if (themeCode && Object.prototype.hasOwnProperty.call(THEME_MENU_SELECTORS, themeCode)) {
    return THEME_MENU_SELECTORS[themeCode];
  }
  return DEFAULT_MENU_SELECTORS;
}

function getClientSelectorMap() {
  return Object.assign({}, THEME_MENU_SELECTORS, { __default__: DEFAULT_MENU_SELECTORS });
}

module.exports = {
  THEME_MENU_SELECTORS,
  DEFAULT_MENU_SELECTORS,
  resolveMenuSelectors,
  getClientSelectorMap,
};
```

- [ ] **Step 4: Add the test script and run tests to verify they pass**

In `functions/package.json`, add to `"scripts"`:

```json
"test": "node --test *.test.js"
```

Run: `cd functions && npm test`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add functions/theme-menu-selectors.js functions/theme-menu-selectors.test.js functions/package.json
git commit -m "feat: add per-theme menu selector config with unit tests"
```

---

## Task 2: Make `customizeMenu()` theme-aware in the generated widget script

**Files:**
- Modify: `functions/index.js` (top of file: add require; inside `/api/style-widget.js` handler, ~line 10739-13914)

**Interfaces:**
- Consumes: `getClientSelectorMap()` from Task 1 (`./theme-menu-selectors`).
- Produces: no new exports — this task changes generated-script behavior only. Verified by Task 4's live browser check.

- [ ] **Step 1: Require the new module**

At the top of `functions/index.js`, near the existing local require (line 11):

```js
const { evaluateAccess, SUBSCRIPTION_PRICE_ARS } = require('./subscriptionAccess');
const { getClientSelectorMap } = require('./theme-menu-selectors');
```

- [ ] **Step 2: Embed the selector map and a theme-detect helper in the generated script**

In the `/api/style-widget.js` handler, find this line (currently ~10769):

```js
  const CONFIG = ${JSON.stringify(config)};
```

Add immediately after it:

```js
  const CONFIG = ${JSON.stringify(config)};
  const PN_MENU_SELECTORS = ${JSON.stringify(getClientSelectorMap())};

  function pnDetectTheme() {
    try {
      return (window.LS && window.LS.theme) || null;
    } catch (e) {
      return null;
    }
  }

  function pnGetMenuSelectors(themeCode) {
    return (themeCode && PN_MENU_SELECTORS[themeCode]) || PN_MENU_SELECTORS.__default__;
  }

  function pnResolveDesktopLink(li) {
    return (
      li.querySelector(':scope > a') ||
      li.querySelector(':scope > div.nav-item-container > a') ||
      li.querySelector('a')
    );
  }
```

- [ ] **Step 3: Use the theme-specific selectors in `customizeMenu()`, keep the heuristic as fallback**

Inside `customizeMenu()`, find (currently ~11131-11138):

```js
    // Selector espec�fico para MOBILE
    var mobileSelector = '#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a';
    var mobileLinks = document.querySelectorAll(mobileSelector);

    var desktopLinks = [];

    // Buscar DESKTOP - todas las UL en el header
    var headerUls = document.querySelectorAll('header ul');
```

Replace with:

```js
    var pnTheme = pnDetectTheme();
    var pnSel = pnGetMenuSelectors(pnTheme && pnTheme.code);
    console.log('PromoNube: Theme detectado:', pnTheme && pnTheme.code, '- Selectores:', pnSel);

    // Selector espec�fico para MOBILE (theme-aware, con fallback a Rio si no hay match)
    var mobileSelector = pnSel.mobileLinkSelector || '#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a';
    var mobileLinks = document.querySelectorAll(mobileSelector);

    var desktopLinks = [];

    // Camino determin�stico: si tenemos selector para este theme, usarlo directo
    if (pnSel.desktopContainerSelector) {
      var pnDesktopItems = document.querySelectorAll(pnSel.desktopContainerSelector + ' > li');
      desktopLinks = Array.prototype.map.call(pnDesktopItems, pnResolveDesktopLink).filter(Boolean);
      console.log('PromoNube: Desktop links via selector de theme (' + (pnTheme && pnTheme.code) + '):', desktopLinks.length);
    }

    // Fallback heur�stico legacy (themes sin mapear, o si el selector de arriba no encontr� nada)
    if (desktopLinks.length === 0) {
    // Buscar DESKTOP - todas las UL en el header
    var headerUls = document.querySelectorAll('header ul');
```

Then find the end of that heuristic block (currently ~11220, right after the `break;` that closes the `if (h === 0 && directChildren.length > 0)` branch, and before the closing `}` of the `for (var h ...)` loop) — the loop currently ends at line 11220 with:

```js
      }
    }

    console.log('PromoNube: Desktop links encontrados:', desktopLinks.length);
```

Change it to close the new `if (desktopLinks.length === 0) { ... }` wrapper by adding one closing brace:

```js
      }
    }
    } // cierre del fallback heur�stico (if desktopLinks.length === 0)

    console.log('PromoNube: Desktop links encontrados:', desktopLinks.length);
```

- [ ] **Step 4: Local sanity check (syntax only — DOM logic is verified live in Task 4)**

Run: `node --check functions/index.js` from repo root.
Expected: no output, exit code 0 (means the file parses with no `SyntaxError`). Do NOT use `node -e "require(...)"` — see Global Constraints, it throws on missing Firebase credentials regardless of this change.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: make customizeMenu theme-aware with legacy heuristic as fallback"
```

---

## Task 3: Report detected theme to Firestore

**Files:**
- Modify: `functions/index.js`
  - Inside `/api/style-widget.js` handler: add `STORE_ID` var + `pnReportDetectedTheme()` + call site.
  - New endpoint near the existing `/api/bar-click` handlers (~line 18463, before `if (require.main === module)`).

**Interfaces:**
- Consumes: `pnDetectTheme()` from Task 2 (already in scope inside the same IIFE).
- Produces: `promonube_stores/{storeId}.detectedTheme = { code, name, custom, lastSeen }` in Firestore — no other task depends on this field yet; it's for manual/admin inspection (Firebase console or a future admin view, out of scope here).

- [ ] **Step 1: Add STORE_ID and the reporting function to the generated script**

Right after the `PN_MENU_SELECTORS` / `pnDetectTheme` block added in Task 2 Step 2, add:

```js
  const STORE_ID = ${JSON.stringify(store)};

  function pnReportDetectedTheme(theme) {
    try {
      if (!theme || !theme.code) return;
      var THROTTLE_KEY = 'pn_theme_reported_at';
      var last = 0;
      try { last = parseInt(localStorage.getItem(THROTTLE_KEY) || '0', 10); } catch (e) {}
      var now = Date.now();
      if (now - last < 24 * 60 * 60 * 1000) return; // 1 reporte por navegador por d�a
      var url = ${JSON.stringify(_SRV_BASE)} + '/api/report-theme?store=' + encodeURIComponent(STORE_ID)
        + '&code=' + encodeURIComponent(theme.code)
        + '&name=' + encodeURIComponent(theme.name || '')
        + '&custom=' + (theme.custom ? '1' : '0');
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { keepalive: true }).catch(function() {});
      }
      try { localStorage.setItem(THROTTLE_KEY, String(now)); } catch (e) {}
    } catch (e) {}
  }
```

- [ ] **Step 2: Call it once on bootstrap**

Find the bootstrap block (currently ~13873-13904, appears twice — once for `DOMContentLoaded` and once for the immediate-execution branch):

```js
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      customizeWhatsApp();
      customizeBanners();
```

and

```js
  } else {
    customizeWhatsApp();
    customizeBanners();
```

In **both** places, add `pnReportDetectedTheme(pnDetectTheme());` right before `customizeWhatsApp();`:

```js
      pnReportDetectedTheme(pnDetectTheme());
      customizeWhatsApp();
      customizeBanners();
```

- [ ] **Step 3: Add the `/api/report-theme` endpoint**

In `functions/index.js`, right after the existing `GET /api/bar-click` handler (ends ~line 18463) and before `// Standalone server for Railway`, add:

```js
// GET/POST /api/report-theme?store=X&code=Y&name=Z&custom=0/1
// Trackea qu� theme de Tiendanube detect� el widget en cada tienda instalada.
async function handleReportTheme(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const store = req.query.store || req.body?.storeId;
  const code = req.query.code;
  if (!store || !code) return res.json({ ok: false });
  try {
    await db.collection("promonube_stores").doc(String(store)).update({
      detectedTheme: {
        code: String(code),
        name: String(req.query.name || ""),
        custom: req.query.custom === "1",
        lastSeen: new Date().toISOString(),
      },
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
}
app.get("/api/report-theme", handleReportTheme);
app.post("/api/report-theme", handleReportTheme);
```

- [ ] **Step 4: Local sanity check**

Run: `node --check functions/index.js` from repo root.
Expected: no output, exit code 0. Do NOT use `node -e "require(...)"` — see Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: report detected store theme to Firestore for coverage tracking"
```

---

## Task 4: Deploy and verify against real stores

**Files:** none (deploy + live verification only)

**Interfaces:** none — this task validates Tasks 2 and 3 against real, live storefronts since there is no DOM/browser test harness in this repo.

- [ ] **Step 1: Deploy to Railway (the actual prod target — NOT `firebase deploy`)**

Push/deploy `functions/` to whatever branch or command your Railway project is wired to (check `railway status` or the Railway dashboard if you don't remember the flow). Confirm the deployed script changed by fetching it directly:

Run: `curl -s "https://glowlab-production.up.railway.app/api/style-widget.js?store=<your real altorancho storeId>" | grep -c "pnDetectTheme"`
Expected: `1` or higher (the new function is present in the deployed script).

- [ ] **Step 2: Regression check on altorancho.com (theme `rio`)**

Using Chrome (claude-in-chrome or manually), open `https://altorancho.com/`, open the console, and confirm:
- `PromoNube: Theme detectado: rio` is logged.
- `PromoNube: Desktop links via selector de theme (rio): 8` is logged (or whatever the current live item count is — cross-check against `.js-nav-desktop-list.nav-desktop-list > li` count on the page at test time).
- The menu items configured in the Style module (colors/fonts on specific positions) render identically to before this change — no visual regression.

- [ ] **Step 3: New-support check on a `new_linkedman` ("Simple") theme store**

`tallertextildoscoyotes.mitiendanube.com` is a real live store but not a PromoNube customer, so the full CONFIG-driven widget won't activate there (no active subscription/config). To verify the selector logic itself against real DOM without needing a paying install, run this standalone snippet in that page's console — it mirrors exactly the new `customizeMenu()` desktop/mobile resolution logic:

```js
(function(){
  var sel = {
    mobileLinkSelector: "#nav-hamburger ul.list-items > li > a",
    desktopContainerSelector: ".js-desktop-nav-first-level",
  };
  var mobile = document.querySelectorAll(sel.mobileLinkSelector);
  var items = document.querySelectorAll(sel.desktopContainerSelector + " > li");
  var desktop = Array.prototype.map.call(items, function(li){
    return li.querySelector(':scope > a') || li.querySelector(':scope > div.nav-item-container > a') || li.querySelector('a');
  }).filter(Boolean);
  console.log('mobile:', mobile.length, 'desktop:', desktop.length);
})();
```

Expected: `mobile: 6 desktop: 6` (matches the live item count confirmed during planning; re-verify count if the store's menu changed since).

- [ ] **Step 4: Verify Firestore write for `/api/report-theme`**

Run against your own store (safe to write to):

Run: `curl -s "https://glowlab-production.up.railway.app/api/report-theme?store=<your real altorancho storeId>&code=rio&name=Rio&custom=0"`
Expected: `{"ok":true}`

Then check in the Firebase console (Firestore) that `promonube_stores/<storeId>` now has a `detectedTheme` map field with `code: "rio"`, `name: "Rio"`, `custom: false`, and a recent `lastSeen` timestamp.

- [ ] **Step 5: No commit needed** — this task is verification only. If Step 2 or 3 reveal a mismatch, return to Task 1/2, fix the selector or logic, and re-run this task's checks before considering the plan done.

---

## Out of scope for this plan (possible next steps)

- An admin UI page listing `detectedTheme` per store (to eyeball theme distribution across installs) — the data is queryable directly in the Firebase console for now; build a page once there's enough data to be worth a dashboard.
- Mapping additional theme codes beyond `rio` and `new_linkedman` — add them to `THEME_MENU_SELECTORS` in `functions/theme-menu-selectors.js` following the same pattern (inspect the real DOM, add selectors, add a unit test asserting the exact strings) once `detectedTheme` data shows which themes are most common among installs.
- Extending the same theme-detection approach to other DOM-scraping features in the style-widget (e.g. banner carousel selectors) that likely have the same Rio-only fragility — worth its own plan once this one is proven in production.
