// Bootstrap "Próximamente" — subir al panel de Tiendanube Partners
// (Aplicaciones → GlowLab #23137 → Scripts) como script de storefront.
// Detecta el storeId y carga el widget dinámico multi-tenant.
// Sin branding visible para el cliente final.

(function () {
  'use strict';

  function getStoreId() {
    var meta = document.querySelector('meta[name="store-id"]');
    if (meta && meta.content) return meta.content;
    if (window.LS && window.LS.store && window.LS.store.id) return String(window.LS.store.id);
    var body = document.body && document.body.getAttribute('data-store');
    if (body) return body;
    return null;
  }

  if (window.__csBootstrap) return;
  window.__csBootstrap = true;

  var storeId = getStoreId();
  if (!storeId) return;

  var s = document.createElement('script');
  s.src = 'https://glowlab-production.up.railway.app/api/coming-soon-widget.js?store=' + encodeURIComponent(storeId);
  s.async = true;
  s.onerror = function () { window.__csBootstrap = false; };
  document.head.appendChild(s);
})();
