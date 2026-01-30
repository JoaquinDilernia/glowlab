import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, User, Mail, DollarSign, Calendar, CheckCircle, Clock, Package } from 'lucide-react';
import { apiRequest } from '../config';
import './SoldGiftCards.css';

function SoldGiftCards() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, used

  useEffect(() => {
    loadSoldGiftCards();
  }, []);

  const loadSoldGiftCards = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcards/sold?storeId=${storeId}`);
      
      if (data.success) {
        setGiftCards(data.giftCards || []);
      }
    } catch (error) {
      console.error('Error loading sold gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp._seconds 
      ? new Date(timestamp._seconds * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (card) => {
    if (card.balance === 0 || card.status === 'used') {
      return <span className="badge badge-used">Usada</span>;
    }
    if (card.balance < card.initialAmount) {
      return <span className="badge badge-partial">Uso Parcial</span>;
    }
    return <span className="badge badge-active">Activa</span>;
  };

  const filteredGiftCards = giftCards.filter(card => {
    if (filter === 'all') return true;
    if (filter === 'active') return card.balance > 0;
    if (filter === 'used') return card.balance === 0;
    return true;
  });

  const stats = {
    total: giftCards.length,
    active: giftCards.filter(c => c.balance > 0).length,
    used: giftCards.filter(c => c.balance === 0).length,
    totalSold: giftCards.reduce((sum, c) => sum + c.initialAmount, 0),
    totalUsed: giftCards.reduce((sum, c) => sum + (c.initialAmount - c.balance), 0)
  };

  if (loading) {
    return (
      <div className="sold-gift-cards-page">
        <div className="loading">Cargando gift cards vendidas...</div>
      </div>
    );
  }

  return (
    <div className="sold-gift-cards-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={() => navigate('/gift-cards')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-content">
          <div className="header-icon">
            <Gift size={32} />
          </div>
          <div>
            <h1>Gift Cards Vendidas</h1>
            <p>Códigos generados automáticamente por compras</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {giftCards.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Package size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Vendidas</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-success">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Activas</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-gray">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.used}</div>
              <div className="stat-label">Usadas</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-purple">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.totalSold)}</div>
              <div className="stat-label">Monto Total Vendido</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-orange">
              <DollarSign size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(stats.totalUsed)}</div>
              <div className="stat-label">Monto Total Usado</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {giftCards.length > 0 && (
        <div className="filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({giftCards.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Activas ({stats.active})
          </button>
          <button 
            className={`filter-btn ${filter === 'used' ? 'active' : ''}`}
            onClick={() => setFilter('used')}
          >
            Usadas ({stats.used})
          </button>
        </div>
      )}

      {/* Empty State */}
      {giftCards.length === 0 && (
        <div className="empty-state">
          <Gift size={64} />
          <h2>No hay gift cards vendidas todavía</h2>
          <p>Cuando un cliente compre un producto gift card, aparecerá aquí con toda la información</p>
        </div>
      )}

      {/* Gift Cards List */}
      {filteredGiftCards.length > 0 && (
        <div className="gift-cards-list">
          {filteredGiftCards.map((card) => (
            <div key={card.giftCardId} className="gift-card-item">
              <div className="gift-card-header">
                <div className="gift-card-code">
                  <Gift size={20} />
                  <span className="code">{card.code}</span>
                </div>
                {getStatusBadge(card)}
              </div>

              <div className="gift-card-body">
                <div className="info-row">
                  <div className="info-item">
                    <User size={16} />
                    <div>
                      <div className="info-label">Cliente</div>
                      <div className="info-value">{card.recipientName || 'Sin nombre'}</div>
                    </div>
                  </div>

                  <div className="info-item">
                    <Mail size={16} />
                    <div>
                      <div className="info-label">Email</div>
                      <div className="info-value">{card.recipientEmail || 'Sin email'}</div>
                    </div>
                  </div>
                </div>

                <div className="info-row">
                  <div className="info-item">
                    <DollarSign size={16} />
                    <div>
                      <div className="info-label">Monto Inicial</div>
                      <div className="info-value">{formatCurrency(card.initialAmount)}</div>
                    </div>
                  </div>

                  <div className="info-item">
                    <DollarSign size={16} />
                    <div>
                      <div className="info-label">Saldo Actual</div>
                      <div className="info-value balance">{formatCurrency(card.balance)}</div>
                    </div>
                  </div>
                </div>

                <div className="info-row">
                  <div className="info-item">
                    <Package size={16} />
                    <div>
                      <div className="info-label">Pedido</div>
                      <div className="info-value">#{card.orderNumber || card.orderId}</div>
                    </div>
                  </div>

                  {card.usageCount > 0 && (
                    <div className="info-item">
                      <CheckCircle size={16} />
                      <div>
                        <div className="info-label">Usos</div>
                        <div className="info-value">{card.usageCount} vez/veces</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="gift-card-footer">
                  <div className="footer-item">
                    <Calendar size={14} />
                    <span>Creada: {formatDate(card.createdAt)}</span>
                  </div>
                  {card.sentAt && (
                    <div className="footer-item">
                      <Mail size={14} />
                      <span>Email enviado: {formatDate(card.sentAt)}</span>
                    </div>
                  )}
                  {card.lastUsedAt && (
                    <div className="footer-item">
                      <CheckCircle size={14} />
                      <span>Último uso: {formatDate(card.lastUsedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredGiftCards.length === 0 && giftCards.length > 0 && (
        <div className="empty-state">
          <Gift size={48} />
          <p>No hay gift cards con este filtro</p>
        </div>
      )}
    </div>
  );
}

export default SoldGiftCards;
