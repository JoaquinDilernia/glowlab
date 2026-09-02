import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { useProductPicker } from '../hooks/useProductPicker';
import { useImageUpload } from '../hooks/useImageUpload';
import BlockPositionPicker from '../components/BlockPositionPicker';
import './StyleConfig.css';

const TYPE_OPTIONS = [
  { value: 'grid', label: '🖼️ Grid shoppable', available: true },
  { value: 'shop_the_look', label: '📍 Shop the Look', available: false },
  { value: 'carousel', label: '🎠 Carousel', available: false },
  { value: 'combo', label: '🛍️ Armá tu combo', available: false },
  { value: 'quiz', label: '❓ Quiz de estilo', available: true },
];

function defaultConfigForType(type) {
  if (type === 'quiz') return { questions: [], results: [] };
  return { columns: 3, items: [] };
}

function emptyBlock() {
  return {
    id: 'block_' + Date.now(),
    type: 'grid',
    enabled: true,
    slot: '',
    order: 0,
    title: '',
    subtitle: '',
    config: defaultConfigForType('grid'),
  };
}

function StorefrontBlockConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const { blockId } = useParams();
  const storeId = localStorage.getItem('promonube_store_id');
  const isNew = blockId === 'new';

  const [allBlocks, setAllBlocks] = useState([]);
  const [block, setBlock] = useState(emptyBlock());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null); // { kind: 'grid-item' | 'quiz-result', idx }

  const { query: pickerQuery, results: pickerResults, loading: pickerLoading, search: searchProducts, normalizeProduct } = useProductPicker(storeId);
  const { upload, uploading } = useImageUpload(storeId, 'storefront-blocks');

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/storefront-blocks?storeId=${storeId}`);
      const blocks = data.success ? (data.blocks || []) : [];
      setAllBlocks(blocks);
      if (!isNew) {
        const found = blocks.find((b) => b.id === blockId);
        if (found) setBlock({ config: { columns: 3, items: [] }, ...found });
      }
    } catch (error) {
      console.error('Error cargando bloque:', error);
    } finally {
      setLoading(false);
    }
  };

  const patch = (p) => setBlock((prev) => ({ ...prev, ...p }));
  const patchConfig = (p) => setBlock((prev) => ({ ...prev, config: { ...prev.config, ...p } }));

  const addItem = () => {
    const items = [...(block.config.items || []), { id: 'item_' + Date.now(), imageUrl: '', productId: '', productName: '', productImage: '', productPrice: '', productUrl: '' }];
    patchConfig({ items });
  };

  const removeItem = (idx) => {
    const items = (block.config.items || []).filter((_, i) => i !== idx);
    patchConfig({ items });
  };

  const updateItem = (idx, p) => {
    const items = (block.config.items || []).map((it, i) => (i === idx ? { ...it, ...p } : it));
    patchConfig({ items });
  };

  const handleUploadItemImage = async (idx, file) => {
    const url = await upload(file);
    if (url) updateItem(idx, { imageUrl: url });
  };

  const addQuestion = () => {
    const questions = [...(block.config.questions || []), { id: 'q_' + Date.now(), text: '', options: [] }];
    patchConfig({ questions });
  };

  const removeQuestion = (qIdx) => {
    const questions = (block.config.questions || []).filter((_, i) => i !== qIdx);
    patchConfig({ questions });
  };

  const updateQuestion = (qIdx, p) => {
    const questions = (block.config.questions || []).map((q, i) => (i === qIdx ? { ...q, ...p } : q));
    patchConfig({ questions });
  };

  const addOption = (qIdx) => {
    const questions = (block.config.questions || []).map((q, i) =>
      i === qIdx ? { ...q, options: [...(q.options || []), { id: 'opt_' + Date.now(), label: '', tag: '' }] } : q
    );
    patchConfig({ questions });
  };

  const removeOption = (qIdx, oIdx) => {
    const questions = (block.config.questions || []).map((q, i) =>
      i === qIdx ? { ...q, options: (q.options || []).filter((_, j) => j !== oIdx) } : q
    );
    patchConfig({ questions });
  };

  const updateOption = (qIdx, oIdx, p) => {
    const questions = (block.config.questions || []).map((q, i) =>
      i === qIdx ? { ...q, options: (q.options || []).map((o, j) => (j === oIdx ? { ...o, ...p } : o)) } : q
    );
    patchConfig({ questions });
  };

  const addResult = () => {
    const results = [...(block.config.results || []), { id: 'result_' + Date.now(), title: '', tags: [], products: [] }];
    patchConfig({ results });
  };

  const removeResult = (rIdx) => {
    const results = (block.config.results || []).filter((_, i) => i !== rIdx);
    patchConfig({ results });
  };

  const updateResult = (rIdx, p) => {
    const results = (block.config.results || []).map((r, i) => (i === rIdx ? { ...r, ...p } : r));
    patchConfig({ results });
  };

  const removeResultProduct = (rIdx, pIdx) => {
    const results = (block.config.results || []).map((r, i) =>
      i === rIdx ? { ...r, products: (r.products || []).filter((_, j) => j !== pIdx) } : r
    );
    patchConfig({ results });
  };

  const assignProduct = (product) => {
    if (!picker) return;
    const normalized = normalizeProduct(product);
    if (picker.kind === 'grid-item') {
      updateItem(picker.idx, normalized);
    } else if (picker.kind === 'quiz-result') {
      const results = block.config.results || [];
      const products = [...(results[picker.idx]?.products || []), normalized];
      updateResult(picker.idx, { products });
    }
    setPicker(null);
  };

  const handleSave = async () => {
    if (!block.slot) {
      toast.info('Elegí una posición para el bloque');
      return;
    }
    setSaving(true);
    try {
      const next = isNew
        ? [...allBlocks, block]
        : allBlocks.map((b) => (b.id === block.id ? block : b));
      const data = await apiRequest('/api/storefront-blocks', {
        method: 'POST',
        body: JSON.stringify({ storeId, blocks: next }),
      });
      if (!data.success) throw new Error(data.message);
      toast.info('Guardado ✓');
      navigate('/storefront-blocks');
    } catch (error) {
      console.error('Error guardando bloque:', error);
      toast.info('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="config-section"><p>Cargando...</p></div>;
  }

  const items = block.config.items || [];

  return (
    <div className="config-section">
      <div className="section-header">
        <button onClick={() => navigate('/storefront-blocks')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <h2 style={{ marginTop: 8 }}>{isNew ? 'Nuevo bloque' : 'Editar bloque'}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        {isNew && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Tipo de bloque</label>
            <select value={block.type} onChange={(e) => patch({ type: e.target.value, config: defaultConfigForType(e.target.value) })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value} disabled={!t.available}>
                  {t.label}{!t.available ? ' (próximamente)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <input type="checkbox" checked={!!block.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          Bloque activo
        </label>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Título (opcional)</label>
          <input type="text" value={block.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Ej: Lo más nuevo" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box' }} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Bajada (opcional)</label>
          <input type="text" value={block.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="Ej: Elegí tu estilo" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 15, boxSizing: 'border-box' }} />
        </div>

        <BlockPositionPicker value={block.slot} onChange={(slot) => patch({ slot })} />

        {block.type === 'grid' && (
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Columnas</label>
            <select value={block.config.columns || 3} onChange={(e) => patchConfig({ columns: Number(e.target.value) })} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 15 }}>
              <option value={3}>3 columnas</option>
              <option value={4}>4 columnas</option>
            </select>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  ) : (
                    <label style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6b7280', cursor: 'pointer', textAlign: 'center' }}>
                      {uploading ? '...' : 'Subir foto'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleUploadItemImage(idx, e.target.files[0])} />
                    </label>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {item.productName || <span style={{ color: '#ef4444' }}>Sin producto asignado</span>}
                    </div>
                    {item.productPrice && <div style={{ fontSize: 12, color: '#6b7280' }}>{item.productPrice}</div>}
                  </div>
                  <button type="button" onClick={() => setPicker({ kind: 'grid-item', idx })} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    {item.productId ? 'Cambiar' : 'Asignar'} producto
                  </button>
                  <button type="button" onClick={() => removeItem(idx)} style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem} style={{ padding: '10px 14px', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Agregar imagen
              </button>
            </div>
          </div>
        )}

        {block.type === 'quiz' && (
          <div>
            <label style={{ display: 'block', marginBottom: 10, fontWeight: 600, fontSize: 14 }}>Preguntas</label>
            {(block.config.questions || []).map((q, qIdx) => (
              <div key={q.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                    placeholder="Ej: ¿Qué estilo preferís?"
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => removeQuestion(qIdx)} style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 12 }}>
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={opt.id} style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => updateOption(qIdx, oIdx, { label: e.target.value })}
                        placeholder="Opción"
                        style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        value={opt.tag}
                        onChange={(e) => updateOption(qIdx, oIdx, { tag: e.target.value })}
                        placeholder="tag (ej: casual)"
                        style={{ width: 130, padding: 6, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => removeOption(qIdx, oIdx)} style={{ padding: 6, background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(qIdx)} style={{ alignSelf: 'flex-start', padding: '6px 10px', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    + Opción
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addQuestion} style={{ padding: '10px 14px', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Agregar pregunta
            </button>

            <label style={{ display: 'block', marginTop: 24, marginBottom: 10, fontWeight: 600, fontSize: 14 }}>
              Resultados <span style={{ fontWeight: 400, color: '#6b7280' }}>(el que más tags en común tenga con las respuestas, gana)</span>
            </label>
            {(block.config.results || []).map((r, rIdx) => (
              <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => updateResult(rIdx, { title: e.target.value })}
                    placeholder="Ej: Estilo Casual"
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => removeResult(rIdx)} style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#991b1b' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={(r.tags || []).join(', ')}
                  onChange={(e) => updateResult(rIdx, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  placeholder="Tags que matchean, separados por coma (ej: casual, urbano)"
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {(r.products || []).map((p, pIdx) => (
                    <div key={p.id || pIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f3f4f6', borderRadius: 8, fontSize: 12 }}>
                      {p.productImage && <img src={p.productImage} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />}
                      <span>{p.productName}</span>
                      <button type="button" onClick={() => removeResultProduct(rIdx, pIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 14, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPicker({ kind: 'quiz-result', idx: rIdx })} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  + Agregar producto
                </button>
              </div>
            ))}
            <button type="button" onClick={addResult} style={{ padding: '10px 14px', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Agregar resultado
            </button>
          </div>
        )}
      </div>

      {picker !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPicker(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, maxWidth: 540, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>Asignar producto</h3>
              <button type="button" onClick={() => setPicker(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
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
    </div>
  );
}

export default StorefrontBlockConfig;
