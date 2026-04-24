import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Tag, Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './BadgesList.css';

function BadgesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    loadBadges();
  }, [location]); // Recargar cuando cambia la ubicación

  const loadBadges = async () => {
    setLoading(true);
    try {
      console.log('🔍 Cargando badges para storeId:', storeId);
      const data = await apiRequest(`/api/badges?storeId=${storeId}`);
      console.log('📦 Badges recibidos:', data);
      console.log('📊 Es array?', Array.isArray(data));
      console.log('📏 Cantidad:', data?.length);
      
      const badgesArray = Array.isArray(data) ? data : [];
      const normalizedBadges = badgesArray.map((badge) => {
        const design = badge.design || {};
        const ruleConfig = badge.ruleConfig || {};
        const ruleType = badge.rule?.type || badge.ruleType || badge.type;
        const rule = badge.rule || (ruleType ? {
          type: ruleType,
          days: ruleConfig.daysToShowAsNew,
          productIds: ruleConfig.productIds,
          minPrice: ruleConfig.minPrice,
          maxPrice: ruleConfig.maxPrice,
          minDiscount: ruleConfig.minDiscount,
          maxStock: ruleConfig.maxStock,
          categoryName: ruleConfig.categoryName,
          categoryId: Array.isArray(ruleConfig.categoryIds) ? ruleConfig.categoryIds[0] : ruleConfig.categoryId,
          tags: ruleConfig.tags
        } : null);

        return {
          ...badge,
          badgeId: badge.badgeId || badge.id || badge._id,
          name: badge.name || badge.badgeName,
          badgeText: badge.badgeText || badge.text,
          backgroundColor: badge.backgroundColor || design.backgroundColor,
          textColor: badge.textColor || design.textColor,
          badgeShape: badge.badgeShape || design.shape || badge.shape,
          enabled: typeof badge.enabled === 'boolean' ? badge.enabled : (badge.isActive ?? true),
          rule
        };
      });

      console.log('✅ Setting badges:', normalizedBadges);
      
      setBadges(normalizedBadges);
      
      console.log('🎯 Badges después de setBadges:', badgesArray.length);
    } catch (error) {
      console.error('❌ Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteBadge = async (badgeId) => {
    if (!window.confirm('¿Eliminar este badge?')) return;
    
    try {
      const data = await apiRequest(`/api/badges/${badgeId}?storeId=${storeId}`, {
        method: 'DELETE'
      });

      if (data.success) {
        setBadges(prev => prev.filter(b => b.badgeId !== badgeId));
        toast.success('Badge eliminado');
      } else {
        toast.error('Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    }
  };

  const toggleStatus = async (badgeId) => {
    try {
      const data = await apiRequest(`/api/badges/${badgeId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        setBadges(prev => prev.map(b => 
          b.badgeId === badgeId ? { ...b, enabled: data.enabled } : b
        ));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getRuleTypeLabel = (rule) => {
    if (!rule || !rule.type) {
      return '⚠️ Regla no definida';
    }
    
    switch(rule.type) {
      case 'new_products':
        return `🆕 Productos nuevos (${rule.days || 30} días)`;
      case 'manual':
        return `✋ Manual (${rule.productIds?.length || 0} productos)`;
      case 'price_min':
        return `💰 Precio > $${rule.minPrice || 0}`;
      case 'price_max':
        return `💸 Precio < $${rule.maxPrice || 0}`;
      case 'discount':
        return `%️ Descuento > ${rule.minDiscount || 0}%`;
      case 'stock_low':
        return `📦 Stock bajo (≤ ${rule.maxStock || 10} unidades)`;
      case 'category':
        return `📂 Categoría: ${rule.categoryName || rule.categoryId || 'Sin nombre'}`;
      case 'tags':
        return `🏷️ Tags: ${rule.tags?.join(', ') || 'Sin tags'}`;
      default:
        return `❓ ${rule.type}`;
    }
  };

  if (loading) {
    console.log('⏳ Loading...');
    return (
      <div className="badges-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando badges...</p>
        </div>
      </div>
    );
  }

  console.log('🎨 Rendering with badges:', badges);
  console.log('🔢 badges.length:', badges.length);
  console.log('❓ badges.length === 0?', badges.length === 0);

  return (
    <div className="badges-container">
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-primary-gradient" onClick={() => navigate('/badges/create')}>
              <Plus size={18} />
              <span>Nuevo Badge</span>
            </button>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">🏷️ Badges en Productos</h1>
            <p className="page-subtitle-modern">Destaca productos con etiquetas personalizadas y reglas automáticas</p>
          </div>
        </div>
      </header>

      {badges.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-icon-large">🏷️</div>
          <h2 className="empty-title">Crea Tu Primer Badge</h2>
          <p className="empty-description">Etiquetas visuales automáticas en tus productos: Nuevo, Descuento, Últimas unidades y más</p>

          <div className="em-badges-grid">
            {[{em:'🆕',t:'Productos Nuevos',d:'Días desde creación'},{em:'✋',t:'Selección Manual',d:'Elegí productos específicos'},{em:'💰',t:'Rango de Precio',d:'Mayor o menor a $X'},{em:'%',t:'Descuentos',d:'Descuento mínimo %'},{em:'📦',t:'Stock Bajo',d:'Últimas unidades'},{em:'📂',t:'Por Categoría',d:'Toda una categoría'}].map(r => (
              <div key={r.t} className="em-rule-card">
                <span className="em-rule-icon">{r.em}</span>
                <strong>{r.t}</strong>
                <p>{r.d}</p>
              </div>
            ))}
          </div>

          <div className="em-tip-box">
            <strong>✨ Múltiples badges simultáneos</strong>
            <p>Podés tener varios badges activos con diferentes reglas. Cada producto muestra solo los que aplican.</p>
          </div>

          <button className="btn-primary-large" onClick={() => navigate('/badges/create')} style={{marginTop: '28px'}}>
            <Plus size={20} />
            Crear Mi Primer Badge
          </button>
        </div>
      ) : (
        <div className="badges-grid-modern">
          {badges.filter(badge => {
            const hasId = badge && (badge.badgeId || badge.id || badge._id);
            console.log('🔍 Filtrando badge:', badge, 'hasId:', hasId);
            return hasId;
          }).map((badge, idx) => {
            const badgeId = badge.badgeId || badge.id || badge._id;
            console.log('🎨 Renderizando badge:', badgeId, badge);
            return (
            <div key={badgeId || idx} className="badge-card-modern">
              <div className="badge-card-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <div 
                    className="badge-preview-mini"
                    style={{
                      background: badge.backgroundColor || '#ff4757',
                      color: badge.textColor || '#ffffff',
                      padding: '6px 12px',
                      borderRadius: badge.badgeShape === 'rounded' ? '20px' : badge.badgeShape === 'circular' ? '50%' : '4px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}
                  >
                    {badge.badgeText || 'BADGE'}
                  </div>
                  <div>
                    <h3 className="badge-title">{badge.name || 'Sin nombre'}</h3>
                    <p className="badge-subtitle">{getRuleTypeLabel(badge.rule)}</p>
                  </div>
                </div>
                <button 
                  className={`toggle-btn-mini ${badge.enabled ? 'active' : ''}`}
                  onClick={() => toggleStatus(badgeId)}
                  title={badge.enabled ? 'Desactivar' : 'Activar'}
                >
                  {badge.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>

              <div className="badge-actions">
                <button 
                  className="btn-secondary-small"
                  onClick={() => navigate(`/badges/${badgeId}/config`)}
                >
                  <Settings size={16} />
                  Configurar
                </button>
                <button 
                  className="btn-danger-small"
                  onClick={() => deleteBadge(badgeId)}
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BadgesList;
