# Laptop Breakpoint Pass + Standalone Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ease container widths/paddings for 1366×768-1440×900 notebook viewports across every routed authenticated page (Part A), and move `/admin` to a fully standalone route with no Sidebar/menu chrome, removing its old in-app entry button (Part B).

**Architecture:** Part A adds one new `@media (max-width: 1440px)` block per page CSS file — no shared layout container exists across pages, so each file gets the same kind of adjustment (cap oversized `max-width`, trim oversized `padding`) independently; `Sidebar.css` gets the same breakpoint to narrow the fixed sidebar from 228px to 200px. Part B moves the `/admin` route out of `App.jsx`'s `AppLayout`-wrapped route group into a standalone top-level route, and removes the now-redundant admin-entry button from `Dashboard.jsx` (the legacy `Ctrl+Shift+A` overlay panel stays untouched).

**Tech Stack:** React Router (`src/App.jsx`), plain CSS media queries (no preprocessor, no CSS-in-JS).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-12-laptop-responsive-admin-standalone-design.md`.
- Part A breakpoint value is exactly `1440px` in every file — do not use a different value in different files.
- Part A container `max-width` cap target is `1140px`. Part A padding reduction target for paddings ≥28px is `24px` (or the nearest already-established value shown in each task below — some files use asymmetric padding like `20px 24px`, keep the vertical value as given per task).
- Part A touches CSS only — no JSX/markup changes, no changes to existing `768px`/`900px`/`1024px`/`1200px`/`1400px` mobile/tablet rules.
- Insert the new `1440px` block in descending-breakpoint order: immediately **above** the next-smaller existing `@media` block in that file (each task below states which one).
- No automated frontend test suite exists in this repo (no `*.test.jsx`, no test runner in `package.json`) — verification is `npm run build` (catches CSS syntax errors) plus a manual browser check at a 1366px-wide viewport.
- Part B: `src/pages/AdminPanel.jsx` already has its own `x-admin-key` auth gate and its own root markup (`.admin-container`/`.admin-header`) — it does not read anything from `AppLayout` or `storeId`. No changes needed inside that component.
- Part B: the legacy overlay panel (`src/components/AdminPanel.jsx`, opened via `Ctrl+Shift+A` in `Dashboard.jsx`) and its keyboard shortcut must NOT be touched or removed — explicit product decision, out of scope.
- Before every CSS edit below: read the target file with the Read tool first and confirm the `old_string` matches verbatim before applying the Edit — line numbers given here are from a research pass and may have drifted by the time you implement.

---

## Task 1: Move `/admin` to a standalone route

**Files:**
- Modify: `src/App.jsx`

**Interfaces:** none — routing-only change, no new exports.

- [ ] **Step 1: Move the route**

Read `src/App.jsx`. Find the `/admin` route currently inside the `AppLayout`-wrapped route group:

```jsx
          <Route path="/admin" element={<AdminPanel />} />
```

Remove that line from inside `<Route element={<AppLayout />}>...</Route>`.

Then find the public routes group:

```jsx
        {/* Public routes (no sidebar) */}
        <Route path="/" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-failure" element={<PaymentFailure />} />
        <Route path="/payment-pending" element={<PaymentPending />} />
        <Route path="/payment-test" element={<PaymentTest />} />
```

Add the admin route to this group instead:

```jsx
        {/* Public routes (no sidebar) */}
        <Route path="/" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-failure" element={<PaymentFailure />} />
        <Route path="/payment-pending" element={<PaymentPending />} />
        <Route path="/payment-test" element={<PaymentTest />} />
        <Route path="/admin" element={<AdminPanel />} />
```

- [ ] **Step 2: Verify the build**

Run: `npm run build` from repo root.
Expected: build succeeds (pre-existing CSS minify/chunk-size warnings are unrelated and expected).

- [ ] **Step 3: Manual check**

Run the dev server (`npm run dev`), navigate to `/#/admin`. Confirm: no Sidebar/menu renders, just the admin login form directly. Navigate to `/#/dashboard` and confirm it still works normally (this route move should not affect any other route).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: make /admin a standalone route with no Sidebar chrome"
```

---

## Task 2: Remove the Dashboard admin-entry button

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:** none.

- [ ] **Step 1: Remove the unused `Shield` import**

Find (line 3):

```jsx
import { Sparkles, Clock, Palette, Shield, BadgeCheck, Bell, Rocket, ChevronRight, ShoppingBag, Image } from 'lucide-react';
```

Replace with (drop `Shield` — confirmed as the only usage in this file besides the button being removed below):

```jsx
import { Sparkles, Clock, Palette, BadgeCheck, Bell, Rocket, ChevronRight, ShoppingBag, Image } from 'lucide-react';
```

- [ ] **Step 2: Remove the button, keep the empty spacer div**

Find:

```jsx
          <div className="header-right">
            <button
              className="btn-admin-access"
              onClick={() => setShowAdminPanel(true)}
              title="Panel Admin (Ctrl+Shift+A)"
            >
              <Shield size={16} />
            </button>
          </div>
```

Replace with (keep the empty `header-right` div — it's a `flex: 1` spacer that balances `header-left` so `header-center`'s title stays visually centered; removing the div entirely would shift the title):

```jsx
          <div className="header-right">
          </div>
```

Do NOT touch: `showAdminPanel` state, the `Ctrl+Shift+A` `keydown` `useEffect`, the `{showAdminPanel && (...)}` overlay block, or the `import AdminPanel from '../components/AdminPanel';` line — all stay exactly as they are.

- [ ] **Step 3: Verify**

Run: `npx eslint src/pages/Dashboard.jsx`
Expected: no new errors (this file may already show pre-existing warnings unrelated to this change — only check that nothing new appears about `Shield` or unused vars from this edit).

Run the dev server, open `/#/dashboard`. Confirm: no shield icon in the header. Press `Ctrl+Shift+A` and confirm the old overlay panel still opens (unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "chore: remove Dashboard's admin-entry button now that /admin is standalone"
```

---

## Task 3: Laptop breakpoint — Sidebar

**Files:**
- Modify: `src/components/Sidebar.css`

**Interfaces:** none — pure CSS addition.

- [ ] **Step 1: Add the 1440px block**

Read `src/components/Sidebar.css`. Find the sole existing media query:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 2: Verify**

Run: `npm run build` — expect success, no CSS syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.css
git commit -m "feat: narrow sidebar to 200px under 1440px viewports"
```

---

## Task 4: Laptop breakpoint — Dashboard

**Files:**
- Modify: `src/pages/Dashboard.css`

**Interfaces:** none.

- [ ] **Step 1: Add the 1440px block**

Read `src/pages/Dashboard.css`. Find:

```css
@media (max-width: 1024px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .header-content {
    max-width: 1140px;
  }

  .dashboard-main {
    max-width: 1140px;
    padding: 24px 24px;
  }
}

@media (max-width: 1024px) {
```

- [ ] **Step 2: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.css
git commit -m "feat: laptop breakpoint for Dashboard container widths"
```

---

## Task 5: Laptop breakpoint — StyleConfig

**Files:**
- Modify: `src/pages/StyleConfig.css`

**Interfaces:** none. (This file's `.style-config-page`/`.style-config-header` classes are also used by `ShopTheLookConfig.jsx`/`FlashSaleConfig.jsx`, but this task only touches `.config-content`, StyleConfig's own container — no cross-page impact.)

- [ ] **Step 1: Add the 1440px block**

Read `src/pages/StyleConfig.css`. Find:

```css
@media (max-width: 1400px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .config-content {
    max-width: 1140px;
    padding: 0 24px;
  }
}

@media (max-width: 1400px) {
```

- [ ] **Step 2: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 3: Commit**

```bash
git add src/pages/StyleConfig.css
git commit -m "feat: laptop breakpoint for StyleConfig container width"
```

---

## Task 6: Laptop breakpoint — Spin Wheel pages

**Files:**
- Modify: `src/pages/SpinWheel.css`
- Modify: `src/pages/SpinWheelConfig.css`
- Modify: `src/pages/SpinWheelAnalytics.css`

**Interfaces:** none.

- [ ] **Step 1: `SpinWheel.css`**

Read `src/pages/SpinWheel.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .wheels-list-modern {
    max-width: 1140px;
    padding: 24px;
  }

  .header-content-modern {
    max-width: 1140px;
    padding: 20px 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 2: `SpinWheelConfig.css`**

Read `src/pages/SpinWheelConfig.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .tab-content {
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 3: `SpinWheelAnalytics.css`**

Read `src/pages/SpinWheelAnalytics.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .spin-analytics {
    max-width: 1140px;
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 4: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SpinWheel.css src/pages/SpinWheelConfig.css src/pages/SpinWheelAnalytics.css
git commit -m "feat: laptop breakpoint for Spin Wheel pages"
```

---

## Task 7: Laptop breakpoint — Gift Cards & Admin Panel

**Files:**
- Modify: `src/pages/GiftCardsMain.css`
- Modify: `src/pages/AdminPanel.css`

**Interfaces:** none.

- [ ] **Step 1: `GiftCardsMain.css`**

Read `src/pages/GiftCardsMain.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .main-content {
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 2: `AdminPanel.css`**

Read `src/pages/AdminPanel.css`. Find:

```css
@media (max-width: 1200px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .admin-login-card {
    padding: 24px 24px;
  }
}

@media (max-width: 1200px) {
```

- [ ] **Step 3: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GiftCardsMain.css src/pages/AdminPanel.css
git commit -m "feat: laptop breakpoint for Gift Cards and Admin Panel"
```

---

## Task 8: Laptop breakpoint — Popups

**Files:**
- Modify: `src/pages/PopupsList.css`
- Modify: `src/pages/PopupConfig.css`

**Interfaces:** none.

- [ ] **Step 1: `PopupsList.css`**

Read `src/pages/PopupsList.css`. Find:

```css
@media (max-width: 900px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .popups-header-inner {
    max-width: 1140px;
    padding: 20px 24px;
  }

  .popups-content {
    max-width: 1140px;
    padding: 24px;
  }
}

@media (max-width: 900px) {
```

- [ ] **Step 2: `PopupConfig.css`**

Read `src/pages/PopupConfig.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .config-header-inner {
    padding: 18px 24px;
  }

  .config-tabs-inner {
    padding: 0 24px;
  }

  .config-body {
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 3: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PopupsList.css src/pages/PopupConfig.css
git commit -m "feat: laptop breakpoint for Popups pages"
```

---

## Task 9: Laptop breakpoint — Local Stock & Countdown

**Files:**
- Modify: `src/pages/LocalStockConfig.css`
- Modify: `src/pages/CountdownList.css`
- Modify: `src/pages/CountdownConfig.css`

**Interfaces:** none.

- [ ] **Step 1: `LocalStockConfig.css`**

Read `src/pages/LocalStockConfig.css`. Find:

```css
@media (max-width: 900px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .local-stock-page {
    max-width: 1140px;
    padding: 20px 24px;
  }
}

@media (max-width: 900px) {
```

- [ ] **Step 2: `CountdownList.css`**

Read `src/pages/CountdownList.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .install-banner-countdown {
    max-width: 1140px;
    padding: 0 24px;
  }

  .countdowns-list-modern {
    max-width: 1140px;
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 3: `CountdownConfig.css`**

Read `src/pages/CountdownConfig.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .tab-content {
    padding: 24px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 4: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LocalStockConfig.css src/pages/CountdownList.css src/pages/CountdownConfig.css
git commit -m "feat: laptop breakpoint for Local Stock and Countdown pages"
```

---

## Task 10: Laptop breakpoint — Badges & Integrations

**Files:**
- Modify: `src/pages/BadgesList.css`
- Modify: `src/pages/BadgeConfig.css`
- Modify: `src/pages/Integrations.css`

**Interfaces:** none.

- [ ] **Step 1: `BadgesList.css`**

Read `src/pages/BadgesList.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .badges-container {
    max-width: 1140px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 2: `BadgeConfig.css`**

Read `src/pages/BadgeConfig.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .badge-config-container {
    max-width: 1140px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 3: `Integrations.css`**

Read `src/pages/Integrations.css`. Find:

```css
@media (max-width: 768px) {
```

Insert immediately above it:

```css
@media (max-width: 1440px) {
  .integrations-container {
    max-width: 1140px;
    padding: 24px 20px;
  }
}

@media (max-width: 768px) {
```

- [ ] **Step 4: Verify**

Run: `npm run build` — expect success.

- [ ] **Step 5: Commit**

```bash
git add src/pages/BadgesList.css src/pages/BadgeConfig.css src/pages/Integrations.css
git commit -m "feat: laptop breakpoint for Badges and Integrations pages"
```

---

## Task 11: Final manual verification sweep

**Files:** none — verification only.

**Interfaces:** none.

- [ ] **Step 1: Resize and click through**

Run the dev server (`npm run dev`), open the browser devtools device toolbar (or just resize the window) to **1366×768**, log in, and visit each of: `/dashboard`, `/style`, `/spin-wheel`, `/spin-wheel/:id/analytics` (any existing wheel), `/badges`, `/badges/create`, `/popups`, `/popups/create`, `/local-stock`, `/countdown`, `/countdown/create`, `/integrations`, `/#/admin`.

For each: confirm no horizontal scrollbar, no element overlapping/clipped, and the content doesn't feel pinned against the far edge with the sidebar eating disproportionate space. `/#/admin` additionally: confirm no Sidebar renders there at all (Task 1).

- [ ] **Step 2: Spot-check the untouched mobile breakpoint**

At the same 1366×768 test, additionally shrink to ~375px width (mobile) on 2-3 of the pages above and confirm the existing mobile layout still looks correct — i.e., the new `1440px` rules didn't leak into or conflict with the existing `768px` rules.

- [ ] **Step 3: No commit needed** — verification only. If Step 1 or 2 reveal a mismatch, return to the relevant task (3-10), adjust the specific value, and re-run `npm run build` before re-committing (use `git commit --amend` only if the original commit hasn't been pushed yet, otherwise a new small fix commit).
