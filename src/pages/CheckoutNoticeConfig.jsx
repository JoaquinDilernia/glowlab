import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, MessageCircle, Eye } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';
import './CheckoutNoticeConfig.css';

const ALLOWED_STORE_ID = '2547699';

const DEFAULT_CONFIG = {
  enabled: true,
  title: '¿Necesitás Factura A?',
  message: 'Las facturas se emiten como B por defecto. Si necesitás Factura A, escribinos a WhatsApp con el mensaje "Factura A" y te coordinamos los datos de facturación.',
  buttonText: 'Pedir Factura A por WhatsApp',
  whatsappPhone: '5491100000000',
  whatsappMessage: 'Hola! Hice una compra y necesito Factura A. Mis datos son:',
  bgColor: '#fff7ed',
  borderColor: '#fb923c',
  textColor: '#7c2d12',
  buttonBgColor: '#25d366',
  buttonTextColor: '#ffffff',
  iconEmoji: '🧾',
  borderRadius: 12,
  shape: 'rounded',
  position: 'top',
};

function CheckoutNoticeConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const isAllowed = String(storeId) === ALLOWED_STORE_ID;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    if (!isAllowed) { setLoading(false); return; }
    (async () => {
      try {
        const res = await apiRequest(`/api/checkout-notice-config?storeId=${storeId}`);
        if (res?.success && res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/checkout-notice-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) toast.success('Configuración guardada');
      else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const install = async () => {
    setInstalling(true);
    try {
      const res = await apiRequest('/api/checkout-notice/install', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      if (res?.success) toast.success(res.message || 'Script instalado');
      else toast.error(res?.message || 'No se pudo instalar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setInstalling(false);
    }
  };

  if (!isAllowed) {
    return (
      <div className="page-container">
        <div className="empty-state-modern" style={{ padding: 48, textAlign: 'center' }}>
          <h2>Módulo no disponible</h2>
          <p>Esta funcionalidad es exclusiva de Altorancho.</p>
          <button className="btn-primary-gradient" onClick={() => navigate('/dashboard')}>Volver</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="page-container"><div className="loading-state"><div className="spinner" /><p>Cargando…</p></div></div>;
  }

  // Preview values
  const cleanPhone = String(config.whatsappPhone || '').replace(/\D/g, '');
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(config.whatsappMessage || '')}`;
  const radiusMap = { rounded: config.borderRadius || 12, square: 0, pill: 999 };
  const radius = radiusMap[config.shape] !== undefined ? radiusMap[config.shape] : (config.borderRadius || 12);

  return (
    <div className="page-container cn-page" style={{ fontFamily: 'Poppins, -apple-system, sans-serif' }}>
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-back" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /> Volver</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary-outline" onClick={install} disabled={installing}
                style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', cursor: installing ? 'wait' : 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {installing ? 'Instalando…' : 'Instalar en TiendaNube'}
              </button>
              <button className="btn-primary-gradient" onClick={save} disabled={saving}>
                <Save size={18} />
                <span>{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">🧾 Aviso en Checkout - Factura A</h1>
            <p className="page-subtitle-modern">Mostrá un mensaje en el checkout con un botón directo a WhatsApp</p>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 480px)', gap: 24, padding: 24, maxWidth: 1280, margin: '0 auto' }}>
        {/* Form */}
        <div className="cn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Configuración del aviso</h2>
            <label className="toggle-switch" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config.enabled} onChange={e => handle('enabled', e.target.checked)} />
              <span className="toggle-slider"></span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{config.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Emoji / icono">
              <input type="text" value={config.iconEmoji} onChange={e => handle('iconEmoji', e.target.value)} maxLength={4} style={inp} />
            </Field>
            <Field label="Título">
              <input type="text" value={config.title} onChange={e => handle('title', e.target.value)} style={inp} />
            </Field>
            <Field label="Mensaje (puede ocupar varias líneas)">
              <textarea value={config.message} onChange={e => handle('message', e.target.value)} rows={4} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
            </Field>
            <Field label="Texto del botón">
              <input type="text" value={config.buttonText} onChange={e => handle('buttonText', e.target.value)} style={inp} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Número de WhatsApp (con código país, sin +)">
                <input type="text" value={config.whatsappPhone} onChange={e => handle('whatsappPhone', e.target.value)} placeholder="5491100000000" style={inp} />
              </Field>
              <Field label="Mensaje pre-cargado en WhatsApp">
                <input type="text" value={config.whatsappMessage} onChange={e => handle('whatsappMessage', e.target.value)} style={inp} />
              </Field>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
            <h3 style={{ margin: 0, fontSize: 14, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estilo</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <ColorField label="Fondo" value={config.bgColor} onChange={v => handle('bgColor', v)} />
              <ColorField label="Borde" value={config.borderColor} onChange={v => handle('borderColor', v)} />
              <ColorField label="Texto" value={config.textColor} onChange={v => handle('textColor', v)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ColorField label="Fondo del botón" value={config.buttonBgColor} onChange={v => handle('buttonBgColor', v)} />
              <ColorField label="Texto del botón" value={config.buttonTextColor} onChange={v => handle('buttonTextColor', v)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Forma">
                <select value={config.shape} onChange={e => handle('shape', e.target.value)} style={inp}>
                  <option value="rounded">Redondeado</option>
                  <option value="square">Cuadrado</option>
                  <option value="pill">Pill (muy redondeado)</option>
                </select>
              </Field>
              <Field label={`Radio (${config.borderRadius}px)`}>
                <input type="range" min="0" max="24" value={config.borderRadius} onChange={e => handle('borderRadius', parseInt(e.target.value, 10))} disabled={config.shape !== 'rounded'} />
              </Field>
              <Field label="Posición">
                <select value={config.position} onChange={e => handle('position', e.target.value)} style={inp}>
                  <option value="top">Arriba del checkout</option>
                  <option value="bottom">Abajo del checkout</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
              <Eye size={16} /> Vista previa
            </div>
            <div style={{ background: '#f3f4f6', padding: 24, borderRadius: 14, border: '1px dashed #d1d5db' }} className="cn-preview-wrap">
              <div className="cn-preview-card" style={{ padding: 20, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Simulación del checkout</div>
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 6, width: '70%' }} />
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 16, width: '50%' }} />

                <div style={{
                  fontFamily: 'Poppins, sans-serif',
                  background: config.bgColor,
                  color: config.textColor,
                  border: `1.5px solid ${config.borderColor}`,
                  borderRadius: radius,
                  padding: '16px 18px',
                  margin: '12px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                  boxSizing: 'border-box'
                }}>
                  {(config.iconEmoji || config.title) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {config.iconEmoji && <span style={{ fontSize: 22, lineHeight: 1 }}>{config.iconEmoji}</span>}
                      {config.title && <h3 style={{ fontWeight: 600, fontSize: 15, color: config.textColor, WebkitTextFillColor: config.textColor, margin: 0, letterSpacing: '-0.01em' }}>{config.title}</h3>}
                    </div>
                  )}
                  {config.message && (
                    <p style={{ fontWeight: 400, fontSize: 13.5, lineHeight: 1.55, color: config.textColor, WebkitTextFillColor: config.textColor, margin: 0, opacity: 0.92 }}>{config.message}</p>
                  )}
                  {config.buttonText && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: config.buttonBgColor,
                      color: config.buttonTextColor,
                      WebkitTextFillColor: config.buttonTextColor,
                      fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 14,
                      padding: '11px 18px', borderRadius: radius > 0 ? radius : 8,
                      textDecoration: 'none', alignSelf: 'flex-start', lineHeight: 1
                    }}>
                      <MessageCircle size={18} color={config.buttonTextColor} />
                      <span style={{ color: config.buttonTextColor, WebkitTextFillColor: config.buttonTextColor }}>{config.buttonText}</span>
                    </a>
                  )}
                </div>

                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, marginBottom: 6, width: '85%' }} />
                <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, width: '60%' }} />
              </div>
              <p className="cn-preview-hint">
                💡 Al cliente le aparece el aviso en la página del checkout. Al tocar el botón abre WhatsApp con el mensaje pre-cargado.
              </p>
            </div>

            <div className="cn-help" style={{ marginTop: 16 }}>
              <strong>Para activarlo:</strong> Guardá los cambios y luego subí el archivo <code>checkout-notice-version.js</code> en el panel de TiendaNube → <em>Configuración → Códigos externos</em> con ámbito <em>checkout</em>. También acordate de desactivar “Permitir elegir factura A” desde <em>Configuración → Opciones del checkout</em>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 40, height: 38, border: '1px solid #e5e7eb', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ ...inp, flex: 1 }} />
      </div>
    </Field>
  );
}

export default CheckoutNoticeConfig;
