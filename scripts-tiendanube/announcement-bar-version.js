// PromoNube Announcement Bar Widget - Production Version
(function() {
  'use strict';
  function getStoreId() {
    var m = document.querySelector('meta[name="store-id"]');
    if (m && m.content) return m.content;
    if (window.LS && window.LS.store && window.LS.store.id) return String(window.LS.store.id);
    var b = document.body && document.body.getAttribute('data-store');
    if (b) return b;
    return null;
  }
  if (window.__promonubeAnnouncementBootstrap) return;
  window.__promonubeAnnouncementBootstrap = true;
  var storeId = getStoreId();
  if (!storeId) return;
  var script = document.createElement('script');
  script.src = 'https://glowlab-production.up.railway.app/api/announcement-bar-widget.js?store=' + encodeURIComponent(storeId);
  script.async = true;
  script.onerror = function() { window.__promonubeAnnouncementBootstrap = false; };
  document.head.appendChild(script);
})();
