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
    </div>
  );
}
