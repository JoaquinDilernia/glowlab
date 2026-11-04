import { useMemo, useState } from 'react';
import { Monitor, Smartphone, MessageCircle, Clock } from 'lucide-react';
import { useNow } from '../../utils/countdown';
import { normalizeWhatsApp, SIZES, DAYS, prettyPhone, inHoursNow } from '../../utils/styleWhatsApp';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

const PRESETS = [
  { name: 'WhatsApp', backgroundColor: '#25d366', hoverColor: '#1ebe5b', iconColor: '#ffffff' },
  { name: 'Grafito', backgroundColor: '#353434', hoverColor: '#000000', iconColor: '#ffffff' },
  { name: 'Negro', backgroundColor: '#000000', hoverColor: '#000000', iconColor: '#ffffff' },
  { name: 'Celeste', backgroundColor: '#8aa1c4', hoverColor: '#6f88ad', iconColor: '#ffffff' },
  { name: 'Blanco', backgroundColor: '#ffffff', hoverColor: '#f2f2f2', iconColor: '#25d366' },
];

const WA_PATH = 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.83 9.83 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z';

function Preview({ c, mobile, page, now }) {
  const [hover, setHover] = useState(false);
  const px = Math.round(SIZES[c.size] * (mobile ? 0.85 : 0.8));
  const showBtn = c.enabled && inHoursNow(c.hours, now) && !(c.devices === 'desktop' && mobile) && !(c.devices === 'mobile' && !mobile);
  const showLabel = c.label && (c.labelMode === 'always' || (c.labelMode === 'desktop' && !mobile));
  const side = c.side === 'left' ? 'left' : 'right';
  const bottom = Math.min(mobile ? c.mobileOffsetY : c.offsetY, 80) * 0.8 + 6;
  const x = Math.min(mobile ? Math.min(c.offsetX, 16) : c.offsetX, 80) * 0.8 + 6;
  return (
    <div className={`cd-mock wa-mock ${mobile ? 'cd-mock-mobile' : ''}`}>
      <div className="cd-mock-header">
        <span className="cd-mock-burger" />
        <span className="cd-mock-logo">{(localStorage.getItem('promonube_store_name') || 'tu tienda').toLowerCase()}.</span>
        <span className="cd-mock-icons"><i /><i /></span>
      </div>
      {page === 'product' ? (
        <div className={`wa-product ${mobile ? 'wa-product-m' : ''}`}>
          <div className="wa-photo" />
          <div className="wa-info"><b>Silla Budapest Vino</b><span>$269.990</span><i /><i /></div>
        </div>
      ) : (
        <div className="cd-mock-body"><div /><div /><div /></div>
      )}
      {showBtn && (
        <div className="wa-float" style={{ [side]: x, bottom, flexDirection: side === 'left' ? 'row' : 'row-reverse' }}>
          {c.greeting && (
            <div className="wa-bubble" style={{ bottom: px + 10, [side]: 0 }}>{c.greeting}<span>×</span></div>
          )}
          <span
            className={`wa-btn ${c.pulse ? 'wa-pulse' : ''}`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              width: px, height: px, borderRadius: c.shape === 'rounded' ? Math.round(px * 0.3) : '50%',
              background: hover ? c.hoverColor : c.backgroundColor, '--wa-pulse': `${c.backgroundColor}88`,
            }}
          >
            <svg viewBox="0 0 24 24" width={px * 0.52} height={px * 0.52} fill={c.iconColor}><path d={WA_PATH} /></svg>
          </span>
          {showLabel && <span className="wa-label">{c.label}</span>}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppEditor({ value, onChange }) {
  const c = useMemo(() => normalizeWhatsApp(value), [value]);
  const now = useNow();
  const [device, setDevice] = useState('desktop');
  const [page, setPage] = useState('product');
  const mobile = device === 'mobile';
  const set = (patch) => onChange({ ...c, ...patch });
  const setHours = (patch) => set({ hours: { ...c.hours, ...patch } });
  const open = inHoursNow(c.hours, now);

  const exampleMsg = (c.productMessage || c.message || '').replace(/\{producto\}/gi, 'Silla Budapest Vino').replace(/\{url\}/gi, 'altorancho.com/productos/…');

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><MessageCircle size={20} /></div>
          <div>
            <h2>WhatsApp</h2>
            <p>Botón flotante para que te escriban. Mensaje armado con el producto que están mirando, saludo, horario de atención y diseño a medida.</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activo' : 'Apagado'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="cd-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${!c.enabled ? 'muted' : open ? 'ok' : 'warn'}`}>
            {!c.enabled ? 'Apagado: queda el botón de tu plantilla como está.' : open ? 'Activo: el botón se ve ahora.' : 'Fuera de horario: ahora no se muestra.'}
          </span>
          <div className="wa-toolbar-right">
            <div className="se-seg">
              <button type="button" className={page === 'product' ? 'active' : ''} onClick={() => setPage('product')}>Producto</button>
              <button type="button" className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>Inicio</button>
            </div>
            <div className="cd-device">
              <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
              <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
            </div>
          </div>
        </div>
        <Preview c={c} mobile={mobile} page={page} now={now} />
      </div>

      <div className="se-grid">
        {/* Numero y mensaje */}
        <div className="config-section">
          <div className="section-header"><h2>Número y mensaje</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Número de WhatsApp</label>
              <input type="text" value={c.phone} placeholder="Vacío = el de tu plantilla" onChange={e => set({ phone: e.target.value })} />
              <p className="vg-hint se-fhint">{c.phone ? `Se abre ${prettyPhone(c.phone)}. Con código de país y sin 0 ni 15 (ej: 54 9 11 3144-0631).` : 'Si lo dejás vacío usamos el número que ya tiene tu tienda.'}</p>
            </div>
            <div className="vg-field">
              <label>Mensaje desde un producto</label>
              <input type="text" maxLength={300} value={c.productMessage} placeholder="Hola! Quiero consultar por {producto}" onChange={e => set({ productMessage: e.target.value })} />
              <p className="vg-hint se-fhint">{'{producto}'} se cambia por el nombre del producto que están mirando.</p>
            </div>
            <div className="vg-field">
              <label>Mensaje en el resto de la tienda</label>
              <input type="text" maxLength={300} value={c.message} placeholder="Hola! Tengo una consulta" onChange={e => set({ message: e.target.value })} />
            </div>
            {exampleMsg && <div className="wa-example"><span>Así le llega a tu WhatsApp:</span>{exampleMsg}</div>}
          </div>
        </div>

        {/* Etiqueta y saludo */}
        <div className="config-section">
          <div className="section-header"><h2>Etiqueta y saludo</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Etiqueta al lado del botón</label>
              <input type="text" maxLength={40} value={c.label} placeholder="Ej: ¿Te ayudamos?" onChange={e => set({ label: e.target.value })} />
            </div>
            {c.label && (
              <div className="se-seg">
                {[['desktop', 'Solo en compu'], ['always', 'Siempre'], ['none', 'Nunca']].map(([v, t]) => (
                  <button key={v} type="button" className={c.labelMode === v ? 'active' : ''} onClick={() => set({ labelMode: v })}>{t}</button>
                ))}
              </div>
            )}
            <div className="vg-field">
              <label>Globito de saludo</label>
              <input type="text" maxLength={140} value={c.greeting} placeholder="Ej: ¡Hola! ¿Buscás algo en especial? Escribinos." onChange={e => set({ greeting: e.target.value })} />
              <p className="vg-hint se-fhint">Aparece una vez por visita; si lo cierran no vuelve.</p>
            </div>
            {c.greeting && (
              <div className="vg-field cd-slider">
                <label>Aparece a los · {c.greetingDelay} s</label>
                <input type="range" min={0} max={60} value={c.greetingDelay} onChange={e => set({ greetingDelay: Number(e.target.value) })} />
              </div>
            )}
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
                  <button key={p.name} type="button" className="cd-preset" onClick={() => set({ backgroundColor: p.backgroundColor, hoverColor: p.hoverColor, iconColor: p.iconColor })}>
                    <span style={{ background: p.backgroundColor }}><i style={{ background: p.iconColor }} /></span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="cd-colors">
              <label className="cd-color"><input type="color" value={c.backgroundColor} onChange={e => set({ backgroundColor: e.target.value })} /><span>Fondo</span></label>
              <label className="cd-color"><input type="color" value={c.hoverColor} onChange={e => set({ hoverColor: e.target.value })} /><span>Al pasar el mouse</span></label>
              <label className="cd-color"><input type="color" value={c.iconColor} onChange={e => set({ iconColor: e.target.value })} /><span>Ícono</span></label>
            </div>
            <div className="vg-row">
              <div className="vg-field">
                <label>Tamaño</label>
                <div className="se-seg">
                  {[['sm', 'Chico'], ['md', 'Mediano'], ['lg', 'Grande']].map(([v, t]) => (
                    <button key={v} type="button" className={c.size === v ? 'active' : ''} onClick={() => set({ size: v })}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="vg-field">
                <label>Forma</label>
                <div className="se-seg">
                  {[['circle', 'Círculo'], ['rounded', 'Redondeado']].map(([v, t]) => (
                    <button key={v} type="button" className={c.shape === v ? 'active' : ''} onClick={() => set({ shape: v })}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <label className="vg-check"><input type="checkbox" checked={c.pulse} onChange={e => set({ pulse: e.target.checked })} /> Latido suave para llamar la atención</label>
          </div>
        </div>

        {/* Ubicacion */}
        <div className="config-section">
          <div className="section-header"><h2>Ubicación</h2></div>
          <div className="cd-fields">
            <div className="vg-row">
              <div className="vg-field">
                <label>Lado</label>
                <div className="se-seg">
                  {[['left', 'Izquierda'], ['right', 'Derecha']].map(([v, t]) => (
                    <button key={v} type="button" className={c.side === v ? 'active' : ''} onClick={() => set({ side: v })}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="vg-field">
                <label>Mostrar en</label>
                <div className="se-seg">
                  {[['both', 'Compu y celu'], ['desktop', 'Compu'], ['mobile', 'Celu']].map(([v, t]) => (
                    <button key={v} type="button" className={c.devices === v ? 'active' : ''} onClick={() => set({ devices: v })}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cd-sliders">
              <div className="vg-field cd-slider">
                <label>Separación del costado · {c.offsetX}px</label>
                <input type="range" min={0} max={80} value={c.offsetX} onChange={e => set({ offsetX: Number(e.target.value) })} />
              </div>
              <div className="vg-field cd-slider">
                <label>Altura en compu · {c.offsetY}px</label>
                <input type="range" min={0} max={200} value={c.offsetY} onChange={e => set({ offsetY: Number(e.target.value) })} />
              </div>
              <div className="vg-field cd-slider">
                <label>Altura en celu · {c.mobileOffsetY}px</label>
                <input type="range" min={0} max={200} value={c.mobileOffsetY} onChange={e => set({ mobileOffsetY: Number(e.target.value) })} />
              </div>
            </div>
            <p className="vg-hint">Si en celular tapa el botón "Comprar" fijo de abajo, subile la altura en celu.</p>
          </div>
        </div>

        {/* Horario */}
        <div className="config-section se-span">
          <div className="section-header">
            <h2><Clock size={16} /> Horario de atención</h2>
            <label className="toggle-switch">
              <input type="checkbox" checked={c.hours.enabled} onChange={e => setHours({ enabled: e.target.checked })} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          {!c.hours.enabled && <p className="vg-hint">Apagado: el botón se ve siempre.</p>}
          {c.hours.enabled && (
            <div className="wa-hours">
              <div className="se-seg">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" className={c.hours.days.includes(i) ? 'active' : ''}
                    onClick={() => setHours({ days: c.hours.days.includes(i) ? c.hours.days.filter(x => x !== i) : [...c.hours.days, i].sort() })}>{d}</button>
                ))}
              </div>
              <label className="se-date">De <input type="time" value={c.hours.from} onChange={e => setHours({ from: e.target.value })} /></label>
              <label className="se-date">a <input type="time" value={c.hours.to} onChange={e => setHours({ to: e.target.value })} /></label>
              <span className="vg-hint se-inline-hint">Hora de Argentina. Fuera de ese horario el botón no aparece.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
