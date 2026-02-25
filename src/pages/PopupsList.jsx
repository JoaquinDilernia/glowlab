import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Settings, BarChart2, Power, Trash2, Eye, Zap, Mail, MousePointer } from 'lucide-react';
import { apiRequest } from '../config';
import './PopupsList.css';

const TYPE_LABELS = {
  modal: { label: 'Modal', icon: '🪟' },
  banner: { label: 'Banner', icon: '📢' },
  slide_in: { label: 'Slide-in', icon: '📌' }
};

const TRIGGER_LABELS = {
  onLoad: 'Al cargar',
  delay: 'Con demora',
  exitIntent: 'Exit intent',
  scroll: 'Al scrollear'
};

function PopupsList() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadPopups();
  }, []);

  const loadPopups = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/popups?storeId=${storeId}`);
      if (data.success) setPopups(data.popups || []);
    } catch (error) {
      console.error('Error cargando popups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (popup) => {
    try {
      setTogglingId(popup.popupId);
      const data = await apiRequest(`/api/popups/${popup.popupId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId })
      });
      if (data.success) {
        setPopups(prev => prev.map(p =>
          p.popupId === popup.popupId ? { ...p, active: data.active } : p
        ));
      }
    } catch (error) {
      console.error('Error toggling popup:', error);
      alert('Error al cambiar estado del popup');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (popup) => {
    if (!window.confirm(`¿Eliminar el popup "${popup.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      setDeletingId(popup.popupId);
      const data = await apiRequest(`/api/popups/${popup.popupId}?storeId=${storeId}`, {
        method: 'DELETE'
      });
      if (data.success) {
        setPopups(prev => prev.filter(p => p.popupId !== popup.popupId));
      }
    } catch (error) {
      console.error('Error eliminando popup:', error);
      alert('Error al eliminar popup');
    } finally {
      setDeletingId(null);
    }
  };

  const getScriptSnippet = () =>
    `<script src="https://apipromonube-jlfopowzaq-uc.a.run.app/api/popup-widget.js?store=${storeId}"></script>`;

  if (loading) {
    return (
      <div className="popups-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando popups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popups-page">
      {/* Header */}
      <header className="popups-header">
        <div className="popups-header-inner">
          <div className="popups-header-top">
            <button className="btn-back-modern" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
              <span>Dashboard</span>
            </button>
            <button className="btn-primary-gradient" onClick={() => navigate('/popups/create')}>
              <Plus size={18} />
              <span>Nuevo Popup</span>
            </button>
          </div>
          <div className="popups-header-info">
            <h1 className="popups-title-gradient">🎯 Pop-ups</h1>
            <p className="popups-subtitle">Capturá emails, mostrá ofertas y aumentá el engagement de tu tienda</p>
          </div>
        </div>
      </header>

      <div className="popups-content">
        {/* Script Install Banner */}
        {popups.length > 0 && (
          <div className="install-notice">
            <div className="install-notice-icon">🔌</div>
            <div className="install-notice-text">
              <strong>Instalar en tu tienda</strong>
              <p>Registrá esta URL como script en el Panel de Socios de TiendaNube:</p>
              <code className="script-url">{getScriptSnippet()}</code>
            </div>
            <button
              className="btn-copy"
              onClick={() => {
                navigator.clipboard.writeText(getScriptSnippet());
                alert('Copiado al portapapeles');
              }}
            >
              Copiar
            </button>
          </div>
        )}

        {popups.length === 0 ? (
          /* Empty State */
          <div className="popups-empty">
            <div className="empty-icon-large">🎯</div>
            <h2>Creá tu primer Pop-up</h2>
            <p>Mostrá ofertas, capturá emails y aumentá tus ventas con pop-ups personalizados</p>

            <div className="popup-types-grid">
              <div className="popup-type-card" onClick={() => navigate('/popups/create?type=modal')}>
                <span className="type-icon">🪟</span>
                <h3>Modal</h3>
                <p>Popup centrado con overlay</p>
              </div>
              <div className="popup-type-card" onClick={() => navigate('/popups/create?type=banner')}>
                <span className="type-icon">📢</span>
                <h3>Banner</h3>
                <p>Barra superior o inferior</p>
              </div>
              <div className="popup-type-card" onClick={() => navigate('/popups/create?type=slide_in')}>
                <span className="type-icon">📌</span>
                <h3>Slide-in</h3>
                <p>Notificación desde el costado</p>
              </div>
            </div>

            <div className="features-showcase">
              <div className="feature-item">
                <Mail size={24} className="feature-icon" />
                <div>
                  <h4>Captura de emails</h4>
                  <p>Formularios integrados para hacer crecer tu lista</p>
                </div>
              </div>
              <div className="feature-item">
                <Zap size={24} className="feature-icon" />
                <div>
                  <h4>Triggers inteligentes</h4>
                  <p>Exit intent, delay, scroll y más</p>
                </div>
              </div>
              <div className="feature-item">
                <MousePointer size={24} className="feature-icon" />
                <div>
                  <h4>Targeting por página</h4>
                  <p>Mostralo solo donde tiene sentido</p>
                </div>
              </div>
              <div className="feature-item">
                <BarChart2 size={24} className="feature-icon" />
                <div>
                  <h4>Analytics en tiempo real</h4>
                  <p>CTR, conversiones y más métricas</p>
                </div>
              </div>
            </div>

            <button className="btn-create-first" onClick={() => navigate('/popups/create')}>
              <Plus size={20} />
              Crear primer popup
            </button>
          </div>
        ) : (
          /* Popups Grid */
          <div className="popups-grid">
            {popups.map(popup => {
              const typeInfo = TYPE_LABELS[popup.type] || TYPE_LABELS.modal;
              const triggerLabel = TRIGGER_LABELS[popup.trigger?.event] || 'Con demora';
              const analytics = popup.analytics || {};
              const views = analytics.views || 0;
              const clicks = analytics.clicks || 0;
              const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';

              return (
                <div key={popup.popupId} className={`popup-card ${popup.active ? 'popup-card--active' : ''}`}>
                  <div className="popup-card-header">
                    <div className="popup-type-badge">
                      <span>{typeInfo.icon}</span>
                      <span>{typeInfo.label}</span>
                    </div>
                    <span className={`popup-status-badge ${popup.active ? 'status-active' : 'status-inactive'}`}>
                      {popup.active ? '● Activo' : '○ Inactivo'}
                    </span>
                  </div>

                  {/* Preview mini del popup */}
                  <div
                    className="popup-preview-mini"
                    style={{
                      '--preview-bg': popup.design?.backgroundColor || '#ffffff',
                      '--preview-accent': popup.design?.accentColor || '#7C7CFF',
                      '--preview-text': popup.design?.textColor || '#1a1a1a'
                    }}
                  >
                    <div className="preview-header-bar" style={{ background: popup.design?.accentColor || '#7C7CFF' }}></div>
                    <div className="preview-body">
                      <div className="preview-title">{popup.content?.title || 'Sin título'}</div>
                      {popup.content?.subtitle && (
                        <div className="preview-subtitle">{popup.content.subtitle}</div>
                      )}
                      <div
                        className="preview-btn"
                        style={{ background: popup.design?.buttonColor || '#7C7CFF', color: popup.design?.buttonTextColor || '#fff' }}
                      >
                        {popup.content?.ctaText || (popup.content?.showEmailField ? popup.content?.emailButtonText : 'Ver más') || 'Ver más'}
                      </div>
                    </div>
                  </div>

                  <div className="popup-card-body">
                    <h3 className="popup-card-name">{popup.name}</h3>
                    <p className="popup-card-trigger">
                      <Zap size={13} />
                      {triggerLabel}
                      {popup.trigger?.delaySeconds > 0 && popup.trigger?.event === 'delay' && (
                        <span> ({popup.trigger.delaySeconds}s)</span>
                      )}
                    </p>

                    <div className="popup-stats">
                      <div className="popup-stat">
                        <Eye size={14} />
                        <span className="stat-val">{views.toLocaleString()}</span>
                        <span className="stat-lbl">Vistas</span>
                      </div>
                      <div className="popup-stat">
                        <MousePointer size={14} />
                        <span className="stat-val">{ctr}%</span>
                        <span className="stat-lbl">CTR</span>
                      </div>
                      <div className="popup-stat">
                        <Mail size={14} />
                        <span className="stat-val">{analytics.emailCaptures || 0}</span>
                        <span className="stat-lbl">Emails</span>
                      </div>
                    </div>
                  </div>

                  <div className="popup-card-actions">
                    <button
                      className="btn-popup-action btn-config"
                      onClick={() => navigate(`/popups/${popup.popupId}/config`)}
                    >
                      <Settings size={15} />
                      Editar
                    </button>
                    <button
                      className={`btn-popup-action btn-toggle ${popup.active ? 'btn-toggle--on' : ''}`}
                      onClick={() => handleToggle(popup)}
                      disabled={togglingId === popup.popupId}
                    >
                      <Power size={15} />
                      {togglingId === popup.popupId ? '...' : (popup.active ? 'Desactivar' : 'Activar')}
                    </button>
                    <button
                      className="btn-popup-action btn-delete"
                      onClick={() => handleDelete(popup)}
                      disabled={deletingId === popup.popupId}
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PopupsList;
