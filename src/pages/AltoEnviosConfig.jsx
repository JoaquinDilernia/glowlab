import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Power, AlertTriangle, RefreshCw, PlugZap, Save, RotateCcw } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';

// Envíos agrupados (Alto Rancho): desplegables de envío en carrito/checkout + filtro real del checkout.
// Backend: functions/alto-envios.js. Diseño: docs/superpowers/specs/2026-11-13-alto-envios-design.md
const ALLOWED_STORE_ID = '2547699';

// Igual que DEFAULT_ESTILO del backend (functions/alto-envios.js): el diseño que aprobaron los dueños.
const DEFAULT_ESTILO = {
  fuente: 'inherit', tamano: 14, radio: 8, mostrarIconos: true,
  colorTexto: '#111111', colorElegida: '#111111', colorBorde: '#e3e3e3',
  fondoTitulo: '#f3f3f3', fondoTituloElegida: '#dcdcdc',
  ecoFondo: '#E2EFDA', ecoTexto: '#2E6B1F', rapFondo: '#DDEBF7', rapTexto: '#1F4E79',
  pregunta: '¿Cómo querés recibirlo?',
  tituloDomicilio: 'Envío a domicilio', tituloLocal: 'Retiro en nuestros locales', tituloPunto: 'Entrega en punto de retiro',
  textoEco: 'Más económico', textoRap: 'Más rápido',
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
  ['colorTexto', 'Texto'], ['colorElegida', 'Opción elegida'], ['colorBorde', 'Bordes'],
  ['fondoTitulo', 'Fondo de los títulos'], ['fondoTituloElegida', 'Título con opción elegida'],
  ['ecoFondo', 'Etiqueta económico (fondo)'], ['ecoTexto', 'Etiqueta económico (texto)'],
  ['rapFondo', 'Etiqueta rápido (fondo)'], ['rapTexto', 'Etiqueta rápido (texto)'],
];
const TEXTOS = [
  ['pregunta', 'Pregunta (solo checkout)'], ['tituloDomicilio', 'Grupo domicilio'], ['tituloLocal', 'Grupo locales'],
  ['tituloPunto', 'Grupo punto de retiro'], ['textoEco', 'Etiqueta económico'], ['textoRap', 'Etiqueta rápido'],
];

// Vista previa: los mismos estilos que alto-envios-widget.js (carrito / producto), con datos de ejemplo.
function Vista({ e }) {
  useEffect(() => {
    if (e.fuente === 'inherit') return;
    const id = 'alto-env-font-' + e.fuente.replace(/ /g, '-');
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + e.fuente.replace(/ /g, '+') + ':wght@400;700&display=swap';
    document.head.appendChild(l);
  }, [e.fuente]);
  const T = e.tamano;
  const px = (n) => `${Math.round(n * 10) / 10}px`;
  const familia = e.fuente === 'inherit' ? 'inherit' : `'${e.fuente}', sans-serif`;
  const grupo = (icono, titulo, sub, abierto, conElegida, filas) => (
    <div style={{ border: `1px solid ${e.colorBorde}`, borderRadius: px(e.radio), marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: conElegida ? e.fondoTituloElegida : e.fondoTitulo }}>
        {e.mostrarIconos && <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icono}</span>}
        <span style={{ flex: 1 }}>
          <b style={{ display: 'block', fontSize: px(T) }}>{titulo}</b>
          <small style={{ display: 'block', fontSize: px(T * 12 / 14), opacity: 0.7 }}>{sub}</small>
        </span>
        <span style={{ opacity: 0.6, transform: abierto ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </div>
      {abierto && <div style={{ padding: '6px 8px 8px' }}>{filas}</div>}
    </div>
  );
  const etiqueta = (texto, fondo, color) => (
    <span style={{ display: 'inline-block', fontSize: px(T * 10.5 / 14), fontWeight: 700, padding: '1px 6px', borderRadius: 9, marginLeft: 5, background: fondo, color }}>{texto}</span>
  );
  const fila = (nombre, linea, precio, elegida, extra) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 9px', margin: '2px 0', border: `1px solid ${elegida ? e.colorElegida : e.colorBorde}`,
      borderRadius: px(e.radio * 6 / 8), background: elegida ? '#fafafa' : '#fff', fontSize: px(T * 13.5 / 14) }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', boxSizing: 'border-box', flex: 'none',
        border: `2px solid ${elegida ? e.colorElegida : '#bbb'}`, background: elegida ? `radial-gradient(${e.colorElegida} 40%,#fff 46%)` : 'none' }} />
      <span style={{ flex: 1 }}><b>{nombre}</b>{extra}<small style={{ display: 'block', fontSize: px(T * 11.5 / 14), opacity: 0.7, marginTop: 2 }}>{linea}</small></span>
      <b style={{ whiteSpace: 'nowrap' }}>{precio}</b>
    </div>
  );
  return (
    <div style={{ fontFamily: familia, fontSize: px(T), lineHeight: 1.3, color: e.colorTexto }}>
      {grupo('🏠', e.tituloDomicilio, 'desde $5.200', true, true, <>
        {fila('Chazki', 'Llega jue 20/11 – lun 24/11', '$5.200', true, etiqueta(e.textoEco, e.ecoFondo, e.ecoTexto))}
        {fila('Toparco', 'Llega mañana', '$9.800', false, etiqueta(e.textoRap, e.rapFondo, e.rapTexto))}
        {fila('Envío Altorancho', 'Llega mar 18/11 · entrega dentro de tu domicilio', '$19.500', false, null)}
        <span style={{ display: 'block', margin: '4px 2px 0', color: '#555', textDecoration: 'underline', fontSize: px(T * 12 / 14) }}>Ver 3 opciones más</span>
      </>)}
      {grupo('🏬', e.tituloLocal, 'Gratis', false, false, null)}
      {grupo('📍', e.tituloPunto, 'desde $4.100', false, false, null)}
    </div>
  );
}

const FUENTES = {
  carrito: 'mismo carrito',
  combo: 'mismos productos y CP',
  sin_datos: 'sin datos (no oculta)',
  sin_catalogo: 'falta en catálogo (no oculta)',
  apagado: 'filtro apagado',
};

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
