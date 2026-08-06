import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../config';
import './PaymentSuccess.css';

const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

function PaymentSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'confirmed' | 'timeout'

  useEffect(() => {
    const storeId = localStorage.getItem('promonube_store_id');
    if (!storeId) {
      navigate('/dashboard');
      return;
    }

    let cancelled = false;

    const poll = async (attempt) => {
      try {
        const data = await apiRequest(`/api/subscription/${storeId}/status`);
        if (data.success && data.hasAccess) {
          if (!cancelled) setStatus('confirmed');
          return;
        }
      } catch (err) {
        console.error('Error consultando estado de suscripción:', err);
      }

      if (cancelled) return;

      if (attempt >= POLL_ATTEMPTS) {
        setStatus('timeout');
        return;
      }

      setTimeout(() => poll(attempt + 1), POLL_INTERVAL_MS);
    };

    poll(1);

    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    if (status !== 'confirmed') return;
    const timer = setTimeout(() => navigate('/dashboard'), 2000);
    return () => clearTimeout(timer);
  }, [status, navigate]);

  return (
    <div className="payment-result-container">
      <div className="payment-result-card success">
        <div className="success-icon-wrapper">
          <CheckCircle size={80} className="success-icon" />
        </div>

        <h1 className="result-title">
          {status === 'confirmed' ? '¡Suscripción Activa! 🎉' : 'Confirmando tu pago...'}
        </h1>

        <p className="result-message">
          {status === 'checking' && 'Estamos confirmando tu suscripción con Mercado Pago, un momento.'}
          {status === 'confirmed' && 'Tu suscripción a PromoNube Pro ya está activa.'}
          {status === 'timeout' && 'El pago se está procesando. Puede demorar unos minutos en reflejarse — si no ves los cambios, volvé a entrar al dashboard en breve.'}
        </p>

        {(status === 'checking' || status === 'confirmed') && (
          <div className="countdown-redirect">
            <Loader2 size={16} className="spinner" />
            <span>{status === 'checking' ? 'Verificando...' : 'Redirigiendo al dashboard...'}</span>
          </div>
        )}

        <button
          className="btn-return"
          onClick={() => navigate('/dashboard')}
        >
          Ir al Dashboard
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default PaymentSuccess;
