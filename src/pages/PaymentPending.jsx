import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, Mail } from 'lucide-react';
import './PaymentSuccess.css';

function PaymentPending() {
  const navigate = useNavigate();

  return (
    <div className="payment-result-container">
      <div className="payment-result-card pending">
        <div className="success-icon-wrapper">
          <Clock size={80} className="pending-icon" />
        </div>
        
        <h1 className="result-title">Pago Pendiente ⏳</h1>
        
        <p className="result-message">
          Tu pago está siendo procesado. Esto puede tomar algunos minutos.
        </p>

        <div className="result-details">
          <div className="detail-item">
            <span className="detail-label">Estado:</span>
            <span className="detail-value status-pending">⏳ En proceso</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Tiempo estimado:</span>
            <span className="detail-value">5-15 minutos</span>
          </div>
        </div>

        <div className="result-info" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <p style={{ color: '#92400E' }}>
            <Mail size={16} style={{ display: 'inline', marginRight: '8px' }} />
            Te enviaremos un correo cuando se confirme el pago
          </p>
          <p style={{ color: '#92400E' }}>🔄 Tu plan se activará automáticamente</p>
        </div>

        <button 
          className="btn-return"
          onClick={() => navigate('/dashboard')}
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
        >
          Volver al Dashboard
          <ArrowRight size={18} />
        </button>

        <p style={{ marginTop: '24px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
          Puedes cerrar esta ventana y continuar usando GlowLab
        </p>
      </div>
    </div>
  );
}

export default PaymentPending;
