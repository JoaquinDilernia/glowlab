import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, Power, Trash2, LayoutGrid } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import { getSlotLabel } from '../constants/nubeSlots';
import './StyleConfig.css';

const TYPE_LABELS = {
  grid: { label: 'Grid shoppable', icon: '🖼️' },
  shop_the_look: { label: 'Shop the Look', icon: '📍' },
  carousel: { label: 'Carousel', icon: '🎠' },
  combo: { label: 'Armá tu combo', icon: '🛍️' },
  quiz: { label: 'Quiz de estilo', icon: '❓' },
};

function StorefrontBlocksList() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/storefront-blocks?storeId=${storeId}`);
      if (data.success) setBlocks(data.blocks || []);
    } catch (error) {
      console.error('Error cargando bloques:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBlocks = async (nextBlocks) => {
    setBlocks(nextBlocks);
    try {
      const data = await apiRequest('/api/storefront-blocks', {
        method: 'POST',
        body: JSON.stringify({ storeId, blocks: nextBlocks }),
      });
      if (!data.success) throw new Error(data.message);
    } catch (error) {
      console.error('Error guardando bloques:', error);
      toast.info('Error al guardar');
      loadBlocks();
    }
  };

  const handleToggle = async (block) => {
    setSavingId(block.id);
    const next = blocks.map((b) => (b.id === block.id ? { ...b, enabled: !b.enabled } : b));
    await saveBlocks(next);
    setSavingId(null);
  };

  const handleDelete = async (block) => {
    if (!window.confirm(`¿Eliminar el bloque "${block.title || TYPE_LABELS[block.type]?.label}"? Esta acción no se puede deshacer.`)) return;
    setSavingId(block.id);
    const next = blocks.filter((b) => b.id !== block.id);
    await saveBlocks(next);
    setSavingId(null);
  };

  if (loading) {
    return (
      <div className="config-section">
        <p>Cargando bloques...</p>
      </div>
    );
  }

  return (
    <div className="config-section">
      <div className="section-header">
        <h2><LayoutGrid size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Vidriera Shoppable</h2>
        <button onClick={() => navigate('/storefront-blocks/new/config')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> Nuevo bloque
        </button>
      </div>
      <p style={{ color: '#6b7280', marginTop: -8, marginBottom: 20 }}>
        Bloques shoppable para el home de tu tienda — vos elegís dónde van, sin tocar código.
      </p>

      {blocks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: '#f9fafb', borderRadius: 12, border: '2px dashed #d1d5db' }}>
          <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 16 }}>Todavía no tenés bloques configurados.</p>
          <button onClick={() => navigate('/storefront-blocks/new/config')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <Plus size={16} /> Crear el primero
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {blocks.map((block) => {
            const typeInfo = TYPE_LABELS[block.type] || { label: block.type, icon: '📦' };
            return (
              <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
                <div style={{ fontSize: 28 }}>{typeInfo.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{block.title || typeInfo.label}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{typeInfo.label} · {getSlotLabel(block.slot)}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: block.enabled ? '#dcfce7' : '#f3f4f6', color: block.enabled ? '#166534' : '#6b7280' }}>
                  {block.enabled ? '● Activo' : '○ Inactivo'}
                </span>
                <button className="btn-icon" title="Editar" onClick={() => navigate(`/storefront-blocks/${block.id}/config`)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                  <Settings size={16} />
                </button>
                <button className="btn-icon" title={block.enabled ? 'Desactivar' : 'Activar'} onClick={() => handleToggle(block)} disabled={savingId === block.id} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                  <Power size={16} />
                </button>
                <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(block)} disabled={savingId === block.id} style={{ padding: 8, border: '1px solid #fecaca', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#dc2626' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StorefrontBlocksList;
