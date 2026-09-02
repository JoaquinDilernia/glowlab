import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Search, Eye, Plus, Trash2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { useImageUpload } from '../hooks/useImageUpload';
import './StyleConfig.css';
import './SearchConfig.css';

const DEFAULT_CONFIG = {
  enabled: false,
  template: 'minimal',
  title: 'Buscar productos',
  primaryColor: '#111111',
  fontFamily: 'system-ui',
  fontSize: 'medium',
  aiEnabled: false,
  banners: [],
  featuredSearches: [],
};

const FONT_OPTIONS = [
  { value: 'system-ui', label: 'System (nativa)' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Georgia', serif", label: 'Georgia' },
];

const TEMPLATES = [
  { value: 'minimal', label: 'Minimal', available: true },
  { value: 'grid', label: 'Grid con banners', available: true },
  { value: 'compact', label: 'Compacto', available: true },
];

const PREVIEW_PRODUCTS = [
  { name: 'Silla Ronda Roble', price: 89000 },
  { name: 'Espejo Hanna Chico', price: 34900 },
  { name: 'Set de Puffs Lino', price: 125000 },
];

function fmt(n) {
  return Math.round(n).toLocaleString('es-AR');
}

function SearchConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const { upload, uploading } = useImageUpload(storeId, 'search-banners');
  const fileInputRef = useRef(null);
  const pendingBannerIndex = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [previewQuery, setPreviewQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/search-config?storeId=${storeId}`);
        if (res?.success && res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const addBanner = () => {
    setConfig(c => ({ ...c, banners: [...c.banners, { id: 'b_' + Date.now(), imageUrl: '', url: '' }] }));
  };
  const patchBanner = (i, patch) => {
    setConfig(c => ({ ...c, banners: c.banners.map((b, idx) => idx === i ? { ...b, ...patch } : b) }));
  };
  const removeBanner = (i) => {
    setConfig(c => ({ ...c, banners: c.banners.filter((_, idx) => idx !== i) }));
  };

  const pickBannerImage = (i) => {
    pendingBannerIndex.current = i;
    fileInputRef.current?.click();
  };
  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || pendingBannerIndex.current === null) return;
    const url = await upload(file);
    if (url) patchBanner(pendingBannerIndex.current, { imageUrl: url });
    pendingBannerIndex.current = null;
  };

  const addFeatured = () => {
    setConfig(c => ({ ...c, featuredSearches: [...c.featuredSearches, { id: 'f_' + Date.now(), label: '', url: '' }] }));
  };
  const patchFeatured = (i, patch) => {
    setConfig(c => ({ ...c, featuredSearches: c.featuredSearches.map((f, idx) => idx === i ? { ...f, ...patch } : f) }));
  };
  const removeFeatured = (i) => {
    setConfig(c => ({ ...c, featuredSearches: c.featuredSearches.filter((_, idx) => idx !== i) }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/search-config', {
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
  }, [storeId, config, toast]);

  if (loading) {
    return (
      <div className="page-container sc-page">
        <div className="sc-loading">
          <div className="sc-spinner" />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  const fontSizeMap = { small: 14, medium: 16, large: 18 };
  const previewFiltered = previewQuery
    ? PREVIEW_PRODUCTS.filter(p => p.name.toLowerCase().includes(previewQuery.toLowerCase()))
    : PREVIEW_PRODUCTS;
  const bannersWithImage = config.banners.filter(b => b.imageUrl);
  const hasFeatured = config.featuredSearches.filter(f => f.label).length > 0;

  return (
    <div className="page-container sc-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />

      <div className="sc-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="sc-btn-save" onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="sc-hero">
        <div className="sc-hero-icon"><Search size={22} /></div>
        <div>
          <h1>Buscador Inteligente Pro</h1>
          <p>Popup de búsqueda con tolerancia a errores/sinónimos, banners y búsquedas recomendadas.</p>
        </div>
      </div>

      <div className="sc-layout">
        {/* Form */}
        <div className="config-section sc-form-section">
          <div className="section-header sc-section-header">
            <h2>General</h2>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!config.enabled} onChange={e => handle('enabled', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="form-group">
            <label>Título / placeholder del buscador</label>
            <input type="text" value={config.title} onChange={e => handle('title', e.target.value)} />
          </div>

          <div className="sc-block-title">Diseño</div>
          <div className="sc-templates">
            {TEMPLATES.map(t => (
              <button
                key={t.value}
                className={`sc-template-card ${config.template === t.value ? 'sc-template-active' : ''}`}
                disabled={!t.available}
                onClick={() => t.available && handle('template', t.value)}
                title={t.available ? '' : 'Próximamente'}
              >
                {t.label}{!t.available && <span className="sc-soon">Próximamente</span>}
              </button>
            ))}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color principal</label>
              <div className="sc-color-row">
                <input type="color" value={config.primaryColor} onChange={e => handle('primaryColor', e.target.value)} />
                <input type="text" value={config.primaryColor} onChange={e => handle('primaryColor', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Tamaño de texto</label>
              <select value={config.fontSize} onChange={e => handle('fontSize', e.target.value)}>
                <option value="small">Chico</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Tipografía</label>
            <select value={config.fontFamily} onChange={e => handle('fontFamily', e.target.value)}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="sc-block-title-row">
            <div className="sc-block-title" style={{ margin: 0 }}>Banners</div>
            <button onClick={addBanner} className="sc-btn-add"><Plus size={14} /> Agregar banner</button>
          </div>
          <div className="sc-list">
            {config.banners.map((b, i) => (
              <div key={b.id || i} className="sc-item-card">
                <button className="sc-banner-thumb" onClick={() => pickBannerImage(i)} disabled={uploading}>
                  {b.imageUrl ? <img src={b.imageUrl} alt="" /> : <ImageIcon size={18} />}
                </button>
                <div className="sc-item-fields">
                  <input type="text" placeholder="URL del banner (ej: /productos/silla-ronda)" value={b.url}
                    onChange={e => patchBanner(i, { url: e.target.value })} />
                </div>
                <button onClick={() => removeBanner(i)} className="sc-btn-remove"><Trash2 size={16} /></button>
              </div>
            ))}
            {config.banners.length === 0 && <p className="sc-hint">Sin banners todavía.</p>}
          </div>

          <div className="sc-block-title-row">
            <div className="sc-block-title" style={{ margin: 0 }}>Búsquedas recomendadas</div>
            <button onClick={addFeatured} className="sc-btn-add"><Plus size={14} /> Agregar</button>
          </div>
          <div className="sc-list">
            {config.featuredSearches.map((f, i) => (
              <div key={f.id || i} className="sc-item-card sc-item-card-sm">
                <div className="sc-item-fields sc-item-fields-row">
                  <input type="text" placeholder="Texto (ej: Sillas)" value={f.label}
                    onChange={e => patchFeatured(i, { label: e.target.value })} />
                  <input type="text" placeholder="URL (ej: /categorias/sillas)" value={f.url}
                    onChange={e => patchFeatured(i, { url: e.target.value })} />
                </div>
                <button onClick={() => removeFeatured(i)} className="sc-btn-remove"><Trash2 size={16} /></button>
              </div>
            ))}
            {config.featuredSearches.length === 0 && <p className="sc-hint">Sin búsquedas recomendadas todavía.</p>}
          </div>

          <div className="sc-block-title">Inteligencia artificial</div>
          <label className="sc-check">
            <input type="checkbox" checked={!!config.aiEnabled} onChange={e => handle('aiEnabled', e.target.checked)} />
            <Sparkles size={14} style={{ marginRight: 4 }} />
            Usar IA cuando la búsqueda normal no encuentra resultados
          </label>
          <p className="sc-hint">Recomendado para búsquedas tipo "algo para regalar" o con errores de tipeo difíciles. No se usa en cada letra tipeada, solo como respaldo.</p>
        </div>

        {/* Preview */}
        <div className="sc-preview-col">
          <div className="sc-preview-sticky">
            <div className="sc-preview-label"><Eye size={15} /> Vista previa {config.template === 'compact' && <span className="sc-preview-tag">dropdown anclado</span>}</div>

            {config.template === 'compact' && (
              <div className="sc-preview-compact-header">
                <span>Tu tienda</span>
                <span className="sc-preview-compact-icon"><Search size={13} /></span>
              </div>
            )}

            <div className={`sc-preview-panel sc-tpl-${config.template}`} style={{ fontFamily: config.fontFamily }}>
              {config.template === 'grid' && bannersWithImage.length > 0 && (
                <div className="sc-preview-side">
                  {bannersWithImage.map((b, i) => <img key={i} src={b.imageUrl} alt="" />)}
                </div>
              )}
              <div className="sc-preview-main">
                <div className="sc-preview-head">
                  <input
                    className="sc-preview-input"
                    style={{ fontSize: fontSizeMap[config.fontSize] }}
                    placeholder={config.title}
                    value={previewQuery}
                    onChange={e => setPreviewQuery(e.target.value)}
                  />
                </div>
                <div className="sc-preview-body">
                  {previewQuery ? (
                    previewFiltered.length ? (
                      config.template === 'grid' ? (
                        <div className="sc-preview-results-grid">
                          {previewFiltered.map((p, i) => (
                            <div key={i} className="sc-preview-result-card">
                              <div className="sc-preview-thumb sc-preview-thumb-sq" />
                              <div className="sc-preview-result-name">{p.name}</div>
                              <div className="sc-preview-result-price" style={{ color: config.primaryColor }}>${fmt(p.price)}</div>
                            </div>
                          ))}
                        </div>
                      ) : previewFiltered.map((p, i) => (
                        <div key={i} className="sc-preview-result">
                          <div className="sc-preview-thumb" />
                          <div>
                            <div className="sc-preview-result-name">{p.name}</div>
                            <div className="sc-preview-result-price" style={{ color: config.primaryColor }}>${fmt(p.price)}</div>
                          </div>
                        </div>
                      ))
                    ) : <div className="sc-preview-empty">Sin resultados</div>
                  ) : (
                    <>
                      {config.template === 'minimal' && bannersWithImage.length > 0 && (
                        <>
                          <div className="sc-preview-section-title">Destacado</div>
                          <div className="sc-preview-banners">
                            {bannersWithImage.map((b, i) => (
                              <img key={i} src={b.imageUrl} alt="" />
                            ))}
                          </div>
                        </>
                      )}
                      {hasFeatured && (
                        <>
                          <div className="sc-preview-section-title">Búsquedas recomendadas</div>
                          <div className="sc-preview-featured">
                            {config.featuredSearches.filter(f => f.label).map((f, i) => (
                              <span key={i}>{f.label}</span>
                            ))}
                          </div>
                        </>
                      )}
                      {!hasFeatured && !(config.template === 'minimal' && bannersWithImage.length > 0) && !(config.template === 'grid' && bannersWithImage.length > 0) && (
                        <div className="sc-preview-empty">Escribí algo arriba para ver resultados de ejemplo</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="sc-help">
              <strong>Para activarlo:</strong> guardá los cambios. El módulo se activa solo en tu tienda y se actualiza cada vez que guardás cambios acá.
              {config.template === 'compact' && ' "Compacto" no muestra banners: se abre como un menú chico pegado al ícono de búsqueda, sin oscurecer el resto de la página. Ideal para headers minimalistas.'}
              {config.template === 'grid' && ' "Grid con banners" muestra los banners en una columna lateral fija (siempre visibles, incluso mientras se busca) y los resultados como tarjetas con imagen grande.'}
              {config.template === 'minimal' && ' "Minimal" muestra los banners arriba de las búsquedas recomendadas, solo cuando el campo está vacío.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchConfig;
