import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './SpinWheelAnalytics.css';
import { apiRequest, API_CONFIG } from '../config';

function SpinWheelAnalytics() {
  const { wheelId } = useParams();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [wheelId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const storeId = localStorage.getItem('promonube_store_id');

      console.log('📊 Cargando analytics para wheelId:', wheelId, 'storeId:', storeId);

      const response = await apiRequest(`/api/spin-wheel/${wheelId}/analytics?storeId=${storeId}`);

      console.log('📊 Respuesta analytics:', response);

      if (response.success) {
        setAnalytics(response.analytics);
      } else {
        console.error('❌ Error en respuesta:', response);
        alert('Error cargando analytics: ' + response.message);
      }
    } catch (error) {
      console.error('❌ Error en catch:', error);
      alert('Error cargando analytics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const storeId = localStorage.getItem('promonube_store_id');
    const url = `${API_CONFIG.BASE_URL}/api/spin-wheel/${wheelId}/export?storeId=${storeId}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="spin-analytics">
        <div className="analytics-loading">
          <div className="spinner"></div>
          <p>Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="spin-analytics">
        <div className="analytics-error">
          <h2>No se pudieron cargar las estadísticas</h2>
          <button onClick={() => navigate('/spin-wheel')} className="btn-back">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="spin-analytics">
      <div className="analytics-header">
        <div>
          <h1>📊 Analytics de Ruleta</h1>
          <p className="analytics-subtitle">Estadísticas detalladas de rendimiento</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleExport} className="btn-export">
            📥 Exportar CSV
          </button>
          <button onClick={() => navigate('/spin-wheel')} className="btn-back">
            ← Volver
          </button>
        </div>
      </div>

      {/* Cards de métricas principales */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">🎰</div>
          <div className="metric-info">
            <h3>Total de Giros</h3>
            <p className="metric-value">{analytics.totalSpins}</p>
            <span className="metric-label">{analytics.uniqueEmails} emails únicos</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎟️</div>
          <div className="metric-info">
            <h3>Cupones Generados</h3>
            <p className="metric-value">{analytics.couponsGenerated}</p>
            <span className="metric-label">{analytics.couponsUsed} usados</span>
          </div>
        </div>

        <div className="metric-card highlight">
          <div className="metric-icon">📈</div>
          <div className="metric-info">
            <h3>Tasa de Conversión</h3>
            <p className="metric-value">{analytics.conversionRate}%</p>
            <span className="metric-label">cupones canjeados</span>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">💰</div>
          <div className="metric-info">
            <h3>Revenue Total</h3>
            <p className="metric-value">${analytics.totalRevenue.toLocaleString()}</p>
            <span className="metric-label">Ticket promedio: ${analytics.avgOrderValue}</span>
          </div>
        </div>
      </div>

      {/* Distribución de premios */}
      <div className="analytics-section">
        <h2>🎁 Distribución de Premios</h2>
        <div className="prize-distribution">
          {Object.entries(analytics.prizeDistribution).map(([prize, count]) => {
            const percentage = ((count / analytics.totalSpins) * 100).toFixed(1);
            return (
              <div key={prize} className="prize-bar">
                <div className="prize-label">
                  <span className="prize-name">{prize}</span>
                  <span className="prize-count">{count} giros ({percentage}%)</span>
                </div>
                <div className="prize-progress">
                  <div 
                    className="prize-fill" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      {analytics.timeline.length > 0 && (
        <div className="analytics-section">
          <h2>📅 Actividad por Día</h2>
          <div className="timeline-chart">
            {analytics.timeline.map(day => {
              const maxSpins = Math.max(...analytics.timeline.map(d => d.spins));
              const height = (day.spins / maxSpins) * 100;
              
              return (
                <div key={day.date} className="timeline-bar">
                  <div 
                    className="bar-fill" 
                    style={{ height: `${height}%` }}
                    title={`${day.spins} giros`}
                  ></div>
                  <span className="bar-label">{new Date(day.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
                  <span className="bar-value">{day.spins}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos giros */}
      <div className="analytics-section">
        <h2>🕒 Últimos Giros</h2>
        <div className="recent-spins-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Premio</th>
                <th>Cupón</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentSpins.map((spin, index) => (
                <tr key={index}>
                  <td className="email-cell">{spin.email}</td>
                  <td className="prize-cell">{spin.prize}</td>
                  <td className="coupon-cell">
                    {spin.couponCode ? (
                      <code>{spin.couponCode}</code>
                    ) : (
                      <span className="no-coupon">Sin cupón</span>
                    )}
                  </td>
                  <td className="date-cell">
                    {new Date(spin.timestamp).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="status-cell">
                    {spin.used ? (
                      <span className="badge badge-success">Usado</span>
                    ) : (
                      <span className="badge badge-pending">Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen de descuentos */}
      <div className="analytics-section">
        <div className="discount-summary">
          <div className="summary-item">
            <span className="summary-label">💸 Total Descontado</span>
            <span className="summary-value">${analytics.totalDiscount.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">📦 Órdenes Generadas</span>
            <span className="summary-value">{analytics.couponsUsed}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">🎯 ROI</span>
            <span className="summary-value">{analytics.roi}%</span>
          </div>
        </div>
      </div>

      {/* Top Cupones Usados */}
      {analytics.topCoupons && analytics.topCoupons.length > 0 && (
        <div className="analytics-section">
          <h2>🏆 Top Cupones Usados</h2>
          <div className="top-coupons-list">
            {analytics.topCoupons.map((coupon, index) => (
              <div key={index} className="top-coupon-item">
                <div className="coupon-rank">#{index + 1}</div>
                <div className="coupon-details">
                  <code className="coupon-code">{coupon.couponCode}</code>
                  <span className="coupon-email">{coupon.email}</span>
                </div>
                <div className="coupon-stats">
                  <span className="coupon-total">${coupon.total.toLocaleString()}</span>
                  <span className="coupon-discount">-${coupon.discount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SpinWheelAnalytics;
