import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import CreateCoupon from './pages/CreateCoupon';
import CouponsList from './pages/CouponsList';
import GiftCardV2 from './pages/GiftCardV2';
import CreateGiftCard from './pages/CreateGiftCard';
import GiftCardTemplates from './pages/GiftCardTemplates';
import GiftCardDetail from './pages/GiftCardDetail';
import CouponAnalytics from './pages/CouponAnalytics';
import SpinWheel from './pages/SpinWheel';
import SpinWheelConfig from './pages/SpinWheelConfig';
import SpinWheelAnalytics from './pages/SpinWheelAnalytics';
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

        {/* Authenticated routes — wrapped with sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-coupon" element={<CreateCoupon />} />
          <Route path="/coupons" element={<CouponsList />} />
          <Route path="/coupon-analytics/:couponId" element={<CouponAnalytics />} />
          <Route path="/gift-cards" element={<GiftCardV2 />} />
          <Route path="/gift-card/:giftCardId" element={<GiftCardDetail />} />
          <Route path="/create-gift-card" element={<CreateGiftCard />} />
          <Route path="/gift-card-templates" element={<GiftCardTemplates />} />
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
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/popups" element={<PopupsList />} />
          <Route path="/popups/create" element={<PopupConfig />} />
          <Route path="/popups/:popupId/config" element={<PopupConfig />} />
        </Route>
      </Routes>
      <a
        className="whatsapp-float"
        href="https://wa.me/5491173612561"
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
