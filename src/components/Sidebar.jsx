import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Palette, Clock, BadgeCheck, Tag,
  Sparkles, Gift, Bell, Settings, LogOut, X
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { divider: true },
  { path: '/style',      icon: Palette,         label: 'Style' },
  { path: '/countdown',  icon: Clock,           label: 'Countdowns' },
  { path: '/badges',     icon: BadgeCheck,      label: 'Badges' },
  { path: '/coupons',    icon: Tag,             label: 'Cupones' },
  { path: '/spin-wheel', icon: Sparkles,        label: 'Ruleta' },
  { path: '/gift-cards', icon: Gift,            label: 'Gift Cards' },
  { path: '/popups',     icon: Bell,            label: 'Popups' },
  { divider: true },
  { path: '/integrations', icon: Settings,      label: 'Integraciones' },
];

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription } = useSubscription();
  const storeId = localStorage.getItem('promonube_store_id');
  const storeName = localStorage.getItem('promonube_store_name') || `Tienda #${storeId}`;

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

  const getPlanClass = () => {
    if (subscription?.isDemoAccount) return 'demo';
    if (subscription?.plan === 'pro') return 'pro';
    return 'free';
  };

  const getPlanLabel = () => {
    if (subscription?.isDemoAccount) return '👑 DEMO';
    if (subscription?.plan === 'pro') return '⚡ PRO';
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
        {NAV_ITEMS.map((item, i) => {
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
