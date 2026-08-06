const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAccess, SUBSCRIPTION_PRICE_ARS } = require('./subscriptionAccess');

test('price constant is 60000 ARS', () => {
  assert.equal(SUBSCRIPTION_PRICE_ARS, 60000);
});

test('no subscription doc -> no access', () => {
  const result = evaluateAccess(null);
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'no_subscription');
});

test('freeForever true -> access regardless of status', () => {
  const result = evaluateAccess({ freeForever: true, status: 'blocked' });
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'free_forever');
});

test('courtesyUntil in the future -> access regardless of status', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ courtesyUntil: '2026-08-10T00:00:00Z', status: 'blocked' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'courtesy');
});

test('courtesyUntil in the past -> falls through to status evaluation', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ courtesyUntil: '2026-01-01T00:00:00Z', status: 'active' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'active');
});

test('trialing with future trialEndsAt -> access', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: '2026-08-10T00:00:00Z' }, now);
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'trialing');
});

test('trialing with past trialEndsAt -> no access', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: '2026-08-01T00:00:00Z' }, now);
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'trial_expired');
});

test('trialing with no trialEndsAt -> no access', () => {
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: null });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'trial_expired');
});

test('active status -> access', () => {
  const result = evaluateAccess({ status: 'active' });
  assert.equal(result.hasAccess, true);
  assert.equal(result.reason, 'active');
});

test('blocked status -> no access, reason echoes status', () => {
  const result = evaluateAccess({ status: 'blocked' });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'blocked');
});

test('past_due status -> no access', () => {
  const result = evaluateAccess({ status: 'past_due' });
  assert.equal(result.hasAccess, false);
  assert.equal(result.reason, 'past_due');
});

test('accepts Firestore Timestamp-like objects via toDate()', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  const fakeTimestamp = { toDate: () => new Date('2026-08-10T00:00:00Z') };
  const result = evaluateAccess({ status: 'trialing', trialEndsAt: fakeTimestamp }, now);
  assert.equal(result.hasAccess, true);
});
