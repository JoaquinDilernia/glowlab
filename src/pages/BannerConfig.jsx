import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Type, MousePointer } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './BannerConfig.css';

const DEFAULT_ELEMENT_TEXT = () => ({
  id: 'el_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
  type: 'text',
  text: 'Título del banner',
  fontSize: 32,
  fontWeight: '700',
  color: '#ffffff',
  textAlign: 'center',
});

const DEFAULT_ELEMENT_BUTTON = () => ({
  id: 'el_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
  type: 'button',
  text: 'Ver productos',
  url: '',
  backgroundColor: '#ffffff',
  textColor: '#111111',
  borderRadius: 6,
  paddingH: 28,
  paddingV: 14,
  fontSize: 15,
  fontWeight: '600',
});

const DEFAULT_CONFIG = {
  enabled: false,
  imageUrl: '',
  imageAlt: '',
  imageMobileUrl: '',
  width: 'full',
  contentAlign: 'center',
  contentValign: 'middle',
  contentPadding: 48,
  overlayColor: '#000000',
  overlayOpacity: 0,
  linkUrl: '',
  injectSelector: '',
  injectPosition: 'after',
  elements: [],
};

const TABS = [
  { id: 'imagen', label: 'Imagen' },
  { id: 'contenido', label: 'Contenido' },
  { id: 'diseno', label: 'Diseño' },
  { id: 'posicion', label: 'Posición' },
];

function BannerConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [bannerId, setBannerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('imagen');
  const [lastSaved, setLastSaved] = useState(null);
  const [expandedEl, setExpandedEl] = useState(null);
  const fileRef = useRef(null);
  const mobileFileRef = useRef(null);

  useEffect(() => {
    if (!storeId) return;
    apiRequest(`/api/banners?storeId=${storeId}`)
      .then(data => {
        if (data.success && data.banner) {
          setConfig({ ...DEFAULT_CONFIG, ...data.banner });
          setBannerId(data.banner.id || null);
          if (data.banner.updatedAt) setLastSaved(new Date(data.banner.updatedAt));
        }
      })
      .catch(() => {});
  }, [storeId]);

  const patch = (updates) => setConfig(prev => ({ ...prev, ...updates }));

  const handleSave = async () => {
    if (!storeId) { toast.error('No se encontró el ID de la tienda.'); return; }
    setLoading(true);
    try {
      const payload = { storeId, ...config };
      let data;
      if (bannerId) {
        data = await apiRequest(`/api/banners/${bannerId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        data = await apiRequest('/api/banners/create', { method: 'POST', body: JSON.stringify(payload) });
        if (data.success && data.id) setBannerId(data.id);
      }
      if (data.success) {
        toast.success('Banner guardado. Los cambios se verán en tu tienda en 1-2 minutos.');
        setLastSaved(new Date());
      } else {
        toast.error('Error al guardar: ' + (data.message || 'Error desconocido'));
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file, field, setUpl) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen supera 8MB'); return; }
    setUpl(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await apiRequest('/api/upload-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, fileName: file.name, fileData: base64, folder: 'banner-home' }),
      });
      if (!response.success) throw new Error(response.message);
      patch({ [field]: response.url });
    } catch (e) {
      toast.error('Error al subir imagen: ' + e.message);
    } finally {
      setUpl(false);
    }
  };

  const addElement = (type) => {
    const el = type === 'text' ? DEFAULT_ELEMENT_TEXT() : DEFAULT_ELEMENT_BUTTON();
    const next = [...config.elements, el];
    patch({ elements: next });
    setExpandedEl(el.id);
  };

  const updateElement = (id, updates) => {
    patch({ elements: config.elements.map(el => el.id === id ? { ...el, ...updates } : el) });
  };

  const removeElement = (id) => {
    patch({ elements: config.elements.filter(el => el.id !== id) });
    if (expandedEl === id) setExpandedEl(null);
  };

  const moveElement = (id, dir) => {
    const els = [...config.elements];
    const idx = els.findIndex(e => e.id === id);
    const target = idx + dir;
    if (target < 0 || target >= els.length) return;
    [els[idx], els[target]] = [els[target], els[idx]];
    patch({ elements: els });
  };

  // ── Preview ──────────────────────────────────────────────────────
  const alignItemsMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

  const previewStyle = {
    position: 'relative',
    width: config.width === 'contained' ? 'min(100%, 1200px)' : '100%',
    margin: '0 auto',
    overflow: 'hidden',
    borderRadius: 8,
    minHeight: 200,
    background: config.imageUrl ? 'none' : '#1e293b',
  };

  return (
    <div className="banner-page">
      {/* Header */}
      <div className="banner-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="banner-back-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Banner Home</h1>
            {lastSaved && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Guardado {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="banner-toggle">
            <input type="checkbox" checked={!!config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="banner-toggle-slider"></span>
          </label>
          <button className="banner-save-btn" onClick={handleSave} disabled={loading}>
            <Save size={15} />
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="banner-config-body">
        {/* Left: config panel */}
        <div className="banner-config-panel">
          {/* Tabs */}
          <div className="banner-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`banner-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="banner-tab-content">
            {/* ── TAB: Imagen ── */}
            {activeTab === 'imagen' && (
              <div className="config-fields">
                <div className="info-box" style={{ background: '#f0fdf4', borderColor: '#86efac', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                    <strong>📐 Medidas recomendadas:</strong> 1920 × 600 px mínimo para desktop · 768 × 500 px para mobile.
                    Formato JPG o WebP para mejor rendimiento.
                  </p>
                </div>

                {/* Desktop image */}
                <div className="form-group">
                  <label>Imagen principal (desktop)</label>
                  {config.imageUrl ? (
                    <div className="banner-img-preview">
                      <img src={config.imageUrl} alt="Banner preview" />
                      <button
                        type="button"
                        className="banner-img-remove"
                        onClick={() => patch({ imageUrl: '' })}
                      >
                        <Trash2 size={14} /> Quitar
                      </button>
                    </div>
                  ) : (
                    <div
                      className="banner-upload-zone"
                      onClick={() => fileRef.current?.click()}
                    >
                      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => uploadImage(e.target.files[0], 'imageUrl', setUploading)} />
                      <div className="banner-upload-icon">🖼</div>
                      <div>{uploading ? 'Subiendo…' : 'Click para subir imagen'}</div>
                      <div className="banner-upload-hint">JPG, PNG, WebP · máx 8 MB</div>
                    </div>
                  )}
                </div>

                {/* Mobile image */}
                <div className="form-group">
                  <label>Imagen mobile (opcional)</label>
                  <small className="field-hint">Si no la subís, se usa la imagen principal en todos los dispositivos.</small>
                  {config.imageMobileUrl ? (
                    <div className="banner-img-preview" style={{ marginTop: 8 }}>
                      <img src={config.imageMobileUrl} alt="Mobile preview" />
                      <button
                        type="button"
                        className="banner-img-remove"
                        onClick={() => patch({ imageMobileUrl: '' })}
                      >
                        <Trash2 size={14} /> Quitar
                      </button>
                    </div>
                  ) : (
                    <div
                      className="banner-upload-zone"
                      style={{ marginTop: 8 }}
                      onClick={() => mobileFileRef.current?.click()}
                    >
                      <input ref={mobileFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => uploadImage(e.target.files[0], 'imageMobileUrl', setUploadingMobile)} />
                      <div>{uploadingMobile ? 'Subiendo…' : '📱 Subir imagen mobile'}</div>
                    </div>
                  )}
                </div>

                {/* Link del banner */}
                <div className="form-group">
                  <label>Link al hacer clic en el banner (opcional)</label>
                  <input type="url" value={config.linkUrl || ''} onChange={(e) => patch({ linkUrl: e.target.value })}
                    placeholder="https://mitienda.com/coleccion" />
                </div>

                {/* Alt text */}
                <div className="form-group">
                  <label>Texto alternativo (accesibilidad)</label>
                  <input type="text" value={config.imageAlt} onChange={(e) => patch({ imageAlt: e.target.value })}
                    placeholder="Descripción de la imagen para lectores de pantalla" />
                </div>

                {/* Width */}
                <div className="form-group">
                  <label>Ancho del banner</label>
                  <div className="banner-radio-group">
                    <label className={`banner-radio-option ${config.width === 'full' ? 'active' : ''}`}>
                      <input type="radio" name="width" value="full" checked={config.width === 'full'} onChange={() => patch({ width: 'full' })} />
                      <span>Ancho completo (100vw)</span>
                    </label>
                    <label className={`banner-radio-option ${config.width === 'contained' ? 'active' : ''}`}>
                      <input type="radio" name="width" value="contained" checked={config.width === 'contained'} onChange={() => patch({ width: 'contained' })} />
                      <span>Contenido (máx 1200px centrado)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Contenido ── */}
            {activeTab === 'contenido' && (
              <div className="config-fields">
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button type="button" className="btn-add-element" onClick={() => addElement('text')}>
                    <Type size={14} /> Agregar texto
                  </button>
                  <button type="button" className="btn-add-element" onClick={() => addElement('button')}>
                    <MousePointer size={14} /> Agregar botón
                  </button>
                </div>

                {config.elements.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', background: '#f9fafb', borderRadius: 10, border: '2px dashed #d1d5db', color: '#6b7280', fontSize: 14 }}>
                    Agregá textos y botones para mostrar sobre la imagen.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {config.elements.map((el, idx) => (
                    <div key={el.id} className="banner-element-card">
                      <div className="banner-element-header" onClick={() => setExpandedEl(expandedEl === el.id ? null : el.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GripVertical size={14} color="#9ca3af" />
                          <span className="banner-element-type-badge">{el.type === 'text' ? 'T' : 'B'}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {el.text || '(sin texto)'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveElement(el.id, -1); }} disabled={idx === 0} className="icon-btn" title="Subir">↑</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); moveElement(el.id, 1); }} disabled={idx === config.elements.length - 1} className="icon-btn" title="Bajar">↓</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="icon-btn danger" title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {expandedEl === el.id && (
                        <div className="banner-element-body">
                          {el.type === 'text' ? (
                            <TextElementEditor el={el} onChange={(u) => updateElement(el.id, u)} />
                          ) : (
                            <ButtonElementEditor el={el} onChange={(u) => updateElement(el.id, u)} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: Diseño ── */}
            {activeTab === 'diseno' && (
              <div className="config-fields">
                <div className="form-group">
                  <label>Alineación horizontal del contenido</label>
                  <div className="banner-radio-group">
                    {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([v, l]) => (
                      <label key={v} className={`banner-radio-option ${config.contentAlign === v ? 'active' : ''}`}>
                        <input type="radio" name="contentAlign" value={v} checked={config.contentAlign === v} onChange={() => patch({ contentAlign: v })} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Alineación vertical del contenido</label>
                  <div className="banner-radio-group">
                    {[['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']].map(([v, l]) => (
                      <label key={v} className={`banner-radio-option ${config.contentValign === v ? 'active' : ''}`}>
                        <input type="radio" name="contentValign" value={v} checked={config.contentValign === v} onChange={() => patch({ contentValign: v })} />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Padding del área de contenido ({config.contentPadding}px)</label>
                  <input type="range" min="0" max="120" step="4" value={config.contentPadding}
                    onChange={(e) => patch({ contentPadding: parseInt(e.target.value, 10) })} />
                </div>

                <hr style={{ margin: '20px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

                <div className="form-group">
                  <label>Overlay (oscurecimiento sobre la imagen)</label>
                  <small className="field-hint">Útil para que el texto resalte sobre la imagen.</small>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Color del overlay</label>
                    <div className="color-input-group">
                      <input type="color" value={config.overlayColor || '#000000'} onChange={(e) => patch({ overlayColor: e.target.value })} />
                      <input type="text" value={config.overlayColor || '#000000'} onChange={(e) => patch({ overlayColor: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Opacidad del overlay ({Math.round((config.overlayOpacity || 0) * 100)}%)</label>
                    <input type="range" min="0" max="0.85" step="0.05" value={config.overlayOpacity || 0}
                      onChange={(e) => patch({ overlayOpacity: parseFloat(e.target.value) })} />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Posición ── */}
            {activeTab === 'posicion' && (
              <div className="config-fields">
                <div className="info-box" style={{ marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                    <strong>📍 ¿Dónde aparece el banner?</strong> Definí el selector CSS del elemento de tu tienda
                    antes o después del cual se inyectará el banner. Si lo dejás vacío, se agrega al final del <code>body</code>.
                  </p>
                </div>

                <div className="form-group">
                  <label>Selector CSS (opcional)</label>
                  <input type="text" value={config.injectSelector} onChange={(e) => patch({ injectSelector: e.target.value })}
                    placeholder="Ej: .main-slider, #banner-home, .js-main-header" />
                  <small className="field-hint">
                    Usá las DevTools del navegador (F12) para encontrar el selector correcto del elemento de tu tema.
                  </small>
                </div>

                <div className="form-group">
                  <label>Posición respecto al selector</label>
                  <select value={config.injectPosition} onChange={(e) => patch({ injectPosition: e.target.value })}>
                    <option value="after">Después del elemento</option>
                    <option value="before">Antes del elemento</option>
                    <option value="append">Al final (dentro del elemento)</option>
                    <option value="prepend">Al inicio (dentro del elemento)</option>
                  </select>
                </div>
              </div>
            )}


          </div>
        </div>

        {/* Right: preview */}
        <div className="banner-config-preview">
          <div className="banner-preview-label">Vista previa</div>
          <div style={previewStyle}>
            {config.imageUrl && (
              <img
                src={config.imageUrl}
                alt={config.imageAlt || ''}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            )}
            {!config.imageUrl && (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
                Subí una imagen para ver la vista previa
              </div>
            )}
            {config.imageUrl && config.overlayOpacity > 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                background: config.overlayColor,
                opacity: config.overlayOpacity,
                pointerEvents: 'none',
              }} />
            )}
            {config.imageUrl && config.elements.length > 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: alignItemsMap[config.contentAlign] || 'center',
                justifyContent: justifyMap[config.contentValign] || 'center',
                padding: config.contentPadding,
                gap: 12,
                pointerEvents: 'none',
              }}>
                {config.elements.map(el => el.type === 'text' ? (
                  <p key={el.id} style={{
                    margin: 0,
                    fontSize: el.fontSize,
                    fontWeight: el.fontWeight,
                    color: el.color,
                    textAlign: el.textAlign || config.contentAlign,
                    lineHeight: 1.2,
                    maxWidth: '100%',
                  }}>
                    {el.text}
                  </p>
                ) : (
                  <span key={el.id} style={{
                    display: 'inline-block',
                    padding: `${el.paddingV}px ${el.paddingH}px`,
                    background: el.backgroundColor,
                    color: el.textColor,
                    borderRadius: el.borderRadius,
                    fontSize: el.fontSize,
                    fontWeight: el.fontWeight,
                    cursor: 'pointer',
                  }}>
                    {el.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Text element editor ─── */
function TextElementEditor({ el, onChange }) {
  return (
    <div className="element-editor">
      <div className="form-group">
        <label>Texto</label>
        <textarea rows={2} value={el.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Tu texto aquí…" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Tamaño ({el.fontSize}px)</label>
          <input type="range" min="12" max="96" value={el.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })} />
        </div>
        <div className="form-group">
          <label>Peso</label>
          <select value={el.fontWeight} onChange={(e) => onChange({ fontWeight: e.target.value })}>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi-bold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
            <option value="900">Black (900)</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Color</label>
          <div className="color-input-group">
            <input type="color" value={el.color} onChange={(e) => onChange({ color: e.target.value })} />
            <input type="text" value={el.color} onChange={(e) => onChange({ color: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Alineación</label>
          <select value={el.textAlign || 'center'} onChange={(e) => onChange({ textAlign: e.target.value })}>
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ─── Button element editor ─── */
function ButtonElementEditor({ el, onChange }) {
  return (
    <div className="element-editor">
      <div className="form-group">
        <label>Texto del botón</label>
        <input type="text" value={el.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Ver colección" />
      </div>
      <div className="form-group">
        <label>URL de destino</label>
        <input type="url" value={el.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://… o /productos" />
        <small className="field-hint">Puede ser una URL externa, una ruta interna de tu tienda, o ambas.</small>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Color de fondo</label>
          <div className="color-input-group">
            <input type="color" value={el.backgroundColor} onChange={(e) => onChange({ backgroundColor: e.target.value })} />
            <input type="text" value={el.backgroundColor} onChange={(e) => onChange({ backgroundColor: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Color del texto</label>
          <div className="color-input-group">
            <input type="color" value={el.textColor} onChange={(e) => onChange({ textColor: e.target.value })} />
            <input type="text" value={el.textColor} onChange={(e) => onChange({ textColor: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Border radius ({el.borderRadius}px)</label>
          <input type="range" min="0" max="50" value={el.borderRadius} onChange={(e) => onChange({ borderRadius: parseInt(e.target.value, 10) })} />
        </div>
        <div className="form-group">
          <label>Tamaño texto ({el.fontSize || 15}px)</label>
          <input type="range" min="12" max="24" value={el.fontSize || 15} onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Padding horizontal ({el.paddingH}px)</label>
          <input type="range" min="8" max="80" value={el.paddingH} onChange={(e) => onChange({ paddingH: parseInt(e.target.value, 10) })} />
        </div>
        <div className="form-group">
          <label>Padding vertical ({el.paddingV}px)</label>
          <input type="range" min="6" max="40" value={el.paddingV} onChange={(e) => onChange({ paddingV: parseInt(e.target.value, 10) })} />
        </div>
      </div>
      <div className="form-group">
        <label>Peso de fuente</label>
        <select value={el.fontWeight || '600'} onChange={(e) => onChange({ fontWeight: e.target.value })}>
          <option value="400">Normal (400)</option>
          <option value="500">Medium (500)</option>
          <option value="600">Semi-bold (600)</option>
          <option value="700">Bold (700)</option>
          <option value="800">Extra Bold (800)</option>
        </select>
      </div>
    </div>
  );
}

export default BannerConfig;
