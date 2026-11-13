import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Power, AlertTriangle, Save } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';

// Aviso de transferencia (Alto Rancho): dos carteles en el checkout cuando el cliente elige pagar por
// transferencia. Backend: functions/aviso-transferencia.js. Script del checkout: nube-sdk-aviso-transferencia/.
const ALLOWED_STORE_ID = '2547699';

const TEXTOS = [
  ['titulo1', 'Título del cartel 1', 80], ['texto1', 'Texto del cartel 1', 400, true],
  ['titulo2', 'Título del cartel 2', 80], ['texto2', 'Texto del cartel 2', 400, true],
  ['botonTexto', 'Texto del botón', 60], ['whatsappMessage', 'Mensaje que se precarga en WhatsApp', 300, true],
];
const COLORES = [
  ['bgColor', 'Fondo'], ['borderColor', 'Borde'], ['textColor', 'Texto'],
  ['buttonBgColor', 'Botón (fondo)'], ['buttonTextColor', 'Botón (texto)'],
];

function Vista({ c }) {
  const caja = (titulo, texto, boton) => (
    <div style={{ background: c.bgColor, border: `1px solid ${c.borderColor}`, borderRadius: 10, padding: '14px 16px', color: c.textColor, fontFamily: 'Poppins, system-ui, sans-serif' }}>
      {titulo && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{titulo}</div>}
      {texto && <div style={{ fontSize: 13, lineHeight: 1.45 }}>{texto}</div>}
      {boton && <span style={{ display: 'inline-block', marginTop: 10, padding: '9px 14px', borderRadius: 8, background: c.buttonBgColor, color: c.buttonTextColor, fontWeight: 600, fontSize: 13 }}>{boton}</span>}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {caja(c.titulo1, c.texto1, null)}
      {caja(c.titulo2, c.texto2, c.whatsappPhone ? c.botonTexto : null)}
    </div>
  );
}

function AvisoTransferenciaConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const isAllowed = String(storeId) === ALLOWED_STORE_ID;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardada, setGuardada] = useState(null);
  const [c, setC] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/aviso-transferencia/config?storeId=${storeId}`);
      if (res?.success) { setGuardada(res.config); setC(res.config); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { if (isAllowed) cargar(); else setLoading(false); }, [isAllowed, cargar]);

  const guardar = async (cambios) => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/aviso-transferencia/config', { method: 'POST', body: JSON.stringify({ storeId, config: cambios }) });
      if (!res?.success) throw new Error(res?.message || 'No se pudo guardar');
      setGuardada(res.config);
      setC((actual) => ({ ...actual, ...res.config, ...(cambios.enabled === undefined ? {} : { enabled: res.config.enabled }) }));
      toast.success('Guardado');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
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
  if (loading || !c) return <div className="local-stock-page"><div className="ls-loading">Cargando…</div></div>;

  const cambiar = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const { enabled: _e1, ...sinEnabled } = c;
  const { enabled: _e2, ...guardadaSinEnabled } = guardada || {};
  const hayCambios = JSON.stringify(sinEnabled) !== JSON.stringify(guardadaSinEnabled);

  return (
    <div className="local-stock-page">
      <header className="ls-header">
        <div className="ls-header-icon"><Landmark size={22} /></div>
        <div>
          <h1>Aviso de transferencia</h1>
          <p>Dos carteles debajo de los medios de pago del checkout, solo cuando el cliente elige pagar por transferencia.</p>
        </div>
        <button className={`ls-toggle ${guardada?.enabled ? 'on' : 'off'}`} onClick={() => guardar({ enabled: !guardada?.enabled })} disabled={saving}>
          <Power size={16} />
          {guardada?.enabled ? 'Activo' : 'Desactivado'}
        </button>
      </header>

      <div className="ls-grid">
        <section className="ls-card ls-card--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2>Textos y diseño</h2>
            <button className="ls-btn-primary" onClick={() => guardar(sinEnabled)} disabled={saving || !hayCambios}><Save size={14} /> Guardar</button>
          </div>
          <p className="ls-help">Los cambios se ven en el checkout en un minuto, sin volver a subir el script.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TEXTOS.map(([k, label, max, largo]) => (
                <label key={k}>
                  {label}
                  {largo
                    ? <textarea rows={3} maxLength={max} value={c[k]} onChange={(ev) => cambiar(k, ev.target.value)}
                        style={{ width: '100%', marginTop: 5, padding: '9px 10px', border: '1px solid #d4d4d4', borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    : <input type="text" maxLength={max} value={c[k]} onChange={(ev) => cambiar(k, ev.target.value)} />}
                </label>
              ))}
              <div className="ls-row">
                <label>
                  WhatsApp (con código de país, ej. 5491131440631)
                  <input type="text" value={c.whatsappPhone} onChange={(ev) => cambiar('whatsappPhone', ev.target.value.replace(/\D/g, ''))} />
                </label>
                <label>
                  Palabras que identifican la transferencia
                  <input type="text" value={(c.palabras || []).join(', ')}
                    onChange={(ev) => cambiar('palabras', ev.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))} />
                </label>
              </div>
              <div className="ls-row">
                {COLORES.map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <div className="ls-color">
                      <input type="color" value={c[k]} onChange={(ev) => cambiar(k, ev.target.value)} />
                      <input type="text" value={c[k]} onChange={(ev) => cambiar(k, ev.target.value)} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ position: 'sticky', top: 16 }}>
              <div style={{ fontSize: 12, color: '#6b6b6b', marginBottom: 8 }}>Vista previa (checkout, con transferencia elegida)</div>
              <div style={{ background: '#f7f7f7', border: '1px dashed #d4d4d4', borderRadius: 12, padding: 16 }}>
                <Vista c={c} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AvisoTransferenciaConfig;
