import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Tag, Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../config';
import './BadgesList.css';

function BadgesList() {
  const navigate = useNavigate();
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
      console.log('✅ Setting badges:', badgesArray);
      
      setBadges(badgesArray);
      
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
        alert('✅ Badge eliminado');
      } else {
        alert('❌ Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al eliminar');
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
            <button className="btn-back-modern" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
              <span>Dashboard</span>
            </button>
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
          <p className="empty-description">Destaca productos con etiquetas visuales según múltiples reglas y criterios</p>

          <div style={{
            marginTop: '40px',
            padding: '30px',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderRadius: '20px',
            border: '2px solid #bae6fd',
            maxWidth: '700px',
            margin: '40px auto'
          }}>
            <h4 style={{fontSize: '18px', fontWeight: '700', color: '#0369a1', marginBottom: '20px', textAlign: 'center'}}>
              💡 Tipos de Reglas Disponibles
            </h4>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px'}}>
              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>🆕</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Productos Nuevos</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Días desde creación</p>
              </div>
              
              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>✋</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Selección Manual</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Elige productos específicos</p>
              </div>

              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>💰</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Rango de Precio</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Mayor/menor a precio X</p>
              </div>

              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>%</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Descuentos</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Descuento mínimo %</p>
              </div>

              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>📦</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Stock Bajo</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Últimas unidades</p>
              </div>

              <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #7dd3fc'}}>
                <div style={{fontSize: '28px', marginBottom: '8px'}}>📂</div>
                <strong style={{color: '#0369a1', fontSize: '14px'}}>Por Categoría</strong>
                <p style={{margin: '6px 0 0 0', fontSize: '13px', color: '#075985'}}>Toda una categoría</p>
              </div>
            </div>

            <div style={{marginTop: '24px', padding: '16px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fbbf24'}}>
              <strong style={{color: '#92400e', fontSize: '14px'}}>✨ Múltiples badges simultáneos</strong>
              <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#78350f'}}>
                Puedes tener varios badges activos con diferentes reglas. Cada producto mostrará todos los badges que cumplan con sus criterios.
              </p>
            </div>
          </div>

          <button 
            className="btn-primary-large" 
            onClick={() => navigate('/badges/create')}
            style={{marginTop: '30px'}}
          >
            <Plus size={20} />
            Crear Mi Primer Badge
          </button>
        </div>
      ) : (
        <div className="badges-grid-modern">
          {badges.filter(badge => {
            const hasId = badge && (badge.badgeId || badge.id);
            console.log('🔍 Filtrando badge:', badge, 'hasId:', hasId);
            return hasId;
          }).map((badge, idx) => {
            const badgeId = badge.badgeId || badge.id;
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
