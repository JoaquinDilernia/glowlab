"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveMenuSelectors,
  DEFAULT_MENU_SELECTORS,
  getClientSelectorMap,
} = require("./theme-menu-selectors");

test("resolveMenuSelectors returns the verified Rio selector set", () => {
  const sel = resolveMenuSelectors("rio");
  assert.equal(
    sel.mobileLinkSelector,
    "#nav-hamburger > div > div.modal-scrollable-area > div.modal-body.nav-body > div > ul > li > a"
  );
  assert.equal(sel.desktopContainerSelector, null);
});

test("resolveMenuSelectors returns the verified Simple (new_linkedman) selector set", () => {
  const sel = resolveMenuSelectors("new_linkedman");
  assert.equal(sel.mobileLinkSelector, "#nav-hamburger ul.list-items > li > a");
  assert.equal(sel.desktopContainerSelector, ".js-desktop-nav-first-level");
});

test("resolveMenuSelectors returns the verified Ipanema selector set", () => {
  const sel = resolveMenuSelectors("ipanema");
  assert.equal(sel.mobileLinkSelector, "#nav-hamburger .nav-list > .nav-item > .nav-list-link");
  assert.equal(sel.desktopContainerSelector, ".js-nav-desktop-list.nav-desktop-list");
});

test("resolveMenuSelectors falls back to DEFAULT for unknown or missing theme codes", () => {
  assert.deepEqual(resolveMenuSelectors("some_unmapped_theme"), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(undefined), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(null), DEFAULT_MENU_SELECTORS);
  assert.deepEqual(resolveMenuSelectors(""), DEFAULT_MENU_SELECTORS);
});

test("DEFAULT_MENU_SELECTORS selectors are null so the client script knows to use the legacy heuristic scan", () => {
  assert.equal(DEFAULT_MENU_SELECTORS.mobileLinkSelector, null);
  assert.equal(DEFAULT_MENU_SELECTORS.desktopContainerSelector, null);
});

test("getClientSelectorMap embeds every known theme plus a __default__ fallback entry", () => {
  const map = getClientSelectorMap();
  assert.ok(map.rio);
  assert.ok(map.new_linkedman);
  assert.ok(map.ipanema);
  assert.deepEqual(map.__default__, DEFAULT_MENU_SELECTORS);
  // must be plain-JSON-serializable (no functions/undefined) since it gets embedded via JSON.stringify
  assert.equal(JSON.stringify(map).includes("function"), false);
});
