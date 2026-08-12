# Badges Style Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the live, multi-rule Badges module (`BadgeConfig.jsx` + `/api/badges-script.js`) up to the visual/functional quality of the orphaned `NewBadgeConfig.jsx` (border, shadow, text-transform, opacity, icon position, custom CSS, live preview, per-page visibility), then delete the orphaned parallel system.

**Architecture:** New badge-design fields (border, shadow, textTransform, opacity, iconPosition, customCSS, visibility, plus a 5th "ribbon" shape) get added to the existing `design` object already stored per-badge in `promonube_badges`. A new pure module `functions/badge-render-helpers.js` (same shape as today's `theme-menu-selectors.js`) centralizes the backward-compatible defaulting logic and the page-template visibility check, unit-tested directly. `/api/badges-script.js` consumes that module server-side and embeds fully-resolved design objects into the generated client script — the client script itself stays a straightforward renderer, no default-filling logic duplicated there. `BadgeConfig.jsx` gets new form controls (following its existing per-field `useState` convention, not a nested object) plus a new Preview tab, both adapted from `NewBadgeConfig.jsx`'s already-built UI.

**Tech Stack:** React (`BadgeConfig.jsx`, existing per-field `useState` pattern — do not refactor to a single object), Node/Express (`functions/index.js`), Node's built-in `node:test` for the new pure module (same pattern as `theme-menu-selectors.js`).

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-11-badges-style-merge-design.md`.
- **Backward compatibility is the single most important property of this plan.** Badges saved before this change have no `border`, `shadow`, `textTransform`, `opacity`, `iconPosition`, `visibility` keys in their `design` object. Every default must reproduce today's actual rendered output exactly: no border, no shadow, `textTransform: 'uppercase'`, `opacity: 1`, `iconPosition: 'left'`, visible on every page (`home`/`category`/`product`). No currently-configured badge may change appearance when this ships.
- Page-type detection uses `window.LS.template` — verified live today against altorancho.com: returns exactly `"home"` on the homepage, `"category"` on a category listing page, `"product"` on a single product page. Do not invent a different detection method (URL pattern matching, DOM heuristics) — this field is the reliable platform-provided signal, same family as `window.LS.theme` used throughout the theme-aware-menu-widget work.
- Custom CSS (`design.customCSS`) is applied as raw declarations appended directly into the badge element's inline `style.cssText` — this is the existing, already-shipped pattern from the orphaned `/api/new-badge-script.js` (`functions/index.js:8446`, `\${BADGE_CONFIG.customCSS || ''}` interpolated straight into the cssText template). Do not add a CSS-scoping/wrapping helper — inline `style.cssText` is inherently scoped to that one element already; wrapping it in a `{ }` block would produce invalid CSS if a merchant pastes a full rule instead of bare declarations.
- The ribbon shape has a working reference implementation already shipped in the orphaned script (`functions/index.js:8449-8470`): a `::after` pseudo-element corner-fold triangle, position-aware (flips left/right based on `design.position`), using the badge's own background color at 44% alpha. Adapt this exact approach — do not design a new ribbon treatment from scratch.
- `functions/index.js` cannot be `require()`'d standalone locally (missing Firebase credentials, pre-existing, unrelated) — use `node --check functions/index.js` for sanity checks.
- `BadgeConfig.jsx` is behind normal merchant login (not the admin-key gate) — nobody implementing this plan has credentials to log in and see the authenticated view live. `npm run build` + `npx eslint` substitute for interactive UI verification during implementation, same constraint as the admin-theme-coverage-view plan. Final live confirmation is the project owner's step (Task 4).
- Do not touch the 9 existing rule types' matching logic (`evaluateBadgeRule`) — this plan is styling + visibility only.
- Do not adopt `NewBadgeConfig`'s single-global-config data model — `BadgeConfig.jsx`'s multi-badge CRUD architecture (one Firestore doc per named badge) is the foundation; every new field is per-badge.

---

## Task 1: `badge-render-helpers.js` — defaulting + visibility logic

**Files:**
- Create: `functions/badge-render-helpers.js`
- Create: `functions/badge-render-helpers.test.js`

**Interfaces:**
- Produces (used by Task 2):
  - `DEFAULT_BADGE_DESIGN` — the full set of backward-compatible defaults.
  - `resolveBadgeDesign(design: object|null|undefined) -> object` — always returns every field populated (existing fields + new ones), defaulting anything missing/partial.
  - `shouldShowOnTemplate(visibility: object|null|undefined, template: string) -> boolean` — `template` is one of `"home"`, `"category"`, `"product"`; unknown/other template strings return `true` (matches today's "show wherever a product card is found" behavior for pages we don't have a specific rule for, e.g. search results).

- [ ] **Step 1: Write the failing tests**

Create `functions/badge-render-helpers.test.js`:

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_BADGE_DESIGN,
  resolveBadgeDesign,
  shouldShowOnTemplate,
} = require("./badge-render-helpers");

test("resolveBadgeDesign fills every default when given an empty object", () => {
  const resolved = resolveBadgeDesign({});
  assert.equal(resolved.textTransform, "uppercase");
  assert.equal(resolved.opacity, 1);
  assert.equal(resolved.iconPosition, "left");
  assert.deepEqual(resolved.border, { enabled: false, width: "2px", style: "solid", color: "#000000" });
  assert.deepEqual(resolved.shadow, { enabled: false, x: "0px", y: "2px", blur: "10px", color: "#000000" });
  assert.deepEqual(resolved.visibility, { showOnProductPage: true, showOnCategoryPage: true, showOnHomePage: true });
  assert.equal(resolved.customCSS, "");
});

test("resolveBadgeDesign fills every default when given null or undefined", () => {
  assert.deepEqual(resolveBadgeDesign(null), resolveBadgeDesign({}));
  assert.deepEqual(resolveBadgeDesign(undefined), resolveBadgeDesign({}));
});

test("resolveBadgeDesign preserves an existing badge's pre-merge fields exactly (regression guard)", () => {
  const legacyDesign = {
    shape: "circle",
    position: "bottom-left",
    backgroundColor: "#111111",
    textColor: "#eeeeee",
    fontSize: 14,
    fontWeight: "bolder",
    animation: "shake",
    borderRadius: 8,
    showIcon: true,
    icon: "🔥",
  };
  const resolved = resolveBadgeDesign(legacyDesign);
  assert.equal(resolved.shape, "circle");
  assert.equal(resolved.position, "bottom-left");
  assert.equal(resolved.backgroundColor, "#111111");
  assert.equal(resolved.icon, "🔥");
  // and the new fields still get sane defaults, not left undefined
  assert.equal(resolved.textTransform, "uppercase");
  assert.equal(resolved.opacity, 1);
});

test("resolveBadgeDesign applies partial overrides without dropping the rest of that sub-object's defaults", () => {
  const resolved = resolveBadgeDesign({ border: { enabled: true, color: "#ff0000" } });
  assert.deepEqual(resolved.border, { enabled: true, width: "2px", style: "solid", color: "#ff0000" });
});

test("shouldShowOnTemplate returns true for every template when visibility is missing (backward compat)", () => {
  assert.equal(shouldShowOnTemplate(undefined, "home"), true);
  assert.equal(shouldShowOnTemplate(null, "category"), true);
  assert.equal(shouldShowOnTemplate({}, "product"), true);
});

test("shouldShowOnTemplate respects explicit false per template", () => {
  const visibility = { showOnProductPage: false, showOnCategoryPage: true, showOnHomePage: true };
  assert.equal(shouldShowOnTemplate(visibility, "product"), false);
  assert.equal(shouldShowOnTemplate(visibility, "category"), true);
  assert.equal(shouldShowOnTemplate(visibility, "home"), true);
});

test("shouldShowOnTemplate defaults to true for unrecognized template strings", () => {
  assert.equal(shouldShowOnTemplate({ showOnProductPage: false }, "search"), true);
  assert.equal(shouldShowOnTemplate({ showOnProductPage: false }, ""), true);
});

test("DEFAULT_BADGE_DESIGN is plain-JSON-serializable (embedded via JSON.stringify per badge)", () => {
  assert.equal(JSON.stringify(DEFAULT_BADGE_DESIGN).includes("function"), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test functions/badge-render-helpers.test.js`
Expected: FAIL — `Cannot find module './badge-render-helpers'`

- [ ] **Step 3: Write the module**

Create `functions/badge-render-helpers.js`:

```js
"use strict";

const DEFAULT_BADGE_DESIGN = {
  shape: "rectangle",
  position: "top-right",
  backgroundColor: "#FF6B6B",
  textColor: "#FFFFFF",
  fontSize: 12,
  fontWeight: "bold",
  animation: "pulse",
  borderRadius: 4,
  showIcon: false,
  icon: "⭐",
  iconPosition: "left",
  border: { enabled: false, width: "2px", style: "solid", color: "#000000" },
  shadow: { enabled: false, x: "0px", y: "2px", blur: "10px", color: "#000000" },
  textTransform: "uppercase",
  opacity: 1,
  customCSS: "",
  visibility: { showOnProductPage: true, showOnCategoryPage: true, showOnHomePage: true },
};

function resolveBadgeDesign(design) {
  const d = design || {};
  return {
    shape: d.shape || DEFAULT_BADGE_DESIGN.shape,
    position: d.position || DEFAULT_BADGE_DESIGN.position,
    backgroundColor: d.backgroundColor || DEFAULT_BADGE_DESIGN.backgroundColor,
    textColor: d.textColor || DEFAULT_BADGE_DESIGN.textColor,
    fontSize: d.fontSize || DEFAULT_BADGE_DESIGN.fontSize,
    fontWeight: d.fontWeight || DEFAULT_BADGE_DESIGN.fontWeight,
    animation: d.animation || DEFAULT_BADGE_DESIGN.animation,
    borderRadius: d.borderRadius != null ? d.borderRadius : DEFAULT_BADGE_DESIGN.borderRadius,
    showIcon: d.showIcon || false,
    icon: d.icon || DEFAULT_BADGE_DESIGN.icon,
    iconPosition: d.iconPosition || DEFAULT_BADGE_DESIGN.iconPosition,
    border: Object.assign({}, DEFAULT_BADGE_DESIGN.border, d.border || {}),
    shadow: Object.assign({}, DEFAULT_BADGE_DESIGN.shadow, d.shadow || {}),
    textTransform: d.textTransform || DEFAULT_BADGE_DESIGN.textTransform,
    opacity: d.opacity != null ? d.opacity : DEFAULT_BADGE_DESIGN.opacity,
    customCSS: d.customCSS || "",
    visibility: Object.assign({}, DEFAULT_BADGE_DESIGN.visibility, d.visibility || {}),
  };
}

function shouldShowOnTemplate(visibility, template) {
  const v = Object.assign({}, DEFAULT_BADGE_DESIGN.visibility, visibility || {});
  if (template === "product") return v.showOnProductPage !== false;
  if (template === "category") return v.showOnCategoryPage !== false;
  if (template === "home") return v.showOnHomePage !== false;
  return true;
}

module.exports = {
  DEFAULT_BADGE_DESIGN,
  resolveBadgeDesign,
  shouldShowOnTemplate,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npm test`
Expected: PASS — 8 new tests, 0 failures (plus all pre-existing `functions/*.test.js` suites still green — `npm test` there already runs `*.test.js` via the glob set up in an earlier plan).

- [ ] **Step 5: Commit**

```bash
git add functions/badge-render-helpers.js functions/badge-render-helpers.test.js
git commit -m "feat: add badge design defaulting and page-visibility pure helpers"
```

---

## Task 2: Wire the helpers into `/api/badges-script.js`

**Files:**
- Modify: `functions/index.js` (top: add require; `/api/badges-script.js` handler: embed resolved designs, add ribbon shape, apply new style fields, gate by page template)

**Interfaces:**
- Consumes: `resolveBadgeDesign`, `shouldShowOnTemplate` from `./badge-render-helpers` (Task 1).
- Produces: no new exports — generated-script behavior only, verified live in Task 4.

- [ ] **Step 1: Require the module**

Near the existing local requires at the top of `functions/index.js` (alongside `./subscriptionAccess` and `./theme-menu-selectors`):

```js
const { resolveBadgeDesign, shouldShowOnTemplate } = require('./badge-render-helpers');
```

- [ ] **Step 2: Resolve each badge's design server-side before embedding**

In the `/api/badges-script.js` handler, find (currently ~line 8943-8949):

```js
    const badges = [];
    badgesSnapshot.forEach(doc => {
      badges.push({
        id: doc.id,
        ...doc.data()
      });
    });
```

Replace with:

```js
    const badges = [];
    badgesSnapshot.forEach(doc => {
      const data = doc.data();
      badges.push({
        id: doc.id,
        ...data,
        design: resolveBadgeDesign(data.design),
      });
    });
```

This means every badge object embedded into the generated script already has a fully-populated `design` (all new fields present with correct defaults) — the client script never needs its own defaulting logic.

- [ ] **Step 3: Detect the current page template and read it into the generated script**

Find (currently ~line 8955-8956):

```js
  const BADGES_CONFIG = ${JSON.stringify(badges)};
  const STORE_ID = "${store}";
```

Add right after:

```js
  const BADGES_CONFIG = ${JSON.stringify(badges)};
  const STORE_ID = "${store}";
  const PAGE_TEMPLATE = (window.LS && window.LS.template) || '';
```

- [ ] **Step 4: Gate rendering by page visibility**

Find, inside `addBadgesToProduct` (currently ~line 9192-9198):

```js
    if (otherBadges.length > 0) {
      const productData = productDataMap[productId];
      if (productData) {
        const otherMatches = otherBadges.filter(badge => 
          evaluateBadgeRule(badge, productData)
        );
        matchingBadges = [...matchingBadges, ...otherMatches];
      }
    }
```

Replace with (adds the visibility filter to both the `all_products` badges collected earlier and the rule-matched ones — do this by filtering `matchingBadges` once at the end instead of touching two separate spots):

```js
    if (otherBadges.length > 0) {
      const productData = productDataMap[productId];
      if (productData) {
        const otherMatches = otherBadges.filter(badge => 
          evaluateBadgeRule(badge, productData)
        );
        matchingBadges = [...matchingBadges, ...otherMatches];
      }
    }

    matchingBadges = matchingBadges.filter(badge => shouldShowOnTemplate(badge.design.visibility, PAGE_TEMPLATE));
```

(`shouldShowOnTemplate` is not yet defined client-side — Step 5 adds it as a plain function inside the same IIFE, mirroring the pattern already used for `pnGetMenuSelectors` etc. in the style-widget script. It must be defined before this point in the script, so add it directly above `addBadgesToProduct` in Step 5.)

- [ ] **Step 5: Add the client-side `shouldShowOnTemplate` mirror and apply new style fields in `createBadgeElement`**

Find (currently ~line 9128, right before `addBadgesToProduct`):

```js
  // Crear elemento de badge
  function createBadgeElement(badge) {
```

Add a small mirror function directly above it (kept in sync with the server-side one by the test in Task 1 — this is intentionally the same tiny amount of duplication already accepted elsewhere in this file, e.g. `pnGetMenuSelectors`/`resolveMenuSelectors`):

```js
  function shouldShowOnTemplate(visibility, template) {
    const v = visibility || {};
    if (template === 'product') return v.showOnProductPage !== false;
    if (template === 'category') return v.showOnCategoryPage !== false;
    if (template === 'home') return v.showOnHomePage !== false;
    return true;
  }

  // Crear elemento de badge
  function createBadgeElement(badge) {
```

Now find the body of `createBadgeElement` (currently ~line 9129-9176) and replace it entirely:

```js
  function createBadgeElement(badge) {
    const badgeEl = document.createElement('div');
    badgeEl.className = 'pn-badge';

    const { design } = badge;
    
    // Posiciones
    const positions = {
      'top-left': 'top: 10px; left: 10px;',
      'top-right': 'top: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;'
    };

    let borderRadius = design.borderRadius || 4;
    if (design.shape === 'circle') {
      badgeEl.classList.add('pn-badge-circle');
      borderRadius = 50;
    } else if (design.shape === 'flag') {
      badgeEl.classList.add('pn-badge-flag');
    } else if (design.shape === 'ribbon') {
      badgeEl.classList.add('pn-badge-ribbon');
      if (!document.getElementById('pn-badge-ribbon-style-' + badge.id)) {
        const ribbonStyle = document.createElement('style');
        ribbonStyle.id = 'pn-badge-ribbon-style-' + badge.id;
        ribbonStyle.textContent = \`
          .pn-badge-ribbon-\${badge.id}::after {
            content: '';
            position: absolute;
            \${(design.position || '').includes('right') ? 'right: 0;' : 'left: 0;'}
            bottom: -6px;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 6px 6px 0 0;
            border-color: \${design.backgroundColor || '#FF6B6B'}44 transparent transparent transparent;
          }
        \`;
        document.head.appendChild(ribbonStyle);
      }
      badgeEl.classList.add('pn-badge-ribbon-' + badge.id);
    }

    if (design.animation && design.animation !== 'none') {
      badgeEl.classList.add(\`pn-badge-animation-\${design.animation}\`);
    }

    const borderCss = design.border && design.border.enabled
      ? \`border: \${design.border.width} \${design.border.style} \${design.border.color};\`
      : '';
    const shadowCss = design.shadow && design.shadow.enabled
      ? \`box-shadow: \${design.shadow.x} \${design.shadow.y} \${design.shadow.blur} \${design.shadow.color};\`
      : '';

    badgeEl.style.cssText = \`
      \${positions[design.position] || positions['top-right']}
      background: \${design.backgroundColor || '#FF6B6B'};
      color: \${design.textColor || '#FFFFFF'};
      font-size: \${design.fontSize || 12}px;
      font-weight: \${design.fontWeight || 'bold'};
      padding: \${design.shape === 'circle' ? '0' : '6px 12px'};
      border-radius: \${design.shape === 'circle' ? '50%' : borderRadius + 'px'};
      text-transform: \${design.textTransform || 'uppercase'};
      opacity: \${design.opacity != null ? design.opacity : 1};
      \${borderCss}
      \${shadowCss}
      \${design.customCSS || ''}
    \`;

    if (design.showIcon && design.icon) {
      const icon = document.createElement('span');
      icon.textContent = design.icon;
      if (design.iconPosition === 'right') {
        const text = document.createElement('span');
        text.textContent = badge.badgeText;
        badgeEl.appendChild(text);
        badgeEl.appendChild(icon);
        return badgeEl;
      }
      badgeEl.appendChild(icon);
    }

    const text = document.createElement('span');
    text.textContent = badge.badgeText;
    badgeEl.appendChild(text);

    return badgeEl;
  }
```

Note: the ribbon style tag and class name are keyed per-badge-id (`pn-badge-ribbon-` + `badge.id`) rather than a single shared `.pn-badge-ribbon` class, because different badges can have different `position`/`backgroundColor` and the `::after` rule bakes those in — a shared class would only reflect whichever badge's ribbon style was injected first.

- [ ] **Step 6: Sanity check**

Run: `node --check functions/index.js` from repo root.
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add functions/index.js
git commit -m "feat: render new badge design fields and page-visibility in badges-script.js"
```

---

## Task 3: `BadgeConfig.jsx` — new controls, visual selectors, Preview tab

**Files:**
- Modify: `src/pages/BadgeConfig.jsx`
- Modify: `src/pages/BadgeConfig.css`

**Interfaces:** none — this is the UI consumer of the `design` shape Tasks 1-2 already established. Verified by build/lint (Step 8) and Task 4's live check.

- [ ] **Step 1: Add new state, following the file's existing per-field `useState` convention**

Find (currently lines 41-42):

```jsx
  const [showIcon, setShowIcon] = useState(false);
  const [icon, setIcon] = useState('⭐');
```

Add right after:

```jsx
  const [showIcon, setShowIcon] = useState(false);
  const [icon, setIcon] = useState('⭐');
  const [iconPosition, setIconPosition] = useState('left');
  const [borderEnabled, setBorderEnabled] = useState(false);
  const [borderWidth, setBorderWidth] = useState('2px');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [borderColor, setBorderColor] = useState('#000000');
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowX, setShadowX] = useState('0px');
  const [shadowY, setShadowY] = useState('2px');
  const [shadowBlur, setShadowBlur] = useState('10px');
  const [shadowColor, setShadowColor] = useState('#000000');
  const [textTransform, setTextTransform] = useState('uppercase');
  const [opacity, setOpacity] = useState(1);
  const [customCSS, setCustomCSS] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOnProductPage, setShowOnProductPage] = useState(true);
  const [showOnCategoryPage, setShowOnCategoryPage] = useState(true);
  const [showOnHomePage, setShowOnHomePage] = useState(true);
```

- [ ] **Step 2: Load the new fields with backward-compatible defaults**

Find (currently ~line 88-99):

```jsx
      if (data.design) {
        setShape(data.design.shape || 'rectangle');
        setPosition(data.design.position || 'top-right');
        setBackgroundColor(data.design.backgroundColor || '#FF6B6B');
        setTextColor(data.design.textColor || '#FFFFFF');
        setFontSize(data.design.fontSize || 12);
        setFontWeight(data.design.fontWeight || 'bold');
        setAnimation(data.design.animation || 'pulse');
        setBorderRadius(data.design.borderRadius || 4);
        setShowIcon(data.design.showIcon || false);
        setIcon(data.design.icon || '⭐');
      }
```

Replace with:

```jsx
      if (data.design) {
        setShape(data.design.shape || 'rectangle');
        setPosition(data.design.position || 'top-right');
        setBackgroundColor(data.design.backgroundColor || '#FF6B6B');
        setTextColor(data.design.textColor || '#FFFFFF');
        setFontSize(data.design.fontSize || 12);
        setFontWeight(data.design.fontWeight || 'bold');
        setAnimation(data.design.animation || 'pulse');
        setBorderRadius(data.design.borderRadius || 4);
        setShowIcon(data.design.showIcon || false);
        setIcon(data.design.icon || '⭐');
        setIconPosition(data.design.iconPosition || 'left');
        setBorderEnabled(data.design.border?.enabled || false);
        setBorderWidth(data.design.border?.width || '2px');
        setBorderStyle(data.design.border?.style || 'solid');
        setBorderColor(data.design.border?.color || '#000000');
        setShadowEnabled(data.design.shadow?.enabled || false);
        setShadowX(data.design.shadow?.x || '0px');
        setShadowY(data.design.shadow?.y || '2px');
        setShadowBlur(data.design.shadow?.blur || '10px');
        setShadowColor(data.design.shadow?.color || '#000000');
        setTextTransform(data.design.textTransform || 'uppercase');
        setOpacity(data.design.opacity != null ? data.design.opacity : 1);
        setCustomCSS(data.design.customCSS || '');
        setShowOnProductPage(data.design.visibility?.showOnProductPage !== false);
        setShowOnCategoryPage(data.design.visibility?.showOnCategoryPage !== false);
        setShowOnHomePage(data.design.visibility?.showOnHomePage !== false);
      }
```

- [ ] **Step 3: Save the new fields**

Find (currently ~line 256-267):

```jsx
        design: {
          shape,
          position,
          backgroundColor,
          textColor,
          fontSize,
          fontWeight,
          animation,
          borderRadius,
          showIcon,
          icon,
        }
```

Replace with:

```jsx
        design: {
          shape,
          position,
          backgroundColor,
          textColor,
          fontSize,
          fontWeight,
          animation,
          borderRadius,
          showIcon,
          icon,
          iconPosition,
          border: { enabled: borderEnabled, width: borderWidth, style: borderStyle, color: borderColor },
          shadow: { enabled: shadowEnabled, x: shadowX, y: shadowY, blur: shadowBlur, color: shadowColor },
          textTransform,
          opacity,
          customCSS,
          visibility: { showOnProductPage, showOnCategoryPage, showOnHomePage },
        }
```

- [ ] **Step 4: Add "Dónde mostrar" checkboxes to the General tab**

Find (currently ~line 739-749, the end of the General tab, right before its closing `</div>`):

```jsx
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Badge activo</span>
              </label>
              <small>Desactiva el badge para ocultarlo sin eliminarlo</small>
            </div>
          </div>
        )}
```

Replace with:

```jsx
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Badge activo</span>
              </label>
              <small>Desactiva el badge para ocultarlo sin eliminarlo</small>
            </div>

            <div className="form-group">
              <label>Dónde mostrar</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showOnProductPage}
                    onChange={(e) => setShowOnProductPage(e.target.checked)}
                  />
                  <span>Página de producto individual</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showOnCategoryPage}
                    onChange={(e) => setShowOnCategoryPage(e.target.checked)}
                  />
                  <span>Páginas de categorías / colecciones</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showOnHomePage}
                    onChange={(e) => setShowOnHomePage(e.target.checked)}
                  />
                  <span>Página de inicio</span>
                </label>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 5: Replace the shape radio-group with the visual shape selector (adds "ribbon")**

Find (currently ~line 791-831, the "Forma" `form-group` at the top of the Design tab):

```jsx
              <div className="form-group">
                <label>Forma</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="rectangle"
                      checked={shape === 'rectangle'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Rectángulo
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="rounded"
                      checked={shape === 'rounded'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Redondeado
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="circle"
                      checked={shape === 'circle'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Círculo
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="flag"
                      checked={shape === 'flag'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Bandera
                  </label>
                </div>
              </div>
```

Replace with:

```jsx
              <div className="form-group">
                <label>Forma</label>
                <div className="shape-selector">
                  <div className={`shape-option ${shape === 'rectangle' ? 'selected' : ''}`} onClick={() => setShape('rectangle')}>
                    <div className="shape-preview rectangular"></div>
                    <span>Rectángulo</span>
                  </div>
                  <div className={`shape-option ${shape === 'rounded' ? 'selected' : ''}`} onClick={() => setShape('rounded')}>
                    <div className="shape-preview rounded"></div>
                    <span>Redondeado</span>
                  </div>
                  <div className={`shape-option ${shape === 'circle' ? 'selected' : ''}`} onClick={() => setShape('circle')}>
                    <div className="shape-preview circular"></div>
                    <span>Círculo</span>
                  </div>
                  <div className={`shape-option ${shape === 'flag' ? 'selected' : ''}`} onClick={() => setShape('flag')}>
                    <div className="shape-preview" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 50%, 100% 100%, 0 100%)', borderRadius: 0 }}></div>
                    <span>Bandera</span>
                  </div>
                  <div className={`shape-option ${shape === 'ribbon' ? 'selected' : ''}`} onClick={() => setShape('ribbon')}>
                    <div className="shape-preview ribbon"></div>
                    <span>Cinta</span>
                  </div>
                </div>
              </div>
```

- [ ] **Step 6: Replace the position radio-group with the visual position selector**

Find (currently the "Posición" `form-group` immediately after the shape one, ~line 833-873):

```jsx
              <div className="form-group">
                <label>Posición</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="top-left"
                      checked={position === 'top-left'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Arriba Izquierda
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="top-right"
                      checked={position === 'top-right'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Arriba Derecha
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="bottom-left"
                      checked={position === 'bottom-left'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Abajo Izquierda
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="bottom-right"
                      checked={position === 'bottom-right'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Abajo Derecha
                  </label>
                </div>
              </div>
```

Replace with:

```jsx
              <div className="form-group">
                <label>Posición</label>
                <div className="position-selector">
                  <div className={`position-option ${position === 'top-left' ? 'selected' : ''}`} onClick={() => setPosition('top-left')}>
                    <div className="position-preview"><div className="position-dot top-left"></div></div>
                    <span>Arriba Izq.</span>
                  </div>
                  <div className={`position-option ${position === 'top-right' ? 'selected' : ''}`} onClick={() => setPosition('top-right')}>
                    <div className="position-preview"><div className="position-dot top-right"></div></div>
                    <span>Arriba Der.</span>
                  </div>
                  <div className={`position-option ${position === 'bottom-left' ? 'selected' : ''}`} onClick={() => setPosition('bottom-left')}>
                    <div className="position-preview"><div className="position-dot bottom-left"></div></div>
                    <span>Abajo Izq.</span>
                  </div>
                  <div className={`position-option ${position === 'bottom-right' ? 'selected' : ''}`} onClick={() => setPosition('bottom-right')}>
                    <div className="position-preview"><div className="position-dot bottom-right"></div></div>
                    <span>Abajo Der.</span>
                  </div>
                </div>
              </div>
```

- [ ] **Step 7: Add icon position, border, shadow, text-transform, opacity, and the Avanzado (custom CSS) section**

Find the end of the Design tab's controls (currently right after the "Icono (emoji)" conditional block, ~line 976-988, and before the closing `</div>` of `design-controls`):

```jsx
              {showIcon && (
                <div className="form-group">
                  <label>Icono (emoji)</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="input-field"
                    placeholder="⭐"
                    maxLength="2"
                  />
                </div>
              )}
            </div>
          </div>
        )}
```

Replace with:

```jsx
              {showIcon && (
                <div className="form-group">
                  <label>Icono (emoji)</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="input-field"
                    placeholder="⭐"
                    maxLength="2"
                  />
                </div>
              )}

              {showIcon && (
                <div className="form-group">
                  <label>Posición del ícono</label>
                  <div className="radio-group">
                    <label>
                      <input type="radio" value="left" checked={iconPosition === 'left'} onChange={(e) => setIconPosition(e.target.value)} />
                      Izquierda del texto
                    </label>
                    <label>
                      <input type="radio" value="right" checked={iconPosition === 'right'} onChange={(e) => setIconPosition(e.target.value)} />
                      Derecha del texto
                    </label>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Transformación de texto</label>
                <select value={textTransform} onChange={(e) => setTextTransform(e.target.value)} className="select-field">
                  <option value="uppercase">MAYÚSCULAS</option>
                  <option value="lowercase">minúsculas</option>
                  <option value="capitalize">Capitalizado</option>
                  <option value="none">Sin cambios</option>
                </select>
              </div>

              <div className="form-group">
                <label>Opacidad ({opacity})</label>
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={borderEnabled} onChange={(e) => setBorderEnabled(e.target.checked)} />
                  <span>Agregar borde</span>
                </label>
              </div>
              {borderEnabled && (
                <>
                  <div className="form-group">
                    <label>Ancho del borde</label>
                    <input type="text" value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} className="input-field" placeholder="2px" />
                  </div>
                  <div className="form-group">
                    <label>Estilo del borde</label>
                    <select value={borderStyle} onChange={(e) => setBorderStyle(e.target.value)} className="select-field">
                      <option value="solid">Sólido</option>
                      <option value="dashed">Punteado</option>
                      <option value="dotted">Puntos</option>
                      <option value="double">Doble</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Color del borde</label>
                    <div className="color-picker-group">
                      <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="color-picker" />
                      <input type="text" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="color-text" />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={shadowEnabled} onChange={(e) => setShadowEnabled(e.target.checked)} />
                  <span>Agregar sombra</span>
                </label>
              </div>
              {shadowEnabled && (
                <>
                  <div className="form-group">
                    <label>Desplazamiento X</label>
                    <input type="text" value={shadowX} onChange={(e) => setShadowX(e.target.value)} className="input-field" placeholder="0px" />
                  </div>
                  <div className="form-group">
                    <label>Desplazamiento Y</label>
                    <input type="text" value={shadowY} onChange={(e) => setShadowY(e.target.value)} className="input-field" placeholder="2px" />
                  </div>
                  <div className="form-group">
                    <label>Difuminado</label>
                    <input type="text" value={shadowBlur} onChange={(e) => setShadowBlur(e.target.value)} className="input-field" placeholder="10px" />
                  </div>
                  <div className="form-group">
                    <label>Color de sombra</label>
                    <div className="color-picker-group">
                      <input type="color" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="color-picker" />
                      <input type="text" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="color-text" />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <button type="button" className="btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? 'Ocultar avanzado ▲' : 'Mostrar avanzado ▼'}
                </button>
              </div>
              {showAdvanced && (
                <div className="form-group">
                  <label>CSS personalizado</label>
                  <textarea
                    value={customCSS}
                    onChange={(e) => setCustomCSS(e.target.value)}
                    className="input-field"
                    rows="4"
                    placeholder="Ej: transform: rotate(-5deg); letter-spacing: 2px;"
                  />
                  <small>Declaraciones CSS que se agregan directamente al badge. Solo afecta a este badge.</small>
                </div>
              )}
            </div>
          </div>
        )}
```

- [ ] **Step 8: Add the Preview tab**

Find the tab-button list (currently ~line 676-689):

```jsx
      <div className="config-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}
        >
          Diseño
        </button>
      </div>
```

Replace with:

```jsx
      <div className="config-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}
        >
          Diseño
        </button>
        <button
          className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>
```

Then find the end of the Design tab's JSX and the start of `config-footer` (currently ~line 990-994):

```jsx
            </div>
          </div>
        )}
      </div>

      <div className="config-footer">
```

Replace with (adds the new tab panel between the Design tab and `config-content`'s closing `</div>`):

```jsx
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="preview-tab">
            <div className="design-preview">
              <h3>Vista Previa</h3>
              <div className="preview-product" style={{position: 'relative', display: 'inline-block', width: '300px'}}>
                <div style={{position: 'relative', width: '300px', height: '300px'}}>
                  <div
                    className={`badge-preview badge-${shape} badge-${position} badge-animation-${animation}`}
                    style={{
                      position: 'absolute',
                      background: backgroundColor,
                      color: textColor,
                      fontSize: `${fontSize}px`,
                      fontWeight,
                      padding: shape === 'circle' ? '0' : '8px 12px',
                      borderRadius: shape === 'circle' ? '50%' : `${borderRadius}px`,
                      textTransform,
                      opacity,
                      border: borderEnabled ? `${borderWidth} ${borderStyle} ${borderColor}` : 'none',
                      boxShadow: shadowEnabled ? `${shadowX} ${shadowY} ${shadowBlur} ${shadowColor}` : 'none',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      ...(position === 'top-left' && { top: '10px', left: '10px' }),
                      ...(position === 'top-right' && { top: '10px', right: '10px' }),
                      ...(position === 'bottom-left' && { bottom: '10px', left: '10px' }),
                      ...(position === 'bottom-right' && { bottom: '10px', right: '10px' })
                    }}
                  >
                    {showIcon && iconPosition === 'left' && <span>{icon}</span>}
                    <span>{badgeText || 'BADGE'}</span>
                    {showIcon && iconPosition === 'right' && <span>{icon}</span>}
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop"
                    alt="Producto de ejemplo"
                    style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px'}}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23ddd" width="300" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="16"%3EProducto de ejemplo%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                <div style={{marginTop: '12px'}}>
                  <strong>Producto de Ejemplo</strong>
                  <p style={{margin: '4px 0 0', color: '#888'}}>$9.999</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="config-footer">
```

- [ ] **Step 9: CSS additions**

Append to the end of `src/pages/BadgeConfig.css` (ported directly from `NewBadgeConfig.css:286-419`, using this file's `--gl-*` custom properties which are already defined project-wide):

```css
/* Visual shape/position selectors (ported from NewBadgeConfig.css) */
.shape-selector,
.position-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.shape-option,
.position-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border: 2px solid var(--gl-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.shape-option:hover,
.position-option:hover {
  border-color: #6366f1;
  background: rgba(255, 255, 255, 0.05);
}

.shape-option.selected,
.position-option.selected {
  border-color: #6366f1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.shape-preview {
  width: 60px;
  height: 40px;
  background: #6366f1;
}

.shape-preview.rectangular { border-radius: 4px; }
.shape-preview.rounded { border-radius: 20px; }
.shape-preview.circular { border-radius: 50%; width: 40px; height: 40px; }
.shape-preview.ribbon { border-radius: 0; clip-path: polygon(0 0, 100% 0, 95% 50%, 100% 100%, 0 100%); }

.shape-option span,
.position-option span {
  font-size: 13px;
  font-weight: 500;
  color: var(--gl-text-primary);
}

.position-preview {
  position: relative;
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.position-dot {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #6366f1;
  border-radius: 3px;
}

.position-dot.top-left { top: 4px; left: 4px; }
.position-dot.top-right { top: 4px; right: 4px; }
.position-dot.bottom-left { bottom: 4px; left: 4px; }
.position-dot.bottom-right { bottom: 4px; right: 4px; }

.preview-tab {
  padding: 20px 0;
}
```

- [ ] **Step 10: Verify**

Run `npm run build` from repo root.
Expected: build succeeds, no new errors (the pre-existing CSS minify warning and chunk-size warning are unrelated and expected).

Run `npx eslint src/pages/BadgeConfig.jsx`.
Expected: 0 errors (pre-existing warnings elsewhere in the codebase are not this task's concern; if this specific file produces a new warning, read it and fix it — e.g. an unused variable from a leftover edit).

- [ ] **Step 11: Commit**

```bash
git add src/pages/BadgeConfig.jsx src/pages/BadgeConfig.css
git commit -m "feat: add rich styling controls and preview tab to BadgeConfig"
```

---

## Task 4: Deploy and verify with real data

**Files:** none (deploy + live verification only)

**Interfaces:** none — validates Tasks 1-3 together.

- [ ] **Step 1: Deploy**

Push to `main` (Railway auto-deploys the backend on push, per this project's established deploy path). The frontend (`BadgeConfig.jsx` changes) needs its own publish step per how this project ships its frontend build — confirm with the project owner if that's still a manual upload.

- [ ] **Step 2: Regression check — an existing badge must render unchanged**

Find a real store with at least one already-configured, active badge (created before this change). Fetch its live script and confirm the badge still renders with no border, no shadow, uppercase text, full opacity, icon on the left, and on every page type — exactly as it did before this plan shipped.

Run: `curl -s "https://glowlab-production.up.railway.app/api/badges-script.js?store=<a real active storeId>"` and inspect the generated `BADGES_CONFIG` — confirm each existing badge's `design` object now has the new fields present with the backward-compatible defaults (not `undefined`), and that `createBadgeElement`'s output would be visually identical to before (no `border:` or `box-shadow:` in the inline style when the badge predates this change).

- [ ] **Step 3: New-feature check on the same or a test store**

Using `BadgeConfig.jsx` (requires real merchant login — project owner's step), create or edit a badge: enable border and shadow, change text-transform, set icon position to right, add a snippet of custom CSS, uncheck "Página de inicio". Save, then load the storefront's homepage, a category page, and a product page in the browser and confirm: the styling changes render correctly, and the badge is absent specifically on the homepage while still present on category/product pages.

- [ ] **Step 4: No commit needed** — verification only. If Step 2 or 3 reveal a mismatch, return to the relevant task, fix, and re-run this task's checks.

---

## Task 5: Cleanup — delete the orphaned parallel system

**Files:**
- Delete: `src/pages/NewBadgeConfig.jsx`, `src/pages/NewBadgeConfig.css`, `src/pages/BadgeConfig-old.jsx`
- Modify: `src/App.jsx` (remove the `NewBadgeConfig` import and its `/new-badge` route)
- Modify: `functions/index.js` (remove the `/api/new-badge-config` GET/POST handlers, the `/api/new-badge-script.js` handler, and the `new-badge-script` reference in the widget-URL registry)

**Interfaces:** none — pure deletion, no new interfaces. Only do this task after Task 4's live verification passes; deleting the orphaned system before confirming the merged one works removes the fallback reference implementation while you might still need to consult it.

- [ ] **Step 1: Remove the frontend files and route**

```bash
git rm src/pages/NewBadgeConfig.jsx src/pages/NewBadgeConfig.css src/pages/BadgeConfig-old.jsx
```

In `src/App.jsx`, remove line 15 (`import NewBadgeConfig from './pages/NewBadgeConfig';`) and line 62 (`<Route path="/new-badge" element={<NewBadgeConfig />} />`).

- [ ] **Step 2: Remove the backend endpoints**

In `functions/index.js`, remove the three handlers currently at lines 8186-8226 (`GET /api/new-badge-config/:storeId`), 8227-8344 (`POST /api/new-badge-config/:storeId`), and 8345 onward (`GET /api/new-badge-script.js` — read the file to find its exact closing `});` before deleting, since the earlier badge-render-helpers work may have shifted line numbers slightly by this point in the plan). Also remove the `new-badge-script` line from the widget-URL registry object (currently `functions/index.js:17949`, `'new-badge-script.js': ...`) and the `new-badge-script` check at (currently ~line 9768) if that surrounding code becomes dead as a result — read its context first to confirm removing that one line doesn't leave a broken conditional.

- [ ] **Step 3: Verify**

Run: `node --check functions/index.js` — expect exit 0.
Run: `npm run build` from repo root — expect success.
Run: `grep -rn "NewBadgeConfig\|new-badge-config\|new-badge-script" src functions/index.js` — expect no matches.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned NewBadgeConfig system, now merged into BadgeConfig"
```
