import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, LayoutGrid, Eye, Plus, Trash2, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { useImageUpload } from '../hooks/useImageUpload';
import { buildCategoryTree, flattenTreeForSelect } from '../utils/categoryTree';
import './StyleConfig.css';
import './CategoryCarouselConfig.css';

const DEFAULT_STYLE = {
  borderRadius: 12,
  gap: 16,
  titleFontFamily: 'system-ui',
  titleFontSize: 'medium',
  titleColor: '#111111',
  titleAlign: 'center',
  desktopVisible: 4,
  mobileVisible: 2,
  marginTop: 0,
  marginBottom: 28,
  marginLeft: 0,
  marginRight: 0,
};

const DEFAULT_CONFIG = { enabled: false, style: DEFAULT_STYLE, carousels: [] };

const FONT_OPTIONS = [
  { value: 'system-ui', label: 'System (nativa)' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Georgia', serif", label: 'Georgia' },
];

function newId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

function CategoryCarouselConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const { upload, uploading } = useImageUpload(storeId, 'category-carousel');
  const fileInputRef = useRef(null);
  const pendingTarget = useRef(null); // { carouselIndex, tileIndex }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [catRows, setCatRows] = useState([]);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/category-carousel-config?storeId=${storeId}`);
        if (res?.success && res.config) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...res.config,
            style: { ...DEFAULT_STYLE, ...(res.config.style || {}) },
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/tiendanube/categories?storeId=${storeId}`);
        const flat = Array.isArray(res) ? res : (res.categories || res.data || []);
        setCatRows(flattenTreeForSelect(buildCategoryTree(flat)));
      } catch (e) { console.error(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStyle = (key, value) => setConfig(c => ({ ...c, style: { ...c.style, [key]: value } }));

  const addCarousel = () => {
    const id = newId('cc');
    setConfig(c => ({ ...c, carousels: [...c.carousels, { id, name: '', heading: '', categoryIds: [], tiles: [] }] }));
    setExpandedIds(prev => new Set(prev).add(id));
  };
  const toggleExpanded = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const patchCarousel = (i, patch) => {
    setConfig(c => ({ ...c, carousels: c.carousels.map((car, idx) => idx === i ? { ...car, ...patch } : car) }));
  };
  const removeCarousel = (i) => {
    setConfig(c => ({ ...c, carousels: c.carousels.filter((_, idx) => idx !== i) }));
  };

  const toggleCategory = (carouselIndex, categoryId) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, idx) => {
        if (idx !== carouselIndex) return car;
        const has = car.categoryIds.includes(categoryId);
        return { ...car, categoryIds: has ? car.categoryIds.filter(id => id !== categoryId) : [...car.categoryIds, categoryId] };
      }),
    }));
  };

  const addTile = (carouselIndex) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, idx) => idx === carouselIndex
        ? { ...car, tiles: [...car.tiles, { id: newId('t'), imageUrl: '', title: '', url: '' }] }
        : car),
    }));
  };
  const patchTile = (carouselIndex, tileIndex, patch) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, ci) => ci !== carouselIndex ? car : {
        ...car,
        tiles: car.tiles.map((t, ti) => ti === tileIndex ? { ...t, ...patch } : t),
      }),
    }));
  };
  const removeTile = (carouselIndex, tileIndex) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, ci) => ci !== carouselIndex ? car : {
        ...car,
        tiles: car.tiles.filter((_, ti) => ti !== tileIndex),
      }),
    }));
  };
  const moveTile = (carouselIndex, tileIndex, direction) => {
    setConfig(c => ({
      ...c,
      carousels: c.carousels.map((car, ci) => {
        if (ci !== carouselIndex) return car;
        const target = tileIndex + direction;
        if (target < 0 || target >= car.tiles.length) return car;
        const tiles = [...car.tiles];
        [tiles[tileIndex], tiles[target]] = [tiles[target], tiles[tileIndex]];
        return { ...car, tiles };
      }),
    }));
  };

  const pickTileImage = (carouselIndex, tileIndex) => {
    pendingTarget.current = { carouselIndex, tileIndex };
    fileInputRef.current?.click();
  };
  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingTarget.current) return;
    const { carouselIndex, tileIndex } = pendingTarget.current;
    const url = await upload(file);
    if (url) patchTile(carouselIndex, tileIndex, { imageUrl: url });
    pendingTarget.current = null;
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/category-carousel-config', {
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
      <div className="page-container ccc-page">
        <div className="ccc-loading">
          <div className="ccc-spinner" />
          <p>Cargando…</p>
        </div>
      </div>
    );
  }

  const previewCarousel = config.carousels.find(c => c.tiles.some(t => t.imageUrl));
  const previewTiles = previewCarousel ? previewCarousel.tiles.filter(t => t.imageUrl) : [];
  const tileWidthPct = 100 / config.style.desktopVisible;

  return (
    <div className="page-container ccc-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelected} />

      <div className="ccc-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="ccc-btn-save" onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="ccc-hero">
        <div className="ccc-hero-icon"><LayoutGrid size={22} /></div>
        <div>
          <h1>Carrusel de Categorías</h1>
          <p>Reemplazá el banner fijo de cada categoría por un carrusel de tarjetas con imagen, título y link.</p>
        </div>
      </div>

      <div className="ccc-layout">
        <div className="config-section ccc-form-section">
          <div className="section-header ccc-section-header">
            <h2>General</h2>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="ccc-block-title">Diseño (aplica a todos los carruseles)</div>
          <div className="form-row">
            <div className="form-group">
              <label>Radio de bordes (px)</label>
              <input type="number" min={0} max={40} value={config.style.borderRadius}
                onChange={e => handleStyle('borderRadius', Math.min(40, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div className="form-group">
              <label>Espacio entre tarjetas (px)</label>
              <input type="number" min={0} max={48} value={config.style.gap}
                onChange={e => handleStyle('gap', Math.min(48, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Imágenes visibles — desktop</label>
              <input type="number" min={2} max={8} value={config.style.desktopVisible}
                onChange={e => handleStyle('desktopVisible', Math.min(8, Math.max(2, Number(e.target.value) || 2)))} />
            </div>
            <div className="form-group">
              <label>Imágenes visibles — celular</label>
              <input type="number" min={1} max={6} value={config.style.mobileVisible}
                onChange={e => handleStyle('mobileVisible', Math.min(6, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Margen superior (px)</label>
              <input type="number" min={0} max={100} value={config.style.marginTop}
                onChange={e => handleStyle('marginTop', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div className="form-group">
              <label>Margen inferior (px)</label>
              <input type="number" min={0} max={100} value={config.style.marginBottom}
                onChange={e => handleStyle('marginBottom', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Margen izquierdo (px)</label>
              <input type="number" min={0} max={100} value={config.style.marginLeft}
                onChange={e => handleStyle('marginLeft', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <div className="form-group">
              <label>Margen derecho (px)</label>
              <input type="number" min={0} max={100} value={config.style.marginRight}
                onChange={e => handleStyle('marginRight', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipografía del título</label>
              <select value={config.style.titleFontFamily} onChange={e => handleStyle('titleFontFamily', e.target.value)}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tamaño del título</label>
              <select value={config.style.titleFontSize} onChange={e => handleStyle('titleFontSize', e.target.value)}>
                <option value="small">Chico</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Color del título</label>
              <div className="sc-color-row">
                <input type="color" value={config.style.titleColor} onChange={e => handleStyle('titleColor', e.target.value)} />
                <input type="text" value={config.style.titleColor} onChange={e => handleStyle('titleColor', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Alineación del título</label>
              <select value={config.style.titleAlign} onChange={e => handleStyle('titleAlign', e.target.value)}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </div>
          </div>

          <div className="ccc-block-title-row">
            <div className="ccc-block-title" style={{ margin: 0 }}>Carruseles por categoría</div>
            <button onClick={addCarousel} className="ccc-btn-add"><Plus size={14} /> Agregar carrusel</button>
          </div>
          <p className="ccc-hint">Cada carrusel tiene sus propias categorías destino y sus propias tarjetas. El diseño de arriba se aplica a todos por igual.</p>

          {config.carousels.map((carousel, ci) => {
            const isExpanded = expandedIds.has(carousel.id);
            return (
              <div key={carousel.id} className="ccc-carousel-card">
                <button type="button" className="ccc-carousel-summary" onClick={() => toggleExpanded(carousel.id)}>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="ccc-carousel-summary-name">{carousel.name || 'Sin nombre'}</span>
                  <span className="ccc-carousel-summary-meta">
                    {carousel.categoryIds.length} categoría{carousel.categoryIds.length === 1 ? '' : 's'} · {carousel.tiles.length} tarjeta{carousel.tiles.length === 1 ? '' : 's'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="ccc-carousel-body">
                    <div className="ccc-carousel-head">
                      <input type="text" placeholder="Nombre interno (ej: Living)" value={carousel.name}
                        onChange={e => patchCarousel(ci, { name: e.target.value })} />
                      <button onClick={() => removeCarousel(ci)} className="ccc-btn-remove"><Trash2 size={16} /></button>
                    </div>

                    <div className="ccc-carousel-head">
                      <input type="text" placeholder="Título visible en la tienda (opcional, ej: Sillas)" value={carousel.heading || ''}
                        onChange={e => patchCarousel(ci, { heading: e.target.value })} />
                    </div>
                    <p className="ccc-hint" style={{ marginTop: -4, marginBottom: 10 }}>Si lo dejás vacío, no se muestra ningún título arriba de este carrusel.</p>

                    <label className="ccc-hint" style={{ display: 'block', marginBottom: 6 }}>Categorías donde se muestra</label>
                    <div className="ccc-cat-picker">
                      {catRows.length === 0 && <p className="ccc-hint">No se pudieron cargar las categorías de la tienda.</p>}
                      {catRows.map(row => (
                        <label key={row.id} className="ccc-cat-row" style={{ paddingLeft: row.depth * 16 }}>
                          <input type="checkbox" checked={carousel.categoryIds.includes(row.id)}
                            onChange={() => toggleCategory(ci, row.id)} />
                          {row.name}
                        </label>
                      ))}
                    </div>

                    <div className="ccc-block-title-row" style={{ marginTop: 0 }}>
                      <label className="ccc-hint" style={{ margin: 0 }}>Tarjetas</label>
                      <button onClick={() => addTile(ci)} className="ccc-btn-add"><Plus size={14} /> Agregar tarjeta</button>
                    </div>
                    {carousel.tiles.map((tile, ti) => (
                      <div key={tile.id} className="ccc-tile-card">
                        <div className="ccc-tile-reorder">
                          <button type="button" className="ccc-btn-move" onClick={() => moveTile(ci, ti, -1)} disabled={ti === 0} aria-label="Mover arriba">
                            <ChevronUp size={14} />
                          </button>
                          <button type="button" className="ccc-btn-move" onClick={() => moveTile(ci, ti, 1)} disabled={ti === carousel.tiles.length - 1} aria-label="Mover abajo">
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <button className="ccc-tile-thumb" onClick={() => pickTileImage(ci, ti)} disabled={uploading}>
                          {tile.imageUrl ? <img src={tile.imageUrl} alt="" /> : <ImageIcon size={16} />}
                        </button>
                        <div className="ccc-tile-fields">
                          <input type="text" placeholder="Título (ej: Sillas)" value={tile.title}
                            onChange={e => patchTile(ci, ti, { title: e.target.value })} />
                          <input type="text" placeholder="URL (ej: /categorias/sillas)" value={tile.url}
                            onChange={e => patchTile(ci, ti, { url: e.target.value })} />
                        </div>
                        <button onClick={() => removeTile(ci, ti)} className="ccc-btn-remove"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    {carousel.tiles.length === 0 && <p className="ccc-hint">Sin tarjetas todavía.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {config.carousels.length === 0 && <p className="ccc-hint">Sin carruseles todavía. Agregá uno para empezar.</p>}
        </div>

        <div className="ccc-preview-col">
          <div className="ccc-preview-sticky">
            <div className="ccc-preview-label"><Eye size={15} /> Vista previa</div>
            <div className="ccc-preview-panel">
              {previewTiles.length === 0 ? (
                <div className="ccc-preview-empty">Cargá tarjetas en algún carrusel para ver la vista previa</div>
              ) : (
                <div style={{
                  marginTop: config.style.marginTop,
                  marginBottom: config.style.marginBottom,
                  marginLeft: config.style.marginLeft,
                  marginRight: config.style.marginRight,
                }}>
                  {previewCarousel.heading && (
                    <div className="ccc-preview-heading" style={{ textAlign: config.style.titleAlign, color: config.style.titleColor, fontFamily: config.style.titleFontFamily }}>
                      {previewCarousel.heading}
                    </div>
                  )}
                  <div className="ccc-preview-track" style={{ gap: config.style.gap, fontFamily: config.style.titleFontFamily }}>
                    {previewTiles.map((t, i) => (
                      <a key={i} className="ccc-preview-tile" style={{ flex: `0 0 calc(${tileWidthPct}% - ${config.style.gap * (config.style.desktopVisible - 1) / config.style.desktopVisible}px)` }}>
                        <img src={t.imageUrl} alt="" style={{ borderRadius: config.style.borderRadius }} />
                        <div className="ccc-preview-tile-title" style={{ color: config.style.titleColor, textAlign: config.style.titleAlign }}>{t.title}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="ccc-hint">
              <strong>Para activarlo:</strong> guardá los cambios. Se aplica arriba del listado de productos en las categorías que elegiste, reemplazando el banner nativo (que desactivás vos desde el panel de Tiendanube).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryCarouselConfig;
