import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Mail, User, Calendar, DollarSign, CreditCard, Send, Edit2, Check, X, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../config';
import './GiftCardDetail.css';

function GiftCardDetail() {
  const { giftCardId } = useParams();
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [giftCard, setGiftCard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [marking, setMarking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadGiftCard();
    loadTransactions();
  }, [giftCardId]);

  const loadGiftCard = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcards/${giftCardId}?storeId=${storeId}`);
      
      if (data.success) {
        setGiftCard(data.giftCard);
        setNewEmail(data.giftCard.recipientEmail || '');
      }
    } catch (error) {
      console.error('Error loading gift card:', error);
      showMessage('error', 'Error al cargar la gift card');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await apiRequest(`/api/giftcards/${giftCardId}/transactions?storeId=${storeId}`);
      
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleResendEmail = async () => {
    if (!giftCard.recipientEmail && !newEmail) {
      showMessage('error', 'No hay email configurado. Agregá un email primero.');
      return;
    }

    try {
      setSending(true);
      const data = await apiRequest('/api/giftcards/resend-email', {
        method: 'POST',
        body: JSON.stringify({
          code: giftCard.code,
          recipientEmail: newEmail || giftCard.recipientEmail
        })
      });

      if (data.success) {
        showMessage('success', `Email enviado exitosamente a ${data.emailTo}`);
        loadGiftCard(); // Recargar para actualizar sentAt
      } else {
        showMessage('error', data.message || 'Error al enviar email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      showMessage('error', 'Error al enviar el email');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      showMessage('error', 'Ingresá un email válido');
      return;
    }

    try {
      setUpdating(true);
      const data = await apiRequest(`/api/giftcards/${giftCardId}/update-email`, {
        method: 'PUT',
        body: JSON.stringify({
          storeId,
          recipientEmail: newEmail
        })
      });

      if (data.success) {
        showMessage('success', 'Email actualizado correctamente');
        setIsEditingEmail(false);
        loadGiftCard(); // Recargar
      } else {
        showMessage('error', data.message || 'Error al actualizar email');
      }
    } catch (error) {
      console.error('Error updating email:', error);
      showMessage('error', 'Error al actualizar el email');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkAsUsed = async () => {
    setShowConfirmModal(false);
    
    try {
      setMarking(true);
      const data = await apiRequest(`/api/giftcards/${giftCardId}/mark-used`, {
        method: 'PUT',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        showMessage('success', 'Gift card marcada como usada y cupón desactivado');
        loadGiftCard(); // Recargar
        loadTransactions(); // Recargar transacciones
      } else {
        showMessage('error', data.message || 'Error al marcar como usada');
      }
    } catch (error) {
      console.error('Error marking as used:', error);
      showMessage('error', 'Error al marcar la gift card como usada');
    } finally {
      setMarking(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
    return date.toLocaleString('es-AR');
  };

  const getStatusBadge = (giftCard) => {
    if (giftCard.expiresAt && new Date(giftCard.expiresAt._seconds * 1000) < new Date()) {
      return <span className="badge badge-expired">Vencida</span>;
    }
    
    switch (giftCard.status) {
      case 'active':
        return <span className="badge badge-active">Activa</span>;
      case 'partially_used':
        return <span className="badge badge-partial">Uso Parcial</span>;
      case 'used':
        return <span className="badge badge-used">Usada</span>;
      case 'expired':
        return <span className="badge badge-expired">Vencida</span>;
      default:
        return <span className="badge">{giftCard.status}</span>;
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'redeem':
        return <CreditCard size={16} style={{ color: '#ef4444' }} />;
      case 'reload':
        return <RefreshCw size={16} style={{ color: '#10b981' }} />;
      case 'creation':
        return <Gift size={16} style={{ color: '#667eea' }} />;
      default:
        return <DollarSign size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando gift card...</p>
        </div>
      </div>
    );
  }

  if (!giftCard) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <Gift size={48} />
          <h3>Gift card no encontrada</h3>
          <button className="btn-primary" onClick={() => navigate('/gift-cards')}>
            Volver a Gift Cards
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/gift-cards')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>🎁 Gift Card</h1>
            <p className="gift-code">{giftCard.code}</p>
          </div>
        </div>
        <div className="header-actions">
          {getStatusBadge(giftCard)}
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Main Info */}
      <div className="detail-grid">
        {/* Balance Card */}
        <div className="detail-card balance-card-detail">
          <h3>💰 Saldo</h3>
          <div className="balance-info-detail">
            <div className="balance-current">
              <span className="balance-label">Disponible</span>
              <span className="balance-amount">{formatCurrency(giftCard.balance)}</span>
            </div>
            <div className="balance-initial-detail">
              <span>Monto Inicial: {formatCurrency(giftCard.initialAmount)}</span>
            </div>
          </div>
          <div className="balance-progress-detail">
            <div 
              className="balance-progress-fill"
              style={{ width: `${(giftCard.balance / giftCard.initialAmount) * 100}%` }}
            />
          </div>
          <div className="balance-stats">
            <div className="stat-item">
              <span className="stat-label">Usado</span>
              <span className="stat-value">{formatCurrency(giftCard.initialAmount - giftCard.balance)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Usos</span>
              <span className="stat-value">{giftCard.usageCount || 0}</span>
            </div>
          </div>
        </div>

        {/* Recipient Card */}
        <div className="detail-card">
          <h3>👤 Destinatario</h3>
          
          {/* Name */}
          <div className="info-row">
            <div className="info-icon">
              <User size={18} />
            </div>
            <div className="info-content">
              <span className="info-label">Nombre</span>
              <span className="info-value">{giftCard.recipientName || 'Sin nombre'}</span>
            </div>
          </div>

          {/* Email */}
          <div className="info-row">
            <div className="info-icon">
              <Mail size={18} />
            </div>
            <div className="info-content">
              <span className="info-label">Email</span>
              {isEditingEmail ? (
                <div className="email-edit-form">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                    className="email-input"
                  />
                  <div className="email-actions">
                    <button 
                      className="btn-icon btn-success"
                      onClick={handleUpdateEmail}
                      disabled={updating}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      className="btn-icon btn-cancel"
                      onClick={() => {
                        setIsEditingEmail(false);
                        setNewEmail(giftCard.recipientEmail || '');
                      }}
                      disabled={updating}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="email-display">
                  <span className="info-value">{giftCard.recipientEmail || 'Sin email'}</span>
                  <button 
                    className="btn-icon-small"
                    onClick={() => setIsEditingEmail(true)}
                    title="Editar email"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Send Email Button */}
          <div className="email-send-section">
            <button 
              className="btn-send-email"
              onClick={handleResendEmail}
              disabled={sending || (!giftCard.recipientEmail && !newEmail)}
            >
              {sending ? (
                <>
                  <div className="btn-spinner"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={18} />
                  {giftCard.sentAt ? 'Reenviar Email' : 'Enviar Email'}
                </>
              )}
            </button>
            {giftCard.sentAt && (
              <span className="sent-info">
                Último envío: {formatDate(giftCard.sentAt)}
              </span>
            )}
          </div>
        </div>

        {/* Dates Card */}
        <div className="detail-card">
          <h3>📅 Fechas</h3>
          
          <div className="info-row">
            <div className="info-icon">
              <Calendar size={18} />
            </div>
            <div className="info-content">
              <span className="info-label">Creada</span>
              <span className="info-value">{formatDate(giftCard.createdAt)}</span>
            </div>
          </div>

          {giftCard.expiresAt && (
            <div className="info-row">
              <div className="info-icon">
                <Calendar size={18} />
              </div>
              <div className="info-content">
                <span className="info-label">Vence</span>
                <span className="info-value">{formatDate(giftCard.expiresAt)}</span>
              </div>
            </div>
          )}

          {giftCard.lastUsedAt && (
            <div className="info-row">
              <div className="info-icon">
                <Calendar size={18} />
              </div>
              <div className="info-content">
                <span className="info-label">Último Uso</span>
                <span className="info-value">{formatDate(giftCard.lastUsedAt)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions Card */}
        {giftCard.status !== 'used' && giftCard.status !== 'expired' && (
          <div className="detail-card">
            <h3>⚙️ Acciones</h3>
            
            <div className="action-section">
              <div className="action-info">
                <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                <div>
                  <p className="action-title">Marcar como Usada</p>
                  <p className="action-description">
                    Esto establecerá el saldo en $0, marcará la gift card como "Usada" 
                    y desactivará el cupón en TiendaNube.
                  </p>
                </div>
              </div>
              
              <button 
                className="btn-mark-used"
                onClick={() => setShowConfirmModal(true)}
                disabled={marking}
              >
                {marking ? (
                  <>
                    <div className="btn-spinner"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <XCircle size={18} />
                    Marcar como Usada
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions History */}
      {transactions.length > 0 && (
        <div className="detail-card transactions-card">
          <h3>📜 Historial de Transacciones</h3>
          <div className="transactions-list">
            {transactions.map((tx) => (
              <div key={tx.transactionId} className="transaction-item">
                <div className="transaction-icon">
                  {getTransactionIcon(tx.type)}
                </div>
                <div className="transaction-info">
                  <span className="transaction-type">
                    {tx.type === 'redeem' && 'Uso de Gift Card'}
                    {tx.type === 'reload' && 'Recarga'}
                    {tx.type === 'creation' && 'Creación'}
                  </span>
                  <span className="transaction-date">{formatDate(tx.createdAt)}</span>
                </div>
                <div className="transaction-amounts">
                  <span className={`transaction-amount ${tx.type === 'redeem' ? 'negative' : 'positive'}`}>
                    {tx.type === 'redeem' ? '-' : '+'}{formatCurrency(tx.amount)}
                  </span>
                  <span className="transaction-balance">
                    Saldo: {formatCurrency(tx.balanceAfter)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
              <h3>¿Confirmar acción?</h3>
            </div>
            
            <div className="modal-body">
              <p>Estás por marcar esta gift card como <strong>usada manualmente</strong>.</p>
              <p>Esto hará lo siguiente:</p>
              <ul>
                <li>Establecerá el saldo en <strong>$0</strong></li>
                <li>Cambiará el estado a <strong>"Usada"</strong></li>
                <li>Desactivará el cupón <strong>{giftCard.code}</strong> en TiendaNube</li>
                <li>Registrará una transacción de uso manual</li>
              </ul>
              <p className="modal-warning">
                ⚠️ <strong>Esta acción no se puede deshacer</strong>
              </p>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-modal-cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-modal-confirm"
                onClick={handleMarkAsUsed}
              >
                Sí, marcar como usada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GiftCardDetail;
