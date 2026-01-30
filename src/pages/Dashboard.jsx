import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogOut, Tag, CreditCard, Sparkles, Clock, Palette, Lock, Settings, Shield, BadgeCheck } from 'lucide-react';
import { apiRequest } from '../config';
import { useSubscription } from '../hooks/useSubscription';
import UpgradeModal from '../components/UpgradeModal';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AdminPanel from '../components/AdminPanel';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { subscription, modules, hasAccess, changePlan, reload } = useSubscription();
  
  // Verificar acceso a cada módulo
  const isModuleBlocked = (moduleName) => {
    if (!subscription) return true;
    // Plan PRO tiene acceso a todo
    if (subscription.plan === 'pro') return false;
    // Cuentas DEMO tienen acceso completo
    if (subscription.isDemoAccount) return false;
    // Plan free solo tiene cupones
    return !hasAccess(moduleName);
  };

  useEffect(() => {
    loadStoreInfo();
    
    // Recargar suscripción cuando se enfoca la ventana (volver del admin)
    const handleFocus = () => {
      reload();
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadStoreInfo = async () => {
    const storeId = localStorage.getItem('promonube_store_id');
    
    if (!storeId) {
      navigate('/');
      return;
    }

    try {
      const data = await apiRequest(`/store-info?storeId=${storeId}`);
      
      if (data.success) {
        setStoreInfo(data);
      } else {
        console.error('Error loading store info:', data);
        navigate('/');
      }
    } catch (error) {
      console.error('Error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('promonube_store_id');
    localStorage.removeItem('promonube_user_id');
    navigate('/');
  };

  const mainFeatures = [
    {
      icon: Palette,
      title: 'Style',
      description: 'Mejorá el diseño de tu web y llevá tu tienda a nivel profesional sin tocar código. Personalizá banners, botones, menús, íconos y categorías para destacarte y vender más.',
      path: '/style',
      moduleName: 'style',
      available: hasAccess('style'),
      blocked: isModuleBlocked('style'),
      featured: true,
      badge: '⭐ Recomendado'
    },
    {
      icon: Clock,
      title: 'Cuenta Regresiva',
      description: 'Creá temporizadores para anunciar lanzamientos, promociones o eventos. Generá urgencia (FOMO) mostrando cuándo empieza o termina una oferta, evento o flash sale.',
      path: '/countdown',
      moduleName: 'countdown',
      available: hasAccess('countdown'),
      blocked: isModuleBlocked('countdown')
    },
    {
      icon: BadgeCheck,
      title: 'Badges en Productos',
      description: 'Destacá productos con etiquetas visuales: Nuevo, Descuento, Envío Gratis, Últimas Unidades, Novedad, etc. Ideal para comunicar información clave sin texto extra.',
      path: '/badges',
      moduleName: 'style',
      available: hasAccess('style'),
      blocked: isModuleBlocked('style'),
      badge: '✨ Nuevo'
    },
    {
      icon: Tag,
      title: 'Cupones',
      description: 'Creá cupones de descuento masivos en segundos. Generá múltiples cupones con distintas reglas (prefijos, descuentos, usos) sin hacerlo manualmente, ideal para juegos, campañas o influencers.',
      path: '/coupons',
      moduleName: 'coupons',
      available: true,
      free: true
    },
    {
      icon: Sparkles,
      title: 'Ruleta de Descuentos',
      description: 'Sumá una ruleta personalizada para aumentar la tasa de conversión. El diferencial: cada cupón es único por usuario y se desactiva automáticamente si no se usa, brindando más seguridad al dueño de la tienda.',
      path: '/spin-wheel',
      moduleName: 'spinWheel',
      available: hasAccess('spinWheel'),
      blocked: isModuleBlocked('spinWheel')
    },
    {
      icon: CreditCard,
      title: 'Gift Cards',
      description: 'Creá gift cards con diseño personalizado e identidad propia. Diferencialas por evento, fecha o campaña. Simples, visuales y listas para vender.',
      path: '/gift-cards',
      moduleName: 'giftcards',
      available: hasAccess('giftcards'),
      blocked: isModuleBlocked('giftcards')
    }
  ];

  const handleFeatureClick = (feature) => {
    if (!feature.available) {
      setShowUpgradeModal(true);
    } else {
      navigate(feature.path);
    }
  };

  const handleSelectPlan = async (planId) => {
    // Abrir TiendaNube Admin para gestionar el pago
    const storeId = localStorage.getItem('promonube_store_id');
    window.open(`https://www.tiendanube.com/admin/stores/${storeId}/apps`, '_blank');
  };

  // Mostrar panel de admin si el usuario presiona Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAdminPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Cargando tu workspace...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Panel de Admin (oculto por defecto, Ctrl+Shift+A para mostrar) */}
      {showAdminPanel && (
        <div className="admin-panel-overlay">
          <AdminPanel />
          <button 
            className="close-admin-panel"
            onClick={() => setShowAdminPanel(false)}
          >
            ✕ Cerrar
          </button>
        </div>
      )}

      {/* Modern Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="brand">
              <div className="brand-left">
                <div className="brand-name">{storeInfo?.store?.storeName || 'Mi tienda'}</div>
                <span 
                  className={`plan-badge-inline ${subscription?.isDemoAccount ? 'demo' : ''}`}
                  onClick={() => setShowUpgradeModal(true)}
                  title="Click para gestionar suscripción"
                >
                  {subscription?.isDemoAccount ? '👑 DEMO' :
                   subscription?.plan === 'pro' ? '⚡ PRO' : '📦 FREE'}
                </span>
              </div>
            </div>
          </div>

          <div className="header-center">
            <div className="app-title">GlowLab</div>
          </div>

          <div className="header-right">
            <button className="btn-integrations" onClick={() => navigate('/integrations')}>
              <Settings size={18} />
              <span>Integraciones</span>
            </button>
            <button 
              className="btn-admin-access"
              onClick={() => setShowAdminPanel(true)}
              title="Ctrl+Shift+A"
            >
              <Shield size={18} />
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Subscription Status Banner */}
        <SubscriptionBanner subscription={subscription} />

        {/* Modules Section */}
        <div className="modules-header">
          <h2>Módulos</h2>
        </div>

        {/* Main Features Grid */}
        <div className="features-grid-modern">
          {mainFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const isLocked = feature.blocked || !feature.available;
            
            return (
              <div
                key={index}
                className={`feature-card-modern ${isLocked ? 'locked' : ''} ${feature.featured ? 'featured' : ''}`}
                onClick={() => handleFeatureClick(feature)}
                style={{ cursor: 'pointer' }}
              >
                {/* Badge especial para Style o badges normales */}
                {feature.featured ? (
                  <div className="module-badge featured-badge">{feature.badge}</div>
                ) : feature.free ? (
                  <div className="module-badge free-badge">✅ GRATIS</div>
                ) : isLocked ? (
                  <div className="module-badge pro-badge">🔒 PRO</div>
                ) : (
                  <div className="module-badge active-badge">✨ ACTIVO</div>
                )}

                {/* Blur overlay si está bloqueado */}
                {isLocked && (
                  <div className="locked-overlay">
                    <Lock size={32} />
                    <span>Click para desbloquear</span>
                  </div>
                )}

                <div className="feature-card-gradient" style={{ background: feature.gradient }}></div>
                <div className={`feature-card-content ${isLocked ? 'blur-content' : ''}`}>
                  <div className="feature-icon-large">
                    <Icon size={32} strokeWidth={2} />
                  </div>
                  <h3 className="feature-title-modern">{feature.title}</h3>
                  <p className="feature-description-modern">{feature.description}</p>
                  
                  {feature.stat !== null && (
                    <div className="feature-stat">
                      <span className="feature-stat-number">{feature.stat}</span>
                      <span className="feature-stat-label">{feature.statLabel}</span>
                    </div>
                  )}
                  
                  <button className="btn-feature-modern">
                    {isLocked ? '🔓 Desbloquear' : `Abrir ${feature.title}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Upgrade Modal */}
      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscription?.plan || 'free'}
        subscription={subscription}
      />
    </div>
  );
}

export default Dashboard;
