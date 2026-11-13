import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Power, AlertTriangle, RefreshCw, PlugZap, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';

// Envíos agrupados (Alto Rancho): desplegables de envío en carrito/checkout + filtro real del checkout.
// Backend: functions/alto-envios.js. Diseño: docs/superpowers/specs/2026-11-13-alto-envios-design.md
const ALLOWED_STORE_ID = '2547699';

// Igual que DEFAULT_ESTILO del backend (functions/alto-envios.js): el diseño de diseño gráfico (13/11/2026).
const DEFAULT_ESTILO = {
  fuente: 'Poppins', tamano: 14, radio: 10, mostrarIconos: true,
  colorTexto: '#111111', colorElegida: '#111111', colorBorde: '#dddddd',
  fondoTitulo: '#ffffff', fondoTituloElegida: '#f4f4f4',
  ecoFondo: '#E2EFDA', ecoTexto: '#2E6B1F', rapFondo: '#DDEBF7', rapTexto: '#1F4E79',
  pregunta: '¿cómo querés recibirlo?',
  tituloDomicilio: 'Envío a domicilio', tituloLocal: 'Retiro en nuestros locales', tituloPunto: 'Entrega en punto de retiro',
  textoEco: 'más económico', textoRap: 'más rápido',
};
const TIPOGRAFIAS = [
  { value: 'inherit', label: 'La de la tienda' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Oswald', label: 'Oswald' },
];
const COLORES = [
  ['colorTexto', 'Texto'], ['colorElegida', 'Círculo de la opción elegida'], ['colorBorde', 'Bordes'],
  ['fondoTitulo', 'Fondo de los grupos'], ['fondoTituloElegida', 'Fondo de la opción elegida'],
  ['ecoFondo', 'Etiqueta económico (fondo)'], ['ecoTexto', 'Etiqueta económico (texto)'],
  ['rapFondo', 'Etiqueta rápido (fondo)'], ['rapTexto', 'Etiqueta rápido (texto)'],
];
const TEXTOS = [
  ['pregunta', 'Pregunta'], ['tituloDomicilio', 'Grupo domicilio'], ['tituloLocal', 'Grupo locales'],
  ['tituloPunto', 'Grupo punto de retiro'], ['textoEco', 'Etiqueta económico'], ['textoRap', 'Etiqueta rápido'],
];

// Íconos de Google (Material Symbols: local_shipping, storefront, pin_drop). Igual que ICONOS de functions/alto-envios.js.
const ICONOS = {
  domicilio: "M155-195q-35-35-35-85H40v-440q0-33 23.5-56.5T120-800h560v160h120l120 160v200h-80q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35q-50 0-85-35Zm113.5-56.5Q280-263 280-280t-11.5-28.5Q257-320 240-320t-28.5 11.5Q200-297 200-280t11.5 28.5Q223-240 240-240t28.5-11.5ZM120-360h32q17-18 39-29t49-11q27 0 49 11t39 29h272v-360H120v360Zm628.5 108.5Q760-263 760-280t-11.5-28.5Q737-320 720-320t-28.5 11.5Q680-297 680-280t11.5 28.5Q703-240 720-240t28.5-11.5ZM680-440h170l-90-120h-80v120ZM360-540Z",
  local: "M841-518v318q0 33-23.5 56.5T761-120H201q-33 0-56.5-23.5T121-200v-318q-23-21-35.5-54t-.5-72l42-136q8-26 28.5-43t47.5-17h556q27 0 47 16.5t29 43.5l42 136q12 39-.5 71T841-518Zm-272-42q27 0 41-18.5t11-41.5l-22-140h-78v148q0 21 14 36.5t34 15.5Zm-180 0q23 0 37.5-15.5T441-612v-148h-78l-22 140q-4 24 10.5 42t37.5 18Zm-178 0q18 0 31.5-13t16.5-33l22-154h-78l-40 134q-6 20 6.5 43t41.5 23Zm540 0q29 0 42-23t6-43l-42-134h-76l22 154q3 20 16.5 33t31.5 13ZM201-200h560v-282q-5 2-6.5 2H751q-27 0-47.5-9T663-518q-18 18-41 28t-49 10q-27 0-50.5-10T481-518q-17 18-39.5 28T393-480q-29 0-52.5-10T299-518q-21 21-41.5 29.5T211-480h-4.5q-2.5 0-5.5-2v282Zm560 0H201h560Z",
  derecha: "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z",
  abrir: "M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z",
  cerrar: "m296-345-56-56 240-240 240 240-56 56-184-184-184 184Z",
  punto: "M480-301q99-80 149.5-154T680-594q0-90-56-148t-144-58q-88 0-144 58t-56 148q0 65 50.5 139T480-301Zm0 101Q339-304 269.5-402T200-594q0-125 78-205.5T480-880q124 0 202 80.5T760-594q0 94-69.5 192T480-200Zm0-320q33 0 56.5-23.5T560-600q0-33-23.5-56.5T480-680q-33 0-56.5 23.5T400-600q0 33 23.5 56.5T480-520ZM200-80v-80h560v80H200Zm280-520Z",
};

// Vista previa: los mismos estilos que alto-envios-widget.js (carrito / producto), con datos de ejemplo.
function Vista({ e }) {
  useEffect(() => {
    if (e.fuente === 'inherit') return;
    const id = 'alto-env-font-' + e.fuente.replace(/ /g, '-');
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + e.fuente.replace(/ /g, '+') + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }, [e.fuente]);
  const T = e.tamano;
  const px = (n) => `${Math.round(n * 10) / 10}px`;
  const familia = e.fuente === 'inherit' ? 'inherit' : `'${e.fuente}', sans-serif`;
  const svg = (k, size, extra) => (
    <svg viewBox="0 -960 960 960" width={size} height={size} style={{ flex: 'none', fill: 'currentColor', ...extra }} aria-hidden="true"><path d={ICONOS[k]} /></svg>
  );
  const grupo = (icono, titulo, sub, abierto, filas, mas) => (
    <>
      <div style={{ border: `1px solid ${e.colorBorde}`, borderRadius: px(e.radio), marginBottom: 10, overflow: 'hidden', background: e.fondoTitulo }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
          {svg('derecha', 20, { transform: abierto ? 'rotate(90deg)' : 'none' })}
          {e.mostrarIconos && svg(icono, 22)}
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: px(T * 17 / 14), lineHeight: 1.25 }}>{titulo}</span>
            {!abierto && <small style={{ display: 'block', fontSize: px(T * 12 / 14), color: '#555', marginTop: 1 }}>{sub}</small>}
          </span>
        </div>
        {abierto && <div style={{ padding: '0 12px 12px' }}>{filas}</div>}
      </div>
      {abierto && mas && <span style={{ display: 'block', margin: '-2px 0 12px 64px', color: '#333', textDecoration: 'underline', fontSize: px(T * 12 / 14) }}>{mas}</span>}
    </>
  );
  const etiqueta = (texto, fondo, color) => (
    <span style={{ display: 'inline-block', fontSize: px(T * 11.5 / 14), fontWeight: 500, padding: '1px 8px', borderRadius: 10, marginLeft: 8, background: fondo, color, whiteSpace: 'nowrap' }}>{texto}</span>
  );
  const fila = (nombre, linea, precio, elegida, extra) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', margin: '2px 0', border: `1px solid ${elegida ? e.colorBorde : 'transparent'}`,
      borderRadius: px(e.radio), background: elegida ? e.fondoTituloElegida : 'transparent', lineHeight: 1.25 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', marginTop: px(T * 3.5 / 14),
        border: `1px solid ${elegida ? e.colorElegida : '#999'}`, background: elegida ? `radial-gradient(${e.colorElegida} 45%,#fff 52%)` : 'none' }} />
      <span style={{ flex: 1 }}><span style={{ fontSize: px(T * 15 / 14) }}>{nombre}</span>{extra}<small style={{ display: 'block', fontSize: px(T * 12 / 14), color: '#666', marginTop: 2 }}>{linea}</small></span>
      <span style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: px(T * 15 / 14), paddingLeft: 8 }}>{precio}</span>
    </div>
  );
  return (
    <div style={{ fontFamily: familia, fontSize: px(T), lineHeight: 1.3, color: e.colorTexto }}>
      {e.pregunta && <div style={{ margin: '0 0 12px', fontSize: px(T * 20 / 14), fontWeight: 600, lineHeight: 1.2 }}>{e.pregunta}</div>}
      {grupo('domicilio', e.tituloDomicilio, 'desde $9.999', true, <>
        {fila('Correo Argentino', 'llega entre jueves 19/11 - martes 24/11', '$99.999', true, etiqueta(e.textoEco, e.ecoFondo, e.ecoTexto))}
        {fila('Urbano', 'llega entre jueves 19/11 - martes 24/11', '$99.999', false, null)}
        {fila('Andreani', 'llega miércoles 18/11', '$99.999', false, etiqueta(e.textoRap, e.rapFondo, e.rapTexto))}
      </>, 'ver 3 opciones más')}
      {grupo('local', e.tituloLocal, 'gratis', false, null)}
      {grupo('punto', e.tituloPunto, 'desde $9.999', false, null)}
    </div>
  );
}

const FUENTES = {
  carrito: 'mismo carrito',
  combo: 'mismos productos y CP',
  sin_datos: 'sin datos (no oculta)',
  sin_catalogo: 'falta en catálogo (no oculta)',
  apagado: 'filtro apagado',
  regla_local: 'regla de locales (ocultó)',
  regla_no_aplica: 'regla de locales: no aplica',
  regla_sin_cambios: 'regla de locales: nada para ocultar',
};

// Reglas de retiro en locales por SKU (reemplaza a la app "reglas de negocio avanzadas"). Ej.: sin retiro en Belgrano si
// el carrito tiene un producto con SKU que empieza con M (muebles y sillas).
const REGLA_NUEVA = { activa: true, nombre: '', locales: [], prefijos: [] };
function ReglasLocales({ guardadas, locales, guardar, saving, conectado }) {
  const [reglas, setReglas] = useState(guardadas);
  useEffect(() => { setReglas(guardadas); }, [JSON.stringify(guardadas)]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiar = (i, k, v) => setReglas((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const alternarLocal = (i, code) => setReglas((rs) => rs.map((r, j) => (j !== i ? r
    : { ...r, locales: r.locales.includes(code) ? r.locales.filter((c) => c !== code) : [...r.locales, code] })));
  const incompletas = reglas.some((r) => !r.locales.length || !r.prefijos.length);
  const hayCambios = JSON.stringify(reglas) !== JSON.stringify(guardadas);
  const nombreLocal = (code) => (locales.find((l) => l.code === code)?.nombre || code);
  return (
    <section className="ls-card ls-card--wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2>Retiro en locales según el producto</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ls-btn-secondary" onClick={() => setReglas((rs) => [...rs, { ...REGLA_NUEVA }])} disabled={saving}><Plus size={14} /> Agregar regla</button>
          <button className="ls-btn-primary" onClick={() => guardar({ reglasLocales: reglas })} disabled={saving || !hayCambios || incompletas}><Save size={14} /> Guardar reglas</button>
        </div>
      </div>
      <p className="ls-help">
        Oculta el retiro en los locales que elijas cuando el carrito tiene algún producto cuyo SKU empieza con alguno de los
        prefijos. Por ejemplo: sin retiro en Belgrano si hay muebles o sillas (SKU que empiezan con M). Funciona aunque el
        módulo de desplegables esté desactivado.
        {!conectado && <b> Primero conectá con TiendaNube (abajo, en Estado).</b>}
      </p>
      {!reglas.length && <p className="ls-help">No hay reglas.</p>}
      {reglas.map((r, i) => (
        <div key={i} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: 14, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 220px' }}>
              Nombre (opcional)
              <input type="text" maxLength={60} value={r.nombre} placeholder="Muebles y sillas sin retiro en Belgrano" onChange={(ev) => cambiar(i, 'nombre', ev.target.value)} />
            </label>
            <label style={{ flex: '1 1 220px' }}>
              SKU que empiezan con (separados por coma)
              <input type="text" value={r.prefijos.join(', ')} placeholder="M"
                onChange={(ev) => cambiar(i, 'prefijos', ev.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))} />
            </label>
            <button className={`ls-toggle ${r.activa ? 'on' : 'off'}`} onClick={() => cambiar(i, 'activa', !r.activa)} disabled={saving}>
              <Power size={16} /> {r.activa ? 'Activa' : 'Pausada'}
            </button>
            <button className="ls-btn-secondary" onClick={() => setReglas((rs) => rs.filter((_, j) => j !== i))} disabled={saving} title="Borrar regla"><Trash2 size={14} /></button>
          </div>
          <div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Ocultar el retiro en:</div>
            {!locales.length && <p className="ls-help">No hay locales en el catálogo de envíos todavía. Tocá "Reconectar con TiendaNube".</p>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {locales.map((l) => (
                <label key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={r.locales.includes(l.code)} onChange={() => alternarLocal(i, l.code)} /> {l.nombre}
                </label>
              ))}
              {r.locales.filter((c) => !locales.some((l) => l.code === c)).map((c) => (
                <span key={c} className="ls-help">({nombreLocal(c)}: ya no está en el catálogo)</span>
              ))}
            </div>
          </div>
          {(!r.locales.length || !r.prefijos.length) && <p className="ls-help" style={{ color: '#b45309' }}>Elegí al menos un local y un prefijo de SKU.</p>}
        </div>
      ))}
    </section>
  );
}

function AltoEnviosConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const isAllowed = String(storeId) === ALLOWED_STORE_ID;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [salud, setSalud] = useState(null);
  const [estilo, setEstilo] = useState(DEFAULT_ESTILO);
  const [estiloGuardado, setEstiloGuardado] = useState(DEFAULT_ESTILO);

  const cargar = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/alto-envios/salud?storeId=${storeId}`);
      if (res?.success) {
        setSalud(res);
        const e = { ...DEFAULT_ESTILO, ...(res.config?.estilo || {}) };
        setEstiloGuardado(e);
        setEstilo((actual) => (JSON.stringify(actual) === JSON.stringify(DEFAULT_ESTILO) ? e : actual));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => {
    if (!isAllowed) { setLoading(false); return; }
    cargar();
  }, [isAllowed, cargar]);

  const config = salud?.config || { enabled: false, ocultar: false };
  const inst = config.install;
  const conectado = !!(inst?.regla?.status && inst.regla.status < 300);

  const guardar = async (cambios) => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/alto-envios/config', { method: 'POST', body: JSON.stringify({ storeId, ...cambios }) });
      if (!res?.success) throw new Error(res?.message || 'No se pudo guardar');
      toast.success('Guardado');
      await cargar();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const cambiarEstilo = (k, v) => setEstilo((e) => ({ ...e, [k]: v }));
  const hayCambios = JSON.stringify(estilo) !== JSON.stringify(estiloGuardado);

  // Conecta con TiendaNube: le pide que consulte a GlowLab antes de mostrar los envíos del checkout y baja la
  // lista de medios de envío. Hace falta desde que se prende el módulo: sin esas consultas no se juntan datos
  // para "Ocultar opciones".
  const conectar = async ({ silencioso = false } = {}) => {
    setInstalling(true);
    try {
      const res = await apiRequest('/api/alto-envios/install', { method: 'POST', body: JSON.stringify({ storeId }) });
      if (res?.success) { if (!silencioso) toast.success('Conectado con TiendaNube'); }
      else toast.error('No se pudo conectar con TiendaNube: ' + (res?.message || `respondió ${res?.install?.regla?.status ?? 'con error'}`));
      return !!res?.success;
    } catch (e) { toast.error(e.message); return false; }
    finally { setInstalling(false); }
  };

  const cambiarActivo = async () => {
    const prender = !config.enabled;
    if (prender && !conectado) await conectar({ silencioso: true });
    await guardar({ enabled: prender });
  };

  if (!isAllowed) {
    return (
      <div className="local-stock-page">
        <div className="ls-restricted">
          <AlertTriangle size={42} />
          <h2>Módulo no disponible</h2>
          <p>Este módulo es exclusivo de Altorancho.</p>
          <button onClick={() => navigate('/dashboard')}>Volver al dashboard</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="local-stock-page"><div className="ls-loading">Cargando…</div></div>;
  }


  return (
    <div className="local-stock-page">
      <header className="ls-header">
        <div className="ls-header-icon"><Truck size={22} /></div>
        <div>
          <h1>Envíos agrupados</h1>
          <p>Las opciones de envío en tres desplegables (domicilio, locales y punto de retiro) en el carrito, el producto y el checkout.</p>
        </div>
        <button className={`ls-toggle ${config.enabled ? 'on' : 'off'}`} onClick={cambiarActivo} disabled={saving || installing}>
          <Power size={16} />
          {config.enabled ? 'Activo' : 'Desactivado'}
        </button>
      </header>

      <div className="ls-grid">
        <section className="ls-card">
          <h2>Ocultar opciones en el checkout</h2>
          <p className="ls-help">
            Saca de la lista del checkout las opciones de Zipnova y Envío Nube que no son ni la más barata ni la más rápida.
            Solo oculta cuando ya vio una cotización real del mismo carrito y código postal; si no, muestra todo.
            Conviene dejarlo apagado unos días después de activar el módulo, para juntar datos, y recién ahí prenderlo.
          </p>
          <button className={`ls-toggle ${config.ocultar ? 'on' : 'off'}`} onClick={() => guardar({ ocultar: !config.ocultar })} disabled={saving}>
            <Power size={16} />
            {config.ocultar ? 'Ocultando' : 'Sin ocultar'}
          </button>
        </section>

        <ReglasLocales
          guardadas={config.reglasLocales || []}
          locales={(salud?.opcionesCatalogo || []).filter((o) => o.carrier === 'Locale')}
          guardar={guardar} saving={saving} conectado={conectado}
        />

        <section className="ls-card ls-card--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2>Diseño</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ls-btn-secondary" onClick={() => setEstilo(DEFAULT_ESTILO)} disabled={saving}><RotateCcw size={14} /> Original</button>
              <button className="ls-btn-primary" onClick={() => guardar({ estilo })} disabled={saving || !hayCambios}><Save size={14} /> Guardar diseño</button>
            </div>
          </div>
          <p className="ls-help">
            Se aplica al carrito, al calculador del producto y al checkout. En el checkout la tipografía solo se ve si el
            checkout ya la tiene cargada; si no, usa la suya. Los cambios tardan unos minutos en verse en la tienda.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="ls-row">
                <label>
                  Tipografía
                  <select value={estilo.fuente} onChange={(ev) => cambiarEstilo('fuente', ev.target.value)}
                    style={{ width: '100%', marginTop: 5, padding: '9px 10px', border: '1px solid #d4d4d4', borderRadius: 8, background: '#fff', color: '#353434' }}>
                    {TIPOGRAFIAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label>
                  Tamaño del texto: {estilo.tamano}px
                  <input type="range" min={12} max={16} step={1} value={estilo.tamano} onChange={(ev) => cambiarEstilo('tamano', Number(ev.target.value))} style={{ width: '100%', marginTop: 10 }} />
                </label>
                <label>
                  Esquinas: {estilo.radio}px
                  <input type="range" min={0} max={16} step={1} value={estilo.radio} onChange={(ev) => cambiarEstilo('radio', Number(ev.target.value))} style={{ width: '100%', marginTop: 10 }} />
                </label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={estilo.mostrarIconos} onChange={(ev) => cambiarEstilo('mostrarIconos', ev.target.checked)} />
                Mostrar íconos en los títulos
              </label>
              <div className="ls-row">
                {COLORES.map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <div className="ls-color">
                      <input type="color" value={estilo[k]} onChange={(ev) => cambiarEstilo(k, ev.target.value)} />
                      <input type="text" value={estilo[k]} onChange={(ev) => cambiarEstilo(k, ev.target.value)} />
                    </div>
                  </label>
                ))}
              </div>
              <div className="ls-row">
                {TEXTOS.map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input type="text" maxLength={60} value={estilo[k]} onChange={(ev) => cambiarEstilo(k, ev.target.value)} />
                  </label>
                ))}
              </div>
            </div>
            <div style={{ position: 'sticky', top: 16 }}>
              <div style={{ fontSize: 12, color: '#6b6b6b', marginBottom: 8 }}>Vista previa (carrito)</div>
              <div style={{ background: '#f7f7f7', border: '1px dashed #d4d4d4', borderRadius: 12, padding: 16 }}>
                <Vista e={estilo} />
              </div>
            </div>
          </div>
        </section>

        <section className="ls-card ls-card--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Estado</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ls-btn-secondary" onClick={() => conectar().then(cargar)} disabled={installing}
                title="Volvé a conectar si cambian los medios de envío de la tienda">
                <PlugZap size={14} /> {installing ? 'Conectando…' : 'Reconectar con TiendaNube'}
              </button>
              <button className="ls-btn-secondary" onClick={cargar}><RefreshCw size={14} /> Actualizar</button>
            </div>
          </div>
          <p className="ls-help">
            Conexión con TiendaNube: <b>{conectado ? 'conectado' : inst ? `error ${inst.regla?.status}` : 'sin conectar (se conecta al activar el módulo)'}</b>
            {inst?.catalogo ? ` · ${inst.catalogo} medios de envío leídos` : ''}{inst?.catalogoError ? ` (${inst.catalogoError})` : ''}.
          </p>
          <p className="ls-help">
            Consultas de TiendaNube desde el último reinicio del servidor: <b>{salud?.consultas ?? 0}</b>
            {salud?.ultimaConsulta ? ` (última ${new Date(salud.ultimaConsulta).toLocaleString('es-AR')})` : ''}.
            {' '}Si después de un checkout de prueba sigue en 0, TiendaNube no está llamando a la regla.
          </p>
          <p className="ls-help">
            Catálogo: <b>{salud?.catalogo ?? 0}</b> opciones · Cotizaciones guardadas: <b>{salud?.cotizaciones ?? 0}</b>
            {' '}· Fotos del checkout: <b>{salud?.fotos?.aceptadas ?? 0}</b> aceptadas, {salud?.fotos?.rechazadas ?? 0} rechazadas
          </p>
          {salud?.decisiones?.length > 0 && (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b6b6b' }}>
                  <th style={{ padding: '6px 4px' }}>Hora</th><th>CP</th><th>Decisión</th><th>Ocultas</th><th>Quedan</th><th>ms</th>
                </tr>
              </thead>
              <tbody>
                {salud.decisiones.slice(0, 20).map((d, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '6px 4px' }}>{new Date(d.t).toLocaleTimeString('es-AR')}</td>
                    <td>{d.cp || '—'}</td>
                    <td>{FUENTES[d.fuente] || d.fuente}{d.falta ? ` (${d.falta})` : ''}</td>
                    <td>{d.ocultas}</td><td>{d.mostradas || '—'}</td><td>{d.ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default AltoEnviosConfig;
