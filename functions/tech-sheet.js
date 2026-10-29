"use strict";

// Ficha tecnica en la PDP: un desplegable "Dimensiones" arriba de la
// descripcion que muestra la ultima foto de la galeria (Alto Rancho carga ahi
// la ficha tecnica, una imagen cuadrada). Solo en productos cuyo SKU empieza
// con alguno de los prefijos. Viaja pegado al widget de Grupos de Variantes,
// asi no hace falta instalar otro script en la tienda.
const DEFAULT_SKU_PREFIXES = ["M", "I"];

function buildTechSheetLoader(store, { skuPrefixes = DEFAULT_SKU_PREFIXES } = {}) {
  return `
/* Ficha tecnica - tienda ${store} */
(function() {
  'use strict';
  if (window.__pnTechSheetLoaded) return;
  window.__pnTechSheetLoaded = true;

  var PREFIXES = ${JSON.stringify(skuPrefixes)};
  if (!window.LS || LS.template !== 'product') return;

  // Basta con que una variante tenga el prefijo: todas comparten el modelo.
  function matchesSku() {
    var variants = LS.variants || [];
    for (var i = 0; i < variants.length; i++) {
      var sku = String(variants[i].sku || '').toUpperCase();
      for (var j = 0; j < PREFIXES.length; j++) {
        if (sku.indexOf(PREFIXES[j]) === 0) return true;
      }
    }
    return false;
  }

  // Ultima foto cargada = la de mayor data-image-position. El slider puede
  // duplicar slides, por eso se busca el maximo y no el ultimo del DOM.
  function lastImageUrl() {
    var slides = document.querySelectorAll('.js-product-slide[data-image-position]');
    var best = null, bestPos = -1;
    for (var i = 0; i < slides.length; i++) {
      var pos = parseInt(slides[i].getAttribute('data-image-position'), 10);
      if (pos > bestPos) { bestPos = pos; best = slides[i]; }
    }
    if (!best || bestPos < 1) return '';
    var link = best.querySelector('a[href]');
    var img = best.querySelector('img');
    var url = (link && link.getAttribute('href')) ||
      (img && (img.getAttribute('data-srcset') || img.getAttribute('srcset') || img.getAttribute('src') || '').split(' ')[0]) || '';
    return url.indexOf('//') === 0 ? 'https:' + url : url;
  }

  function injectStyles() {
    if (document.getElementById('pn-ts-styles')) return;
    var font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap';
    document.head.appendChild(font);
    var s = document.createElement('style');
    s.id = 'pn-ts-styles';
    s.textContent = [
      '.pn-ts { font-family: "Poppins", sans-serif !important; color: #353434 !important; border-top: 1px solid #e7e2db !important; border-bottom: 1px solid #e7e2db !important; margin: 0 0 20px !important; }',
      '.pn-ts summary { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 14px 0 !important; font-size: 15px !important; font-weight: 500 !important; cursor: pointer !important; list-style: none !important; }',
      '.pn-ts summary::-webkit-details-marker { display: none !important; }',
      '.pn-ts summary::after { content: "" !important; width: 8px !important; height: 8px !important; border-right: 1.5px solid #353434 !important; border-bottom: 1.5px solid #353434 !important; transform: rotate(45deg) !important; margin: -4px 4px 0 0 !important; transition: transform 0.2s ease !important; }',
      '.pn-ts[open] summary::after { transform: rotate(-135deg) !important; margin-top: 4px !important; }',
      '.pn-ts img { display: block !important; width: 100% !important; max-width: 560px !important; height: auto !important; aspect-ratio: 1 / 1 !important; object-fit: contain !important; margin: 0 0 16px !important; }',
    ].join('');
    document.head.appendChild(s);
  }

  function mount() {
    if (!matchesSku() || document.querySelector('.pn-ts')) return;
    var block = document.querySelector('#ns-block-description, .product-info-description');
    var url = lastImageUrl();
    if (!block || !url) return;
    injectStyles();
    var details = document.createElement('details');
    details.className = 'pn-ts';
    var summary = document.createElement('summary');
    summary.textContent = 'Dimensiones';
    var img = document.createElement('img');
    img.alt = 'Dimensiones de ' + String((LS.product && LS.product.name) || 'el producto');
    img.loading = 'lazy';
    img.src = url;
    details.appendChild(summary);
    details.appendChild(img);
    block.parentNode.insertBefore(details, block);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
`;
}

module.exports = { buildTechSheetLoader, DEFAULT_SKU_PREFIXES };
