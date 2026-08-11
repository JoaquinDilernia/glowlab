import test from 'node:test';
import assert from 'node:assert/strict';
import { computeThemeStats } from './themeStats.js';

test('groups stores by detectedTheme.code and counts them', () => {
  const stores = [
    { storeId: '1', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
    { storeId: '2', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
    { storeId: '3', detectedTheme: { code: 'new_linkedman', name: 'Simple', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.deepEqual(result.knownThemes, [
    { code: 'rio', name: 'Rio', custom: false, count: 2 },
    { code: 'new_linkedman', name: 'Simple', custom: false, count: 1 },
  ]);
  assert.equal(result.undetectedCount, 0);
});

test('stores with no detectedTheme go into undetectedCount, not knownThemes', () => {
  const stores = [
    { storeId: '1', detectedTheme: null },
    { storeId: '2' },
    { storeId: '3', detectedTheme: { code: 'rio', name: 'Rio', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.undetectedCount, 2);
  assert.deepEqual(result.knownThemes, [{ code: 'rio', name: 'Rio', custom: false, count: 1 }]);
});

test('knownThemes is sorted descending by count', () => {
  const stores = [
    { detectedTheme: { code: 'a', name: 'A', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
    { detectedTheme: { code: 'b', name: 'B', custom: false } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.knownThemes[0].code, 'b');
  assert.equal(result.knownThemes[0].count, 3);
  assert.equal(result.knownThemes[1].code, 'a');
});

test('custom themes are grouped by their own code, each tagged custom:true', () => {
  const stores = [
    { detectedTheme: { code: 'custom_abc', name: 'Custom Theme', custom: true } },
    { detectedTheme: { code: 'custom_xyz', name: 'Other Custom', custom: true } },
  ];
  const result = computeThemeStats(stores);
  assert.equal(result.knownThemes.length, 2);
  assert.ok(result.knownThemes.every((t) => t.custom === true));
});

test('empty stores array returns empty knownThemes and zero undetected', () => {
  const result = computeThemeStats([]);
  assert.deepEqual(result.knownThemes, []);
  assert.equal(result.undetectedCount, 0);
});
