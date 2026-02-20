import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Mail, User, DollarSign, Calendar, MessageSquare, Image } from 'lucide-react';
import { apiRequest } from '../config';
import './CreateGiftCard.css';

function CreateGiftCard() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [formData, setFormData] = useState({
    amount: '',
    recipientEmail: '',
    recipientName: '',
    senderName: '',
    message: '',
    expiryMonths: '12',
    templateId: 'default',
    publishAsProduct: false,
    productName: '',
    productDescription: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const presetAmounts = [5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await apiRequest(`/api/giftcard-templates?storeId=${storeId}`);
      
      if (data.success) {
        setTemplates(data.templates || []);
        
        // Seleccionar el template por defecto
        const defaultTemplate = data.templates.find(t => t.isDefault);
        if (defaultTemplate) {
          setFormData(prev => ({ ...prev, templateId: defaultTemplate.templateId }));
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    if (!formData.publishAsProduct && !formData.recipientEmail) {
      setError('El email del destinatario es obligatorio (o publicá como producto)');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const expiryDays = parseInt(formData.expiryMonths) * 30;

      const data = await apiRequest('/api/giftcards/create', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          amount: parseFloat(formData.amount),
          recipientEmail: formData.recipientEmail,
          recipientName: formData.recipientName,
          senderName: formData.senderName,
          message: formData.message,
          expiresInDays: expiryDays,
          templateId: formData.templateId,
          publishAsProduct: formData.publishAsProduct,
          productName: formData.productName,
          productDescription: formData.productDescription
        })
      });

      if (data.success) {
        if (formData.publishAsProduct) {
          alert(`✅ Gift Card creada y publicada como producto!\n\nAhora tus clientes pueden comprarla en tu tienda.`);
        } else {
          alert(`✅ Gift Card creada exitosamente!\n\nCódigo: ${data.giftCard.code}\nSaldo: $${data.giftCard.balance}`);
        }
        navigate('/gift-cards');
      } else {
        setError(data.error || 'Error al crear gift card');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al crear gift card. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/gift-cards')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>🎁 Nueva Gift Card</h1>
            <p>Creá una tarjeta regalo para tus clientes</p>
          </div>
        </div>
      </div>

      <div className="create-content">
        {/* Form */}
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            {/* Monto */}
            <div className="form-group">
              <label>
                <DollarSign size={18} />
                Monto de la Gift Card
              </label>
              <div className="preset-amounts">
                {presetAmounts.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    className={`preset-btn ${formData.amount === amount.toString() ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, amount: amount.toString() })}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="O ingresá un monto personalizado"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            {/* Publicar como Producto */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.publishAsProduct}
                  onChange={(e) => setFormData({ ...formData, publishAsProduct: e.target.checked })}
                />
                <span>🛍️ Publicar como producto en mi tienda</span>
              </label>
              <p className="form-hint">
                Los clientes podrán comprar esta gift card directamente desde tu tienda
              </p>
              
              {/* Info box sobre cómo funciona el monto */}
              {formData.publishAsProduct && (
                <div className="info-box" style={{ marginTop: '12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>💡</span>
                    <div>
                      <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#92400e' }}>
                        ℹ️ Importante: Monto de la Gift Card
                      </p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#78350f' }}>
                        <strong>El valor de la gift card será el monto que el cliente REALMENTE pague</strong>, no el precio del producto.
                      </p>
                      <p style={{ margin: '0', fontSize: '13px', color: '#78350f', lineHeight: '1.5' }}>
                        <strong>Ejemplo:</strong> Si publicas una gift card de $100.000 pero el cliente paga con 15% de descuento en efectivo ($85.000), 
                        recibirá una gift card por <strong>$85.000</strong>. Esto evita confusiones y pérdidas para tu negocio.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Campos del Producto (si está marcado) */}
            {formData.publishAsProduct && (
              <div className="product-fields">
                <div className="form-group">
                  <label>
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    placeholder={`Gift Card $${formData.amount ? formatCurrency(parseFloat(formData.amount)) : '...'}`}
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Descripción del Producto
                  </label>
                  <textarea
                    placeholder="Tarjeta regalo perfecta para cualquier ocasión..."
                    value={formData.productDescription}
                    onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Destinatario (solo si NO es producto) */}
            {!formData.publishAsProduct && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <Mail size={18} />
                      Email del Destinatario *
                    </label>
                    <input
                      type="email"
                      placeholder="cliente@ejemplo.com"
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                      required={!formData.publishAsProduct}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <User size={18} />
                      Nombre del Destinatario
                    </label>
                    <input
                      type="text"
                      placeholder="Juan Pérez"
                      value={formData.recipientName}
                      onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Remitente */}
                <div className="form-group">
                  <label>
                    <User size={18} />
                    Tu Nombre (Remitente)
                  </label>
                  <input
                    type="text"
                    placeholder="María González"
                    value={formData.senderName}
                    onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  />
                </div>

                {/* Mensaje */}
                <div className="form-group">
                  <label>
                    <MessageSquare size={18} />
                    Mensaje Personalizado
                  </label>
                  <textarea
                    placeholder="¡Feliz cumpleaños! Esperamos que disfrutes este regalo..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                  />
                </div>
              </>
            )}

            {/* Vencimiento */}
            <div className="form-group">
              <label>
                <Calendar size={18} />
                Vencimiento
              </label>
              <select
                value={formData.expiryMonths}
                onChange={(e) => setFormData({ ...formData, expiryMonths: e.target.value })}
              >
                <option value="3">3 meses</option>
                <option value="6">6 meses</option>
                <option value="12">12 meses</option>
                <option value="24">24 meses</option>
              </select>
            </div>

            {/* Template/Diseño */}
            <div className="form-group">
              <label>
                <Image size={18} />
                Diseño de la Gift Card
              </label>
              
              {loadingTemplates ? (
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Cargando diseños...</p>
              ) : templates.length === 0 ? (
                <div style={{ 
                  background: '#fef3c7', 
                  border: '1px solid #fbbf24', 
                  borderRadius: '8px', 
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                    No tienes diseños personalizados todavía.
                  </p>
                  <button 
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate('/gift-card-templates')}
                  >
                    <Image size={16} />
                    Crear Diseños
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Agrupar templates por categoría */}
                  {(() => {
                    const grouped = templates.reduce((acc, template) => {
                      const category = template.category || 'General';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(template);
                      return acc;
                    }, {});
                    
                    return Object.entries(grouped).map(([category, categoryTemplates]) => (
                      <div key={category} style={{ marginBottom: '12px' }}>
                        <h4 style={{ 
                          margin: '0 0 12px 0', 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: 'rgba(255, 255, 255, 0.95)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {category}
                        </h4>
                        <div className="template-selector">
                          {categoryTemplates.map(template => (
                            <div
                              key={template.templateId}
                              className={`template-option ${formData.templateId === template.templateId ? 'selected' : ''}`}
                              onClick={() => setFormData(prev => ({ ...prev, templateId: template.templateId }))}
                            >
                              <div 
                                className="template-thumbnail"
                                style={{ backgroundImage: `url(${template.imageUrl})` }}
                              >
                                {template.isDefault && (
                                  <span className="default-label">Por defecto</span>
                                )}
                              </div>
                              <span className="template-name">{template.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
              
              <p className="form-hint" style={{ marginTop: '8px' }}>
                💡 Los diseños ahora están organizados por categoría para que encuentres el perfecto para cada ocasión
              </p>
            </div>

            {/* Botones */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/gift-cards')}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <Gift size={20} />
                    Crear Gift Card
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Preview */}
        <div className="preview-section">
          <h3>Vista Previa</h3>
          <div className="giftcard-preview">
            <div className="preview-card">
              <div className="preview-header">
                <Gift size={32} />
                <span className="preview-title">GIFT CARD</span>
              </div>
              
              <div className="preview-amount">
                {formData.amount ? formatCurrency(parseFloat(formData.amount)) : '$0'}
              </div>

              {formData.message && (
                <div className="preview-message">
                  "{formData.message}"
                </div>
              )}

              <div className="preview-from">
                {formData.senderName && (
                  <span>De: {formData.senderName}</span>
                )}
              </div>

              <div className="preview-to">
                {formData.recipientName && (
                  <span>Para: {formData.recipientName}</span>
                )}
              </div>

              <div className="preview-code">
                GIFT-XXXXXXXX
              </div>

              <div className="preview-footer">
                Válido por {formData.expiryMonths} meses
              </div>
            </div>
          </div>

          <div className="preview-info">
            <p>
              💡 <strong>Tip:</strong> La gift card se enviará automáticamente al email del destinatario con un código único para canjear.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateGiftCard;
