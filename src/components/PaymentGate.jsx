import { Outlet, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import SubscribeWall from './SubscribeWall';

const GATE_EXEMPT_PATHS = ['/admin'];

function PaymentGate() {
  const location = useLocation();
  const { accessReason, hasAccess, loading, error, reload } = useSubscription();

  if (GATE_EXEMPT_PATHS.some(path => location.pathname.startsWith(path))) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
      </div>
    );
  }

  // Si la consulta fallo no sabemos si la tienda tiene acceso: no mostramos ni
  // la app ni el paywall, ofrecemos reintentar (antes esto quedaba colgado en
  // el spinner para siempre, porque hasAccess se queda en null ante un error).
  if (error && hasAccess === null) {
    return (
      <div className="loading-container">
        <AlertCircle size={40} />
        <p>No pudimos verificar tu suscripción.</p>
        <button className="btn-primary" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }

  if (hasAccess === null) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return <SubscribeWall accessReason={accessReason} />;
  }

  return <Outlet />;
}

export default PaymentGate;
