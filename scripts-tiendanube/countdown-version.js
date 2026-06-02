// PromoNube Countdown Widget - Production Version
// This file redirects to the actual script hosted on Cloud Functions
// Auto-detects store ID from URL

(function() {
  'use strict';
  
  // Detectar store ID desde meta tags de TiendaNube
  function getStoreId() {
    // Método 1: Desde meta tag store-id
    const metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) {
      return metaStoreId.content;
    }
    
    // Método 2: Desde window.LS (TiendaNube object)
    if (window.LS && window.LS.store && window.LS.store.id) {
      return window.LS.store.id.toString();
    }
    
    // Método 3: Desde data-store en body
    const bodyStore = document.body.getAttribute('data-store');
    if (bodyStore) {
      return bodyStore;
    }
    
    console.warn('PromoNube Countdown: No se pudo detectar store ID');
    return null;
  }
  
  // Evitar carga doble
  if (window.promonubeCountdownLoading) {
    return;
  }
  window.promonubeCountdownLoading = true;
  
  const storeId = getStoreId();
  
  if (!storeId) {
    console.error('PromoNube Countdown: Store ID no detectado. Script no se cargará.');
    return;
  }
  
  console.log('PromoNube Countdown: Loading for store', storeId);
  
  fetch('https://glowlab-production.up.railway.app/api/countdown-widget.js?store=' + encodeURIComponent(storeId), { credentials: 'omit' })
    .then(function(r) { return r.text(); })
    .then(function(code) { (0, eval)(code); })
    .catch(function() { window.promonubeCountdownLoading = false; });
})();
