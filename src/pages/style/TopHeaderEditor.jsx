import { useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, PanelTop } from 'lucide-react';
import { apiRequest } from '../../config';
import { loadFont } from '../../utils/countdown';
import { normalizeTopHeader, ITEM_DEFAULTS, FONTS, SEPARATORS, currentIndex, hostOf } from '../../utils/styleTopHeader';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

const PRESETS = [
  { name: 'Gris claro', backgroundColor: '#fafafa', textColor: '#353434', accentColor: '#353434', borderColor: '#e6e6e6', borderBottom: true },
  { name: 'Blanco', backgroundColor: '#ffffff', textColor: '#353434', accentColor: '#8aa1c4', borderColor: '#e6e6e6', borderBottom: true },
  { name: 'Grafito', backgroundColor: '#353434', textColor: '#ffffff', accentColor: '#ffffff', borderColor: '#353434', borderBottom: false },
  { name: 'Celeste', backgroundColor: '#8aa1c4', textColor: '#ffffff', accentColor: '#ffffff', borderColor: '#8aa1c4', borderBottom: false },
  { name: 'Negro', backgroundColor: '#111111', textColor: '#ffffff', accentColor: '#ffffff', borderColor: '#111111', borderBottom: false },
];

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end', 'space-between': 'space-between' };

function Bar({ c, mobile, cur }) {
  const items = c.items.map((it, i) => ({ ...it, i })).filter(it => !it.hidden && it.text && !(it.devices === 'desktop' && mobile) && !(it.devices === 'mobile' && !mobile));
  if (mobile && c.mobileMode === 'hide') return null;
  const scale = mobile ? 1 : 0.92;
  const group = (list) => (
    <div className="th-group">
      {list.map((it, k) => (
        <span key={it.i} className="th-cell">
          {k > 0 && c.separator && <span className="th-sep">{c.separator}</span>}
          <span
            className={`th-item ${it.i === cur ? `th-cur th-${c.currentStyle}` : ''}`}
            style={it.i === cur ? (c.currentStyle === 'pill' ? { background: c.accentColor, color: c.backgroundColor } : { color: c.accentColor }) : undefined}
          >
            {it.icon && <span>{it.icon}</span>}{it.text}
          </span>
        </span>
      ))}
    </div>
  );
  const left = items.filter(i => i.side !== 'right');
  const right = items.filter(i => i.side === 'right');
  return (
    <div
      className={`th-bar ${mobile ? 'th-bar-m' : ''}`}
      style={{
        background: c.backgroundColor, color: c.textColor,
        fontSize: Math.round((mobile ? c.mobileFontSize : c.fontSize) * scale),
        padding: `${c.padding}px ${mobile ? 12 : 20}px`,
        borderBottom: c.borderBottom ? `1px solid ${c.borderColor}` : 'none',
        fontFamily: c.font !== 'inherit' ? `'${c.font}', sans-serif` : undefined,
        textTransform: c.uppercase ? 'uppercase' : 'none', letterSpacing: c.letterSpacing,
      }}
    >
      <div className="th-row" style={{ justifyContent: mobile ? 'flex-start' : JUSTIFY[c.alignment] }}>
        {c.alignment === 'space-between' && !mobile ? <>{group(left)}{right.length > 0 && group(right)}</> : group([...left, ...right])}
      </div>
    </div>
  );
}

function Preview({ c, mobile, cur }) {
  return (
    <div className={`cd-mock th-mock ${mobile ? 'cd-mock-mobile' : ''}`}>
      {c.enabled && <Bar c={c} mobile={mobile} cur={cur} />}
      <div className="cd-mock-header">
        <span className="cd-mock-burger" />
        <span className="cd-mock-logo">{(localStorage.getItem('promonube_store_name') || 'tu tienda').toLowerCase()}.</span>
        <span className="cd-mock-icons"><i /><i /></span>
      </div>
      {!mobile && <div className="se-mock-nav"><span>Categorías</span><span>Sillas</span><span>Muebles</span><span>Iluminación</span><span>Locales</span></div>}
      <div className="cd-mock-body"><div /><div /><div /></div>
    </div>
  );
}

export default function TopHeaderEditor({ value, onChange }) {
  const c = useMemo(() => normalizeTopHeader(value), [value]);
  const [device, setDevice] = useState('desktop');
  const [host, setHost] = useState('');
  const mobile = device === 'mobile';

  useEffect(() => { if (c.font !== 'inherit') loadFont(c.font); }, [c.font]);
  useEffect(() => {
    const storeId = localStorage.getItem('promonube_store_id');
    apiRequest(`/api/style/menu-tree?storeId=${storeId}`).then(r => setHost(r.url ? hostOf(r.url) : '')).catch(() => {});
  }, []);

  const set = (patch) => onChange({ ...c, ...patch });
  const setItem = (i, patch) => set({ items: c.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const move = (i, d) => {
    const list = [...c.items];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    set({ items: list });
  };
  const cur = currentIndex(c, host);
  const visible = c.items.filter(i => !i.hidden && i.text).length;

  const status = !c.enabled ? ['muted', 'Apagada: tu tienda queda como está.']
    : visible ? ['ok', `Activa: ${visible} link${visible === 1 ? '' : 's'} arriba de todo.`]
    : ['warn', 'Activa, pero no tiene links para mostrar.'];

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><PanelTop size={20} /></div>
          <div>
            <h2>Barra de encabezado</h2>
            <p>Franja finita arriba de todo con links a tus otros sitios (mayorista, decoradoras, prensa). Marca sola en cuál estás.</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activa' : 'Apagada'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="cd-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${status[0]}`}>{status[1]}</span>
          <div className="cd-device">
            <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
            <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
          </div>
        </div>
        <Preview c={c} mobile={mobile} cur={cur} />
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>Links</h2>
          {c.items.length < 12 && (
            <button type="button" className="cd-chip" onClick={() => set({ items: [...c.items, { ...ITEM_DEFAULTS }] })}><Plus size={13} /> Agregar link</button>
          )}
        </div>
        {!c.items.length && <p className="vg-hint">Todavía no hay links. Agregá el primero (ej: "altomayorista." → https://loginmayorista.altorancho.com).</p>}
        <div className="se-messages">
          {c.items.map((it, i) => (
            <div key={i} className={`se-msg ${it.hidden ? 'th-hidden' : ''}`}>
              <div className="se-msg-order">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={15} /></button>
                <span>{i + 1}</span>
                <button type="button" disabled={i === c.items.length - 1} onClick={() => move(i, 1)}><ChevronDown size={15} /></button>
              </div>
              <div className="se-msg-body">
                <div className="se-msg-row">
                  <input type="text" className="se-emoji" maxLength={8} value={it.icon} placeholder="🙂" onChange={e => setItem(i, { icon: e.target.value })} />
                  <input type="text" className="se-grow" maxLength={60} value={it.text} placeholder="Texto (ej: altomayorista.)" onChange={e => setItem(i, { text: e.target.value })} />
                  <input type="text" className="se-grow" value={it.link} placeholder="https://… o /pagina" onChange={e => setItem(i, { link: e.target.value })} />
                </div>
                <div className="se-msg-row se-msg-opts">
                  <label className="vg-check"><input type="checkbox" checked={it.current} onChange={e => set({ items: c.items.map((x, j) => ({ ...x, current: j === i ? e.target.checked : false })) })} /> Marcar como "estás acá"</label>
                  <label className="vg-check"><input type="checkbox" checked={it.newTab} onChange={e => setItem(i, { newTab: e.target.checked })} /> Pestaña nueva</label>
                  <div className="se-seg">
                    {[['both', 'Compu y celu'], ['desktop', 'Compu'], ['mobile', 'Celu']].map(([v, t]) => (
                      <button key={v} type="button" className={it.devices === v ? 'active' : ''} onClick={() => setItem(i, { devices: v })}>{t}</button>
                    ))}
                  </div>
                  {c.alignment === 'space-between' && (
                    <div className="se-seg">
                      {[['left', 'Izq.'], ['right', 'Der.']].map(([v, t]) => (
                        <button key={v} type="button" className={it.side === v ? 'active' : ''} onClick={() => setItem(i, { side: v })}>{t}</button>
                      ))}
                    </div>
                  )}
                  {i === cur && !it.current && <span className="cd-chip th-auto">Estás acá (automático)</span>}
                </div>
              </div>
              <div className="se-msg-actions">
                <button type="button" className="cd-chip" title={it.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => setItem(i, { hidden: !it.hidden })}>{it.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                <button type="button" className="cd-chip" title="Quitar" onClick={() => set({ items: c.items.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
        <label className="vg-check th-autocheck">
          <input type="checkbox" checked={c.autoCurrent} onChange={e => set({ autoCurrent: e.target.checked })} />
          Marcar solo el link del sitio donde está el cliente{host ? ` (acá: ${host})` : ''}
        </label>
      </div>

      <div className="se-grid">
        <div className="config-section">
          <div className="section-header"><h2>Diseño</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Colores rápidos</label>
              <div className="cd-presets">
                {PRESETS.map(p => (
                  <button key={p.name} type="button" className="cd-preset" onClick={() => set({ backgroundColor: p.backgroundColor, textColor: p.textColor, accentColor: p.accentColor, borderColor: p.borderColor, borderBottom: p.borderBottom })}>
                    <span style={{ background: p.backgroundColor }}><i style={{ background: p.textColor }} /></span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="cd-colors">
              <label className="cd-color"><input type="color" value={c.backgroundColor} onChange={e => set({ backgroundColor: e.target.value })} /><span>Fondo</span></label>
              <label className="cd-color"><input type="color" value={c.textColor} onChange={e => set({ textColor: e.target.value })} /><span>Texto</span></label>
              <label className="cd-color"><input type="color" value={c.accentColor} onChange={e => set({ accentColor: e.target.value })} /><span>"Estás acá"</span></label>
              {c.borderBottom && <label className="cd-color"><input type="color" value={c.borderColor} onChange={e => set({ borderColor: e.target.value })} /><span>Línea</span></label>}
            </div>
            <div className="vg-field">
              <label>"Estás acá" se ve</label>
              <div className="se-seg">
                {[['bold', 'Negrita'], ['underline', 'Subrayado'], ['pill', 'Pastilla']].map(([v, t]) => (
                  <button key={v} type="button" className={c.currentStyle === v ? 'active' : ''} onClick={() => set({ currentStyle: v })}>{t}</button>
                ))}
              </div>
            </div>
            <div className="vg-row">
              <div className="vg-field">
                <label>Separador</label>
                <div className="se-seg">
                  {SEPARATORS.map(s => (
                    <button key={s || 'none'} type="button" className={c.separator === s ? 'active' : ''} onClick={() => set({ separator: s })}>{s || 'Ninguno'}</button>
                  ))}
                </div>
              </div>
              <div className="vg-field">
                <label>Fuente</label>
                <select value={c.font} onChange={e => set({ font: e.target.value })}>
                  {FONTS.map(f => <option key={f} value={f}>{f === 'inherit' ? 'La de tu tienda' : f}</option>)}
                </select>
              </div>
            </div>
            <div className="vg-row">
              <label className="vg-check"><input type="checkbox" checked={c.borderBottom} onChange={e => set({ borderBottom: e.target.checked })} /> Línea abajo</label>
              <label className="vg-check"><input type="checkbox" checked={c.uppercase} onChange={e => set({ uppercase: e.target.checked })} /> Mayúsculas</label>
            </div>
            <div className="cd-sliders">
              <div className="vg-field cd-slider">
                <label>Letra en compu · {c.fontSize}px</label>
                <input type="range" min={10} max={16} value={c.fontSize} onChange={e => set({ fontSize: Number(e.target.value) })} />
              </div>
              <div className="vg-field cd-slider">
                <label>Letra en celu · {c.mobileFontSize}px</label>
                <input type="range" min={9} max={15} value={c.mobileFontSize} onChange={e => set({ mobileFontSize: Number(e.target.value) })} />
              </div>
              <div className="vg-field cd-slider">
                <label>Alto · {c.padding}px arriba y abajo</label>
                <input type="range" min={3} max={16} value={c.padding} onChange={e => set({ padding: Number(e.target.value) })} />
              </div>
              <div className="vg-field cd-slider">
                <label>Espaciado de letras · {c.letterSpacing}px</label>
                <input type="range" min={0} max={3} step={0.1} value={c.letterSpacing} onChange={e => set({ letterSpacing: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        </div>

        <div className="config-section">
          <div className="section-header"><h2>Ubicación</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Alineación</label>
              <div className="se-seg">
                {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha'], ['space-between', 'A los costados']].map(([v, t]) => (
                  <button key={v} type="button" className={c.alignment === v ? 'active' : ''} onClick={() => set({ alignment: v })}>{t}</button>
                ))}
              </div>
              {c.alignment === 'space-between' && <p className="vg-hint se-fhint">Elegí en cada link si va a la izquierda o a la derecha.</p>}
            </div>
            <div className="vg-field">
              <label>Dónde va</label>
              <div className="se-seg">
                {[['top', 'Arriba de todo'], ['above-logo', 'Arriba del logo']].map(([v, t]) => (
                  <button key={v} type="button" className={c.placement === v ? 'active' : ''} onClick={() => set({ placement: v })}>{t}</button>
                ))}
              </div>
            </div>
            <label className="vg-check"><input type="checkbox" checked={c.sticky} onChange={e => set({ sticky: e.target.checked })} /> Que siga visible al bajar (header fijo)</label>
            <div className="vg-field">
              <label>En celular</label>
              <div className="se-seg">
                {[['scroll', 'Se desliza de costado'], ['hide', 'No mostrar']].map(([v, t]) => (
                  <button key={v} type="button" className={c.mobileMode === v ? 'active' : ''} onClick={() => set({ mobileMode: v })}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
