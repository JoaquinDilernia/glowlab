import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Layers } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';

// Piloto: solo estas dos tiendas ven el modulo (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
// TODO: quitar este guard cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ['2547699', '6854698'];

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  swatchSize: 'md',
  groups: [],
  ungrouped: [],
  lastScanAt: null,
};

export default function VariantGroupsConfig() {
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

  const loadConfig = useCallback(async () => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) return;
    try {
      const res = await apiRequest(`/api/variant-groups-config?storeId=${storeId}`);
      if (res?.success && res.config) {
        setConfig({ ...DEFAULT_CONFIG, ...res.config });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/variant-groups-config', {
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

  const [scanning, setScanning] = useState(false);
  const [proposal, setProposal] = useState(null);
  // selección editable: qué incluir de cada bucket propuesto
  const [includedNewGroupProducts, setIncludedNewGroupProducts] = useState({}); // { [groupKey]: Set(productId) }
  const [includedAdditions, setIncludedAdditions] = useState({}); // { [groupKey]: Set(productId) }
  const [includedRemovals, setIncludedRemovals] = useState({}); // { [groupKey]: Set(productId) }
  const [groupTitleEdits, setGroupTitleEdits] = useState({}); // { [groupKey]: title }
  const [ungroupedAssignment, setUngroupedAssignment] = useState({}); // { [productId]: groupKey }

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await apiRequest('/api/variant-groups/scan', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      if (!res?.success) { toast.error(res?.message || 'Error al escanear'); return; }

      setProposal(res);
      setIncludedNewGroupProducts(
        Object.fromEntries(res.newGroups.map(g => [g.groupKey, new Set(g.products.map(p => String(p.productId)))]))
      );
      setIncludedAdditions(
        Object.fromEntries(res.groupsWithAdditions.map(g => [g.groupKey, new Set(g.newProducts.map(p => String(p.productId)))]))
      );
      setIncludedRemovals(
        Object.fromEntries(res.removedFromCatalog.map(g => [g.groupKey, new Set(g.products.map(p => String(p.productId)))]))
      );
      setGroupTitleEdits(Object.fromEntries(res.newGroups.map(g => [g.groupKey, g.title])));
      setUngroupedAssignment({});
      toast.success(`Escaneo listo: ${res.newGroups.length} grupos nuevos, ${res.groupsWithAdditions.length} con novedades`);
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleInSet = (setter, groupKey, productId) => setter(prev => {
    const next = { ...prev };
    const current = new Set(next[groupKey] || []);
    const id = String(productId);
    if (current.has(id)) current.delete(id); else current.add(id);
    next[groupKey] = current;
    return next;
  });

  const allGroupKeysForAssignment = () => {
    const fromNew = (proposal?.newGroups || []).map(g => g.groupKey);
    const fromPublished = (proposal?.publishedGroups || []).map(g => g.groupKey);
    return [...new Set([...fromNew, ...fromPublished])];
  };

  const publishProposal = async () => {
    if (!proposal) return;

    const byKey = new Map((proposal.publishedGroups || []).map(g => [g.groupKey, {
      ...g,
      products: [...g.products],
      excludedProductIds: [...(g.excludedProductIds || [])],
    }]));

    // productos que quedan solos tras el merge (no se descartan, van a "sin agrupar")
    const orphans = [];

    // grupos nuevos aprobados
    for (const g of proposal.newGroups) {
      const included = includedNewGroupProducts[g.groupKey] || new Set();
      const products = g.products.filter(p => included.has(String(p.productId)));
      if (products.length < 2) {
        if (products.length === 1) orphans.push(products[0]);
        continue; // sin suficientes productos, no se publica
      }
      byKey.set(g.groupKey, {
        groupKey: g.groupKey,
        title: groupTitleEdits[g.groupKey] || g.title,
        hidden: false,
        excludedProductIds: [],
        products,
      });
    }

    // adiciones a grupos ya publicados
    for (const g of proposal.groupsWithAdditions) {
      const existing = byKey.get(g.groupKey);
      if (!existing) continue;
      const included = includedAdditions[g.groupKey] || new Set();
      const toAdd = g.newProducts.filter(p => included.has(String(p.productId)));
      const notIncluded = g.newProducts.filter(p => !included.has(String(p.productId)));
      existing.products = [...existing.products, ...toAdd];
      existing.excludedProductIds = [
        ...existing.excludedProductIds,
        ...notIncluded.map(p => String(p.productId)),
      ];
    }

    // productos que ya no estan en el catalogo
    for (const g of proposal.removedFromCatalog) {
      const existing = byKey.get(g.groupKey);
      if (!existing) continue;
      const toRemove = includedRemovals[g.groupKey] || new Set();
      existing.products = existing.products.filter(p => !toRemove.has(String(p.productId)));
    }

    // sin agrupar asignados a mano a un grupo
    for (const [productId, targetKey] of Object.entries(ungroupedAssignment)) {
      if (!targetKey) continue;
      const target = byKey.get(targetKey);
      const source = proposal.ungrouped.find(p => String(p.productId) === productId);
      if (!target || !source) continue;
      if (target.products.some(p => String(p.productId) === productId)) continue;
      target.products.push({ productId: source.productId, sku: source.sku, name: source.name, image: source.image, url: source.url });
    }

    const finalGroups = [];
    for (const g of byKey.values()) {
      if (g.products.length >= 2) {
        finalGroups.push(g);
      } else if (g.products.length === 1) {
        orphans.push(g.products[0]);
      }
    }
    const assignedIds = new Set(Object.keys(ungroupedAssignment).filter(id => ungroupedAssignment[id]));
    const finalUngrouped = [
      ...proposal.ungrouped.filter(p => !assignedIds.has(String(p.productId))),
      ...orphans.map(p => ({ ...p, reason: 'single_product' })),
    ];

    try {
      const res = await apiRequest('/api/variant-groups/publish', {
        method: 'POST',
        body: JSON.stringify({ storeId, groups: finalGroups, ungrouped: finalUngrouped }),
      });
      if (res?.success) {
        toast.success('Grupos publicados');
        setProposal(null);
        loadConfig();
      } else {
        toast.error(res?.message || 'Error al publicar');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  };

  const [groupFilter, setGroupFilter] = useState('');
  const [editingGroupKey, setEditingGroupKey] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredGroups = config.groups.filter(g => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return true;
    return g.title.toLowerCase().includes(q) || g.groupKey.toLowerCase().includes(q) ||
      g.products.some(p => p.sku.toLowerCase().includes(q));
  });

  const persistGroups = async (nextGroups, nextUngrouped) => {
    try {
      const res = await apiRequest('/api/variant-groups/publish', {
        method: 'POST',
        body: JSON.stringify({ storeId, groups: nextGroups, ungrouped: nextUngrouped ?? config.ungrouped }),
      });
      if (res?.success) {
        setConfig(c => ({ ...c, groups: nextGroups, ungrouped: nextUngrouped ?? c.ungrouped }));
        toast.success('Grupo actualizado');
      } else {
        toast.error(res?.message || 'Error al guardar');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  };

  const toggleHidden = (groupKey) => {
    const next = config.groups.map(g => g.groupKey === groupKey ? { ...g, hidden: !g.hidden } : g);
    persistGroups(next);
  };

  const startEdit = (group) => { setEditingGroupKey(group.groupKey); setEditingTitle(group.title); };
  const cancelEdit = () => { setEditingGroupKey(null); setEditingTitle(''); };

  const saveTitle = (groupKey) => {
    const next = config.groups.map(g => g.groupKey === groupKey ? { ...g, title: editingTitle } : g);
    persistGroups(next);
    cancelEdit();
  };

  // Si sacar el producto deja el grupo con menos de 2 (ya no hay nada para
  // swatchear), el grupo se borra y el/los producto/s que quedaban sueltos
  // pasan a "sin agrupar" en vez de perderse silenciosamente.
  const removeProductFromGroup = (groupKey, productId) => {
    const orphans = [];
    const next = config.groups
      .map(g => {
        if (g.groupKey !== groupKey) return g;
        const remaining = g.products.filter(p => String(p.productId) !== String(productId));
        if (remaining.length < 2) orphans.push(...remaining);
        return {
          ...g,
          products: remaining,
          excludedProductIds: [...(g.excludedProductIds || []), String(productId)],
        };
      })
      .filter(g => g.products.length >= 2);
    const nextUngrouped = [
      ...config.ungrouped,
      ...orphans.map(p => ({ ...p, reason: 'single_product' })),
    ];
    persistGroups(next, nextUngrouped);
  };

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
        <button className="vg-btn-save" onClick={saveSettings} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Layers size={22} /></div>
        <div>
          <h1>Grupos de Variantes</h1>
          <p>Agrupa productos por color usando el SKU y mostrá swatches en la tienda.</p>
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
            <input type="checkbox" checked={config.showOnListing !== false}
              onChange={e => setConfig(c => ({ ...c, showOnListing: e.target.checked }))} /> Mostrar en listado
          </label>
          <label className="vg-check">
            <input type="checkbox" checked={config.showOnPDP !== false}
              onChange={e => setConfig(c => ({ ...c, showOnPDP: e.target.checked }))} /> Mostrar en ficha de producto
          </label>
          <div className="vg-field">
            <label>Tamaño de swatch</label>
            <select value={config.swatchSize} onChange={e => setConfig(c => ({ ...c, swatchSize: e.target.value }))}>
              <option value="sm">Chico</option>
              <option value="md">Mediano</option>
              <option value="lg">Grande</option>
            </select>
          </div>
        </div>
        <p className="vg-hint">
          {config.lastScanAt ? 'Último escaneo publicado.' : 'Todavía no escaneaste el catálogo.'}
        </p>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>Escanear y revisar</h2>
          <button className="vg-btn-save" onClick={runScan} disabled={scanning}>
            {scanning ? 'Leyendo catálogo…' : 'Escanear productos'}
          </button>
        </div>

        {!proposal && (
          <p className="vg-hint">Corré un escaneo para ver la propuesta de agrupado por SKU.</p>
        )}

        {proposal && (
          <div className="vg-review">
            {proposal.newGroups.map(g => (
              <div key={g.groupKey} className="vg-group-card">
                <div className="vg-group-card-head">
                  <input
                    type="text"
                    value={groupTitleEdits[g.groupKey] ?? g.title}
                    onChange={e => setGroupTitleEdits(prev => ({ ...prev, [g.groupKey]: e.target.value }))}
                  />
                  <span className="vg-tag vg-tag--new">Grupo nuevo · {g.groupKey}</span>
                </div>
                <div className="vg-prod-chips">
                  {g.products.map(p => {
                    const included = (includedNewGroupProducts[g.groupKey] || new Set()).has(String(p.productId));
                    return (
                      <label key={p.productId} className={`vg-chip ${included ? '' : 'vg-chip--off'}`}>
                        <input type="checkbox" checked={included}
                          onChange={() => toggleInSet(setIncludedNewGroupProducts, g.groupKey, p.productId)} />
                        {p.image && <img src={p.image} alt="" />}
                        <span>{p.name} · {p.sku}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {proposal.groupsWithAdditions.map(g => (
              <div key={g.groupKey} className="vg-group-card">
                <div className="vg-group-card-head">
                  <strong>{g.title}</strong>
                  <span className="vg-tag vg-tag--addition">Productos nuevos para este grupo · {g.groupKey}</span>
                </div>
                <div className="vg-prod-chips">
                  {g.existingProducts.map(p => (
                    <span key={p.productId} className="vg-chip vg-chip--static">
                      {p.image && <img src={p.image} alt="" />}
                      <span>{p.name} · {p.sku}</span>
                    </span>
                  ))}
                  {g.newProducts.map(p => {
                    const included = (includedAdditions[g.groupKey] || new Set()).has(String(p.productId));
                    return (
                      <label key={p.productId} className={`vg-chip vg-chip--highlight ${included ? '' : 'vg-chip--off'}`}>
                        <input type="checkbox" checked={included}
                          onChange={() => toggleInSet(setIncludedAdditions, g.groupKey, p.productId)} />
                        {p.image && <img src={p.image} alt="" />}
                        <span>{p.name} · {p.sku}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {proposal.removedFromCatalog.length > 0 && (
              <div className="vg-group-card vg-group-card--warn">
                <div className="vg-group-card-head"><strong>Ya no están en el catálogo</strong></div>
                {proposal.removedFromCatalog.map(g => (
                  <div key={g.groupKey} className="vg-prod-chips">
                    {g.products.map(p => {
                      const checked = (includedRemovals[g.groupKey] || new Set()).has(String(p.productId));
                      return (
                        <label key={p.productId} className="vg-chip vg-chip--danger">
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleInSet(setIncludedRemovals, g.groupKey, p.productId)} />
                          <span>{p.name} · {p.sku} — quitar del grupo "{g.title}"</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {proposal.ungrouped.length > 0 && (
              <div className="vg-group-card">
                <div className="vg-group-card-head"><strong>Sin agrupar</strong></div>
                <div className="vg-ungrouped-list">
                  {proposal.ungrouped.map(p => (
                    <div key={p.productId} className="vg-ungrouped-row">
                      {p.image && <img src={p.image} alt="" />}
                      <span className="vg-ungrouped-name">{p.name} · {p.sku || 'sin SKU'}</span>
                      <select
                        value={ungroupedAssignment[p.productId] || ''}
                        onChange={e => setUngroupedAssignment(prev => ({ ...prev, [p.productId]: e.target.value }))}
                      >
                        <option value="">Asignar a un grupo…</option>
                        {allGroupKeysForAssignment().map(key => (
                          <option key={key} value={key}>{key}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="vg-btn-save" onClick={publishProposal}>Publicar</button>
          </div>
        )}
      </div>

      <div className="config-section">
        <div className="section-header"><h2>Grupos publicados</h2></div>

        <input
          type="text"
          className="vg-search"
          placeholder="Buscar por título o SKU…"
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
        />

        {filteredGroups.length === 0 && (
          <p className="vg-hint">Todavía no hay grupos publicados.</p>
        )}

        <div className="vg-published-list">
          {filteredGroups.map(g => (
            <div key={g.groupKey} className={`vg-published-card ${g.hidden ? 'vg-published-card--hidden' : ''}`}>
              <div className="vg-published-head">
                {editingGroupKey === g.groupKey ? (
                  <>
                    <input type="text" value={editingTitle} onChange={e => setEditingTitle(e.target.value)} />
                    <button className="vg-btn-launch" onClick={() => saveTitle(g.groupKey)}>Guardar</button>
                    <button className="vg-btn-remove" onClick={cancelEdit}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <strong>{g.title}</strong>
                    <span className="vg-hint">{g.groupKey} · {g.products.length} productos</span>
                    <button className="btn-back" onClick={() => startEdit(g)}>Editar</button>
                    <button className="btn-back" onClick={() => toggleHidden(g.groupKey)}>
                      {g.hidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                  </>
                )}
              </div>
              <div className="vg-prod-chips">
                {g.products.map(p => (
                  <span key={p.productId} className="vg-chip">
                    {p.image && <img src={p.image} alt="" />}
                    <span>{p.name} · {p.sku}</span>
                    {editingGroupKey === g.groupKey && (
                      <button className="vg-chip-remove" onClick={() => removeProductFromGroup(g.groupKey, p.productId)}>×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
