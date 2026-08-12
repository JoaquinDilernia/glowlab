# Laptop Breakpoint Pass + Standalone Admin Panel — Design

## Purpose

The panel was tuned against a 27" monitor. On a normal notebook (target: 1366×768), containers built for ~1200px+ of pure content width, combined with a fixed 228px sidebar and large paddings (32-40px), leave little breathing room — pages read as cramped rather than laid out for the viewport. Separately, `/admin` (`src/pages/AdminPanel.jsx`) — the internal stores/uninstalls/theme-coverage tool — currently renders inside the same `AppLayout` shell as every merchant page, so it shows the merchant Sidebar/nav around it even though it's a distinct, password-gated tool for the project owner only, not a "view" of the merchant app.

Two independent changes, done together because both touch the app's overall layout shell:

**A. Laptop breakpoint pass** — add a consistent `1440px` breakpoint across the CSS of every routed authenticated page, easing container widths and paddings for 1366-1440px viewports.

**B. Standalone `/admin`** — move `/admin` out of `AppLayout` so it renders with no Sidebar/menu, and remove the Dashboard header's admin-entry button that currently opens the separate legacy overlay panel.

## A. Laptop breakpoint pass

### Approach

No shared layout container exists across pages (each page's `.css` file defines its own container/padding independently — confirmed during research), so this is not a refactor: add the same `@media (max-width: 1440px)` block, with the same kind of adjustment, to each page's existing CSS file. No JSX/markup changes. `768px` rules (the existing mobile breakpoint) are untouched.

Per file, the pattern is:
- Container `max-width` that exceeds ~1100px → cap around 1100-1140px (or switch to `min(1140px, 100%)` where a hardcoded value existed).
- Padding ≥28px on outer containers/cards → reduce to ~20-24px.
- Anything already fluid (CSS grid with `auto-fill`/`minmax`, flex-wrap) is left alone — it already adapts.

`src/components/Sidebar.css` gets the same breakpoint: fixed `width: 228px` → `200px` at ≤1440px, so pages gain back some width instead of losing it twice (narrower content area *and* unchanged sidebar).

### Files in scope

All CSS belonging to currently-routed authenticated pages (`App.jsx`'s `AppLayout`-wrapped routes) with a real dense layout: `Dashboard.css`, `StyleConfig.css` (also styles `ShopTheLookConfig` and `FlashSaleConfig`, which reuse its `.style-config-page` shell), `SpinWheel.css`, `SpinWheelConfig.css`, `SpinWheelAnalytics.css`, `GiftCardsMain.css`, `AdminPanel.css`, `PopupsList.css`, `PopupConfig.css`, `LocalStockConfig.css`, `CheckoutNoticeConfig.css`, `CountdownList.css`, `CountdownConfig.css`, `BadgesList.css`, `BadgeConfig.css`, `Integrations.css`, `BannerConfig.css`. Plus `src/components/Sidebar.css` and `src/components/AppLayout.css`.

Out of scope: `Login.css`, `Register.css`, `Callback.css`, `PaymentSuccess.css`, `PaymentTest.css` — single centered-card layouts, already narrow, spot-check only, no changes expected. `BadgeConfig-old.css`/`NewBadgeConfig.css` — orphaned pages already slated for deletion by the badges-merge plan, not worth adapting.

### Verification

Manual: run the dev server, resize the browser to 1366×768 (or use the browser devtools device toolbar), log in, and click through each page in scope confirming no horizontal scroll, no overlapping/clipped elements, and sidebar + content fit without the content feeling squeezed against the edge.

## B. Standalone `/admin`

### Routing

In `src/App.jsx`, move:
```jsx
<Route path="/admin" element={<AdminPanel />} />
```
out of the `<Route element={<AppLayout />}>` block and into a top-level `<Route>`, grouped with the other unwrapped routes (`/login`, `/callback`, etc.). `AdminPanel.jsx` already has its own `x-admin-key` auth gate and its own root markup (`.admin-container` / `.admin-header`, from `AdminPanel.css`) — it doesn't read anything from `AppLayout` or depend on `storeId`, so no changes are needed inside the component itself.

`PaymentGate`'s `GATE_EXEMPT_PATHS` already includes `/admin` for the old nested case; that exemption becomes moot for `/admin` once it's outside `AppLayout` entirely (it never reaches `PaymentGate`), but leave the constant as-is — harmless, and other exempt paths may still need it.

### Dashboard entry button

In `src/pages/Dashboard.jsx`, remove the `btn-admin-access` button (the shield icon in the header) and its `onClick={() => setShowAdminPanel(true)}`. Leave `showAdminPanel` state, the `Ctrl+Shift+A` `keydown` listener, and the `components/AdminPanel.jsx` overlay untouched — that legacy demo-activation panel stays reachable by shortcut only, per explicit decision (not part of this change).

### Verification

Manual: navigate to `/#/admin` directly — confirm no Sidebar/menu renders, just the admin login + tool. Navigate to `/#/dashboard` — confirm the shield button is gone from the header but `Ctrl+Shift+A` still opens the old overlay panel.

## Out of scope

- Any redesign of `AdminPanel.jsx`'s own internal layout beyond what breakpoint pass A already gives it — this is a shell change, not a visual redesign.
- Removing or consolidating the legacy `components/AdminPanel.jsx` overlay — explicitly deferred by the project owner.
- A shared layout-container component/class to unify page containers — rejected during design (Approach B) in favor of the lower-risk per-file breakpoint (Approach A), since it would require touching every page's JSX, not just CSS.
