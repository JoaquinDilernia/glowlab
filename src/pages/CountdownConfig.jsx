import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Timer, Monitor, Smartphone } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import CountdownBarPreview from '../components/CountdownBarPreview';
import { useNow, formatDate, formatDuration, loadFont, effectiveSizes, MOBILE_SCALE } from '../utils/countdown';
import './StyleConfig.css';
import './VariantGroupsConfig.css';
import './CountdownConfig.css';

// Mismos defaults que DEFAULTS en functions/countdown.js.
const DEFAULTS = {
  name: '',
  enabled: true,
  startDate: null,
  endDate: null,
  message: 'Últimas horas de la promo',
  buttonText: '',
  buttonUrl: '',
  placement: 'header',
  timerStyle: 'boxes',
  size: 'md',
  messageSize: null,
  digitSize: null,
  font: 'inherit',
  backgroundColor: '#353434',
  textColor: '#ffffff',
  timerColor: '#ffffff',
  boxColor: '#ffffff',
  buttonColor: '#ffffff',
  buttonTextColor: '#353434',
  showLabels: true,
  showCloseButton: true,
  sticky: true,
  hideButtonOnMobile: false,
  pages: 'all',
};

const FONTS = ['inherit', 'Poppins', 'Montserrat', 'Inter', 'Oswald', 'Bebas Neue', 'Playfair Display'];

// Paletas rapidas. Las primeras salen de la marca de Alto Rancho (grafito #353434,
// celeste de la barra de cuotas #8aa1c4, rojo de Hot Days #a00200).
const PRESETS = [
  { name: 'Grafito', backgroundColor: '#353434', textColor: '#ffffff', timerColor: '#ffffff', boxColor: '#ffffff', buttonColor: '#ffffff', buttonTextColor: '#353434' },
  { name: 'Rojo promo', backgroundColor: '#a00200', textColor: '#ffffff', timerColor: '#ffffff', boxColor: '#ffffff', buttonColor: '#ffffff', buttonTextColor: '#a00200' },
  { name: 'Celeste', backgroundColor: '#8aa1c4', textColor: '#ffffff', timerColor: '#ffffff', boxColor: '#ffffff', buttonColor: '#353434', buttonTextColor: '#ffffff' },
  { name: 'Claro', backgroundColor: '#f4f1ec', textColor: '#353434', timerColor: '#353434', boxColor: '#353434', buttonColor: '#353434', buttonTextColor: '#ffffff' },
  { name: 'Negro y dorado', backgroundColor: '#111111', textColor: '#ffffff', timerColor: '#e9c46a', boxColor: '#e9c46a', buttonColor: '#e9c46a', buttonTextColor: '#111111' },
];

const COLOR_FIELDS = [
  ['backgroundColor', 'Fondo'],
  ['textColor', 'Texto'],
  ['timerColor', 'Números'],
  ['boxColor', 'Cajitas'],
  ['buttonColor', 'Botón'],
  ['buttonTextColor', 'Texto del botón'],
];

// ISO <-> valor de <input type="datetime-local"> (hora local del navegador).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

function endOfDay(addDays) {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  d.setHours(23, 59, 0, 0);
  return d;
}

const QUICK_ENDS = [
  { label: 'Hoy 23:59', get: () => endOfDay(0) },
  { label: 'Mañana 23:59', get: () => endOfDay(1) },
  { label: 'En 48 h', get: () => new Date(Date.now() + 48 * 3600000) },
  { label: 'Domingo 23:59', get: () => endOfDay((7 - new Date().getDay()) % 7) },
  { label: 'En 7 días', get: () => endOfDay(7) },
];

function statusLine(c, now) {
  const end = Date.parse(c.endDate);
  const start = Date.parse(c.startDate);
  if (!Number.isFinite(end)) return { tone: 'warn', text: 'Elegí cuándo termina.' };
  if (Number.isFinite(start) && start >= end) return { tone: 'warn', text: 'El inicio tiene que ser antes del fin.' };
  if (end <= now) return { tone: 'warn', text: 'La fecha de fin ya pasó: no se va a mostrar.' };
  if (!c.enabled) return { tone: 'muted', text: 'Pausada: no se muestra en la tienda.' };
  if (Number.isFinite(start) && start > now) return { tone: 'info', text: `Programada: aparece el ${formatDate(c.startDate)} (en ${formatDuration(start - now)}).` };
  return { tone: 'ok', text: `En vivo: termina el ${formatDate(c.endDate)} (en ${formatDuration(end - now)}).` };
}

function CountdownConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const { countdownId } = useParams();
  const storeId = localStorage.getItem('promonube_store_id');
  const storeName = localStorage.getItem('promonube_store_name') || 'Tu tienda';
  const isEdit = !!countdownId;
  const now = useNow();

  const [config, setConfig] = useState(() => ({ ...DEFAULTS, endDate: endOfDay(1).toISOString() }));
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [scheduleStart, setScheduleStart] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const data = await apiRequest(`/api/countdown/${countdownId}?storeId=${storeId}`);
        if (data.success && data.countdown) {
          setConfig({ ...DEFAULTS, ...data.countdown });
          setScheduleStart(!!data.countdown.startDate);
        }
      } catch (e) {
        toast.error(e.message || 'No se pudo cargar la cuenta regresiva');
      } finally {
        setLoading(false);
      }
    })();
  }, [countdownId]); // eslint-disable-line react-hooks/exhaustive-deps

  // La vista previa usa la tipografia real: Poppins (la de Ipanema en Alto Rancho) o la elegida.
  useEffect(() => { loadFont('Poppins'); if (config.font !== 'inherit') loadFont(config.font); }, [config.font]);

  const set = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const status = useMemo(() => statusLine({ ...config, startDate: scheduleStart ? config.startDate : null }, now), [config, scheduleStart, now]);

  const save = async () => {
    const payload = { ...config, startDate: scheduleStart ? config.startDate : null, storeId };
    if (!payload.name.trim()) payload.name = payload.message || 'Cuenta regresiva';
    if (!payload.endDate) { toast.warn('Elegí cuándo termina'); return; }
    setSaving(true);
    try {
      const data = await apiRequest(isEdit ? `/api/countdowns/${countdownId}` : '/api/countdowns/create', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (data.success) {
        toast.success(config.enabled ? 'Guardada. En la tienda se actualiza en un minuto.' : 'Guardada (pausada).');
        if (!isEdit && data.countdownId) navigate(`/countdown/${data.countdownId}/config`, { replace: true });
      } else {
        toast.error(data.message || 'No se pudo guardar');
      }
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container vg-page">
        <div className="vg-loading"><div className="vg-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  const endMs = Date.parse(config.endDate);
  const sizes = effectiveSizes(config);
  const mobile = device === 'mobile';
  const bar = <CountdownBarPreview config={config} endMs={endMs} now={now} mobile={mobile} />;

  return (
    <div className="page-container vg-page cd-page">
      <div className="vg-topbar">
        <button className="btn-back" onClick={() => navigate('/countdown')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="vg-btn-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Timer size={22} /></div>
        <div>
          <h1>{isEdit ? (config.name || 'Cuenta regresiva') : 'Nueva cuenta regresiva'}</h1>
          <p>Una barra con un contador hasta el fin de una promo o el arranque de un evento. Queda fija arriba, pegada al header, mientras el cliente navega.</p>
        </div>
      </div>

      {/* Vista previa sobre una maqueta del header de la tienda */}
      <div className="cd-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${status.tone}`}>{status.text}</span>
          <div className="cd-device">
            <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')} ><Monitor size={15} /> Computadora</button>
            <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')} ><Smartphone size={15} /> Celular</button>
          </div>
        </div>
        <div className={`cd-mock ${mobile ? 'cd-mock-mobile' : ''}`}>
          {config.placement === 'top' && bar}
          <div className="cd-mock-adbar">3 cuotas sin interés · 20% off por transferencia</div>
          {config.placement === 'header' && bar}
          <div className="cd-mock-header">
            <span className="cd-mock-burger" />
            <span className="cd-mock-logo">{storeName.toLowerCase()}.</span>
            <span className="cd-mock-icons"><i /><i /></span>
          </div>
          <div className="cd-mock-body">
            <div /><div /><div />
          </div>
          {config.placement === 'bottom' && <div className="cd-mock-bottom">{bar}</div>}
        </div>
      </div>

      <div className="cd-grid">
        {/* Cuándo */}
        <div className="config-section">
          <div className="section-header">
            <h2>Cuándo</h2>
            <label className="toggle-switch" title={config.enabled ? 'Activa' : 'Pausada'}>
              <input type="checkbox" checked={config.enabled} onChange={e => set('enabled', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Termina</label>
              <input type="datetime-local" value={toLocalInput(config.endDate)}
                onChange={e => set('endDate', fromLocalInput(e.target.value))} />
              <div className="cd-chips">
                {QUICK_ENDS.map(q => (
                  <button key={q.label} type="button" className="cd-chip" onClick={() => set('endDate', q.get().toISOString())}>{q.label}</button>
                ))}
              </div>
            </div>
            <label className="vg-check">
              <input type="checkbox" checked={scheduleStart} onChange={e => {
                setScheduleStart(e.target.checked);
                if (e.target.checked && !config.startDate) set('startDate', new Date(Date.now() + 3600000).toISOString());
              }} />
              Programar el inicio (si no, aparece apenas la guardás)
            </label>
            {scheduleStart && (
              <div className="vg-field">
                <label>Aparece</label>
                <input type="datetime-local" value={toLocalInput(config.startDate)}
                  onChange={e => set('startDate', fromLocalInput(e.target.value))} />
              </div>
            )}
            <p className="vg-hint">Cuando llega a cero, la barra desaparece sola. Si hay varias activas al mismo tiempo, se muestra la que termina antes.</p>
          </div>
        </div>

        {/* Contenido */}
        <div className="config-section">
          <div className="section-header"><h2>Contenido</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Mensaje</label>
              <input type="text" maxLength={120} value={config.message} placeholder="Ej: HOT DAYS · Hasta 40% off"
                onChange={e => set('message', e.target.value)} />
            </div>
            <div className="vg-row">
              <div className="vg-field cd-grow">
                <label>Texto del botón (opcional)</label>
                <input type="text" maxLength={30} value={config.buttonText} placeholder="Ej: Ver ofertas"
                  onChange={e => set('buttonText', e.target.value)} />
              </div>
              <div className="vg-field cd-grow">
                <label>Link del botón</label>
                <input type="text" value={config.buttonUrl} placeholder="Ej: /hotdays" disabled={!config.buttonText}
                  onChange={e => set('buttonUrl', e.target.value)} />
              </div>
            </div>
            <div className="vg-field">
              <label>Nombre interno</label>
              <input type="text" maxLength={80} value={config.name} placeholder="Ej: Hot Days noviembre"
                onChange={e => set('name', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Diseño */}
        <div className="config-section">
          <div className="section-header"><h2>Diseño</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Colores rápidos</label>
              <div className="cd-presets">
                {PRESETS.map(p => (
                  <button key={p.name} type="button" className="cd-preset" title={p.name}
                    onClick={() => setConfig(c => ({ ...c, ...p, name: c.name }))}>
                    <span style={{ background: p.backgroundColor }}><i style={{ background: p.buttonColor }} /></span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="cd-colors">
              {COLOR_FIELDS.map(([key, label]) => (
                <label key={key} className="cd-color">
                  <input type="color" value={config[key]} onChange={e => set(key, e.target.value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="vg-row">
              <div className="vg-field">
                <label>Contador</label>
                <select value={config.timerStyle} onChange={e => set('timerStyle', e.target.value)}>
                  <option value="boxes">Cajitas</option>
                  <option value="inline">En línea (2d 04h 58m)</option>
                  <option value="clock">Reloj (04:58:31)</option>
                </select>
              </div>
              <div className="vg-field">
                <label>Tamaño de la barra</label>
                <select value={config.size} onChange={e => setConfig(c => ({ ...c, size: e.target.value, messageSize: null, digitSize: null }))}>
                  <option value="sm">Chico</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                </select>
              </div>
              <div className="vg-field">
                <label>Tipografía</label>
                <select value={config.font} onChange={e => set('font', e.target.value)}>
                  {FONTS.map(f => <option key={f} value={f}>{f === 'inherit' ? 'La de la tienda' : f}</option>)}
                </select>
              </div>
            </div>
            <div className="cd-sliders">
              {[
                ['messageSize', 'Letra del mensaje', 10, 36, sizes.msg],
                ['digitSize', 'Letra de los números', 10, 48, sizes.digit],
              ].map(([key, label, min, max, value]) => (
                <div key={key} className="vg-field cd-slider">
                  <label>
                    {label} · {value}px
                    {config[key] != null && <button type="button" className="cd-reset" onClick={() => set(key, null)}>restablecer</button>}
                  </label>
                  <input type="range" min={min} max={max} step={1} value={value}
                    onChange={e => set(key, Number(e.target.value))} />
                </div>
              ))}
            </div>
            <p className="vg-hint cd-hint-tight">En celular la letra se achica un poco ({Math.round(MOBILE_SCALE * 100)}%) para que entre.</p>
            {config.timerStyle === 'boxes' && (
              <label className="vg-check">
                <input type="checkbox" checked={config.showLabels} onChange={e => set('showLabels', e.target.checked)} />
                Mostrar días / hs / min / seg debajo de los números
              </label>
            )}
          </div>
        </div>

        {/* Dónde */}
        <div className="config-section">
          <div className="section-header"><h2>Dónde se muestra</h2></div>
          <div className="cd-fields">
            <div className="cd-placements">
              {[
                ['header', 'Pegada al header', 'Arriba del logo, debajo de los avisos (recomendado)'],
                ['top', 'Arriba de todo', 'Primera, encima de la barra de cuotas y de todo'],
                ['bottom', 'Abajo, flotante', 'Fija en el borde inferior de la pantalla'],
              ].map(([value, title, desc]) => (
                <button key={value} type="button" className={`cd-placement ${config.placement === value ? 'active' : ''}`}
                  onClick={() => set('placement', value)}>
                  <span className={`cd-placement-icon cd-pi-${value}`}><i /><b /></span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
            {config.placement !== 'bottom' && (
              <label className="vg-check">
                <input type="checkbox" checked={config.sticky} onChange={e => set('sticky', e.target.checked)} />
                Queda fija arriba al bajar (si no, se va con la página al scrollear)
              </label>
            )}
            <div className="vg-field">
              <label>Páginas</label>
              <select value={config.pages} onChange={e => set('pages', e.target.value)}>
                <option value="all">Toda la tienda</option>
                <option value="home">Solo la página de inicio</option>
              </select>
            </div>
            <label className="vg-check">
              <input type="checkbox" checked={config.showCloseButton} onChange={e => set('showCloseButton', e.target.checked)} />
              El cliente la puede cerrar (vuelve a aparecer en su próxima visita)
            </label>
            <label className="vg-check">
              <input type="checkbox" checked={config.hideButtonOnMobile} onChange={e => set('hideButtonOnMobile', e.target.checked)} />
              Ocultar el botón en celular
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CountdownConfig;
