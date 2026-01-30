// PromoNube Top Header - Production Version
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
    
    // Método 4: Extraer de URLs de API en el HTML
    const apiLinks = document.querySelectorAll('[href*="/v1/"]');
    for (const link of apiLinks) {
      const match = link.href.match(/\/v1\/(\d+)\//);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    console.warn('PromoNube Top Header: No se pudo detectar store ID');
    return null;
  }
  
  // Evitar carga doble
  if (window.promonubeTopHeaderLoading) {
    return;
  }
  window.promonubeTopHeaderLoading = true;
  
  const storeId = getStoreId();
  
  if (!storeId) {
    console.error('PromoNube Top Header: Store ID no detectado. Script no se cargará.');
    return;
  }
  
  console.log('PromoNube Top Header: Loading for store', storeId);
  
  // Cargar el script dinámico
  const script = document.createElement('script');
  script.src = `https://us-central1-pedidos-lett-2.cloudfunctions.net/apipromonube/api/top-header-widget.js?store=${storeId}`;
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube Top Header: Error loading widget');
    window.promonubeTopHeaderLoading = false;
  };
  document.head.appendChild(script);
  
  console.log('PromoNube Top Header: Script injected');
})();
