import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './StyleConfig.css';

const DEFAULT_CONFIG = {
  enabled: false,
  categoryId: '',
  categoryName: '',
  categoryUrl: '',
  productIds: [],
  featuredProducts: [],
  startDate: '',
  endDate: '',
  title: '🔥 Flash Sale',
  subtitle: 'Descuentos por tiempo limitado',
  countdownLabel: 'Termina en:',
  buttonText: 'Ver todos',
  badgeText: '🔥 FLASH',
  badgeBg: '#ff3c00',
  badgeTextColor: '#ffffff',
  badgeFontSize: 11,
  badgePosition: 'top-left',
  badgeBorderRadius: 6,
  frameBorderColor: '#ff3c00',
  frameBorderWidth: 2,
  frameBorderRadius: 12,
  frameGlowEnabled: true,
  cardCountdownEnabled: true,
  cardCountdownColor: '#ff3c00',
  cardCountdownFontSize: 11,
  categoryBannerEnabled: true,
  categoryBannerBg: '#ff3c00',
  categoryBannerTextColor: '#ffffff',
  detailBannerEnabled: true,
  detailBannerBg: '#fff3f0',
  detailBannerBorderColor: '#ff3c00',
  detailBannerTextColor: '#cc2200',
  sectionEnabled: true,
  sectionInjectSelector: '',
  sectionInjectPosition: 'after',
  sectionBg: '#ffffff',
  sectionTextColor: '#111111',
  sectionCardBg: '#ffffff',
  sectionFontFamily: "'Poppins', sans-serif",
  sectionColumns: 4,
  sectionMaxProducts: 8,
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="style-section" style={{ marginBottom: 16 }}>
      <button
        className="style-section-toggle"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', border: 'none', cursor: 'pointer', padding: '12px 16px', fontWeight: 600, fontSize: 14, color: 'var(--gl-text-primary)', borderRadius: open ? '12px 12px 0 0' : 12, background: 'var(--gl-bg-card-solid)', borderBottom: open ? '1px solid var(--gl-border)' : 'none' }}
      >
        {title}
        <span style={{ fontSize: 12, color: 'var(--gl-text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px', border: '1px solid var(--gl-border)', borderTop: 'none', borderRadius: '0 0 12px 12px', background: 'var(--gl-bg-card)' }}>{children}</div>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--gl-text-secondary)', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--gl-text-muted)' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
const colorRowStyle = { display: 'flex', alignItems: 'center', gap: 8 };

export default function FlashSaleConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const set = (patch) => setConfig(prev => ({ ...prev, ...patch }));

  // Cargar config guardada
  useEffect(() => {
    if (!storeId) return;
    apiRequest(`/api/style-config?storeId=${storeId}`)
      .then(data => {
        if (data.success && data.config?.flashSale) {
          setConfig({ ...DEFAULT_CONFIG, ...data.config.flashSale });
          if (data.config.updatedAt) setLastSaved(new Date(data.config.updatedAt));
        }
      })
      .catch(() => {});
  }, [storeId]);

  // Cargar categorías
  useEffect(() => {
    if (!storeId) return;
    setLoadingCats(true);
    apiRequest(`/api/tiendanube/categories?storeId=${storeId}`)
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar categorías'))
      .finally(() => setLoadingCats(false));
  }, [storeId]);

  const handleCategoryChange = (e) => {
    const cat = categories.find(c => String(c.id) === e.target.value);
    if (!cat) { set({ categoryId: '', categoryName: '', categoryUrl: '' }); return; }
    const name = cat.name?.es || cat.name?.pt || (typeof cat.name === 'string' ? cat.name : '');
    const url = cat.handle ? '/' + cat.handle : (cat.permalink || '');
    set({ categoryId: String(cat.id), categoryName: name, categoryUrl: url });
  };

  const fetchProducts = async () => {
    if (!config.categoryId) { toast.error('Seleccioná una categoría primero'); return; }
    setLoadingProducts(true);
    try {
      const data = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${config.categoryId}`);
      set({ productIds: data.productIds || [], featuredProducts: data.featuredProducts || [] });
      toast.success(`${(data.productIds || []).length} productos cargados`);
    } catch (e) {
      toast.error('Error al cargar productos: ' + e.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) { toast.error('No se encontró el ID de la tienda'); return; }
    setLoading(true);
    try {
      // Si hay categoría seleccionada pero no hay productos, fetchearlos primero
      let finalConfig = { ...config };
      if (config.categoryId && config.productIds.length === 0) {
        const data = await apiRequest(`/api/tiendanube/category-products?storeId=${storeId}&categoryId=${config.categoryId}`);
        finalConfig = { ...finalConfig, productIds: data.productIds || [], featuredProducts: data.featuredProducts || [] };
        setConfig(finalConfig);
      }

      const current = await apiRequest(`/api/style-config?storeId=${storeId}`);
      const fullConfig = (current.success && current.config) ? current.config : {};
      const data = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({ storeId, config: { ...fullConfig, flashSale: finalConfig } }),
      });
      if (data.success) {
        toast.success('Flash Sale guardado. Los cambios se verán en tu tienda en ~1 minuto.');
        setLastSaved(new Date());
      } else {
        toast.error('Error al guardar: ' + (data.message || 'Error desconocido'));
      }
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="style-config-page">
      <div className="style-config-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>⚡ Flash Sale</h1>
            {lastSaved && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Guardado {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button className="save-btn" onClick={handleSave} disabled={loading}>
          <Save size={15} />
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="style-config-content" style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* 1. General */}
        <Section title="⚙️ General">
          <Field label="Activar Flash Sale">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.enabled} onChange={e => set({ enabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>{config.enabled ? 'Activo' : 'Inactivo'}</span>
            </label>
          </Field>
          <Field label="Categoría" hint={loadingCats ? 'Cargando categorías…' : ''}>
            <select style={inputStyle} value={config.categoryId} onChange={handleCategoryChange} disabled={loadingCats}>
              <option value="">— Seleccioná una categoría —</option>
              {categories.map(c => {
                const name = c.name?.es || c.name?.pt || (typeof c.name === 'string' ? c.name : String(c.id));
                return <option key={c.id} value={String(c.id)}>{name}</option>;
              })}
            </select>
          </Field>
          <Field label="Fecha y hora de inicio" hint="Dejá vacío para que empiece al activar">
            <input type="datetime-local" style={inputStyle} value={config.startDate} onChange={e => set({ startDate: e.target.value })} />
          </Field>
          <Field label="Fecha y hora de fin">
            <input type="datetime-local" style={inputStyle} value={config.endDate} onChange={e => set({ endDate: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button
              onClick={fetchProducts}
              disabled={loadingProducts || !config.categoryId}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--gl-border)', borderRadius: 8, background: 'var(--gl-bg-card-solid)', color: 'var(--gl-text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <RefreshCw size={14} className={loadingProducts ? 'spin' : ''} />
              {loadingProducts ? 'Cargando…' : 'Actualizar productos'}
            </button>
            {config.productIds.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--gl-text-muted)' }}>
                {config.productIds.length} productos en la categoría, mostrando {Math.min(config.sectionMaxProducts || 8, config.featuredProducts.length)} en la sección
              </span>
            )}
          </div>
        </Section>

        {/* 2. Textos */}
        <Section title="✍️ Textos">
          <Field label="Título"><input style={inputStyle} value={config.title} onChange={e => set({ title: e.target.value })} /></Field>
          <Field label="Subtítulo"><input style={inputStyle} value={config.subtitle} onChange={e => set({ subtitle: e.target.value })} /></Field>
          <Field label="Texto del badge"><input style={inputStyle} value={config.badgeText} onChange={e => set({ badgeText: e.target.value })} /></Field>
          <Field label="Label del countdown (ej: 'Termina en:')"><input style={inputStyle} value={config.countdownLabel} onChange={e => set({ countdownLabel: e.target.value })} /></Field>
          <Field label="Texto del botón"><input style={inputStyle} value={config.buttonText} onChange={e => set({ buttonText: e.target.value })} /></Field>
        </Section>

        {/* 3. Marco del producto */}
        <Section title="🔲 Marco del producto">
          <Field label="Color del borde">
            <div style={colorRowStyle}>
              <input type="color" value={config.frameBorderColor} onChange={e => set({ frameBorderColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.frameBorderColor} onChange={e => set({ frameBorderColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Ancho del borde: ${config.frameBorderWidth}px`}>
            <input type="range" min={1} max={6} value={config.frameBorderWidth} onChange={e => set({ frameBorderWidth: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Border radius: ${config.frameBorderRadius}px`}>
            <input type="range" min={0} max={24} value={config.frameBorderRadius} onChange={e => set({ frameBorderRadius: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Sombra de color (glow)">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.frameGlowEnabled} onChange={e => set({ frameGlowEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar glow</span>
            </label>
          </Field>
        </Section>

        {/* 4. Badge */}
        <Section title="🏷️ Badge">
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.badgeBg} onChange={e => set({ badgeBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.badgeBg} onChange={e => set({ badgeBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.badgeTextColor} onChange={e => set({ badgeTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.badgeTextColor} onChange={e => set({ badgeTextColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Tamaño de fuente: ${config.badgeFontSize}px`}>
            <input type="range" min={9} max={18} value={config.badgeFontSize} onChange={e => set({ badgeFontSize: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Border radius: ${config.badgeBorderRadius}px`}>
            <input type="range" min={0} max={20} value={config.badgeBorderRadius} onChange={e => set({ badgeBorderRadius: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Posición">
            <select style={inputStyle} value={config.badgePosition} onChange={e => set({ badgePosition: e.target.value })}>
              <option value="top-left">Arriba izquierda</option>
              <option value="top-right">Arriba derecha</option>
            </select>
          </Field>
        </Section>

        {/* 5. Countdown en card */}
        <Section title="⏱️ Countdown en card">
          <Field label="Mostrar countdown en cada card">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.cardCountdownEnabled} onChange={e => set({ cardCountdownEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color del texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.cardCountdownColor} onChange={e => set({ cardCountdownColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.cardCountdownColor} onChange={e => set({ cardCountdownColor: e.target.value })} />
            </div>
          </Field>
          <Field label={`Tamaño de fuente: ${config.cardCountdownFontSize}px`}>
            <input type="range" min={9} max={16} value={config.cardCountdownFontSize} onChange={e => set({ cardCountdownFontSize: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
        </Section>

        {/* 6. Banner de categoría */}
        <Section title="📢 Banner de categoría" defaultOpen={false}>
          <Field label="Mostrar banner encima del grid de productos">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.categoryBannerEnabled} onChange={e => set({ categoryBannerEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.categoryBannerBg} onChange={e => set({ categoryBannerBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.categoryBannerBg} onChange={e => set({ categoryBannerBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.categoryBannerTextColor} onChange={e => set({ categoryBannerTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.categoryBannerTextColor} onChange={e => set({ categoryBannerTextColor: e.target.value })} />
            </div>
          </Field>
        </Section>

        {/* 7. Banner de producto */}
        <Section title="🏷️ Banner en ficha de producto" defaultOpen={false}>
          <Field label="Mostrar banner en la página del producto">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.detailBannerEnabled} onChange={e => set({ detailBannerEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label="Color de fondo">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerBg} onChange={e => set({ detailBannerBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerBg} onChange={e => set({ detailBannerBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de borde">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerBorderColor} onChange={e => set({ detailBannerBorderColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerBorderColor} onChange={e => set({ detailBannerBorderColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.detailBannerTextColor} onChange={e => set({ detailBannerTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.detailBannerTextColor} onChange={e => set({ detailBannerTextColor: e.target.value })} />
            </div>
          </Field>
        </Section>

        {/* 8. Sección inyectada */}
        <Section title="🛍️ Sección de productos destacados" defaultOpen={false}>
          <Field label="Mostrar sección de productos">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.sectionEnabled} onChange={e => set({ sectionEnabled: e.target.checked })} />
              <span style={{ fontSize: 13 }}>Activar</span>
            </label>
          </Field>
          <Field label={`Productos a mostrar: ${config.sectionMaxProducts}`}>
            <input type="range" min={4} max={10} value={config.sectionMaxProducts} onChange={e => set({ sectionMaxProducts: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label={`Columnas en desktop: ${config.sectionColumns}`}>
            <input type="range" min={2} max={5} value={config.sectionColumns} onChange={e => set({ sectionColumns: Number(e.target.value) })} style={{ width: '100%' }} />
          </Field>
          <Field label="Color de fondo de la sección">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionBg} onChange={e => set({ sectionBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionBg} onChange={e => set({ sectionBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de texto">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionTextColor} onChange={e => set({ sectionTextColor: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionTextColor} onChange={e => set({ sectionTextColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Color de fondo de los cards">
            <div style={colorRowStyle}>
              <input type="color" value={config.sectionCardBg} onChange={e => set({ sectionCardBg: e.target.value })} />
              <input style={{ ...inputStyle, width: 120 }} value={config.sectionCardBg} onChange={e => set({ sectionCardBg: e.target.value })} />
            </div>
          </Field>
          <Field label="Selector CSS de inyección" hint="Opcional. Vacío = se inserta automáticamente antes del footer. Ej: .main-content, #home-section">
            <input style={inputStyle} value={config.sectionInjectSelector} onChange={e => set({ sectionInjectSelector: e.target.value })} placeholder=".mi-seccion" />
          </Field>
          <Field label="Posición de inyección">
            <select style={inputStyle} value={config.sectionInjectPosition} onChange={e => set({ sectionInjectPosition: e.target.value })}>
              <option value="after">Después (after)</option>
              <option value="before">Antes (before)</option>
              <option value="append">Al final dentro (append)</option>
              <option value="prepend">Al inicio dentro (prepend)</option>
            </select>
          </Field>
        </Section>

      </div>
    </div>
  );
}
