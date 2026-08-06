import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Palette, Clock, BadgeCheck, Tag,
  Sparkles, Gift, Bell, Settings, LogOut, X, MapPin, MessageCircle,
  ShoppingBag, Image, Megaphone, Zap
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import './Sidebar.css';

const BASE_NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { divider: true },
  { path: '/style',          icon: Palette,       label: 'Style' },
  { path: '/shop-the-look',  icon: ShoppingBag,   label: 'Shop the Look' },
  { path: '/flash-sale',     icon: Zap,           label: 'Flash Sale' },
  { path: '/banner',         icon: Image,         label: 'Banner Home' },
  { path: '/ml-bar',         icon: Megaphone,     label: 'Barra Mercado Libre' },
  { path: '/countdown',      icon: Clock,         label: 'Countdowns' },
  { path: '/badges',     icon: BadgeCheck,      label: 'Badges' },
  { path: '/coupons',    icon: Tag,             label: 'Cupones' },
  { path: '/spin-wheel', icon: Sparkles,        label: 'Ruleta' },
  { path: '/gift-cards', icon: Gift,            label: 'Gift Cards' },
  { path: '/popups',     icon: Bell,            label: 'Popups' },
  { divider: true },
  { path: '/integrations', icon: Settings,      label: 'Integraciones' },
];

// Módulos exclusivos por tienda
const STORE_EXCLUSIVE_ITEMS = {
  '2547699': [
    { divider: true, exclusive: true },
    { path: '/local-stock', icon: MapPin, label: 'Stock Altorancho', exclusive: true },
    { path: '/checkout-notice', icon: MessageCircle, label: 'Aviso Checkout', exclusive: true },
  ],
};

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription } = useSubscription();
  const storeId = localStorage.getItem('promonube_store_id');
  const storeName = localStorage.getItem('promonube_store_name') || `Tienda #${storeId}`;
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(STORE_EXCLUSIVE_ITEMS[String(storeId)] || []),
  ];

  const handleNav = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const handleLogout = () => {
    localStorage.removeItem('promonube_store_id');
    localStorage.removeItem('promonube_user_id');
    localStorage.removeItem('promonube_store_name');
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // 'courtesy' no es un valor de subscription.status: la cortesia se deriva de
  // courtesyUntil estando en el futuro, igual que en evaluateAccess (backend).
  const courtesyUntilDate = subscription?.courtesyUntil ? new Date(subscription.courtesyUntil) : null;
  const isCourtesyActive = !!(courtesyUntilDate && !isNaN(courtesyUntilDate) && courtesyUntilDate > new Date());

  const getPlanClass = () => {
    if (subscription?.status === 'active') return 'pro';
    if (subscription?.freeForever || isCourtesyActive) return 'demo';
    return 'free';
  };

  const getPlanLabel = () => {
    if (subscription?.status === 'active') return '⚡ PRO';
    if (subscription?.freeForever) return '💚 GRATIS';
    if (isCourtesyActive) return '🎉 CORTESÍA';
    if (subscription?.status === 'trialing') return '🎁 TRIAL';
    return '📦 FREE';
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">P</div>
        <span className="sidebar-brand-name">PromoNube</span>
        <button className="sidebar-close-mobile" onClick={onClose} aria-label="Cerrar menú">
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.divider) {
            return <div key={`divider-${i}`} className="sidebar-divider" />;
          }
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => handleNav(item.path)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer: store info + logout */}
      <div className="sidebar-footer">
        <div className="sidebar-store-info">
          <div className="sidebar-store-name">{storeName}</div>
          {subscription && (
            <div className={`sidebar-plan-badge ${getPlanClass()}`}>
              {getPlanLabel()}
            </div>
          )}
        </div>
        <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
