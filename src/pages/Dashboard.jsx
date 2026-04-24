import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Tag, CreditCard, Sparkles, Clock, Palette, Lock, Shield, BadgeCheck, Bell, Rocket, ChevronRight } from 'lucide-react';
import { apiRequest } from '../config';
import { useSubscription } from '../hooks/useSubscription';
import { useToast } from '../context/ToastContext';
import UpgradeModal from '../components/UpgradeModal';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AdminPanel from '../components/AdminPanel';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
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
    handleChargeReturn();

    const handleFocus = () => reload();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleChargeReturn = async () => {
    const params = new URLSearchParams(window.location.search);
    const chargeStatus = params.get('charge_status');
    const chargeId = params.get('charge_id');
    if (!chargeStatus || !chargeId) return;
    window.history.replaceState({}, '', window.location.pathname);
    const storeId = localStorage.getItem('promonube_store_id');
    if (!storeId) return;
    try {
      const response = await apiRequest('/api/subscription/confirm-charge', {
        method: 'POST',
        body: JSON.stringify({ storeId, chargeId, chargeStatus })
      });
      if (response.success && response.activated) {
        toast.success('¡Pago confirmado! Tu plan PRO ya está activo.');
        reload();
      } else if (chargeStatus === 'rejected' || chargeStatus === 'cancelled') {
        toast.error('El pago fue cancelado o rechazado. Podés intentarlo nuevamente.');
      }
    } catch (error) {
      console.error('Error confirmando cargo:', error);
    }
  };

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
    },
    {
      icon: Bell,
      title: 'Pop-ups',
      description: 'Mostrá ofertas y capturá emails con pop-ups personalizados. Targeting por página, exit intent, delay y más triggers. Aumentá conversiones desde el primer día.',
      path: '/popups',
      moduleName: 'popups',
      available: hasAccess('popups'),
      blocked: isModuleBlocked('popups'),
      badge: '✨ Nuevo'
    }
  ];

  const handleFeatureClick = (feature) => {
    // Marcar onboarding como visto cuando el usuario navega por primera vez
    localStorage.setItem('gl_onboarding_done', '1');
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

      {/* Header */}
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
            <span className="app-title">GlowLab</span>
          </div>

          <div className="header-right">
            <button 
              className="btn-admin-access"
              onClick={() => setShowAdminPanel(true)}
              title="Panel Admin (Ctrl+Shift+A)"
            >
              <Shield size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Subscription Status Banner */}
        <SubscriptionBanner subscription={subscription} />

        {/* Welcome Banner — solo si es usuario nuevo (nunca navegó a ningún módulo) */}
        {!localStorage.getItem('gl_onboarding_done') && (
          <div className="welcome-banner">
            <div className="wb-left">
              <Rocket size={28} className="wb-icon" />
              <div>
                <h3 className="wb-title">¡Bienvenido a GlowLab! Empezá en 3 pasos</h3>
                <div className="wb-steps">
                  <span className="wb-step"><span className="wb-step-num">1</span> Elegí un módulo abajo</span>
                  <ChevronRight size={14} className="wb-chevron" />
                  <span className="wb-step"><span className="wb-step-num">2</span> Configuralo en minutos</span>
                  <ChevronRight size={14} className="wb-chevron" />
                  <span className="wb-step"><span className="wb-step-num">3</span> Empezá a vender más</span>
                </div>
              </div>
            </div>
            <button className="wb-dismiss" onClick={() => { localStorage.setItem('gl_onboarding_done', '1'); window.location.reload(); }}>✕</button>
          </div>
        )}

        {/* Modules Section */}
        <div className="modules-header">
          <h2>Módulos</h2>
          <p className="modules-subtitle">Activá los que necesites, funciona sin instalar nada extra en tu tienda</p>
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
                  
                  {feature.stat != null && (
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
