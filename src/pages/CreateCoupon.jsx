import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Percent, DollarSign, Calendar, Hash, Zap } from 'lucide-react';
import { apiRequest } from '../config';
import './CreateCoupon.css';

function CreateCoupon() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    mode: 'single', // single o bulk
    code: '',
    prefix: '',
    quantity: 10,
    type: 'percentage', // percentage o absolute
    value: '',
    minAmount: '',
    maxDiscount: '',
    startDate: '',
    endDate: '',
    maxUses: '',
    description: '',
    // Nuevos campos
    restrictedEmail: '', // Email único que puede usar el cupón
    freeProductId: '', // ID del producto gratis
    freeProductName: '' // Nombre del producto (para mostrar)
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (formData.mode === 'single') {
        // Crear cupón individual
        if (!formData.code || !formData.value) {
          setError('Código y valor son requeridos');
          setLoading(false);
          return;
        }

        const data = await apiRequest('/api/coupons/create', {
          method: 'POST',
          body: JSON.stringify({
            storeId,
            code: formData.code.toUpperCase(),
            type: formData.type,
            value: parseFloat(formData.value),
            minAmount: formData.minAmount ? parseFloat(formData.minAmount) : null,
            maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
            startDate: formData.startDate || null,
            endDate: formData.endDate || null,
            maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
            description: formData.description || '',
            restrictedEmail: formData.restrictedEmail || null,
            freeProductId: formData.freeProductId || null,
            freeProductName: formData.freeProductName || null
          })
        });

        if (data.success) {
          setSuccess(`¡Cupón ${data.coupon.code} creado exitosamente!`);
          // Resetear formulario
          setFormData(prev => ({
            ...prev,
            code: '',
            value: '',
            minAmount: '',
            maxDiscount: '',
            maxUses: '',
            description: ''
          }));
        } else {
          setError(data.message || 'Error al crear cupón');
        }

      } else {
        // Crear cupones masivos
        if (!formData.quantity || !formData.value) {
          setError('Cantidad y valor son requeridos');
          setLoading(false);
          return;
        }

        const data = await apiRequest('/api/coupons/create-bulk', {
          method: 'POST',
          body: JSON.stringify({
            storeId,
            prefix: formData.prefix,
            quantity: parseInt(formData.quantity),
            type: formData.type,
            value: parseFloat(formData.value),
            minAmount: formData.minAmount ? parseFloat(formData.minAmount) : null,
            maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
            startDate: formData.startDate || null,
            endDate: formData.endDate || null,
            maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
            description: formData.description || '',
            restrictedEmail: formData.restrictedEmail || null,
            freeProductId: formData.freeProductId || null,
            freeProductName: formData.freeProductName || null
          })
        });

        if (data.success) {
          setSuccess(`¡${data.created} cupones creados exitosamente! ${data.errors > 0 ? `(${data.errors} errores)` : ''}`);
        } else {
          setError(data.message || 'Error al crear cupones');
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-coupon-container">
      <header className="create-coupon-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} />
          Volver
        </button>
        <h1>Crear Cupones</h1>
      </header>

      <div className="create-coupon-content">
        {/* Selector de modo */}
        <div className="mode-selector">
          <button
            className={`mode-btn ${formData.mode === 'single' ? 'active' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, mode: 'single' }))}
          >
            <Tag size={20} />
            Cupón Individual
          </button>
          <button
            className={`mode-btn ${formData.mode === 'bulk' ? 'active' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, mode: 'bulk' }))}
          >
            <Zap size={20} />
            Cupones Masivos
          </button>
        </div>

        <form onSubmit={handleSubmit} className="coupon-form">
          {/* Código o Prefijo */}
          {formData.mode === 'single' ? (
            <div className="form-group">
              <label>
                <Tag size={18} />
                Código del Cupón
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="VERANO2024"
                required
              />
              <small>El código será convertido a mayúsculas</small>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>
                  <Tag size={18} />
                  Prefijo
                </label>
                <input
                  type="text"
                  name="prefix"
                  value={formData.prefix}
                  onChange={handleChange}
                  placeholder="PROMO"
                />
                <small>Se agregará un código único después del prefijo</small>
              </div>
              <div className="form-group">
                <label>
                  <Hash size={18} />
                  Cantidad de Cupones
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  max="100"
                  required
                />
              </div>
            </>
          )}

          {/* Tipo de descuento */}
          <div className="form-group">
            <label>Tipo de Descuento</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="percentage"
                  checked={formData.type === 'percentage'}
                  onChange={handleChange}
                />
                <Percent size={18} />
                Porcentaje
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="type"
                  value="absolute"
                  checked={formData.type === 'absolute'}
                  onChange={handleChange}
                />
                <DollarSign size={18} />
                Monto Fijo
              </label>
            </div>
          </div>

          {/* Valor del descuento */}
          <div className="form-group">
            <label>
              {formData.type === 'percentage' ? <Percent size={18} /> : <DollarSign size={18} />}
              Valor del Descuento
            </label>
            <input
              type="number"
              name="value"
              value={formData.value}
              onChange={handleChange}
              placeholder={formData.type === 'percentage' ? '20' : '500'}
              step={formData.type === 'percentage' ? '1' : '0.01'}
              min="0"
              max={formData.type === 'percentage' ? '100' : undefined}
              required
            />
            <small>{formData.type === 'percentage' ? 'Porcentaje de descuento (0-100)' : 'Monto en pesos'}</small>
          </div>

          {/* Monto mínimo */}
          <div className="form-group">
            <label>
              <DollarSign size={18} />
              Monto Mínimo de Compra (Opcional)
            </label>
            <input
              type="number"
              name="minAmount"
              value={formData.minAmount}
              onChange={handleChange}
              placeholder="1000"
              step="0.01"
              min="0"
            />
          </div>

          {/* Descuento máximo */}
          {formData.type === 'percentage' && (
            <div className="form-group">
              <label>
                <DollarSign size={18} />
                Tope de Descuento (Opcional)
              </label>
              <input
                type="number"
                name="maxDiscount"
                value={formData.maxDiscount}
                onChange={handleChange}
                placeholder="5000"
                step="0.01"
                min="0"
              />
              <small>
                ⚠️ <strong>Limitación de TiendaNube:</strong> El tope se guarda en GlowLab pero TiendaNube no lo puede aplicar automáticamente. 
                Se usará para reportes y tracking.
              </small>
              {formData.maxDiscount && formData.value && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '10px', 
                  background: '#dbeafe', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe'
                }}>
                  💡 <strong>Sugerencia:</strong> Para que el descuento no supere ${formData.maxDiscount}, 
                  establecé un mínimo de compra de ${Math.ceil((formData.maxDiscount * 100) / formData.value)}
                </div>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <Calendar size={18} />
                Fecha Inicio (Opcional)
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>
                <Calendar size={18} />
                Fecha Fin (Opcional)
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Usos máximos */}
          <div className="form-group">
            <label>
              <Hash size={18} />
              Máximo de Usos (Opcional)
            </label>
            <input
              type="number"
              name="maxUses"
              value={formData.maxUses}
              onChange={handleChange}
              placeholder="100"
              min="1"
            />
            <small>Cantidad máxima de veces que se puede usar el cupón</small>
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label>Descripción (Opcional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Cupón de verano 2024"
              rows="3"
            />
          </div>

          {/* NUEVOS CAMPOS AVANZADOS */}
          <div className="form-section-advanced">
            <h3>⭐ Funciones Avanzadas</h3>
            
            {/* Email Único */}
            {formData.mode === 'single' && (
              <div className="form-group">
                <label>
                  Restringir a Email (Opcional)
                </label>
                <input
                  type="email"
                  name="restrictedEmail"
                  value={formData.restrictedEmail}
                  onChange={handleChange}
                  placeholder="cliente@email.com"
                />
                <small>Solo este email podrá usar el cupón</small>
              </div>
            )}

            {/* Producto Gratis */}
            <div className="form-group">
              <label>Producto Gratis (Opcional)</label>
              <div className="product-free-inputs">
                <input
                  type="text"
                  name="freeProductId"
                  value={formData.freeProductId}
                  onChange={handleChange}
                  placeholder="ID del producto"
                  style={{ flex: 1, marginRight: '10px' }}
                />
                <input
                  type="text"
                  name="freeProductName"
                  value={formData.freeProductName}
                  onChange={handleChange}
                  placeholder="Nombre del producto"
                  style={{ flex: 2 }}
                />
              </div>
              <small>Al usar este cupón, se agregará este producto gratis al carrito</small>
            </div>

            {/* Explicación Tope de Reintegro */}
            {formData.type === 'percentage' && formData.maxDiscount && (
              <div className="info-box-advanced">
                💰 <strong>Tope de Reintegro Activo:</strong> Este cupón da {formData.value}% de descuento hasta un máximo de ${formData.maxDiscount}
              </div>
            )}
          </div>

          {/* Mensajes */}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Botón submit */}
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Creando...
              </>
            ) : (
              <>
                <Tag size={20} />
                {formData.mode === 'single' ? 'Crear Cupón' : `Crear ${formData.quantity} Cupones`}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateCoupon;
