import { AlertCircle, CheckCircle, Clock, Crown } from 'lucide-react';
import './SubscriptionBanner.css';

function SubscriptionBanner({ subscription }) {
  if (!subscription) return null;

  const { status, plan, isDemoAccount, demoExpiresAt, suspendedReason } = subscription;

  // Banner para cuenta DEMO
  if (isDemoAccount) {
    const expiresDate = new Date(demoExpiresAt);
    const daysLeft = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
    
    return (
      <div className="subscription-banner demo">
        <Crown size={20} />
        <div className="banner-content">
          <strong>Cuenta DEMO Activada</strong>
          <span>Acceso completo por {daysLeft} días más • Vence: {expiresDate.toLocaleDateString()}</span>
        </div>
      </div>
    );
  }

  // Banner para cuenta suspendida
  if (status === 'suspended') {
    return (
      <div className="subscription-banner suspended">
        <AlertCircle size={20} />
        <div className="banner-content">
          <strong>Cuenta Suspendida</strong>
          <span>
            {suspendedReason === 'payment_failed' 
              ? 'Regulariza tu pago en el panel de TiendaNube para continuar usando todas las funcionalidades'
              : 'Contacta con soporte para más información'}
          </span>
        </div>
      </div>
    );
  }

  // Banner para plan PRO activo
  if (status === 'active' && plan === 'pro') {
    return (
      <div className="subscription-banner active">
        <CheckCircle size={20} />
        <div className="banner-content">
          <strong>PromoNube Pro Activo</strong>
          <span>Acceso completo a todas las funcionalidades</span>
        </div>
      </div>
    );
  }

  // Banner para plan FREE
  if (plan === 'free' || status === 'inactive') {
    return (
      <div className="subscription-banner free">
        <Clock size={20} />
        <div className="banner-content">
          <strong>Plan Free</strong>
          <span>Actualiza a PRO para desbloquear todas las funcionalidades</span>
        </div>
      </div>
    );
  }

  return null;
}

export default SubscriptionBanner;
