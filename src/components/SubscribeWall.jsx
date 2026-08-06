import { useState } from 'react';
import { Crown, Check, Loader2 } from 'lucide-react';
import { apiRequest } from '../config';
import './SubscribeWall.css';

// Las claves son valores de accessReason (los que devuelve evaluateAccess en el
// backend), no de subscription.status.
const REASON_COPY = {
  trial_expired: 'Tu período de prueba de 7 días terminó.',
  blocked: 'Tu suscripción fue pausada o cancelada en Mercado Pago.',
  past_due: 'Hubo un problema con tu último cobro.',
  no_subscription: 'Todavía no activaste tu suscripción.'
};

function SubscribeWall({ accessReason }) {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const reason = accessReason || 'no_subscription';
  const message = REASON_COPY[reason] || REASON_COPY.no_subscription;

  const handleSubscribe = async () => {
    const storeId = localStorage.getItem('promonube_store_id');
    setLoadingCheckout(true);
    setErrorMsg(null);
    try {
      const data = await apiRequest('/api/mp/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ storeId })
      });
      if (data.success && data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        setErrorMsg(data.error || 'No se pudo iniciar la suscripción');
        setLoadingCheckout(false);
      }
    } catch (err) {
      console.error('Error creando suscripción:', err);
      // apiRequest propaga el mensaje que manda el backend cuando lo hay
      // (ej: "La tienda no tiene email configurado"); si no, mensaje generico.
      setErrorMsg(err?.message || 'No se pudo conectar con Mercado Pago. Intentá de nuevo.');
      setLoadingCheckout(false);
    }
  };

  return (
    <div className="subscribe-wall">
      <div className="subscribe-wall-card">
        <Crown size={48} className="subscribe-wall-icon" />
        <h1>Suscribite para continuar</h1>
        <p className="subscribe-wall-message">{message}</p>

        <div className="subscribe-wall-price">
          <span className="currency">ARS</span>
          <span className="amount">$60.000</span>
          <span className="period">/mes</span>
        </div>

        <ul className="subscribe-wall-features">
          <li><Check size={18} /> Cupones Inteligentes</li>
          <li><Check size={18} /> Gift Cards</li>
          <li><Check size={18} /> Ruleta de Premios</li>
          <li><Check size={18} /> Cuenta Regresiva</li>
          <li><Check size={18} /> Style Pro</li>
          <li><Check size={18} /> Pop-ups</li>
        </ul>

        {errorMsg && <div className="subscribe-wall-error">{errorMsg}</div>}

        <button
          className="btn-subscribe-wall"
          onClick={handleSubscribe}
          disabled={loadingCheckout}
        >
          {loadingCheckout ? <Loader2 size={20} className="spinner" /> : 'Suscribirme con Mercado Pago'}
        </button>

        <p className="subscribe-wall-note">
          Se te va a pedir que autorices una tarjeta en Mercado Pago. El cobro es mensual y automático.
        </p>
      </div>
    </div>
  );
}

export default SubscribeWall;
