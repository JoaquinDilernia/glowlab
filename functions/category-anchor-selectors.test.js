"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_ANCHOR_SELECTOR,
  resolveCategoryAnchorSelectors,
  getClientSelectorMap,
} = require("./category-anchor-selectors");

test("resolveCategoryAnchorSelectors devuelve DEFAULT (null) para un theme sin mapear", () => {
  assert.deepEqual(resolveCategoryAnchorSelectors("rio"), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors("cualquier_cosa"), DEFAULT_ANCHOR_SELECTOR);
});

test("resolveCategoryAnchorSelectors devuelve DEFAULT para theme undefined/null/vacío", () => {
  assert.deepEqual(resolveCategoryAnchorSelectors(undefined), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors(null), DEFAULT_ANCHOR_SELECTOR);
  assert.deepEqual(resolveCategoryAnchorSelectors(""), DEFAULT_ANCHOR_SELECTOR);
});

test("getClientSelectorMap incluye __default__ para que el script del storefront tenga fallback", () => {
  const map = getClientSelectorMap();
  assert.deepEqual(map.__default__, DEFAULT_ANCHOR_SELECTOR);
});

test("DEFAULT_ANCHOR_SELECTOR.gridSelector es null (heurística genérica en el storefront)", () => {
  assert.equal(DEFAULT_ANCHOR_SELECTOR.gridSelector, null);
});
