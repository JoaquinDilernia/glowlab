import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import './PaymentSuccess.css';

function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const planId = searchParams.get('plan');

  const planNames = {
    promopack: 'Promo Pack',
    premiumpack: 'Premium Pack',
    unlimited: 'Pro Unlimited'
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="payment-result-container">
      <div className="payment-result-card success">
        <div className="success-icon-wrapper">
          <CheckCircle size={80} className="success-icon" />
        </div>
        
        <h1 className="result-title">¡Pago Exitoso! 🎉</h1>
        
        <p className="result-message">
          Tu suscripción al plan <strong>{planNames[planId] || 'Premium'}</strong> ha sido activada correctamente.
        </p>

        <div className="result-details">
          <div className="detail-item">
            <span className="detail-label">Plan:</span>
            <span className="detail-value">{planNames[planId] || planId}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Estado:</span>
            <span className="detail-value status-active">✅ Activo</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Facturación:</span>
            <span className="detail-value">Mensual</span>
          </div>
        </div>

        <div className="result-info">
          <p>🎁 Ya puedes disfrutar de todas las funciones incluidas en tu plan</p>
          <p>📧 Recibirás un correo con los detalles de tu compra</p>
        </div>

        <div className="countdown-redirect">
          <Loader2 size={16} className="spinner" />
          <span>Redirigiendo al dashboard en {countdown} segundos...</span>
        </div>

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
