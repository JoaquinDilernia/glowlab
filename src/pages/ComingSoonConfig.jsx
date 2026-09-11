import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Rocket, Plus, Trash2, Search } from 'lucide-react';
import { apiRequest } from '../config';
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

function ProductRow({ p, hideDate, onDate, onMsg, onLaunch, onRemove }) {
  return (
    <div className="cs-prod-row">
      {p.productImage && <img src={p.productImage} alt="" />}
      <div className="cs-prod-main">
        <div className="cs-prod-name">{p.productName}</div>
        <span className="cs-badge-status">{statusLabel(p)}</span>
        {p.lastError && <span className="cs-hint" style={{ color: '#c00' }}> · {p.lastError}</span>}
      </div>
      {!hideDate && (
        <input type="datetime-local" value={p.launchDate || ''} onChange={e => onDate(e.target.value)} disabled={p.status === 'launched'} />
      )}
      <input type="text" placeholder="Mensaje (opcional)" value={p.message || ''} onChange={e => onMsg(e.target.value)} style={{ maxWidth: 180 }} />
      {p.status === 'scheduled' && <button className="btn-back" onClick={onLaunch}>Lanzar ahora</button>}
      <button className="btn-back" onClick={onRemove} title="Quitar"><Trash2 size={14} /></button>
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
    return <div className="page-container cs-page"><p style={{ padding: 40 }}>Cargando…</p></div>;
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
              <button className="btn-back" onClick={() => removeCategory(k.categoryId)}><Trash2 size={14} /> Quitar categoría</button>
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

      {/* Sección "Estilo" se agrega en Task 11 */}
    </div>
  );
}
