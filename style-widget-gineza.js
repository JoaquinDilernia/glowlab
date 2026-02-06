// PromoNube Style Widget - Version actualizada con fix de banners
// Store: 1201022 (Gineza)

(function() {
  'use strict';

  // Detectar store ID
  function getStoreId() {
    const metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) return metaStoreId.content;
    if (window.LS && window.LS.store && window.LS.store.id) return window.LS.store.id.toString();
    const bodyStore = document.body.getAttribute('data-store');
    if (bodyStore) return bodyStore;
    return '1201022';
  }

  const storeId = getStoreId();

  // Cargar script dinámico desde el servidor
  const script = document.createElement('script');
  script.src = `https://apipromonube-jlfopowzaq-uc.a.run.app/api/style-widget.js?store=${storeId}&v=${Date.now()}`;
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube: Error loading widget');
  };
  document.head.appendChild(script);
})();
