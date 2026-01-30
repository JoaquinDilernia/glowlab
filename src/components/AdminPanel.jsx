import { useState, useEffect } from 'react';
import { Shield, UserPlus, UserMinus, Calendar, Sparkles, Lock, Unlock, CheckCircle, XCircle } from 'lucide-react';
import './AdminPanel.css';

function AdminPanel() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [expirationDays, setExpirationDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recentActions, setRecentActions] = useState([]);

  // Cargar el storeId actual de localStorage automáticamente
  useEffect(() => {
    const currentStoreId = localStorage.getItem('promonube_store_id');
    if (currentStoreId) {
      setStoreId(currentStoreId);
    }
  }, []);

  const handleAuth = (e) => {
    e.preventDefault();
    if (adminKey === 'PromoNube2026Admin!SecretKey') {
      setIsAuthenticated(true);
      setMessage({ type: 'success', text: '✅ Acceso concedido' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } else {
      setMessage({ type: 'error', text: '❌ Clave incorrecta' });
    }
  };

  const activateDemo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/admin/activate-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          storeId,
          expirationDays: parseInt(expirationDays)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al activar demo');
      }

      const expirationDate = new Date(data.expiresAt);
      setMessage({ 
        type: 'success', 
        text: `🎉 Demo activada para ${storeId} por ${expirationDays} días (hasta ${expirationDate.toLocaleDateString()})`
      });
      
      // Agregar a acciones recientes
      setRecentActions(prev => [{
        action: 'Activación',
        storeId,
        days: expirationDays,
        date: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 4)]);

      // Recargar la página después de 2 segundos para actualizar el estado
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: `❌ ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const deactivateDemo = async (e) => {
    e.preventDefault();
    if (!confirm(`⚠️ ¿Desactivar cuenta demo para store ${storeId}?`)) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/admin/deactivate-demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ storeId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al desactivar demo');
      }

      setMessage({ type: 'success', text: `✅ Demo desactivada para ${storeId}` });
      
      // Agregar a acciones recientes
      setRecentActions(prev => [{
        action: 'Desactivación',
        storeId,
        date: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 4)]);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: `❌ ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Presets rápidos para días comunes
  const dayPresets = [7, 15, 30, 60, 90];

  if (!isAuthenticated) {
    return (
      <div className="admin-panel-modern">
        <div className="admin-auth-card">
          <div className="auth-icon-wrapper">
            <Shield size={56} strokeWidth={2} />
          </div>
          <h1>Panel de Administración</h1>
          <p className="auth-subtitle">PromoNube Control Center</p>
          
          <form onSubmit={handleAuth} className="admin-auth-form">
            <div className="form-group-modern">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Ingresa la clave secreta"
                required
                autoFocus
              />
            </div>
            
            <button type="submit" className="btn-auth">
              <Unlock size={18} />
              Acceder
            </button>
            
            {message.text && (
              <div className={`alert-message ${message.type}`}>
                {message.text}
              </div>
            )}
          </form>

          <div className="auth-hint">
            <span>💡 Tip: La clave está en las variables de entorno</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel-modern authenticated">
      <div className="admin-header-modern">
        <div className="header-left">
          <div className="shield-badge">
            <Shield size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1>Control Center</h1>
            <p>Gestión de cuentas DEMO</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setIsAuthenticated(false);
            setAdminKey('');
          }}
          className="btn-logout-modern"
        >
          <XCircle size={18} />
          Salir
        </button>
      </div>

      {/* Mensaje Global */}
      {message.text && (
        <div className={`global-alert ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="admin-grid">
        {/* Activar Demo - Card Principal */}
        <div className="admin-card primary">
          <div className="card-header">
            <div className="card-icon activate">
              <Sparkles size={24} />
            </div>
            <div>
              <h2>Activar Demo</h2>
              <p>Otorga acceso completo temporal</p>
            </div>
          </div>
          
          <form onSubmit={activateDemo} className="card-form">
            <div className="form-group-modern">
              <label>Store ID</label>
              <input
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="Ejemplo: 1201022"
                required
                className="input-modern"
              />
              <small>ID de la tienda TiendaNube</small>
            </div>
            
            <div className="form-group-modern">
              <label>Duración (días)</label>
              <input
                type="number"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
                min="1"
                max="365"
                required
                className="input-modern"
              />
              
              {/* Presets rápidos */}
              <div className="day-presets">
                {dayPresets.map(days => (
                  <button
                    key={days}
                    type="button"
                    className={`preset-btn ${expirationDays === String(days) ? 'active' : ''}`}
                    onClick={() => setExpirationDays(String(days))}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn-activate"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Activando...
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  Activar Cuenta Demo
                </>
              )}
            </button>
          </form>
        </div>

        {/* Desactivar Demo */}
        <div className="admin-card danger">
          <div className="card-header">
            <div className="card-icon deactivate">
              <Lock size={24} />
            </div>
            <div>
              <h2>Desactivar Demo</h2>
              <p>Revoca el acceso temporal</p>
            </div>
          </div>
          
          <form onSubmit={deactivateDemo} className="card-form">
            <div className="form-group-modern">
              <label>Store ID</label>
              <input
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="Ejemplo: 1201022"
                required
                className="input-modern"
              />
            </div>
            
            <button 
              type="submit" 
              className="btn-deactivate"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <UserMinus size={20} />
                  Desactivar Demo
                </>
              )}
            </button>
          </form>
        </div>

        {/* Acciones Recientes */}
        {recentActions.length > 0 && (
          <div className="admin-card recent">
            <div className="card-header">
              <div className="card-icon recent">
                <Calendar size={24} />
              </div>
              <div>
                <h2>Acciones Recientes</h2>
                <p>Últimas {recentActions.length} operaciones</p>
              </div>
            </div>
            
            <div className="recent-list">
              {recentActions.map((action, idx) => (
                <div key={idx} className="recent-item">
                  <div className="recent-action">
                    {action.action === 'Activación' ? '✅' : '❌'} {action.action}
                  </div>
                  <div className="recent-details">
                    <strong>Store {action.storeId}</strong>
                    {action.days && <span> • {action.days} días</span>}
                    <span className="recent-time">{action.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="admin-card info">
          <div className="info-content">
            <Sparkles size={20} />
            <div>
              <strong>Cuentas DEMO</strong>
              <p>Acceso completo a todos los módulos durante el período especificado. Se desactivan automáticamente al vencer.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
