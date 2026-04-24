import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Gift, Search, Download, DollarSign, Calendar, Mail, User, CreditCard, Image } from 'lucide-react';
import { apiRequest } from '../config';
import './GiftCardsList.css';

function GiftCardsList() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [giftCards, setGiftCards] = useState([]);
  const [filteredGiftCards, setFilteredGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadGiftCards();
  }, []);

  useEffect(() => {
    filterGiftCardsData();
  }, [searchTerm, filterStatus, giftCards]);

  const loadGiftCards = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcards?storeId=${storeId}`);
      
      if (data.success) {
        setGiftCards(data.giftCards);
      }
    } catch (error) {
      console.error('Error loading gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterGiftCardsData = () => {
    let filtered = [...giftCards];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(gc => 
        gc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (gc.recipientEmail && gc.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (gc.recipientName && gc.recipientName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtrar por estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter(gc => gc.status === filterStatus);
    }

    setFilteredGiftCards(filtered);
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
    return date.toLocaleDateString('es-AR');
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

  const exportToCSV = () => {
    const headers = ['Código', 'Saldo', 'Monto Inicial', 'Destinatario', 'Email', 'Estado', 'Creada', 'Vence'];
    const rows = filteredGiftCards.map(gc => [
      gc.code,
      gc.balance,
      gc.initialAmount,
      gc.recipientName || '-',
      gc.recipientEmail || '-',
      gc.status,
      formatDate(gc.createdAt),
      formatDate(gc.expiresAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gift-cards-${new Date().toISOString()}.csv`;
    link.click();
  };

  const calculateStats = () => {
    const totalBalance = giftCards.reduce((sum, gc) => sum + gc.balance, 0);
    const totalIssued = giftCards.reduce((sum, gc) => sum + gc.initialAmount, 0);
    const totalUsed = totalIssued - totalBalance;
    const activeCards = giftCards.filter(gc => gc.status === 'active' || gc.status === 'partially_used').length;

    return { totalBalance, totalIssued, totalUsed, activeCards };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando gift cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="giftcards-list-container">
      {/* Modern Header */}
      <header className="giftcards-header-modern">
        <div className="header-content-wrapper">
          <div className="header-top">
            <div className="header-actions-modern">
              <button className="btn-secondary-modern" onClick={() => navigate('/gift-card-products')}>
                <CreditCard size={18} />
                <span>Productos</span>
              </button>
              <button className="btn-secondary-modern" onClick={() => navigate('/sold-gift-cards')}>
                <Gift size={18} />
                <span>Vendidas</span>
              </button>
              <button className="btn-secondary-modern" onClick={() => navigate('/gift-card-templates')}>
                <Image size={18} />
                <span>Diseños</span>
              </button>
              <button className="btn-primary-modern" onClick={() => navigate('/create-gift-card')}>
                <Plus size={18} />
                <span>Nueva Gift Card</span>
              </button>
            </div>
          </div>
          <div className="header-info-modern">
            <h1 className="page-title-modern">🎁 Gift Cards</h1>
            <p className="page-subtitle-modern">
              {filteredGiftCards.length} gift cards encontradas
            </p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7' }}>
            <DollarSign size={24} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p className="stat-label">Saldo Total</p>
            <p className="stat-value">{formatCurrency(stats.totalBalance)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0e7ff' }}>
            <CreditCard size={24} style={{ color: '#667eea' }} />
          </div>
          <div>
            <p className="stat-label">Total Emitido</p>
            <p className="stat-value">{formatCurrency(stats.totalIssued)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7' }}>
            <Gift size={24} style={{ color: '#d97706' }} />
          </div>
          <div>
            <p className="stat-label">Total Usado</p>
            <p className="stat-value">{formatCurrency(stats.totalUsed)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fce7f3' }}>
            <User size={24} style={{ color: '#db2777' }} />
          </div>
          <div>
            <p className="stat-label">Cards Activas</p>
            <p className="stat-value">{stats.activeCards}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section-modern">
        <div className="search-box-modern">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por código, email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-modern"
          />
        </div>

        <div className="filters-bar-modern">
          <select className="filter-select-modern" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">🎯 Todos los estados</option>
            <option value="active">✅ Activas</option>
            <option value="partially_used">📊 Uso Parcial</option>
            <option value="used">✓ Usadas</option>
            <option value="expired">❌ Vencidas</option>
          </select>

          <button className="btn-secondary-modern" onClick={exportToCSV}>
            <Download size={18} />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Gift Cards Grid */}
      <div className="giftcards-grid">
        {filteredGiftCards.length === 0 ? (
          <div className="empty-state">
            <Gift size={48} />
            <h3>No hay gift cards</h3>
            <p>
              {searchTerm || filterStatus !== 'all' 
                ? 'No se encontraron gift cards con estos filtros'
                : 'Creá tu primera gift card para empezar'}
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button className="btn-create-empty" onClick={() => navigate('/create-gift-card')}>
                <Plus size={20} />
                Crear Gift Card
              </button>
            )}
          </div>
        ) : (
          filteredGiftCards.map(giftCard => (
            <div key={giftCard.giftCardId} className="giftcard-card">
              {/* Header */}
              <div className="giftcard-header">
                <div className="giftcard-code">
                  <Gift size={18} />
                  <span>{giftCard.code}</span>
                </div>
                {getStatusBadge(giftCard)}
              </div>

              {/* Balance */}
              <div className="giftcard-balance">
                <span className="balance-label">Saldo Disponible</span>
                <span className="balance-amount">{formatCurrency(giftCard.balance)}</span>
                <span className="balance-initial">de {formatCurrency(giftCard.initialAmount)}</span>
              </div>

              {/* Progress Bar */}
              <div className="balance-progress">
                <div 
                  className="balance-progress-fill"
                  style={{ width: `${(giftCard.balance / giftCard.initialAmount) * 100}%` }}
                />
              </div>

              {/* Recipient Info */}
              {(giftCard.recipientName || giftCard.recipientEmail) && (
                <div className="giftcard-recipient">
                  <div className="recipient-item">
                    <User size={14} />
                    <span>{giftCard.recipientName || 'Sin nombre'}</span>
                  </div>
                  {giftCard.recipientEmail && (
                    <div className="recipient-item">
                      <Mail size={14} />
                      <span>{giftCard.recipientEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="giftcard-dates">
                <div className="date-item">
                  <Calendar size={14} />
                  <span>Creada: {formatDate(giftCard.createdAt)}</span>
                </div>
                {giftCard.expiresAt && (
                  <div className="date-item">
                    <Calendar size={14} />
                    <span>Vence: {formatDate(giftCard.expiresAt)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="giftcard-actions">
                <button 
                  className="btn-action"
                  onClick={() => navigate(`/gift-card/${giftCard.giftCardId}`)}
                >
                  Ver Detalles
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GiftCardsList;
