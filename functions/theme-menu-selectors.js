"use strict";

// Selectores verificados manualmente contra tiendas reales (ver plan
// docs/superpowers/plans/2026-08-11-theme-aware-menu-widget.md).
// Agregar un theme nuevo acá NO requiere tocar customizeMenu() en index.js.
const THEME_MENU_SELECTORS = {
  rio: {
    mobileLinkSelector:
      "#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a",
    desktopContainerSelector: null,
  },
  new_linkedman: {
    mobileLinkSelector: "#nav-hamburger ul.list-items > li > a",
    desktopContainerSelector: ".js-desktop-nav-first-level",
  },
  ipanema: {
    // Items con submenú usan <button class="nav-list-link"> en vez de <a> en mobile,
    // por eso el selector no restringe el tag (a diferencia de rio/new_linkedman).
    mobileLinkSelector: "#nav-hamburger .nav-list > .nav-item > .nav-list-link",
    desktopContainerSelector: ".js-nav-desktop-list.nav-desktop-list",
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
