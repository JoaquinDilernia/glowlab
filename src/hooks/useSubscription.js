import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../config';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [hasAccess, setHasAccess] = useState(null); // null = still loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSubscription = useCallback(async () => {
    const storeId = localStorage.getItem('promonube_store_id');

    if (!storeId) {
      setError('No store ID found');
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest(`/api/subscription/${storeId}/status`);

      if (data.success) {
        setSubscription(data.subscription);
        setHasAccess(data.hasAccess);
        setError(null);
      } else {
        setError('Failed to load subscription');
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  return {
    subscription,
    hasAccess,
    loading,
    error,
    reload: loadSubscription
  };
}
