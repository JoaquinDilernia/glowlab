import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import ShopTheLookEditor from './style/ShopTheLookEditor';
import { normalizeShopTheLook } from '../utils/styleShopTheLook';
import './StyleConfig.css';

// Shop the Look tiene pagina propia; se guarda dentro de la config de Style
// (shopTheLook), sin pisar el resto.
function ShopTheLookConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [config, setConfig] = useState(null);
  const [savedJson, setSavedJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveRef = useRef(null);

  useEffect(() => {
    if (!storeId) return;
    apiRequest(`/api/style-config?storeId=${storeId}`)
      .then(data => {
        const raw = data.success ? data.config?.shopTheLook : null;
        // Sin tocar nada, la config vieja queda como esta (se migra recien al guardar).
        setConfig(raw || normalizeShopTheLook(null));
        setSavedJson(JSON.stringify(raw || normalizeShopTheLook(null)));
        if (data.config?.updatedAt) setLastSaved(new Date(data.config.updatedAt));
      })
      .catch(() => { setConfig(normalizeShopTheLook(null)); });
  }, [storeId]);

  const dirty = config != null && JSON.stringify(config) !== savedJson;

  const handleSave = async () => {
    if (!storeId) { toast.error('No se encontró el ID de la tienda.'); return; }
    setLoading(true);
    try {
      const current = await apiRequest(`/api/style-config?storeId=${storeId}`);
      const fullConfig = (current.success && current.config) ? current.config : {};
      const next = normalizeShopTheLook(config);
      const data = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: { ...fullConfig, shopTheLook: next } }),
      });
      if (data.success) {
        toast.success('Guardado. Se ve en tu tienda en 1-2 minutos.');
        setConfig(next);
        setSavedJson(JSON.stringify(next));
        setLastSaved(new Date());
      } else {
        toast.error('Error al guardar: ' + (data.message || 'Error desconocido'));
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { saveRef.current = handleSave; });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirty) saveRef.current?.(); }
    };
    const onLeave = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onLeave); };
  }, [dirty]);

  return (
    <div className="style-config-page">
      <div className="style-config-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Shop the Look</h1>
            <span style={{ fontSize: 12, color: dirty ? '#f59e0b' : '#6b7280' }}>
              {dirty ? 'Cambios sin guardar · Ctrl+S' : lastSaved ? `Guardado ${lastSaved.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={loading || !dirty}>
          <Save size={15} />
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="style-config-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {config ? (
          <ShopTheLookEditor value={config} onChange={setConfig} notify={(m) => toast.error(m)} />
        ) : (
          <p className="vg-hint">Cargando…</p>
        )}
      </div>
    </div>
  );
}

export default ShopTheLookConfig;
