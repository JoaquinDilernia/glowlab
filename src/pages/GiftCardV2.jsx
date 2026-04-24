import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Send, ExternalLink, CheckCircle, XCircle, Package, Mail, Settings, List, Zap, Copy, Image, Upload } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './GiftCardV2.css';

const storeId = localStorage.getItem('promonube_store_id');

function GiftCardV2() {
  const toast = useToast();
  const [tab, setTab] = useState('config');
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Setup state
  const [newAmounts, setNewAmounts] = useState([500, 1000, 2000, 5000]);
  const [amountInput, setAmountInput] = useState('');
  const [productName, setProductName] = useState('Gift Card');
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  // Design state
  const [description, setDescription] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [savingDesign, setSavingDesign] = useState(false);

  useEffect(() => { loadConfig(); }, []);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const data = await apiRequest(`/api/giftcard-v2/config?storeId=${storeId}`);
      if (data.success) {
        setConfig(data.config);
        if (data.config?.amounts) setNewAmounts(data.config.amounts);
        if (data.config?.description) setDescription(data.config.description);
        if (data.config?.emailMessage) setEmailMessage(data.config.emailMessage);
        if (data.config?.imageUrl) setImagePreview(data.config.imageUrl);
      }
    } catch (e) {
      toast.error('Error al cargar configuración de Gift Cards');
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await apiRequest(`/api/giftcard-v2/orders?storeId=${storeId}`);
      if (data.success) setOrders(data.orders);
    } catch (e) {
      toast.error('Error al cargar órdenes');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSetup = async () => {
    if (newAmounts.length === 0) return toast.warn('Agregá al menos un monto');
    setSaving(true);
    try {
      const data = await apiRequest('/api/giftcard-v2/setup', {
        method: 'POST',
        body: JSON.stringify({ storeId, amounts: newAmounts, productName })
      });
      if (data.success) {
        setConfig(data.config);
        toast.success('¡Producto creado en TiendaNube y Gift Card configurada!');
      } else {
        toast.error(data.message || 'Error al crear el producto');
      }
    } catch (e) {
      toast.error('Error al crear el producto en TiendaNube');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const data = await apiRequest('/api/giftcard-v2/config', {
        method: 'PUT',
        body: JSON.stringify({ storeId, enabled: !config.enabled })
      });
      if (data.success) {
        setConfig(data.config);
        toast.success(data.config.enabled ? 'Gift Card activada' : 'Gift Card desactivada');
      }
    } catch (e) {
      toast.error('Error al actualizar');
    }
  };

  const handleSyncAmounts = async () => {
    if (newAmounts.length === 0) return toast.warn('Agregá al menos un monto');
    setSaving(true);
    try {
      const data = await apiRequest('/api/giftcard-v2/config', {
        method: 'PUT',
        body: JSON.stringify({ storeId, amounts: newAmounts })
      });
      if (data.success) {
        setConfig(data.config);
        toast.success('Montos sincronizados con TiendaNube');
      } else {
        toast.error(data.message || 'Error al sincronizar');
      }
    } catch (e) {
      toast.error('Error al sincronizar montos');
    } finally {
      setSaving(false);
    }
  };

  const addAmount = () => {
    const val = parseInt(amountInput);
    if (!val || val <= 0) return toast.warn('Ingresá un monto válido');
    if (newAmounts.includes(val)) return toast.warn('Ese monto ya existe');
    setNewAmounts(prev => [...prev, val].sort((a, b) => a - b));
    setAmountInput('');
  };

  const removeAmount = (amount) => {
    if (newAmounts.length <= 1) return toast.warn('Debe haber al menos un monto');
    setNewAmounts(prev => prev.filter(a => a !== amount));
  };

  const handleResendEmail = async (order) => {
    setResendingId(order.id);
    try {
      const data = await apiRequest('/api/giftcard-v2/resend-email', {
        method: 'POST',
        body: JSON.stringify({ storeId, orderId: order.id })
      });
      if (data.success) {
        toast.success('Email reenviado correctamente');
        loadOrders();
      } else {
        toast.error(data.message || 'Error al reenviar');
      }
    } catch (e) {
      toast.error('Error al reenviar email');
    } finally {
      setResendingId(null);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.info(`Código copiado: ${code}`);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.warn('La imagen no debe superar 3MB');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveDesign = async () => {
    setSavingDesign(true);
    try {
      let didUploadImage = false;
      if (imageFile && imagePreview && imagePreview.startsWith('data:')) {
        const uploadData = await apiRequest('/api/giftcard-v2/upload-image', {
          method: 'POST',
          body: JSON.stringify({ storeId, imageBase64: imagePreview, mimeType: imageFile.type })
        });
        if (uploadData.success) {
          setImagePreview(uploadData.imageUrl);
          setImageFile(null);
          didUploadImage = true;
        } else {
          toast.error(uploadData.message || 'Error al subir imagen');
          setSavingDesign(false);
          return;
        }
      }
      const data = await apiRequest('/api/giftcard-v2/design', {
        method: 'PUT',
        body: JSON.stringify({ storeId, description, emailMessage })
      });
      if (data.success) {
        setConfig(data.config);
        toast.success(didUploadImage ? 'Imagen y diseño guardados ✓' : 'Diseño guardado correctamente');
      } else {
        toast.error(data.message || 'Error al guardar diseño');
      }
    } catch (e) {
      toast.error('Error al guardar diseño');
    } finally {
      setSavingDesign(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (n) => `$${(n || 0).toLocaleString('es-AR')}`;

  if (loadingConfig) {
    return (
      <div className="gc2-loading">
        <div className="gc2-spinner" />
        <p>Cargando Gift Cards...</p>
      </div>
    );
  }

  return (
    <div className="gc2-root">
      {/* Page header */}
      <div className="gc2-page-header">
        <div className="gc2-page-title-wrapper">
          <h1 className="gc2-page-title">🎁 Gift Cards</h1>
          <p className="gc2-page-subtitle">Producto único en TiendaNube con variantes Física / Digital por monto</p>
        </div>
        {config && (
          <div className="gc2-status-pill">
            <span className={`gc2-dot ${config.enabled ? 'on' : 'off'}`} />
            {config.enabled ? 'Activo' : 'Inactivo'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="gc2-tabs">
        <button className={`gc2-tab ${tab === 'config' ? 'active' : ''}`} onClick={() => setTab('config')}>
          <Settings size={15} /> Configuración
        </button>
        <button className={`gc2-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <List size={15} /> Órdenes {orders.length > 0 && <span className="gc2-badge">{orders.length}</span>}
        </button>
      </div>

      {/* ── TAB CONFIG ─────────────────────────── */}
      {tab === 'config' && (
        <div className="gc2-tab-content">
          {!config ? (
            /* ── SETUP INICIAL ── */
            <div className="gc2-setup-card">
              <div className="gc2-setup-icon">🎁</div>
              <h2>Configurar Gift Cards</h2>
              <p className="gc2-setup-desc">
                GlowLab va a crear automáticamente un producto en tu tienda con variantes
                <strong> Física / Digital</strong> y los montos que configures. Cada venta genera
                un código único, agrega una nota en la orden y — si es digital — envía el
                email al comprador.
              </p>

              <div className="gc2-field">
                <label>Nombre del producto en TiendaNube</label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Gift Card"
                  className="gc2-input"
                />
              </div>

              <div className="gc2-field">
                <label>Montos disponibles</label>
                <div className="gc2-amounts-list">
                  {newAmounts.map(a => (
                    <div key={a} className="gc2-amount-chip">
                      <span>{formatCurrency(a)}</span>
                      <button onClick={() => removeAmount(a)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="gc2-amount-add">
                  <span className="gc2-currency-prefix">$</span>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAmount()}
                    placeholder="Ej: 3000"
                    className="gc2-input gc2-amount-input"
                    min="1"
                  />
                  <button className="gc2-btn-add-amount" onClick={addAmount}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>
                <p className="gc2-hint">Por cada monto se crean dos variantes: Física $X y Digital $X</p>
              </div>

              <button className="gc2-btn-primary" onClick={handleSetup} disabled={saving}>
                {saving ? <><RefreshCw size={16} className="gc2-spin" /> Creando producto...</> : <><Zap size={16} /> Crear producto en TiendaNube</>}
              </button>
            </div>
          ) : (
            /* ── CONFIG EXISTENTE ── */
            <div className="gc2-config-content">
              {/* Product info */}
              <div className="gc2-info-card">
                <div className="gc2-info-icon">🏷️</div>
                <div className="gc2-info-body">
                  <span className="gc2-info-label">Producto en TiendaNube</span>
                  <span className="gc2-info-value">{config.productName} <span className="gc2-id">ID: {config.productId}</span></span>
                </div>
                <a
                  href={`https://www.tiendanube.com/admin/products/${config.productId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="gc2-btn-link"
                >
                  <ExternalLink size={14} /> Ver en TiendaNube
                </a>
              </div>

              {/* Toggle enabled */}
              <div className="gc2-toggle-row">
                <div>
                  <span className="gc2-toggle-label">Estado del módulo</span>
                  <span className="gc2-toggle-desc">Cuando está desactivado el webhook ignora ventas de este producto</span>
                </div>
                <button
                  className={`gc2-toggle-btn ${config.enabled ? 'on' : 'off'}`}
                  onClick={handleToggleEnabled}
                >
                  {config.enabled ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              {/* Amounts */}
              <div className="gc2-field">
                <label>Montos disponibles</label>
                <div className="gc2-amounts-list">
                  {newAmounts.map(a => (
                    <div key={a} className="gc2-amount-chip">
                      <span>{formatCurrency(a)}</span>
                      <button onClick={() => removeAmount(a)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="gc2-amount-add">
                  <span className="gc2-currency-prefix">$</span>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAmount()}
                    placeholder="Ej: 3000"
                    className="gc2-input gc2-amount-input"
                    min="1"
                  />
                  <button className="gc2-btn-add-amount" onClick={addAmount}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>
                <p className="gc2-hint">Los cambios se sincronizan automáticamente con las variantes del producto en TiendaNube</p>
              </div>

              <button className="gc2-btn-primary" onClick={handleSyncAmounts} disabled={saving}>
                {saving ? <><RefreshCw size={16} className="gc2-spin" /> Sincronizando...</> : <><RefreshCw size={16} /> Guardar y sincronizar montos</>}
              </button>

              {/* ── DISEÑO ── */}
              <div className="gc2-design-section">
                <h3 className="gc2-design-title"><Image size={16} /> Diseño del producto</h3>

                <div className="gc2-field">
                  <label>Imagen del producto</label>
                  <div className="gc2-image-upload-row">
                    {imagePreview && (
                      <div className="gc2-image-preview">
                        <img src={imagePreview} alt="Preview gift card" />
                      </div>
                    )}
                    <label className="gc2-btn-upload" htmlFor="gc2-img-input">
                      <Upload size={14} />
                      {imagePreview ? 'Cambiar imagen' : 'Subir imagen'}
                    </label>
                    <input id="gc2-img-input" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </div>
                  <p className="gc2-hint">Se mostrará en la página del producto en TiendaNube. Máx. 3MB (JPG, PNG o GIF).</p>
                </div>

                <div className="gc2-field">
                  <label>Descripción del producto</label>
                  <textarea
                    className="gc2-textarea"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ej: Regalá una experiencia única. Se puede usar en cualquier compra de la tienda."
                    rows={3}
                  />
                  <p className="gc2-hint">Se actualiza en la descripción del producto en TiendaNube.</p>
                </div>

                <div className="gc2-field">
                  <label>Mensaje personalizado en el email <span className="gc2-label-tag">Solo gift card digital</span></label>
                  <textarea
                    className="gc2-textarea"
                    value={emailMessage}
                    onChange={e => setEmailMessage(e.target.value)}
                    placeholder="Ej: ¡Gracias por tu compra! Este regalo es para vos 🎁"
                    rows={2}
                  />
                  <p className="gc2-hint">Aparece destacado dentro del email que recibe el comprador.</p>
                </div>

                <button className="gc2-btn-secondary" onClick={handleSaveDesign} disabled={savingDesign}>
                  {savingDesign ? <><RefreshCw size={16} className="gc2-spin" /> Guardando...</> : <><CheckCircle size={16} /> Guardar diseño</>}
                </button>
              </div>

              {/* How it works */}
              <div className="gc2-how-it-works">
                <h3>¿Cómo funciona?</h3>
                <div className="gc2-steps">
                  <div className="gc2-step">
                    <div className="gc2-step-num">1</div>
                    <div><strong>Cliente compra</strong> la gift card en tu tienda eligiendo Tipo y Monto</div>
                  </div>
                  <div className="gc2-step">
                    <div className="gc2-step-num">2</div>
                    <div><strong>GlowLab detecta</strong> la venta y agrega una nota interna en la orden de TiendaNube</div>
                  </div>
                  <div className="gc2-step">
                    <div className="gc2-step-num">3</div>
                    <div><strong>Digital:</strong> se genera un código único, se crea el cupón en TiendaNube y se envía el email al comprador</div>
                  </div>
                  <div className="gc2-step">
                    <div className="gc2-step-num">4</div>
                    <div><strong>Física:</strong> se agrega la nota en la orden y el producto se despacha normalmente</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB ÓRDENES ────────────────────────── */}
      {tab === 'orders' && (
        <div className="gc2-tab-content">
          <div className="gc2-orders-header">
            <span className="gc2-orders-count">{orders.length} órdenes</span>
            <button className="gc2-btn-refresh" onClick={loadOrders} disabled={loadingOrders}>
              <RefreshCw size={14} className={loadingOrders ? 'gc2-spin' : ''} /> Actualizar
            </button>
          </div>

          {loadingOrders ? (
            <div className="gc2-loading-inline"><div className="gc2-spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="gc2-empty-orders">
              <div className="gc2-empty-icon">🎁</div>
              <h3>Sin órdenes todavía</h3>
              <p>Las ventas de gift cards aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <div className="gc2-orders-table-wrapper">
              <table className="gc2-orders-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th>Comprador</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td className="gc2-order-num">#{order.orderNumber}</td>
                      <td className="gc2-order-date">{formatDate(order.createdAt)}</td>
                      <td className="gc2-order-buyer">
                        <span className="gc2-buyer-name">{order.buyerName || '—'}</span>
                        <span className="gc2-buyer-email">{order.buyerEmail || '—'}</span>
                      </td>
                      <td>
                        <span className={`gc2-type-badge ${order.type}`}>
                          {order.type === 'digital' ? <><Mail size={12} /> Digital</> : <><Package size={12} /> Física</>}
                        </span>
                      </td>
                      <td className="gc2-order-amount">{formatCurrency(order.amount)}</td>
                      <td>
                        <div className="gc2-code-cell">
                          <code className="gc2-code">{order.code}</code>
                          <button className="gc2-copy-btn" onClick={() => copyCode(order.code)} title="Copiar código">
                            <Copy size={12} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="gc2-status-cell">
                          {order.type === 'digital' ? (
                            order.emailSent
                              ? <span className="gc2-status-ok"><CheckCircle size={13} /> Email enviado</span>
                              : <span className="gc2-status-warn"><XCircle size={13} /> Sin email</span>
                          ) : (
                            <span className="gc2-status-physical"><Package size={13} /> Despachar</span>
                          )}
                          {order.noteAdded && <span className="gc2-note-ok" title="Nota en la orden">📝</span>}
                        </div>
                      </td>
                      <td>
                        {order.type === 'digital' && (
                          <button
                            className="gc2-btn-resend"
                            onClick={() => handleResendEmail(order)}
                            disabled={resendingId === order.id}
                            title="Reenviar email"
                          >
                            {resendingId === order.id ? <RefreshCw size={13} className="gc2-spin" /> : <Send size={13} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GiftCardV2;
