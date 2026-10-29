import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Ruler } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';

// Piloto: solo Alto Rancho (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
const ALLOWED_STORE_IDS = ['2547699', '5320806', '6854698'];

const DEFAULT_CONFIG = {
  enabled: false,
  skuPrefixes: ['M', 'I'],
  title: 'Dimensiones',
};

export default function TechSheetConfig() {
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

  useEffect(() => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) return;
    apiRequest(`/api/tech-sheet-config?storeId=${storeId}`)
      .then(res => { if (res?.success && res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config }); })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [storeId]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/tech-sheet-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) {
        setConfig(c => ({ ...c, ...res.config }));
        toast.success('Configuración guardada');
      } else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [storeId, config, toast]);

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
        <div className="vg-hero-icon"><Ruler size={22} /></div>
        <div>
          <h1>Ficha técnica</h1>
          <p>Un desplegable arriba de la descripción del producto con la última foto cargada (la ficha técnica).</p>
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>General</h2>
          <label className="toggle-switch" title="Mostrar el desplegable en la tienda">
            <input type="checkbox" checked={config.enabled === true}
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="vg-row">
          <div className="vg-field">
            <label>Título del desplegable</label>
            <input type="text" maxLength={40} placeholder="Dimensiones"
              value={config.title}
              onChange={e => setConfig(c => ({ ...c, title: e.target.value }))} />
          </div>
          <div className="vg-field" title="Separados por coma. Ej: M, I">
            <label>Solo en SKU que empiezan con</label>
            {/* Se guarda tal cual se tipea (con comas); el backend lo limpia. */}
            <input type="text" placeholder="Ej: M, I"
              value={(config.skuPrefixes || []).join(',')}
              onChange={e => setConfig(c => ({ ...c, skuPrefixes: e.target.value ? e.target.value.split(',') : [] }))} />
          </div>
        </div>
        <p className="vg-hint">
          Se muestra la <b>última foto</b> de la galería de cada producto, así que la ficha técnica tiene que
          ser la última imagen cargada. Si un producto no tiene más de una foto, no se muestra el desplegable.
        </p>
      </div>
    </div>
  );
}
