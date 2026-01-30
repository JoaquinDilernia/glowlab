import { X, Check, Crown, ExternalLink, AlertCircle } from 'lucide-react';
import './UpgradeModal.css';

function UpgradeModal({ isOpen, onClose, currentPlan = 'free', subscription }) {
  if (!isOpen) return null;

  const handleManageSubscription = () => {
    const storeId = localStorage.getItem('promonube_store_id');
    // Abrir el panel de TiendaNube para gestionar apps y pagos
    window.open(`https://www.tiendanube.com/admin/stores/${storeId}/apps`, '_blank');
    onClose();
  };

  const isDemoAccount = subscription?.isDemoAccount || false;
  const isSuspended = subscription?.status === 'suspended';
  const isPro = currentPlan === 'pro';

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div className="upgrade-modal simple" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="modal-header">
          <Crown size={40} className="header-icon" />
          <h2>PromoNube Pro</h2>
          <p>Todas las funcionalidades en un solo plan</p>
        </div>

        {/* Info del plan */}
        <div className="plan-single">
          <div className="plan-price-large">
            <span className="currency">ARS</span>
            <span className="amount">$50,000</span>
            <span className="period">/mes</span>
          </div>
          
          <div className="plan-trial">
            ✨ 30 días de prueba gratis
          </div>

          <ul className="plan-features-large">
            <li><Check size={20} /> Cupones Inteligentes ilimitados</li>
            <li><Check size={20} /> Gift Cards con templates personalizados</li>
            <li><Check size={20} /> Ruleta de premios interactiva</li>
            <li><Check size={20} /> Cuenta regresiva para impulsar ventas</li>
            <li><Check size={20} /> Personalización visual completa</li>
            <li><Check size={20} /> Integraciones email marketing</li>
            <li><Check size={20} /> Analytics y reportes detallados</li>
            <li><Check size={20} /> Soporte prioritario 24/7</li>
          </ul>

          {/* Estado actual */}
          {isDemoAccount && (
            <div className="subscription-alert demo">
              <AlertCircle size={20} />
              <div>
                <strong>Cuenta DEMO activa</strong>
                <p>Tienes acceso completo temporalmente</p>
              </div>
            </div>
          )}

          {isSuspended && (
            <div className="subscription-alert suspended">
              <AlertCircle size={20} />
              <div>
                <strong>Suscripción suspendida</strong>
                <p>Regulariza tu pago para continuar</p>
              </div>
            </div>
          )}

          {isPro && !isSuspended && !isDemoAccount && (
            <div className="subscription-alert active">
              <Check size={20} />
              <div>
                <strong>Suscripción activa</strong>
                <p>Tienes acceso completo a todas las funcionalidades</p>
              </div>
            </div>
          )}

          {/* Botón de acción */}
          <button 
            className="btn-manage-subscription"
            onClick={handleManageSubscription}
          >
            <ExternalLink size={20} />
            {isPro && !isSuspended ? 'Gestionar Suscripción' : 'Activar Plan Pro'}
          </button>

          <p className="subscription-note">
            El cobro se gestiona automáticamente desde el panel de TiendaNube
          </p>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;

