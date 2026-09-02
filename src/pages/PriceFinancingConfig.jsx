import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Percent, Eye, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';
import './PriceFinancingConfig.css';

const DEFAULT_CONFIG = {
  enabled: true,
  showOnListing: true,
  showOnPDP: true,
  cashDiscountPercent: 0,
  transferDiscountPercent: 10,
  customMessage: '',
  installmentPlans: [
    { months: 3, interestFree: true, interestRate: 0, minAmount: 0 },
  ],
  cartProgressBar: { enabled: false },
};

const PREVIEW_PRICE = 25000;

function fmt(n) {
  return Math.round(n).toLocaleString('es-AR');
}

function PriceFinancingConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest(`/api/price-financing-config?storeId=${storeId}`);
        if (res?.success && res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const handlePlan = (index, patch) => {
    setConfig(c => ({
      ...c,
      installmentPlans: c.installmentPlans.map((p, i) => i === index ? { ...p, ...patch } : p),
    }));
  };

  const addPlan = () => {
    setConfig(c => ({
      ...c,
      installmentPlans: [...c.installmentPlans, { months: 6, interestFree: false, interestRate: 0, minAmount: 0 }],
    }));
  };

  const removePlan = (index) => {
    setConfig(c => ({
      ...c,
      installmentPlans: c.installmentPlans.filter((_, i) => i !== index),
    }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/price-financing-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config }),
      });
      if (res?.success) toast.success('Configuración guardada');
      else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [storeId, config, toast]);

  const install = async () => {
    setInstalling(true);
    try {
      const res = await apiRequest('/api/price-financing/install', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      if (res?.success) toast.success(res.message || 'Script instalado');
      else toast.error(res?.message || 'No se pudo instalar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="loading-state"><div className="spinner" /><p>Cargando…</p></div></div>;
  }

  const transferPrice = config.transferDiscountPercent > 0
    ? PREVIEW_PRICE * (1 - config.transferDiscountPercent / 100)
    : null;
  const cashPrice = config.cashDiscountPercent > 0
    ? PREVIEW_PRICE * (1 - config.cashDiscountPercent / 100)
    : null;

  const progressPlans = config.installmentPlans.filter(p => Number(p.minAmount) > 0);
  const nextPlan = progressPlans.length
    ? [...progressPlans].sort((a, b) => a.minAmount - b.minAmount)[0]
    : null;

  return (
    <div className="page-container pf-page">
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-back" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /> Volver</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary-outline" onClick={install} disabled={installing}
                style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', cursor: installing ? 'wait' : 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {installing ? 'Instalando…' : 'Instalar en TiendaNube'}
              </button>
              <button className="btn-primary-gradient" onClick={save} disabled={saving}>
                <Save size={18} />
                <span>{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">💳 Precios y Cuotas</h1>
            <p className="page-subtitle-modern">Mostrá descuentos por efectivo/transferencia y planes de cuotas en el listado y la página de producto</p>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 480px)', gap: 24, padding: 24, maxWidth: 1280, margin: '0 auto' }}>
        {/* Form */}
        <div className="pf-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Configuración</h2>
            <label className="toggle-switch" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!config.enabled} onChange={e => handle('enabled', e.target.checked)} />
              <span className="toggle-slider"></span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{config.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={!!config.showOnListing} onChange={e => handle('showOnListing', e.target.checked)} />
                Mostrar en listado de productos
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={!!config.showOnPDP} onChange={e => handle('showOnPDP', e.target.checked)} />
                Mostrar en página de producto
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="% Descuento efectivo">
                <input type="number" min="0" max="100" value={config.cashDiscountPercent}
                  onChange={e => handle('cashDiscountPercent', Number(e.target.value))} style={inp} />
              </Field>
              <Field label="% Descuento transferencia">
                <input type="number" min="0" max="100" value={config.transferDiscountPercent}
                  onChange={e => handle('transferDiscountPercent', Number(e.target.value))} style={inp} />
              </Field>
            </div>

            <Field label="Mensaje personalizado (opcional)">
              <input type="text" value={config.customMessage} placeholder="Ej: todos los precios son sin IVA"
                onChange={e => handle('customMessage', e.target.value)} style={inp} />
            </Field>

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Planes de cuotas</h3>
              <button onClick={addPlan} className="pf-btn-add"><Plus size={14} /> Agregar plan</button>
            </div>

            {config.installmentPlans.map((plan, i) => (
              <div key={i} className="pf-plan-row">
                <Field label="Meses">
                  <input type="number" min="1" value={plan.months}
                    onChange={e => handlePlan(i, { months: Number(e.target.value) })} style={inp} />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={!!plan.interestFree}
                    onChange={e => handlePlan(i, { interestFree: e.target.checked })} />
                  Sin interés
                </label>
                <Field label="% interés">
                  <input type="number" min="0" value={plan.interestRate || 0} disabled={plan.interestFree}
                    onChange={e => handlePlan(i, { interestRate: Number(e.target.value) })} style={inp} />
                </Field>
                <Field label="Monto mín. (carrito)">
                  <input type="number" min="0" value={plan.minAmount || 0}
                    onChange={e => handlePlan(i, { minAmount: Number(e.target.value) })} style={inp} />
                </Field>
                <button onClick={() => removePlan(i)} className="pf-btn-remove" title="Eliminar plan">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={!!config.cartProgressBar?.enabled}
                onChange={e => handle('cartProgressBar', { enabled: e.target.checked })} />
              Mostrar barra de progreso en el carrito hacia el próximo plan sin interés
            </label>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              Se activa solo si algún plan tiene un "Monto mínimo" mayor a 0.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#6b7280', fontSize: 13, fontWeight: 600 }}>
              <Eye size={16} /> Vista previa
            </div>
            <div style={{ background: '#f3f4f6', padding: 24, borderRadius: 14, border: '1px dashed #d1d5db' }}>
              <div style={{ background: '#fff', padding: 20, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Producto de ejemplo</div>
                <div style={{ height: 100, background: '#f3f4f6', borderRadius: 8, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 700 }}>${fmt(PREVIEW_PRICE)}</div>

                <div className="pf-preview-block">
                  {transferPrice !== null && (
                    <div className="pf-preview-line pf-preview-discount">
                      ${fmt(transferPrice)} por transferencia ({config.transferDiscountPercent}% OFF)
                    </div>
                  )}
                  {cashPrice !== null && (
                    <div className="pf-preview-line pf-preview-discount">
                      ${fmt(cashPrice)} en efectivo ({config.cashDiscountPercent}% OFF)
                    </div>
                  )}
                  {config.installmentPlans.map((plan, i) => plan.months ? (
                    <div key={i} className="pf-preview-line pf-preview-installments">
                      {plan.interestFree
                        ? `Hasta ${plan.months} cuotas sin interés de $${fmt(PREVIEW_PRICE / plan.months)}`
                        : `${plan.months} cuotas de $${fmt((PREVIEW_PRICE / plan.months) * (1 + (plan.interestRate || 0) / 100))}`}
                    </div>
                  ) : null)}
                  {config.customMessage && (
                    <div className="pf-preview-line pf-preview-message">{config.customMessage}</div>
                  )}
                </div>
              </div>

              {config.cartProgressBar?.enabled && nextPlan && (
                <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Carrito</div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    Te faltan ${fmt(nextPlan.minAmount * 0.4)} para acceder a {nextPlan.months} cuotas sin interés
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '60%', background: '#16a34a' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="pf-help" style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
              <strong>Para activarlo:</strong> guardá los cambios y tocá "Instalar en TiendaNube" una vez — el script queda instalado en la tienda y se actualiza solo cada vez que guardás cambios acá.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</label>
      {children}
    </div>
  );
}

export default PriceFinancingConfig;
