import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './AdminPanel.css';

function AdminPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stores, setStores] = useState([]);
  const [uninstalls, setUninstalls] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('stores');
  const [processingStore, setProcessingStore] = useState(null);
  const [quickStoreId, setQuickStoreId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadStores();
      loadUninstalls();
    }
  }, [isAuthenticated]);

  const handleAuth = (e) => {
    e.preventDefault();
    if (adminKey === 'PromoNube2026Admin!SecretKey') {
      setIsAuthenticated(true);
    } else {
      toast.error('Clave incorrecta');
    }
  };

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/admin/stores', {
        headers: { 'x-admin-key': adminKey }
      });
      if (response.success) {
        setStores(response.stores);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUninstalls = async () => {
    try {
      const response = await apiRequest('/api/admin/uninstalls', {
        headers: { 'x-admin-key': adminKey }
      });
      if (response.success) {
        setUninstalls(response.uninstalls);
      }
    } catch (error) {
      console.error('Error loading uninstalls:', error);
    }
  };

  const setFreeForever = async (storeId, freeForever) => {
    const verb = freeForever ? 'marcar como gratis permanente' : 'quitar el estado de gratis permanente de';
    if (!confirm(`¿Confirmás ${verb} la tienda ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/set-free-forever', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ storeId, freeForever })
      });

      if (response.success) {
        toast.success(response.message);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error actualizando la tienda');
    } finally {
      setProcessingStore(null);
    }
  };

  const grantCourtesyMonth = async (storeId) => {
    if (!confirm(`¿Dar un mes de cortesía a la tienda ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/grant-courtesy-month', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify({ storeId })
      });

      if (response.success) {
        toast.success(`Cortesía otorgada hasta ${new Date(response.courtesyUntil).toLocaleDateString()}`);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error otorgando cortesía');
    } finally {
      setProcessingStore(null);
    }
  };

  const resetAllTrials = async () => {
    if (!confirm('Esto reinicia TODAS las tiendas a un trial de 7 días, incluidas las que ya pagaban. Es para usar UNA SOLA VEZ al desplegar el nuevo sistema de pagos. ¿Confirmás?')) return;

    setLoading(true);
    try {
      const response = await apiRequest('/api/admin/reset-all-trials', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });

      if (response.success) {
        toast.success(`${response.processed} tiendas reiniciadas a trial de 7 días`);
        loadStores();
      } else {
        toast.error('Error: ' + response.error);
      }
    } catch (error) {
      toast.error('Error reiniciando trials');
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter(store =>
    store.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.storeId?.toString().includes(searchTerm)
  );

  const stats = {
    totalStores: stores.length,
    activeStores: stores.filter(s => s.subscription?.status === 'active').length,
    freeForeverStores: stores.filter(s => s.subscription?.freeForever).length,
    uninstalls: uninstalls.length
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <Shield size={64} className="login-icon" />
          <h1>Panel de Administración</h1>
          <p>PromoNube Control Center</p>

          <form onSubmit={handleAuth} className="login-form">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Clave de administrador"
              required
              autoFocus
            />
            <button type="submit">Acceder</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
            Volver al Dashboard
          </button>
          <h1>Panel de Administración</h1>
        </div>
        <div className="header-right">
          <button className="btn-logout" onClick={() => setIsAuthenticated(false)}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users">
            <Users size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalStores}</span>
            <span className="stat-label">Tiendas Totales</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <CheckCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.activeStores}</span>
            <span className="stat-label">Suscripciones Activas</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon demo">
            <Sparkles size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.freeForeverStores}</span>
            <span className="stat-label">Gratis Permanente</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon expired">
            <XCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.uninstalls}</span>
            <span className="stat-label">Desinstalaciones</span>
          </div>
        </div>
      </div>

      {/* Quick Actions - Gratis permanente / Mes de cortesía */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.15) 100%)',
        border: '1px solid rgba(102,126,234,0.35)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <Sparkles size={18} color="#667eea" />
        <strong style={{color:'rgba(255,255,255,0.9)', fontSize:'14px', whiteSpace:'nowrap'}}>Acción rápida:</strong>
        <input
          type="text"
          placeholder="Store ID (ej: 5320806)"
          value={quickStoreId}
          onChange={e => setQuickStoreId(e.target.value)}
          style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(102,126,234,0.4)', background:'rgba(255,255,255,0.08)', color:'#fff', width:'180px', outline:'none'}}
        />
        <button
          onClick={() => { if (quickStoreId) setFreeForever(quickStoreId, true); }}
          disabled={!quickStoreId || processingStore === quickStoreId}
          style={{padding:'8px 20px', borderRadius:'8px', background:'linear-gradient(135deg,#10B981,#059669)', color:'#fff', border:'none', cursor:'pointer', fontWeight:'600', opacity: !quickStoreId ? 0.5 : 1}}
        >
          💚 Gratis permanente
        </button>
        <button
          onClick={() => { if (quickStoreId) grantCourtesyMonth(quickStoreId); }}
          disabled={!quickStoreId || processingStore === quickStoreId}
          style={{padding:'8px 20px', borderRadius:'8px', background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', border:'none', cursor:'pointer', fontWeight:'600', opacity: !quickStoreId ? 0.5 : 1}}
        >
          🎉 Mes de cortesía
        </button>
        <button
          onClick={resetAllTrials}
          disabled={loading}
          style={{padding:'8px 20px', borderRadius:'8px', background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.4)', cursor:'pointer', fontWeight:'600', marginLeft:'auto'}}
          title="Uso único al desplegar el nuevo sistema de pagos"
        >
          ⚠️ Resetear todas a trial (7 días)
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          <Package size={18} />
          Tiendas ({stores.length})
        </button>
        <button
          className={`tab ${activeTab === 'uninstalls' ? 'active' : ''}`}
          onClick={() => setActiveTab('uninstalls')}
        >
          <XCircle size={18} />
          Desinstalaciones ({uninstalls.length})
        </button>
      </div>

      {/* Search */}
      <div className="search-container">
        <Search size={20} />
        <input
          type="text"
          placeholder={activeTab === 'stores' ? "Buscar por nombre o Store ID..." : "Buscar desinstalaciones..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Stores Table */}
      {activeTab === 'stores' && (loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando tiendas...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TIENDA</th>
                <th>STORE ID</th>
                <th>PLAN</th>
                <th>ESTADO</th>
                <th>MÓDULOS</th>
                <th>FECHA ACTIVACIÓN</th>
                <th>EXPIRA</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store) => {
                const sub = store.subscription || {};
                const courtesyUntilDate = sub.courtesyUntil ? new Date(sub.courtesyUntil) : null;
                const isCourtesyActive = !!(courtesyUntilDate && !isNaN(courtesyUntilDate) && courtesyUntilDate > new Date());
                const statusLabel = isCourtesyActive ? '🎉 Cortesía' : ({
                  active: '⚡ Activo',
                  trialing: '🎁 Trial',
                  blocked: '❌ Bloqueado',
                  past_due: '⚠️ Pago pendiente'
                }[sub.status] || sub.status || '-');
                const modules = sub.modules || {};
                const untilDate = isCourtesyActive ? sub.courtesyUntil
                  : sub.status === 'trialing' ? sub.trialEndsAt
                  : sub.currentPeriodEnd;

                return (
                  <tr key={store.storeId} className={sub.freeForever ? 'demo-row' : ''}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="store-id">{store.storeId}</td>
                    <td>
                      <span className={`plan-badge ${sub.freeForever ? 'pro' : 'free'}`}>
                        {sub.freeForever ? '💚 GRATIS' : statusLabel}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${sub.freeForever || isCourtesyActive || sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'inactive'}`}>
                        {sub.freeForever ? '✅ Gratis permanente' : statusLabel}
                      </span>
                    </td>
                    <td className="modules-cell">
                      <div className="modules-list">
                        {modules.coupons && <span className="module-tag">coupons</span>}
                        {modules.giftcards && <span className="module-tag">giftcards</span>}
                        {modules.spinWheel && <span className="module-tag">spinWheel</span>}
                        {modules.countdown && <span className="module-tag">countdown</span>}
                        {modules.style && <span className="module-tag">style</span>}
                      </div>
                    </td>
                    <td>
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('es-AR') : '-'}
                    </td>
                    <td>
                      {untilDate ? new Date(untilDate).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {!sub.freeForever ? (
                          <button
                            onClick={() => setFreeForever(store.storeId, true)}
                            disabled={processingStore === store.storeId}
                            className="action-select"
                          >
                            💚 Marcar gratis
                          </button>
                        ) : (
                          <button
                            onClick={() => setFreeForever(store.storeId, false)}
                            disabled={processingStore === store.storeId}
                            className="btn-deactivate-small"
                          >
                            Quitar gratis
                          </button>
                        )}
                        <button
                          onClick={() => grantCourtesyMonth(store.storeId)}
                          disabled={processingStore === store.storeId}
                          className="action-select"
                        >
                          🎉 Cortesía
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredStores.length === 0 && (
            <div className="empty-state">
              <Package size={48} />
              <p>No se encontraron tiendas</p>
            </div>
          )}
        </div>
      ))}

      {/* Uninstalls Table */}
      {activeTab === 'uninstalls' && (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>TIENDA</th>
                <th>PAÍS</th>
                <th>FECHA DESINSTALACIÓN</th>
                <th>MOTIVO</th>
                <th>DETALLE DE LA JUSTIFICACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {uninstalls
                .filter(u =>
                  u.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  u.storeId?.toString().includes(searchTerm)
                )
                .map((uninstall, idx) => (
                  <tr key={idx}>
                    <td className="store-name">
                      {uninstall.storeName}
                      <br />
                      <small style={{color: '#999'}}>ID: {uninstall.storeId}</small>
                    </td>
                    <td>{uninstall.country || '-'}</td>
                    <td>
                      {uninstall.uninstalledAt ?
                        new Date(uninstall.uninstalledAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit'
                        }) : '-'}
                    </td>
                    <td>{uninstall.reason || 'No especificado'}</td>
                    <td style={{maxWidth: '300px', fontSize: '0.9em', color: '#666'}}>
                      {uninstall.reasonDetail || '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {uninstalls.length === 0 && (
            <div className="empty-state">
              <XCircle size={48} />
              <p>No hay desinstalaciones registradas</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
