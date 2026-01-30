import { useState } from 'react';
import { CreditCard, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '../config';
import './PaymentTest.css';

function PaymentTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const testMercadoPago = async () => {
    setLoading(true);
    setResult(null);

    try {
      const storeId = localStorage.getItem('promonube_store_id') || 'test-store';
      
      const response = await apiRequest('/api/mp/create-preference', {
        method: 'POST',
        body: JSON.stringify({
          storeId: storeId,
          planId: 'ruleta',
          storeEmail: 'test@test.com',
          storeName: 'Test Store'
        })
      });

      if (response.success && response.initPoint) {
        setResult({
          success: true,
          message: 'Mercado Pago está funcionando correctamente',
          preferenceId: response.preferenceId,
          initPoint: response.initPoint,
          details: 'Se creó la preferencia de pago exitosamente'
        });
      } else {
        setResult({
          success: false,
          message: 'Error al crear preferencia de pago',
          error: response.error || 'Error desconocido',
          details: response.details || 'Sin detalles adicionales'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error de conexión con el servidor',
        error: error.message,
        details: 'Verifica que el backend esté funcionando'
      });
    } finally {
      setLoading(false);
    }
  };

  const openTestPayment = () => {
    if (result?.initPoint) {
      window.open(result.initPoint, '_blank');
    }
  };

  return (
    <div className="payment-test-container">
      <div className="payment-test-card">
        <div className="test-header">
          <CreditCard size={48} className="header-icon" />
          <h1>Diagnóstico de Pagos</h1>
          <p>Verifica el estado de la integración con Mercado Pago</p>
        </div>

        <div className="test-actions">
          <button 
            className="btn-test"
            onClick={testMercadoPago}
            disabled={loading}
          >
            {loading ? 'Verificando...' : '🧪 Test Mercado Pago'}
          </button>
        </div>

        {result && (
          <div className={`test-result ${result.success ? 'success' : 'error'}`}>
            <div className="result-header">
              {result.success ? (
                <CheckCircle size={32} className="icon-success" />
              ) : (
                <XCircle size={32} className="icon-error" />
              )}
              <h3>{result.message}</h3>
            </div>

            <div className="result-details">
              {result.preferenceId && (
                <div className="detail-row">
                  <strong>Preference ID:</strong>
                  <code>{result.preferenceId}</code>
                </div>
              )}

              {result.error && (
                <div className="detail-row error-detail">
                  <strong>Error:</strong>
                  <code>{result.error}</code>
                </div>
              )}

              {result.details && (
                <div className="detail-row">
                  <strong>Detalles:</strong>
                  <span>{result.details}</span>
                </div>
              )}

              {result.success && result.initPoint && (
                <div className="test-payment-action">
                  <button 
                    className="btn-open-payment"
                    onClick={openTestPayment}
                  >
                    💳 Abrir Checkout de Prueba
                  </button>
                  <p className="test-note">
                    <AlertCircle size={16} />
                    Usa las tarjetas de prueba de Mercado Pago
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="test-cards-info">
          <h4>📝 Tarjetas de Prueba Mercado Pago</h4>
          <div className="card-info">
            <div className="card-item">
              <strong>✅ Aprobada:</strong>
              <code>5031 7557 3453 0604</code>
              <span>CVV: 123 | Exp: 11/25</span>
            </div>
            <div className="card-item">
              <strong>❌ Rechazada:</strong>
              <code>5031 4332 1540 6351</code>
              <span>CVV: 123 | Exp: 11/25</span>
            </div>
            <div className="card-item">
              <strong>⏳ Pendiente:</strong>
              <code>5031 4418 8740 7761</code>
              <span>CVV: 123 | Exp: 11/25</span>
            </div>
          </div>
        </div>

        <div className="integration-status">
          <h4>🔧 Estado de la Integración</h4>
          <ul>
            <li>
              <strong>Backend:</strong> 
              <span>https://apipromonube-jlfopowzaq-uc.a.run.app</span>
            </li>
            <li>
              <strong>Token MP:</strong> 
              <span>{loading ? 'Verificando...' : 'TEST-...'}</span>
            </li>
            <li>
              <strong>Webhook:</strong> 
              <span>/api/mp/webhook</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default PaymentTest;
