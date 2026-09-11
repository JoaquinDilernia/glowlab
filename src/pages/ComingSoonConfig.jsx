import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Rocket } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
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

      {/* Secciones "Productos y categorías" y "Estilo" se agregan en Tasks 10 y 11 */}
    </div>
  );
}
