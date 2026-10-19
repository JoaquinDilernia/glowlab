import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';
import './CombosConfig.css';

// Piloto: mismas tiendas que Grupos de Variantes (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
const ALLOWED_STORE_IDS = ['2547699', '5320806', '6854698'];

const DEFAULT_CONFIG = {
  enabled: false,
  combinesWithCoupons: false,
  combos: [],
};

const newId = () => `cb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function ItemPicker({ storeId, groups, onAdd }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);

  const q = query.trim().toLowerCase();
  const matchingGroups = q.length < 2 ? [] : groups
    .filter(g => g.title.toLowerCase().includes(q) || g.groupKey.toLowerCase().includes(q))
    .slice(0, 8);

  const searchProducts = async () => {
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await apiRequest(`/api/combos/search-products?storeId=${storeId}&q=${encodeURIComponent(query.trim())}`);
      setProducts(res?.products || []);
    } finally {
      setSearching(false);
    }
  };

  const pick = (item) => { onAdd(item); setQuery(''); setProducts([]); };

  return (
    <div className="cb-picker">
      <div className="cb-picker-bar">
        <input
          type="text"
          className="vg-search"
          placeholder="Agregar: buscá un grupo de colores o un producto…"
          value={query}
          onChange={e => { setQuery(e.target.value); setProducts([]); }}
          onKeyDown={e => { if (e.key === 'Enter') searchProducts(); }}
        />
        <button className="btn-back" onClick={searchProducts} disabled={q.length < 2 || searching}>
          {searching ? 'Buscando…' : 'Buscar productos sueltos'}
        </button>
      </div>
      {(matchingGroups.length > 0 || products.length > 0) && (
        <div className="cb-picker-results">
          {matchingGroups.map(g => (
            <button key={g.groupKey} className="cb-picker-option"
              onClick={() => pick({ type: 'group', groupKey: g.groupKey, label: g.title, quantity: 1 })}>
              {g.image && <img src={g.image} alt="" />}
              <span>{g.title}</span>
              <span className="vg-tag vg-tag--new">Cualquier color · {g.count}</span>
            </button>
          ))}
          {products.map(p => (
            <button key={p.productId} className="cb-picker-option"
              onClick={() => pick({ type: 'product', productId: p.productId, label: p.name, quantity: 1 })}>
              {p.image && <img src={p.image} alt="" />}
              <span>{p.name}</span>
              <span className="vg-tag">Producto</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CombosConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  useEffect(() => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) navigate('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [groups, setGroups] = useState([]);

  const loadConfig = useCallback(async () => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) return;
    try {
      const res = await apiRequest(`/api/combos-config?storeId=${storeId}`);
      if (res?.success) {
        setConfig({ ...DEFAULT_CONFIG, ...res.config });
        setGroups(res.groups || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/combos-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) toast.success('Combos guardados');
      else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateCombo = (id, patch) => setConfig(c => ({
    ...c,
    combos: c.combos.map(cb => cb.id === id ? { ...cb, ...patch } : cb),
  }));

  const updateItem = (comboId, index, patch) => setConfig(c => ({
    ...c,
    combos: c.combos.map(cb => cb.id !== comboId ? cb : {
      ...cb,
      items: cb.items.map((it, i) => i === index ? { ...it, ...patch } : it),
    }),
  }));

  const removeItem = (comboId, index) => setConfig(c => ({
    ...c,
    combos: c.combos.map(cb => cb.id !== comboId ? cb : { ...cb, items: cb.items.filter((_, i) => i !== index) }),
  }));

  const addItem = (comboId, item) => setConfig(c => ({
    ...c,
    combos: c.combos.map(cb => cb.id !== comboId ? cb : { ...cb, items: [...cb.items, item] }),
  }));

  const addCombo = () => setConfig(c => ({
    ...c,
    combos: [...c.combos, { id: newId(), name: '', active: true, discountPercent: 10, items: [] }],
  }));

  const removeCombo = (id) => setConfig(c => ({ ...c, combos: c.combos.filter(cb => cb.id !== id) }));

  const groupImage = (groupKey) => groups.find(g => g.groupKey === groupKey)?.image;

  if (!ALLOWED_STORE_IDS.includes(String(storeId))) return null;

  if (loading) {
    return (
      <div className="page-container vg-page">
        <div className="vg-loading"><div className="vg-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  return (
    <div className="page-container vg-page">
      <div className="vg-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="vg-btn-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Package size={22} /></div>
        <div>
          <h1>Combos</h1>
          <p>Descuento automático cuando el carrito tiene el combo completo, en cualquier color.</p>
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
        <div className="vg-row">
          <label className="vg-check">
            <input type="checkbox" checked={!!config.combinesWithCoupons}
              onChange={e => setConfig(c => ({ ...c, combinesWithCoupons: e.target.checked }))} /> Combinar con cupones
          </label>
        </div>
        <p className="vg-hint">
          Los grupos de colores salen de Grupos de Variantes. En la ficha de cada producto del combo aparece
          una card para elegir colores y agregar todo al carrito. El descuento se aplica igual si los
          productos se agregan por separado.
        </p>
      </div>

      {config.combos.map(combo => {
        const units = combo.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
        return (
          <div key={combo.id} className={`config-section cb-combo ${combo.active === false ? 'vg-published-card--hidden' : ''}`}>
            <div className="cb-combo-head">
              <input type="text" className="cb-combo-name" placeholder="Nombre del combo (ej. Comedor Nova)"
                value={combo.name} onChange={e => updateCombo(combo.id, { name: e.target.value })} />
              <label className="cb-pct">
                <input type="number" min="1" max="99" value={combo.discountPercent}
                  onChange={e => updateCombo(combo.id, { discountPercent: Number(e.target.value) })} />
                <span>% off</span>
              </label>
              <label className="vg-check">
                <input type="checkbox" checked={combo.active !== false}
                  onChange={e => updateCombo(combo.id, { active: e.target.checked })} /> Activo
              </label>
              <button className="vg-btn-remove" onClick={() => removeCombo(combo.id)} title="Eliminar combo">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="cb-items">
              {combo.items.map((item, i) => (
                <div key={`${item.groupKey || item.productId}-${i}`} className="cb-item">
                  <input type="number" min="1" max="50" className="cb-qty" value={item.quantity}
                    onChange={e => updateItem(combo.id, i, { quantity: Number(e.target.value) })} />
                  {item.type === 'group' && groupImage(item.groupKey) && <img src={groupImage(item.groupKey)} alt="" />}
                  <input type="text" className="cb-item-label" value={item.label}
                    onChange={e => updateItem(combo.id, i, { label: e.target.value })} />
                  <span className="vg-tag">{item.type === 'group' ? 'Cualquier color' : 'Producto'}</span>
                  <button className="vg-chip-remove" onClick={() => removeItem(combo.id, i)}>×</button>
                </div>
              ))}
            </div>

            <ItemPicker storeId={storeId} groups={groups} onAdd={item => addItem(combo.id, item)} />

            {units < 2 && <p className="vg-hint">Sumá al menos 2 unidades para que sea un combo.</p>}
          </div>
        );
      })}

      <button className="btn-back cb-add" onClick={addCombo}><Plus size={16} /> Nuevo combo</button>
    </div>
  );
}
