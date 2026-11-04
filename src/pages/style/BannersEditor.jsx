import { useEffect, useMemo, useState } from 'react';
import { Monitor, Smartphone, Image as ImageIcon, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { apiRequest } from '../../config';
import { normalizeBanners, ITEM_DEFAULTS, BUTTON_DEFAULTS, POSITIONS, SIZE, hasContent, placeStyle, buttonStyle } from '../../utils/styleBanners';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

const BTN_PRESETS = [
  { name: 'Blanco', bg: '#ffffff', color: '#353434' },
  { name: 'Grafito', bg: '#353434', color: '#ffffff' },
  { name: 'Celeste', bg: '#8aa1c4', color: '#ffffff' },
  { name: 'Negro', bg: '#000000', color: '#ffffff' },
];

const shortPath = (url) => { try { return decodeURI(new URL(url).pathname); } catch { return url || ''; } };

function Overlay({ it, mobile, scale }) {
  const z = SIZE[it.size] || SIZE.md;
  const pos = mobile && it.mobilePosition !== 'same' ? it.mobilePosition : it.position;
  const titleSize = Math.round(z[0] * (mobile ? 0.75 : 1) * scale);
  const boxAlign = it.align === 'left' ? 'flex-start' : it.align === 'right' ? 'flex-end' : 'center';
  return (
    <div className="bn-ov" style={{ ...placeStyle(pos), color: it.textColor, textAlign: it.align, background: it.overlay ? `rgba(0,0,0,${it.overlay / 100})` : 'none', padding: Math.round((mobile ? 16 : 40) * scale) }}>
      <div className="bn-ov-box" style={{ alignItems: boxAlign }}>
        {it.title && <h3 style={{ fontSize: titleSize, textTransform: it.uppercase ? 'uppercase' : 'none' }}>{it.title}</h3>}
        {it.subtitle && <p style={{ fontSize: Math.round(z[1] * scale) }}>{it.subtitle}</p>}
        {it.buttons.some(b => b.text) && (
          <div className="bn-ov-btns" style={{ justifyContent: boxAlign }}>
            {it.buttons.filter(b => b.text).map((b, i) => <span key={i} className="bn-ov-btn" style={buttonStyle(b, it, scale)}>{b.text}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function PosGrid({ value, onChange, allowSame }) {
  return (
    <div className="bn-posrow">
      <div className="bn-pos">
        {POSITIONS.map(p => (
          <button key={p} type="button" title={p} className={value === p ? 'active' : ''} onClick={() => onChange(p)}><i /></button>
        ))}
      </div>
      {allowSame && (
        <button type="button" className={`cd-chip ${value === 'same' ? 'active' : ''}`} onClick={() => onChange('same')}>Igual que en compu</button>
      )}
    </div>
  );
}

export default function BannersEditor({ value, onChange }) {
  const c = useMemo(() => normalizeBanners(value), [value]);
  const [home, setHome] = useState({ loading: true, banners: [], message: '' });
  const [picked, setPicked] = useState(null);
  const [device, setDevice] = useState('desktop');
  const [manualId, setManualId] = useState('');
  const mobile = device === 'mobile';

  const fetchHome = async (fresh) => {
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const res = await apiRequest(`/api/style/home-banners?storeId=${storeId}${fresh ? `&t=${Date.now()}` : ''}`);
      return { loading: false, banners: res.banners || [], message: res.success ? (res.message || '') : (res.message || 'No se pudieron leer los banners') };
    } catch {
      return { loading: false, banners: [], message: 'No se pudieron leer los banners de la tienda' };
    }
  };
  const load = (fresh) => { setHome(h => ({ ...h, loading: true })); fetchHome(fresh).then(setHome); };
  useEffect(() => { fetchHome().then(setHome); }, []);

  // Lista: banners de la home + los configurados que ya no estan en la home
  const list = useMemo(() => {
    const rows = home.banners.map((b, i) => ({ ...b, n: i + 1 }));
    c.items.forEach(it => { if (!rows.some(r => r.blockId === it.blockId)) rows.push({ blockId: it.blockId, thumb: it.thumb, link: '', missing: true }); });
    return rows;
  }, [home.banners, c.items]);

  // Sin eleccion: el primero con contenido, o el primero de la home
  const selected = picked || (c.items.find(hasContent) || list[0])?.blockId || null;
  const setSelected = setPicked;
  const row = list.find(r => r.blockId === selected);
  const idx = c.items.findIndex(i => i.blockId === selected);
  const it = idx >= 0 ? c.items[idx] : { ...ITEM_DEFAULTS, blockId: selected || '', thumb: row?.thumb || '' };

  const set = (patch) => onChange({ ...c, ...patch });
  const setItem = (patch) => {
    const next = { ...it, ...patch, thumb: row?.thumb || it.thumb };
    const items = idx >= 0 ? c.items.map((x, i) => (i === idx ? next : x)) : [...c.items, next];
    set({ items });
  };
  const removeItem = () => set({ items: c.items.filter((_, i) => i !== idx) });
  const setBtn = (bi, patch) => setItem({ buttons: it.buttons.map((b, i) => (i === bi ? { ...b, ...patch } : b)) });
  const addBtn = () => setItem({ buttons: [...it.buttons, { ...BUTTON_DEFAULTS, text: it.buttons.length ? 'Ver más' : 'Comprar', url: row?.link ? shortPath(row.link) : '' }] });

  const active = c.items.filter(i => i.enabled && hasContent(i)).length;
  const status = !c.enabled ? ['muted', 'Apagado: los banners de tu tienda quedan como están.']
    : active ? ['ok', `Activo: ${active} banner${active === 1 ? '' : 's'} con texto o botones.`]
    : ['warn', 'Activo, pero ningún banner tiene texto ni botones todavía.'];

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><ImageIcon size={20} /></div>
          <div>
            <h2>Banners</h2>
            <p>Sumale título, bajada y botones a los banners de tu inicio, sin tocar las imágenes. Elegí el banner, escribí y mirá cómo queda.</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activo' : 'Apagado'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>Banners de tu inicio</h2>
          <button type="button" className="cd-chip" onClick={() => load(true)} disabled={home.loading}><RefreshCw size={13} /> Actualizar</button>
        </div>
        {home.loading && !list.length && <p className="vg-hint">Leyendo los banners de tu tienda…</p>}
        {!home.loading && home.message && <p className="vg-hint">{home.message}</p>}
        {list.length > 0 && (
          <div className="bn-grid">
            {list.map(r => {
              const cfg = c.items.find(i => i.blockId === r.blockId);
              const on = cfg && cfg.enabled && hasContent(cfg);
              return (
                <button key={r.blockId} type="button" className={`bn-thumb ${selected === r.blockId ? 'active' : ''}`} onClick={() => setSelected(r.blockId)}>
                  {r.thumb ? <img src={r.thumb} alt="" loading="lazy" /> : <span className="bn-thumb-empty"><ImageIcon size={18} /></span>}
                  <span className="bn-thumb-meta">
                    <b>{r.missing ? 'Ya no está en el inicio' : `#${r.n}`}</b>
                    {on && <span className="bn-dot" title="Tiene texto o botones" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {!home.loading && !list.length && (
          <div className="bn-manual">
            <input type="text" value={manualId} placeholder="Id del bloque (ej: banner_jyhz)" onChange={e => setManualId(e.target.value.trim())} />
            <button type="button" className="cd-chip" disabled={!manualId} onClick={() => { setSelected(manualId); setManualId(''); }}><Plus size={13} /> Usar</button>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="cd-preview-card">
            <div className="cd-preview-toolbar">
              <span className={`cd-status cd-status-${status[0]}`}>{status[1]}</span>
              <div className="cd-device">
                <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
                <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
              </div>
            </div>
            <div className={`bn-stage ${mobile ? 'bn-stage-m' : ''}`}>
              <div className="bn-frame">
                {(row?.thumb || it.thumb) ? <img src={row?.thumb || it.thumb} alt="" /> : <div className="bn-noimg" />}
                {it.enabled && <Overlay it={it} mobile={mobile} scale={mobile ? 0.8 : 0.85} />}
              </div>
            </div>
            {row?.link && (
              <p className="vg-hint bn-link">Este banner lleva a <a href={row.link} target="_blank" rel="noreferrer">{shortPath(row.link)} <ExternalLink size={11} /></a></p>
            )}
          </div>

          <div className="se-grid">
            <div className="config-section">
              <div className="section-header">
                <h2>Texto</h2>
                {idx >= 0 && (
                  <label className="vg-check bn-onoff"><input type="checkbox" checked={it.enabled} onChange={e => setItem({ enabled: e.target.checked })} /> Mostrar en este banner</label>
                )}
              </div>
              <div className="cd-fields">
                <div className="vg-field">
                  <label>Título</label>
                  <input type="text" maxLength={80} value={it.title} placeholder="Ej: Alto Cyber" onChange={e => setItem({ title: e.target.value })} />
                </div>
                <div className="vg-field">
                  <label>Bajada</label>
                  <input type="text" maxLength={160} value={it.subtitle} placeholder="Ej: Hasta 50% OFF en sillas" onChange={e => setItem({ subtitle: e.target.value })} />
                </div>
                <div className="vg-row">
                  <label className="cd-color"><input type="color" value={it.textColor} onChange={e => setItem({ textColor: e.target.value })} /><span>Color del texto</span></label>
                  <label className="vg-check"><input type="checkbox" checked={it.uppercase} onChange={e => setItem({ uppercase: e.target.checked })} /> Título en mayúsculas</label>
                </div>
                <div className="vg-field">
                  <label>Tamaño</label>
                  <div className="se-seg">
                    {[['sm', 'Chico'], ['md', 'Mediano'], ['lg', 'Grande']].map(([v, t]) => (
                      <button key={v} type="button" className={it.size === v ? 'active' : ''} onClick={() => setItem({ size: v })}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="config-section">
              <div className="section-header"><h2>Ubicación</h2></div>
              <div className="cd-fields">
                <div className="vg-row">
                  <div className="vg-field">
                    <label>En compu</label>
                    <PosGrid value={it.position} onChange={v => setItem({ position: v })} />
                  </div>
                  <div className="vg-field">
                    <label>En celu</label>
                    <PosGrid value={it.mobilePosition} onChange={v => setItem({ mobilePosition: v })} allowSame />
                  </div>
                </div>
                <div className="vg-field">
                  <label>Alineación del texto</label>
                  <div className="se-seg">
                    {[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([v, t]) => (
                      <button key={v} type="button" className={it.align === v ? 'active' : ''} onClick={() => setItem({ align: v })}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="vg-field cd-slider">
                  <label>Oscurecer la imagen · {it.overlay}%</label>
                  <input type="range" min={0} max={70} value={it.overlay} onChange={e => setItem({ overlay: Number(e.target.value) })} />
                </div>
                <p className="vg-hint se-fhint">Si la foto es clara y el texto no se lee, oscurecela un poco.</p>
              </div>
            </div>

            <div className="config-section se-span">
              <div className="section-header">
                <h2>Botones</h2>
                {it.buttons.length < 3 && <button type="button" className="cd-chip" onClick={addBtn}><Plus size={13} /> Agregar botón</button>}
              </div>
              {!it.buttons.length && <p className="vg-hint">Sin botones: el banner sigue llevando a donde ya llevaba.</p>}
              <div className="se-messages">
                {it.buttons.map((b, bi) => (
                  <div key={bi} className="se-msg bn-btn-row">
                    <div className="se-msg-body">
                      <div className="se-msg-row">
                        <input type="text" className="se-grow" maxLength={40} value={b.text} placeholder="Texto del botón" onChange={e => setBtn(bi, { text: e.target.value })} />
                        <input type="text" className="se-grow" value={b.url} placeholder="/sillas o https://…" onChange={e => setBtn(bi, { url: e.target.value })} />
                      </div>
                      <div className="se-msg-row se-msg-opts">
                        <div className="se-seg">
                          {[['solid', 'Relleno'], ['outline', 'Borde'], ['link', 'Link']].map(([v, t]) => (
                            <button key={v} type="button" className={b.style === v ? 'active' : ''} onClick={() => setBtn(bi, { style: v })}>{t}</button>
                          ))}
                        </div>
                        {BTN_PRESETS.map(p => (
                          <button key={p.name} type="button" className="cd-preset" title={p.name} onClick={() => setBtn(bi, { bg: p.bg, color: p.color })}>
                            <span style={{ background: p.bg }}><i style={{ background: p.color }} /></span>
                          </button>
                        ))}
                        <input type="color" className="se-color" title={b.style === 'solid' ? 'Fondo' : 'Color'} value={b.bg} onChange={e => setBtn(bi, { bg: e.target.value })} />
                        {b.style === 'solid' && <input type="color" className="se-color" title="Texto" value={b.color} onChange={e => setBtn(bi, { color: e.target.value })} />}
                        <label className="vg-check"><input type="checkbox" checked={b.newTab} onChange={e => setBtn(bi, { newTab: e.target.checked })} /> Pestaña nueva</label>
                      </div>
                    </div>
                    <div className="se-msg-actions">
                      <button type="button" className="cd-chip" title="Quitar" onClick={() => setItem({ buttons: it.buttons.filter((_, i) => i !== bi) })}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {it.buttons.length > 0 && (
                <div className="vg-field cd-slider bn-radius">
                  <label>Redondeo de los botones · {it.radius}px</label>
                  <input type="range" min={0} max={40} value={it.radius} onChange={e => setItem({ radius: Number(e.target.value) })} />
                </div>
              )}
            </div>
          </div>

          {idx >= 0 && (
            <div className="bn-foot">
              <button type="button" className="cd-chip" onClick={removeItem}><Trash2 size={13} /> Quitar todo de este banner</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
