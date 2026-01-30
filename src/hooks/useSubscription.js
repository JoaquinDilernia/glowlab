import { useState, useEffect } from 'react';
import { apiRequest } from '../config';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [modules, setModules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    const storeId = localStorage.getItem('promonube_store_id');
    
    if (!storeId) {
      setError('No store ID found');
      setLoading(false);
      return;
    }

    try {
      // Usar el nuevo endpoint de status que devuelve toda la info
      const data = await apiRequest(`/api/subscription/${storeId}/status`);
      
      if (data.success && data.subscription) {
        const sub = data.subscription;
        setSubscription({
          plan: sub.plan || 'free',
          status: sub.status,
          isDemoAccount: sub.isDemoAccount || false,
          demoExpiresAt: sub.demoExpiresAt,
          suspendedReason: sub.suspendedReason,
          modules: sub.modules || {},
          hasActivePayment: sub.hasActivePayment || false
        });
        setModules(sub.modules || {});
      } else {
        setError('Failed to load subscription');
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (moduleName) => {
    return modules[moduleName] === true;
  };

  const activateModule = async (moduleName) => {
    const storeId = localStorage.getItem('promonube_store_id');
    
    try {
      const data = await apiRequest(`/api/subscription/${storeId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ moduleName })
      });
      
      if (data.success) {
        await loadSubscription(); // Recargar
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error activating module:', err);
      return false;
    }
  };

  const changePlan = async (planId) => {
    const storeId = localStorage.getItem('promonube_store_id');
    
    try {
      const data = await apiRequest(`/api/subscription/${storeId}/change-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId })
      });
      
      if (data.success) {
        await loadSubscription(); // Recargar
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error changing plan:', err);
      return false;
    }
  };

  return {
    subscription,
    modules,
    loading,
    error,
    hasAccess,
    activateModule,
    changePlan,
    reload: loadSubscription
  };
}
