import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import SpinWheel from './pages/SpinWheel';
import SpinWheelConfig from './pages/SpinWheelConfig';
import SpinWheelAnalytics from './pages/SpinWheelAnalytics';
import LocalStockConfig from './pages/LocalStockConfig';
import CheckoutNoticeConfig from './pages/CheckoutNoticeConfig';
import CountdownList from './pages/CountdownList';
import CountdownConfig from './pages/CountdownConfig';
import NewBadgeConfig from './pages/NewBadgeConfig';
import BadgesList from './pages/BadgesList';
import BadgeConfig from './pages/BadgeConfig';
import StyleConfig from './pages/StyleConfig';
import Integrations from './pages/Integrations';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailure from './pages/PaymentFailure';
import PaymentPending from './pages/PaymentPending';
import PaymentTest from './pages/PaymentTest';
import AdminPanel from './pages/AdminPanel';
import PopupsList from './pages/PopupsList';
import PopupConfig from './pages/PopupConfig';
import ShopTheLookConfig from './pages/ShopTheLookConfig';
import FlashSaleConfig from './pages/FlashSaleConfig';
import BannerConfig from './pages/BannerConfig';
import AnnouncementBarConfig from './pages/AnnouncementBarConfig';
import StorefrontBlocksList from './pages/StorefrontBlocksList';
import StorefrontBlockConfig from './pages/StorefrontBlockConfig';
import PriceFinancingConfig from './pages/PriceFinancingConfig';
import './App.css';

function App() {
  return (
    <ToastProvider>
    <Router>
      <div className="app-root">
      <Routes>
        {/* Public routes (no sidebar) */}
        <Route path="/" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-failure" element={<PaymentFailure />} />
        <Route path="/payment-pending" element={<PaymentPending />} />
        <Route path="/payment-test" element={<PaymentTest />} />
        <Route path="/admin" element={<AdminPanel />} />

        {/* Authenticated routes — wrapped with sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/spin-wheel" element={<SpinWheel />} />
          <Route path="/spin-wheel/create" element={<SpinWheelConfig />} />
          <Route path="/spin-wheel/:wheelId/config" element={<SpinWheelConfig />} />
          <Route path="/spin-wheel/:wheelId/edit" element={<SpinWheelConfig />} />
          <Route path="/spin-wheel/:wheelId/analytics" element={<SpinWheelAnalytics />} />
          <Route path="/countdown" element={<CountdownList />} />
          <Route path="/countdown/create" element={<CountdownConfig />} />
          <Route path="/countdown/:countdownId/config" element={<CountdownConfig />} />
          <Route path="/badges" element={<BadgesList />} />
          <Route path="/badges/create" element={<BadgeConfig />} />
          <Route path="/badges/:badgeId/config" element={<BadgeConfig />} />
          <Route path="/new-badge" element={<NewBadgeConfig />} />
          <Route path="/style" element={<StyleConfig />} />
          <Route path="/shop-the-look" element={<ShopTheLookConfig />} />
          <Route path="/flash-sale" element={<FlashSaleConfig />} />
          <Route path="/banner" element={<BannerConfig />} />
          <Route path="/ml-bar" element={<AnnouncementBarConfig />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/popups" element={<PopupsList />} />
          <Route path="/popups/create" element={<PopupConfig />} />
          <Route path="/popups/:popupId/config" element={<PopupConfig />} />
          <Route path="/local-stock" element={<LocalStockConfig />} />
          <Route path="/checkout-notice" element={<CheckoutNoticeConfig />} />
          <Route path="/storefront-blocks" element={<StorefrontBlocksList />} />
          <Route path="/storefront-blocks/:blockId/config" element={<StorefrontBlockConfig />} />
          <Route path="/precios-cuotas" element={<PriceFinancingConfig />} />
        </Route>
      </Routes>
      <a
        className="whatsapp-float"
        href="https://wa.me/5491164212370"
        target="_blank"
        rel="noreferrer"
        aria-label="Soporte por WhatsApp"
        title="Soporte por WhatsApp"
      >
        <span className="whatsapp-icon" aria-hidden="true">🟢</span>
        <span className="whatsapp-text">Soporte</span>
      </a>
      </div>
    </Router>
    </ToastProvider>
  );
}

export default App;
