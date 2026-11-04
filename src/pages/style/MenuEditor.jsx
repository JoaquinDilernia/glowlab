import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor, Smartphone, Plus, Trash2, Copy, ChevronDown, ChevronUp, CalendarClock, Menu as MenuIcon,
  Upload, RefreshCw, EyeOff, Image as ImageIcon, Pin,
} from 'lucide-react';
import { apiRequest } from '../../config';
import MenuPreview from '../../components/MenuPreview';
import { useNow, formatDate } from '../../utils/countdown';
import { normalizeMenu, ITEM_DEFAULTS, SAMPLE_TREE, locate, targetName, itemStatus } from '../../utils/styleMenu';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

const BADGES = ['Nuevo', 'Hot', 'Sale', '-50%', 'Cyber'];
const STATUS = { live: ['Visible', 'ok'], scheduled: ['Programado', 'info'], ended: ['Vencido', 'warn'] };

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

// Valor del <select> de destino: "t|Alto Cyber." o "s|Muebles|Best sellers"
const encode = (t) => (t.mode === 'text' && t.text ? (t.parent ? `s|${t.parent}|${t.text}` : `t|${t.text}`) : '');
function decode(v) {
  const [k, a, b] = v.split('|');
  if (k === 't') return { mode: 'text', text: a, parent: '', position: '' };
  if (k === 's') return { mode: 'text', text: b, parent: a, position: '' };
  return null;
}

function summary(it) {
  const out = [];
  if (it.hidden) out.push('Oculto');
  if (it.emoji) out.push(it.emoji);
  if (it.look === 'pill') out.push('Pastilla');
  else if (it.color) out.push('Color');
  if (it.fontWeight && it.fontWeight >= 600) out.push('Negrita');
  if (it.badge) out.push(`“${it.badge}”`);
  if (it.imageUrl || it.imageMobileUrl) out.push('Imagen');
  if (it.devices !== 'both') out.push(it.devices === 'desktop' ? 'Solo compu' : 'Solo celu');
  return out;
}

function ImageField({ label, hint, value, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const upload = async (file) => {
    setBusy(true); setErr('');
    try {
      const fileData = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });
      const res = await apiRequest('/api/upload-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: localStorage.getItem('promonube_store_id'), fileName: file.name, fileData, folder: 'menu-images' }),
      });
      if (!res.success) throw new Error(res.message);
      onChange(res.url);
    } catch {
      setErr('No se pudo subir la imagen. Probá de nuevo.');
    } finally { setBusy(false); }
  };
  return (
    <div className="vg-field">
      <label>{label}</label>
      <div className="mn-img">
        <div className="mn-img-thumb">{value ? <img src={value} alt="" /> : <ImageIcon size={18} />}</div>
        <div className="mn-img-body">
          <div className="se-msg-row">
            <input className="se-grow" type="text" value={value} placeholder="https://… o subila" onChange={e => onChange(e.target.value)} />
            <button type="button" className="cd-chip mn-btn" disabled={busy} onClick={() => ref.current?.click()}>
              <Upload size={13} /> {busy ? 'Subiendo…' : 'Subir'}
            </button>
            {value && <button type="button" className="cdl-btn cdl-danger" title="Quitar" onClick={() => onChange('')}><Trash2 size={13} /></button>}
          </div>
          {hint && <span className="vg-hint">{hint}</span>}
          {err && <span className="vg-hint mn-err">{err}</span>}
        </div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export default function MenuEditor({ value, onChange }) {
  const c = useMemo(() => normalizeMenu(value), [value]);
  const now = useNow();
  const [device, setDevice] = useState('desktop');
  const [open, setOpen] = useState(0);
  const [tree, setTree] = useState(null);
  const [treeState, setTreeState] = useState('loading');
  const mobile = device === 'mobile';

  const loadTree = async () => {
    setTreeState('loading');
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const res = await apiRequest(`/api/style/menu-tree?storeId=${storeId}`);
      if (res.success && res.tree?.length) { setTree(res.tree); setTreeState('ok'); }
      else setTreeState('error');
    } catch { setTreeState('error'); }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del menu de la tienda
  useEffect(() => { loadTree(); }, []);

  const T = tree || SAMPLE_TREE;
  const set = (patch) => onChange({ ...c, ...patch });
  const setItem = (i, patch) => set({ items: c.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const add = (target) => {
    set({ items: [...c.items, { ...ITEM_DEFAULTS, target: target || { ...ITEM_DEFAULTS.target } }] });
    setOpen(c.items.length);
  };
  const move = (i, d) => {
    const list = [...c.items];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ items: list });
    setOpen(j);
  };

  const cur = c.items[open];
  const curHit = cur ? locate(T, cur.target) : null;
  const liveCount = c.items.filter(it => itemStatus(it, now) === 'live').length;

  // Click en un item de la vista previa: abre su ajuste o crea uno.
  const pick = (top, sub) => {
    const target = sub == null
      ? { mode: 'text', text: T[top].label, parent: '', position: '' }
      : { mode: 'text', text: T[top].children[sub], parent: T[top].label, position: '' };
    const idx = c.items.findIndex(it => { const h = locate(T, it.target); return h && h.top === top && (h.sub ?? null) === (sub ?? null); });
    if (idx >= 0) setOpen(idx); else add(target);
  };

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><MenuIcon size={20} /></div>
          <div>
            <h2>Menú principal</h2>
            <p>Destacá categorías del menú de tu tienda: emoji, color, pastilla, etiqueta "Nuevo", imagen en el desplegable, ocultar o programar por fechas.</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activo' : 'Apagado'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* Vista previa */}
      <div className="cd-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${!c.enabled ? 'muted' : liveCount ? 'ok' : 'warn'}`}>
            {!c.enabled ? 'Apagado: el menú de la tienda queda como está.' : liveCount ? `Activo · ${liveCount} ajuste${liveCount > 1 ? 's' : ''} aplicado${liveCount > 1 ? 's' : ''}.` : 'No hay ajustes activos ahora.'}
          </span>
          <div className="cd-device">
            <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
            <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
          </div>
        </div>
        <div className={`cd-mock mn-mock ${mobile ? 'cd-mock-mobile' : ''}`}>
          <div className="cd-mock-header">
            <span className="cd-mock-burger" />
            <span className="cd-mock-logo">{(localStorage.getItem('promonube_store_name') || 'tu tienda').toLowerCase()}.</span>
            <span className="cd-mock-icons"><i /><i /></span>
          </div>
          <MenuPreview tree={T} items={c.items} mobile={mobile} now={now}
            focus={curHit ? curHit.top : null} onPick={pick} />
        </div>
        <div className="mn-tree-note">
          {treeState === 'loading' && 'Leyendo el menú de tu tienda…'}
          {treeState === 'ok' && <>Menú leído de tu tienda. Pasá el mouse por las categorías para ver los desplegables.</>}
          {treeState === 'error' && <>No pudimos leer el menú de tu tienda: se muestra uno de ejemplo. </>}
          <button type="button" className="mn-link" onClick={loadTree}><RefreshCw size={12} /> Volver a leer</button>
        </div>
      </div>

      <div className="mn-layout">
        {/* Lista de ajustes */}
        <div className="config-section mn-list">
          <div className="section-header">
            <h2>Ajustes</h2>
            <button className="vg-btn-save" type="button" onClick={() => add()}><Plus size={16} /> Agregar</button>
          </div>
          {c.items.length === 0 && <p className="vg-hint">Todavía no hay ajustes. Tocá "Agregar" o elegí una categoría abajo.</p>}
          <div className="mn-items">
            {c.items.map((it, i) => {
              const st = itemStatus(it, now);
              const found = !!locate(T, it.target);
              return (
                <button type="button" key={i} className={`mn-item ${open === i ? 'active' : ''}`} onClick={() => setOpen(i)}>
                  <div className="mn-item-top">
                    <strong>{targetName(it.target, T) || 'Sin elegir'}</strong>
                    <span className={`cd-status cd-status-${STATUS[st][1]} se-chip`}>{STATUS[st][0]}</span>
                  </div>
                  <div className="mn-item-tags">
                    {summary(it).map(s => <span key={s}>{s}</span>)}
                    {!found && (it.target.text || it.target.position) && <span className="mn-warn">No está en el menú</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mn-quick">
            <span className="vg-hint">Categorías de tu menú:</span>
            <div className="mn-quick-list">
              {T.map((n, i) => <button key={i} type="button" className="cd-chip" onClick={() => pick(i, null)}>{n.label}</button>)}
            </div>
          </div>
        </div>

        {/* Detalle */}
        <div className="config-section mn-detail">
          {!cur && <p className="vg-hint">Elegí un ajuste de la lista o agregá uno.</p>}
          {cur && (
            <>
              <div className="section-header">
                <h2>{targetName(cur.target, T) || 'Nuevo ajuste'}</h2>
                <div className="se-msg-actions">
                  <button type="button" className="cdl-btn" title="Subir" disabled={open === 0} onClick={() => move(open, -1)}><ChevronUp size={14} /></button>
                  <button type="button" className="cdl-btn" title="Bajar" disabled={open === c.items.length - 1} onClick={() => move(open, 1)}><ChevronDown size={14} /></button>
                  <button type="button" className="cdl-btn" title="Duplicar" onClick={() => { set({ items: [...c.items.slice(0, open + 1), { ...cur }, ...c.items.slice(open + 1)] }); setOpen(open + 1); }}><Copy size={14} /></button>
                  <button type="button" className="cdl-btn cdl-danger" title="Eliminar" onClick={() => { set({ items: c.items.filter((_, j) => j !== open) }); setOpen(Math.max(0, open - 1)); }}><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="cd-fields">
                {/* Destino */}
                <div className="vg-field">
                  <label>¿Qué ítem del menú?</label>
                  <select value={encode(cur.target)} onChange={e => { const t = decode(e.target.value); if (t) setItem(open, { target: t }); }}>
                    <option value="">{cur.target.mode === 'position' && cur.target.position ? `Posición ${cur.target.position} (config vieja)` : 'Elegí un ítem…'}</option>
                    {T.map((n, i) => (
                      <optgroup key={i} label={n.label}>
                        <option value={`t|${n.label}`}>{n.label} (categoría)</option>
                        {n.children.map((s, j) => <option key={j} value={`s|${n.label}|${s}`}>{'   '}{s}</option>)}
                      </optgroup>
                    ))}
                    {cur.target.mode === 'text' && cur.target.text && !locate(T, cur.target) && (
                      <option value={encode(cur.target)}>{targetName(cur.target)} (no está en el menú)</option>
                    )}
                  </select>
                  {cur.target.mode === 'position' && curHit && (
                    <div className="mn-pin">
                      Hoy apunta a la <b>posición {cur.target.position}</b> ({targetName(cur.target, T)}). Si reordenás el menú, cambia de ítem.
                      <button type="button" className="cd-chip" onClick={() => setItem(open, { target: curHit.sub == null
                        ? { mode: 'text', text: T[curHit.top].label, parent: '', position: '' }
                        : { mode: 'text', text: T[curHit.top].children[curHit.sub], parent: T[curHit.top].label, position: '' } })}>
                        <Pin size={12} /> Fijarlo a "{targetName(cur.target, T)}"
                      </button>
                    </div>
                  )}
                </div>

                {/* Texto */}
                <div className="mn-block">
                  <h3>Cómo se ve</h3>
                  <div className="se-seg">
                    {[['text', 'Texto'], ['pill', 'Pastilla']].map(([v, t]) => (
                      <button key={v} type="button" className={cur.look === v ? 'active' : ''} onClick={() => setItem(open, { look: v })}>{t}</button>
                    ))}
                  </div>
                  <div className="se-msg-row">
                    <input className="se-emoji" type="text" maxLength={4} value={cur.emoji} placeholder="🔥" title="Emoji (opcional)"
                      onChange={e => setItem(open, { emoji: e.target.value })} />
                    <div className="se-seg">
                      {[['before', 'Antes'], ['after', 'Después']].map(([v, t]) => (
                        <button key={v} type="button" className={cur.emojiPosition === v ? 'active' : ''} onClick={() => setItem(open, { emojiPosition: v })}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="cd-colors">
                    {cur.look === 'pill' ? (
                      <>
                        <label className="cd-color"><input type="color" value={cur.pillColor} onChange={e => setItem(open, { pillColor: e.target.value })} /><span>Fondo</span></label>
                        <label className="cd-color"><input type="color" value={cur.pillTextColor} onChange={e => setItem(open, { pillTextColor: e.target.value })} /><span>Texto</span></label>
                      </>
                    ) : (
                      <>
                        <label className="cd-color"><input type="color" value={cur.color || '#353434'} onChange={e => setItem(open, { color: e.target.value })} /><span>Color</span></label>
                        {cur.color && <button type="button" className="mn-link" onClick={() => setItem(open, { color: null })}>Usar el de la tienda</button>}
                      </>
                    )}
                  </div>
                  <div className="vg-row">
                    <div className="vg-field cd-grow">
                      <label>Grosor</label>
                      <select value={cur.fontWeight ?? ''} onChange={e => setItem(open, { fontWeight: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">El de la tienda</option>
                        <option value={400}>Normal</option>
                        <option value={500}>Media</option>
                        <option value={600}>Semi negrita</option>
                        <option value={700}>Negrita</option>
                        <option value={800}>Extra negrita</option>
                      </select>
                    </div>
                    <div className="vg-field cd-grow cd-slider">
                      <label>
                        Tamaño · {cur.fontSize ? `${cur.fontSize}px` : 'el de la tienda'}
                        {cur.fontSize && <button type="button" className="mn-link" onClick={() => setItem(open, { fontSize: null })}>restablecer</button>}
                      </label>
                      <input type="range" min={10} max={24} value={cur.fontSize || 13} onChange={e => setItem(open, { fontSize: Number(e.target.value) })} />
                    </div>
                  </div>
                  <label className="vg-check"><input type="checkbox" checked={cur.uppercase} onChange={e => setItem(open, { uppercase: e.target.checked })} /> MAYÚSCULAS</label>
                </div>

                {/* Etiqueta */}
                <div className="mn-block">
                  <h3>Etiqueta</h3>
                  <div className="se-msg-row">
                    <input className="se-grow" type="text" maxLength={14} value={cur.badge} placeholder="Ej: Nuevo" onChange={e => setItem(open, { badge: e.target.value })} />
                    <input type="color" className="se-color" value={cur.badgeColor} title="Fondo" onChange={e => setItem(open, { badgeColor: e.target.value })} />
                    <input type="color" className="se-color" value={cur.badgeTextColor} title="Texto" onChange={e => setItem(open, { badgeTextColor: e.target.value })} />
                  </div>
                  <div className="mn-quick-list">
                    {BADGES.map(b => <button key={b} type="button" className="cd-chip" onClick={() => setItem(open, { badge: b })}>{b}</button>)}
                    {cur.badge && <button type="button" className="mn-link" onClick={() => setItem(open, { badge: '' })}>Quitar</button>}
                  </div>
                </div>

                {/* Imagen */}
                <div className="mn-block">
                  <h3>Imagen en el desplegable</h3>
                  {curHit && curHit.sub != null ? (
                    <p className="vg-hint">Solo las categorías principales tienen desplegable. Elegí "{T[curHit.top].label}" para sumarle una imagen.</p>
                  ) : (
                    <>
                      <ImageField label="Imagen" hint="Vertical, 1080 × 1350 px. En compu va a la derecha del desplegable." value={cur.imageUrl} onChange={v => setItem(open, { imageUrl: v })} />
                      {(cur.imageUrl || cur.imageMobileUrl) && (
                        <>
                          <div className="vg-row">
                            <div className="vg-field cd-grow">
                              <label>Link al tocarla</label>
                              <input type="text" value={cur.imageLink} placeholder="/sillas/new-in/" onChange={e => setItem(open, { imageLink: e.target.value })} />
                            </div>
                            <div className="vg-field cd-grow">
                              <label>Texto abajo</label>
                              <input type="text" maxLength={60} value={cur.imageCaption} placeholder="Ver colección →" onChange={e => setItem(open, { imageCaption: e.target.value })} />
                            </div>
                          </div>
                          <label className="vg-check"><input type="checkbox" checked={cur.imageOnMobile} onChange={e => setItem(open, { imageOnMobile: e.target.checked })} /> Mostrarla también en el menú del celular</label>
                          {cur.imageOnMobile && (
                            <ImageField label="Imagen distinta para celular (opcional)" hint="Si la dejás vacía usa la misma." value={cur.imageMobileUrl} onChange={v => setItem(open, { imageMobileUrl: v })} />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Visibilidad */}
                <div className="mn-block">
                  <h3>Cuándo y dónde</h3>
                  <div className="se-seg">
                    {[['both', 'Compu y celu'], ['desktop', 'Solo compu'], ['mobile', 'Solo celu']].map(([v, t]) => (
                      <button key={v} type="button" className={cur.devices === v ? 'active' : ''} onClick={() => setItem(open, { devices: v })}>{t}</button>
                    ))}
                  </div>
                  <label className="vg-check"><input type="checkbox" checked={cur.hidden} onChange={e => setItem(open, { hidden: e.target.checked })} /> <EyeOff size={13} /> Ocultar este ítem del menú</label>
                  <div className="se-msg-row">
                    <label className="se-date"><CalendarClock size={13} /> Desde
                      <input type="datetime-local" value={toLocalInput(cur.startDate)} onChange={e => setItem(open, { startDate: fromLocalInput(e.target.value) })} />
                    </label>
                    <label className="se-date">Hasta
                      <input type="datetime-local" value={toLocalInput(cur.endDate)} onChange={e => setItem(open, { endDate: fromLocalInput(e.target.value) })} />
                    </label>
                  </div>
                  <span className="vg-hint">
                    {itemStatus(cur, now) === 'scheduled' ? `Se aplica ${formatDate(cur.startDate)}.` : cur.endDate ? (itemStatus(cur, now) === 'ended' ? 'Ya venció.' : `Se quita ${formatDate(cur.endDate)}.`) : 'Sin fechas: se aplica siempre.'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
