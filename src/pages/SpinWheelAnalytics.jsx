import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './SpinWheelAnalytics.css';
import { apiRequest, API_CONFIG } from '../config';
import { useToast } from '../context/ToastContext';

function SpinWheelAnalytics() {
  const { wheelId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelId, days]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const storeId = localStorage.getItem('promonube_store_id');

      const response = await apiRequest(`/api/spin-wheel/${wheelId}/analytics?storeId=${storeId}&days=${days}`);

      if (response.success) {
        setAnalytics(response.analytics);
      } else {
        toast.error('Error cargando analytics: ' + response.message);
      }
    } catch (error) {
      toast.error('Error cargando analytics: ' + error.message);
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="date-filter">
            <label>Período:</label>
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
              <option value={1}>Hoy</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={365}>Último año</option>
            </select>
          </div>
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

      {/* Funnel de conversión */}
      <div className="analytics-section">
        <h2>🔻 Funnel de conversión</h2>
        <p className="section-subtitle">
          Cómo se transforman los giros en compras reales.
        </p>
        {(() => {
          const total = analytics.totalSpins || 0;
          const withEmail = analytics.uniqueEmails || 0;
          const withCoupon = analytics.couponsGenerated || 0;
          const used = analytics.couponsUsed || 0;
          const steps = [
            { label: 'Giros realizados', value: total, color: '#6366f1', icon: '🎰' },
            { label: 'Emails capturados', value: withEmail, color: '#8b5cf6', icon: '📧' },
            { label: 'Cupones generados', value: withCoupon, color: '#a855f7', icon: '🎟️' },
            { label: 'Cupones usados', value: used, color: '#10b981', icon: '✅' }
          ];
          const max = Math.max(1, total);
          return (
            <div className="funnel">
              {steps.map((s, i) => {
                const pct = (s.value / max) * 100;
                const fromPrev = i > 0 && steps[i - 1].value > 0
                  ? ((s.value / steps[i - 1].value) * 100).toFixed(1)
                  : '100.0';
                return (
                  <div key={i} className="funnel-row">
                    <div className="funnel-row__head">
                      <span>{s.icon} <strong>{s.label}</strong></span>
                      <span className="funnel-row__nums">
                        <strong>{s.value.toLocaleString()}</strong>
                        {i > 0 && <span className="funnel-row__pct">{fromPrev}% del paso anterior</span>}
                      </span>
                    </div>
                    <div className="funnel-row__bar">
                      <div
                        className="funnel-row__fill"
                        style={{ width: `${pct}%`, background: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Cupones por vencer (alerta) */}
      {analytics.couponsExpiringSoon > 0 && analytics.expiringSoonList && analytics.expiringSoonList.length > 0 && (
        <div className="analytics-section">
          <div className="expiring-alert">
            <div className="expiring-alert__head">
              <span className="expiring-alert__icon">⏰</span>
              <div>
                <h2 style={{ margin: 0 }}>{analytics.couponsExpiringSoon} cupón(es) vencen en menos de 24h</h2>
                <p className="section-subtitle" style={{ margin: '4px 0 0' }}>
                  Aprovechá para enviar un email recordatorio a estos clientes y empujarlos a la compra.
                </p>
              </div>
            </div>
            <div className="expiring-list">
              {analytics.expiringSoonList.map((c, i) => {
                const hoursLeft = c.expiresAt
                  ? Math.max(0, Math.round((new Date(c.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000)))
                  : 0;
                return (
                  <div key={i} className="expiring-item">
                    <div className="expiring-item__main">
                      <code>{c.couponCode}</code>
                      <span className="expiring-item__email">{c.email || '—'}</span>
                    </div>
                    <div className="expiring-item__meta">
                      <span className="expiring-item__prize">{c.prize}</span>
                      <span className="expiring-item__time">vence en {hoursLeft}h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Estado de cupones */}
      <div className="analytics-section">
        <h2>🎟️ Estado de los Cupones</h2>
        <div className="status-grid">
          <div className="status-card status-used">
            <span className="status-num">{analytics.couponsUsed || 0}</span>
            <span className="status-lbl">Usados</span>
            <span className="status-sub">
              {analytics.couponsGenerated > 0
                ? `${((analytics.couponsUsed / analytics.couponsGenerated) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <div className="status-card status-pending">
            <span className="status-num">{analytics.couponsPending || 0}</span>
            <span className="status-lbl">Pendientes</span>
            <span className="status-sub">
              {analytics.couponsGenerated > 0
                ? `${(((analytics.couponsPending || 0) / analytics.couponsGenerated) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <div className="status-card status-expired">
            <span className="status-num">{analytics.couponsExpired || 0}</span>
            <span className="status-lbl">Vencidos sin usar</span>
            <span className="status-sub">
              {analytics.couponsGenerated > 0
                ? `${(((analytics.couponsExpired || 0) / analytics.couponsGenerated) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <div className="status-card status-noprize">
            <span className="status-num">
              {Math.max(0, (analytics.totalSpins || 0) - (analytics.couponsGenerated || 0))}
            </span>
            <span className="status-lbl">Sin cupón</span>
            <span className="status-sub">giros sin premio canjeable</span>
          </div>
        </div>
      </div>

      {/* Desglose detallado por premio */}
      {analytics.prizeBreakdown && analytics.prizeBreakdown.length > 0 && (
        <div className="analytics-section">
          <h2>📊 Rendimiento por Premio</h2>
          <p className="section-subtitle">
            Cuántos cupones se generaron de cada premio, cuántos se usaron y qué descuento total acumularon.
          </p>
          <div className="breakdown-table">
            <table>
              <thead>
                <tr>
                  <th>Premio</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Generados</th>
                  <th>Con cupón</th>
                  <th>Usados</th>
                  <th>Pendientes</th>
                  <th>Vencidos</th>
                  <th>Conv.</th>
                  <th>Descuento $</th>
                  <th>Revenue $</th>
                </tr>
              </thead>
              <tbody>
                {analytics.prizeBreakdown.map((p, idx) => (
                  <tr key={idx}>
                    <td className="prize-cell">{p.prizeLabel}</td>
                    <td>
                      <span className="type-badge">
                        {p.prizeType === 'percentage' && '% Descuento'}
                        {(p.prizeType === 'absolute' || p.prizeType === 'fixed') && '$ Descuento'}
                        {(p.prizeType === 'shipping' || p.prizeType === 'free_shipping') && '🚚 Envío'}
                        {p.prizeType === 'product' && '🎁 Producto'}
                        {(p.prizeType === 'no_prize' || p.prizeType === 'none' || !p.prizeType) && 'Sin premio'}
                      </span>
                    </td>
                    <td>
                      {p.prizeValue
                        ? (p.prizeType === 'percentage' ? `${p.prizeValue}%` : `$${p.prizeValue}`)
                        : '—'}
                    </td>
                    <td><strong>{p.generated}</strong></td>
                    <td>{p.withCoupon}</td>
                    <td><span className="cell-good">{p.used}</span></td>
                    <td><span className="cell-warn">{p.pending}</span></td>
                    <td><span className="cell-bad">{p.expired}</span></td>
                    <td><strong>{p.conversionRate}%</strong></td>
                    <td>${(p.totalDiscount || 0).toLocaleString()}</td>
                    <td>${(p.totalRevenue || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Heatmap día/hora */}
      {analytics.heatmap && (
        <div className="analytics-section">
          <h2>🔥 Heatmap por hora y día</h2>
          <p className="section-subtitle">
            Intensidad de giros por día de la semana y hora del día. Te ayuda a saber cuándo programar campañas.
          </p>
          {(() => {
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const max = Math.max(1, ...analytics.heatmap.flat());
            return (
              <div className="heatmap-wrapper">
                <table className="heatmap-table">
                  <thead>
                    <tr>
                      <th></th>
                      {Array.from({ length: 24 }, (_, h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.heatmap.map((row, dayIdx) => (
                      <tr key={dayIdx}>
                        <th>{days[dayIdx]}</th>
                        {row.map((cell, h) => {
                          const intensity = cell / max;
                          const bg = cell === 0
                            ? '#f3f4f6'
                            : `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`;
                          return (
                            <td
                              key={h}
                              className="heatmap-cell"
                              style={{ background: bg }}
                              title={`${days[dayIdx]} ${h}:00 — ${cell} giros`}
                            >
                              {cell > 0 ? cell : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
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
