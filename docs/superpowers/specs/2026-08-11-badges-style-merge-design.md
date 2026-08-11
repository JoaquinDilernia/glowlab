# Badges Module: Style Merge — Design

## Purpose

Two competing Badge builders exist in this repo: `BadgeConfig.jsx` (live, routed at `/badges/create`, backed by `/api/badges` + `/api/badges-script.js`) supports 9 rule types (new products, manual, price min/max, discount, stock low, category, tags, all products) with basic styling. `NewBadgeConfig.jsx` (orphaned — no Sidebar link, no route reference anywhere in the UI, but its backend `/api/new-badge-config` + `/api/new-badge-script.js` is fully built and working) supports only the "new products" rule but with much richer styling: border, shadow, text-transform, opacity, icon position, custom CSS, a live Preview tab, and per-page-type visibility (product/category/home).

Badges is a crowded competitive category — the goal here is not to out-build dedicated badge apps, but to bring the live multi-rule system up to a visual/functional bar that matches what's already been built (and abandoned) in `NewBadgeConfig.jsx`, finishing work that's ~80% done rather than starting fresh. After this ships, `NewBadgeConfig.jsx` and its backend get deleted — no parallel system left behind.

## Context: how the live system works today

- `promonube_badges` Firestore collection: one doc per badge, `{storeId, badgeName, badgeText, ruleType, ruleConfig, isActive, design: {shape, position, backgroundColor, textColor, fontSize, fontWeight, animation, borderRadius, showIcon, icon}}`.
- `BadgeConfig.jsx` is a CRUD form (`GET/POST/PUT /api/badges`) — merchants can create multiple named badges, each independently configured.
- `/api/badges-script.js` (`functions/index.js:8915`+) generates the live storefront script: fetches all active badges for a store, fetches product metadata (`/api/products/metadata`), evaluates each badge's rule against each product (`evaluateBadgeRule`), and renders the first matching badge onto product card elements found via generic selectors (`processProducts` — scans the whole page for anything shaped like a product card, with no page-type distinction today).
- Verified live via `window.LS.template` (Tiendanube-provided, same signal family as `window.LS.theme` used throughout today's work): reliably returns `"home"`, `"category"`, or `"product"` depending on the current page — confirmed against altorancho.com for all three.

## Data model changes

Extend the `design` object with:

```js
design: {
  // existing fields unchanged: shape, position, backgroundColor, textColor,
  // fontSize, fontWeight, animation, borderRadius, showIcon, icon
  shape: 'rectangle' | 'rounded' | 'circle' | 'flag' | 'ribbon', // 'ribbon' is new
  border: { enabled: false, width: '2px', style: 'solid', color: '#000000' },
  shadow: { enabled: false, x: '0px', y: '2px', blur: '10px', color: '#000000' },
  textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none', // default 'uppercase'
  opacity: 1,
  iconPosition: 'left' | 'right', // default 'left'
  customCSS: '', // free-text, scoped to this badge instance only
  visibility: { showOnProductPage: true, showOnCategoryPage: true, showOnHomePage: true },
}
```

**Backward compatibility is load-bearing**: badges saved before this change have no `border`, `shadow`, `textTransform`, `opacity`, `iconPosition`, `visibility` keys at all. Every read of these fields — both in `BadgeConfig.jsx` on load and in `/api/badges-script.js` on render — must default to the values above, which reproduce today's actual rendered output exactly (no border, no shadow, uppercase text, opacity 1, icon-left, visible on every page). No currently-configured badge should change appearance the moment this ships.

## Frontend: `BadgeConfig.jsx`

- **Diseño tab**: replace the radio-button shape/position pickers with `NewBadgeConfig.jsx`'s visual card-based selectors (small preview swatch + label, click to select). Add "ribbon" as a fifth shape option. Add new controls: border (enable toggle → width/style/color when on), shadow (enable toggle → x/y/blur/color when on), text-transform select, opacity slider, icon position toggle (only shown when `showIcon` is on), and an "Avanzado" collapsible section containing the custom CSS textarea.
- **New Preview tab**: adapt `NewBadgeConfig.jsx`'s `PreviewBadge` component — full product-card mockup (placeholder image, name, price) with the badge rendered exactly as the live script would, reflecting whatever's currently configured across both the General and Diseño tabs.
- **General tab**: add a "Dónde mostrar" checkbox group (product/category/home page) near the existing "Badge activo" toggle — stays per-badge, since (unlike `NewBadgeConfig.jsx`'s single global config) this system manages a list of independent badges.
- Loading (`loadBadgeConfig`) and saving (`handleSave`) both need the new `design.*` sub-fields wired through with the backward-compatible defaults on load.

## Backend: `/api/badges-script.js` + new helper module

- Create `functions/badge-render-helpers.js` (same pattern as today's `theme-menu-selectors.js`): pure, unit-testable functions —
  - `resolveBadgeDesign(design)` — takes a possibly-partial `design` object from Firestore and returns a fully-populated one with every default filled in (the single source of truth for backward-compat defaults, used by both the width/preview logic conceptually and, embedded via `JSON.stringify`-free plain data, mirrored into the generated script).
  - `shouldShowOnTemplate(visibility, template)` — given a badge's `visibility` object and the current page's `template` string (`'home' | 'category' | 'product'`), returns whether the badge should render. Handles the "no visibility field at all" backward-compat case (always true).
  - `escapeCustomCss(css)` / a scoping helper that wraps a badge's custom CSS so it only affects that badge's own generated class name (e.g. `.pn-badge-{badgeId}`), not the whole page.
- Wire these into `/api/badges-script.js`: embed `resolveBadgeDesign`'s output per badge (server-side, at script-generation time — same "resolve on the server, embed plain data in the client script" pattern as `theme-menu-selectors.js`) rather than re-implementing the default-filling logic twice in JS. Read `window.LS.template` once at script init and pass it into the existing `addBadgesToProduct`/`evaluateBadgeRule` flow so `shouldShowOnTemplate` can gate rendering.
- `createBadgeElement()`: apply border/shadow/opacity/textTransform/iconPosition from the resolved design, add the `ribbon` shape (real diagonal corner-ribbon CSS, not the unfinished stub from `NewBadgeConfig.jsx`), and inject the scoped custom CSS block if present.

## Cleanup (after production verification)

Delete: `src/pages/NewBadgeConfig.jsx`, `src/pages/NewBadgeConfig.css`, its route in `App.jsx`, backend endpoints `/api/new-badge-config` (GET/POST) and `/api/new-badge-script.js`, and any reference to `new-badge-script` elsewhere in `functions/index.js` (the widget-URL registry entry at the line found during today's earlier audit). Also delete `src/pages/BadgeConfig-old.jsx` — confirmed unimported anywhere, purely dead weight, unrelated to this merge but trivial to remove while working in this area.

## Testing

- `functions/badge-render-helpers.js` gets real `node --test` unit tests (same pattern as `theme-menu-selectors.js` and `themeStats.js` today): `resolveBadgeDesign` defaulting behavior (empty object in → full defaults out; partial object in → partial overrides applied, rest defaulted), `shouldShowOnTemplate` for all three templates × both "field present" and "field absent" cases, and the CSS-scoping helper.
- No frontend test framework beyond what exists (`node --test src`) — `BadgeConfig.jsx` itself isn't unit-tested (matches the rest of the config-page components in this repo). Verification is `npm run build` + `npx eslint` for structural correctness, plus a live check of the deployed `/api/badges-script.js` against a real test badge on a real store (same methodology as the theme-widget work today) to confirm the new design fields actually render and the page-visibility filter actually gates correctly across home/category/product pages.
- `BadgeConfig.jsx` itself is behind normal merchant login (no admin key involved, but still no credentials available to verify interactively during implementation) — same constraint documented in the admin-theme-coverage-view plan. The build/lint pass substitutes for live UI verification during implementation; final confirmation is a manual check by the project owner after deploy.

## Out of scope

- The "only first matching badge renders per product" limitation (noted in `/api/badges-script.js`'s own comment) — a real, separate improvement, not touched here.
- Any change to the 9 existing rule types' matching logic — untouched, this is a styling + visibility merge only.
- `NewBadgeConfig`'s single-global-config model is not adopted — the multi-badge CRUD architecture from `BadgeConfig.jsx` stays as the foundation.
