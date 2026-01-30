import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import './PaymentSuccess.css';

function PaymentFailure() {
  const navigate = useNavigate();

  const handleRetry = () => {
    navigate('/dashboard');
  };

  return (
    <div className="payment-result-container">
      <div className="payment-result-card failure">
        <div className="success-icon-wrapper">
          <XCircle size={80} className="failure-icon" />
        </div>
        
        <h1 className="result-title">Pago Rechazado</h1>
        
        <p className="result-message">
          Lo sentimos, tu pago no pudo ser procesado. Esto puede deberse a:
        </p>

        <div className="result-details">
          <div className="detail-item">
            <span className="detail-label">💳</span>
            <span className="detail-value">Fondos insuficientes</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">🔒</span>
            <span className="detail-value">Tarjeta bloqueada o vencida</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">⚠️</span>
            <span className="detail-value">Datos incorrectos</span>
          </div>
        </div>

        <div className="result-info" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <p style={{ color: '#991B1B' }}>💡 Verifica los datos de tu tarjeta e intenta nuevamente</p>
          <p style={{ color: '#991B1B' }}>📞 Si el problema persiste, contacta a tu banco</p>
        </div>

        <button 
          className="btn-return btn-retry"
          onClick={handleRetry}
        >
          <RefreshCw size={18} />
          Intentar Nuevamente
        </button>

        <button 
          className="btn-return"
          onClick={() => navigate('/dashboard')}
          style={{ marginTop: '12px', background: '#6B7280' }}
        >
          <ArrowLeft size={18} />
          Volver al Dashboard
        </button>
      </div>
    </div>
  );
}

export default PaymentFailure;
