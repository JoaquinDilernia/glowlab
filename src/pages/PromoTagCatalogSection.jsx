import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Save, X } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { useProductPicker } from '../hooks/useProductPicker';
import { buildCategoryTree, flattenTreeForSelect } from '../utils/categoryTree';

// Productos de la segunda etiqueta (ej. "Últimas unidades"): categorías
// completas (con sus subcategorías) y/o productos sueltos. Al guardar, el
// servidor arma la lista de productos con el catálogo actual.
export default function PromoTagCatalogSection({ storeId, config, onSaved }) {
  const toast = useToast();
  const picker = useProductPicker(storeId);
  const [catRows, setCatRows] = useState([]);
  const [catChoice, setCatChoice] = useState('');
  const [categories, setCategories] = useState(config.categories || []);
  const [products, setProducts] = useState(config.products || []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest(`/api/tiendanube/categories?storeId=${storeId}`)
      .then(res => {
        const flat = Array.isArray(res) ? res : (res?.categories || res?.data || []);
        setCatRows(flattenTreeForSelect(buildCategoryTree(flat)));
      })
      .catch(e => console.error(e));
  }, [storeId]);

  const addCategory = () => {
    const row = catRows.find(r => r.id === catChoice);
    if (!row) return;
    if (!categories.some(c => c.id === row.id)) {
      setCategories(cs => [...cs, { id: row.id, name: row.name }]);
      setDirty(true);
    }
    setCatChoice('');
  };

  const addProduct = (raw) => {
    const n = picker.normalizeProduct(raw);
    if (!products.some(p => p.id === n.productId)) {
      setProducts(ps => [...ps, { id: n.productId, name: n.productName, image: n.productImage }]);
      setDirty(true);
    }
    picker.reset();
  };

  const removeCategory = (id) => { setCategories(cs => cs.filter(c => c.id !== id)); setDirty(true); };
  const removeProduct = (id) => { setProducts(ps => ps.filter(p => p.id !== id)); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/promo-tag-catalog', {
        method: 'POST',
        body: JSON.stringify({ storeId, categories, products }),
      });
      if (!res?.success) throw new Error(res?.message || 'No pudimos guardar los productos.');
      onSaved(res.config);
      setDirty(false);
      toast.success(`${res.config.productCount} productos con etiqueta`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasSelection = categories.length > 0 || products.length > 0;

  return (
    <div className="config-section">
      <div className="section-header">
        <h2>Productos</h2>
        <button className="vg-btn-save" onClick={save} disabled={saving || (!dirty && !hasSelection)}>
          {dirty ? <Save size={16} /> : <RefreshCw size={16} />}
          {saving ? 'Buscando productos…' : dirty ? 'Guardar productos' : 'Actualizar productos'}
        </button>
      </div>

      {config.resolvedAt ? (
        <p className="vg-hint">
          <b>{config.productCount} productos</b> con etiqueta (actualizado el {new Date(config.resolvedAt).toLocaleString('es-AR')}).
          {dirty && ' Tenés cambios sin guardar.'}
        </p>
      ) : (
        <p className="vg-hint">Todavía no elegiste productos. Agregá una categoría o buscá productos.</p>
      )}

      <div className="pt-cat-block">
        <div className="vg-row">
          <div className="vg-field pt-cat-grow">
            <label>Categoría (incluye sus subcategorías)</label>
            <select value={catChoice} onChange={e => setCatChoice(e.target.value)}>
              <option value="">Elegí una categoría…</option>
              {catRows.map(r => (
                <option key={r.id} value={r.id}>{' '.repeat(r.depth * 3)}{r.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-back pt-cat-add" onClick={addCategory} disabled={!catChoice}>
            <Plus size={16} /> Agregar
          </button>
        </div>
        {categories.length > 0 && (
          <div className="pt-chips">
            {categories.map(c => (
              <span key={c.id} className="pt-chip">
                {c.name || `Categoría ${c.id}`}
                <button onClick={() => removeCategory(c.id)} aria-label={`Quitar ${c.name}`}><X size={13} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-cat-block">
        <div className="vg-field">
          <label>O productos sueltos</label>
          <input type="text" value={picker.query} placeholder="Buscar por nombre…"
            onChange={e => picker.search(e.target.value)} />
        </div>
        {picker.loading && <p className="vg-hint">Buscando…</p>}
        {picker.results.length > 0 && (
          <div className="pt-prod-list">
            {picker.results.map(r => {
              const n = picker.normalizeProduct(r);
              return (
                <button key={n.productId} className="pt-prod-row" onClick={() => addProduct(r)}>
                  {n.productImage && <img src={n.productImage} alt="" />}
                  <span className="pt-prod-name">{n.productName}</span>
                  <Plus size={16} />
                </button>
              );
            })}
          </div>
        )}
        {products.length > 0 && (
          <div className="pt-prod-list">
            {products.map(p => (
              <div key={p.id} className="pt-prod-row">
                {p.image && <img src={p.image} alt="" />}
                <span className="pt-prod-name">{p.name || `Producto ${p.id}`}</span>
                <button onClick={() => removeProduct(p.id)} aria-label={`Quitar ${p.name}`}><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="vg-hint">
        Si después sumás productos a una de estas categorías, la lista se actualiza sola cada unas horas,
        o al momento con "Actualizar productos".
      </p>
    </div>
  );
}
