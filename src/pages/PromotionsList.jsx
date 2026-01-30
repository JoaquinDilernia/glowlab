import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Gift, TrendingUp, ShoppingCart, Sparkles, Tag, Percent, Calendar, Eye, EyeOff, Trash2, Filter } from 'lucide-react';
import { apiRequest } from '../config';
import './PromotionsList.css';

function PromotionsList() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [filteredPromotions, setFilteredPromotions] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, []);

  useEffect(() => {
    filterPromotions();
  }, [filterType, promotions]);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/promotions?storeId=${storeId}`);
      
      if (data.success) {
        setPromotions(data.promotions || []);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPromotions = () => {
    let filtered = [...promotions];

    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.type === filterType);
    }

    setFilteredPromotions(filtered);
  };

  const getTypeInfo = (type) => {
    const types = {
      buy_x_pay_y: { name: 'Lleva X y paga Y', icon: Gift, color: '#10b981' },
      price_discount: { name: 'Descuento sobre precios', icon: Percent, color: '#f59e0b' },
      progressive_discount: { name: 'Descuento progresivo', icon: TrendingUp, color: '#8b5cf6' },
      cross_selling: { name: 'Cross Selling', icon: ShoppingCart, color: '#06b6d4' },
      cart_discount: { name: 'Descuento en carrito', icon: Sparkles, color: '#ec4899' }
    };
    return types[type] || { name: type, icon: Tag, color: '#64748b' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-large"></div>
        <p>Cargando promociones...</p>
      </div>
    );
  }

  return (
    <div className="promotions-list-container">
      {/* Header */}
      <header className="promotions-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
            Volver
          </button>
          <div>
            <h1>Mis Promociones</h1>
            <p className="subtitle">{filteredPromotions.length} promociones</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-create" onClick={() => navigate('/create-promotion')}>
            <Plus size={18} />
            Crear Promoción
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="filters-section">
        <button className="btn-filters" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={18} />
          Filtros
        </button>

        {showFilters && (
          <div className="filters-dropdown">
            <div className="filter-group">
              <label>Tipo de Promoción</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Todas</option>
                <option value="buy_x_pay_y">Lleva X y paga Y</option>
                <option value="price_discount">Descuento sobre precios</option>
                <option value="progressive_discount">Descuento progresivo</option>
                <option value="cross_selling">Cross Selling</option>
                <option value="cart_discount">Descuento en carrito</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Promotions Grid */}
      <div className="promotions-grid">
        {filteredPromotions.length === 0 ? (
          <div className="empty-state">
            <Gift size={48} />
            <h3>No hay promociones</h3>
            <p>Crea tu primera promoción para empezar</p>
            <button className="btn-create-empty" onClick={() => navigate('/create-promotion')}>
              <Plus size={20} />
              Crear Promoción
            </button>
          </div>
        ) : (
          filteredPromotions.map(promo => {
            const typeInfo = getTypeInfo(promo.type);
            const Icon = typeInfo.icon;

            return (
              <div key={promo.promotionId} className={`promotion-card ${!promo.active ? 'inactive' : ''}`}>
                {/* Header */}
                <div className="promotion-card-header">
                  <div className="promotion-type" style={{ color: typeInfo.color }}>
                    <Icon size={20} />
                    <span>{typeInfo.name}</span>
                  </div>
                  <span className={`badge badge-${promo.active ? 'active' : 'inactive'}`}>
                    {promo.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                {/* Name */}
                <h3 className="promotion-name">{promo.name}</h3>
                
                {promo.description && (
                  <p className="promotion-description">{promo.description}</p>
                )}

                {/* Details */}
                <div className="promotion-details">
                  {promo.type === 'buy_x_pay_y' && (
                    <div className="detail-badge">
                      Lleva {promo.buyQuantity} y paga {promo.payQuantity}
                    </div>
                  )}
                  
                  {(promo.type === 'price_discount' || promo.type === 'cart_discount') && promo.discountValue && (
                    <div className="detail-badge">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `$${promo.discountValue}`} OFF
                    </div>
                  )}
                  
                  {promo.type === 'progressive_discount' && promo.progressiveRules && (
                    <div className="detail-badge">
                      {promo.progressiveRules.length} reglas configuradas
                    </div>
                  )}
                </div>

                {/* Dates */}
                {(promo.startDate || promo.endDate) && (
                  <div className="promotion-dates">
                    <Calendar size={14} />
                    <span>
                      {promo.startDate && formatDate(promo.startDate)}
                      {promo.startDate && promo.endDate && ' - '}
                      {promo.endDate && formatDate(promo.endDate)}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="promotion-actions">
                  <button className="btn-action" title="Ver detalles">
                    <Eye size={16} />
                  </button>
                  <button className="btn-action btn-danger" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default PromotionsList;
