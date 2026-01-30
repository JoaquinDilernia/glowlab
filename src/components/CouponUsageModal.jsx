import { useState, useEffect } from 'react';
import { X, Calendar, ShoppingBag, DollarSign, User, TrendingUp, Package } from 'lucide-react';
import { apiRequest } from '../config';
import './CouponUsageModal.css';

function CouponUsageModal({ coupon, onClose }) {
  const [loading, setLoading] = useState(true);
  const [usageHistory, setUsageHistory] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalDiscount: 0,
    averageOrderValue: 0,
    conversionRate: 0
  });

  useEffect(() => {
    loadUsageHistory();
  }, [coupon.couponId]);

  const loadUsageHistory = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/coupons/${coupon.couponId}/usage`);
      
      if (data.success) {
        setUsageHistory(data.usage || []);
        calculateStats(data.usage || []);
      }
    } catch (error) {
      console.error('Error loading usage history:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (usage) => {
    if (usage.length === 0) {
      setStats({ totalOrders: 0, totalDiscount: 0, averageOrderValue: 0, conversionRate: 0 });
      return;
    }

    const totalOrders = usage.length;
    const totalDiscount = usage.reduce((sum, u) => sum + (u.discountAmount || 0), 0);
    const totalOrderValue = usage.reduce((sum, u) => sum + (u.orderTotal || 0), 0);
    const averageOrderValue = totalOrderValue / totalOrders;

    setStats({
      totalOrders,
      totalDiscount,
      averageOrderValue,
      conversionRate: coupon.maxUses ? (totalOrders / coupon.maxUses * 100) : 0
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value || 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Historial de Uso</h2>
            <p className="coupon-code-modal">{coupon.code}</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="usage-stats">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e0e7ff' }}>
              <ShoppingBag size={24} style={{ color: '#667eea' }} />
            </div>
            <div>
              <p className="stat-label">Total de Usos</p>
              <p className="stat-value">{stats.totalOrders}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>
              <DollarSign size={24} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <p className="stat-label">Descuento Total</p>
              <p className="stat-value">{formatCurrency(stats.totalDiscount)}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>
              <TrendingUp size={24} style={{ color: '#d97706' }} />
            </div>
            <div>
              <p className="stat-label">Ticket Promedio</p>
              <p className="stat-value">{formatCurrency(stats.averageOrderValue)}</p>
            </div>
          </div>
          
          {coupon.maxUses && (
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#fce7f3' }}>
                <Package size={24} style={{ color: '#db2777' }} />
              </div>
              <div>
                <p className="stat-label">Tasa de Uso</p>
                <p className="stat-value">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Usage History Table */}
        <div className="usage-history">
          <h3>Historial de Pedidos</h3>
          
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Cargando historial...</p>
            </div>
          ) : usageHistory.length === 0 ? (
            <div className="empty-state-modal">
              <ShoppingBag size={48} style={{ color: '#cbd5e1' }} />
              <p>Este cupón aún no ha sido usado</p>
              <small>Los usos aparecerán aquí cuando los clientes realicen pedidos</small>
            </div>
          ) : (
            <div className="usage-table-container">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Total Pedido</th>
                    <th>Descuento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.map((usage, index) => (
                    <tr key={index} className={usage.requiereRevision ? 'row-warning' : ''}>
                      <td>
                        <div className="table-cell-date">
                          <Calendar size={16} />
                          {formatDate(usage.usedAt)}
                        </div>
                      </td>
                      <td>
                        <a 
                          href={`https://www.tiendanube.com/admin/orders/${usage.orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="order-link"
                        >
                          #{usage.orderNumber}
                        </a>
                      </td>
                      <td>
                        <div className="table-cell-customer">
                          <User size={16} />
                          {usage.customerName || usage.customerEmail || 'Anónimo'}
                        </div>
                      </td>
                      <td className="table-cell-amount">
                        {formatCurrency(usage.orderTotal)}
                      </td>
                      <td className="table-cell-discount">
                        -{formatCurrency(usage.discountAmount)}
                        {usage.topeExcedido && (
                          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>
                            ⚠️ Excedió tope (esperado: ${usage.descuentoEsperado})
                          </div>
                        )}
                      </td>
                      <td>
                        {usage.emailAutorizado === false ? (
                          <span className="badge-error" title={usage.motivoRechazo}>
                            ❌ No autorizado
                          </span>
                        ) : usage.topeExcedido ? (
                          <span className="badge-warning">
                            ⚠️ Tope excedido
                          </span>
                        ) : (
                          <span className="badge-success">
                            ✅ OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CouponUsageModal;
