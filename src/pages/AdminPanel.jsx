import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Package, TrendingUp, Search, LogOut, ArrowLeft, Sparkles, Lock, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { apiRequest } from '../config';
import './AdminPanel.css';

function AdminPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stores, setStores] = useState([]);
  const [uninstalls, setUninstalls] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('stores');
  const [processingStore, setProcessingStore] = useState(null);

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
      alert('❌ Clave incorrecta');
    }
  };

  const loadStores = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/admin/stores');
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
      const response = await apiRequest('/api/admin/uninstalls');
      if (response.success) {
        setUninstalls(response.uninstalls);
      }
    } catch (error) {
      console.error('Error loading uninstalls:', error);
    }
  };

  const activateDemo = async (storeId, days = 30) => {
    if (!confirm(`¿Activar demo de ${days} días para store ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await fetch('https://apipromonube-jlfopowzaq-uc.a.run.app/api/admin/activate-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          storeId,
          expirationDays: parseInt(days)
        })
      }).then(r => r.json());

      if (response.success) {
        alert(`✅ Demo activada hasta ${new Date(response.expiresAt).toLocaleDateString()}`);
        loadStores();
      } else {
        alert('❌ Error: ' + response.message);
      }
    } catch (error) {
      alert('❌ Error activando demo');
    } finally {
      setProcessingStore(null);
    }
  };

  const deactivateDemo = async (storeId) => {
    if (!confirm(`¿Desactivar demo para store ${storeId}?`)) return;

    setProcessingStore(storeId);
    try {
      const response = await apiRequest('/api/admin/deactivate-plan', {
        method: 'POST',
        body: JSON.stringify({ storeId })
      });

      if (response.success) {
        alert('✅ Demo desactivada');
        loadStores();
      } else {
        alert('❌ Error: ' + response.error);
      }
    } catch (error) {
      alert('❌ Error desactivando demo');
    } finally {
      setProcessingStore(null);
    }
  };

  const filteredStores = stores.filter(store => 
    store.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.storeId?.toString().includes(searchTerm)
  );

  const stats = {
    totalStores: stores.length,
    activeStores: stores.filter(s => s.subscription?.status === 'active' || s.subscription?.status === 'demo').length,
    demoAccounts: stores.filter(s => s.subscription?.isDemoAccount).length,
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
            <span className="stat-value">{stats.demoAccounts}</span>
            <span className="stat-label">Cuentas DEMO</span>
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
                const isDemo = sub.isDemoAccount;
                const isActive = sub.status === 'active' || sub.status === 'demo';
                const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
                const isExpired = expiresAt && expiresAt < new Date();
                const modules = sub.modules || {};

                return (
                  <tr key={store.storeId} className={isDemo ? 'demo-row' : ''}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="store-id">{store.storeId}</td>
                    <td>
                      <span className={`plan-badge ${sub.plan || 'free'}`}>
                        {isDemo ? '👑 DEMO' : sub.plan === 'pro' ? '⚡ PRO' : '📦 FREE'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${isActive && !isExpired ? 'active' : 'inactive'}`}>
                        {isExpired ? '❌ Expirado' : isActive ? '✅ Activo' : '⏸️ Inactivo'}
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
                    <td className={isExpired ? 'expired-date' : ''}>
                      {expiresAt ? expiresAt.toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {!isDemo ? (
                          <select
                            onChange={(e) => {
                              const days = parseInt(e.target.value);
                              if (days) activateDemo(store.storeId, days);
                              e.target.value = '';
                            }}
                            disabled={processingStore === store.storeId}
                            className="action-select"
                          >
                            <option value="">Activar Demo...</option>
                            <option value="7">7 días</option>
                            <option value="15">15 días</option>
                            <option value="30">30 días</option>
                            <option value="60">60 días</option>
                            <option value="90">90 días</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => deactivateDemo(store.storeId)}
                            disabled={processingStore === store.storeId}
                            className="btn-deactivate-small"
                          >
                            Desactivar
                          </button>
                        )}
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
