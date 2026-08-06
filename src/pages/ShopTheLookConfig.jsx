import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';

const DEFAULT_CONFIG = {
  enabled: false,
  title: 'Shop the Look',
  subtitle: '',
  hotspotColor: '#ffffff',
  hotspotTextColor: '#111111',
  hotspotBorderColor: 'rgba(255,255,255,0.35)',
  hotspotSize: 32,
  hotspotShape: 'circle',
  hotspotAnimation: 'pulse',
  hotspotLabelMode: 'auto',
  hotspotFontSize: 18,
  hotspotFontWeight: '700',
  hoverCardEnabled: true,
  hoverCardBg: '#ffffff',
  hoverCardText: '#111111',
  hoverCardButtonBg: '#111111',
  hoverCardButtonText: '#ffffff',
  hoverCardButtonLabel: 'Ver producto',
  injectSelector: '',
  injectPosition: 'after',
  looks: [],
};

function ShopTheLookConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (!storeId) return;
    apiRequest(`/api/style-config?storeId=${storeId}`)
      .then(data => {
        if (data.success && data.config?.shopTheLook) {
          setConfig({ ...DEFAULT_CONFIG, ...data.config.shopTheLook });
          if (data.config.updatedAt) setLastSaved(new Date(data.config.updatedAt));
        }
      })
      .catch(() => {});
  }, [storeId]);

  const handleSave = async () => {
    if (!storeId) { toast.error('No se encontró el ID de la tienda.'); return; }
    setLoading(true);
    try {
      // Load full config first so we don't overwrite other Style settings
      const current = await apiRequest(`/api/style-config?storeId=${storeId}`);
      const fullConfig = (current.success && current.config) ? current.config : {};
      const data = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: { ...fullConfig, shopTheLook: config } }),
      });
      if (data.success) {
        toast.success('Configuración guardada. Los cambios se verán en tu tienda en 1-2 minutos.');
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

  return (
    <div className="style-config-page">
      {/* Header */}
      <div className="style-config-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📍 Shop the Look</h1>
            {lastSaved && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Guardado {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={loading}
        >
          <Save size={15} />
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="style-config-content" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        <ShopTheLookEditor
          config={config}
          onChange={(patch) => setConfig(prev => ({ ...prev, ...patch }))}
          storeId={storeId}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* ShopTheLookEditor — extracted from StyleConfig.jsx             */
/* ─────────────────────────────────────────────────────────────── */

function ShopTheLookEditor({ config, onChange, storeId }) {
  const cfg = config || {};
  const looks = Array.isArray(cfg.looks) ? cfg.looks : [];
  const [activeLookIdx, setActiveLookIdx] = useState(0);
  const [uploadingLook, setUploadingLook] = useState(null);
  const [pickerHotspot, setPickerHotspot] = useState(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const imgRefs = useRef({});

  const updateLook = (idx, patch) => {
    const next = looks.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange({ looks: next });
  };

  const addLook = () => {
    const next = looks.concat([{ id: 'look_' + Date.now(), imageUrl: '', hotspots: [] }]);
    onChange({ looks: next });
    setActiveLookIdx(next.length - 1);
  };

  const removeLook = (idx) => {
    if (!confirm('¿Eliminar este look y todos sus hotspots?')) return;
    const next = looks.filter((_, i) => i !== idx);
    onChange({ looks: next });
    setActiveLookIdx(0);
  };

  const uploadLookImage = async (lookIdx, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen supera 5MB'); return; }
    setUploadingLook(lookIdx);
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
        body: JSON.stringify({ storeId, fileName: file.name, fileData: base64, folder: 'shop-the-look' }),
      });
      if (!response.success) throw new Error(response.message);
      updateLook(lookIdx, { imageUrl: response.url });
    } catch (e) {
      alert('Error al subir la imagen: ' + e.message);
    } finally {
      setUploadingLook(null);
    }
  };

  const handleImageClick = (lookIdx, e) => {
    const img = imgRefs.current[lookIdx];
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const look = looks[lookIdx];
    const newHotspot = { id: 'h_' + Date.now(), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, productId: '', productName: '', productImage: '', productPrice: '', productUrl: '' };
    const nextHotspots = (look.hotspots || []).concat([newHotspot]);
    updateLook(lookIdx, { hotspots: nextHotspots });
    setPickerHotspot({ lookIdx, hotspotIdx: nextHotspots.length - 1 });
    setPickerQuery('');
    setPickerResults([]);
  };

  const updateHotspot = (lookIdx, hIdx, patch) => {
    const look = looks[lookIdx];
    const next = (look.hotspots || []).slice();
    next[hIdx] = { ...next[hIdx], ...patch };
    updateLook(lookIdx, { hotspots: next });
  };

  const removeHotspot = (lookIdx, hIdx) => {
    const look = looks[lookIdx];
    const next = (look.hotspots || []).filter((_, i) => i !== hIdx);
    updateLook(lookIdx, { hotspots: next });
  };

  const searchProducts = async (q) => {
    setPickerQuery(q);
    if (!q || q.length < 2) { setPickerResults([]); return; }
    setPickerLoading(true);
    try {
      const resp = await apiRequest(`/api/tiendanube/products/search?storeId=${storeId}&q=${encodeURIComponent(q)}`);
      const arr = Array.isArray(resp) ? resp : (resp.products || []);
      setPickerResults(arr);
    } catch (e) {
      console.error(e);
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const assignProduct = (product) => {
    if (!pickerHotspot) return;
    const { lookIdx, hotspotIdx } = pickerHotspot;
    const name = typeof product.name === 'object' ? (product.name.es || Object.values(product.name)[0]) : product.name;
    const handle = typeof product.handle === 'object' ? (product.handle.es || Object.values(product.handle)[0]) : product.handle;
    const image = product.images && product.images[0] ? (product.images[0].src || product.images[0]) : '';
    const variant = product.variants && product.variants[0] ? product.variants[0] : null;
    const price = variant ? variant.price : '';
    const productUrl = handle ? `/productos/${handle}` : '';
    const formatPrice = (p) => {
      if (!p) return '';
      const num = parseFloat(String(p).replace(',', '.'));
      if (isNaN(num)) return `$${p}`;
      const hasDecimals = num % 1 !== 0;
      return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: hasDecimals ? 2 : 0 });
    };
    updateHotspot(lookIdx, hotspotIdx, {
      productId: String(product.id),
      productName: name || '',
      productImage: image,
      productPrice: formatPrice(price),
      productUrl,
    });
    setPickerHotspot(null);
  };

  return (
    <div className="config-section">
      <div className="section-header">
        <h2>📍 Shop the Look</h2>
        <label className="toggle-switch">
          <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="info-box" style={{ background: '#eff6ff', borderColor: '#3b82f6', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
          <strong>💡 Cómo funciona:</strong> subí una imagen (un look, un ambiente, una foto de producción). Hacé <strong>click sobre la imagen</strong> para agregar puntos y asignale un producto a cada uno. Al visitante le aparecerá un modal para agregarlo al carrito.
        </p>
      </div>

      {cfg.enabled && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Título de la sección</label>
              <input type="text" value={cfg.title || ''} onChange={(e) => onChange({ title: e.target.value })} placeholder="Shop the Look" />
            </div>
            <div className="form-group">
              <label>Subtítulo (opcional)</label>
              <input type="text" value={cfg.subtitle || ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Descubrí los productos del look" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color del hotspot</label>
              <div className="color-input-group">
                <input type="color" value={cfg.hotspotColor || '#ffffff'} onChange={(e) => onChange({ hotspotColor: e.target.value })} />
                <input type="text" value={cfg.hotspotColor || '#ffffff'} onChange={(e) => onChange({ hotspotColor: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Color del texto del hotspot</label>
              <div className="color-input-group">
                <input type="color" value={cfg.hotspotTextColor || '#111111'} onChange={(e) => onChange({ hotspotTextColor: e.target.value })} />
                <input type="text" value={cfg.hotspotTextColor || '#111111'} onChange={(e) => onChange({ hotspotTextColor: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color del borde / halo</label>
              <input type="text" value={cfg.hotspotBorderColor || 'rgba(255,255,255,0.35)'} onChange={(e) => onChange({ hotspotBorderColor: e.target.value })} placeholder="rgba(255,255,255,0.35)" />
              <small className="field-hint">Admite hex o rgba con transparencia.</small>
            </div>
            <div className="form-group">
              <label>Tamaño ({cfg.hotspotSize || 32}px)</label>
              <input type="range" min="18" max="72" value={cfg.hotspotSize || 32} onChange={(e) => onChange({ hotspotSize: parseInt(e.target.value, 10) })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Forma del hotspot</label>
              <select value={cfg.hotspotShape || 'circle'} onChange={(e) => onChange({ hotspotShape: e.target.value })}>
                <option value="circle">Círculo</option>
                <option value="rounded">Cuadrado redondeado</option>
                <option value="square">Cuadrado</option>
                <option value="tag">Pill / Tag (horizontal)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Animación</label>
              <select value={cfg.hotspotAnimation || 'pulse'} onChange={(e) => onChange({ hotspotAnimation: e.target.value })}>
                <option value="pulse">Pulso (halo expandido)</option>
                <option value="bounce">Rebote sutil</option>
                <option value="glow">Brillo expansivo</option>
                <option value="none">Sin animación</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contenido del punto</label>
              <select value={cfg.hotspotLabelMode || 'auto'} onChange={(e) => onChange({ hotspotLabelMode: e.target.value })}>
                <option value="auto">Automático (usa label custom o símbolo)</option>
                <option value="number">Numerado (1, 2, 3…)</option>
                <option value="plus">Símbolo +</option>
                <option value="custom">Texto personalizado (por hotspot)</option>
                <option value="none">Vacío (solo animación)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Peso / grosor del texto</label>
              <select value={cfg.hotspotFontWeight || '700'} onChange={(e) => onChange({ hotspotFontWeight: e.target.value })}>
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semi-bold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra bold (800)</option>
                <option value="900">Black (900)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tamaño del texto del hotspot ({cfg.hotspotFontSize || 18}px)</label>
            <input type="range" min="10" max="28" value={cfg.hotspotFontSize || 18} onChange={(e) => onChange({ hotspotFontSize: parseInt(e.target.value, 10) })} />
          </div>

          <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>💬</span> Popup flotante al pasar el mouse
            <label className="toggle-switch" style={{ marginLeft: 'auto' }}>
              <input type="checkbox" checked={cfg.hoverCardEnabled !== false} onChange={(e) => onChange({ hoverCardEnabled: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            Al pasar el cursor sobre un punto, aparece una tarjetita con la foto del producto, precio y botón. En mobile (sin hover) se abre un modal al tocar.
          </p>

          {cfg.hoverCardEnabled !== false && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Fondo del popup</label>
                  <div className="color-input-group">
                    <input type="color" value={cfg.hoverCardBg || '#ffffff'} onChange={(e) => onChange({ hoverCardBg: e.target.value })} />
                    <input type="text" value={cfg.hoverCardBg || '#ffffff'} onChange={(e) => onChange({ hoverCardBg: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Color del texto</label>
                  <div className="color-input-group">
                    <input type="color" value={cfg.hoverCardText || '#111111'} onChange={(e) => onChange({ hoverCardText: e.target.value })} />
                    <input type="text" value={cfg.hoverCardText || '#111111'} onChange={(e) => onChange({ hoverCardText: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fondo del botón</label>
                  <div className="color-input-group">
                    <input type="color" value={cfg.hoverCardButtonBg || '#111111'} onChange={(e) => onChange({ hoverCardButtonBg: e.target.value })} />
                    <input type="text" value={cfg.hoverCardButtonBg || '#111111'} onChange={(e) => onChange({ hoverCardButtonBg: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Color del texto del botón</label>
                  <div className="color-input-group">
                    <input type="color" value={cfg.hoverCardButtonText || '#ffffff'} onChange={(e) => onChange({ hoverCardButtonText: e.target.value })} />
                    <input type="text" value={cfg.hoverCardButtonText || '#ffffff'} onChange={(e) => onChange({ hoverCardButtonText: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Texto del botón</label>
                <input type="text" value={cfg.hoverCardButtonLabel || 'Ver producto'} onChange={(e) => onChange({ hoverCardButtonLabel: e.target.value })} placeholder="Ver producto" />
              </div>
            </>
          )}

          <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

          <div className="form-row">
            <div className="form-group">
              <label>Selector CSS de inyección (avanzado, opcional)</label>
              <input type="text" value={cfg.injectSelector || ''} onChange={(e) => onChange({ injectSelector: e.target.value })} placeholder="Dejar vacío para ubicación automática (después del banner)" />
              <small className="field-hint">Ej: <code>.main-slider</code>, <code>#banner-home</code>, <code>main</code>. Vacío = auto.</small>
            </div>
            <div className="form-group">
              <label>Posición respecto al selector</label>
              <select value={cfg.injectPosition || 'after'} onChange={(e) => onChange({ injectPosition: e.target.value })}>
                <option value="after">Después</option>
                <option value="before">Antes</option>
                <option value="prepend">Al inicio (dentro)</option>
                <option value="append">Al final (dentro)</option>
              </select>
            </div>
          </div>

          <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

          {looks.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 12, border: '2px dashed #d1d5db' }}>
              <p style={{ margin: '0 0 16px', color: '#6b7280' }}>Todavía no agregaste ninguna imagen.</p>
              <button type="button" onClick={addLook} style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                + Agregar primer look
              </button>
            </div>
          )}

          {looks.length > 0 && (
            <>
              {looks.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {looks.map((_, i) => (
                    <button key={i} type="button" onClick={() => setActiveLookIdx(i)}
                      style={{ padding: '6px 14px', background: activeLookIdx === i ? '#111' : '#f3f4f6', color: activeLookIdx === i ? '#fff' : '#111', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Look {i + 1}
                    </button>
                  ))}
                  <button type="button" onClick={addLook} style={{ padding: '6px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Nuevo look</button>
                </div>
              )}

              {looks[activeLookIdx] && (
                <LookEditor
                  look={looks[activeLookIdx]}
                  idx={activeLookIdx}
                  uploading={uploadingLook === activeLookIdx}
                  onUpload={(file) => uploadLookImage(activeLookIdx, file)}
                  onImageClick={(e) => handleImageClick(activeLookIdx, e)}
                  onRemove={() => removeLook(activeLookIdx)}
                  updateHotspot={(hi, p) => updateHotspot(activeLookIdx, hi, p)}
                  removeHotspot={(hi) => removeHotspot(activeLookIdx, hi)}
                  openPicker={(hi) => { setPickerHotspot({ lookIdx: activeLookIdx, hotspotIdx: hi }); setPickerQuery(''); setPickerResults([]); }}
                  hotspotColor={cfg.hotspotColor || '#ffffff'}
                  hotspotTextColor={cfg.hotspotTextColor || '#111111'}
                  hotspotBorderColor={cfg.hotspotBorderColor || 'rgba(255,255,255,0.35)'}
                  hotspotSize={cfg.hotspotSize || 32}
                  hotspotShape={cfg.hotspotShape || 'circle'}
                  hotspotAnimation={cfg.hotspotAnimation || 'pulse'}
                  hotspotLabelMode={cfg.hotspotLabelMode || 'auto'}
                  hotspotFontSize={cfg.hotspotFontSize || 18}
                  hotspotFontWeight={cfg.hotspotFontWeight || '700'}
                  imgRefs={imgRefs}
                  canAddMore={looks.length === 1}
                  onAddLook={addLook}
                />
              )}
            </>
          )}

          {pickerHotspot && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPickerHotspot(null)}>
              <div className="stl-light-card" style={{ background: '#fff', borderRadius: 14, padding: 20, maxWidth: 540, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 17 }}>Asignar producto al hotspot</h3>
                  <button type="button" onClick={() => setPickerHotspot(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => searchProducts(e.target.value)}
                  placeholder="Buscá por nombre del producto…"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, marginBottom: 12, boxSizing: 'border-box', color: '#111111', background: '#ffffff' }}
                />
                {pickerLoading && <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Buscando…</p>}
                {!pickerLoading && pickerQuery.length >= 2 && pickerResults.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Sin resultados</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pickerResults.map((p) => {
                    const name = typeof p.name === 'object' ? (p.name.es || Object.values(p.name)[0]) : p.name;
                    const img = p.images && p.images[0] ? (p.images[0].src || p.images[0]) : null;
                    const price = p.variants && p.variants[0] ? p.variants[0].price : '';
                    return (
                      <button key={p.id} type="button" onClick={() => assignProduct(p)}
                        style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                        {img && <img src={img} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                          {price && <div style={{ fontSize: 13, color: '#6b7280' }}>${price}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* LookEditor — extracted from StyleConfig.jsx                    */
/* ─────────────────────────────────────────────────────────────── */

function LookEditor({ look, idx, uploading, onUpload, onImageClick, onRemove, updateHotspot, removeHotspot, openPicker, hotspotColor, hotspotTextColor, hotspotBorderColor, hotspotSize, hotspotShape, hotspotAnimation, hotspotLabelMode, hotspotFontSize, hotspotFontWeight, imgRefs, canAddMore, onAddLook }) {
  const fileRef = useRef(null);
  const hotspots = look.hotspots || [];

  const shapeRadiusMap = { circle: '50%', square: '4px', rounded: '10px', tag: '999px' };
  const previewRadius = shapeRadiusMap[hotspotShape] || '50%';
  const isTag = hotspotShape === 'tag';

  const getPreviewLabel = (h, hi) => {
    if (hotspotLabelMode === 'custom') return h.label || '';
    if (hotspotLabelMode === 'number') return String(hi + 1);
    if (hotspotLabelMode === 'plus') return '+';
    if (hotspotLabelMode === 'none') return '';
    if (h.label) return h.label;
    if (isTag) return 'Ver';
    return hotspotAnimation === 'pulse' ? '' : '+';
  };

  return (
    <div className="stl-light-card" style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>Look {idx + 1}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          {canAddMore && (
            <button type="button" onClick={onAddLook} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Otro look</button>
          )}
          <button type="button" onClick={onRemove} style={{ padding: '6px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🗑 Eliminar</button>
        </div>
      </div>

      {!look.imageUrl ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#f9fafb', borderRadius: 8, border: '2px dashed #d1d5db' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onUpload(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', fontWeight: 600 }}>
            {uploading ? 'Subiendo…' : '📤 Subir imagen'}
          </button>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: '#6b7280' }}>JPG, PNG o WebP · máximo 5 MB</p>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'crosshair', userSelect: 'none' }}>
            <img
              ref={(el) => { imgRefs.current[idx] = el; }}
              src={look.imageUrl}
              alt=""
              onClick={onImageClick}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
            {hotspots.map((h, hi) => (
              <div key={h.id || hi}
                title={h.productName || 'Sin producto asignado'}
                style={{ position: 'absolute', left: `${h.x}%`, top: `${h.y}%`, width: isTag ? 'auto' : hotspotSize, minWidth: hotspotSize, height: hotspotSize, padding: isTag ? `0 ${Math.max(10, Math.round(hotspotSize * 0.45))}px` : 0, transform: 'translate(-50%, -50%)', borderRadius: previewRadius, background: hotspotColor, color: hotspotTextColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: hotspotFontWeight, fontSize: hotspotFontSize, lineHeight: 1, whiteSpace: 'nowrap', boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 0 3px ${hotspotBorderColor}`, pointerEvents: 'none', border: h.productId ? 'none' : '2px dashed #ef4444', boxSizing: 'border-box' }}>
                {getPreviewLabel(h, hi)}
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280' }}>
            💡 Hacé <strong>click sobre la imagen</strong> donde quieras agregar un punto. Los hotspots con borde rojo aún no tienen producto asignado.
          </p>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              🔄 Reemplazar imagen
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onUpload(e.target.files[0])} />
          </div>

          {hotspots.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Hotspots ({hotspots.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hotspots.map((h, hi) => (
                  <div key={h.id || hi} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                    <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: hotspotColor, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, boxShadow: '0 0 0 2px rgba(0,0,0,0.15)' }}>
                      {hi + 1}
                    </div>
                    {h.productImage ? <img src={h.productImage} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, background: '#e5e7eb', borderRadius: 4, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.productName || <span style={{ color: '#ef4444' }}>Sin producto</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>X: {h.x}% · Y: {h.y}%{h.productPrice ? ' · ' + h.productPrice : ''}</div>
                    </div>
                    <input type="number" value={h.x} step="0.5" min="0" max="100" onChange={(e) => updateHotspot(hi, { x: parseFloat(e.target.value) || 0 })} style={{ width: 60, padding: '4px 6px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4 }} title="X%" />
                    <input type="number" value={h.y} step="0.5" min="0" max="100" onChange={(e) => updateHotspot(hi, { y: parseFloat(e.target.value) || 0 })} style={{ width: 60, padding: '4px 6px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4 }} title="Y%" />
                    <input type="text" value={h.label || ''} onChange={(e) => updateHotspot(hi, { label: e.target.value })} placeholder="label" style={{ width: 70, padding: '4px 6px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 4 }} title="Texto del punto" />
                    <button type="button" onClick={() => openPicker(hi)} style={{ padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {h.productId ? 'Cambiar' : 'Asignar'}
                    </button>
                    <button type="button" onClick={() => removeHotspot(hi)} style={{ padding: '6px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }} title="Eliminar">🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ShopTheLookConfig;
