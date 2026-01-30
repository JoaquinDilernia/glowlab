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
  
  // Cargar el script dinámico (el backend verificará si hay wheel activa)
  const script = document.createElement('script');
  script.src = `https://us-central1-pedidos-lett-2.cloudfunctions.net/apipromonube/api/spin-wheel-widget.js?store=${storeId}`;
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube Spin Wheel: Error loading widget');
    window.promonubeSpinWheelLoading = false;
  };
  document.head.appendChild(script);
  
  console.log('PromoNube Spin Wheel: Script injected');
})();
