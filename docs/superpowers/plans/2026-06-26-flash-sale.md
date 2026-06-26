# Flash Sale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un módulo Flash Sale a PromoNube que resalta productos de una categoría con marco visual y countdown en cualquier listado, banner en ficha de producto, y sección inyectable — todo configurable desde el panel.

**Architecture:** La config se guarda en `promonube_style_config/{storeId}.flashSale` (mismo doc que ShopTheLook). El widget corre dentro de `style-widget.js` como `customizeFlashSale()`. El frontend es una página independiente en `/flash-sale`. No se requiere nueva instalación de scripts en TiendaNube.

**Tech Stack:** Node.js/Express (functions/index.js), React 18 + lucide-react (frontend), Firestore (storage), TiendaNube REST API v1.

## Global Constraints

- Reutilizar `src/pages/StyleConfig.css` para el frontend (no crear CSS nuevo)
- El endpoint de categorías `/api/tiendanube/categories` ya existe — NO duplicar
- El endpoint de guardar `/api/style-config` (POST) ya existe — NO duplicar
- Ícono Flash Sale: `Zap` de lucide-react
- Posición en sidebar: entre "Shop the Look" y "Banner Home"
- Cache del style-widget: `max-age=60, s-maxage=60` (ya configurado)
- Máximo 50 productos en `productIds`, máximo 10 en `featuredProducts`
- Widget NO corre en páginas de checkout (detectar `/checkout` en URL)
- Fuente Poppins: cargar desde Google Fonts solo si `sectionEnabled` y no está ya cargada

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `functions/index.js` | Modificar | Agregar endpoint `/api/tiendanube/category-products` + función `customizeFlashSale()` en el script de style-widget |
| `src/pages/FlashSaleConfig.jsx` | Crear | Página de configuración del módulo Flash Sale |
| `src/App.jsx` | Modificar | Agregar route `/flash-sale` |
| `src/components/Sidebar.jsx` | Modificar | Agregar entrada "Flash Sale" con ícono Zap |

---

## Task 1: Backend — Endpoint `/api/tiendanube/category-products`

**Files:**
- Modify: `functions/index.js` — agregar después del endpoint `/api/tiendanube/categories` (línea ~10285)

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces: `GET /api/tiendanube/category-products?storeId=X&categoryId=Y` → `{ productIds: number[], featuredProducts: ProductData[] }`

donde `ProductData = { id: number, name: string, imageUrl: string, url: string, price: string, comparePrice: string | null }`

- [ ] **Step 1: Agregar el endpoint en `functions/index.js` inmediatamente después del cierre del handler de `/api/tiendanube/categories` (buscar el comentario `// STYLE CUSTOMIZATION ENDPOINTS` ~línea 10287)**

```js
// GET /api/tiendanube/category-products - Obtener productos de una categoría para Flash Sale
app.get("/api/tiendanube/category-products", async (req, res) => {
  const { storeId, categoryId } = req.query;

  if (!storeId || !categoryId) {
    return res.status(400).json({ error: "storeId y categoryId requeridos" });
  }

  try {
    const storeDoc = await db.collection("promonube_stores").doc(storeId).get();
    if (!storeDoc.exists) {
      return res.status(404).json({ error: "Tienda no encontrada" });
    }
    const accessToken = storeDoc.data().accessToken;
    if (!accessToken) {
      return res.status(401).json({ error: "No hay token de acceso" });
    }

    const response = await fetch(
      `https://api.tiendanube.com/v1/${storeId}/products?category_id=${categoryId}&per_page=50&fields=id,name,canonical_url,images,variants`,
      {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "PromoNube App (contacto@promonube.com)"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error TiendaNube products:", response.status, errorText);
      return res.status(response.status).json({ error: "Error obteniendo productos" });
    }

    const products = await response.json();

    const productIds = products.map(p => p.id);

    const featuredProducts = products.slice(0, 10).map(p => {
      const variant = p.variants && p.variants[0];
      const rawPrice = variant ? parseFloat(variant.price) : 0;
      const rawCompare = variant ? parseFloat(variant.compare_at_price) : null;
      const fmt = (n) => n ? '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : null;
      return {
        id: p.id,
        name: p.name && (p.name.es || p.name.pt || Object.values(p.name)[0] || ''),
        imageUrl: p.images && p.images[0] ? p.images[0].src : '',
        url: p.canonical_url || '',
        price: fmt(rawPrice),
        comparePrice: rawCompare && rawCompare > rawPrice ? fmt(rawCompare) : null,
      };
    });

    res.json({ productIds, featuredProducts });

  } catch (error) {
    console.error("Error obteniendo productos de categoría:", error);
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 2: Verificar que el servidor local compila sin errores**

```bash
cd functions && node -e "require('./index.js')" 2>&1 | head -20
```

Resultado esperado: sin errores de sintaxis (puede haber warnings de Firebase init, eso es normal).

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: add /api/tiendanube/category-products endpoint for Flash Sale"
```

---

## Task 2: Backend — `customizeFlashSale()` en style-widget.js

**Files:**
- Modify: `functions/index.js` — dentro de la función `app.get("/api/style-widget.js", ...)`, al final del string `script` antes del cierre de la IIFE `})();`

**Interfaces:**
- Consumes: `CONFIG.flashSale` del config embebido (del Task 3 en adelante lo usará)
- Produces: función `customizeFlashSale()` disponible en el widget con los efectos visuales

- [ ] **Step 1: Localizar el punto de inserción en `functions/index.js`**

Buscar la línea que contiene:
```js
setTimeout(customizeShopTheLook, 700);
```
Hay dos instancias (una dentro del bloque `if (document.readyState === 'loading')` y otra en el `else`). En ambas, agregar la línea siguiente:
```js
setTimeout(customizeFlashSale, 750);
```

- [ ] **Step 2: Agregar la función `customizeFlashSale()` en el template del script**

Buscar la función `customizeShopTheLook` en el template (al finalizar, antes de la sección `// ==================== ORDER PAGE NOTICE ====================`). Agregar después de ella:

```js
  // ==================== FLASH SALE ====================
  function customizeFlashSale() {
    var fs = CONFIG.flashSale;
    if (!fs || !fs.enabled) return;
    if (window.location.pathname.indexOf('/checkout') !== -1) return;

    var now = new Date();
    var endDate = fs.endDate ? new Date(fs.endDate) : null;
    var startDate = fs.startDate ? new Date(fs.startDate) : null;
    if (endDate && now > endDate) return;
    if (startDate && now < startDate) return;
    if (document.getElementById('pn-fs-styles')) return;

    // --- Cargar Poppins si sección habilitada ---
    if (fs.sectionEnabled && !document.querySelector('link[href*="Poppins"]')) {
      var fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(fontLink);
    }

    // --- CSS ---
    var borderColor = fs.frameBorderColor || '#ff3c00';
    var borderWidth = (fs.frameBorderWidth || 2) + 'px';
    var borderRadius = (fs.frameBorderRadius || 12) + 'px';
    var glowCss = fs.frameGlowEnabled !== false
      ? 'box-shadow: 0 0 0 ' + borderWidth + ' ' + borderColor + ', 0 4px 20px ' + borderColor + '44 !important;'
      : '';
    var badgePos = fs.badgePosition === 'top-right' ? 'right: 8px; left: auto;' : 'left: 8px;';
    var fontFamily = fs.sectionFontFamily || "'Poppins', sans-serif";
    var cols = fs.sectionColumns || 4;

    var css = ''
      + '.pn-fs-frame { outline: ' + borderWidth + ' solid ' + borderColor + ' !important; outline-offset: -1px; border-radius: ' + borderRadius + ' !important; position: relative !important; overflow: visible !important; transition: outline 0.2s; ' + glowCss + ' }'
      + '.pn-fs-badge { position: absolute; ' + badgePos + ' top: 8px; background: ' + (fs.badgeBg || '#ff3c00') + '; color: ' + (fs.badgeTextColor || '#fff') + '; font-size: ' + (fs.badgeFontSize || 11) + 'px; font-weight: 700; padding: 3px 8px; border-radius: ' + (fs.badgeBorderRadius || 6) + 'px; z-index: 10; pointer-events: none; white-space: nowrap; font-family: ' + fontFamily + '; }'
      + '.pn-fs-card-cd { display: block; font-size: ' + (fs.cardCountdownFontSize || 11) + 'px; font-weight: 700; color: ' + (fs.cardCountdownColor || '#ff3c00') + '; text-align: center; padding: 3px 0 4px; font-family: ' + fontFamily + '; letter-spacing: 0.5px; }'
      // Category banner
      + '#pn-fs-cat-banner { background: ' + (fs.categoryBannerBg || '#ff3c00') + '; color: ' + (fs.categoryBannerTextColor || '#fff') + '; padding: 18px 20px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-family: ' + fontFamily + '; }'
      + '#pn-fs-cat-banner .pn-fs-banner-left h2 { margin: 0 0 4px; font-size: 22px; font-weight: 800; }'
      + '#pn-fs-cat-banner .pn-fs-banner-left p { margin: 0; font-size: 14px; opacity: 0.88; }'
      + '#pn-fs-cat-banner .pn-fs-banner-right { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }'
      + '#pn-fs-cat-banner .pn-fs-big-cd { font-size: 28px; font-weight: 800; letter-spacing: 1px; }'
      + '#pn-fs-cat-banner .pn-fs-cd-label { font-size: 11px; opacity: 0.8; margin-bottom: 2px; }'
      + '#pn-fs-cat-banner .pn-fs-btn { background: rgba(255,255,255,0.2); color: inherit; border: 2px solid rgba(255,255,255,0.5); padding: 8px 18px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; transition: background 0.2s; white-space: nowrap; }'
      + '#pn-fs-cat-banner .pn-fs-btn:hover { background: rgba(255,255,255,0.35); }'
      // Detail banner
      + '#pn-fs-detail-banner { background: ' + (fs.detailBannerBg || '#fff3f0') + '; border: 1.5px solid ' + (fs.detailBannerBorderColor || '#ff3c00') + '; border-radius: 10px; padding: 10px 16px; margin: 12px 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-family: ' + fontFamily + '; }'
      + '#pn-fs-detail-banner .pn-fs-detail-title { font-size: 14px; font-weight: 700; color: ' + (fs.detailBannerTextColor || '#cc2200') + '; }'
      + '#pn-fs-detail-banner .pn-fs-detail-cd { font-size: 14px; font-weight: 700; color: ' + (fs.detailBannerTextColor || '#cc2200') + '; letter-spacing: 0.5px; }'
      + '#pn-fs-detail-banner a { color: ' + (fs.detailBannerTextColor || '#cc2200') + '; font-size: 12px; text-decoration: underline; margin-left: auto; }'
      // Injected section
      + '#pn-fs-section { background: ' + (fs.sectionBg || '#fff') + '; padding: 48px 16px; font-family: ' + fontFamily + '; }'
      + '#pn-fs-section .pn-fs-sec-inner { max-width: 1200px; margin: 0 auto; }'
      + '#pn-fs-section .pn-fs-sec-head { text-align: center; margin-bottom: 32px; }'
      + '#pn-fs-section .pn-fs-sec-title { font-size: 30px; font-weight: 800; color: ' + (fs.sectionTextColor || '#111') + '; margin: 0 0 6px; }'
      + '#pn-fs-section .pn-fs-sec-sub { font-size: 15px; color: ' + (fs.sectionTextColor || '#111') + '; opacity: 0.7; margin: 0 0 12px; }'
      + '#pn-fs-section .pn-fs-sec-cd { font-size: 18px; font-weight: 700; color: ' + borderColor + '; letter-spacing: 1px; }'
      + '#pn-fs-section .pn-fs-sec-cd-label { font-size: 12px; color: ' + (fs.sectionTextColor || '#111') + '; opacity: 0.65; margin-bottom: 4px; }'
      + '#pn-fs-section .pn-fs-grid { display: grid; grid-template-columns: repeat(' + cols + ', 1fr); gap: 20px; }'
      + '#pn-fs-section .pn-fs-card { background: ' + (fs.sectionCardBg || '#fff') + '; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; }'
      + '#pn-fs-section .pn-fs-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.13); }'
      + '#pn-fs-section .pn-fs-card a { text-decoration: none; color: inherit; }'
      + '#pn-fs-section .pn-fs-card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #f5f5f5; }'
      + '#pn-fs-section .pn-fs-card-info { padding: 12px 14px 16px; }'
      + '#pn-fs-section .pn-fs-card-name { font-size: 14px; font-weight: 600; color: ' + (fs.sectionTextColor || '#111') + '; margin: 0 0 6px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }'
      + '#pn-fs-section .pn-fs-card-prices { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }'
      + '#pn-fs-section .pn-fs-price { font-size: 16px; font-weight: 700; color: ' + (fs.sectionTextColor || '#111') + '; }'
      + '#pn-fs-section .pn-fs-compare { font-size: 13px; color: #999; text-decoration: line-through; }'
      + '#pn-fs-section .pn-fs-sec-btn-wrap { text-align: center; margin-top: 32px; }'
      + '#pn-fs-section .pn-fs-sec-btn { display: inline-block; background: ' + borderColor + '; color: #fff; padding: 13px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; transition: opacity 0.2s; }'
      + '#pn-fs-section .pn-fs-sec-btn:hover { opacity: 0.85; color: #fff; }'
      + '@media (max-width: 900px) { #pn-fs-section .pn-fs-grid { grid-template-columns: repeat(2, 1fr); } }'
      + '@media (max-width: 500px) { #pn-fs-section .pn-fs-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } #pn-fs-cat-banner .pn-fs-big-cd { font-size: 22px; } }';

    var styleEl = document.createElement('style');
    styleEl.id = 'pn-fs-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // --- Utilidades ---
    function escHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }

    function formatCountdown(ms) {
      if (ms <= 0) return '00:00:00';
      var totalSec = Math.floor(ms / 1000);
      var h = Math.floor(totalSec / 3600);
      var m = Math.floor((totalSec % 3600) / 60);
      var s = totalSec % 60;
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function getRemaining() {
      return endDate ? Math.max(0, endDate - new Date()) : 0;
    }

    // --- Contexto 1 y 2: aplicar marco/badge/countdown a cards ---
    var productIdSet = new Set((fs.productIds || []).map(Number));
    var isOnCategoryPage = window.LS && window.LS.category && String(window.LS.category.id) === String(fs.categoryId);

    function applyFrameToCard(card) {
      if (card.dataset.pnFsDone) return;
      card.dataset.pnFsDone = '1';
      card.classList.add('pn-fs-frame');
      if (card.style.position === '' || card.style.position === 'static') card.style.position = 'relative';

      var badge = document.createElement('span');
      badge.className = 'pn-fs-badge';
      badge.textContent = fs.badgeText || '🔥 FLASH';
      card.appendChild(badge);

      if (fs.cardCountdownEnabled !== false) {
        var cdEl = document.createElement('span');
        cdEl.className = 'pn-fs-card-cd';
        cdEl.textContent = formatCountdown(getRemaining());
        card.appendChild(cdEl);
      }
    }

    function applyFramesToPage() {
      var cards = document.querySelectorAll('[data-item-id]');
      cards.forEach(function(card) {
        if (isOnCategoryPage) {
          applyFrameToCard(card);
        } else {
          var itemId = Number(card.getAttribute('data-item-id'));
          if (productIdSet.has(itemId)) applyFrameToCard(card);
        }
      });
    }

    applyFramesToPage();

    // Observar nuevos nodos (lazy load / infinite scroll)
    var observer = new MutationObserver(function() { applyFramesToPage(); });
    observer.observe(document.body, { childList: true, subtree: true });

    // --- Contexto 2: Banner de categoría ---
    if (isOnCategoryPage && fs.categoryBannerEnabled !== false) {
      var catTarget = document.querySelector('.js-product-list, .products-list, [data-product-list], main ul, .product-list')
        || document.querySelector('main') || document.body;
      if (!document.getElementById('pn-fs-cat-banner') && catTarget) {
        var banner = document.createElement('div');
        banner.id = 'pn-fs-cat-banner';
        var cdLabel = escHtml(fs.countdownLabel || 'Termina en:');
        var btnText = escHtml(fs.buttonText || 'Ver todos');
        var catUrl = fs.categoryUrl || '#';
        banner.innerHTML = '<div class="pn-fs-banner-left">'
          + '<h2>' + escHtml(fs.title || '🔥 Flash Sale') + '</h2>'
          + (fs.subtitle ? '<p>' + escHtml(fs.subtitle) + '</p>' : '')
          + '</div>'
          + '<div class="pn-fs-banner-right">'
          + '<div><div class="pn-fs-cd-label">' + cdLabel + '</div><div class="pn-fs-big-cd" id="pn-fs-big-cd">' + formatCountdown(getRemaining()) + '</div></div>'
          + '<a class="pn-fs-btn" href="' + catUrl + '">' + btnText + '</a>'
          + '</div>';
        catTarget.parentNode.insertBefore(banner, catTarget);
      }
    }

    // --- Contexto 3: Banner de producto ---
    var isProductPage = window.LS && window.LS.product;
    if (isProductPage && fs.detailBannerEnabled !== false) {
      var cats = window.LS.product.categories || [];
      var inSale = cats.some(function(c) { return String(c.id) === String(fs.categoryId); });
      if (!inSale && fs.categoryName) {
        inSale = cats.some(function(c) { return c.name && String(c.name).toLowerCase() === String(fs.categoryName).toLowerCase(); });
      }
      if (inSale && !document.getElementById('pn-fs-detail-banner')) {
        var detailTarget = document.querySelector('.product-title, h1.product-name, .js-product-title, h1')
          || document.querySelector('.buy-block, .product-info, main');
        if (detailTarget) {
          var db2 = document.createElement('div');
          db2.id = 'pn-fs-detail-banner';
          db2.innerHTML = '<span class="pn-fs-detail-title">' + escHtml(fs.title || '🔥 Flash Sale') + '</span>'
            + '<span> &mdash; ' + escHtml(fs.countdownLabel || 'Termina en:') + ' </span>'
            + '<span class="pn-fs-detail-cd" id="pn-fs-detail-cd">' + formatCountdown(getRemaining()) + '</span>'
            + (fs.categoryUrl ? '<a href="' + fs.categoryUrl + '">' + escHtml(fs.buttonText || 'Ver todos') + '</a>' : '');
          detailTarget.parentNode.insertBefore(db2, detailTarget.nextSibling);
        }
      }
    }

    // --- Contexto 4: Sección inyectada ---
    var featured = Array.isArray(fs.featuredProducts) ? fs.featuredProducts.slice(0, fs.sectionMaxProducts || 8) : [];
    if (fs.sectionEnabled !== false && featured.length > 0 && !document.getElementById('pn-fs-section')) {
      var sec = document.createElement('section');
      sec.id = 'pn-fs-section';
      var cardsHtml = featured.map(function(p) {
        return '<div class="pn-fs-card">'
          + '<a href="' + escHtml(p.url || '#') + '">'
          + (p.imageUrl ? '<img src="' + escHtml(p.imageUrl) + '" alt="' + escHtml(p.name) + '" loading="lazy" />' : '')
          + '<div class="pn-fs-card-info">'
          + '<div class="pn-fs-card-name">' + escHtml(p.name) + '</div>'
          + '<div class="pn-fs-card-prices">'
          + (p.price ? '<span class="pn-fs-price">' + escHtml(p.price) + '</span>' : '')
          + (p.comparePrice ? '<span class="pn-fs-compare">' + escHtml(p.comparePrice) + '</span>' : '')
          + '</div></div></a></div>';
      }).join('');
      var catUrl2 = fs.categoryUrl || '#';
      var btnText2 = escHtml(fs.buttonText || 'Ver todos');
      sec.innerHTML = '<div class="pn-fs-sec-inner">'
        + '<div class="pn-fs-sec-head">'
        + '<h2 class="pn-fs-sec-title">' + escHtml(fs.title || '🔥 Flash Sale') + '</h2>'
        + (fs.subtitle ? '<p class="pn-fs-sec-sub">' + escHtml(fs.subtitle) + '</p>' : '')
        + '<div class="pn-fs-sec-cd-label">' + escHtml(fs.countdownLabel || 'Termina en:') + '</div>'
        + '<div class="pn-fs-sec-cd" id="pn-fs-sec-cd">' + formatCountdown(getRemaining()) + '</div>'
        + '</div>'
        + '<div class="pn-fs-grid">' + cardsHtml + '</div>'
        + '<div class="pn-fs-sec-btn-wrap"><a class="pn-fs-sec-btn" href="' + catUrl2 + '">' + btnText2 + '</a></div>'
        + '</div>';

      var injected = false;
      if (fs.sectionInjectSelector) {
        try {
          var injTarget = document.querySelector(fs.sectionInjectSelector);
          if (injTarget) {
            var injPos = fs.sectionInjectPosition || 'after';
            if (injPos === 'before') injTarget.parentNode.insertBefore(sec, injTarget);
            else if (injPos === 'prepend') injTarget.insertBefore(sec, injTarget.firstChild);
            else if (injPos === 'append') injTarget.appendChild(sec);
            else injTarget.parentNode.insertBefore(sec, injTarget.nextSibling);
            injected = true;
          }
        } catch (e) { console.warn('PromoNube FlashSale: selector inválido', e); }
      }
      if (!injected) {
        var footer = document.querySelector('footer, .footer, #footer, [class*="footer"]');
        if (footer && footer.parentNode) footer.parentNode.insertBefore(sec, footer);
        else document.body.appendChild(sec);
      }
    }

    // --- Tick global de countdown ---
    if (endDate) {
      setInterval(function() {
        var rem = formatCountdown(getRemaining());
        document.querySelectorAll('.pn-fs-card-cd').forEach(function(el) { el.textContent = rem; });
        var bigCd = document.getElementById('pn-fs-big-cd');
        if (bigCd) bigCd.textContent = rem;
        var detailCd = document.getElementById('pn-fs-detail-cd');
        if (detailCd) detailCd.textContent = rem;
        var secCd = document.getElementById('pn-fs-sec-cd');
        if (secCd) secCd.textContent = rem;
      }, 1000);
    }

    console.log('PromoNube Flash Sale: activo hasta', fs.endDate);
  }
```

- [ ] **Step 3: Agregar `setTimeout(customizeFlashSale, 750)` en los dos bloques de ejecución**

Buscar las dos ocurrencias de `setTimeout(customizeShopTheLook, 700);` (hay una en el bloque `if (document.readyState === 'loading')` y otra en el `else`) y agregar la línea siguiente en cada una:

```js
setTimeout(customizeFlashSale, 750);
```

- [ ] **Step 4: Verificar que no haya errores de sintaxis**

```bash
cd functions && node -e "require('./index.js')" 2>&1 | head -20
```

Resultado esperado: sin errores de sintaxis.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat: add customizeFlashSale() to style-widget — frame, badge, countdown, banners, injected section"
```

---

## Task 3: Frontend — `FlashSaleConfig.jsx`

**Files:**
- Create: `src/pages/FlashSaleConfig.jsx`

**Interfaces:**
- Consumes: `GET /api/style-config?storeId=X` (lee `config.flashSale`)
- Consumes: `GET /api/tiendanube/categories?storeId=X` (lista de categorías)
- Consumes: `GET /api/tiendanube/category-products?storeId=X&categoryId=Y` (Task 1)
- Consumes: `POST /api/style-config` (guarda `flashSale` mergeado)
- Produces: página React en `/flash-sale`

- [ ] **Step 1: Crear `src/pages/FlashSaleConfig.jsx` con el siguiente contenido completo**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';

const DEFAULT_CONFIG = {
  enabled: false,
  categoryId: '',
  categoryName: '',
  categoryUrl: '',
  productIds: [],
  featuredProducts: [],
  startDate: '',
  endDate: '',
  title: '🔥 Flash Sale',
  subtitle: 'Descuentos por tiempo limitado',
  countdownLabel: 'Termina en:',
  buttonText: 'Ver todos',
  badgeText: '🔥 FLASH',
  badgeBg: '#ff3c00',
  badgeTextColor: '#ffffff',
  badgeFontSize: 11,
  badgePosition: 'top-left',
  badgeBorderRadius: 6,
  frameBorderColor: '#ff3c00',
  frameBorderWidth: 2,
  frameBorderRadius: 12,
  frameGlowEnabled: true,
  cardCountdownEnabled: true,
  cardCountdownColor: '#ff3c00',
  cardCountdownFontSize: 11,
  categoryBannerEnabled: true,
  categoryBannerBg: '#ff3c00',
  categoryBannerTextColor: '#ffffff',
  detailBannerEnabled: true,
  detailBannerBg: '#fff3f0',
  detailBannerBorderColor: '#ff3c00',
  detailBannerTextColor: '#cc2200',
  sectionEnabled: true,
  sectionInjectSelector: '',
  sectionInjectPosition: 'after',
  sectionBg: '#ffffff',
  sectionTextColor: '#111111',
  sectionCardBg: '#ffffff',
  sectionFontFamily: "'Poppins', sans-serif",
  sectionColumns: 4,
  sectionMaxProducts: 8,
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="style-section" style={{ marginBottom: 16 }}>
      <button
        className="style-section-toggle"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', fontWeight: 600, fontSize: 14, color: '#111', borderRadius: open ? '12px 12px 0 0' : 12, background: '#f9fafb', borderBottom: open ? '1px solid #e5e7eb' : 'none' }}
      >
        {title}
        <span style={{ fontSize: 12, color: '#6b7280' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>{children}</div>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
const colorRowStyle = { display: 'flex', alignItems: 'center', gap: 8 };

export default function FlashSaleConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const set = (patch) => setConfig(prev => ({ ...prev, ...patch }));

  // Cargar config guardada
  useEffect(() => {
    if (!storeId) return;
    apiRequest(`/api/style-config?storeId=${storeId}`)
      .then(data => {
        if (data.success && data.config?.flashSale) {
          setConfig({ ...DEFAULT_CONFIG, ...data.config.flashSale });
          if (data.config.updatedAt) setLastSaved(new Date(data.config.updatedAt));
        }
      })
      .catch(() => {});
  }, [storeId]);

  // Cargar categorías
  useEffect(() => {
    if (!storeId) return;
    setLoadingCats(true);
    apiRequest(`/api/tiendanube/categories?storeId=${storeId}`)
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar categorías'))
      .finally(() => setLoadingCats(false));
  }, [storeId]);

  const handleCategoryChange = (e) => {
    const cat = categories.find(c => String(c.id) === e.target.value);
    if (!cat) { set({ categoryId: '', categoryName: '', categoryUrl: '' }); return; }
    const name = cat.name?.es || cat.name?.pt || (typeof cat.name === 'string' ? cat.name : '');
    const url = cat.handle ? '/' + cat.handle : (cat.permalink || '');
    set({ categoryId: String(cat.id), categoryName: name, categoryUrl: url });
  };

  const fetchProducts = async () => {
    if (!config.categoryId) { toast.error('Seleccioná una categoría primero'); return; }
    setLoadingProducts(true);
    try {
      const data = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${config.categoryId}`);
      set({ productIds: data.productIds || [], featuredProducts: data.featuredProducts || [] });
      toast.success(`${(data.productIds || []).length} productos cargados`);
    } catch (e) {
      toast.error('Error al cargar productos: ' + e.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) { toast.error('No se encontró el ID de la tienda'); return; }
    setLoading(true);
    try {
      // Si hay categoría seleccionada pero no hay productos, fetchearlos primero
      let finalConfig = { ...config };
      if (config.categoryId && config.productIds.length === 0) {
        const data = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${config.categoryId}`);
        finalConfig = { ...finalConfig, productIds: data.productIds || [], featuredProducts: data.featuredProducts || [] };
        setConfig(finalConfig);
      }

      const current = await apiRequest(`/api/style-config?storeId=${storeId}`);
      const fullConfig = (current.success && current.config) ? current.config : {};
      const data = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: { ...fullConfig, flashSale: finalConfig } }),
      });
      if (data.success) {
        toast.success('Flash Sale guardado. Los cambios se verán en tu tienda en ~1 minuto.');
        setLastSaved(new Date());
      } else {
        toast.error('Error al guardar: ' + (data.message || 'Error desconocido'));
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="style-config-page">
      <div className="style-config-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>⚡ Flash Sale</h1>
            {lastSaved && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Guardado {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={loading}>
          <Save size={15} />
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="style-config-content" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* 1. General */}
        <Section title="⚙️ General">
          <Field label="Activar Flash Sale">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.enabled} onChange={e => set({ enabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>{config.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </Field>
          <Field label="Categoría" hint={loadingCats ? 'Cargando categorías…' : ''}>
            <select style={inputStyle} value={config.categoryId} onChange={handleCategoryChange} disabled={loadingCats}>
              <option value="">— Seleccioná una categoría —</option>
              {categories.map(c => {
                const name = c.name?.es || c.name?.pt || (typeof c.name === 'string' ? c.name : String(c.id));
                return <option key={c.id} value={String(c.id)}>{name}</option>;
              })}
            </select>
          </Field>
          <Field label="Fecha y hora de inicio" hint="Dejá vacío para que empiece al activar">
            <input type="datetime-local" style={inputStyle} value={config.startDate} onChange={e => set({ startDate: e.target.value })} />
          </Field>
          <Field label="Fecha y hora de fin">
            <input type="datetime-local" style={inputStyle} value={config.endDate} onChange={e => set({ endDate: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button
              onClick={fetchProducts}
              disabled={loadingProducts || !config.categoryId}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <RefreshCw size={14} className={loadingProducts ? 'spin' : ''} />
              {loadingProducts ? 'Cargando…' : 'Actualizar productos'}
            </button>
            {config.productIds.length > 0 && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {config.productIds.length} productos en la categoría, mostrando {Math.min(config.sectionMaxProducts || 8, config.featuredProducts.length)} en la sección
              </span>
            )}
          </div>
        </Section>

        {/* 2. Textos */}
        <Section title="✍️ Textos">
          <Field label="Título"><input style={inputStyle} value={config.title} onChange={e => set({ title: e.target.value })} /></Field>
          <Field label="Subtítulo"><input style={inputStyle} value={config.subtitle} onChange={e => set({ subtitle: e.target.value })} /></Field>
          <Field label="Texto del badge"><input style={inputStyle} value={config.badgeText} onChange={e => set({ badgeText: e.target.value })} /></Field>
          <Field label="Label del countdown (ej: 'Termina en:')"><input style={inputStyle} value={config.countdownLabel} onChange={e => set({ countdownLabel: e.target.value })} /></Field>
          <Field label="Texto del botón"><input style={inputStyle} value={config.buttonText} onChange={e => set({ buttonText: e.target.value })} /></Field>
        </Section>

        {/* 3. Marco del producto */}
        <Section title="🔲 Marco del producto">
          <Field label="Color del borde">
            <div style={colorRowStyle}>
              <input type="color" value={config.frameBorderColor} onChange={e => set({ frameBorderColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.frameBorderColor} onChange={e => set({ frameBorderColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Ancho del borde: ${config.frameBorderWidth}px`}>
            <input type="range" min={1} max={6} value={config.frameBorderWidth} onChange={e => set({ frameBorderWidth: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Border radius: ${config.frameBorderRadius}px`}>
            <input type="range" min={0} max={24} value={config.frameBorderRadius} onChange={e => set({ frameBorderRadius: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Sombra de color (glow)">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.frameGlowEnabled} onChange={e => set({ frameGlowEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar glow</span>
            </label>
          </Field>
        </Section>

        {/* 4. Badge */}
        <Section title="🏷️ Badge">
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.badgeBg} onChange={e => set({ badgeBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.badgeBg} onChange={e => set({ badgeBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.badgeTextColor} onChange={e => set({ badgeTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.badgeTextColor} onChange={e => set({ badgeTextColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Tamaño de fuente: ${config.badgeFontSize}px`}>
            <input type="range" min={9} max={18} value={config.badgeFontSize} onChange={e => set({ badgeFontSize: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Border radius: ${config.badgeBorderRadius}px`}>
            <input type="range" min={0} max={20} value={config.badgeBorderRadius} onChange={e => set({ badgeBorderRadius: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Posición">
            <select style={inputStyle} value={config.badgePosition} onChange={e => set({ badgePosition: e.target.value })}>
              <option value="top-left">Arriba izquierda</option>
              <option value="top-right">Arriba derecha</option>
            </select>
          </Field>
        </Section>

        {/* 5. Countdown en card */}
        <Section title="⏱️ Countdown en card">
          <Field label="Mostrar countdown en cada card">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.cardCountdownEnabled} onChange={e => set({ cardCountdownEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color del texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.cardCountdownColor} onChange={e => set({ cardCountdownColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.cardCountdownColor} onChange={e => set({ cardCountdownColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Tamaño de fuente: ${config.cardCountdownFontSize}px`}>
            <input type="range" min={9} max={16} value={config.cardCountdownFontSize} onChange={e => set({ cardCountdownFontSize: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
        </Section>

        {/* 6. Banner de categoría */}
        <Section title="📢 Banner de categoría" defaultOpen={false}>
          <Field label="Mostrar banner encima del grid de productos">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.categoryBannerEnabled} onChange={e => set({ categoryBannerEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.categoryBannerBg} onChange={e => set({ categoryBannerBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.categoryBannerBg} onChange={e => set({ categoryBannerBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.categoryBannerTextColor} onChange={e => set({ categoryBannerTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.categoryBannerTextColor} onChange={e => set({ categoryBannerTextColor: e.target.value })} />
            </div>
          </Field>
        </Section>

        {/* 7. Banner de producto */}
        <Section title="🏷️ Banner en ficha de producto" defaultOpen={false}>
          <Field label="Mostrar banner en la página del producto">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.detailBannerEnabled} onChange={e => set({ detailBannerEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerBg} onChange={e => set({ detailBannerBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerBg} onChange={e => set({ detailBannerBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de borde">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerBorderColor} onChange={e => set({ detailBannerBorderColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerBorderColor} onChange={e => set({ detailBannerBorderColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerTextColor} onChange={e => set({ detailBannerTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerTextColor} onChange={e => set({ detailBannerTextColor: e.target.value })} />
            </div>
          </Field>
        </Section>

        {/* 8. Sección inyectada */}
        <Section title="🛍️ Sección de productos destacados" defaultOpen={false}>
          <Field label="Mostrar sección de productos">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.sectionEnabled} onChange={e => set({ sectionEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label={`Productos a mostrar: ${config.sectionMaxProducts}`}>
            <input type="range" min={4} max={10} value={config.sectionMaxProducts} onChange={e => set({ sectionMaxProducts: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Columnas en desktop: ${config.sectionColumns}`}>
            <input type="range" min={2} max={5} value={config.sectionColumns} onChange={e => set({ sectionColumns: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Color de fondo de la sección">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionBg} onChange={e => set({ sectionBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionBg} onChange={e => set({ sectionBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionTextColor} onChange={e => set({ sectionTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionTextColor} onChange={e => set({ sectionTextColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de fondo de los cards">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionCardBg} onChange={e => set({ sectionCardBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionCardBg} onChange={e => set({ sectionCardBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Selector CSS de inyección" hint="Opcional. Vacío = se inserta automáticamente antes del footer. Ej: .main-content, #home-section">
            <input style={inputStyle} value={config.sectionInjectSelector} onChange={e => set({ sectionInjectSelector: e.target.value })} placeholder=".mi-seccion" />
          </Field>
          <Field label="Posición de inyección">
            <select style={inputStyle} value={config.sectionInjectPosition} onChange={e => set({ sectionInjectPosition: e.target.value })}>
              <option value="after">Después (after)</option>
              <option value="before">Antes (before)</option>
              <option value="append">Al final dentro (append)</option>
              <option value="prepend">Al inicio dentro (prepend)</option>
            </select>
          </Field>
        </Section>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que el archivo se creó correctamente (sin errores de JSX obvios)**

```bash
node -e "const fs = require('fs'); const c = fs.readFileSync('src/pages/FlashSaleConfig.jsx', 'utf8'); console.log('Lines:', c.split('\n').length, '| Last chars:', c.slice(-30));"
```

Resultado esperado: muestra número de líneas > 200 y el final del archivo.

- [ ] **Step 3: Commit**

```bash
git add src/pages/FlashSaleConfig.jsx
git commit -m "feat: add FlashSaleConfig page with 8 config sections"
```

---

## Task 4: Wiring — App.jsx + Sidebar.jsx

**Files:**
- Modify: `src/App.jsx` — agregar import + Route
- Modify: `src/components/Sidebar.jsx` — agregar ícono Zap + entrada nav

**Interfaces:**
- Consumes: `FlashSaleConfig` de Task 3
- Produces: ruta `/flash-sale` navegable desde sidebar

- [ ] **Step 1: Agregar import y Route en `src/App.jsx`**

Después de la línea `import ShopTheLookConfig from './pages/ShopTheLookConfig';` (línea ~34), agregar:
```jsx
import FlashSaleConfig from './pages/FlashSaleConfig';
```

Después de la línea `<Route path="/shop-the-look" element={<ShopTheLookConfig />} />` (línea ~77), agregar:
```jsx
<Route path="/flash-sale" element={<FlashSaleConfig />} />
```

- [ ] **Step 2: Agregar entrada en `src/components/Sidebar.jsx`**

En la línea de imports de lucide-react (línea ~2), agregar `Zap` a la lista:
```jsx
import {
  LayoutDashboard, Palette, Clock, BadgeCheck, Tag,
  Sparkles, Gift, Bell, Settings, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Image, Megaphone, Zap
} from 'lucide-react';
```

En `BASE_NAV_ITEMS` (línea ~10), después de la entrada de Shop the Look:
```jsx
{ path: '/shop-the-look',  icon: ShoppingBag,   label: 'Shop the Look' },
{ path: '/flash-sale',     icon: Zap,           label: 'Flash Sale' },
{ path: '/banner',         icon: Image,         label: 'Banner Home' },
```

- [ ] **Step 3: Verificar que el build de React no tiene errores**

```bash
npm run build 2>&1 | tail -20
```

Resultado esperado: `✓ built in Xs` o similar sin errores. Warnings de ESLint son aceptables.

- [ ] **Step 4: Commit y push para deployar en Railway**

```bash
git add src/App.jsx src/components/Sidebar.jsx
git commit -m "feat: wire /flash-sale route and sidebar entry"
git push origin main
```

Resultado esperado: push exitoso. Railway deployará automáticamente en ~2 minutos.

---

## Self-Review

**Spec coverage:**
- ✅ Endpoint `/api/tiendanube/category-products` → Task 1
- ✅ `customizeFlashSale()` con 4 contextos → Task 2
- ✅ `/api/tiendanube/categories` existente reutilizado (no duplicado)
- ✅ Config en `promonube_style_config.flashSale` via POST existente → Task 3
- ✅ Página `/flash-sale` con 8 secciones → Task 3
- ✅ Sidebar Zap icon entre Shop the Look y Banner → Task 4
- ✅ Poppins cargada solo si sectionEnabled → Task 2
- ✅ Sin API calls en runtime del widget → Task 2 (datos embebidos en CONFIG)
- ✅ Skip en checkout → Task 2 (primer check de la función)
- ✅ MutationObserver para lazy load / infinite scroll → Task 2
- ✅ Un único setInterval global para todos los countdowns → Task 2
- ✅ Máx 50 productIds, máx 10 featuredProducts → Task 1

**Type consistency:**
- `productIds: number[]` → Task 1 produce `.map(p => p.id)` (Number), Task 2 consume con `new Set(...map(Number))` ✅
- `featuredProducts[].imageUrl` → Task 1 produce `p.images[0].src`, Task 2 usa `p.imageUrl` ✅
- `fs.categoryId` comparado con `String(window.LS.category.id)` → ambos con `String()` ✅
- `sectionMaxProducts` default 8 en DEFAULT_CONFIG → Task 2 usa `fs.sectionMaxProducts || 8` ✅
