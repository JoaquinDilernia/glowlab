import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Gift, Plus, X, Copy, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';
import './GiftRegistryConfig.css';

// Piloto: mismas tiendas que Grupos de Variantes (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
// TODO: quitar allowlist cuando se libere a todas las tiendas.
const ALLOWED_STORE_IDS = ['2547699', '5320806', '6854698'];

const MODES = [
  { id: 'couple_address', label: 'Envío a casa de los novios', hint: 'La dirección de los novios llega cargada al checkout; el invitado paga el envío.' },
  { id: 'store_pickup', label: 'La tienda los junta y entrega', hint: 'El invitado elige retiro en el local; la tienda entrega todo junto.' },
  { id: 'guest_choice', label: 'El invitado elige', hint: 'Checkout normal: envío o retiro a elección del invitado.' },
];
const MODE_LABEL = Object.fromEntries(MODES.map(m => [m.id, m.label]));

const EVENT_TYPES = [
  { id: 'wedding', label: 'Casamiento' },
  { id: 'baby', label: 'Baby shower' },
  { id: 'birthday', label: 'Cumpleaños' },
  { id: 'housewarming', label: 'Mudanza' },
  { id: 'other', label: 'Otro' },
];

const DEFAULT_CONFIG = {
  enabled: false,
  allowedModes: MODES.map(m => m.id),
  reservationHours: 2,
  pagePath: '/lista-de-regalos/',
  texts: { title: '', intro: '' },
};

const EMPTY_LIST = {
  title: '', eventType: 'wedding', eventDate: '', message: '',
  owners: [{ name: '', email: '' }, { name: '', email: '' }],
  deliveryMode: 'couple_address',
  address: { address: '', number: '', floor: '', locality: '', city: '', province: '', zipcode: '' },
};

const money = (n) => '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const formatDate = (iso) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR') : '';

function CreateListModal({ storeId, allowedModes, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY_LIST, deliveryMode: allowedModes[0] || 'guest_choice' });
  const [saving, setSaving] = useState(false);

  const setOwner = (i, patch) => setForm(f => ({ ...f, owners: f.owners.map((o, k) => k === i ? { ...o, ...patch } : o) }));
  const setAddress = (patch) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));

  const submit = async () => {
    setSaving(true);
    try {
      const list = { ...form, owners: form.owners.filter(o => o.name.trim() || o.email.trim()) };
      const res = await apiRequest('/api/gift-registry/lists', { method: 'POST', body: JSON.stringify({ storeId, list }) });
      if (res?.success) {
        toast.success(res.invited ? 'Lista creada. Les mandamos el mail a los novios.' : 'Lista creada (no se pudo mandar el mail).');
        onCreated();
      } else {
        toast.error(res?.message || 'No se pudo crear la lista');
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gr-overlay" onClick={onClose}>
      <div className="gr-drawer" onClick={e => e.stopPropagation()}>
        <div className="gr-drawer-head">
          <h2>Nueva lista</h2>
          <button className="gr-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="gr-form">
          <label className="vg-field gr-span-2">
            <span>Nombre de la lista</span>
            <input type="text" placeholder="Sofi y Juan" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="vg-field">
            <span>Evento</span>
            <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
              {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="vg-field">
            <span>Fecha</span>
            <input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} />
          </label>

          {form.owners.map((o, i) => (
            <div key={i} className="gr-owner gr-span-2">
              <label className="vg-field">
                <span>{i === 0 ? 'Nombre' : 'Nombre (opcional)'}</span>
                <input type="text" value={o.name} onChange={e => setOwner(i, { name: e.target.value })} />
              </label>
              <label className="vg-field">
                <span>{i === 0 ? 'Email' : 'Email (opcional)'}</span>
                <input type="email" value={o.email} onChange={e => setOwner(i, { email: e.target.value })} />
              </label>
            </div>
          ))}

          <div className="vg-field gr-span-2">
            <span>Entrega</span>
            <div className="gr-modes">
              {MODES.filter(m => allowedModes.includes(m.id)).map(m => (
                <label key={m.id} className={`gr-mode ${form.deliveryMode === m.id ? 'is-on' : ''}`}>
                  <input type="radio" name="mode" checked={form.deliveryMode === m.id} onChange={() => setForm(f => ({ ...f, deliveryMode: m.id }))} />
                  <strong>{m.label}</strong>
                  <small>{m.hint}</small>
                </label>
              ))}
            </div>
          </div>

          {form.deliveryMode === 'couple_address' && (
            <>
              <label className="vg-field"><span>Calle</span><input type="text" value={form.address.address} onChange={e => setAddress({ address: e.target.value })} /></label>
              <label className="vg-field"><span>Número</span><input type="text" value={form.address.number} onChange={e => setAddress({ number: e.target.value })} /></label>
              <label className="vg-field"><span>Piso / depto (opcional)</span><input type="text" value={form.address.floor} onChange={e => setAddress({ floor: e.target.value })} /></label>
              <label className="vg-field"><span>Barrio (opcional)</span><input type="text" value={form.address.locality} onChange={e => setAddress({ locality: e.target.value })} /></label>
              <label className="vg-field"><span>Ciudad</span><input type="text" value={form.address.city} onChange={e => setAddress({ city: e.target.value })} /></label>
              <label className="vg-field"><span>Provincia</span><input type="text" value={form.address.province} onChange={e => setAddress({ province: e.target.value })} /></label>
              <label className="vg-field"><span>Código postal</span><input type="text" value={form.address.zipcode} onChange={e => setAddress({ zipcode: e.target.value })} /></label>
            </>
          )}

          <label className="vg-field gr-span-2">
            <span>Mensaje para los invitados (opcional)</span>
            <textarea rows={3} maxLength={500} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
          </label>
        </div>

        <p className="vg-hint">Los novios reciben un mail para entrar y sumar productos desde la tienda.</p>
        <div className="gr-drawer-foot">
          <button className="btn-back" onClick={onClose}>Cancelar</button>
          <button className="vg-btn-save" onClick={submit} disabled={saving}>{saving ? 'Creando…' : 'Crear lista'}</button>
        </div>
      </div>
    </div>
  );
}

function ListDetail({ storeId, listId, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [manual, setManual] = useState(null); // { itemId, quantity, guestName, message }

  const fetchDetail = useCallback(
    () => apiRequest(`/api/gift-registry/lists/${listId}?storeId=${storeId}`),
    [listId, storeId],
  );

  const load = async () => {
    const res = await fetchDetail();
    if (res?.success) setData(res);
    else toast.error(res?.message || 'No se pudo cargar la lista');
  };

  useEffect(() => {
    let alive = true;
    fetchDetail().then(res => {
      if (alive && res?.success) setData(res);
    });
    return () => { alive = false; };
  }, [fetchDetail]);

  const setStatus = async (status) => {
    const res = await apiRequest(`/api/gift-registry/lists/${listId}/status`, { method: 'POST', body: JSON.stringify({ storeId, status }) });
    if (res?.success) { toast.success(status === 'closed' ? 'Lista cerrada' : 'Lista reabierta'); load(); onChanged(); }
    else toast.error(res?.message || 'Error');
  };

  const saveManual = async () => {
    const res = await apiRequest(`/api/gift-registry/lists/${listId}/manual-gift`, { method: 'POST', body: JSON.stringify({ storeId, ...manual }) });
    if (res?.success) { toast.success('Regalo marcado'); setManual(null); load(); onChanged(); }
    else toast.error(res?.message || 'Error');
  };

  const copy = (text) => { navigator.clipboard?.writeText(text); toast.success('Link copiado'); };

  const list = data?.list;
  const itemName = (itemId) => list?.items.find(i => i.itemId === itemId)?.name || '—';

  return (
    <div className="gr-overlay" onClick={onClose}>
      <div className="gr-drawer gr-drawer--wide" onClick={e => e.stopPropagation()}>
        <div className="gr-drawer-head">
          <h2>{list ? list.title : 'Cargando…'}</h2>
          <button className="gr-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        {list && (
          <>
            <div className="gr-meta">
              <span>{EVENT_TYPES.find(t => t.id === list.eventType)?.label} · {formatDate(list.eventDate)}</span>
              <span>{MODE_LABEL[list.deliveryMode]}</span>
              <span>{list.owners.map(o => `${o.name} <${o.email}>`).join(' · ')}</span>
              {list.address && <span>{[list.address.address, list.address.number, list.address.floor, list.address.city, list.address.zipcode].filter(Boolean).join(' ')}</span>}
            </div>

            {list.publicUrl && (
              <div className="gr-link">
                <code>{list.publicUrl}</code>
                <button className="btn-back" onClick={() => copy(list.publicUrl)}><Copy size={14} /> Copiar</button>
              </div>
            )}

            <h3 className="gr-subtitle">Regalos de la lista</h3>
            {list.items.length === 0 && <p className="vg-hint">Los novios todavía no agregaron productos.</p>}
            <div className="gr-items">
              {list.items.map(item => (
                <div key={item.itemId} className="gr-item">
                  {item.image ? <img src={item.image} alt="" /> : <span className="gr-item-ph" />}
                  <div className="gr-item-info">
                    <strong>{item.name}</strong>
                    <span className="vg-hint">{money(item.price)} · {item.gifted} de {item.quantity} regalados</span>
                  </div>
                  {item.gifted > item.quantity && (
                    <span className="gr-warn" title="Se pagó más de lo pedido (reserva vencida). Resolver con la política de cambios.">
                      <AlertTriangle size={14} /> De más
                    </span>
                  )}
                  {item.available > 0 && (
                    <button className="btn-back" onClick={() => setManual({ itemId: item.itemId, quantity: 1, guestName: '', message: '' })}>
                      Marcar regalado
                    </button>
                  )}
                </div>
              ))}
            </div>

            {manual && (
              <div className="gr-manual">
                <strong>Marcar "{itemName(manual.itemId)}" como regalado</strong>
                <div className="gr-form">
                  <label className="vg-field"><span>Quién lo regaló</span><input type="text" value={manual.guestName} onChange={e => setManual(m => ({ ...m, guestName: e.target.value }))} /></label>
                  <label className="vg-field"><span>Cantidad</span><input type="number" min="1" value={manual.quantity} onChange={e => setManual(m => ({ ...m, quantity: Number(e.target.value) }))} /></label>
                  <label className="vg-field gr-span-2"><span>Mensaje (opcional)</span><input type="text" value={manual.message} onChange={e => setManual(m => ({ ...m, message: e.target.value }))} /></label>
                </div>
                <div className="gr-drawer-foot">
                  <button className="btn-back" onClick={() => setManual(null)}>Cancelar</button>
                  <button className="vg-btn-save" onClick={saveManual}>Guardar</button>
                </div>
              </div>
            )}

            <h3 className="gr-subtitle">Compras</h3>
            {data.gifts.length === 0 && <p className="vg-hint">Todavía no hay compras ni reservas.</p>}
            <div className="gr-gifts">
              {data.gifts.map(g => (
                <div key={g.giftId} className="gr-gift">
                  <span className={`vg-tag gr-status gr-status--${g.status}`}>
                    {{ paid: 'Pagado', manual: 'Manual', reserved: 'Reservado' }[g.status] || g.status}
                  </span>
                  <div className="gr-item-info">
                    <strong>{g.guestName || 'Sin nombre'} {g.guestEmail && <span className="vg-hint">· {g.guestEmail}</span>}</strong>
                    <span className="vg-hint">{itemName(g.itemId)} x{g.quantity}{g.orderId ? ` · pedido ${g.orderId}` : ''}</span>
                    {g.message && <em className="gr-msg">"{g.message}"</em>}
                  </div>
                </div>
              ))}
            </div>

            <div className="gr-drawer-foot">
              {list.status === 'active'
                ? <button className="vg-btn-remove" onClick={() => setStatus('closed')}>Cerrar lista</button>
                : <button className="btn-back" onClick={() => setStatus('active')}>Reabrir lista</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function GiftRegistryConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const allowed = ALLOWED_STORE_IDS.includes(String(storeId));

  useEffect(() => {
    if (!allowed) navigate('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [lists, setLists] = useState([]);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [openListId, setOpenListId] = useState(null);

  const loadLists = useCallback(async () => {
    const res = await apiRequest(`/api/gift-registry/lists?storeId=${storeId}`);
    if (res?.success) setLists(res.lists);
  }, [storeId]);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      try {
        const res = await apiRequest(`/api/gift-registry/config?storeId=${storeId}`);
        if (res?.success) setConfig({ ...DEFAULT_CONFIG, ...res.config });
        await loadLists();
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/gift-registry/config', { method: 'POST', body: JSON.stringify({ storeId, config }) });
      if (res?.success) { setConfig(c => ({ ...c, ...res.config })); toast.success('Configuración guardada'); }
      else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMode = (id) => setConfig(c => ({
    ...c,
    allowedModes: c.allowedModes.includes(id) ? c.allowedModes.filter(m => m !== id) : [...c.allowedModes, id],
  }));

  const q = filter.trim().toLowerCase();
  const visibleLists = lists.filter(l => !q || l.title.toLowerCase().includes(q) || l.slug.includes(q));

  if (!allowed) return null;

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
        <button className="btn-back" onClick={() => navigate('/dashboard')}><ArrowLeft size={16} /> Volver</button>
        <button className="vg-btn-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Gift size={22} /></div>
        <div>
          <h1>Lista de Regalos</h1>
          <p>Los novios arman su lista con productos de la tienda y los invitados la pagan en el checkout.</p>
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>General</h2>
          <label className="toggle-switch">
            <input type="checkbox" checked={!!config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="vg-field">
          <label>Modos de entrega que pueden elegir los novios</label>
        </div>
        <div className="gr-modes">
          {MODES.map(m => (
            <label key={m.id} className={`gr-mode ${config.allowedModes.includes(m.id) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={config.allowedModes.includes(m.id)} onChange={() => toggleMode(m.id)} />
              <strong>{m.label}</strong>
              <small>{m.hint}</small>
            </label>
          ))}
        </div>

        <div className="vg-row gr-row-gap">
          <div className="vg-field">
            <label>Reserva del regalo (horas)</label>
            <input type="number" min="1" max="48" value={config.reservationHours}
              onChange={e => setConfig(c => ({ ...c, reservationHours: Number(e.target.value) }))} />
          </div>
          <div className="vg-field gr-grow">
            <label>Página de la lista en la tienda</label>
            <input type="text" value={config.pagePath} onChange={e => setConfig(c => ({ ...c, pagePath: e.target.value }))} />
          </div>
        </div>
        <p className="vg-hint">
          Creá en Tiendanube una página vacía con esa dirección (Mi tienda online → Páginas). Ahí se muestran
          las listas. La reserva evita que dos invitados compren el mismo regalo mientras pagan.
        </p>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>Listas</h2>
          <button className="vg-btn-save" onClick={() => setCreating(true)}><Plus size={16} /> Nueva lista</button>
        </div>
        <input type="text" className="vg-search" placeholder="Buscar por nombre…" value={filter} onChange={e => setFilter(e.target.value)} />

        {visibleLists.length === 0 && <p className="vg-hint">Todavía no hay listas.</p>}

        <div className="gr-table">
          {visibleLists.map(l => (
            <button key={l.id} className={`gr-row ${l.status === 'closed' ? 'is-closed' : ''}`} onClick={() => setOpenListId(l.id)}>
              <div className="gr-row-main">
                <strong>{l.title}</strong>
                <span className="vg-hint">{formatDate(l.eventDate)} · {MODE_LABEL[l.deliveryMode]}{l.createdBy === 'store' ? ' · creada en el local' : ''}</span>
              </div>
              <div className="gr-progress" title={`${l.unitsGifted} de ${l.unitsWanted} unidades regaladas`}>
                <span style={{ width: `${l.unitsWanted ? Math.min(100, (l.unitsGifted / l.unitsWanted) * 100) : 0}%` }} />
              </div>
              <span className="gr-row-num">{l.unitsGifted}/{l.unitsWanted}</span>
              <span className="gr-row-num">{money(l.totalPaid)}</span>
              {l.overGifted && <AlertTriangle size={16} className="gr-warn-icon" />}
              <span className={`vg-tag ${l.status === 'active' ? 'vg-tag--addition' : ''}`}>{l.status === 'active' ? 'Activa' : 'Cerrada'}</span>
            </button>
          ))}
        </div>
      </div>

      {creating && (
        <CreateListModal
          storeId={storeId}
          allowedModes={config.allowedModes}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); loadLists(); }}
        />
      )}
      {openListId && (
        <ListDetail storeId={storeId} listId={openListId} onClose={() => setOpenListId(null)} onChanged={loadLists} />
      )}
    </div>
  );
}
