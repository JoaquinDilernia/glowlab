import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Save, Power, Search, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './LocalStockConfig.css';

const ALLOWED_STORE_ID = '2547699';

const DEFAULT_CONFIG = {
  enabled: true,
  allowedWarehouses: ['Belgrano', 'Las Lomas'],
  title: 'Disponibilidad en sucursales',
  buttonText: 'Ver disponibilidad en locales',
  inStockLabel: 'Disponible',
  lowStockLabel: 'Quedan pocos',
  outOfStockLabel: 'No disponible',
  lowThreshold: 5,
  disclaimer: 'El stock puede variar por las ventas del local.',
  primaryColor: '#353434',
  textColor: '#353434',
  bgColor: '#ffffff',
  displayOnlyPrefix: 'M',
  displayOnlyTitle: 'Producto solo de exhibición',
  displayOnlyText: 'Disponible para ver en el local pero no hay stock para llevárselo en el momento. Se puede comprar y coordinamos el retiro o el envío del mismo.',
  displayOnlyExhibitedLabel: 'Exhibido',
  displayOnlyNotExhibitedLabel: 'No exhibido',
  headerBg: '#ffffff',
  headerTextColor: '#353434',
  showHeaderIcon: false,
  modalBorderColor: '#353434',
};

function LocalStockConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const isAllowed = String(storeId) === ALLOWED_STORE_ID;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [newWarehouse, setNewWarehouse] = useState('');

  // Tester
  const [testSku, setTestSku] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!isAllowed) {
      setLoading(false);
      return;
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = async () => {
    try {
      const res = await apiRequest(`/api/local-stock-config?storeId=${storeId}`);
      if (res?.success && res.config) {
        setConfig({ ...DEFAULT_CONFIG, ...res.config });
      }
    } catch (e) {
      console.error('Error cargando config:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (overrides = {}) => {
    setSaving(true);
    try {
      const merged = { ...config, ...overrides };
      const res = await apiRequest('/api/local-stock-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: merged }),
      });
      if (res?.success) {
        toast.success('Configuración guardada');
        if (overrides && typeof overrides === 'object') {
          setConfig((c) => ({ ...c, ...overrides }));
        }
      } else {
        toast.error(res?.error || 'No se pudo guardar');
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => {
    const next = !config.enabled;
    setConfig((c) => ({ ...c, enabled: next }));
    saveConfig({ enabled: next });
  };

  const addWarehouse = () => {
    const v = newWarehouse.trim();
    if (!v) return;
    if (config.allowedWarehouses.includes(v)) {
      toast.error('Ese depósito ya está en la lista');
      return;
    }
    setConfig((c) => ({ ...c, allowedWarehouses: [...c.allowedWarehouses, v] }));
    setNewWarehouse('');
  };

  const removeWarehouse = (name) => {
    setConfig((c) => ({
      ...c,
      allowedWarehouses: c.allowedWarehouses.filter((w) => w !== name),
    }));
  };

  const handleField = (key) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setConfig((c) => ({ ...c, [key]: val }));
  };

  const testStock = async () => {
    const sku = testSku.trim();
    if (!sku) {
      toast.error('Ingresá un SKU');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest(
        `/api/odoo-stock?storeId=${storeId}&sku=${encodeURIComponent(sku)}&all=1`
      );
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
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
    return (
      <div className="local-stock-page">
        <div className="ls-loading">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="local-stock-page">
      <header className="ls-header">
        <div className="ls-header-icon"><MapPin size={22} /></div>
        <div>
          <h1>Stock Altorancho</h1>
          <p>Mostrá la disponibilidad real en tus locales directo en la página de producto.</p>
        </div>
        <button
          className={`ls-toggle ${config.enabled ? 'on' : 'off'}`}
          onClick={toggleEnabled}
          disabled={saving}
        >
          <Power size={16} />
          {config.enabled ? 'Activo' : 'Desactivado'}
        </button>
      </header>

      <div className="ls-grid">
        {/* Depósitos visibles */}
        <section className="ls-card">
          <h2>Depósitos visibles</h2>
          <p className="ls-help">
            Sólo se muestran los depósitos cuyo nombre coincida (parcialmente) con esta lista.
          </p>
          <div className="ls-warehouses">
            {config.allowedWarehouses.map((w) => (
              <div key={w} className="ls-chip">
                <span>{w}</span>
                <button onClick={() => removeWarehouse(w)} aria-label="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="ls-add-row">
            <input
              type="text"
              placeholder="Nombre del depósito (ej: Belgrano)"
              value={newWarehouse}
              onChange={(e) => setNewWarehouse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWarehouse()}
            />
            <button onClick={addWarehouse} className="ls-btn-secondary">
              <Plus size={16} /> Agregar
            </button>
          </div>
        </section>

        {/* Textos */}
        <section className="ls-card">
          <h2>Textos del popup</h2>
          <label>
            Texto del botón
            <input type="text" value={config.buttonText} onChange={handleField('buttonText')} />
          </label>
          <label>
            Título del popup
            <input type="text" value={config.title} onChange={handleField('title')} />
          </label>
          <div className="ls-row">
            <label>
              Etiqueta "Disponible"
              <input type="text" value={config.inStockLabel} onChange={handleField('inStockLabel')} />
            </label>
            <label>
              Etiqueta "Poco stock"
              <input type="text" value={config.lowStockLabel} onChange={handleField('lowStockLabel')} />
            </label>
            <label>
              Etiqueta "Sin stock"
              <input type="text" value={config.outOfStockLabel} onChange={handleField('outOfStockLabel')} />
            </label>
          </div>
          <label>
            Umbral de "Quedan pocos" (cantidad menor a este número)
            <input
              type="number"
              min={1}
              value={config.lowThreshold}
              onChange={handleField('lowThreshold')}
            />
          </label>
          <label>
            Disclaimer
            <textarea rows={2} value={config.disclaimer} onChange={handleField('disclaimer')} />
          </label>
        </section>

        {/* Diseño */}
        <section className="ls-card">
          <h2>Diseño</h2>
          <div className="ls-row">
            <label>
              Color principal
              <div className="ls-color">
                <input type="color" value={config.primaryColor} onChange={handleField('primaryColor')} />
                <input type="text" value={config.primaryColor} onChange={handleField('primaryColor')} />
              </div>
            </label>
            <label>
              Texto
              <div className="ls-color">
                <input type="color" value={config.textColor} onChange={handleField('textColor')} />
                <input type="text" value={config.textColor} onChange={handleField('textColor')} />
              </div>
            </label>
            <label>
              Fondo
              <div className="ls-color">
                <input type="color" value={config.bgColor} onChange={handleField('bgColor')} />
                <input type="text" value={config.bgColor} onChange={handleField('bgColor')} />
              </div>
            </label>
          </div>
        </section>

        {/* Tester */}
        <section className="ls-card">
          <h2>Probar SKU</h2>
          <p className="ls-help">Consultá la API de Odoo en vivo para ver qué depósitos devuelve un SKU.</p>
          <div className="ls-add-row">
            <input
              type="text"
              placeholder="SKU (ej: TMA023CH)"
              value={testSku}
              onChange={(e) => setTestSku(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && testStock()}
            />
            <button onClick={testStock} disabled={testing} className="ls-btn-secondary">
              <Search size={16} /> {testing ? 'Consultando...' : 'Probar'}
            </button>
          </div>
          {testResult && (
            <div className="ls-test-result">
              {testResult.success ? (
                <>
                  <div className="ls-test-meta">
                    SKU: <strong>{testResult.sku}</strong> · {testResult.stock?.length || 0} depósitos
                  </div>
                  {(testResult.stock || []).length === 0 ? (
                    <div className="ls-empty">No se encontró stock para este SKU.</div>
                  ) : (
                    <table className="ls-test-table">
                      <thead>
                        <tr><th>Depósito</th><th>ID</th><th>Cantidad</th><th>Visible</th></tr>
                      </thead>
                      <tbody>
                        {testResult.stock.map((s, i) => {
                          const visible = config.allowedWarehouses.some((w) =>
                            s.warehouse.toLowerCase().includes(w.toLowerCase())
                          );
                          return (
                            <tr key={i}>
                              <td>{s.warehouse}</td>
                              <td>{s.warehouse_id}</td>
                              <td>{s.qty}</td>
                              <td>{visible ? '✓' : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <div className="ls-error">{testResult.error || 'Error en la consulta'}</div>
              )}
            </div>
          )}
        </section>

        {/* Exhibición */}
        <section className="ls-card ls-card--wide">
          <h2>Productos de exhibición</h2>
          <p className="ls-help">
            Los productos cuyo SKU empiece con el prefijo indicado se muestran como "solo de exhibición" con un banner informativo y etiquetas propias.
          </p>
          <label>
            Prefijo de SKU de exhibición
            <input
              type="text"
              value={config.displayOnlyPrefix ?? 'M'}
              onChange={handleField('displayOnlyPrefix')}
              placeholder="Ej: M"
              style={{ maxWidth: 120 }}
            />
          </label>
          <label>
            Título del banner
            <input type="text" value={config.displayOnlyTitle ?? ''} onChange={handleField('displayOnlyTitle')} />
          </label>
          <label>
            Texto del banner
            <textarea rows={3} value={config.displayOnlyText ?? ''} onChange={handleField('displayOnlyText')} />
          </label>
          <div className="ls-row">
            <label>
              Etiqueta cuando exhibe
              <input type="text" value={config.displayOnlyExhibitedLabel ?? 'Exhibido'} onChange={handleField('displayOnlyExhibitedLabel')} />
            </label>
            <label>
              Etiqueta cuando no exhibe
              <input type="text" value={config.displayOnlyNotExhibitedLabel ?? 'No exhibido'} onChange={handleField('displayOnlyNotExhibitedLabel')} />
            </label>
          </div>
        </section>

        {/* Apariencia del modal */}
        <section className="ls-card ls-card--wide">
          <h2>Apariencia del modal</h2>
          <div className="ls-row">
            <label>
              Color de fondo del encabezado
              <input type="color" value={config.headerBg ?? '#ffffff'} onChange={handleField('headerBg')} />
            </label>
            <label>
              Color de texto del encabezado
              <input type="color" value={config.headerTextColor ?? '#353434'} onChange={handleField('headerTextColor')} />
            </label>
            <label>
              Color de borde del modal
              <input type="color" value={config.modalBorderColor ?? '#353434'} onChange={handleField('modalBorderColor')} />
            </label>
          </div>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={config.showHeaderIcon ?? false}
              onChange={e => setConfig(prev => ({ ...prev, showHeaderIcon: e.target.checked }))}
            />
            Mostrar ícono en el encabezado
          </label>
        </section>

        {/* Instalación */}
        <section className="ls-card ls-card--wide ls-card--info">
          <h2>Instalación</h2>
          <p className="ls-help">
            El widget se instala automáticamente desde el panel de TiendaNube Partner.
            No necesitás copiar ni pegar nada en el editor de tema: con activar el módulo desde acá alcanza.
          </p>
        </section>
      </div>

      <div className="ls-actions">
        <button className="ls-btn-primary" onClick={() => saveConfig()} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

export default LocalStockConfig;
