// GlowLab · Envíos agrupados (Alto Rancho) — bootstrap del carrito lateral y del calculador del producto.
// Subir al Portal de socios → GlowLab (23137) → Scripts → Agregar script:
//   tipo store (NO NubeSDK) · evento onfirstinteraction · auto instalado.
// Carga /api/alto-envios-widget.js desde el backend (Railway). Ese widget es el alto-envios.js que hizo
// logística (reagrupa la lista de envíos del tema en tres desplegables). Si el módulo está apagado en el panel,
// el backend devuelve un script vacío.

(function () {
  'use strict';

  if (window.__glowlabAltoEnviosBootstrap) return;
  window.__glowlabAltoEnviosBootstrap = true;

  function getStoreId() {
    var meta = document.querySelector('meta[name="store-id"]');
    if (meta && meta.content) return meta.content;
    if (window.LS && window.LS.store && window.LS.store.id) return String(window.LS.store.id);
    var bodyStore = document.body && document.body.getAttribute('data-store');
    return bodyStore || null;
  }

  var storeId = getStoreId();
  // Exclusivo de Alto Rancho
  if (!storeId || ['2547699'].indexOf(String(storeId)) === -1) return;

  var s = document.createElement('script');
  s.src = 'https://glowlab-production.up.railway.app/api/alto-envios-widget.js?store=' + encodeURIComponent(storeId);
  s.async = true;
  s.onerror = function () { window.__glowlabAltoEnviosBootstrap = false; };
  document.head.appendChild(s);
})();
