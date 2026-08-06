import { CheckCircle, Clock, Crown } from 'lucide-react';
import './SubscriptionBanner.css';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
}

function daysLeft(date, now) {
  return Math.max(0, Math.ceil((date - now) / MS_PER_DAY));
}

// Banner no bloqueante que acompaña al PaymentGate: solo informa mientras la
// tienda TIENE acceso. Los casos sin acceso (blocked / past_due / trial vencido)
// ya los cubre el SubscribeWall a pantalla completa, no se duplican aca.
function SubscriptionBanner({ subscription }) {
  if (!subscription) return null;

  const { status, trialEndsAt, freeForever, courtesyUntil, currentPeriodEnd } = subscription;
  const now = new Date();

  // Gratis permanente
  if (freeForever) {
    return (
      <div className="subscription-banner active">
        <CheckCircle size={20} />
        <div className="banner-content">
          <strong>Acceso gratuito permanente</strong>
          <span>Tenés PromoNube Pro sin costo, con todos los módulos habilitados</span>
        </div>
      </div>
    );
  }

  // Cortesía vigente (se deriva de courtesyUntil, no existe status 'courtesy')
  const courtesyUntilDate = parseDate(courtesyUntil);
  if (courtesyUntilDate && courtesyUntilDate > now) {
    return (
      <div className="subscription-banner courtesy">
        <Crown size={20} />
        <div className="banner-content">
          <strong>Cortesía activa</strong>
          <span>
            Acceso completo por {daysLeft(courtesyUntilDate, now)} días más • Vence: {courtesyUntilDate.toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  }

  // Prueba gratuita en curso
  if (status === 'trialing') {
    const trialEndsAtDate = parseDate(trialEndsAt);
    if (trialEndsAtDate && trialEndsAtDate > now) {
      return (
        <div className="subscription-banner trial">
          <Clock size={20} />
          <div className="banner-content">
            <strong>Prueba gratuita</strong>
            <span>
              Te quedan {daysLeft(trialEndsAtDate, now)} días • Vence: {trialEndsAtDate.toLocaleDateString()}
            </span>
          </div>
        </div>
      );
    }
    // Trial vencido: lo maneja el PaymentGate
    return null;
  }

  // Suscripción paga activa
  if (status === 'active') {
    const currentPeriodEndDate = parseDate(currentPeriodEnd);
    return (
      <div className="subscription-banner active">
        <CheckCircle size={20} />
        <div className="banner-content">
          <strong>PromoNube Pro activo</strong>
          <span>
            Acceso completo a todas las funcionalidades
            {currentPeriodEndDate ? ` • Próximo cobro: ${currentPeriodEndDate.toLocaleDateString()}` : ''}
          </span>
        </div>
      </div>
    );
  }

  // blocked / past_due / desconocido: el PaymentGate ya muestra el paywall
  return null;
}

export default SubscriptionBanner;
