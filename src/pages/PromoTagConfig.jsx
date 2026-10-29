import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Tag, Upload } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';
import './VariantGroupsConfig.css';
import './PromoTagConfig.css';
import PromoTagCatalogSection from './PromoTagCatalogSection';

// Piloto: solo Alto Rancho (ver Sidebar.jsx STORE_EXCLUSIVE_ITEMS).
const ALLOWED_STORE_IDS = ['2547699', '5320806', '6854698'];

const DEFAULT_CONFIG = {
  enabled: false,
  text: 'MEGA CYBER',
  bgColor: '#111111',
  textColor: '#ffffff',
  font: 'Poppins',
  size: 'md',
  radius: 4,
  bold: true,
  showOnListing: true,
  showOnPDP: true,
  source: null,
  skuCount: 0,
  productCount: 0,
  unmatchedSample: [],
  unmatchedCount: 0,
};

// Textos por etiqueta: la promo (Excel por SKU) y la de categoría/productos.
const SLOT_COPY = {
  promo: {
    title: 'Etiqueta Promo',
    subtitle: 'Un cartel en la esquina superior derecha de la foto de los productos del evento (ej. Mega Cyber).',
    text: 'MEGA CYBER',
  },
  cat: {
    title: 'Etiqueta por Categoría',
    subtitle: 'Un cartel en la esquina de la foto de los productos de una categoría o elegidos a mano (ej. Últimas unidades). Si un producto también tiene la Etiqueta Promo, van una abajo de la otra.',
    text: 'ÚLTIMAS UNIDADES',
  },
};

const FONT_LABELS = { inherit: 'La de la tienda' };
// Mismos valores que SIZES en functions/promo-tag.js, para la vista previa.
const SIZES = { sm: [11, 4, 8], md: [13, 5, 10], lg: [15, 7, 13] };

const norm = (s) => String(s ?? '').trim().toLowerCase();

// Lee la primera hoja del Excel: encabezados + filas como arrays.
async function readSheet(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const headers = (rows[0] || []).map(h => String(h).trim());
  return { headers, rows: rows.slice(1).filter(r => r.some(c => String(c).trim())) };
}

export default function PromoTagConfig({ slot = 'promo' }) {
  const copy = SLOT_COPY[slot] || SLOT_COPY.promo;
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  const fileInput = useRef(null);

  useEffect(() => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) navigate('/dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, text: copy.text });
  const [fonts, setFonts] = useState(['inherit', 'Poppins']);
  // Excel leido en el navegador, antes de aplicarlo
  const [sheet, setSheet] = useState(null);
  const [skuCol, setSkuCol] = useState(0);
  const [eventCol, setEventCol] = useState(0);
  const [eventValue, setEventValue] = useState('');

  useEffect(() => {
    if (!ALLOWED_STORE_IDS.includes(String(storeId))) return;
    apiRequest(`/api/promo-tag-config?storeId=${storeId}&slot=${slot}`)
      .then(res => {
        if (res?.success && res.config) setConfig({ ...DEFAULT_CONFIG, ...res.config });
        if (res?.fonts) setFonts(res.fonts);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [storeId, slot]);

  // Los fonts de Google se cargan para que la vista previa se vea como en la tienda.
  useEffect(() => {
    if (config.font === 'inherit' || document.getElementById(`pn-pt-font-${config.font}`)) return;
    const link = document.createElement('link');
    link.id = `pn-pt-font-${config.font}`;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${config.font.replace(/ /g, '+')}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [config.font]);

  const set = (field, value) => setConfig(c => ({ ...c, [field]: value }));

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/promo-tag-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, slot, config }),
      });
      if (res?.success) {
        setConfig(c => ({ ...c, ...res.config }));
        toast.success('Configuración guardada');
      } else toast.error(res?.message || 'Error al guardar');
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [storeId, slot, config, toast]);

  const onFile = async (file) => {
    if (!file) return;
    try {
      const parsed = await readSheet(file);
      if (!parsed.headers.length) throw new Error('El Excel está vacío.');
      // Columnas sugeridas: "SKU" y la del evento ("Nombre Promo", "Evento"...)
      const sku = parsed.headers.findIndex(h => norm(h) === 'sku');
      const event = parsed.headers.findIndex(h => /promo|evento/.test(norm(h)));
      setSheet({ ...parsed, fileName: file.name });
      setSkuCol(sku >= 0 ? sku : 0);
      setEventCol(event >= 0 ? event : 0);
      setEventValue('');
    } catch (e) {
      toast.error(e.message || 'No pudimos leer el Excel.');
    }
  };

  // Valores distintos de la columna del evento, con cuantas filas tiene cada uno
  const eventValues = useMemo(() => {
    if (!sheet) return [];
    const counts = new Map();
    for (const row of sheet.rows) {
      const v = String(row[eventCol] ?? '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sheet, eventCol]);

  useEffect(() => {
    if (!eventValues.length || eventValues.some(([v]) => v === eventValue)) return;
    // Por defecto, el valor que mas se parezca al texto de la etiqueta
    const guess = eventValues.find(([v]) => norm(v) === norm(config.text)) || eventValues[0];
    setEventValue(guess[0]);
  }, [eventValues, eventValue, config.text]);

  const selectedSkus = useMemo(() => {
    if (!sheet || !eventValue) return [];
    const skus = sheet.rows
      .filter(r => String(r[eventCol] ?? '').trim() === eventValue)
      .map(r => String(r[skuCol] ?? '').trim().toUpperCase())
      .filter(Boolean);
    return [...new Set(skus)];
  }, [sheet, skuCol, eventCol, eventValue]);

  const applySkus = async () => {
    setApplying(true);
    try {
      const res = await apiRequest('/api/promo-tag-skus', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          skus: selectedSkus,
          source: { fileName: sheet.fileName, column: sheet.headers[eventCol], value: eventValue },
        }),
      });
      if (!res?.success) throw new Error(res?.message || 'No pudimos cargar los productos.');
      setConfig(c => ({ ...c, ...res.config }));
      setSheet(null);
      toast.success(`${res.config.productCount} productos con etiqueta`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setApplying(false);
    }
  };

  const [fontPx, padY, padX] = SIZES[config.size] || SIZES.md;
  const previewStyle = {
    background: config.bgColor,
    color: config.textColor,
    fontFamily: config.font === 'inherit' ? 'inherit' : `"${config.font}", sans-serif`,
    fontSize: fontPx,
    fontWeight: config.bold ? 700 : 400,
    padding: `${padY}px ${padX}px`,
    borderRadius: config.radius,
  };

  if (loading) {
    return (
      <div className="page-container vg-page">
        <div className="vg-loading"><div className="vg-spinner" /><p>Cargando…</p></div>
      </div>
    );
  }

  const source = config.source;

  return (
    <div className="page-container vg-page">
      <div className="vg-topbar">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Volver
        </button>
        <button className="vg-btn-save" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="vg-hero">
        <div className="vg-hero-icon"><Tag size={22} /></div>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <h2>Diseño</h2>
          <label className="toggle-switch" title="Mostrar la etiqueta en la tienda">
            <input type="checkbox" checked={config.enabled === true}
              onChange={e => set('enabled', e.target.checked)} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="pt-layout">
          <div className="pt-form">
            <div className="vg-row">
              <div className="vg-field">
                <label>Texto</label>
                <input type="text" maxLength={30} value={config.text} onChange={e => set('text', e.target.value)} />
              </div>
              <div className="vg-field">
                <label>Tipografía</label>
                <select value={config.font} onChange={e => set('font', e.target.value)}>
                  {fonts.map(f => <option key={f} value={f}>{FONT_LABELS[f] || f}</option>)}
                </select>
              </div>
            </div>
            <div className="vg-row">
              <div className="vg-field pt-color">
                <label>Fondo</label>
                <input type="color" value={config.bgColor} onChange={e => set('bgColor', e.target.value)} />
              </div>
              <div className="vg-field pt-color">
                <label>Texto</label>
                <input type="color" value={config.textColor} onChange={e => set('textColor', e.target.value)} />
              </div>
              <div className="vg-field">
                <label>Tamaño</label>
                <select value={config.size} onChange={e => set('size', e.target.value)}>
                  <option value="sm">Chico</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                </select>
              </div>
              <div className="vg-field pt-radius">
                <label>Borde redondeado · {config.radius}px</label>
                <input type="range" min={0} max={30} step={1} value={config.radius}
                  onChange={e => set('radius', Number(e.target.value))} />
              </div>
            </div>
            <div className="vg-row">
              <label className="vg-check">
                <input type="checkbox" checked={config.bold} onChange={e => set('bold', e.target.checked)} /> Negrita
              </label>
              <label className="vg-check">
                <input type="checkbox" checked={config.showOnListing} onChange={e => set('showOnListing', e.target.checked)} /> Mostrar en listado
              </label>
              <label className="vg-check">
                <input type="checkbox" checked={config.showOnPDP} onChange={e => set('showOnPDP', e.target.checked)} /> Mostrar en ficha de producto
              </label>
            </div>
          </div>

          <div className="pt-preview" aria-label="Vista previa">
            <div className="pt-preview-img">
              <span className="pt-preview-tag" style={previewStyle}>{config.text || copy.text}</span>
            </div>
            <span className="vg-hint">Vista previa</span>
          </div>
        </div>
      </div>

      {slot === 'cat' ? (
        <PromoTagCatalogSection storeId={storeId} config={config}
          onSaved={({ productCount, categories, products, resolvedAt }) =>
            setConfig(c => ({ ...c, productCount, categories, products, resolvedAt }))} />
      ) : (
      <div className="config-section">
        <div className="section-header">
          <h2>Productos</h2>
          <button className="vg-btn-save" onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> Subir Excel
          </button>
          <input ref={fileInput} type="file" hidden accept=".xlsx,.xls,.csv"
            onChange={e => { onFile(e.target.files[0]); e.target.value = ''; }} />
        </div>

        {source ? (
          <p className="vg-hint">
            <b>{config.productCount} productos</b> con etiqueta ({config.skuCount} SKUs de "{source.value}" en
            "{source.fileName}", cargado el {new Date(source.loadedAt).toLocaleString('es-AR')}).
            {config.unmatchedCount > 0 && ` ${config.unmatchedCount} SKUs no están en la tienda.`}
          </p>
        ) : (
          <p className="vg-hint">Todavía no cargaste productos. Subí el Excel de precios y elegí el evento.</p>
        )}
        {config.unmatchedCount > 0 && !sheet && (
          <details className="pt-unmatched">
            <summary>Ver SKUs que no están en la tienda</summary>
            <p className="vg-hint">
              {config.unmatchedSample.join(', ')}
              {config.unmatchedCount > config.unmatchedSample.length && ` y ${config.unmatchedCount - config.unmatchedSample.length} más`}
            </p>
          </details>
        )}

        {sheet && (
          <div className="pt-import">
            <p className="vg-hint"><b>{sheet.fileName}</b> · {sheet.rows.length} filas</p>
            <div className="vg-row">
              <div className="vg-field">
                <label>Columna de SKU</label>
                <select value={skuCol} onChange={e => setSkuCol(Number(e.target.value))}>
                  {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                </select>
              </div>
              <div className="vg-field">
                <label>Columna del evento</label>
                <select value={eventCol} onChange={e => { setEventCol(Number(e.target.value)); setEventValue(''); }}>
                  {sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
                </select>
              </div>
              <div className="vg-field">
                <label>Evento</label>
                <select value={eventValue} onChange={e => setEventValue(e.target.value)}>
                  {eventValues.map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
                </select>
              </div>
            </div>
            <div className="vg-row">
              <button className="vg-btn-save" onClick={applySkus} disabled={applying || !selectedSkus.length}>
                {applying ? 'Buscando productos en la tienda…' : `Usar ${selectedSkus.length} SKUs`}
              </button>
              <button className="btn-back" onClick={() => setSheet(null)} disabled={applying}>Cancelar</button>
            </div>
            <p className="vg-hint">Reemplaza la lista actual. Puede tardar unos segundos: se revisa todo el catálogo.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
