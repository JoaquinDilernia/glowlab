import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Percent, Eye, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './PriceFinancingConfig.css';

const DEFAULT_CONFIG = {
  enabled: false,
  showOnListing: true,
  showOnPDP: true,
  cashDiscountPercent: 0,
  transferDiscountPercent: 10,
  transferLabel: 'por transferencia',
  cashLabel: 'en efectivo',
  installmentsFreeLabel: 'cuotas sin interés de',
  installmentsPaidLabel: 'cuotas de',
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

  if (loading) {
    return (
      <div className="page-container pf-page">
        <div className="pf-loading">
          <div className="pf-spinner" />
          <p>Cargando…</p>
        </div>
      </div>
    );
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
      <div className="pf-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="pf-topbar-actions">
          <button className="pf-btn-save" onClick={save} disabled={saving}>
            <Save size={16} />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="pf-hero">
        <div className="pf-hero-icon"><Percent size={22} /></div>
        <div>
          <h1>Precios y Cuotas</h1>
          <p>Descuentos por efectivo/transferencia y planes de cuotas, en el listado y la página de producto.</p>
        </div>
      </div>

      <div className="pf-layout">
        {/* Form */}
        <div className="config-section pf-form-section">
          <div className="section-header pf-section-header">
            <h2>Configuración</h2>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!config.enabled} onChange={e => handle('enabled', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="pf-block-title">Dónde se muestra</div>
          <div className="form-row pf-checks-row">
            <label className="pf-check">
              <input type="checkbox" checked={!!config.showOnListing} onChange={e => handle('showOnListing', e.target.checked)} />
              Listado de productos
            </label>
            <label className="pf-check">
              <input type="checkbox" checked={!!config.showOnPDP} onChange={e => handle('showOnPDP', e.target.checked)} />
              Página de producto
            </label>
          </div>

          <div className="pf-block-title">Descuentos</div>
          <div className="form-row">
            <div className="form-group">
              <label>% Descuento efectivo</label>
              <input type="number" min="0" max="100" value={config.cashDiscountPercent}
                onChange={e => handle('cashDiscountPercent', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Texto (efectivo)</label>
              <input type="text" value={config.cashLabel}
                onChange={e => handle('cashLabel', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>% Descuento transferencia</label>
              <input type="number" min="0" max="100" value={config.transferDiscountPercent}
                onChange={e => handle('transferDiscountPercent', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Texto (transferencia)</label>
              <input type="text" value={config.transferLabel}
                onChange={e => handle('transferLabel', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Texto cuotas sin interés</label>
              <input type="text" value={config.installmentsFreeLabel}
                onChange={e => handle('installmentsFreeLabel', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Texto cuotas con interés</label>
              <input type="text" value={config.installmentsPaidLabel}
                onChange={e => handle('installmentsPaidLabel', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Mensaje personalizado (opcional)</label>
            <input type="text" value={config.customMessage} placeholder="Ej: todos los precios son sin IVA"
              onChange={e => handle('customMessage', e.target.value)} />
          </div>

          <div className="pf-block-title pf-block-title-row">
            Planes de cuotas
            <button onClick={addPlan} className="pf-btn-add"><Plus size={14} /> Agregar plan</button>
          </div>

          <div className="pf-plans">
            {config.installmentPlans.map((plan, i) => (
              <div key={i} className="pf-plan-card">
                <div className="pf-plan-fields">
                  <div className="form-group pf-plan-field-sm">
                    <label>Meses</label>
                    <input type="number" min="1" value={plan.months}
                      onChange={e => handlePlan(i, { months: Number(e.target.value) })} />
                  </div>
                  <label className="pf-check pf-plan-interest-free">
                    <input type="checkbox" checked={!!plan.interestFree}
                      onChange={e => handlePlan(i, { interestFree: e.target.checked })} />
                    Sin interés
                  </label>
                  <div className="form-group pf-plan-field-sm">
                    <label>% interés</label>
                    <input type="number" min="0" value={plan.interestRate || 0} disabled={plan.interestFree}
                      onChange={e => handlePlan(i, { interestRate: Number(e.target.value) })} />
                  </div>
                  <div className="form-group pf-plan-field-md">
                    <label>Monto mín. carrito</label>
                    <input type="number" min="0" value={plan.minAmount || 0}
                      onChange={e => handlePlan(i, { minAmount: Number(e.target.value) })} />
                  </div>
                </div>
                <button onClick={() => removePlan(i)} className="pf-btn-remove" title="Eliminar plan">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="pf-block-title">Carrito</div>
          <label className="pf-check">
            <input type="checkbox" checked={!!config.cartProgressBar?.enabled}
              onChange={e => handle('cartProgressBar', { enabled: e.target.checked })} />
            Mostrar barra de progreso hacia el próximo plan sin interés
          </label>
          <p className="pf-hint">Se activa solo si algún plan tiene un "Monto mínimo" mayor a 0.</p>
        </div>

        {/* Preview */}
        <div className="pf-preview-col">
          <div className="pf-preview-sticky">
            <div className="pf-preview-label"><Eye size={15} /> Vista previa</div>

            <div className="pf-preview-card">
              <div className="pf-preview-thumb" />
              <div className="pf-preview-name">Producto de ejemplo</div>
              <div className="pf-preview-price">${fmt(PREVIEW_PRICE)}</div>

              <div className="pf-preview-block">
                {transferPrice !== null && (
                  <div className="pf-preview-line pf-preview-discount">
                    ${fmt(transferPrice)} {config.transferLabel} <span className="pf-pill">{config.transferDiscountPercent}% OFF</span>
                  </div>
                )}
                {cashPrice !== null && (
                  <div className="pf-preview-line pf-preview-discount">
                    ${fmt(cashPrice)} {config.cashLabel} <span className="pf-pill">{config.cashDiscountPercent}% OFF</span>
                  </div>
                )}
                {config.installmentPlans.map((plan, i) => plan.months ? (
                  <div key={i} className="pf-preview-line pf-preview-installments">
                    {plan.interestFree
                      ? `Hasta ${plan.months} ${config.installmentsFreeLabel} $${fmt(PREVIEW_PRICE / plan.months)}`
                      : `${plan.months} ${config.installmentsPaidLabel} $${fmt((PREVIEW_PRICE / plan.months) * (1 + (plan.interestRate || 0) / 100))}`}
                  </div>
                ) : null)}
                {config.customMessage && (
                  <div className="pf-preview-line pf-preview-message">{config.customMessage}</div>
                )}
              </div>
            </div>

            {config.cartProgressBar?.enabled && nextPlan && (
              <div className="pf-preview-card pf-preview-cart">
                <div className="pf-preview-name">Carrito</div>
                <div className="pf-preview-line" style={{ marginTop: 6 }}>
                  Te faltan ${fmt(nextPlan.minAmount * 0.4)} para acceder a {nextPlan.months} cuotas sin interés
                </div>
                <div className="pf-progress-bar"><div className="pf-progress-fill" style={{ width: '60%' }} /></div>
              </div>
            )}

            <div className="pf-help">
              <strong>Para activarlo:</strong> guardá los cambios. El módulo se activa solo en tu tienda y se actualiza cada vez que guardás cambios acá.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PriceFinancingConfig;
