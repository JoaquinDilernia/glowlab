import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock, Palette, BadgeCheck, Rocket, ChevronRight, ShoppingBag, Search, Percent } from 'lucide-react';
import { apiRequest } from '../config';
import { useSubscription } from '../hooks/useSubscription';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AdminPanel from '../components/AdminPanel';
import OnboardingWizard from '../components/OnboardingWizard';
import './Dashboard.css';

// Solo valores reales de subscription.status. 'courtesy' y 'free_forever' no
// viven aca: se derivan de courtesyUntil / freeForever (ver getStatusBadgeLabel).
const STATUS_BADGE_LABEL = {
  trialing: '🎁 TRIAL',
  active: '⚡ PRO'
};

function getStatusBadgeLabel(subscription) {
  if (!subscription) return '📦 FREE';
  if (subscription.freeForever) return '💚 GRATIS';

  const courtesyUntilDate = subscription.courtesyUntil ? new Date(subscription.courtesyUntil) : null;
  if (courtesyUntilDate && !isNaN(courtesyUntilDate) && courtesyUntilDate > new Date()) {
    return '🎉 CORTESÍA';
  }

  // Default neutro: un status desconocido o bloqueado no debe mostrarse como PRO.
  return STATUS_BADGE_LABEL[subscription.status] || '📦 FREE';
}

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    typeof window !== 'undefined' && !localStorage.getItem('gl_onboarding_done')
  );
  const { subscription, reload } = useSubscription();

  useEffect(() => {
    loadStoreInfo();

    const handleFocus = () => reload();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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

  // PaymentGate ya garantiza acceso antes de que este componente se monte —
  // todos los módulos están disponibles siempre que el Dashboard se renderiza.
  const mainFeatures = [
    {
      icon: Palette,
      title: 'Style',
      description: 'Mejorá el diseño de tu web y llevá tu tienda a nivel profesional sin tocar código. Personalizá banners, botones, menús, íconos y categorías para destacarte y vender más.',
      path: '/style',
      featured: true,
      badge: '⭐ Recomendado'
    },
    {
      icon: Search,
      title: 'Buscador Inteligente Pro',
      description: 'Popup de búsqueda con tolerancia a errores de tipeo, banners con link, búsquedas recomendadas y un asistente de IA como respaldo cuando la búsqueda normal no encuentra nada.',
      path: '/buscador-inteligente',
      featured: true,
      badge: '🔥 Nuevo'
    },
    {
      icon: Percent,
      title: 'Precios y Cuotas',
      description: 'Mostrá descuento por efectivo/transferencia y planes de cuotas en el listado y la página de producto, con barra de progreso en el carrito hacia el próximo plan sin interés.',
      path: '/precios-cuotas',
      featured: true,
      badge: '🔥 Nuevo'
    },
    {
      icon: Clock,
      title: 'Cuenta Regresiva',
      description: 'Creá temporizadores para anunciar lanzamientos, promociones o eventos. Generá urgencia (FOMO) mostrando cuándo empieza o termina una oferta, evento o flash sale.',
      path: '/countdown'
    },
    {
      icon: BadgeCheck,
      title: 'Badges en Productos',
      description: 'Destacá productos con etiquetas visuales: Nuevo, Descuento, Envío Gratis, Últimas Unidades, Novedad, etc. Ideal para comunicar información clave sin texto extra.',
      path: '/badges',
      badge: '✨ Nuevo'
    },
    {
      icon: Sparkles,
      title: 'Ruleta de Descuentos',
      description: 'Sumá una ruleta personalizada para aumentar la tasa de conversión. El diferencial: cada cupón es único por usuario y se desactiva automáticamente si no se usa, brindando más seguridad al dueño de la tienda.',
      path: '/spin-wheel'
    },
    {
      icon: ShoppingBag,
      title: 'Shop the Look',
      description: 'Marcá productos directamente sobre una imagen y dejá que tus clientes los agreguen al carrito sin salir. Ideal para lookbooks, outfits y colecciones.',
      path: '/shop-the-look',
      badge: '✨ Nuevo'
    },
  ];

  const handleFeatureClick = (feature) => {
    localStorage.setItem('gl_onboarding_done', '1');
    navigate(feature.path);
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

  const statusBadgeLabel = getStatusBadgeLabel(subscription);

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
                <span className="plan-badge-inline">
                  {statusBadgeLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="header-center">
            <span className="app-title">GlowLab</span>
          </div>

          <div className="header-right">
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Subscription Status Banner */}
        <SubscriptionBanner subscription={subscription} />

        {/* Welcome Banner — botón para reabrir el tour si ya lo cerró */}
        {!showOnboarding && localStorage.getItem('gl_onboarding_done') && (
          <div className="welcome-banner welcome-banner-compact">
            <div className="wb-left">
              <Rocket size={20} className="wb-icon" />
              <span className="wb-title-compact">¿Necesitás ayuda para empezar?</span>
            </div>
            <button
              className="wb-cta"
              onClick={() => { localStorage.removeItem('gl_onboarding_done'); setShowOnboarding(true); }}
            >
              Ver tour rápido <ChevronRight size={14} />
            </button>
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

            return (
              <div
                key={index}
                className={`feature-card-modern ${feature.featured ? 'featured' : ''}`}
                onClick={() => handleFeatureClick(feature)}
                style={{ cursor: 'pointer' }}
              >
                {feature.badge && (
                  <div className={`module-badge ${feature.featured ? 'featured-badge' : 'active-badge'}`}>{feature.badge}</div>
                )}

                <div className="feature-card-gradient" style={{ background: feature.gradient }}></div>
                <div className="feature-card-content">
                  <div className="feature-icon-large">
                    <Icon size={32} strokeWidth={2} />
                  </div>
                  <h3 className="feature-title-modern">{feature.title}</h3>
                  <p className="feature-description-modern">{feature.description}</p>

                  <button className="btn-feature-modern">
                    Abrir {feature.title}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Onboarding Wizard - usuario nuevo */}
      {showOnboarding && (
        <OnboardingWizard
          storeId={localStorage.getItem('promonube_store_id')}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
