"use strict";

// Selectores verificados manualmente contra tiendas reales (ver plan
// docs/superpowers/plans/2026-08-11-theme-aware-menu-widget.md).
// Agregar un theme nuevo acá NO requiere tocar customizeMenu() en index.js.
const THEME_MENU_SELECTORS = {
  rio: {
    mobileLinkSelector:
      "#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a",
    desktopContainerSelector: ".js-nav-desktop-list.nav-desktop-list",
  },
  new_linkedman: {
    mobileLinkSelector: "#nav-hamburger ul.list-items > li > a",
    desktopContainerSelector: ".js-desktop-nav-first-level",
  },
};

// null = "no tengo selector determinístico para este theme todavía":
// le dice al script en el browser que use el scan heurístico legacy.
const DEFAULT_MENU_SELECTORS = {
  mobileLinkSelector: null,
  desktopContainerSelector: null,
};

function resolveMenuSelectors(themeCode) {
  if (themeCode && Object.prototype.hasOwnProperty.call(THEME_MENU_SELECTORS, themeCode)) {
    return THEME_MENU_SELECTORS[themeCode];
  }
  return DEFAULT_MENU_SELECTORS;
}

function getClientSelectorMap() {
  return Object.assign({}, THEME_MENU_SELECTORS, { __default__: DEFAULT_MENU_SELECTORS });
}

module.exports = {
  THEME_MENU_SELECTORS,
  DEFAULT_MENU_SELECTORS,
  resolveMenuSelectors,
  getClientSelectorMap,
};
