// PromoNube Local Stock Widget - Production Version
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
    console.warn('PromoNube LocalStock: No se pudo detectar el storeId');
    return null;
  }

  if (window.__promonubeLocalStockBootstrap) return;
  window.__promonubeLocalStockBootstrap = true;

  var storeId = getStoreId();
  if (!storeId) return;

  var ALLOWED_STORES = ['2547699'];
  if (ALLOWED_STORES.indexOf(String(storeId)) === -1) return;

  var script = document.createElement('script');
  script.src = 'https://glowlab-production.up.railway.app/api/local-stock-widget.js?store=' + encodeURIComponent(storeId);
  script.async = true;
  script.onerror = function() { console.error('PromoNube LocalStock: error cargando el widget'); window.__promonubeLocalStockBootstrap = false; };
  document.head.appendChild(script);
})();
