# Banner Home — imágenes independientes desktop/mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change Banner Home's recommended image size to 1080×1350 (both desktop and mobile) with a non-blocking size warning, and remove the desktop-as-fallback behavior so each device only shows a banner if that device's own image slot has an upload.

**Architecture:** No data-model changes — `imageUrl`/`imageMobileUrl` already exist on `promonube_banners/{docId}`. Two independent changes: (1) client-side dimension check in the admin upload flow (`src/pages/BannerConfig.jsx`), informational only; (2) the storefront widget generator (`functions/index.js`, `GET /api/banner-widget.js`) switches from a single `<picture>` (desktop image as universal fallback) to two independently-rendered `<img>` elements, each hidden by a `@media` query outside its own device range and omitted entirely from the HTML when its URL is unset.

**Tech Stack:** React (frontend, `src/pages/BannerConfig.jsx`), Express (backend, `functions/index.js`). No new dependencies.

## Global Constraints

- Target size: **1080×1350 px**, identical for desktop and mobile.
- Dimension check is **informational only** — never blocks the upload, regardless of the actual size.
- No new Firestore fields — reuse `imageUrl` and `imageMobileUrl` exactly as they exist today.
- No fallback between desktop and mobile images anymore — each device shows a banner only if that device's own slot has a URL.

---

## Task 1: Frontend — dimension check + updated copy

**Files:**
- Modify: `src/pages/BannerConfig.jsx`

**Interfaces:**
- Produces: `getImageDimensions(file)` → `Promise<{width: number, height: number}>` — local helper, used only within this file. `TARGET_WIDTH`/`TARGET_HEIGHT` constants (`1080`/`1350`).
- Consumes: existing `toast.info(...)` from `useToast()` (already imported in this file).

- [ ] **Step 1: Add the dimension-check helper and target-size constants**

old_string:
```jsx
const TABS = [
  { id: 'imagen', label: 'Imagen' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'posicion', label: 'Posición' },
];
```

new_string:
```jsx
const TABS = [
  { id: 'imagen', label: 'Imagen' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'posicion', label: 'Posición' },
];

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}
```

- [ ] **Step 2: Check dimensions before uploading, warn (don't block) on mismatch**

old_string:
```jsx
  const uploadImage = async (file, field, setUpl) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen supera 8MB'); return; }
    setUpl(true);
    try {
```

new_string:
```jsx
  const uploadImage = async (file, field, setUpl) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen supera 8MB'); return; }
    try {
      const { width, height } = await getImageDimensions(file);
      if (width !== TARGET_WIDTH || height !== TARGET_HEIGHT) {
        toast.info(`Esta imagen mide ${width}×${height}px. Se recomienda ${TARGET_WIDTH}×${TARGET_HEIGHT}px.`);
      }
    } catch (e) {
      // No se pudo leer la medida — no bloquea la subida.
    }
    setUpl(true);
    try {
```

- [ ] **Step 3: Update the recommended-size info box**

old_string:
```jsx
                <div className="info-box" style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                    <strong>📐 Medidas recomendadas:</strong> 1920 × 600 px mínimo para desktop · 768 × 500 px para mobile.
                    Formato JPG o WebP para mejor rendimiento.
                  </p>
                </div>
```

new_string:
```jsx
                <div className="info-box" style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                    <strong>📐 Medida recomendada:</strong> 1080 × 1350 px, tanto para desktop como para mobile.
                    Formato JPG o WebP para mejor rendimiento.
                  </p>
                </div>
```

- [ ] **Step 4: Update the mobile-image help text to reflect no-fallback behavior**

old_string:
```jsx
                  <label>Imagen mobile (opcional)</label>
                  <small className="field-hint">Si no la subís, se usa la imagen principal en todos los dispositivos.</small>
```

new_string:
```jsx
                  <label>Imagen mobile (opcional)</label>
                  <small className="field-hint">Si no la subís, el banner no se muestra en mobile.</small>
```

- [ ] **Step 5: Manual verification in the browser**

Run `npm run dev` from the repo root. Navigate to Banner Home (`/banner`), open the "Imagen" tab.
1. Upload an image that is NOT 1080×1350 (any photo works) — confirm a blue/info toast appears reading "Esta imagen mide {w}×{h}px. Se recomienda 1080×1350px." and that the image still uploads and shows in the preview.
2. Upload an image that IS exactly 1080×1350 (crop one with any image tool, or use a placeholder generator) — confirm no toast appears and the image uploads normally.
3. Confirm the info box text at the top of the tab now reads "1080 × 1350 px, tanto para desktop como para mobile."
4. Confirm the hint under "Imagen mobile (opcional)" now reads "Si no la subís, el banner no se muestra en mobile."

- [ ] **Step 6: Commit**

```bash
git add src/pages/BannerConfig.jsx
git commit -m "feat: warn on non-1080x1350 banner uploads, update no-fallback copy"
```

---

## Task 2: Backend — independent desktop/mobile rendering in the storefront widget

**Files:**
- Modify: `functions/index.js` (`GET /api/banner-widget.js`)

**Interfaces:**
- Consumes: `b.imageUrl`, `b.imageMobileUrl`, `b.imageAlt`, `b.linkUrl` (unchanged Firestore fields read from `promonube_banners/{docId}`).
- Produces: no change to the endpoint's URL, params, or response content-type — only the generated widget script's HTML output changes.

This task is independent of Task 1 — either can be done first. Together they complete the feature (Task 1 alone would only update the admin UI's copy/validation without actually changing storefront behavior; Task 2 alone would change storefront behavior without the admin explaining it, so both should land before this ships to real stores).

- [ ] **Step 1: Enable the banner when EITHER image is present, not just desktop**

old_string:
```js
    const bannerEnabled = b.enabled && b.imageUrl;
```

new_string:
```js
    const bannerEnabled = b.enabled && (b.imageUrl || b.imageMobileUrl);
```

- [ ] **Step 2: Replace the single `<picture>` fallback with two independent, CSS-gated images**

old_string:
```js
      const imgInner = b.imageMobileUrl
        ? `<picture><source media="(max-width:767px)" srcset="${b.imageMobileUrl.replace(/"/g, "&quot;")}"><img src="${b.imageUrl.replace(/"/g, "&quot;")}" alt="${(b.imageAlt || "").replace(/"/g, "&quot;")}" style="display:block;width:100%;height:auto;" loading="lazy"></picture>`
        : `<img src="${b.imageUrl.replace(/"/g, "&quot;")}" alt="${(b.imageAlt || "").replace(/"/g, "&quot;")}" style="display:block;width:100%;height:auto;" loading="lazy">`;

      const linkUrl = (b.linkUrl || "").trim();
      const pictureHtml = linkUrl
        ? `<a href="${linkUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" style="display:block;line-height:0;">${imgInner}</a>`
        : imgInner;

      const bannerHtml = `<div class="pn-banner-home" style="position:relative;width:${maxWidth};margin:0 auto;overflow:hidden;">${pictureHtml}${overlayHtml}<div class="pn-banner-content" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};padding:${padding}px;">${elementsHtml}</div></div>`;
```

new_string:
```js
      const imageAltEsc = (b.imageAlt || "").replace(/"/g, "&quot;");
      let imagesHtml = "";
      if (b.imageUrl) {
        imagesHtml += `<img class="pn-banner-desktop-img" src="${b.imageUrl.replace(/"/g, "&quot;")}" alt="${imageAltEsc}" style="display:block;width:100%;height:auto;" loading="lazy">`;
      }
      if (b.imageMobileUrl) {
        imagesHtml += `<img class="pn-banner-mobile-img" src="${b.imageMobileUrl.replace(/"/g, "&quot;")}" alt="${imageAltEsc}" style="display:block;width:100%;height:auto;" loading="lazy">`;
      }

      const linkUrl = (b.linkUrl || "").trim();
      const pictureHtml = linkUrl
        ? `<a href="${linkUrl.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" style="display:block;line-height:0;">${imagesHtml}</a>`
        : imagesHtml;

      const bannerHtml = `<style>@media (max-width:767px){#pn-banner-home .pn-banner-desktop-img{display:none!important}}@media (min-width:768px){#pn-banner-home .pn-banner-mobile-img{display:none!important}}</style><div class="pn-banner-home" style="position:relative;width:${maxWidth};margin:0 auto;overflow:hidden;">${pictureHtml}${overlayHtml}<div class="pn-banner-content" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:${alignItems};justify-content:${justifyContent};padding:${padding}px;">${elementsHtml}</div></div>`;
```

Note: `#pn-banner-home` in the `<style>` selectors refers to the wrapper `<div>`'s `id` (set later in this same function via `wrapper.id='pn-banner-home'` — unchanged, visible a few lines below this edit), not the `class="pn-banner-home"` on the inner div — both coexist already in the surrounding unchanged code and are not in conflict (one is an id on the outer wrapper, the other a class on the inner div).

- [ ] **Step 3: Syntax check**

Run: `node -c functions/index.js`
Expected: no output (syntax OK).

- [ ] **Step 4: Manual verification**

This endpoint needs a running server with Firestore credentials to verify live. If you have that available:
```bash
cd functions && node index.js
```
Then in another terminal, with a test `promonube_banners/banner_<storeId>` doc that has `enabled: true` and only `imageUrl` set (no `imageMobileUrl`):
```bash
curl -s "http://localhost:8080/api/banner-widget.js?store=<storeId>" | grep -o 'pn-banner-[a-z]*-img'
```
Expected: only `pn-banner-desktop-img` appears, never `pn-banner-mobile-img`.

Repeat with only `imageMobileUrl` set (no `imageUrl`): expect only `pn-banner-mobile-img`, and confirm the widget doesn't short-circuit with "nothing enabled" (this is what Step 1's fix addresses — before it, a mobile-only banner wouldn't activate at all).

Repeat with both set: expect both `pn-banner-desktop-img` and `pn-banner-mobile-img` present, plus the two `@media` rules in the output.

If a live server isn't available in your environment, do the next best thing: re-read the edited code carefully against the three scenarios above and confirm the conditionals (`if (b.imageUrl)`, `if (b.imageMobileUrl)`, `bannerEnabled`) produce the right HTML for each, and note in your report that live verification wasn't possible and why.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: render desktop/mobile banner images independently, no cross-fallback"
```

---

## Final check

- [ ] `node -c functions/index.js` — syntax OK.
- [ ] `npm run build` from the repo root — no new errors (pre-existing warnings like the CSS `@import` order notice are expected and unrelated).
- [ ] Manual pass in the browser per Task 1 Step 5, plus — if a live backend is reachable — Task 2 Step 4's three curl scenarios.
