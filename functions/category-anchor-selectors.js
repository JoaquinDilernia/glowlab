"use strict";

// Selectores del contenedor de grilla de productos por theme, para insertar
// el Carrusel de Categorias justo antes. Arranca vacio (cualquier theme usa
// DEFAULT_ANCHOR_SELECTOR) -> el script del storefront usa el heuristico
// generico (ver category-carousel.js, PRODUCT_CARD_SELECTORS). Se completa
// a medida que se verifican themes reales contra tiendas de clientes, mismo
// patron que theme-menu-selectors.js.
const CATEGORY_ANCHOR_SELECTORS = {
  // theme_code: { gridSelector: '...verificado contra una tienda real...' },
};

// null = "no tengo selector determinístico para este theme todavía": el
// script del storefront usa el escaneo heurístico genérico.
const DEFAULT_ANCHOR_SELECTOR = {
  gridSelector: null,
};

function resolveCategoryAnchorSelectors(themeCode) {
  if (themeCode && Object.prototype.hasOwnProperty.call(CATEGORY_ANCHOR_SELECTORS, themeCode)) {
    return CATEGORY_ANCHOR_SELECTORS[themeCode];
  }
  return DEFAULT_ANCHOR_SELECTOR;
}

function getClientSelectorMap() {
  return Object.assign({}, CATEGORY_ANCHOR_SELECTORS, { __default__: DEFAULT_ANCHOR_SELECTOR });
}

module.exports = {
  CATEGORY_ANCHOR_SELECTORS,
  DEFAULT_ANCHOR_SELECTOR,
  resolveCategoryAnchorSelectors,
  getClientSelectorMap,
};
