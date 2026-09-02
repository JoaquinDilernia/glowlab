// PromoNube Precios y Cuotas - Bootstrap script para subir al panel de TiendaNube Partners.
// Detecta el storeId automáticamente y carga el widget dinámico (multi-tenant).

(function() {
  'use strict';

  function getStoreId() {
    var metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) {
      return metaStoreId.content;
    }
    if (window.LS && window.LS.store && window.LS.store.id) {
      return String(window.LS.store.id);
    }
    var bodyStore = document.body && document.body.getAttribute('data-store');
    if (bodyStore) {
      return bodyStore;
    }
    console.warn('PromoNube PriceFinancing: no se pudo detectar el storeId');
    return null;
  }

  if (window.__promonubePriceFinancingBootstrap) {
    return;
  }
  window.__promonubePriceFinancingBootstrap = true;

  var storeId = getStoreId();
  if (!storeId) {
    return;
  }

  var script = document.createElement('script');
  script.src = 'https://glowlab-production.up.railway.app/api/price-financing-widget.js?store=' + encodeURIComponent(storeId);
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube PriceFinancing: error cargando el widget');
    window.__promonubePriceFinancingBootstrap = false;
  };
  document.head.appendChild(script);
})();
