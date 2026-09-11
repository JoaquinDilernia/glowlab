import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Rocket, Plus, Trash2, Search, Eye } from 'lucide-react';
import { apiRequest, API_CONFIG } from '../config';
import { useToast } from '../context/ToastContext';
import { useProductPicker } from '../hooks/useProductPicker';
import { buildCategoryTree, flattenTreeForSelect } from '../utils/categoryTree';
import './StyleConfig.css';
import './ComingSoonConfig.css';

const DEFAULT_STYLE = {
  badgeText: 'PRÓXIMAMENTE', badgeShape: 'ribbon', badgePosition: 'top-left',
  badgeBg: '#111111', badgeTextColor: '#ffffff', badgeFontFamily: 'inherit',
  badgeFontSize: 12, badgeUppercase: true,
  priceReplaceText: 'Disponible pronto', priceReplaceColor: '#111111',
  priceReplaceFontSize: 14, priceShowDate: true,
  countdownEnabled: true, countdownLayout: 'boxes',
  countdownUnits: ['days', 'hours', 'minutes', 'seconds'],
  countdownDigitsColor: '#111111', countdownLabelsColor: '#777777',
  countdownAccentColor: '#111111', countdownFontFamily: 'inherit',
  countdownSize: 'md', countdownHeading: 'Lanzamiento en',
  notifyEnabled: true, notifyHeading: '¿Querés que te avisemos?',
  notifyPlaceholder: 'Tu email', notifyButtonText: 'Avisarme',
  notifySuccessText: '¡Listo! Te avisamos cuando esté disponible.',
  notifyBg: '#f5f5f5', notifyTextColor: '#111111',
  notifyButtonBg: '#111111', notifyButtonTextColor: '#ffffff',
};
const DEFAULT_CONFIG = { enabled: false, style: DEFAULT_STYLE, categories: [], products: [] };

function statusLabel(p) {
  if (p.status === 'launched') return 'Lanzado';
  if (p.launchDate && new Date(p.launchDate).getTime() <= Date.now()) return 'En vivo';
  return 'Programado';
}

function statusModifier(p) {
  if (p.status === 'launched') return 'launched';
  if (p.launchDate && new Date(p.launchDate).getTime() <= Date.now()) return 'live';
  return 'scheduled';
}

function ProductRow({ p, hideDate, onDate, onMsg, onLaunch, onRemove }) {
  return (
    <div className="cs-prod-row">
      {p.productImage && <img src={p.productImage} alt="" />}
      <div className="cs-prod-main">
        <div className="cs-prod-name">{p.productName}</div>
        <span className={`cs-badge-status cs-badge-status--${statusModifier(p)}`}>{statusLabel(p)}</span>
        {p.lastError && <span className="cs-hint" style={{ color: '#f87171' }}> · {p.lastError}</span>}
      </div>
      {!hideDate && (
        <input type="datetime-local" value={p.launchDate || ''} onChange={e => onDate(e.target.value)} disabled={p.status === 'launched'} />
      )}
      <input type="text" placeholder="Mensaje (opcional)" value={p.message || ''} onChange={e => onMsg(e.target.value)} style={{ maxWidth: 180 }} />
      {p.status === 'scheduled' && <button className="cs-btn-launch" onClick={onLaunch}><Rocket size={13} /> Lanzar ahora</button>}
      <button className="cs-btn-remove" onClick={onRemove} title="Quitar"><Trash2 size={14} /></button>
    </div>
  );
}

const UNIT_LABELS = { days: 'días', hours: 'hs', minutes: 'min', seconds: 'seg' };
const UNIT_SAMPLE = { days: '03', hours: '12', minutes: '45', seconds: '09' };
const BADGE_RADIUS = { ribbon: '4px', pill: '999px', corner: '0', tag: '4px' };

function Preview({ style: s }) {
  const badgePos = {
    'top-left': { top: 8, left: 8 }, 'top-right': { top: 8, right: 8 },
    'bottom-left': { bottom: 8, left: 8 }, 'bottom-right': { bottom: 8, right: 8 },
  }[s.badgePosition] || { top: 8, left: 8 };

  return (
    <div className="cs-preview">
      <div style={{ position: 'relative', background: '#f0f0f0', borderRadius: 10, height: 160, marginBottom: 12 }}>
        <div
          className="cs-preview-badge"
          style={{
            position: 'absolute', ...badgePos,
            background: s.badgeBg, color: s.badgeTextColor,
            fontFamily: s.badgeFontFamily, fontSize: s.badgeFontSize,
            borderRadius: BADGE_RADIUS[s.badgeShape] || '4px',
            textTransform: s.badgeUppercase ? 'uppercase' : 'none',
          }}
        >
          {s.badgeText}
        </div>
      </div>

      <div style={{ color: s.priceReplaceColor, fontSize: s.priceReplaceFontSize, fontWeight: 600, marginBottom: 10 }}>
        {s.priceReplaceText}{s.priceShowDate ? ' · 15/03' : ''}
      </div>

      {s.countdownEnabled && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: s.countdownLabelsColor, marginBottom: 6, fontFamily: s.countdownFontFamily }}>{s.countdownHeading}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {s.countdownUnits.map(u => (
              <div key={u} style={s.countdownLayout === 'boxes' ? { border: `1px solid ${s.countdownAccentColor}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 46 } : { textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: s.countdownDigitsColor, fontSize: s.countdownSize === 'sm' ? 11 : s.countdownSize === 'lg' ? 18 : 14 }}>{UNIT_SAMPLE[u]}</div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: s.countdownLabelsColor }}>{UNIT_LABELS[u]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.notifyEnabled && (
        <div style={{ padding: 14, borderRadius: 10, background: s.notifyBg, color: s.notifyTextColor }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'inherit' }}>{s.notifyHeading}</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" readOnly placeholder={s.notifyPlaceholder} style={{ flex: 1, padding: '9px 12px', border: '1px solid rgba(0,0,0,.15)', borderRadius: 8, fontSize: 14 }} />
            <button type="button" disabled style={{ padding: '9px 16px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, background: s.notifyButtonBg, color: s.notifyButtonTextColor }}>
              {s.notifyButtonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComingSoonConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/coming-soon-config?storeId=${storeId}`);
        if (res?.success && res.config) {
          setConfig({ ...DEFAULT_CONFIG, ...res.config, style: { ...DEFAULT_STYLE, ...(res.config.style || {}) } });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picker = useProductPicker(storeId);
  const [catRows, setCatRows] = useState([]);       // flattenTreeForSelect
  const [catChoice, setCatChoice] = useState('');
  const [catDate, setCatDate] = useState('');
  const [catMsg, setCatMsg] = useState('');
  const [catBusy, setCatBusy] = useState(false);

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

  const existingIds = () => new Set(config.products.map(p => String(p.productId)));

  const addManualProduct = (raw) => {
    const n = picker.normalizeProduct(raw);
    if (existingIds().has(String(n.productId))) { toast.error('Ese producto ya está en la lista'); return; }
    setConfig(c => ({
      ...c,
      products: [...c.products, {
        productId: n.productId, productName: n.productName, productImage: n.productImage,
        launchDate: '', message: '', source: 'manual', sourceCategoryId: null,
        status: 'scheduled', stockSnapshot: [], pausedAt: null, launchedAt: null, lastError: null,
      }],
    }));
    picker.reset();
  };

  const setProduct = (productId, patch) => setConfig(c => ({
    ...c,
    products: c.products.map(p => String(p.productId) === String(productId) ? { ...p, ...patch } : p),
  }));

  const removeProduct = (productId) => setConfig(c => ({
    ...c,
    products: c.products.filter(p => String(p.productId) !== String(productId)),
  }));

  const addCategory = async () => {
    if (!catChoice) { toast.error('Elegí una categoría'); return; }
    if (!catDate || new Date(catDate).getTime() <= Date.now()) { toast.error('Poné una fecha de lanzamiento futura'); return; }
    setCatBusy(true);
    try {
      const res = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${catChoice}`);
      const prods = Array.isArray(res) ? res : (res.products || res.data || []);
      const already = existingIds();
      const chosen = catRows.find(r => String(r.id) === String(catChoice));
      const newItems = prods
        .filter(p => !already.has(String(p.id)))
        .map(p => ({
          productId: String(p.id),
          productName: typeof p.name === 'object' ? (p.name.es || Object.values(p.name)[0]) : p.name,
          productImage: (p.images && p.images[0] && (p.images[0].src || p.images[0])) || '',
          launchDate: catDate, message: catMsg,
          source: 'category', sourceCategoryId: String(catChoice),
          status: 'scheduled', stockSnapshot: [], pausedAt: null, launchedAt: null, lastError: null,
        }));
      if (!newItems.length) { toast.error('No hay productos nuevos para agregar en esa categoría'); setCatBusy(false); return; }
      setConfig(c => ({
        ...c,
        products: [...c.products, ...newItems],
        categories: [
          ...c.categories.filter(k => String(k.categoryId) !== String(catChoice)),
          { categoryId: String(catChoice), categoryName: chosen ? chosen.name : '', launchDate: catDate, message: catMsg, addedAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() },
        ],
      }));
      toast.success(`${newItems.length} productos agregados`);
      setCatChoice(''); setCatDate(''); setCatMsg('');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setCatBusy(false);
    }
  };

  const refreshCategory = async (categoryId) => {
    const cat = config.categories.find(k => String(k.categoryId) === String(categoryId));
    if (!cat) return;
    try {
      const res = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${categoryId}`);
      const prods = Array.isArray(res) ? res : (res.products || res.data || []);
      const already = existingIds();
      const newItems = prods.filter(p => !already.has(String(p.id))).map(p => ({
        productId: String(p.id),
        productName: typeof p.name === 'object' ? (p.name.es || Object.values(p.name)[0]) : p.name,
        productImage: (p.images && p.images[0] && (p.images[0].src || p.images[0])) || '',
        launchDate: cat.launchDate, message: cat.message || '',
        source: 'category', sourceCategoryId: String(categoryId),
        status: 'scheduled', stockSnapshot: [], pausedAt: null, launchedAt: null, lastError: null,
      }));
      setConfig(c => ({
        ...c,
        products: [...c.products, ...newItems],
        categories: c.categories.map(k => String(k.categoryId) === String(categoryId) ? { ...k, lastSyncedAt: new Date().toISOString() } : k),
      }));
      toast.success(newItems.length ? `${newItems.length} productos nuevos` : 'La categoría ya está al día');
    } catch (e) { toast.error('Error: ' + e.message); }
  };

  const setCategoryDate = (categoryId, newDate) => setConfig(c => ({
    ...c,
    categories: c.categories.map(k => String(k.categoryId) === String(categoryId) ? { ...k, launchDate: newDate } : k),
    products: c.products.map(p =>
      p.source === 'category' && String(p.sourceCategoryId) === String(categoryId) && p.status !== 'launched'
        ? { ...p, launchDate: newDate } : p),
  }));

  const removeCategory = (categoryId) => setConfig(c => ({
    ...c,
    categories: c.categories.filter(k => String(k.categoryId) !== String(categoryId)),
    products: c.products.filter(p => !(p.source === 'category' && String(p.sourceCategoryId) === String(categoryId))),
  }));

  const launchNow = async (productId) => {
    try {
      const res = await apiRequest('/api/coming-soon/launch', {
        method: 'POST', body: JSON.stringify({ storeId, productId }),
      });
      if (res?.success && res.config) {
        setConfig({ ...DEFAULT_CONFIG, ...res.config, style: { ...DEFAULT_STYLE, ...(res.config.style || {}) } });
        toast.success('Producto lanzado');
      } else toast.error(res?.message || 'Error');
    } catch (e) { toast.error('Error: ' + e.message); }
  };

  const setStyle = (k, v) => setConfig(c => ({ ...c, style: { ...c.style, [k]: v } }));

  const toggleUnit = (u) => setConfig(c => {
    const has = c.style.countdownUnits.includes(u);
    const order = ['days', 'hours', 'minutes', 'seconds'];
    const next = order.filter(x => x === u ? !has : c.style.countdownUnits.includes(x));
    return { ...c, style: { ...c.style, countdownUnits: next } };
  });

  const save = useCallback(async () => {
    const now = Date.now();
    for (const p of config.products) {
      if (p.status === 'launched') continue;
      if (!p.launchDate) { toast.error(`"${p.productName || p.productId}" no tiene fecha de lanzamiento`); return; }
      if (new Date(p.launchDate).getTime() <= now) { toast.error(`"${p.productName || p.productId}": la fecha ya pasó`); return; }
    }
    setSaving(true);
    try {
      const res = await apiRequest('/api/coming-soon-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) {
        toast.success('Configuración guardada');
        if (res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config, style: { ...DEFAULT_STYLE, ...(res.config.style || {}) } });
      } else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [storeId, config, toast]);

  if (loading) {
    return (
      <div className="page-container cs-page">
        <div className="cs-loading"><div className="cs-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  return (
    <div className="page-container cs-page">
      <div className="cs-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="cs-btn-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="cs-hero">
        <div className="cs-hero-icon"><Rocket size={22} /></div>
        <div>
          <h1>Próximamente</h1>
          <p>Mostrá productos como prelanzamiento: badge, sin precio, sin compra y con cuenta regresiva.</p>
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>General</h2>
          <label className="toggle-switch">
            <input type="checkbox" checked={!!config.enabled}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <p className="cs-hint">
          Al guardar, los productos marcados quedan sin stock en Tiendanube hasta su fecha de lanzamiento.
          En la fecha, vuelven solos a la normalidad.
        </p>
      </div>

      <div className="config-section">
        <div className="section-header"><h2>Productos y categorías</h2></div>

        <div className="cs-field">
          <label><Search size={13} /> Buscar producto</label>
          <input type="text" value={picker.query} placeholder="Nombre del producto…"
            onChange={e => picker.search(e.target.value)} />
          {picker.loading && <p className="cs-hint">Buscando…</p>}
          {picker.results.length > 0 && (
            <div className="cs-prod-list">
              {picker.results.map(r => {
                const n = picker.normalizeProduct(r);
                return (
                  <button key={n.productId} className="cs-prod-row" style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => addManualProduct(r)}>
                    {n.productImage && <img src={n.productImage} alt="" />}
                    <div className="cs-prod-main"><div className="cs-prod-name">{n.productName}</div><span className="cs-hint">{n.productPrice}</span></div>
                    <Plus size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="cs-field">
          <label>O agregar una categoría completa</label>
          <div className="cs-row">
            <select value={catChoice} onChange={e => setCatChoice(e.target.value)}>
              <option value="">Elegí una categoría…</option>
              {catRows.map(r => (
                <option key={r.id} value={r.id}>{' '.repeat(r.depth * 3)}{r.name}</option>
              ))}
            </select>
            <input type="datetime-local" value={catDate} onChange={e => setCatDate(e.target.value)} />
            <input type="text" placeholder="Mensaje (opcional)" value={catMsg} onChange={e => setCatMsg(e.target.value)} />
            <button className="cs-btn-save" disabled={catBusy} onClick={addCategory}>
              {catBusy ? 'Agregando…' : 'Agregar categoría'}
            </button>
          </div>
          <p className="cs-hint">Se marcan los productos actuales de la categoría. Si agregás más productos a la categoría después, usá "Actualizar productos".</p>
        </div>

        {/* productos sueltos */}
        {config.products.filter(p => p.source === 'manual').length > 0 && (
          <div className="cs-prod-list">
            {config.products.filter(p => p.source === 'manual').map(p => (
              <ProductRow key={p.productId} p={p} onDate={d => setProduct(p.productId, { launchDate: d })}
                onMsg={m => setProduct(p.productId, { message: m })}
                onLaunch={() => launchNow(p.productId)} onRemove={() => removeProduct(p.productId)} />
            ))}
          </div>
        )}

        {/* grupos por categoría */}
        {config.categories.map(k => (
          <div key={k.categoryId} className="cs-cat-group">
            <div className="cs-cat-head">
              <strong>{k.categoryName || `Categoría ${k.categoryId}`}</strong>
              <input type="datetime-local" value={k.launchDate || ''} onChange={e => setCategoryDate(k.categoryId, e.target.value)} />
              <button className="btn-back" onClick={() => refreshCategory(k.categoryId)}>Actualizar productos</button>
              <button className="cs-btn-remove" onClick={() => removeCategory(k.categoryId)}><Trash2 size={14} /> Quitar categoría</button>
            </div>
            <div className="cs-prod-list" style={{ padding: 10 }}>
              {config.products.filter(p => p.source === 'category' && String(p.sourceCategoryId) === String(k.categoryId)).map(p => (
                <ProductRow key={p.productId} p={p} hideDate
                  onDate={d => setProduct(p.productId, { launchDate: d })}
                  onMsg={m => setProduct(p.productId, { message: m })}
                  onLaunch={() => launchNow(p.productId)} onRemove={() => removeProduct(p.productId)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="cs-style-grid">
        <div>
          <div className="config-section">
            <div className="section-header"><h2>Estilo — Badge</h2></div>
            <div className="cs-row">
              <div className="cs-field">
                <label>Texto</label>
                <input type="text" value={config.style.badgeText} onChange={e => setStyle('badgeText', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Forma</label>
                <select value={config.style.badgeShape} onChange={e => setStyle('badgeShape', e.target.value)}>
                  <option value="ribbon">Cinta</option>
                  <option value="pill">Píldora</option>
                  <option value="corner">Esquina</option>
                  <option value="tag">Etiqueta</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Posición</label>
                <select value={config.style.badgePosition} onChange={e => setStyle('badgePosition', e.target.value)}>
                  <option value="top-left">Arriba izquierda</option>
                  <option value="top-right">Arriba derecha</option>
                  <option value="bottom-left">Abajo izquierda</option>
                  <option value="bottom-right">Abajo derecha</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Color de fondo</label>
                <input type="color" value={config.style.badgeBg} onChange={e => setStyle('badgeBg', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Color de texto</label>
                <input type="color" value={config.style.badgeTextColor} onChange={e => setStyle('badgeTextColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Tipografía</label>
                <select value={config.style.badgeFontFamily} onChange={e => setStyle('badgeFontFamily', e.target.value)}>
                  <option value="inherit">Predeterminada</option>
                  <option value="Poppins, sans-serif">Poppins</option>
                  <option value="Montserrat, sans-serif">Montserrat</option>
                  <option value="system-ui">System UI</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Tamaño</label>
                <input type="number" min={8} max={24} value={config.style.badgeFontSize} onChange={e => setStyle('badgeFontSize', Number(e.target.value))} />
              </div>
              <div className="cs-field">
                <label>
                  <input type="checkbox" checked={config.style.badgeUppercase} onChange={e => setStyle('badgeUppercase', e.target.checked)} /> Mayúsculas
                </label>
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="section-header"><h2>Estilo — Precio oculto</h2></div>
            <div className="cs-row">
              <div className="cs-field">
                <label>Texto de reemplazo</label>
                <input type="text" value={config.style.priceReplaceText} onChange={e => setStyle('priceReplaceText', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Color</label>
                <input type="color" value={config.style.priceReplaceColor} onChange={e => setStyle('priceReplaceColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Tamaño</label>
                <input type="number" min={10} max={28} value={config.style.priceReplaceFontSize} onChange={e => setStyle('priceReplaceFontSize', Number(e.target.value))} />
              </div>
              <div className="cs-field">
                <label>
                  <input type="checkbox" checked={config.style.priceShowDate} onChange={e => setStyle('priceShowDate', e.target.checked)} /> Mostrar fecha
                </label>
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="section-header"><h2>Estilo — Countdown</h2></div>
            <div className="cs-row">
              <div className="cs-field">
                <label>
                  <input type="checkbox" checked={config.style.countdownEnabled} onChange={e => setStyle('countdownEnabled', e.target.checked)} /> Activo
                </label>
              </div>
              <div className="cs-field">
                <label>Encabezado</label>
                <input type="text" value={config.style.countdownHeading} onChange={e => setStyle('countdownHeading', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Layout</label>
                <select value={config.style.countdownLayout} onChange={e => setStyle('countdownLayout', e.target.value)}>
                  <option value="boxes">Cajas</option>
                  <option value="inline">En línea</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Tamaño</label>
                <select value={config.style.countdownSize} onChange={e => setStyle('countdownSize', e.target.value)}>
                  <option value="sm">Chico</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Tipografía</label>
                <select value={config.style.countdownFontFamily} onChange={e => setStyle('countdownFontFamily', e.target.value)}>
                  <option value="inherit">Predeterminada</option>
                  <option value="Poppins, sans-serif">Poppins</option>
                  <option value="Montserrat, sans-serif">Montserrat</option>
                  <option value="system-ui">System UI</option>
                </select>
              </div>
              <div className="cs-field">
                <label>Color de números</label>
                <input type="color" value={config.style.countdownDigitsColor} onChange={e => setStyle('countdownDigitsColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Color de etiquetas</label>
                <input type="color" value={config.style.countdownLabelsColor} onChange={e => setStyle('countdownLabelsColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Color de acento</label>
                <input type="color" value={config.style.countdownAccentColor} onChange={e => setStyle('countdownAccentColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Unidades</label>
                <div className="cs-row">
                  {['days', 'hours', 'minutes', 'seconds'].map(u => (
                    <label key={u} style={{ fontWeight: 400 }}>
                      <input type="checkbox" checked={config.style.countdownUnits.includes(u)} onChange={() => toggleUnit(u)} /> {UNIT_LABELS[u]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="section-header"><h2>Estilo — Avisame</h2></div>
            <div className="cs-row">
              <div className="cs-field">
                <label>
                  <input type="checkbox" checked={config.style.notifyEnabled} onChange={e => setStyle('notifyEnabled', e.target.checked)} /> Activo
                </label>
              </div>
              <div className="cs-field">
                <label>Encabezado</label>
                <input type="text" value={config.style.notifyHeading} onChange={e => setStyle('notifyHeading', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Placeholder</label>
                <input type="text" value={config.style.notifyPlaceholder} onChange={e => setStyle('notifyPlaceholder', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Texto del botón</label>
                <input type="text" value={config.style.notifyButtonText} onChange={e => setStyle('notifyButtonText', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Texto de éxito</label>
                <input type="text" value={config.style.notifySuccessText} onChange={e => setStyle('notifySuccessText', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Fondo</label>
                <input type="color" value={config.style.notifyBg} onChange={e => setStyle('notifyBg', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Color de texto</label>
                <input type="color" value={config.style.notifyTextColor} onChange={e => setStyle('notifyTextColor', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Fondo del botón</label>
                <input type="color" value={config.style.notifyButtonBg} onChange={e => setStyle('notifyButtonBg', e.target.value)} />
              </div>
              <div className="cs-field">
                <label>Texto del botón</label>
                <input type="color" value={config.style.notifyButtonTextColor} onChange={e => setStyle('notifyButtonTextColor', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="cs-preview-col">
          <div className="cs-preview-label"><Eye size={14} /> Vista previa en tienda</div>
          <Preview style={config.style} />
        </div>
      </div>

      <div className="config-section">
        <div className="section-header"><h2>Interesados ("Avisame")</h2></div>
        <p className="cs-hint">
          {config.products.length === 0
            ? 'Todavía no hay productos en prelanzamiento.'
            : 'Descargá la lista de emails que pidieron aviso de lanzamiento.'}
        </p>
        <a className="cs-btn-save" style={{ textDecoration: 'none', display: 'inline-flex' }}
           href={`${API_CONFIG.BASE_URL}/api/coming-soon/leads.csv?storeId=${storeId}`}>
          Descargar CSV
        </a>
      </div>
    </div>
  );
}
