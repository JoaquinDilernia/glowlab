// 🔍 PromoNube Enhanced Search - CDN Bootstrap
// Version: 6.0.0
// Actualización: Marzo 2026
// Cambios v6: 
//   - Llama a /api/enhanced-search-widget.js?store=ID (CONFIG inline, sin fetch separado)
//   - Dropdown fixed sobre document.body (escapa overflow:hidden del header)
//   - Tipografía, colores, animación, íconos 100% personalizables

(function() {
  'use strict';

  // Detectar storeId
  function getStoreId() {
    if (typeof window.LS !== 'undefined' && window.LS.store)
      return String(window.LS.store.id || window.LS.store.storeId || '');
    var m = document.querySelector('meta[name="store-id"],meta[property="store:id"]');
    if (m && m.content) return m.content;
    return '';
  }

  var storeId = getStoreId();
  if (!storeId) {
    console.warn('[PromoNube] Enhanced Search: no se pudo detectar storeId');
    return;
  }

  if (window.__pnSearchBootstrapped) return;
  window.__pnSearchBootstrapped = true;

  var s = document.createElement('script');
  s.src = 'https://apipromonube-jlfopowzaq-uc.a.run.app/api/enhanced-search-widget.js?store=' + storeId;
  s.async = true;
  document.head.appendChild(s);
  console.log('[PromoNube] Enhanced Search bootstrap → store', storeId);
})();
