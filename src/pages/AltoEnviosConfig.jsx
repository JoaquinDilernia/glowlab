import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Power, AlertTriangle, RefreshCw, PlugZap } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';

// Envíos agrupados (Alto Rancho): desplegables de envío en carrito/checkout + filtro real del checkout.
// Backend: functions/alto-envios.js. Diseño: docs/superpowers/specs/2026-11-13-alto-envios-design.md
const ALLOWED_STORE_ID = '2547699';

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

  const cargar = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/alto-envios/salud?storeId=${storeId}`);
      if (res?.success) setSalud(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => {
    if (!isAllowed) { setLoading(false); return; }
    cargar();
  }, [isAllowed, cargar]);

  const config = salud?.config || { enabled: false, ocultar: false };

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

  const instalar = async () => {
    setInstalling(true);
    try {
      const res = await apiRequest('/api/alto-envios/install', { method: 'POST', body: JSON.stringify({ storeId }) });
      if (res?.success) toast.success('Regla de envíos registrada');
      else toast.error(res?.message || `TiendaNube respondió ${res?.install?.regla?.status ?? 'con error'}`);
      await cargar();
    } catch (e) { toast.error(e.message); }
    finally { setInstalling(false); }
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

  const inst = config.install;
  const reglaOk = inst?.regla?.status && inst.regla.status < 300;

  return (
    <div className="local-stock-page">
      <header className="ls-header">
        <div className="ls-header-icon"><Truck size={22} /></div>
        <div>
          <h1>Envíos agrupados</h1>
          <p>Las opciones de envío en tres desplegables (domicilio, locales y punto de retiro) en el carrito, el producto y el checkout.</p>
        </div>
        <button className={`ls-toggle ${config.enabled ? 'on' : 'off'}`} onClick={() => guardar({ enabled: !config.enabled })} disabled={saving}>
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
            Conviene dejarlo apagado unos días después de instalar, para juntar datos, y recién ahí prenderlo.
          </p>
          <button className={`ls-toggle ${config.ocultar ? 'on' : 'off'}`} onClick={() => guardar({ ocultar: !config.ocultar })} disabled={saving}>
            <Power size={16} />
            {config.ocultar ? 'Ocultando' : 'Sin ocultar'}
          </button>
        </section>

        <section className="ls-card">
          <h2>Regla de envíos en TiendaNube</h2>
          <p className="ls-help">
            Registra a GlowLab para que TiendaNube le consulte antes de mostrar los envíos del checkout, y lee el catálogo de
            transportistas. Volvé a correrlo si cambian los medios de envío de la tienda.
          </p>
          <button className="ls-btn-secondary" onClick={instalar} disabled={installing}>
            <PlugZap size={16} /> {installing ? 'Instalando…' : inst ? 'Reinstalar' : 'Instalar'}
          </button>
          {inst && (
            <p className="ls-help" style={{ marginTop: 12 }}>
              Última vez: {new Date(inst.at).toLocaleString('es-AR')} · Regla: {reglaOk ? 'registrada' : `error ${inst.regla?.status}`}
              {' '}· Catálogo: {inst.catalogo} opciones{inst.catalogoError ? ` (${inst.catalogoError})` : ''}
            </p>
          )}
        </section>

        <section className="ls-card ls-card--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Estado</h2>
            <button className="ls-btn-secondary" onClick={cargar}><RefreshCw size={14} /> Actualizar</button>
          </div>
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
