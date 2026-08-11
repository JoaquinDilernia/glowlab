# Admin Theme Coverage View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Temas" tab to the internal admin panel (`src/pages/AdminPanel.jsx`) showing which Tiendanube themes real installs are using — aggregate counts per theme plus a filterable per-store detail table — using the `detectedTheme` data the style-widget already writes to Firestore.

**Architecture:** `GET /api/admin/stores` gains one passthrough field (`detectedTheme`) on data it already fetches — no new endpoint, no new fetch on the frontend. A new pure function `computeThemeStats(stores)` groups the already-loaded `stores` array by theme code client-side. `AdminPanel.jsx` gets a third tab that renders a stat-card grid (one card per theme, clickable to filter) above a detail table, reusing the page's existing `admin-table`/`stat-card` styling and its existing `searchTerm` input.

**Tech Stack:** React (existing `AdminPanel.jsx`), Node's built-in `node:test` for the one new pure-logic module (no new dependency — same approach as `functions/theme-menu-selectors.js`).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-11-admin-theme-coverage-view-design.md` — read it for the "why" behind each decision below if anything is unclear.
- Design decisions already made (do not re-litigate): new tab (not a column on the existing Tiendas table); undetected stores shown as a separate bucket, not silently dropped; per-store detail table with click-to-filter from the summary cards; backend passthrough on the existing `/api/admin/stores` endpoint, no new endpoint.
- No test framework exists for `src/` today. This plan adds one `test` script to the root `package.json` (`node --test src`) — Node 22 has `node:test` built in, no new dependency, same pattern already used in `functions/package.json`.
- **The frontend dev server (`npm run dev`) talks to the real production API by default** (`src/config.js:6` — `BASE_URL` defaults to `https://glowlab-production.up.railway.app` unless `VITE_API_URL` is set). `GET /api/admin/stores` requires a real `x-admin-key` header matching the server's `ADMIN_KEY` env var — nobody implementing this plan has that key. This means: Task 3's live-in-browser check can verify the tab renders and doesn't crash, but cannot verify it renders *real* production data — that verification is Task 4, and only the project owner (who holds the admin key) can complete it.
- Backend change (Task 1) must be deployed to Railway (push to `main`, same as the theme-aware-menu-widget plan) before Task 4's real-data check is possible — `detectedTheme` won't appear in `/api/admin/stores` responses until that ships.

---

## Task 1: Expose `detectedTheme` from `/api/admin/stores`

**Files:**
- Modify: `functions/index.js` (~line 15553-15558)

**Interfaces:**
- Produces: `GET /api/admin/stores` response entries gain a `detectedTheme` field, shaped `{ code, name, custom, lastSeen } | null` (already the exact shape written by `/api/report-theme`, `functions/index.js:18528`+ — no transformation).

- [ ] **Step 1: Add the field**

Find (currently ~line 15553):

```js
      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription
      });
```

Replace with:

```js
      stores.push({
        storeId: storeId,
        storeName: storeData.name || storeData.storeName || 'Sin nombre',
        subscription,
        detectedTheme: storeData.detectedTheme || null
      });
```

- [ ] **Step 2: Sanity check**

Run: `node --check functions/index.js` from repo root.
Expected: no output, exit code 0. Do NOT use `node -e "require(...)"` — it throws on missing local Firebase credentials regardless of this change (pre-existing, unrelated — see the theme-aware-menu-widget plan's Global Constraints for the same note).

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: expose detectedTheme in the admin stores endpoint"
```

---

## Task 2: `computeThemeStats` pure function + unit tests

**Files:**
- Create: `src/utils/themeStats.js`
- Create: `src/utils/themeStats.test.js`
- Modify: `package.json` (root — add `test` script)

**Interfaces:**
- Produces (used by Task 3): `computeThemeStats(stores: Array<{ detectedTheme?: {code, name, custom} | null }>) -> { knownThemes: Array<{code, name, custom, count}>, undetectedCount: number }`. `knownThemes` sorted descending by `count`. A store counts as "undetected" when `detectedTheme` is missing/null or has no `code`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/themeStats.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeThemeStats } from './themeStats.js';

test('groups stores by detectedTheme.code and counts them', () => {
  const stores = [
    { storeId: '1', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
    { storeId: '2', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
    { storeId: '3', detectedTheme: { code: 'new_linkedman', name: 'Simple', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.deepEqual(result.knownThemes, [
    { code: 'rio', name: 'Rio', custom: false, count: 2 },
    { code: 'new_linkedman', name: 'Simple', custom: false, count: 1 },
  ]);
  assert.equal(result.undetectedCount, 0);
});

test('stores with no detectedTheme go into undetectedCount, not knownThemes', () => {
  const stores = [
    { storeId: '1', detectedTheme: null },
    { storeId: '2' },
    { storeId: '3', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.undetectedCount, 2);
  assert.deepEqual(result.knownThemes, [{ code: 'rio', name: 'Rio', custom: false, count: 1 }]);
});

test('knownThemes is sorted descending by count', () => {
  const stores = [
    { detectedTheme: { code: 'a', name: 'A', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.knownThemes[0].code, 'b');
  assert.equal(result.knownThemes[0].count, 3);
  assert.equal(result.knownThemes[1].code, 'a');
});

test('custom themes are grouped by their own code, each tagged custom:true', () => {
  const stores = [
    { detectedTheme: { code: 'custom_abc', name: 'Custom Theme', custom: true } },
    { detectedTheme: { code: 'custom_xyz', name: 'Other Custom', custom: true } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.knownThemes.length, 2);
  assert.ok(result.knownThemes.every((t) => t.custom === true));
});

test('empty stores array returns empty knownThemes and zero undetected', () => {
  const result = computeThemeStats([]);
  assert.deepEqual(result.knownThemes, []);
  assert.equal(result.undetectedCount, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/utils/themeStats.test.js` from repo root.
Expected: FAIL — `Cannot find module './themeStats.js'`.

- [ ] **Step 3: Write the module**

Create `src/utils/themeStats.js`:

```js
export function computeThemeStats(stores) {
  const byCode = new Map();
  let undetectedCount = 0;

  for (const store of stores) {
    const theme = store.detectedTheme;
    if (!theme || !theme.code) {
      undetectedCount++;
      continue;
    }
    const existing = byCode.get(theme.code);
    if (existing) {
      existing.count += 1;
    } else {
      byCode.set(theme.code, {
        code: theme.code,
        name: theme.name || theme.code,
        custom: !!theme.custom,
        count: 1,
      });
    }
  }

  const knownThemes = Array.from(byCode.values()).sort((a, b) => b.count - a.count);

  return { knownThemes, undetectedCount };
}
```

- [ ] **Step 4: Add the root test script and run tests to verify they pass**

In the root `package.json`, add to `"scripts"` (alongside `dev`, `build`, `lint`, `preview`):

```json
"test": "node --test \"src/**/*.test.js\""
```

(A bare directory argument like `node --test src` makes Node try to `require()` "src" as a single module rather than recursing for test files — the explicit glob is required.)

Run: `npm test` from repo root.
Expected: PASS — 5 tests, 0 failures. (This also runs any other `*.test.js` already under `src/` — there are none yet, so 5 is the total.)

- [ ] **Step 5: Commit**

```bash
git add src/utils/themeStats.js src/utils/themeStats.test.js package.json
git commit -m "feat: add computeThemeStats pure function with unit tests"
```

---

## Task 3: "Temas" tab in AdminPanel

**Files:**
- Modify: `src/pages/AdminPanel.jsx`
- Modify: `src/pages/AdminPanel.css`

**Interfaces:**
- Consumes: `computeThemeStats` from `../utils/themeStats` (Task 2).
- Produces: no new exports — this is the UI consumer, verified by rendering (Step 6) and by Task 4's real-data check.

- [ ] **Step 1: Imports**

At the top of `src/pages/AdminPanel.jsx`, currently:

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './AdminPanel.css';
```

Change to:

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle, Palette } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { computeThemeStats } from '../utils/themeStats';
import './AdminPanel.css';
```

- [ ] **Step 2: State + derived data**

Find (currently ~line 16-19):

```jsx
  const [activeTab, setActiveTab] = useState('stores');
  const [processingStore, setProcessingStore] = useState(null);
  const [quickStoreId, setQuickStoreId] = useState('');
  const [loading, setLoading] = useState(false);
```

Add a `themeFilter` state right after:

```jsx
  const [activeTab, setActiveTab] = useState('stores');
  const [processingStore, setProcessingStore] = useState(null);
  const [quickStoreId, setQuickStoreId] = useState('');
  const [loading, setLoading] = useState(false);
  const [themeFilter, setThemeFilter] = useState(null);
```

Find (currently ~line 138-141):

```jsx
  const filteredStores = stores.filter(store =>
    store.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.storeId?.toString().includes(searchTerm)
  );
```

Add two new derived values right after it (do not modify `filteredStores` itself — it's used by the existing Tiendas tab, unrelated to this change):

```jsx
  const filteredStores = stores.filter(store =>
    store.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.storeId?.toString().includes(searchTerm)
  );

  const themeStats = useMemo(() => computeThemeStats(stores), [stores]);

  const themeTabStores = stores.filter((store) => {
    const matchesSearch =
      store.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.storeId?.toString().includes(searchTerm);
    if (!matchesSearch) return false;
    if (!themeFilter) return true;
    if (themeFilter === '__undetected__') return !store.detectedTheme;
    return store.detectedTheme?.code === themeFilter;
  });
```

- [ ] **Step 3: Add the third tab button**

Find (currently ~line 282-297):

```jsx
      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          <Package size={18} />
          Tiendas ({stores.length})
        </button>
        <button
          className={`tab ${activeTab === 'uninstalls' ? 'active' : ''}`}
          onClick={() => setActiveTab('uninstalls')}
        >
          <XCircle size={18} />
          Desinstalaciones ({uninstalls.length})
        </button>
      </div>
```

Add a third button before the closing `</div>`:

```jsx
      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          <Package size={18} />
          Tiendas ({stores.length})
        </button>
        <button
          className={`tab ${activeTab === 'uninstalls' ? 'active' : ''}`}
          onClick={() => setActiveTab('uninstalls')}
        >
          <XCircle size={18} />
          Desinstalaciones ({uninstalls.length})
        </button>
        <button
          className={`tab ${activeTab === 'temas' ? 'active' : ''}`}
          onClick={() => setActiveTab('temas')}
        >
          <Palette size={18} />
          Temas ({themeStats.knownThemes.length + (themeStats.undetectedCount > 0 ? 1 : 0)})
        </button>
      </div>
```

- [ ] **Step 4: Render the tab content**

Find the end of the "Uninstalls Table" block (currently ends ~line 470, right before the final closing `</div>` of `admin-container` at line 471):

```jsx
          {uninstalls.length === 0 && (
            <div className="empty-state">
              <XCircle size={48} />
              <p>No hay desinstalaciones registradas</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Insert a new block between the uninstalls block's closing `)}` and the final `</div>`:

```jsx
          {uninstalls.length === 0 && (
            <div className="empty-state">
              <XCircle size={48} />
              <p>No hay desinstalaciones registradas</p>
            </div>
          )}
        </div>
      )}

      {/* Temas Tab */}
      {activeTab === 'temas' && (
        <>
          <div className="stats-grid theme-stats-grid">
            {themeStats.knownThemes.map((theme) => (
              <button
                key={theme.code}
                className={`stat-card theme-stat-card ${themeFilter === theme.code ? 'active' : ''}`}
                onClick={() => setThemeFilter(themeFilter === theme.code ? null : theme.code)}
              >
                <div className="stat-icon users">
                  <Palette size={28} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{theme.count}</span>
                  <span className="stat-label">
                    {theme.name}
                    {theme.custom && <span className="module-tag theme-custom-tag">custom</span>}
                  </span>
                </div>
              </button>
            ))}
            {themeStats.undetectedCount > 0 && (
              <button
                className={`stat-card theme-stat-card theme-stat-card-undetected ${themeFilter === '__undetected__' ? 'active' : ''}`}
                onClick={() => setThemeFilter(themeFilter === '__undetected__' ? null : '__undetected__')}
              >
                <div className="stat-icon expired">
                  <XCircle size={28} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{themeStats.undetectedCount}</span>
                  <span className="stat-label">Sin detectar</span>
                </div>
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>TIENDA</th>
                  <th>STORE ID</th>
                  <th>TEMA</th>
                  <th>¿CUSTOM?</th>
                  <th>ÚLTIMA VEZ VISTO</th>
                </tr>
              </thead>
              <tbody>
                {themeTabStores.map((store) => (
                  <tr key={store.storeId}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="store-id">{store.storeId}</td>
                    <td>{store.detectedTheme?.name || '—'}</td>
                    <td>{store.detectedTheme?.custom ? '✅' : '—'}</td>
                    <td>
                      {store.detectedTheme?.lastSeen
                        ? new Date(store.detectedTheme.lastSeen).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {themeTabStores.length === 0 && (
              <div className="empty-state">
                <Palette size={48} />
                <p>No se encontraron tiendas con ese filtro</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: CSS additions**

Append to the end of `src/pages/AdminPanel.css`:

```css
/* Theme Coverage (Temas tab) */
.theme-stats-grid {
  margin-bottom: 24px;
}

.theme-stat-card {
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.theme-stat-card.active {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.12);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.25);
}

.theme-stat-card-undetected {
  opacity: 0.75;
}

.theme-custom-tag {
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 10px;
}
```

`.theme-stat-card` is applied together with the existing `.stat-card` class (`className="stat-card theme-stat-card ..."`) — `.stat-card`'s own rules (background, border, padding, border-radius, display:flex, gap) already override the `<button>` element's default UA styling for those specific properties, so `.theme-stat-card` only needs to add what `.stat-card` doesn't set (width, font, text-align, cursor). Keep this block after `.stat-card`'s rules in the file (appending to the end of the file already satisfies this).

- [ ] **Step 6: Local verification (rendering only — no real data, see Global Constraints)**

Run `npm run dev` from repo root, open the printed local URL, navigate to `/admin`. Log in with whatever `x-admin-key` gets you past the login form in this environment (if you don't have one, skip straight to confirming there's no console error on the login screen itself, and note in your report that the authenticated view is unverified — Task 4 covers that).

If you do get authenticated (empty or real `stores` data either way): click the "Temas" tab, confirm:
- No React error in the browser console.
- With zero stores, the tab shows just the tab button with count `(0)` and an empty table area — no crash.
- If any stores are visible, clicking a summary card highlights it and filters the table; clicking it again clears the filter.

Run `npm run build` from repo root as a stronger signal than the dev server alone (catches JSX/import errors even without valid auth):
Expected: build succeeds, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminPanel.jsx src/pages/AdminPanel.css
git commit -m "feat: add Temas tab to admin panel showing theme coverage"
```

---

## Task 4: Deploy and verify with real data

**Files:** none (deploy + live verification only)

**Interfaces:** none — validates Tasks 1-3 together against production data.

- [ ] **Step 1: Deploy the backend change**

Same deploy path as the theme-aware-menu-widget plan: push to `main` on GitHub, Railway's GitHub integration auto-deploys. Confirm the field is live:

Run: `curl -s -H "x-admin-key: <the real ADMIN_KEY>" "https://glowlab-production.up.railway.app/api/admin/stores" | grep -c detectedTheme`
Expected: `1` or higher.

(The frontend change doesn't need a separate deploy step to be "live" in the sense of Railway — it ships wherever this project's frontend build is published; check with the project owner if that's a manual step, per this project's known deploy setup.)

- [ ] **Step 2: Verify with real data**

Only the project owner can do this step (holds the real `ADMIN_KEY`). Log into `/admin`, open the "Temas" tab, and confirm:
- The summary cards' counts match what you'd expect given how many stores have actually loaded the style-widget since the theme-aware-menu-widget deploy.
- `rio` and any `new_linkedman` installs show up correctly (these are the two themes already mapped).
- Clicking a card filters the table to just that theme's stores; clicking "Sin detectar" shows stores with no `detectedTheme` yet.

- [ ] **Step 3: No commit needed** — this task is verification only. If Step 2 finds a mismatch, return to the relevant task, fix, and re-run this task's checks.
