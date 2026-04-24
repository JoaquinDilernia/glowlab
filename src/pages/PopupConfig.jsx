import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Type, Palette, Target, Zap } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './PopupConfig.css';

const TABS = [
  { id: 'content', label: 'Contenido', icon: Type },
  { id: 'design', label: 'Diseño', icon: Palette },
  { id: 'targeting', label: 'Targeting', icon: Target },
  { id: 'preview', label: 'Preview', icon: Eye }
];

const DEFAULT_CONFIG = {
  name: '',
  type: 'modal',
  active: false,
  trigger: { event: 'delay', delaySeconds: 5, scrollPercent: 50 },
  targeting: { pages: 'all', devices: 'all', showOnce: true, frequency: 'once' },
  content: {
    popupType: 'promo',
    title: '¡Oferta exclusiva!',
    subtitle: 'Solo por tiempo limitado',
    body: '',
    imageUrl: '',
    ctaText: 'Ver oferta',
    ctaUrl: '',
    showEmailField: false,
    emailPlaceholder: 'Tu email...',
    emailButtonText: 'Suscribirme',
    discountCode: '',
    discountValue: ''
  },
  design: {
    position: 'center',
    width: '480px',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#7C7CFF',
    buttonColor: '#7C7CFF',
    buttonTextColor: '#ffffff',
    overlayColor: 'rgba(0,0,0,0.7)',
    borderRadius: '16px',
    animation: 'fadeInUp',
    fontFamily: 'inherit',
    showCloseButton: true,
    closeAfterSeconds: 0
  }
};

function PopupConfig() {
  const { popupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const storeId = localStorage.getItem('promonube_store_id');
  const isNew = !popupId;

  const [activeTab, setActiveTab] = useState('content');
  const [config, setConfig] = useState(() => {
    const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const typeParam = searchParams.get('type');
    if (typeParam) base.type = typeParam;
    return base;
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) loadPopup();
  }, [popupId]);

  const loadPopup = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/popups/${popupId}?storeId=${storeId}`);
      if (data.success) {
        // Merge con defaults para que no falten campos
        const merged = {
          ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
          ...data.popup,
          trigger: { ...DEFAULT_CONFIG.trigger, ...data.popup.trigger },
          targeting: { ...DEFAULT_CONFIG.targeting, ...data.popup.targeting },
          content: { ...DEFAULT_CONFIG.content, ...data.popup.content },
          design: { ...DEFAULT_CONFIG.design, ...data.popup.design }
        };
        setConfig(merged);
      } else {
        toast.info('Error cargando popup');
        navigate('/popups');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.info('Error cargando popup');
      navigate('/popups');
    } finally {
      setLoading(false);
    }
  };

  const setField = (path, value) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.info('El nombre del popup es obligatorio');
      setActiveTab('content');
      return;
    }
    try {
      setSaving(true);
      let data;
      if (isNew) {
        data = await apiRequest('/api/popups', {
          method: 'POST',
          body: JSON.stringify({ ...config, storeId })
        });
      } else {
        data = await apiRequest(`/api/popups/${popupId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...config, storeId })
        });
      }

      if (data.success) {
        const targetId = isNew ? data.popupId : popupId;
        navigate('/popups');
      } else {
        toast.error('Error guardando: ' + data.message);
      }
    } catch (error) {
      console.error('Error guardando:', error);
      toast.info('Error guardando popup');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="popup-config-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando popup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-config-page">
      {/* Header */}
      <header className="config-header">
        <div className="config-header-inner">
          <div className="config-header-left">
            <div>
              <h1 className="config-page-title">{isNew ? 'Crear Popup' : 'Editar Popup'}</h1>
              <p className="config-page-subtitle">
                {config.type === 'modal' ? '🪟 Modal' : config.type === 'banner' ? '📢 Banner' : '📌 Slide-in'}
              </p>
            </div>
          </div>
          <button className="btn-save-gradient" onClick={handleSave} disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="config-tabs-bar">
        <div className="config-tabs-inner">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`config-tab ${activeTab === tab.id ? 'config-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="config-body">
        {/* ========== CONTENT TAB ========== */}
        {activeTab === 'content' && (
          <div className="config-tab-panel">
            <div className="config-section">
              <h2 className="section-title">Identificación</h2>
              <div className="form-group">
                <label className="form-label">Nombre del popup <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={config.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Ej: Descuento bienvenida, Newsletter junio..."
                />
                <span className="form-hint">Solo para uso interno, no lo ven los visitantes</span>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de popup</label>
                <div className="type-selector">
                  {[
                    { value: 'modal', icon: '🪟', label: 'Modal', desc: 'Overlay centrado' },
                    { value: 'banner', icon: '📢', label: 'Banner', desc: 'Barra en pantalla' },
                    { value: 'slide_in', icon: '📌', label: 'Slide-in', desc: 'Desde el costado' }
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`type-option ${config.type === opt.value ? 'type-option--selected' : ''}`}
                      onClick={() => setField('type', opt.value)}
                    >
                      <span className="type-option-icon">{opt.icon}</span>
                      <span className="type-option-label">{opt.label}</span>
                      <span className="type-option-desc">{opt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Objetivo del popup</label>
                <div className="radio-group">
                  {[
                    { value: 'promo', label: 'Promoción / Oferta', icon: '🎁' },
                    { value: 'email_capture', label: 'Captura de email', icon: '📧' },
                    { value: 'announcement', label: 'Anuncio / Info', icon: '📣' }
                  ].map(opt => (
                    <label key={opt.value} className={`radio-option ${config.content.popupType === opt.value ? 'radio-option--selected' : ''}`}>
                      <input
                        type="radio"
                        name="popupType"
                        value={opt.value}
                        checked={config.content.popupType === opt.value}
                        onChange={e => setField('content.popupType', e.target.value)}
                      />
                      <span>{opt.icon} {opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="config-section">
              <h2 className="section-title">Contenido</h2>

              {config.content.imageUrl !== undefined && (
                <div className="form-group">
                  <label className="form-label">URL de imagen (opcional)</label>
                  <input
                    type="url"
                    className="form-input"
                    value={config.content.imageUrl}
                    onChange={e => setField('content.imageUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Título</label>
                <input
                  type="text"
                  className="form-input"
                  value={config.content.title}
                  onChange={e => setField('content.title', e.target.value)}
                  placeholder="Ej: ¡10% de descuento solo hoy!"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subtítulo</label>
                <input
                  type="text"
                  className="form-input"
                  value={config.content.subtitle}
                  onChange={e => setField('content.subtitle', e.target.value)}
                  placeholder="Ej: Usá el código al momento de pagar"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Texto adicional</label>
                <textarea
                  className="form-input form-textarea"
                  value={config.content.body}
                  onChange={e => setField('content.body', e.target.value)}
                  placeholder="Descripción detallada (opcional)..."
                  rows={3}
                />
              </div>

              {/* Código de descuento */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Código de cupón</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.content.discountCode}
                    onChange={e => setField('content.discountCode', e.target.value.toUpperCase())}
                    placeholder="VERANO10"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Etiqueta del descuento</label>
                  <input
                    type="text"
                    className="form-input"
                    value={config.content.discountValue}
                    onChange={e => setField('content.discountValue', e.target.value)}
                    placeholder="10% OFF"
                  />
                </div>
              </div>
            </div>

            {/* Email capture */}
            <div className="config-section">
              <h2 className="section-title">Formulario de email</h2>
              <div className="form-group">
                <label className="toggle-label">
                  <div className="toggle-info">
                    <span className="toggle-title">Mostrar campo de email</span>
                    <span className="toggle-desc">Permite capturar suscriptores</span>
                  </div>
                  <div
                    className={`toggle-switch ${config.content.showEmailField ? 'toggle-switch--on' : ''}`}
                    onClick={() => setField('content.showEmailField', !config.content.showEmailField)}
                  >
                    <div className="toggle-knob"></div>
                  </div>
                </label>
              </div>

              {config.content.showEmailField && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Placeholder del input</label>
                    <input
                      type="text"
                      className="form-input"
                      value={config.content.emailPlaceholder}
                      onChange={e => setField('content.emailPlaceholder', e.target.value)}
                      placeholder="Tu email..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Texto del botón</label>
                    <input
                      type="text"
                      className="form-input"
                      value={config.content.emailButtonText}
                      onChange={e => setField('content.emailButtonText', e.target.value)}
                      placeholder="Suscribirme"
                    />
                  </div>
                </div>
              )}

              {!config.content.showEmailField && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Texto del CTA</label>
                    <input
                      type="text"
                      className="form-input"
                      value={config.content.ctaText}
                      onChange={e => setField('content.ctaText', e.target.value)}
                      placeholder="Ver oferta"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL del CTA (opcional)</label>
                    <input
                      type="url"
                      className="form-input"
                      value={config.content.ctaUrl}
                      onChange={e => setField('content.ctaUrl', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== DESIGN TAB ========== */}
        {activeTab === 'design' && (
          <div className="config-tab-panel">
            <div className="config-section">
              <h2 className="section-title">Colores</h2>
              <div className="colors-grid">
                <div className="color-field">
                  <label className="form-label">Fondo</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={config.design.backgroundColor}
                      onChange={e => setField('design.backgroundColor', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={config.design.backgroundColor}
                      onChange={e => setField('design.backgroundColor', e.target.value)}
                    />
                  </div>
                </div>
                <div className="color-field">
                  <label className="form-label">Texto</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={config.design.textColor}
                      onChange={e => setField('design.textColor', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={config.design.textColor}
                      onChange={e => setField('design.textColor', e.target.value)}
                    />
                  </div>
                </div>
                <div className="color-field">
                  <label className="form-label">Acento</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={config.design.accentColor}
                      onChange={e => setField('design.accentColor', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={config.design.accentColor}
                      onChange={e => setField('design.accentColor', e.target.value)}
                    />
                  </div>
                </div>
                <div className="color-field">
                  <label className="form-label">Botón</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={config.design.buttonColor}
                      onChange={e => setField('design.buttonColor', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={config.design.buttonColor}
                      onChange={e => setField('design.buttonColor', e.target.value)}
                    />
                  </div>
                </div>
                <div className="color-field">
                  <label className="form-label">Texto botón</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={config.design.buttonTextColor}
                      onChange={e => setField('design.buttonTextColor', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={config.design.buttonTextColor}
                      onChange={e => setField('design.buttonTextColor', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Presets de color */}
              <div className="form-group">
                <label className="form-label">Presets</label>
                <div className="color-presets">
                  {[
                    { label: 'Violeta', bg: '#1a1a2e', text: '#ffffff', accent: '#7C7CFF', btn: '#7C7CFF' },
                    { label: 'Blanco', bg: '#ffffff', text: '#1a1a1a', accent: '#7C7CFF', btn: '#7C7CFF' },
                    { label: 'Negro', bg: '#111111', text: '#ffffff', accent: '#ffffff', btn: '#ffffff' },
                    { label: 'Coral', bg: '#fff5f5', text: '#1a1a1a', accent: '#e53e3e', btn: '#e53e3e' },
                    { label: 'Verde', bg: '#f0fdf4', text: '#1a1a1a', accent: '#16a34a', btn: '#16a34a' },
                    { label: 'Dorado', bg: '#1a1206', text: '#ffffff', accent: '#f59e0b', btn: '#f59e0b' }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      className="color-preset-btn"
                      style={{ background: preset.bg, color: preset.text, borderColor: preset.accent }}
                      onClick={() => {
                        setField('design.backgroundColor', preset.bg);
                        setField('design.textColor', preset.text);
                        setField('design.accentColor', preset.accent);
                        setField('design.buttonColor', preset.btn);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="config-section">
              <h2 className="section-title">Layout y Animación</h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Posición</label>
                  <select
                    className="form-select"
                    value={config.design.position}
                    onChange={e => setField('design.position', e.target.value)}
                  >
                    <option value="center">Centro</option>
                    <option value="top">Arriba (banner)</option>
                    <option value="bottom">Abajo (banner)</option>
                    <option value="bottom-right">Abajo derecha</option>
                    <option value="bottom-left">Abajo izquierda</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Animación</label>
                  <select
                    className="form-select"
                    value={config.design.animation}
                    onChange={e => setField('design.animation', e.target.value)}
                  >
                    <option value="fadeInUp">Slide up (default)</option>
                    <option value="fadeIn">Fade in</option>
                    <option value="slideInRight">Slide derecha</option>
                    <option value="slideInBottom">Slide abajo</option>
                    <option value="bounce">Bounce</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ancho máximo</label>
                  <select
                    className="form-select"
                    value={config.design.width}
                    onChange={e => setField('design.width', e.target.value)}
                  >
                    <option value="360px">Pequeño (360px)</option>
                    <option value="480px">Mediano (480px)</option>
                    <option value="560px">Grande (560px)</option>
                    <option value="640px">Extra grande (640px)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bordes redondeados</label>
                  <select
                    className="form-select"
                    value={config.design.borderRadius}
                    onChange={e => setField('design.borderRadius', e.target.value)}
                  >
                    <option value="0px">Sin redondeo</option>
                    <option value="8px">Poco (8px)</option>
                    <option value="16px">Normal (16px)</option>
                    <option value="24px">Mucho (24px)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="toggle-label">
                    <div className="toggle-info">
                      <span className="toggle-title">Botón cerrar</span>
                      <span className="toggle-desc">Mostrar X para cerrar</span>
                    </div>
                    <div
                      className={`toggle-switch ${config.design.showCloseButton ? 'toggle-switch--on' : ''}`}
                      onClick={() => setField('design.showCloseButton', !config.design.showCloseButton)}
                    >
                      <div className="toggle-knob"></div>
                    </div>
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Auto-cerrar (segundos)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config.design.closeAfterSeconds}
                    onChange={e => setField('design.closeAfterSeconds', parseInt(e.target.value) || 0)}
                    min="0"
                    max="60"
                    placeholder="0 = no cerrar"
                  />
                  <span className="form-hint">0 = deshabilitado</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TARGETING TAB ========== */}
        {activeTab === 'targeting' && (
          <div className="config-tab-panel">
            <div className="config-section">
              <h2 className="section-title">
                <Zap size={18} className="section-icon" />
                Trigger — ¿Cuándo aparece?
              </h2>

              <div className="targeting-options">
                {[
                  { value: 'onLoad', icon: '⚡', label: 'Inmediato', desc: 'Al cargar la página' },
                  { value: 'delay', icon: '⏱️', label: 'Con demora', desc: 'Después de N segundos' },
                  { value: 'exitIntent', icon: '🚪', label: 'Exit Intent', desc: 'Al mover el mouse para salir' },
                  { value: 'scroll', icon: '📜', label: 'Al scrollear', desc: 'Al bajar un % de la página' }
                ].map(opt => (
                  <div
                    key={opt.value}
                    className={`targeting-option ${config.trigger.event === opt.value ? 'targeting-option--selected' : ''}`}
                    onClick={() => setField('trigger.event', opt.value)}
                  >
                    <span className="targeting-option-icon">{opt.icon}</span>
                    <div>
                      <div className="targeting-option-label">{opt.label}</div>
                      <div className="targeting-option-desc">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {config.trigger.event === 'delay' && (
                <div className="form-group trigger-extra">
                  <label className="form-label">Demora en segundos</label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={config.trigger.delaySeconds}
                    onChange={e => setField('trigger.delaySeconds', parseInt(e.target.value))}
                    className="range-input"
                  />
                  <span className="range-value">{config.trigger.delaySeconds}s</span>
                </div>
              )}

              {config.trigger.event === 'scroll' && (
                <div className="form-group trigger-extra">
                  <label className="form-label">Activar al scrollear</label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={config.trigger.scrollPercent}
                    onChange={e => setField('trigger.scrollPercent', parseInt(e.target.value))}
                    className="range-input"
                  />
                  <span className="range-value">{config.trigger.scrollPercent}% de la página</span>
                </div>
              )}
            </div>

            <div className="config-section">
              <h2 className="section-title">
                <Target size={18} className="section-icon" />
                ¿A quién mostrarlo?
              </h2>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Páginas</label>
                  <select
                    className="form-select"
                    value={config.targeting.pages}
                    onChange={e => setField('targeting.pages', e.target.value)}
                  >
                    <option value="all">Todas las páginas</option>
                    <option value="home">Inicio</option>
                    <option value="product">Páginas de producto</option>
                    <option value="cart">Carrito</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Dispositivos</label>
                  <select
                    className="form-select"
                    value={config.targeting.devices}
                    onChange={e => setField('targeting.devices', e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="desktop">Solo desktop</option>
                    <option value="mobile">Solo mobile</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="toggle-label">
                  <div className="toggle-info">
                    <span className="toggle-title">Mostrar una sola vez</span>
                    <span className="toggle-desc">El visitante no vuelve a verlo (usa localStorage)</span>
                  </div>
                  <div
                    className={`toggle-switch ${config.targeting.showOnce ? 'toggle-switch--on' : ''}`}
                    onClick={() => {
                      const newVal = !config.targeting.showOnce;
                      setField('targeting.showOnce', newVal);
                      setField('targeting.frequency', newVal ? 'once' : 'every_visit');
                    }}
                  >
                    <div className="toggle-knob"></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ========== PREVIEW TAB ========== */}
        {activeTab === 'preview' && (
          <div className="config-tab-panel preview-panel">
            <div className="preview-label">
              <Eye size={16} />
              Vista previa — así verán el popup tus visitantes
            </div>
            <div className="preview-device-frame">
              <PopupPreview config={config} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Componente de preview ---- */
function PopupPreview({ config }) {
  const { content = {}, design = {}, type = 'modal' } = config;

  const isEmailCapture = content.showEmailField || content.popupType === 'email_capture';
  const popupStyle = {
    '--pn-bg': design.backgroundColor || '#ffffff',
    '--pn-color': design.textColor || '#1a1a1a',
    '--pn-accent': design.accentColor || '#7C7CFF',
    '--pn-btn-bg': design.buttonColor || '#7C7CFF',
    '--pn-btn-color': design.buttonTextColor || '#ffffff',
    '--pn-radius': design.borderRadius || '16px',
    '--pn-width': design.width || '480px'
  };

  return (
    <div className={`popup-preview-wrapper popup-preview-${type}`}>
      <div className="popup-preview-overlay">
        <div className="popup-preview-modal" style={popupStyle}>
          {design.showCloseButton !== false && (
            <button className="popup-preview-close">×</button>
          )}
          {content.imageUrl && (
            <img src={content.imageUrl} alt="" className="popup-preview-image" />
          )}
          <div className="popup-preview-body">
            {content.discountValue && (
              <div className="popup-preview-badge">{content.discountValue}</div>
            )}
            {content.title && (
              <h2 className="popup-preview-title">{content.title}</h2>
            )}
            {content.subtitle && (
              <p className="popup-preview-subtitle">{content.subtitle}</p>
            )}
            {content.body && (
              <p className="popup-preview-text">{content.body}</p>
            )}
            {content.discountCode && (
              <div className="popup-preview-code-box">
                <span className="popup-preview-code-label">Usá el código</span>
                <span className="popup-preview-code-value">{content.discountCode}</span>
              </div>
            )}
            {isEmailCapture ? (
              <div className="popup-preview-form">
                <div className="popup-preview-input">{content.emailPlaceholder || 'Tu email...'}</div>
                <div className="popup-preview-btn">{content.emailButtonText || 'Suscribirme'}</div>
              </div>
            ) : content.ctaText ? (
              <div className="popup-preview-btn">{content.ctaText}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PopupConfig;
