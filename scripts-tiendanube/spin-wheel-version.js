// PromoNube Spin Wheel Widget - Production Version
// This file redirects to the actual script hosted on Cloud Functions
// Auto-detects store ID from URL

(function() {
  'use strict';
  
  // Detectar wheel ID desde localStorage o URL params
  function getWheelId() {
    // Por ahora, cargar el wheel activo desde la API
    // El widget dinámico se encargará de verificar si hay una ruleta activa
    return null; // El backend decidirá qué wheel mostrar
  }
  
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
    
    console.warn('PromoNube Spin Wheel: No se pudo detectar store ID');
    return null;
  }
  
  // Evitar carga doble
  if (window.promonubeSpinWheelLoading) {
    return;
  }
  window.promonubeSpinWheelLoading = true;
  
  const storeId = getStoreId();
  
  if (!storeId) {
    console.error('PromoNube Spin Wheel: Store ID no detectado. Script no se cargará.');
    return;
  }
  
  console.log('PromoNube Spin Wheel: Loading for store', storeId);
  
  fetch('https://glowlab-production.up.railway.app/api/spin-wheel-widget.js?store=' + encodeURIComponent(storeId), { credentials: 'omit' })
    .then(function(r) { return r.text(); })
    .then(function(code) { (0, eval)(code); })
    .catch(function() { window.promonubeSpinWheelLoading = false; });
})();
