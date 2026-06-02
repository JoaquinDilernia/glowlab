// PromoNube Banner Home Widget - Production Version
// Bootstrap script para subir al panel de TiendaNube Partner.
// Detecta el storeId automáticamente y carga el widget dinámico.

(function() {
  'use strict';

  function getStoreId() {
    var metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) return metaStoreId.content;
    if (window.LS && window.LS.store && window.LS.store.id) return String(window.LS.store.id);
    var bodyStore = document.body && document.body.getAttribute('data-store');
    if (bodyStore) return bodyStore;
    console.warn('PromoNube Banner: No se pudo detectar el storeId');
    return null;
  }

  if (window.__promonubeBannerBootstrap) return;
  window.__promonubeBannerBootstrap = true;

  var storeId = getStoreId();
  if (!storeId) return;

  var script = document.createElement('script');
  script.src = 'https://glowlab-production.up.railway.app/api/banner-widget.js?store=' + encodeURIComponent(storeId);
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube Banner: error cargando el widget');
    window.__promonubeBannerBootstrap = false;
  };
  document.head.appendChild(script);
})();
