import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Percent, Gift, TrendingUp, ShoppingCart, Sparkles, Calendar, DollarSign } from 'lucide-react';
import { apiRequest } from '../config';
import './CreatePromotion.css';

function CreatePromotion() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    type: 'buy_x_pay_y', // buy_x_pay_y, price_discount, cross_selling, progressive_discount, cart_discount
    description: '',
    startDate: '',
    endDate: '',
    active: true,
    
    // Buy X Pay Y (2x1, 3x2, etc.)
    buyQuantity: 2,
    payQuantity: 1,
    
    // Price Discount (Descuento sobre precios)
    discountType: 'percentage', // percentage, fixed
    discountValue: '',
    maxDiscount: '',
    
    // Progressive Discount
    progressiveRules: [
      { minQuantity: 2, discountPercent: 10 },
      { minQuantity: 5, discountPercent: 20 }
    ],
    
    // Cross Selling
    crossSellingProducts: [],
    crossSellingDiscount: '',
    
    // Aplicación
    applyTo: 'all_products', // all_products, specific_products, categories
    selectedProducts: [],
    selectedCategories: [],
    minPurchaseAmount: ''
  });

  const promotionTypes = [
    {
      id: 'buy_x_pay_y',
      name: 'Lleva X y paga Y',
      description: '2x1, 3x2, 4x3, etc.',
      icon: Gift,
      color: '#10b981'
    },
    {
      id: 'price_discount',
      name: 'Descuento sobre precios',
      description: 'Precio tachado con descuento',
      icon: Percent,
      color: '#f59e0b'
    },
    {
      id: 'progressive_discount',
      name: 'Descuento progresivo',
      description: 'Más compras = más descuento',
      icon: TrendingUp,
      color: '#8b5cf6'
    },
    {
      id: 'cross_selling',
      name: 'Cross Selling',
      description: 'Descuento al comprar productos relacionados',
      icon: ShoppingCart,
      color: '#06b6d4'
    },
    {
      id: 'cart_discount',
      name: 'Descuento en carrito',
      description: 'Descuento automático en el checkout',
      icon: Sparkles,
      color: '#ec4899'
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiRequest('/api/promotions/create', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          ...formData
        })
      });

      if (data.success) {
        setSuccess('¡Promoción creada exitosamente!');
        setTimeout(() => {
          navigate('/promotions');
        }, 2000);
      } else {
        setError(data.message || 'Error al crear promoción');
      }
    } catch (err) {
      setError('Error al crear promoción. Por favor intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addProgressiveRule = () => {
    setFormData(prev => ({
      ...prev,
      progressiveRules: [...prev.progressiveRules, { minQuantity: 0, discountPercent: 0 }]
    }));
  };

  const removeProgressiveRule = (index) => {
    setFormData(prev => ({
      ...prev,
      progressiveRules: prev.progressiveRules.filter((_, i) => i !== index)
    }));
  };

  const updateProgressiveRule = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      progressiveRules: prev.progressiveRules.map((rule, i) => 
        i === index ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const selectedType = promotionTypes.find(t => t.id === formData.type);

  return (
    <div className="create-promotion-container">
      {/* Header */}
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} />
          Volver
        </button>
        <div>
          <h1>Crear Promoción</h1>
          <p className="subtitle">Crea promociones avanzadas para tu tienda</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="promotion-form">
        {/* Tipo de Promoción */}
        <div className="form-section">
          <h2>Tipo de Promoción</h2>
          <div className="promotion-types-grid">
            {promotionTypes.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`promotion-type-card ${formData.type === type.id ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                >
                  <div 
                    className="type-icon"
                    style={{ backgroundColor: `${type.color}20`, color: type.color }}
                  >
                    <Icon size={24} />
                  </div>
                  <h3>{type.name}</h3>
                  <p>{type.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Información Básica */}
        <div className="form-section">
          <h2>Información Básica</h2>
          
          <div className="form-group">
            <label>Nombre de la Promoción *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: 2x1 en remeras de verano"
              required
            />
            <small>Este nombre es solo para tu referencia interna</small>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción de la promoción..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <Calendar size={16} />
                Fecha de Inicio
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={16} />
                Fecha de Fin
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Configuración según tipo */}
        <div className="form-section">
          <h2>Configuración de "{selectedType?.name}"</h2>
          
          {/* Buy X Pay Y */}
          {formData.type === 'buy_x_pay_y' && (
            <div className="promotion-config">
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad a comprar *</label>
                  <input
                    type="number"
                    min="2"
                    value={formData.buyQuantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, buyQuantity: parseInt(e.target.value) }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cantidad a pagar *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.payQuantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, payQuantity: parseInt(e.target.value) }))}
                    required
                  />
                </div>
              </div>
              <div className="preview-box">
                <Gift size={20} />
                <p>Vista previa: <strong>Lleva {formData.buyQuantity} y paga {formData.payQuantity}</strong></p>
              </div>
            </div>
          )}

          {/* Price Discount */}
          {formData.type === 'price_discount' && (
            <div className="promotion-config">
              <div className="form-group">
                <label>Tipo de descuento</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto Fijo</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    {formData.discountType === 'percentage' ? <Percent size={16} /> : <DollarSign size={16} />}
                    Valor del descuento *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={formData.discountType === 'percentage' ? '1' : '0.01'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                    placeholder={formData.discountType === 'percentage' ? '20' : '500'}
                    required
                  />
                </div>

                {formData.discountType === 'percentage' && (
                  <div className="form-group">
                    <label>
                      <DollarSign size={16} />
                      Descuento máximo
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxDiscount: e.target.value }))}
                      placeholder="5000"
                    />
                    <small>Límite del descuento en pesos</small>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progressive Discount */}
          {formData.type === 'progressive_discount' && (
            <div className="promotion-config">
              <p className="help-text">Define descuentos según la cantidad de productos comprados</p>
              
              {formData.progressiveRules.map((rule, index) => (
                <div key={index} className="progressive-rule">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Cantidad mínima</label>
                      <input
                        type="number"
                        min="1"
                        value={rule.minQuantity}
                        onChange={(e) => updateProgressiveRule(index, 'minQuantity', parseInt(e.target.value))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Descuento (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={rule.discountPercent}
                        onChange={(e) => updateProgressiveRule(index, 'discountPercent', parseInt(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                  {formData.progressiveRules.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-rule"
                      onClick={() => removeProgressiveRule(index)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn-add-rule"
                onClick={addProgressiveRule}
              >
                + Agregar Regla
              </button>
            </div>
          )}

          {/* Cross Selling */}
          {formData.type === 'cross_selling' && (
            <div className="promotion-config">
              <div className="form-group">
                <label>Descuento al comprar productos relacionados</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.crossSellingDiscount}
                  onChange={(e) => setFormData(prev => ({ ...prev, crossSellingDiscount: e.target.value }))}
                  placeholder="15"
                  required
                />
                <small>% de descuento cuando compran productos de esta promoción juntos</small>
              </div>
            </div>
          )}

          {/* Cart Discount */}
          {formData.type === 'cart_discount' && (
            <div className="promotion-config">
              <div className="form-group">
                <label>Tipo de descuento</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto Fijo</option>
                </select>
              </div>

              <div className="form-group">
                <label>Valor del descuento *</label>
                <input
                  type="number"
                  min="0"
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  value={formData.discountValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                  placeholder={formData.discountType === 'percentage' ? '10' : '1000'}
                  required
                />
              </div>

              <div className="form-group">
                <label>Monto mínimo de compra</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minPurchaseAmount}
                  onChange={(e) => setFormData(prev => ({ ...prev, minPurchaseAmount: e.target.value }))}
                  placeholder="5000"
                />
                <small>El carrito debe superar este monto para aplicar el descuento</small>
              </div>
            </div>
          )}
        </div>

        {/* Aplicar a */}
        <div className="form-section">
          <h2>¿A qué productos aplicar?</h2>
          
          <div className="form-group">
            <label>Selecciona los productos</label>
            <select
              value={formData.applyTo}
              onChange={(e) => setFormData(prev => ({ ...prev, applyTo: e.target.value }))}
            >
              <option value="all_products">Todos los productos</option>
              <option value="specific_products">Productos específicos</option>
              <option value="categories">Categorías</option>
            </select>
          </div>

          {formData.applyTo === 'specific_products' && (
            <div className="info-box">
              <Tag size={20} />
              <p>Selección de productos específicos disponible próximamente. Por ahora aplica a todos los productos.</p>
            </div>
          )}

          {formData.applyTo === 'categories' && (
            <div className="info-box">
              <Tag size={20} />
              <p>Selección por categorías disponible próximamente. Por ahora aplica a todos los productos.</p>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="message message-error">
            {error}
          </div>
        )}

        {success && (
          <div className="message message-success">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/dashboard')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Creando...' : 'Crear Promoción'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreatePromotion;
