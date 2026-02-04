import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Tag, Calendar, MapPin, Package, Percent, Layers, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../config';
import './BadgesList.css';

function BadgesList() {
  const navigate = useNavigate();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const data = await apiRequest(`/api/badges?storeId=${storeId}`);
      setBadges(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBadge = (ruleType) => {
    navigate(`/badges/new?type=${ruleType}`);
  };

  const toggleBadgeStatus = async (badgeId, currentStatus) => {
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      await apiRequest(`/api/badges/${badgeId}/toggle`, {
        method: 'POST',
        body: { storeId, isActive: !currentStatus }
      });
      loadBadges();
    } catch (error) {
      console.error('Error toggling badge:', error);
      alert('Error al cambiar el estado del badge');
    }
  };

  const deleteBadge = async (badgeId) => {
    if (!confirm('¿Estás seguro de eliminar este badge?')) return;
    
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      await apiRequest(`/api/badges/${badgeId}?storeId=${storeId}`, {
        method: 'DELETE'
      });
      loadBadges();
    } catch (error) {
      console.error('Error eliminando badge:', error);
      alert('Error al eliminar el badge');
    }
  };

  const ruleTypes = [
    {
      id: 'new_products',
      icon: Package,
      iconEmoji: '🆕',
      title: 'Productos Nuevos',
      description: 'Días desde creación',
      color: '#3B82F6'
    },
    {
      id: 'manual',
      icon: Tag,
      iconEmoji: '✋',
      title: 'Selección Manual',
      description: 'Elige productos específicos',
      color: '#8B5CF6'
    },
    {
      id: 'price_range',
      icon: MapPin,
      iconEmoji: '💰',
      title: 'Rango de Precio',
      description: 'Mayor/menor a precio X',
      color: '#F59E0B'
    },
    {
      id: 'discount',
      icon: Percent,
      iconEmoji: '%',
      title: 'Descuentos',
      description: 'Descuento mínimo %',
      color: '#EF4444'
    },
    {
      id: 'stock',
      icon: Layers,
      iconEmoji: '📦',
      title: 'Stock Bajo',
      description: 'Últimas unidades',
      color: '#EC4899'
    },
    {
      id: 'category',
      icon: Calendar,
      iconEmoji: '📁',
      title: 'Por Categoría',
      description: 'Productos de categoría X',
      color: '#10B981'
    }
  ];

  const getRuleIcon = (ruleType) => {
    const rule = ruleTypes.find(r => r.id === ruleType);
    return rule ? rule.icon : Tag;
  };

  const getRuleColor = (ruleType) => {
    const rule = ruleTypes.find(r => r.id === ruleType);
    return rule ? rule.color : '#6B7280';
  };

  if (loading) {
    return (
      <div className="badges-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando badges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="badges-page">
      <header className="badges-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} />
          Dashboard
        </button>
        <div className="header-content">
          <div className="header-title">
            <Tag size={32} className="header-icon" />
            <div>
              <h1>Badges en Productos</h1>
              <p>Destaca productos con etiquetas personalizadas y reglas automáticas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="badges-main">
        {/* Rule Types Grid */}
        <section className="rule-types-section">
          <div className="section-header">
            <div className="section-icon">⚡</div>
            <h2>Tipos de Reglas Disponibles</h2>
          </div>
          <div className="rule-types-grid">
            {ruleTypes.map((rule) => {
              const Icon = rule.icon;
              return (
                <div
                  key={rule.id}
                  className="rule-type-card"
                  onClick={() => handleCreateBadge(rule.id)}
                  style={{ '--rule-color': rule.color }}
                >
                  <div className="rule-type-icon">
                    <span className="icon-emoji">{rule.iconEmoji}</span>
                  </div>
                  <h3>{rule.title}</h3>
                  <p>{rule.description}</p>
                  <button className="btn-create-badge">
                    <Plus size={16} />
                    Crear Badge
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Active Badges List */}
        {badges.length > 0 && (
          <section className="badges-list-section">
            <h2>Tus Badges ({badges.length})</h2>
            <div className="badges-grid">
              {badges.map((badge) => {
                const Icon = getRuleIcon(badge.ruleType);
                const color = getRuleColor(badge.ruleType);
                
                return (
                  <div key={badge.id || badge.badgeId} className="badge-card">
                    <div className="badge-card-header">
                      <div className="badge-preview" style={{
                        backgroundColor: badge.design?.backgroundColor || badge.backgroundColor || '#FF6B6B',
                        color: badge.design?.textColor || badge.textColor || '#FFFFFF',
                        borderRadius: `${badge.design?.borderRadius || badge.borderRadius || 4}px`
                      }}>
                        {badge.design?.showIcon && <span>{badge.design?.icon}</span>}
                        {badge.badgeText || badge.text}
                      </div>
                      <button
                        className={`btn-toggle ${(badge.isActive || badge.enabled) ? 'active' : 'inactive'}`}
                        onClick={() => toggleBadgeStatus(badge.id || badge.badgeId, badge.isActive || badge.enabled)}
                        title={(badge.isActive || badge.enabled) ? 'Desactivar' : 'Activar'}
                      >
                        {(badge.isActive || badge.enabled) ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>

                    <div className="badge-card-body">
                      <h3>{badge.badgeName || badge.name}</h3>
                      <div className="badge-meta">
                        <div className="meta-item" style={{ color }}>
                          <Icon size={16} />
                          <span>{ruleTypes.find(r => r.id === badge.ruleType)?.title}</span>
                        </div>
                        <div className="meta-item">
                          <MapPin size={14} />
                          <span>{(badge.design?.position || badge.position || 'top-right').replace(/-/g, ' ')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="badge-card-footer">
                      <button
                        className="btn-edit"
                        onClick={() => navigate(`/badges/${badge.id || badge.badgeId}/edit`)}
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => deleteBadge(badge.id || badge.badgeId)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {badges.length === 0 && (
          <div className="empty-state">
            <Tag size={64} className="empty-icon" />
            <h2>Crea Tu Primer Badge</h2>
            <p>Destaca productos con etiquetas visuales según múltiples reglas y criterios</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default BadgesList;
