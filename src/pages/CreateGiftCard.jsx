import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, DollarSign, Calendar, Image, Tag } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './CreateGiftCard.css';

// VERSION SIMPLIFICADA - Solo crear productos Gift Card
function CreateGiftCard() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [formData, setFormData] = useState({
    productName: '',
    amount: '',
    expiryMonths: '12',
    templateId: 'default'
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

    if (!formData.productName.trim()) {
      setError('El nombre del producto es obligatorio');
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
          expiresInDays: expiryDays,
          templateId: formData.templateId,
          publishAsProduct: true,  // SIEMPRE TRUE - solo creamos productos
          productName: formData.productName,
          productDescription: `Tarjeta regalo por ${formatCurrency(parseFloat(formData.amount))}. Válida por ${formData.expiryMonths} meses.`
        })
      });

      if (data.success) {
        toast.success('Producto Gift Card creado! Ya está publicado en tu tienda.');
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
            <h1>🎁 Nuevo Producto Gift Card</h1>
            <p>Creá un producto que tus clientes pueden comprar en tu tienda</p>
          </div>
        </div>
      </div>

      <div className="create-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {/* Info importante */}
          <div className="alert" style={{ 
            background: '#e0f2fe', 
            border: '1px solid #0ea5e9',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
              <span style={{ fontSize: '24px' }}>💡</span>
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#0369a1' }}>Cómo funciona</h4>
                <p style={{ margin: 0, color: '#075985', lineHeight: '1.6' }}>
                  Vas a crear un <strong>producto en tu tienda</strong>. Cuando un cliente lo compre, 
                  recibirá automáticamente un código de descuento por el monto que <strong>realmente pagó</strong> 
                  (incluyendo descuentos aplicados).
                </p>
              </div>
            </div>
          </div>

          {/* 1. NOMBRE */}
          <div className="form-group">
            <label>
              <Tag size={18} />
              Nombre del Producto *
            </label>
            <input
              type="text"
              placeholder="Ej: Tarjeta Regalo $50.000"
              value={formData.productName}
              onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
              required
              style={{ fontSize: '16px', padding: '14px' }}
            />
            <p className="form-hint">
              Este es el nombre que verán tus clientes en la tienda
            </p>
          </div>

          {/* 2. MONTO */}
          <div className="form-group">
            <label>
              <DollarSign size={18} />
              Monto de la Gift Card *
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
              style={{ fontSize: '16px', padding: '14px' }}
            />
            <p className="form-hint">
              El cliente recibirá un cupón por el monto que realmente pague (con descuentos aplicados)
            </p>
          </div>

          {/* 3. VALIDEZ */}
          <div className="form-group">
            <label>
              <Calendar size={18} />
              Validez del cupón
            </label>
            <select
              value={formData.expiryMonths}
              onChange={(e) => setFormData({ ...formData, expiryMonths: e.target.value })}
              style={{ fontSize: '16px', padding: '14px' }}
            >
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses (recomendado)</option>
              <option value="24">24 meses</option>
            </select>
            <p className="form-hint">
              Por cuánto tiempo el cupón será válido después de la compra
            </p>
          </div>

          {/* 4. DISEÑO */}
          <div className="form-group">
            <label>
              <Image size={18} />
              Diseño del cupón que recibirá el cliente
            </label>
            
            {loadingTemplates ? (
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>Cargando diseños...</p>
            ) : templates.length === 0 ? (
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #fbbf24', 
                borderRadius: '12px', 
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 12px 0', color: '#92400e' }}>
                  Todavía no tenés diseños personalizados
                </p>
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/gift-card-templates')}
                >
                  <Image size={16} />
                  Crear mi primer diseño
                </button>
              </div>
            ) : (
              <div className="template-selector-simple">
                {templates.map(template => (
                  <div
                    key={template.templateId}
                    className={`template-card-simple ${formData.templateId === template.templateId ? 'selected' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, templateId: template.templateId }))}
                  >
                    <div 
                      className="template-image"
                      style={{ backgroundImage: `url(${template.imageUrl})` }}
                    >
                      {template.isDefault && (
                        <span className="badge-default">Por defecto</span>
                      )}
                      {formData.templateId === template.templateId && (
                        <span className="badge-selected">✓ Seleccionado</span>
                      )}
                    </div>
                    <div className="template-info">
                      <strong>{template.name}</strong>
                      {template.category && (
                        <span className="category-badge">{template.category}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <p className="form-hint" style={{ marginTop: '12px' }}>
              💡 Este diseño aparecerá en el email que reciba el cliente con su código
            </p>
          </div>

          {/* Botones */}
          <div className="form-actions" style={{ 
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
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
              style={{ minWidth: '180px' }}
            >
              {loading ? (
                <>
                  <div className="spinner-small"></div>
                  Creando producto...
                </>
              ) : (
                <>
                  <Gift size={20} />
                  Crear Producto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGiftCard;
