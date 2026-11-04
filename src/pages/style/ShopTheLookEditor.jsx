import { useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Smartphone, Plus, Trash2, Upload, Search, X, ShoppingBag, Move } from 'lucide-react';
import { apiRequest } from '../../config';
import { normalizeShopTheLook, newLook, sectionLabel, productSnapshot } from '../../utils/styleShopTheLook';
import '../VariantGroupsConfig.css';
import '../CountdownConfig.css';
import './StyleEditors.css';

const dotText = (c, h, i) => h.label || (c.dotStyle === 'number' ? String(i + 1) : c.dotStyle === 'plus' ? '+' : '');

async function uploadImage(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera 5MB');
  const fileData = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });
  const res = await apiRequest('/api/upload-image-base64', {
    method: 'POST',
    body: JSON.stringify({ storeId: localStorage.getItem('promonube_store_id'), fileName: file.name, fileData, folder: 'shop-the-look' }),
  });
  if (!res.success) throw new Error(res.message || 'No se pudo subir');
  return res.url;
}

function ProductPicker({ onPick, onClose }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState({ loading: false, items: [] });
  useEffect(() => {
    if (q.trim().length < 2) return undefined;
    const t = setTimeout(async () => {
      setState(s => ({ ...s, loading: true }));
      try {
        const storeId = localStorage.getItem('promonube_store_id');
        const r = await apiRequest(`/api/tiendanube/products/search?storeId=${storeId}&q=${encodeURIComponent(q.trim())}`);
        setState({ loading: false, items: Array.isArray(r) ? r : r.products || [] });
      } catch {
        setState({ loading: false, items: [] });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const items = q.trim().length < 2 ? [] : state.items;
  return (
    <div className="stl-modal-bg" onClick={onClose}>
      <div className="stl-modal" onClick={e => e.stopPropagation()}>
        <div className="stl-modal-head">
          <b>Elegí el producto</b>
          <button type="button" className="cd-chip" onClick={onClose}><X size={14} /></button>
        </div>
        <label className="stl-search"><Search size={15} /><input autoFocus type="text" value={q} placeholder="Buscá por nombre o SKU" onChange={e => setQ(e.target.value)} /></label>
        <div className="stl-results">
          {state.loading && <p className="vg-hint">Buscando…</p>}
          {!state.loading && q.trim().length >= 2 && !items.length && <p className="vg-hint">No encontramos productos con "{q}".</p>}
          {items.map(p => {
            const s = productSnapshot(p);
            return (
              <button key={p.id} type="button" className="stl-result" onClick={() => onPick(s)}>
                {s.productImage ? <img src={s.productImage} alt="" /> : <span className="stl-noimg" />}
                <span><b>{s.productName}</b><small>{s.productPrice}</small></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Preview({ c, look, mobile, active, setActive }) {
  if (!look || !look.imageUrl) return <div className="stl-empty-prev">Subí la foto del look para ver cómo queda.</div>;
  const items = look.hotspots.map((h, i) => ({ ...h, i })).filter(h => h.productName);
  const split = c.layout === 'split' && items.length;
  const img = mobile && look.mobileImageUrl ? look.mobileImageUrl : look.imageUrl;
  return (
    <div className={`stl-prev ${mobile ? 'stl-prev-m' : ''}`} style={{ '--stl-accent': c.accentColor }}>
      {(c.title || c.subtitle) && (
        <div className="stl-prev-head">{c.title && <h3>{c.title}</h3>}{c.subtitle && <p>{c.subtitle}</p>}</div>
      )}
      <div className={`stl-prev-look ${split ? 'stl-prev-split' : ''} ${split && c.imageSide === 'right' ? 'stl-prev-right' : ''}`}>
        <div>
          <div className="stl-prev-media">
            <img src={img} alt="" />
            {items.map(h => (
              <span key={h.i} className={`stl-prev-dot ${c.dotStyle === 'dot' && !h.label ? 'stl-small' : ''} ${active === h.i ? 'on' : ''}`}
                style={{ left: `${h.x}%`, top: `${h.y}%`, background: c.dotColor, color: c.dotTextColor }}
                onMouseEnter={() => setActive(h.i)} onMouseLeave={() => setActive(null)}>
                {dotText(c, h, h.i)}
              </span>
            ))}
            {!split && active != null && items.find(h => h.i === active) && (() => {
              const h = items.find(x => x.i === active);
              return (
                <div className="stl-prev-card" style={{ left: `${Math.min(Math.max(h.x, 20), 80)}%`, top: `${h.y}%` }}>
                  {h.productImage && <img src={h.productImage} alt="" />}
                  <b>{h.productName}</b>
                  {c.showPrice && h.productPrice && <span>{h.productPrice}</span>}
                  <i>{c.buttonLabel}</i>
                </div>
              );
            })()}
          </div>
          {look.caption && <p className="stl-prev-cap">{look.caption}</p>}
        </div>
        {split && (
          <div className="stl-prev-list">
            {items.map((h, k) => (
              <div key={h.i} className={`stl-prev-item ${active === h.i ? 'on' : ''}`} onMouseEnter={() => setActive(h.i)} onMouseLeave={() => setActive(null)}>
                {h.productImage ? <img src={h.productImage} alt="" /> : <span className="stl-noimg" />}
                <div>
                  <div className="stl-prev-name">{c.dotStyle === 'number' && <em>{h.label || k + 1}</em>}{h.productName}</div>
                  {c.showPrice && h.productPrice && <div className="stl-prev-price">{h.productPrice}</div>}
                  {!mobile && <u>{c.buttonLabel}</u>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopTheLookEditor({ value, onChange, notify }) {
  const c = useMemo(() => normalizeShopTheLook(value), [value]);
  const [lookIdx, setLookIdx] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [picker, setPicker] = useState(null); // index del punto
  const [active, setActive] = useState(null);
  const [uploading, setUploading] = useState('');
  const [sections, setSections] = useState({ loading: true, list: [] });
  const imgRef = useRef(null);
  const drag = useRef(null);
  const mobile = device === 'mobile';

  useEffect(() => {
    const storeId = localStorage.getItem('promonube_store_id');
    apiRequest(`/api/style/home-sections?storeId=${storeId}`)
      .then(r => setSections({ loading: false, list: r.sections || [], message: r.success ? '' : r.message }))
      .catch(() => setSections({ loading: false, list: [], message: 'No se pudieron leer las secciones de tu inicio' }));
  }, []);

  const set = (patch) => onChange({ ...c, ...patch });
  const li = Math.min(lookIdx, Math.max(0, c.looks.length - 1));
  const look = c.looks[li];
  const setLook = (patch) => set({ looks: c.looks.map((l, i) => (i === li ? { ...l, ...patch } : l)) });
  const setHotspot = (hi, patch) => setLook({ hotspots: look.hotspots.map((h, i) => (i === hi ? { ...h, ...patch } : h)) });

  const addLook = () => { set({ looks: [...c.looks, newLook()] }); setLookIdx(c.looks.length); };
  const upload = async (field, file) => {
    setUploading(field);
    try { setLook({ [field]: await uploadImage(file) }); }
    catch (e) { notify?.(e.message); }
    finally { setUploading(''); }
  };

  const pos = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    const k = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    return { x: k(((e.clientX - r.left) / r.width) * 100), y: k(((e.clientY - r.top) / r.height) * 100) };
  };
  const onCanvasClick = (e) => {
    if (drag.current?.moved) return;
    if (e.target !== imgRef.current || look.hotspots.length >= 12) return;
    const p = pos(e);
    setLook({ hotspots: [...look.hotspots, { id: 'h_' + Date.now(), ...p, productId: '', productName: '', productImage: '', productPrice: '', productUrl: '', label: '' }] });
    setPicker(look.hotspots.length);
  };
  const onDotDown = (e, hi) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { hi, moved: false };
  };
  const onDotMove = (e) => {
    if (!drag.current) return;
    drag.current.moved = true;
    setHotspot(drag.current.hi, pos(e));
  };
  const onDotUp = (hi) => {
    const moved = drag.current?.moved;
    setTimeout(() => { drag.current = null; }, 0);
    if (!moved) setPicker(hi);
  };

  const sectionsOk = sections.list.length > 0;
  const placed = c.placement.sectionId ? sections.list.find(s => s.sectionId === c.placement.sectionId) : null;
  const ready = c.looks.some(l => l.imageUrl && l.hotspots.some(h => h.productId || h.productUrl));
  const status = !c.enabled ? ['muted', 'Apagado: no se muestra en tu tienda.']
    : !ready ? ['warn', 'Activo, pero falta un look con foto y al menos un producto.']
    : !c.placement.sectionId && !c.injectSelector ? ['warn', 'Activo: elegí dónde va (si no, queda arriba del pie de página).']
    : ['ok', `Activo${placed ? `: ${c.placement.position === 'before' ? 'antes de' : 'después de'} "${sectionLabel(placed, sections.list)}"` : ''}.`];

  return (
    <div className="cd-page se-editor">
      <div className="config-section se-head">
        <div className="se-title">
          <div className="vg-hero-icon"><ShoppingBag size={20} /></div>
          <div>
            <h2>Shop the Look</h2>
            <p>Una foto ambientada con puntos sobre cada producto. Precio, foto y stock salen de tu tienda en el momento: si cambia el precio o se agota, se actualiza solo.</p>
          </div>
        </div>
        <label className="toggle-switch" title={c.enabled ? 'Activo' : 'Apagado'}>
          <input type="checkbox" checked={c.enabled} onChange={e => set({ enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="cd-preview-card stl-preview-card">
        <div className="cd-preview-toolbar">
          <span className={`cd-status cd-status-${status[0]}`}>{status[1]}</span>
          <div className="cd-device">
            <button className={!mobile ? 'active' : ''} onClick={() => setDevice('desktop')}><Monitor size={15} /> Computadora</button>
            <button className={mobile ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone size={15} /> Celular</button>
          </div>
        </div>
        <div className={`bn-stage ${mobile ? 'bn-stage-m' : ''}`}>
          <Preview c={c} look={look} mobile={mobile} active={active} setActive={setActive} />
        </div>
      </div>

      {/* Looks */}
      <div className="config-section">
        <div className="section-header">
          <h2>Looks</h2>
          {c.looks.length < 6 && <button type="button" className="cd-chip" onClick={addLook}><Plus size={13} /> Agregar look</button>}
        </div>
        {!c.looks.length && (
          <div className="stl-start">
            <p className="vg-hint">Un look es una foto ambientada (un living, un comedor) con los productos marcados.</p>
            <button type="button" className="btn-primary" onClick={addLook}><Plus size={15} /> Crear el primer look</button>
          </div>
        )}
        {c.looks.length > 1 && (
          <div className="se-seg stl-tabs">
            {c.looks.map((l, i) => <button key={l.id || i} type="button" className={i === li ? 'active' : ''} onClick={() => setLookIdx(i)}>Look {i + 1}</button>)}
          </div>
        )}
        {look && (
          <div className="stl-look">
            <div className="stl-canvas-col">
              {look.imageUrl ? (
                <>
                  <div className="stl-canvas" onClick={onCanvasClick}>
                    <img ref={imgRef} src={look.imageUrl} alt="" draggable={false} />
                    {look.hotspots.map((h, hi) => (
                      <button key={h.id || hi} type="button"
                        className={`stl-edit-dot ${!h.productName ? 'stl-empty' : ''} ${active === hi ? 'on' : ''}`}
                        style={{ left: `${h.x}%`, top: `${h.y}%` }}
                        onPointerDown={e => onDotDown(e, hi)} onPointerMove={onDotMove} onPointerUp={() => onDotUp(hi)}
                        onMouseEnter={() => setActive(hi)} onMouseLeave={() => setActive(null)}
                        title={h.productName || 'Elegir producto'}>
                        {h.label || hi + 1}
                      </button>
                    ))}
                  </div>
                  <p className="vg-hint se-fhint"><Move size={12} /> Tocá la foto para agregar un punto. Arrastralo para moverlo; tocalo para cambiar el producto.</p>
                </>
              ) : (
                <label className="stl-drop">
                  <Upload size={22} />
                  <b>{uploading === 'imageUrl' ? 'Subiendo…' : 'Subí la foto del look'}</b>
                  <span>JPG o PNG, hasta 5MB. Ideal horizontal, 1600px de ancho.</span>
                  <input type="file" accept="image/*" hidden onChange={e => upload('imageUrl', e.target.files[0])} />
                </label>
              )}
            </div>
            <div className="stl-side">
              <div className="se-messages">
                {look.hotspots.map((h, hi) => (
                  <div key={h.id || hi} className={`stl-hs ${active === hi ? 'on' : ''}`} onMouseEnter={() => setActive(hi)} onMouseLeave={() => setActive(null)}>
                    <span className="stl-hs-n">{h.label || hi + 1}</span>
                    {h.productImage ? <img src={h.productImage} alt="" /> : <span className="stl-noimg" />}
                    <button type="button" className="stl-hs-name" onClick={() => setPicker(hi)}>
                      {h.productName ? <><b>{h.productName}</b><small>{h.productPrice}</small></> : <b className="stl-missing">Elegir producto</b>}
                    </button>
                    <input type="text" className="stl-hs-label" maxLength={3} value={h.label || ''} placeholder="#" title="Texto del punto (opcional)" onChange={e => setHotspot(hi, { label: e.target.value })} />
                    <button type="button" className="cd-chip" title="Quitar" onClick={() => setLook({ hotspots: look.hotspots.filter((_, i) => i !== hi) })}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              {look.imageUrl && !look.hotspots.length && <p className="vg-hint">Todavía no hay productos marcados.</p>}
              <div className="cd-fields stl-look-fields">
                <div className="vg-field">
                  <label>Texto debajo de la foto</label>
                  <input type="text" maxLength={120} value={look.caption} placeholder="Ej: Living Mediterráneo" onChange={e => setLook({ caption: e.target.value })} />
                </div>
                <div className="stl-look-actions">
                  {look.imageUrl && (
                    <label className="cd-chip"><Upload size={13} /> {uploading === 'imageUrl' ? 'Subiendo…' : 'Cambiar foto'}
                      <input type="file" accept="image/*" hidden onChange={e => upload('imageUrl', e.target.files[0])} /></label>
                  )}
                  {look.imageUrl && (
                    <label className="cd-chip"><Smartphone size={13} /> {uploading === 'mobileImageUrl' ? 'Subiendo…' : look.mobileImageUrl ? 'Cambiar foto de celu' : 'Foto distinta para celu'}
                      <input type="file" accept="image/*" hidden onChange={e => upload('mobileImageUrl', e.target.files[0])} /></label>
                  )}
                  {look.mobileImageUrl && <button type="button" className="cd-chip" onClick={() => setLook({ mobileImageUrl: '' })}>Usar la misma en celu</button>}
                  <button type="button" className="cd-chip" onClick={() => { set({ looks: c.looks.filter((_, i) => i !== li) }); setLookIdx(0); }}><Trash2 size={13} /> Borrar look</button>
                </div>
                {look.mobileImageUrl && <p className="vg-hint se-fhint">Con foto distinta en celu, los puntos usan la misma posición: conviene que el encuadre sea parecido.</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="se-grid">
        <div className="config-section">
          <div className="section-header"><h2>Dónde va</h2></div>
          <div className="cd-fields">
            {sections.loading && <p className="vg-hint">Leyendo las secciones de tu inicio…</p>}
            {!sections.loading && sectionsOk && (
              <>
                <div className="vg-field">
                  <label>Sección de tu inicio</label>
                  <select value={c.placement.sectionId} onChange={e => set({ placement: { ...c.placement, sectionId: e.target.value } })}>
                    <option value="">Arriba del pie de página</option>
                    {sections.list.map(s => <option key={s.sectionId} value={s.sectionId}>{sectionLabel(s, sections.list)}</option>)}
                  </select>
                </div>
                {c.placement.sectionId && (
                  <div className="se-seg">
                    {[['before', 'Antes'], ['after', 'Después']].map(([v, t]) => (
                      <button key={v} type="button" className={c.placement.position === v ? 'active' : ''} onClick={() => set({ placement: { ...c.placement, position: v } })}>{t}</button>
                    ))}
                  </div>
                )}
                {placed?.thumb && <img className="stl-sec-thumb" src={placed.thumb} alt="" />}
              </>
            )}
            {!sections.loading && !sectionsOk && <p className="vg-hint">{sections.message || 'No encontramos secciones en tu inicio.'}</p>}
            {!c.placement.sectionId && c.injectSelector && (
              <p className="vg-hint se-fhint">Hoy usa el selector de la versión anterior (<code>{c.injectSelector}</code>). Elegí una sección para reemplazarlo.</p>
            )}
            <p className="vg-hint se-fhint">Se muestra solo en tu inicio, que es donde están esas secciones.</p>
          </div>
        </div>

        <div className="config-section">
          <div className="section-header"><h2>Diseño</h2></div>
          <div className="cd-fields">
            <div className="vg-field">
              <label>Forma</label>
              <div className="se-seg">
                {[['split', 'Foto + lista de productos'], ['hotspots', 'Solo la foto con puntos']].map(([v, t]) => (
                  <button key={v} type="button" className={c.layout === v ? 'active' : ''} onClick={() => set({ layout: v })}>{t}</button>
                ))}
              </div>
              <p className="vg-hint se-fhint">{c.layout === 'split' ? 'La lista va al costado; en celular, abajo y se desliza.' : 'Al pasar el mouse se ve el producto; en celular se abre al tocar.'}</p>
            </div>
            {c.layout === 'split' && (
              <div className="se-seg">
                {[['left', 'Foto a la izquierda'], ['right', 'Foto a la derecha']].map(([v, t]) => (
                  <button key={v} type="button" className={c.imageSide === v ? 'active' : ''} onClick={() => set({ imageSide: v })}>{t}</button>
                ))}
              </div>
            )}
            <div className="vg-field">
              <label>Título</label>
              <input type="text" maxLength={80} value={c.title} placeholder="Shop the Look" onChange={e => set({ title: e.target.value })} />
            </div>
            <div className="vg-field">
              <label>Bajada</label>
              <input type="text" maxLength={200} value={c.subtitle} placeholder="Ej: Armá tu living como en la foto" onChange={e => set({ subtitle: e.target.value })} />
            </div>
            <div className="vg-row">
              <div className="vg-field">
                <label>Puntos</label>
                <div className="se-seg">
                  {[['number', '1 2 3'], ['plus', '+'], ['dot', '•']].map(([v, t]) => (
                    <button key={v} type="button" className={c.dotStyle === v ? 'active' : ''} onClick={() => set({ dotStyle: v })}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="vg-field">
                <label>Texto del botón</label>
                <input type="text" maxLength={30} value={c.buttonLabel} onChange={e => set({ buttonLabel: e.target.value })} />
              </div>
            </div>
            <div className="cd-colors">
              <label className="cd-color"><input type="color" value={c.dotColor} onChange={e => set({ dotColor: e.target.value })} /><span>Punto</span></label>
              <label className="cd-color"><input type="color" value={c.dotTextColor} onChange={e => set({ dotTextColor: e.target.value })} /><span>Número</span></label>
              <label className="cd-color"><input type="color" value={c.accentColor} onChange={e => set({ accentColor: e.target.value })} /><span>Botón</span></label>
            </div>
            <label className="vg-check"><input type="checkbox" checked={c.pulse} onChange={e => set({ pulse: e.target.checked })} /> Latido suave en los puntos</label>
            <label className="vg-check"><input type="checkbox" checked={c.showPrice} onChange={e => set({ showPrice: e.target.checked })} /> Mostrar precio</label>
            <label className="vg-check"><input type="checkbox" checked={c.hideSoldOut} onChange={e => set({ hideSoldOut: e.target.checked })} /> Ocultar los productos sin stock</label>
          </div>
        </div>
      </div>

      {picker != null && look && (
        <ProductPicker
          onClose={() => {
            // Punto recien creado y sin producto: se descarta
            const h = look.hotspots[picker];
            if (h && !h.productName && !h.productUrl) setLook({ hotspots: look.hotspots.filter((_, i) => i !== picker) });
            setPicker(null);
          }}
          onPick={(s) => { setHotspot(picker, s); setPicker(null); }}
        />
      )}
    </div>
  );
}
