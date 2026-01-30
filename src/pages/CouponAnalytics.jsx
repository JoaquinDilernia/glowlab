import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, Users, Calendar, Mail, Package, Download } from 'lucide-react';
import { apiRequest } from '../config';
import './CouponAnalytics.css';

function CouponAnalytics() {
  const navigate = useNavigate();
  const { couponId } = useParams();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState(null);
  const [usage, setUsage] = useState([]);
  const [stats, setStats] = useState({
    totalUses: 0,
    totalDiscount: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    avgDiscount: 0
  });

  useEffect(() => {
    loadData();
  }, [couponId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar info del cupón
      const couponData = await apiRequest(`/api/coupons?storeId=${storeId}`);
      if (couponData.success) {
        const foundCoupon = couponData.coupons.find(c => c.couponId === couponId);
        setCoupon(foundCoupon);
      }

      // Cargar historial de uso
      const usageData = await apiRequest(`/api/coupons/usage?storeId=${storeId}&couponId=${couponId}`);
      if (usageData.success) {
        setUsage(usageData.usage);
        setStats(usageData.stats);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleString('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Cliente', 'Email', 'Orden #', 'Subtotal', 'Descuento', 'Total', 'Estado'];
    const rows = usage.map(u => [
      formatDateTime(u.createdAt),
      u.customerName || '-',
      u.customerEmail || '-',
      u.orderNumber,
      u.subtotal,
      u.discountValue,
      u.total,
      u.paymentStatus
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cupon-${coupon?.code || couponId}-analytics-${new Date().toISOString()}.csv`;
    link.click();
  };

  // Calcular datos para el gráfico simple (últimos 30 días)
  const getChartData = () => {
    const last30Days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last30Days.push({ date: dateStr, uses: 0, revenue: 0 });
    }

    usage.forEach(u => {
      const usageDate = u.orderDate ? new Date(u.orderDate).toISOString().split('T')[0] : null;
      const dayData = last30Days.find(d => d.date === usageDate);
      if (dayData) {
        dayData.uses += 1;
        dayData.revenue += u.total || 0;
      }
    });

    return last30Days;
  };

  const chartData = getChartData();
  const maxUses = Math.max(...chartData.map(d => d.uses), 1);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando analytics...</p>
        </div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="page-container">
        <div className="error-state">
          <p>Cupón no encontrado</p>
          <button className="btn-primary" onClick={() => navigate('/coupons')}>
            Volver a Cupones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/coupons')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>📊 Analytics: {coupon.code}</h1>
            <p>Análisis detallado del uso del cupón</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={exportToCSV} disabled={usage.length === 0}>
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dbeafe' }}>
            <ShoppingCart size={24} style={{ color: '#2563eb' }} />
          </div>
          <div>
            <p className="stat-label">Total de Usos</p>
            <p className="stat-value">{stats.totalUses}</p>
            {coupon.maxUses && (
              <p className="stat-subtitle">de {coupon.maxUses} máximo</p>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7' }}>
            <DollarSign size={24} style={{ color: '#d97706' }} />
          </div>
          <div>
            <p className="stat-label">Descuento Total</p>
            <p className="stat-value">{formatCurrency(stats.totalDiscount)}</p>
            <p className="stat-subtitle">Promedio: {formatCurrency(stats.avgDiscount)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <TrendingUp size={24} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p className="stat-label">Ingresos Generados</p>
            <p className="stat-value">{formatCurrency(stats.totalRevenue)}</p>
            <p className="stat-subtitle">Ticket Promedio: {formatCurrency(stats.avgOrderValue)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3' }}>
            <Users size={24} style={{ color: '#db2777' }} />
          </div>
          <div>
            <p className="stat-label">Conversión</p>
            <p className="stat-value">
              {coupon.maxUses ? `${Math.round((stats.totalUses / coupon.maxUses) * 100)}%` : '-'}
            </p>
            <p className="stat-subtitle">{stats.totalUses} clientes únicos</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-section">
        <div className="section-header">
          <h2>📈 Usos en los últimos 30 días</h2>
        </div>
        <div className="chart-container">
          {chartData.map((day, index) => (
            <div key={index} className="chart-bar-wrapper">
              <div className="chart-bar-container">
                <div 
                  className="chart-bar"
                  style={{ height: `${(day.uses / maxUses) * 100}%` }}
                  title={`${day.uses} usos - ${formatCurrency(day.revenue)}`}
                >
                  {day.uses > 0 && <span className="chart-bar-label">{day.uses}</span>}
                </div>
              </div>
              <span className="chart-bar-date">
                {new Date(day.date).getDate()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Table */}
      <div className="usage-section">
        <div className="section-header">
          <h2>🛍️ Historial de Órdenes ({usage.length})</h2>
        </div>

        {usage.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={48} />
            <h3>Sin usos todavía</h3>
            <p>Este cupón aún no ha sido utilizado</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="usage-table">
              <thead>
                <tr>
                  <th><Calendar size={16} /> Fecha</th>
                  <th><Users size={16} /> Cliente</th>
                  <th><Mail size={16} /> Email</th>
                  <th><Package size={16} /> Orden #</th>
                  <th><DollarSign size={16} /> Subtotal</th>
                  <th><DollarSign size={16} /> Descuento</th>
                  <th><DollarSign size={16} /> Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((item) => (
                  <tr key={item.usageId}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.customerName || '-'}</td>
                    <td className="email-cell">{item.customerEmail || '-'}</td>
                    <td>
                      <span className="order-number">#{item.orderNumber}</span>
                    </td>
                    <td>{formatCurrency(item.subtotal)}</td>
                    <td className="discount-cell">-{formatCurrency(item.discountValue)}</td>
                    <td className="total-cell">{formatCurrency(item.total)}</td>
                    <td>
                      <span className={`status-badge status-${item.paymentStatus}`}>
                        {item.paymentStatus === 'paid' ? 'Pagado' : 
                         item.paymentStatus === 'pending' ? 'Pendiente' : 
                         item.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CouponAnalytics;
