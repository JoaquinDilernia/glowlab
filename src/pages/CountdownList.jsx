import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Timer, Pencil, Trash2, Copy, Eye, MousePointerClick } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import CountdownBarPreview from '../components/CountdownBarPreview';
import { useNow, formatDate, formatDuration, loadFont } from '../utils/countdown';
import './StyleConfig.css';
import './VariantGroupsConfig.css';
import './CountdownConfig.css';
import './CountdownList.css';

// Mismo criterio que statusOf en functions/countdown.js, recalculado en vivo.
function statusOf(c, now) {
  if (c.enabled === false) return 'paused';
  const end = Date.parse(c.endDate);
  if (!Number.isFinite(end) || end <= now) return 'ended';
  const start = Date.parse(c.startDate);
  if (Number.isFinite(start) && start > now) return 'scheduled';
  return 'live';
}

const STATUS_LABEL = { live: 'En vivo', scheduled: 'Programada', ended: 'Terminada', paused: 'Pausada' };

function CountdownList() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const now = useNow();

  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try {
      const data = await apiRequest(`/api/countdowns?storeId=${storeId}`);
      if (data.success) setCountdowns(data.countdowns || []);
    } catch (e) {
      toast.error(e.message || 'No se pudieron cargar las cuentas regresivas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); loadFont('Poppins'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (c) => {
    try {
      const data = await apiRequest(`/api/countdowns/${c.countdownId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId, enabled: !c.enabled }),
      });
      if (data.success) setCountdowns(prev => prev.map(x => x.countdownId === c.countdownId ? { ...x, enabled: data.enabled } : x));
    } catch (e) {
      toast.error(e.message || 'No se pudo cambiar el estado');
    }
  };

  const duplicate = async (c) => {
    try {
      const data = await apiRequest(`/api/countdowns/${c.countdownId}/duplicate`, {
        method: 'POST', body: JSON.stringify({ storeId }),
      });
      if (data.success) navigate(`/countdown/${data.countdownId}/config`);
    } catch (e) {
      toast.error(e.message || 'No se pudo duplicar');
    }
  };

  const remove = async (c) => {
    try {
      const data = await apiRequest(`/api/countdowns/${c.countdownId}?storeId=${storeId}`, { method: 'DELETE' });
      if (data.success) {
        setCountdowns(prev => prev.filter(x => x.countdownId !== c.countdownId));
        toast.success('Cuenta regresiva eliminada');
      }
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar');
    } finally {
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container vg-page">
        <div className="vg-loading"><div className="vg-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  // La que se ve ahora en la tienda: en vivo y que termina antes.
  const live = countdowns.filter(c => statusOf(c, now) === 'live')
    .sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate));
  const shownId = live[0]?.countdownId;
  const order = { live: 0, scheduled: 1, paused: 2, ended: 3 };
  const sorted = [...countdowns].sort((a, b) => order[statusOf(a, now)] - order[statusOf(b, now)]);

  return (
    <div className="page-container vg-page cd-page">
      <div className="vg-topbar">
        <div />
        <button className="vg-btn-save" onClick={() => navigate('/countdown/create')}>
          <Plus size={16} /> Nueva cuenta regresiva
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Timer size={22} /></div>
        <div>
          <h1>Cuenta Regresiva</h1>
          <p>Barras con contador para el cierre de una promo o el lanzamiento de un evento. Se muestra una a la vez: la que termina antes.</p>
        </div>
      </div>

      {countdowns.length === 0 ? (
        <div className="config-section cdl-empty">
          <Timer size={36} />
          <h2>Todavía no hay cuentas regresivas</h2>
          <p>Creá una para el próximo evento (Hot Days, Cyber, un lanzamiento) y programá cuándo aparece y cuándo termina.</p>
          <button className="vg-btn-save" onClick={() => navigate('/countdown/create')}>
            <Plus size={16} /> Crear la primera
          </button>
        </div>
      ) : (
        <div className="cdl-list">
          {sorted.map(c => {
            const st = statusOf(c, now);
            const end = Date.parse(c.endDate), start = Date.parse(c.startDate);
            const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : null;
            return (
              <div key={c.countdownId} className={`cdl-card cdl-${st}`}>
                <div className="cdl-bar" onClick={() => navigate(`/countdown/${c.countdownId}/config`)}>
                  <CountdownBarPreview config={{ ...c, showCloseButton: false }} endMs={end > now ? end : NaN} now={now} compact />
                </div>
                <div className="cdl-body">
                  <div className="cdl-info">
                    <div className="cdl-title">
                      <span className={`cdl-badge cdl-badge-${st}`}>{STATUS_LABEL[st]}</span>
                      {c.countdownId === shownId && <span className="cdl-badge cdl-badge-shown">Se ve ahora en la tienda</span>}
                      <h3>{c.name}</h3>
                    </div>
                    <p className="cdl-dates">
                      {st === 'scheduled' && <>Aparece {formatDate(c.startDate)} (en {formatDuration(start - now)}) · </>}
                      {st === 'live' ? <>Termina {formatDate(c.endDate)} (en {formatDuration(end - now)})</> : <>Termina {formatDate(c.endDate)}</>}
                    </p>
                    <p className="cdl-stats">
                      <span><Eye size={13} /> {c.impressions || 0} vistas</span>
                      <span><MousePointerClick size={13} /> {c.clicks || 0} clics{ctr ? ` (${ctr}%)` : ''}</span>
                    </p>
                  </div>
                  <div className="cdl-actions">
                    <label className="toggle-switch" title={c.enabled ? 'Pausar' : 'Activar'}>
                      <input type="checkbox" checked={c.enabled} onChange={() => toggle(c)} />
                      <span className="toggle-slider"></span>
                    </label>
                    <button className="cdl-btn" onClick={() => navigate(`/countdown/${c.countdownId}/config`)} title="Editar"><Pencil size={15} /></button>
                    <button className="cdl-btn" onClick={() => duplicate(c)} title="Duplicar"><Copy size={15} /></button>
                    {confirmDelete === c.countdownId ? (
                      <>
                        <button className="cdl-btn cdl-danger cdl-confirm" onClick={() => remove(c)}>Eliminar</button>
                        <button className="cdl-btn" onClick={() => setConfirmDelete(null)}>No</button>
                      </>
                    ) : (
                      <button className="cdl-btn cdl-danger" onClick={() => setConfirmDelete(c.countdownId)} title="Eliminar"><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CountdownList;
