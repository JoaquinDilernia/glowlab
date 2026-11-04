import { useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Plus, Trash2, Copy, ChevronUp, ChevronDown, CalendarClock, Megaphone } from 'lucide-react';
import TopBarPreview from '../../components/TopBarPreview';
import { useNow, loadFont, formatDate } from '../../utils/countdown';
import { normalizeTopBar, EMPTY_MESSAGE, FONTS, SEPARATORS, messageStatus } from '../../utils/topAnnouncement';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

// Paletas: las dos primeras salen de Alto Rancho (la barra actual es blanca con
// texto grafito y linea gris abajo).
const PRESETS = [
  { name: 'Blanco', backgroundColor: '#ffffff', textColor: '#353434', borderColor: '#c7c7c7', borderBottom: true, borderTop: false },
  { name: 'Grafito', backgroundColor: '#353434', textColor: '#ffffff', borderColor: '#353434', borderBottom: false, borderTop: false },
  { name: 'Celeste', backgroundColor: '#8aa1c4', textColor: '#ffffff', borderColor: '#8aa1c4', borderBottom: false, borderTop: false },
  { name: 'Arena', backgroundColor: '#f4f1ec', textColor: '#353434', borderColor: '#e3ddd3', borderBottom: true, borderTop: false },
  { name: 'Negro', backgroundColor: '#111111', textColor: '#ffffff', borderColor: '#111111', borderBottom: false, borderTop: false },
];

const MODES = [
  ['static', 'Fijos', 'Todos a la vez, con separador'],
  ['rotate', 'Rotando', 'De a uno, cambian solos'],
  ['marquee', 'Marquesina', 'Se desplazan de costado'],
];

const PLACEMENTS = [
  ['top', 'Arriba de todo', 'Primera, encima de la barra de cuotas'],
  ['above-logo', 'Arriba del logo', 'Debajo de los avisos de la plantilla'],
  ['below-header', 'Debajo del menú', 'En celular, debajo del logo'],
];

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const STATUS = { live: ['Visible', 'ok'], scheduled: ['Programado', 'info'], ended: ['Vencido', 'warn'] };

const DEFAULT_TITLE = 'Barra de anuncios';
const DEFAULT_DESCRIPTION = 'Mensajes cortos con link en una franja del header: novedades, envío gratis, cuotas. Se ve en computadora y en celular.';

// Tambien se usa para la segunda franja (config "announcementBar", ex "Menu inferior"):
// mismo motor en la tienda (functions/top-announcement.js), otra config.
export default function TopAnnouncementBarEditor({ value, onChange, storeName = 'tu tienda', title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION }) {
  const c = useMemo(() => normalizeTopBar(value), [value]);
  const now = useNow();
  const [device, setDevice] = useState('desktop');
  const [openSchedule, setOpenSchedule] = useState({});
  const mobile = device === 'mobile';

  useEffect(() => { loadFont('Poppins'); if (c.font !== 'inherit') loadFont(c.font); }, [c.font]);

  const set = (patch) => onChange({ ...c, ...patch });
  const setMsg = (i, patch) => set({ messages: c.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const moveMsg = (i, d) => {
    const list = [...c.messages];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ messages: list });
  };

  const bar = <TopBarPreview config={c} mobile={mobile} now={now} />;
  const activeCount = c.messages.filter(m => m.text.trim() && messageStatus(m, now) === 'live').length;

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><Megaphone size={20} /></div>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activa' : 'Apagada'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      {/* Vista previa */}
      <div className="cd-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${!c.enabled ? 'muted' : activeCount ? 'ok' : 'warn'}`}>
            {!c.enabled ? 'Apagada: no se muestra en la tienda.' : activeCount ? `Activa · ${activeCount} mensaje${activeCount > 1 ? 's' : ''} visible${activeCount > 1 ? 's' : ''} ahora.` : 'No hay mensajes visibles ahora.'}
          </span>
          <div className="cd-device">
            <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
            <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
          </div>
        </div>
        <div className={`cd-mock ${mobile ? 'cd-mock-mobile' : ''}`}>
          {c.placement === 'top' && bar}
          <div className="cd-mock-adbar">3 cuotas sin interés · 20% off por transferencia</div>
          {c.placement === 'above-logo' && bar}
          <div className="cd-mock-header">
            <span className="cd-mock-burger" />
            <span className="cd-mock-logo">{storeName.toLowerCase()}.</span>
            <span className="cd-mock-icons"><i /><i /></span>
          </div>
          {!mobile && <div className="se-mock-nav"><span>Categorías</span><span>Sillas</span><span>Muebles</span><span>Iluminación</span><span>Deco</span><span>SALE</span></div>}
          {c.placement === 'below-header' && bar}
          <div className="cd-mock-body"><div /><div /><div /></div>
        </div>
      </div>

      <div className="se-grid">
        {/* Mensajes */}
        <div className="config-section se-span">
          <div className="section-header">
            <h2>Mensajes</h2>
            <button className="vg-btn-save" type="button" disabled={c.messages.length >= 12}
              onClick={() => set({ messages: [...c.messages, { ...EMPTY_MESSAGE }] })}>
              <Plus size={16} /> Agregar
            </button>
          </div>
          {c.messages.length === 0 && <p className="vg-hint">Todavía no hay mensajes. Agregá el primero.</p>}
          <div className="se-messages">
            {c.messages.map((m, i) => {
              const st = messageStatus(m, now);
              const sched = openSchedule[i] || m.startDate || m.endDate;
              return (
                <div key={i} className="se-msg">
                  <div className="se-msg-order">
                    <button type="button" onClick={() => moveMsg(i, -1)} disabled={i === 0} title="Subir"><ChevronUp size={15} /></button>
                    <span>{i + 1}</span>
                    <button type="button" onClick={() => moveMsg(i, 1)} disabled={i === c.messages.length - 1} title="Bajar"><ChevronDown size={15} /></button>
                  </div>
                  <div className="se-msg-body">
                    <div className="se-msg-row">
                      <input className="se-emoji" type="text" maxLength={4} value={m.emoji} placeholder="🔥"
                        onChange={e => setMsg(i, { emoji: e.target.value })} title="Emoji (opcional)" />
                      <input className="se-grow" type="text" maxLength={120} value={m.text} placeholder="Ej: Envío gratis superando $150.000"
                        onChange={e => setMsg(i, { text: e.target.value })} />
                      <span className={`cd-status cd-status-${STATUS[st][1]} se-chip`}>{STATUS[st][0]}</span>
                    </div>
                    <div className="se-msg-row">
                      <input className="se-grow" type="text" value={m.link} placeholder="Link (opcional) · Ej: /sillas/new-in/"
                        onChange={e => setMsg(i, { link: e.target.value })} />
                      <select value={m.highlight} onChange={e => setMsg(i, { highlight: e.target.value })} title="Resaltado">
                        <option value="none">Normal</option>
                        <option value="bold">Negrita</option>
                        <option value="color">Color propio</option>
                        <option value="pill">Etiqueta</option>
                      </select>
                      {(m.highlight === 'color' || m.highlight === 'pill') && (
                        <input type="color" className="se-color" value={m.highlightColor} onChange={e => setMsg(i, { highlightColor: e.target.value })} />
                      )}
                    </div>
                    <div className="se-msg-row se-msg-opts">
                      {m.link && (
                        <label className="vg-check"><input type="checkbox" checked={m.newTab} onChange={e => setMsg(i, { newTab: e.target.checked })} /> Abrir en otra pestaña</label>
                      )}
                      <button type="button" className="cd-chip" onClick={() => {
                        if (sched) { setOpenSchedule(o => ({ ...o, [i]: false })); setMsg(i, { startDate: null, endDate: null }); }
                        else setOpenSchedule(o => ({ ...o, [i]: true }));
                      }}>
                        <CalendarClock size={12} /> {sched ? 'Quitar programación' : 'Programar'}
                      </button>
                    </div>
                    {sched && (
                      <div className="se-msg-row">
                        <label className="se-date">Desde
                          <input type="datetime-local" value={toLocalInput(m.startDate)} onChange={e => setMsg(i, { startDate: fromLocalInput(e.target.value) })} />
                        </label>
                        <label className="se-date">Hasta
                          <input type="datetime-local" value={toLocalInput(m.endDate)} onChange={e => setMsg(i, { endDate: fromLocalInput(e.target.value) })} />
                        </label>
                        <span className="vg-hint se-inline-hint">
                          {st === 'scheduled' ? `Aparece ${formatDate(m.startDate)}` : m.endDate ? (st === 'ended' ? 'Ya venció' : `Se va ${formatDate(m.endDate)}`) : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="se-msg-actions">
                    <button type="button" className="cdl-btn" title="Duplicar" disabled={c.messages.length >= 12}
                      onClick={() => set({ messages: [...c.messages.slice(0, i + 1), { ...m }, ...c.messages.slice(i + 1)] })}><Copy size={14} /></button>
                    <button type="button" className="cdl-btn cdl-danger" title="Eliminar"
                      onClick={() => set({ messages: c.messages.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Animación */}
        <div className="config-section">
          <div className="section-header"><h2>Cómo se mueven</h2></div>
          <div className="cd-fields">
            {[['desktopMode', 'En computadora'], ['mobileMode', 'En celular']].map(([key, label]) => (
              <div key={key} className="vg-field">
                <label>{label}</label>
                <div className="se-seg">
                  {MODES.map(([v, t, d]) => (
                    <button key={v} type="button" className={c[key] === v ? 'active' : ''} title={d} onClick={() => set({ [key]: v })}>{t}</button>
                  ))}
                </div>
              </div>
            ))}
            {(c.desktopMode === 'rotate' || c.mobileMode === 'rotate') && (
              <div className="vg-field cd-slider">
                <label>Cambia cada · {c.rotateSeconds} s</label>
                <input type="range" min={2} max={15} value={c.rotateSeconds} onChange={e => set({ rotateSeconds: Number(e.target.value) })} />
              </div>
            )}
            {(c.desktopMode === 'marquee' || c.mobileMode === 'marquee') && (
              <div className="vg-field cd-slider">
                <label>Velocidad de la marquesina · {c.marqueeSpeed}</label>
                <input type="range" min={10} max={150} step={5} value={c.marqueeSpeed} onChange={e => set({ marqueeSpeed: Number(e.target.value) })} />
              </div>
            )}
            <div className="vg-row">
              <div className="vg-field">
                <label>Separador</label>
                <div className="se-seg">
                  {SEPARATORS.map(s => (
                    <button key={s || 'none'} type="button" className={c.separator === s ? 'active' : ''} onClick={() => set({ separator: s })}>{s || 'Nada'}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="vg-field cd-slider">
              <label>Espacio entre mensajes · {c.messageGap}px</label>
              <input type="range" min={0} max={80} value={c.messageGap} onChange={e => set({ messageGap: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="config-section">
          <div className="section-header"><h2>Dónde se muestra</h2></div>
          <div className="cd-fields">
            <div className="cd-placements">
              {PLACEMENTS.map(([v, t, d]) => (
                <button key={v} type="button" className={`cd-placement ${c.placement === v ? 'active' : ''}`} onClick={() => set({ placement: v })}>
                  <span className={`cd-placement-icon se-pi-${v}`}><i /><b /></span>
                  <strong>{t}</strong>
                  <small>{d}</small>
                </button>
              ))}
            </div>
            <label className="vg-check">
              <input type="checkbox" checked={c.sticky} onChange={e => set({ sticky: e.target.checked })} />
              Queda fija con el header al bajar (si no, se va con la página)
            </label>
            <div className="vg-row">
              <div className="vg-field cd-grow">
                <label>Mostrar en</label>
                <select value={c.visibility} onChange={e => set({ visibility: e.target.value })}>
                  <option value="both">Computadora y celular</option>
                  <option value="desktop">Solo computadora</option>
                  <option value="mobile">Solo celular</option>
                </select>
              </div>
              <div className="vg-field cd-grow">
                <label>Subrayado de links</label>
                <select value={c.linkUnderline} onChange={e => set({ linkUnderline: e.target.value })}>
                  <option value="hover">Al pasar el mouse</option>
                  <option value="always">Siempre</option>
                  <option value="never">Nunca</option>
                </select>
              </div>
            </div>
            <p className="vg-hint">Si también tenés una Cuenta Regresiva "Arriba de todo", la cuenta va primero y esta barra justo abajo.</p>
          </div>
        </div>

        {/* Diseño */}
        <div className="config-section se-span">
          <div className="section-header"><h2>Diseño</h2></div>
          <div className="se-design">
            <div className="cd-fields">
              <div className="vg-field">
                <label>Colores rápidos</label>
                <div className="cd-presets">
                  {PRESETS.map(p => (
                    <button key={p.name} type="button" className="cd-preset" onClick={() => set({ ...p, name: undefined })}>
                      <span style={{ background: p.backgroundColor }}><i style={{ background: p.textColor }} /></span>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cd-colors">
                <label className="cd-color"><input type="color" value={c.backgroundColor} onChange={e => set({ backgroundColor: e.target.value })} /><span>Fondo</span></label>
                <label className="cd-color"><input type="color" value={c.textColor} onChange={e => set({ textColor: e.target.value })} /><span>Texto</span></label>
                <label className="cd-color"><input type="color" value={c.borderColor} onChange={e => set({ borderColor: e.target.value })} /><span>Línea</span></label>
              </div>
              <div className="vg-row">
                <label className="vg-check"><input type="checkbox" checked={c.borderTop} onChange={e => set({ borderTop: e.target.checked })} /> Línea arriba</label>
                <label className="vg-check"><input type="checkbox" checked={c.borderBottom} onChange={e => set({ borderBottom: e.target.checked })} /> Línea abajo</label>
                <label className="vg-check"><input type="checkbox" checked={c.uppercase} onChange={e => set({ uppercase: e.target.checked })} /> MAYÚSCULAS</label>
              </div>
              <div className="vg-field">
                <label>Alineación</label>
                <div className="se-seg">
                  {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([v, t]) => (
                    <button key={v} type="button" className={c.alignment === v ? 'active' : ''} onClick={() => set({ alignment: v })}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cd-fields">
              <div className="vg-row">
                <div className="vg-field cd-grow">
                  <label>Tipografía</label>
                  <select value={c.font} onChange={e => set({ font: e.target.value })}>
                    {FONTS.map(f => <option key={f} value={f}>{f === 'inherit' ? 'La de la tienda' : f}</option>)}
                  </select>
                </div>
                <div className="vg-field cd-grow">
                  <label>Grosor</label>
                  <select value={c.fontWeight} onChange={e => set({ fontWeight: Number(e.target.value) })}>
                    <option value={300}>Fina</option>
                    <option value={400}>Normal</option>
                    <option value={500}>Media</option>
                    <option value={600}>Semi negrita</option>
                    <option value={700}>Negrita</option>
                    <option value={800}>Extra negrita</option>
                  </select>
                </div>
              </div>
              <div className="cd-sliders">
                <div className="vg-field cd-slider">
                  <label>Letra en compu · {c.fontSize}px</label>
                  <input type="range" min={9} max={24} value={c.fontSize} onChange={e => set({ fontSize: Number(e.target.value) })} />
                </div>
                <div className="vg-field cd-slider">
                  <label>Letra en celu · {c.mobileFontSize}px</label>
                  <input type="range" min={9} max={22} value={c.mobileFontSize} onChange={e => set({ mobileFontSize: Number(e.target.value) })} />
                </div>
                <div className="vg-field cd-slider">
                  <label>Alto de la barra · {c.padding}px</label>
                  <input type="range" min={2} max={30} value={c.padding} onChange={e => set({ padding: Number(e.target.value) })} />
                </div>
                <div className="vg-field cd-slider">
                  <label>Espaciado de letras · {c.letterSpacing}px</label>
                  <input type="range" min={0} max={4} step={0.1} value={c.letterSpacing} onChange={e => set({ letterSpacing: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
