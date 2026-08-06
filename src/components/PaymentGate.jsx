import { Outlet, useLocation } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import SubscribeWall from './SubscribeWall';

const GATE_EXEMPT_PATHS = ['/admin'];

function PaymentGate() {
  const location = useLocation();
  const { accessReason, hasAccess, loading } = useSubscription();

  if (GATE_EXEMPT_PATHS.some(path => location.pathname.startsWith(path))) {
    return <Outlet />;
  }

  if (loading || hasAccess === null) {
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
