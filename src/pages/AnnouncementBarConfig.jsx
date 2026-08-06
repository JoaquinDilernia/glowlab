import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Megaphone, Upload, X, BarChart2, Settings } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../config';
import './BannerConfig.css';

const DEFAULT_BAR = {
  enabled: false,
  text: 'Comprá ahora y pagá en cuotas con Mercado Libre',
  bgColor: '#FFE600',
  textColor: '#333333',
  fontSize: 14,
  fontWeight: '600',
  paddingV: 10,
  logoUrl: '',
  buttonText: 'Ver más',
  buttonUrl: '',
  buttonBgColor: '#3483FA',
  buttonTextColor: '#ffffff',
  buttonBorderRadius: 4,
  injectSelector: '',
  injectPosition: 'before',
};

const TABS = [
  { id: 'config', label: 'Configuración', icon: Settings },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
];

const FILTERS = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'all', label: 'Todo' },
];

function getFilteredDays(daily, filterDays) {
  if (!daily) return [];
  const entries = Object.entries(daily)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (filterDays === 'all') return entries;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(filterDays, 10));
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter(e => e.date >= cutoffStr);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function AnnouncementBarConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [activeTab, setActiveTab] = useState('config');
  const [bar, setBar] = useState(DEFAULT_BAR);
  const [docId, setDocId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clicks, setClicks] = useState(null);
  const [dailyStats, setDailyStats] = useState(null);
  const [filter, setFilter] = useState('30');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef(null);

  const patch = (updates) => setBar(prev => ({ ...prev, ...updates }));

  /* ── Load ── */
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        const data = await apiRequest(`/api/banners?storeId=${storeId}`);
        if (data.banner) {
          setDocId(data.banner.id);
          if (data.banner.announcementBar) {
            setBar({ ...DEFAULT_BAR, ...data.banner.announcementBar });
          }
          const stats = data.banner.announcementBarStats || {};
          setClicks(stats.clicks ?? 0);
          setDailyStats(stats.daily || {});
        }
      } catch {
        toast.error('Error cargando configuración');
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  /* ── Upload logo ── */
  const uploadLogo = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) { toast.error('La imagen supera 4MB'); return; }
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await apiRequest('/api/upload-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, fileName: file.name, fileData: base64, folder: 'bar-logos' }),
      });
      if (!response.success) throw new Error(response.message);
      patch({ logoUrl: response.url });
    } catch (e) {
      toast.error('Error al subir logo: ' + e.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      let id = docId;
      if (!id) {
        const d = await apiRequest('/api/banners/create', {
          method: 'POST',
          body: JSON.stringify({ storeId, enabled: false }),
        });
        id = d.id;
        setDocId(id);
      }
      await apiRequest(`/api/banners/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ storeId, announcementBar: bar }),
      });
      toast.success('Barra guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [storeId, docId, bar]);

  if (loading) {
    return (
      <div className="banner-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</div>
      </div>
    );
  }

  const previewBg = bar.bgColor || '#FFE600';
  const previewTc = bar.textColor || '#333333';

  /* ── Analytics computed ── */
  const filteredDays = getFilteredDays(dailyStats, filter);
  const filteredTotal = filteredDays.reduce((s, e) => s + e.count, 0);
  const maxCount = filteredDays.length ? Math.max(...filteredDays.map(e => e.count)) : 1;

  return (
    <div className="banner-page">
      {/* Header */}
      <header className="banner-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="banner-back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Megaphone size={18} color="#a5b4fc" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>Barra Mercado Libre</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="banner-toggle" title={bar.enabled ? 'Activa' : 'Inactiva'}>
            <input type="checkbox" checked={!!bar.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            <span className="banner-toggle-slider" />
          </label>
          <button className="banner-save-btn" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="banner-tabs">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`banner-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Configuración tab ── */}
      {activeTab === 'config' && (
        <div className="banner-config-body">
          <div className="banner-config-panel">
            <div className="banner-tab-content">
              <div className="config-fields">

                <button
                  onClick={() => patch({
                    bgColor: '#FFE600', textColor: '#333333',
                    buttonBgColor: '#3483FA', buttonTextColor: '#ffffff',
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: '#1e2130',
                    border: '1.5px solid #374151', borderRadius: 8,
                    color: '#e5e7eb', fontSize: 13, cursor: 'pointer',
                    fontWeight: 500, width: '100%',
                  }}
                >
                  Aplicar colores Mercado Libre
                </button>

                <div className="form-group">
                  <label>Logo (opcional)</label>
                  {bar.logoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#1e2130', borderRadius: 8, border: '1px solid #374151' }}>
                      <img src={bar.logoUrl} alt="logo" style={{ height: 32, width: 'auto', maxWidth: 120, objectFit: 'contain' }} />
                      <button
                        onClick={() => patch({ logoUrl: '' })}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}
                        title="Quitar logo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="banner-upload-zone"
                      style={{ padding: '12px 16px', textAlign: 'center', cursor: uploadingLogo ? 'default' : 'pointer' }}
                      onClick={() => !uploadingLogo && logoFileRef.current?.click()}
                    >
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => uploadLogo(e.target.files[0])}
                      />
                      <Upload size={16} style={{ margin: '0 auto 4px', display: 'block', color: '#6b7280' }} />
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>
                        {uploadingLogo ? 'Subiendo…' : 'Click para subir logo'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>PNG, SVG, WebP · máx 4 MB</div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Texto del anuncio</label>
                  <input type="text" value={bar.text || ''} onChange={(e) => patch({ text: e.target.value })}
                    placeholder="Comprá ahora y pagá en cuotas con Mercado Libre" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Color de fondo</label>
                    <div className="color-input-group">
                      <input type="color" value={bar.bgColor || '#FFE600'} onChange={(e) => patch({ bgColor: e.target.value })} />
                      <input type="text" value={bar.bgColor || '#FFE600'} onChange={(e) => patch({ bgColor: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Color del texto</label>
                    <div className="color-input-group">
                      <input type="color" value={bar.textColor || '#333333'} onChange={(e) => patch({ textColor: e.target.value })} />
                      <input type="text" value={bar.textColor || '#333333'} onChange={(e) => patch({ textColor: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tamaño texto ({bar.fontSize || 14}px)</label>
                    <input type="range" min="11" max="22" value={bar.fontSize || 14}
                      onChange={(e) => patch({ fontSize: parseInt(e.target.value, 10) })} />
                  </div>
                  <div className="form-group">
                    <label>Padding vertical ({bar.paddingV || 10}px)</label>
                    <input type="range" min="4" max="32" value={bar.paddingV || 10}
                      onChange={(e) => patch({ paddingV: parseInt(e.target.value, 10) })} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #2d3748', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Botón (opcional)</div>
                  <div className="config-fields">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Texto del botón</label>
                        <input type="text" value={bar.buttonText || ''} onChange={(e) => patch({ buttonText: e.target.value })}
                          placeholder="Ver más" />
                      </div>
                      <div className="form-group">
                        <label>URL del botón</label>
                        <input type="url" value={bar.buttonUrl || ''} onChange={(e) => patch({ buttonUrl: e.target.value })}
                          placeholder="https://…" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Color fondo botón</label>
                        <div className="color-input-group">
                          <input type="color" value={bar.buttonBgColor || '#3483FA'} onChange={(e) => patch({ buttonBgColor: e.target.value })} />
                          <input type="text" value={bar.buttonBgColor || '#3483FA'} onChange={(e) => patch({ buttonBgColor: e.target.value })} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Color texto botón</label>
                        <div className="color-input-group">
                          <input type="color" value={bar.buttonTextColor || '#ffffff'} onChange={(e) => patch({ buttonTextColor: e.target.value })} />
                          <input type="text" value={bar.buttonTextColor || '#ffffff'} onChange={(e) => patch({ buttonTextColor: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Border radius botón ({bar.buttonBorderRadius || 4}px)</label>
                      <input type="range" min="0" max="50" value={bar.buttonBorderRadius || 4}
                        onChange={(e) => patch({ buttonBorderRadius: parseInt(e.target.value, 10) })} />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #2d3748', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Posición en la tienda</div>
                  <div className="config-fields">
                    <div className="form-group">
                      <label>Selector CSS (opcional)</label>
                      <input type="text" value={bar.injectSelector || ''} onChange={(e) => patch({ injectSelector: e.target.value })}
                        placeholder="Ej: .main-slider, #site-header" />
                      <small className="field-hint">Si se deja vacío, la barra se agrega al inicio del body.</small>
                    </div>
                    <div className="form-group">
                      <label>Posición respecto al selector</label>
                      <select value={bar.injectPosition || 'before'} onChange={(e) => patch({ injectPosition: e.target.value })}>
                        <option value="before">Antes del elemento</option>
                        <option value="after">Después del elemento</option>
                        <option value="prepend">Al inicio (dentro del elemento)</option>
                        <option value="append">Al final (dentro del elemento)</option>
                      </select>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="banner-config-preview" style={{ position: 'sticky', top: 80 }}>
            <div className="banner-preview-label">Vista previa</div>
            <div style={{ padding: 20 }}>
              <div style={{
                background: previewBg,
                color: previewTc,
                fontSize: bar.fontSize || 14,
                fontWeight: bar.fontWeight || '600',
                padding: `${bar.paddingV || 10}px 20px`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, borderRadius: 8, flexWrap: 'wrap',
                minHeight: 44,
              }}>
                {bar.logoUrl && (
                  <img src={bar.logoUrl} alt="logo" style={{ height: 28, width: 'auto', flexShrink: 0, display: 'block' }} />
                )}
                <span>{bar.text || 'Vista previa del texto'}</span>
                {bar.buttonText && bar.buttonUrl && (
                  <span style={{
                    background: bar.buttonBgColor || '#3483FA',
                    color: bar.buttonTextColor || '#ffffff',
                    borderRadius: bar.buttonBorderRadius || 4,
                    padding: '5px 14px', fontSize: 13, fontWeight: 600,
                  }}>
                    {bar.buttonText}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics tab ── */}
      {activeTab === 'analytics' && (
        <div style={{ maxWidth: 860, margin: '40px auto', padding: '0 24px' }}>

          {/* Header row: totals + filter */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Total card */}
            <div style={{
              background: '#1a1d2e', border: '1px solid #2d3748',
              borderRadius: 12, padding: '24px 32px', flex: '0 0 auto',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Total acumulado
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#a5b4fc', lineHeight: 1, letterSpacing: '-1px' }}>
                {(clicks ?? 0).toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>clicks al botón</div>
            </div>

            {/* Period card */}
            <div style={{
              background: '#1a1d2e', border: '1px solid #2d3748',
              borderRadius: 12, padding: '24px 32px', flex: '0 0 auto',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Período seleccionado
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#34d399', lineHeight: 1, letterSpacing: '-1px' }}>
                {filteredTotal.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                clicks ({filteredDays.length} día{filteredDays.length !== 1 ? 's' : ''})
              </div>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtrar</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      border: filter === f.id ? '1.5px solid #6366f1' : '1.5px solid #374151',
                      background: filter === f.id ? '#312e81' : '#1e2130',
                      color: filter === f.id ? '#a5b4fc' : '#9ca3af',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily breakdown */}
          <div style={{ background: '#1a1d2e', border: '1px solid #2d3748', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2d3748', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Clicks por día</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>tráfico enviado a Mercado Libre</div>
            </div>

            {filteredDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <BarChart2 size={40} style={{ color: '#374151', margin: '0 auto 14px', display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                  Sin datos en este período
                </div>
                <div style={{ fontSize: 13, color: '#4b5563' }}>
                  Los clicks se contarán automáticamente cuando la barra esté activa.
                </div>
              </div>
            ) : (
              <div>
                {filteredDays.map((entry, i) => (
                  <div
                    key={entry.date}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '12px 20px',
                      borderBottom: i < filteredDays.length - 1 ? '1px solid #1e293b' : 'none',
                    }}
                  >
                    <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: '#9ca3af', flexShrink: 0 }}>
                      {formatDate(entry.date)}
                    </div>
                    <div style={{ flex: 1, height: 8, background: '#252836', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(2, Math.round((entry.count / maxCount) * 100))}%`,
                        background: 'linear-gradient(90deg, #6366f1, #a5b4fc)',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ width: 48, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#e5e7eb', flexShrink: 0 }}>
                      {entry.count.toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 16, textAlign: 'center' }}>
            Los datos históricos anteriores a hoy comenzarán a acumularse a partir del próximo click.
          </div>
        </div>
      )}
    </div>
  );
}
