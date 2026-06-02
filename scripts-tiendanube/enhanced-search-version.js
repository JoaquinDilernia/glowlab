// PromoNube Enhanced Search - CDN Bootstrap v6
(function() {
  'use strict';

  function getStoreId() {
    if (typeof window.LS !== 'undefined' && window.LS.store)
      return String(window.LS.store.id || window.LS.store.storeId || '');
    var m = document.querySelector('meta[name="store-id"],meta[property="store:id"]');
    if (m && m.content) return m.content;
    return '';
  }

  var storeId = getStoreId();
  if (!storeId) return;

  if (window.__pnSearchBootstrapped) return;
  window.__pnSearchBootstrapped = true;

  fetch('https://glowlab-production.up.railway.app/api/enhanced-search-widget.js?store=' + encodeURIComponent(storeId), { credentials: 'omit' })
    .then(function(r) { return r.text(); })
    .then(function(code) { (0, eval)(code); })
    .catch(function() { window.__pnSearchBootstrapped = false; });
})();
