# Ocultar Cupones y Gift Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Coupons and Gift Cards from the app's navigation and routing (Sidebar, Dashboard cards, `App.jsx` routes) so they're unreachable — by nav or by typing the URL — while leaving every page/component file and 100% of the backend (`functions/index.js`) completely untouched, so it can be restored in minutes if ever needed.

**Architecture:** Pure frontend, three files, no deletions — only remove imports/routes/nav-entries/dashboard-cards that reference the Coupons and Gift Cards pages. The page files themselves (`CreateCoupon.jsx`, `CouponsList.jsx`, `GiftCardV2.jsx`, etc.) stay exactly where they are, just disconnected from the router.

**Tech Stack:** React. No backend, no dependency changes.

## Global Constraints

- Zero changes to `functions/index.js` — this is a UI-visibility change only.
- Zero file deletions — every Coupons/Gift Cards page/component file stays on disk, unmodified.
- Spin Wheel, Countdown, Style, Badges, Popups, Shop the Look, Banner Home, Flash Sale, Barra Mercado Libre, Integraciones — none of these are touched.

---

## Task 1: Remove routes and imports from `src/App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Remove the seven imports**

old_string:
```jsx
import Dashboard from './pages/Dashboard';
import CreateCoupon from './pages/CreateCoupon';
import CouponsList from './pages/CouponsList';
import GiftCardV2 from './pages/GiftCardV2';
import CreateGiftCard from './pages/CreateGiftCard';
import GiftCardTemplates from './pages/GiftCardTemplates';
import GiftCardDetail from './pages/GiftCardDetail';
import CouponAnalytics from './pages/CouponAnalytics';
import SpinWheel from './pages/SpinWheel';
```

new_string:
```jsx
import Dashboard from './pages/Dashboard';
import SpinWheel from './pages/SpinWheel';
```

- [ ] **Step 2: Remove the seven routes**

old_string:
```jsx
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-coupon" element={<CreateCoupon />} />
          <Route path="/coupons" element={<CouponsList />} />
          <Route path="/coupon-analytics/:couponId" element={<CouponAnalytics />} />
          <Route path="/gift-cards" element={<GiftCardV2 />} />
          <Route path="/gift-card/:giftCardId" element={<GiftCardDetail />} />
          <Route path="/create-gift-card" element={<CreateGiftCard />} />
          <Route path="/gift-card-templates" element={<GiftCardTemplates />} />
          <Route path="/spin-wheel" element={<SpinWheel />} />
```

new_string:
```jsx
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/spin-wheel" element={<SpinWheel />} />
```

Note: `GiftCardsMain.jsx`, `GiftCardsList.jsx`, `GiftCardProducts.jsx`, `SoldGiftCards.jsx`, `UseGiftCard.jsx`, `CreatePromotion.jsx`, `PromotionsList.jsx` are not imported in `App.jsx` today (confirmed during earlier research) — nothing to do for those here.

- [ ] **Step 3: Verify**

Run: Grep `src/App.jsx` for `CreateCoupon|CouponsList|CouponAnalytics|GiftCardV2|CreateGiftCard|GiftCardTemplates|GiftCardDetail` — expect zero matches.
Run: `npm run build` — expect success (these components still exist as files, just unimported — no broken references).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "chore: unroute Coupons and Gift Cards pages (files kept, code untouched)"
```

---

## Task 2: Remove nav entries and dashboard cards

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Remove the two Sidebar nav entries**

old_string:
```jsx
  { path: '/countdown',      icon: Clock,         label: 'Countdowns' },
  { path: '/badges',     icon: BadgeCheck,      label: 'Badges' },
  { path: '/coupons',    icon: Tag,             label: 'Cupones' },
  { path: '/spin-wheel', icon: Sparkles,        label: 'Ruleta' },
  { path: '/gift-cards', icon: Gift,            label: 'Gift Cards' },
  { path: '/popups',     icon: Bell,            label: 'Popups' },
```

new_string:
```jsx
  { path: '/countdown',      icon: Clock,         label: 'Countdowns' },
  { path: '/badges',     icon: BadgeCheck,      label: 'Badges' },
  { path: '/spin-wheel', icon: Sparkles,        label: 'Ruleta' },
  { path: '/popups',     icon: Bell,            label: 'Popups' },
```

- [ ] **Step 2: Remove the now-unused `Tag`/`Gift` icon imports from Sidebar.jsx**

First: Grep `src/components/Sidebar.jsx` for `Tag|Gift` to confirm neither icon is used anywhere else in the file. If confirmed unused:

old_string:
```jsx
import {
  LayoutDashboard, Palette, Clock, BadgeCheck, Tag,
  Sparkles, Gift, Bell, Settings, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Image, Megaphone, Zap
} from 'lucide-react';
```

new_string:
```jsx
import {
  LayoutDashboard, Palette, Clock, BadgeCheck,
  Sparkles, Bell, Settings, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Image, Megaphone, Zap
} from 'lucide-react';
```

- [ ] **Step 3: Remove the two Dashboard feature cards**

old_string:
```jsx
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
```

new_string:
```jsx
    {
      icon: Sparkles,
      title: 'Ruleta de Descuentos',
      description: 'Sumá una ruleta personalizada para aumentar la tasa de conversión. El diferencial: cada cupón es único por usuario y se desactiva automáticamente si no se usa, brindando más seguridad al dueño de la tienda.',
      path: '/spin-wheel'
    },
    {
      icon: ShoppingBag,
      title: 'Shop the Look',
```

- [ ] **Step 4: Remove the now-unused `Tag`/`CreditCard` icon imports from Dashboard.jsx**

First: Grep `src/pages/Dashboard.jsx` for `Tag|CreditCard` to confirm neither is used elsewhere. If confirmed unused:

old_string:
```jsx
import { Tag, CreditCard, Sparkles, Clock, Palette, Shield, BadgeCheck, Bell, Rocket, ChevronRight, ShoppingBag, Image } from 'lucide-react';
```

new_string:
```jsx
import { Sparkles, Clock, Palette, Shield, BadgeCheck, Bell, Rocket, ChevronRight, ShoppingBag, Image } from 'lucide-react';
```

- [ ] **Step 5: Build check**

Run: `npm run build` — expect success, no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.jsx src/pages/Dashboard.jsx
git commit -m "chore: remove Coupons and Gift Cards from Sidebar nav and Dashboard cards"
```

---

## Final check

- [ ] `npm run build` — clean.
- [ ] Manual pass in the browser: confirm "Cupones" and "Gift Cards" no longer appear in Sidebar or Dashboard, and confirm Spin Wheel, Style, Countdown, Badges, Popups, Shop the Look, Banner Home still all work normally.
- [ ] `functions/index.js` — untouched (confirm with `git status` / `git diff` showing no changes to it in this plan's commits).
