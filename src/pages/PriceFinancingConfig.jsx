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
  discountThresholdBar: { enabled: false, minAmount: 600000, discountPercent: 10 },
  discountColorEnabled: false,
  discountColor: '#e11d48',
  blockFontFamily: 'inherit',
  blockFontSize: 13,
  blockDiscountColor: '#16a34a',
  blockDiscountBold: true,
  blockInstallmentsColor: '#444444',
};

const BLOCK_FONT_OPTIONS = [
  { value: 'inherit', label: 'Igual que la tienda (por defecto)' },
  { value: 'system-ui', label: 'System (nativa)' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Georgia', serif", label: 'Georgia' },
];

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

  // Mismo criterio que el widget: el plan de más cuotas cuyo mínimo el
  // precio de ejemplo alcanza a cubrir -- se muestra uno solo, no todos.
  const bestPlan = [...config.installmentPlans]
    .filter(p => p.months)
    .sort((a, b) => b.months - a.months)
    .find(p => PREVIEW_PRICE >= (p.minAmount || 0)) || null;

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

          <div className="pf-block-title">Diseño del texto (descuento y cuotas)</div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipografía</label>
              <select value={config.blockFontFamily} onChange={e => handle('blockFontFamily', e.target.value)}>
                {BLOCK_FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tamaño (px)</label>
              <input type="number" min={10} max={20} value={config.blockFontSize}
                onChange={e => handle('blockFontSize', Math.min(20, Math.max(10, Number(e.target.value) || 10)))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Color línea de descuento (efectivo/transferencia)</label>
              <div className="pf-color-row">
                <input type="color" value={config.blockDiscountColor} onChange={e => handle('blockDiscountColor', e.target.value)} />
                <input type="text" value={config.blockDiscountColor} onChange={e => handle('blockDiscountColor', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Color línea de cuotas</label>
              <div className="pf-color-row">
                <input type="color" value={config.blockInstallmentsColor} onChange={e => handle('blockInstallmentsColor', e.target.value)} />
                <input type="text" value={config.blockInstallmentsColor} onChange={e => handle('blockInstallmentsColor', e.target.value)} />
              </div>
            </div>
          </div>
          <label className="pf-check">
            <input type="checkbox" checked={!!config.blockDiscountBold} onChange={e => handle('blockDiscountBold', e.target.checked)} />
            Negrita en la línea de descuento
          </label>

          <div className="pf-block-title">Precio con descuento</div>
          <label className="pf-check">
            <input type="checkbox" checked={!!config.discountColorEnabled} onChange={e => handle('discountColorEnabled', e.target.checked)} />
            Si el producto tiene descuento (precio tachado), pintar el precio de un color
          </label>
          {config.discountColorEnabled && (
            <div className="form-group pf-discount-color-row">
              <label>Color</label>
              <div className="pf-color-row">
                <input type="color" value={config.discountColor} onChange={e => handle('discountColor', e.target.value)} />
                <input type="text" value={config.discountColor} onChange={e => handle('discountColor', e.target.value)} />
              </div>
            </div>
          )}

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
          <p className="pf-hint">En el precio del producto se muestra un solo plan: el de más cuotas cuyo "Monto mín." el precio de ese producto alcanza a cubrir (ej: 3 sin mínimo, 6 desde $300.000, 12 desde $900.000 → un producto de $1.000.000 muestra solo 12 cuotas).</p>

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

          <label className="pf-check" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={!!config.discountThresholdBar?.enabled}
              onChange={e => handle('discountThresholdBar', { ...config.discountThresholdBar, enabled: e.target.checked })} />
            Mostrar barra de progreso hacia un descuento por monto
          </label>
          <p className="pf-hint">Ej: "10% OFF superando $600.000". El descuento se configura en TiendaNube (promoción o cupón) -- esta barra solo muestra el avance para incentivar a sumar productos.</p>
          {config.discountThresholdBar?.enabled && (
            <div className="pf-plan-fields" style={{ marginTop: 8 }}>
              <div className="form-group pf-plan-field-md">
                <label>Monto mín. carrito</label>
                <input type="number" min="0" value={config.discountThresholdBar.minAmount || 0}
                  onChange={e => handle('discountThresholdBar', { ...config.discountThresholdBar, minAmount: Number(e.target.value) })} />
              </div>
              <div className="form-group pf-plan-field-sm">
                <label>% descuento</label>
                <input type="number" min="0" max="100" value={config.discountThresholdBar.discountPercent || 0}
                  onChange={e => handle('discountThresholdBar', { ...config.discountThresholdBar, discountPercent: Number(e.target.value) })} />
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="pf-preview-col">
          <div className="pf-preview-sticky">
            <div className="pf-preview-label"><Eye size={15} /> Vista previa</div>

            <div className="pf-preview-card">
              <div className="pf-preview-thumb" />
              <div className="pf-preview-name">Producto de ejemplo</div>
              <div className="pf-preview-price">${fmt(PREVIEW_PRICE)}</div>

              <div className="pf-preview-block" style={{ fontFamily: config.blockFontFamily === 'inherit' ? undefined : config.blockFontFamily, fontSize: config.blockFontSize }}>
                {transferPrice !== null && (
                  <div className="pf-preview-line pf-preview-discount" style={{ color: config.blockDiscountColor, fontWeight: config.blockDiscountBold ? 600 : 400 }}>
                    ${fmt(transferPrice)} {config.transferLabel} <span className="pf-pill">{config.transferDiscountPercent}% OFF</span>
                  </div>
                )}
                {cashPrice !== null && (
                  <div className="pf-preview-line pf-preview-discount" style={{ color: config.blockDiscountColor, fontWeight: config.blockDiscountBold ? 600 : 400 }}>
                    ${fmt(cashPrice)} {config.cashLabel} <span className="pf-pill">{config.cashDiscountPercent}% OFF</span>
                  </div>
                )}
                {bestPlan && (
                  <div className="pf-preview-line pf-preview-installments" style={{ color: config.blockInstallmentsColor }}>
                    {bestPlan.interestFree
                      ? `Hasta ${bestPlan.months} ${config.installmentsFreeLabel} $${fmt(PREVIEW_PRICE / bestPlan.months)}`
                      : `${bestPlan.months} ${config.installmentsPaidLabel} $${fmt((PREVIEW_PRICE / bestPlan.months) * (1 + (bestPlan.interestRate || 0) / 100))}`}
                  </div>
                )}
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

            {config.discountThresholdBar?.enabled && config.discountThresholdBar.minAmount > 0 && (
              <div className="pf-preview-card pf-preview-cart">
                <div className="pf-preview-name">Carrito</div>
                <div className="pf-preview-line" style={{ marginTop: 6 }}>
                  Te faltan ${fmt(config.discountThresholdBar.minAmount * 0.4)} para tu {config.discountThresholdBar.discountPercent}% OFF
                </div>
                <div className="pf-progress-bar"><div className="pf-progress-fill" style={{ width: '40%' }} /></div>
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
