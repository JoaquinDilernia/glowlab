// PromoNube Checkout Notice Widget - Production Version
(function () {
  'use strict';

  if (window.__promonubeCheckoutNoticeBootstrap) return;
  window.__promonubeCheckoutNoticeBootstrap = true;

  // Hardcodeado: este script solo se sube al checkout de Altorancho
  var STORE_ID = '2547699';
  var WIDGET_URL = 'https://glowlab-production.up.railway.app/api/checkout-notice-widget.js?store=' + STORE_ID;

  function loadWidget() {
    if (window.__promonubeCheckoutNoticeLoaded) return;
    window.__promonubeCheckoutNoticeLoaded = true;
    var bust = Math.floor(Date.now() / (5 * 60 * 1000));
    fetch(WIDGET_URL + '&t=' + bust, { credentials: 'omit' })
      .then(function(r) { return r.text(); })
      .then(function(code) { (0, eval)(code); })
      .catch(function() { window.__promonubeCheckoutNoticeBootstrap = false; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget);
  } else {
    loadWidget();
  }
})();
