const SUBSCRIPTION_PRICE_ARS = 60000;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function evaluateAccess(subscriptionData, now = new Date()) {
  if (!subscriptionData) {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  if (subscriptionData.freeForever === true) {
    return { hasAccess: true, reason: 'free_forever' };
  }

  const courtesyUntil = toDate(subscriptionData.courtesyUntil);
  if (courtesyUntil && courtesyUntil > now) {
    return { hasAccess: true, reason: 'courtesy', until: courtesyUntil };
  }

  if (subscriptionData.status === 'trialing') {
    const trialEndsAt = toDate(subscriptionData.trialEndsAt);
    if (trialEndsAt && trialEndsAt > now) {
      return { hasAccess: true, reason: 'trialing', until: trialEndsAt };
    }
    return { hasAccess: false, reason: 'trial_expired' };
  }

  if (subscriptionData.status === 'active') {
    return { hasAccess: true, reason: 'active' };
  }

  return { hasAccess: false, reason: subscriptionData.status || 'inactive' };
}

module.exports = { evaluateAccess, SUBSCRIPTION_PRICE_ARS };
