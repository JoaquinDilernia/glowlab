# Admin Panel: Theme Coverage View — Design

## Purpose

GlowLab's style-widget now detects each installed store's Tiendanube theme (`window.LS.theme.code`) and reports it to `promonube_stores/{storeId}.detectedTheme` (see `docs/superpowers/plans/2026-08-11-theme-aware-menu-widget.md`). That data has no viewer yet. This adds a "Temas" tab to the existing internal admin panel (`src/pages/AdminPanel.jsx`) so the theme distribution across real installs is visible at a glance, to prioritize which themes get selector support next (following the pattern established in `functions/theme-menu-selectors.js` for `rio` and `new_linkedman`).

## Context: existing AdminPanel conventions

`AdminPanel.jsx` is a password-gated (`x-admin-key` header) internal tool, already structured as: stat cards (`stats-grid`) → tabs (`admin-tabs`) → a table per tab (`admin-table`). It loads all stores once via `GET /api/admin/stores` into a `stores` state array and derives everything else client-side (see the existing `stats` object at line 143, `filteredStores` at line 138). This design reuses that same loaded state — no new fetch, no new endpoint.

## Backend change

`GET /api/admin/stores` (`functions/index.js:15499`) currently builds each entry as `{ storeId, storeName, subscription }`, dropping every other field of the raw Firestore doc. Add one field:

```js
stores.push({
  storeId: storeId,
  storeName: storeData.name || storeData.storeName || 'Sin nombre',
  subscription,
  detectedTheme: storeData.detectedTheme || null,
});
```

`detectedTheme` is already shaped `{ code, name, custom, lastSeen }` by the existing `/api/report-theme` endpoint (`functions/index.js:18528`+) — no transformation needed, pass it through as-is or `null` if the store has never reported (no visitor since deploy, or the Style module isn't enabled there).

## Frontend change

All changes are in `src/pages/AdminPanel.jsx` (+ minor additions to `src/pages/AdminPanel.css`). No new files.

### State

One new piece of state: `const [themeFilter, setThemeFilter] = useState(null);` — holds either a theme `code` string, the sentinel `'__undetected__'`, or `null` (no filter). Clicking an already-active filter card clears it back to `null`.

### `computeThemeStats(stores)`

A small pure function (~15 lines, same spirit as the existing inline `stats` object at line 143), computed with `useMemo` off the `stores` array:

- Groups stores by `detectedTheme?.code`; stores with no `detectedTheme` go into a separate `undetected` bucket.
- Returns `{ knownThemes: [{ code, name, custom, count }], undetectedCount }`, with `knownThemes` sorted descending by `count`.
- `name` for display comes from the first store seen with that code (themes report their own display name, e.g. `"Rio"`, `"Simple"`).

### Tab UI

Third tab button next to "Tiendas" and "Desinstalaciones", same `admin-tabs` styling, labeled "Temas (N)" where N is `knownThemes.length + (undetectedCount > 0 ? 1 : 0)`.

**Summary row** — reuses the `stats-grid`/`stat-card` pattern from the top of the page (not the existing top stats, a second grid rendered only when this tab is active): one card per entry in `knownThemes` (theme name + store count, `custom` themes get a small "custom" tag), plus one more card for `undetectedCount` styled muted/gray (distinct from the theme cards — this is coverage gap, not a theme). Each card is a `<button>`-like clickable element: clicking a theme card sets `themeFilter` to that `code`; clicking the undetected card sets `themeFilter` to `'__undetected__'`; clicking the currently-active card clears the filter. Active filter gets a visual highlight (border/background), matching how `.tab.active` is already styled.

**Detail table** — reuses `admin-table` styling. Columns: Tienda, Store ID, Tema (falls back to `—` when `detectedTheme` is null), ¿Custom? (✅/—), Última vez visto (formatted like the existing date columns, `new Date(...).toLocaleDateString('es-AR', ...)`, or `—` if never reported). Rows come from `stores`, filtered by `themeFilter` when set (`store.detectedTheme?.code === themeFilter`, or `!store.detectedTheme` for the undetected sentinel); unfiltered shows all stores. Reuses the existing `searchTerm` input already on the page (filtering by name/Store ID) — no separate search box for this tab, both filters (`searchTerm` AND `themeFilter`) apply together when both are set.

Empty state (no stores match current filter) reuses the existing `.empty-state` pattern (icon + message) already used for the other two tabs.

## Data flow

1. Page mount → `loadStores()` (existing, unchanged) → `stores` state now includes `detectedTheme` per store.
2. `computeThemeStats(stores)` recomputed via `useMemo` whenever `stores` changes.
3. User clicks "Temas" tab → summary cards + table render from state already in memory. No network call.
4. User clicks a summary card → `themeFilter` state updates → table re-renders filtered. No network call.

## Error handling

None beyond what `loadStores()` already does (try/catch around the fetch, existing loading spinner). This is a read-only view over already-fetched data — no new failure modes to handle.

## Testing

No existing frontend test suite in this repo (confirmed: no `*.test.jsx`/`*.spec.jsx` files, no test runner configured in the root `package.json`). Verification is manual: run the dev server, log into the admin panel, open the Temas tab, confirm the summary counts match a manual count from the `stores` array (spot-checked in the browser console), confirm clicking a card filters the table and clicking again clears it, confirm the undetected bucket shows stores with `detectedTheme: null`.

## Out of scope

- Historical trend of theme adoption over time (would need storing snapshots, not just latest `detectedTheme`) — not requested, revisit if useful later.
- Any action button on a theme (e.g., "add selector support") — this view is read-only observability, not a workflow tool.
