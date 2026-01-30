import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, DollarSign, Search, CheckCircle, XCircle, Calendar, AlertCircle } from 'lucide-react';
import { apiRequest } from '../config';
import './UseGiftCard.css';

function UseGiftCard() {
  const navigate = useNavigate();
  
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [giftCard, setGiftCard] = useState(null);
  const [error, setError] = useState('');
  
  // Para el canje
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Ingresá un código de gift card');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setGiftCard(null);
      setRedeemSuccess(false);

      const data = await apiRequest(`/api/giftcards/${code.toUpperCase()}/balance`);
      
      if (data.success) {
        setGiftCard(data.giftCard);
        setRedeemAmount(data.giftCard.balance.toString()); // Por defecto usar todo el saldo
      } else {
        setError(data.message || 'Gift card no encontrada');
      }
    } catch (error) {
      console.error('Error consultando gift card:', error);
      setError('Error al consultar la gift card. Intentá nuevamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleRedeem = async (e) => {
    e.preventDefault();

    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      setError('Ingresá un monto válido para canjear');
      return;
    }

    if (parseFloat(redeemAmount) > giftCard.balance) {
      setError(`El monto no puede ser mayor al saldo disponible ($${giftCard.balance})`);
      return;
    }

    try {
      setRedeeming(true);
      setError('');

      const data = await apiRequest('/api/giftcards/redeem', {
        method: 'POST',
        body: JSON.stringify({
          code: giftCard.code,
          amount: parseFloat(redeemAmount)
        })
      });

      if (data.success) {
        setRedeemSuccess(true);
        // Actualizar el saldo de la gift card
        setGiftCard({
          ...giftCard,
          balance: data.giftCard.newBalance,
          status: data.giftCard.status
        });
        
        // Reset form
        setRedeemAmount(data.giftCard.newBalance.toString());
        
        // Mostrar mensaje de éxito por 3 segundos
        setTimeout(() => {
          setRedeemSuccess(false);
        }, 3000);
      } else {
        setError(data.message || 'Error al canjear gift card');
      }
    } catch (error) {
      console.error('Error canjeando gift card:', error);
      setError('Error al canjear la gift card. Intentá nuevamente.');
    } finally {
      setRedeeming(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusInfo = () => {
    if (!giftCard) return null;

    if (giftCard.status === 'used') {
      return {
        icon: <XCircle size={20} />,
        text: 'Gift Card Usada',
        className: 'status-used'
      };
    }

    if (giftCard.status === 'expired') {
      return {
        icon: <XCircle size={20} />,
        text: 'Gift Card Vencida',
        className: 'status-expired'
      };
    }

    if (giftCard.status === 'partially_used') {
      return {
        icon: <CheckCircle size={20} />,
        text: 'Gift Card Parcialmente Usada',
        className: 'status-partial'
      };
    }

    return {
      icon: <CheckCircle size={20} />,
      text: 'Gift Card Activa',
      className: 'status-active'
    };
  };

  return (
    <div className="page-container use-giftcard-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>🎁 Usar Gift Card</h1>
            <p>Consultá el saldo y canjeá tu gift card</p>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <div className="search-section">
        <div className="search-card">
          <div className="search-header">
            <Gift size={32} />
            <h2>Ingresá tu código de Gift Card</h2>
            <p>Consultá el saldo disponible y canjeá tu gift card</p>
          </div>

          <form onSubmit={handleSearch} className="search-form">
            <div className="input-group">
              <input
                type="text"
                placeholder="GIFT-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={searching}
                maxLength={20}
              />
              <button 
                type="submit" 
                className="btn-primary"
                disabled={searching}
              >
                {searching ? (
                  <>
                    <div className="spinner-small"></div>
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Consultar Saldo
                  </>
                )}
              </button>
            </div>

            {error && !giftCard && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Gift Card Info */}
      {giftCard && (
        <div className="giftcard-info-section">
          {/* Status Banner */}
          <div className={`status-banner ${getStatusInfo().className}`}>
            {getStatusInfo().icon}
            <span>{getStatusInfo().text}</span>
          </div>

          {/* Balance Card */}
          <div className="balance-card">
            <div className="balance-icon">
              <DollarSign size={40} />
            </div>
            <div className="balance-info">
              <span className="balance-label">Saldo Disponible</span>
              <span className="balance-amount">{formatCurrency(giftCard.balance)}</span>
              <span className="balance-initial">de {formatCurrency(giftCard.initialAmount)} iniciales</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="balance-progress-container">
            <div className="balance-progress">
              <div 
                className="balance-progress-fill"
                style={{ width: `${(giftCard.balance / giftCard.initialAmount) * 100}%` }}
              />
            </div>
            <span className="progress-percentage">
              {Math.round((giftCard.balance / giftCard.initialAmount) * 100)}% disponible
            </span>
          </div>

          {/* Gift Card Details */}
          <div className="giftcard-details">
            <div className="detail-row">
              <span className="detail-label">Código:</span>
              <span className="detail-value">{giftCard.code}</span>
            </div>
            {giftCard.expiresAt && (
              <div className="detail-row">
                <Calendar size={16} />
                <span className="detail-label">Vence:</span>
                <span className="detail-value">{formatDate(giftCard.expiresAt)}</span>
              </div>
            )}
          </div>

          {/* Redeem Form */}
          {giftCard.balance > 0 && giftCard.status !== 'expired' && (
            <div className="redeem-card">
              <h3>💳 Canjear Gift Card</h3>
              <p className="redeem-description">
                Ingresá el monto que querés usar. Si tu compra es menor al saldo, el resto queda disponible.
              </p>

              {redeemSuccess && (
                <div className="alert alert-success">
                  <CheckCircle size={18} />
                  ¡Gift card canjeada exitosamente! Saldo restante: {formatCurrency(giftCard.balance)}
                </div>
              )}

              {error && giftCard && (
                <div className="alert alert-error">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <form onSubmit={handleRedeem} className="redeem-form">
                <div className="form-group">
                  <label htmlFor="redeemAmount">Monto a Canjear</label>
                  <div className="amount-input-group">
                    <span className="currency-prefix">$</span>
                    <input
                      id="redeemAmount"
                      type="number"
                      min="0"
                      max={giftCard.balance}
                      step="0.01"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="0"
                      disabled={redeeming}
                    />
                  </div>
                  <span className="input-help">
                    Máximo: {formatCurrency(giftCard.balance)}
                  </span>
                </div>

                <div className="quick-amounts">
                  <button
                    type="button"
                    className="btn-quick-amount"
                    onClick={() => setRedeemAmount((giftCard.balance * 0.25).toFixed(2))}
                    disabled={redeeming}
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    className="btn-quick-amount"
                    onClick={() => setRedeemAmount((giftCard.balance * 0.5).toFixed(2))}
                    disabled={redeeming}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className="btn-quick-amount"
                    onClick={() => setRedeemAmount((giftCard.balance * 0.75).toFixed(2))}
                    disabled={redeeming}
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    className="btn-quick-amount"
                    onClick={() => setRedeemAmount(giftCard.balance.toString())}
                    disabled={redeeming}
                  >
                    Todo
                  </button>
                </div>

                <button 
                  type="submit"
                  className="btn-redeem"
                  disabled={redeeming || !redeemAmount || parseFloat(redeemAmount) <= 0}
                >
                  {redeeming ? (
                    <>
                      <div className="spinner-small"></div>
                      Canjeando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Canjear {redeemAmount ? formatCurrency(parseFloat(redeemAmount)) : '$0'}
                    </>
                  )}
                </button>
              </form>

              <div className="info-box">
                <AlertCircle size={16} />
                <div>
                  <strong>¿Cómo usar en el checkout?</strong>
                  <p>Ingresá el código <strong>{giftCard.code}</strong> en el campo de cupón de descuento al finalizar tu compra.</p>
                </div>
              </div>
            </div>
          )}

          {/* No Balance Message */}
          {giftCard.balance <= 0 && (
            <div className="alert alert-info">
              <AlertCircle size={18} />
              Esta gift card ya no tiene saldo disponible. ¡Gracias por usarla!
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="help-section">
        <h3>❓ ¿Cómo usar tu Gift Card?</h3>
        <div className="help-steps">
          <div className="help-step">
            <div className="step-number">1</div>
            <div>
              <h4>Consultá el Saldo</h4>
              <p>Ingresá el código que recibiste por email para ver tu saldo disponible</p>
            </div>
          </div>
          <div className="help-step">
            <div className="step-number">2</div>
            <div>
              <h4>Comprá lo que Quieras</h4>
              <p>Navegá por la tienda y agregá productos a tu carrito</p>
            </div>
          </div>
          <div className="help-step">
            <div className="step-number">3</div>
            <div>
              <h4>Aplicá el Código</h4>
              <p>En el checkout, ingresá tu código en el campo de cupón de descuento</p>
            </div>
          </div>
          <div className="help-step">
            <div className="step-number">4</div>
            <div>
              <h4>Finalizá tu Compra</h4>
              <p>El descuento se aplicará automáticamente. Si sobra saldo, queda disponible para la próxima compra</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UseGiftCard;
