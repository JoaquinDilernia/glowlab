import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Tag, Palette, Settings } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './NewBadgeConfig.css';

function NewBadgeConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    daysToShowAsNew: 30,
    badgeText: "NUEVO",
    badgePosition: "top-left",
    badgeShape: "rectangular",
    backgroundColor: "#ff4757",
    textColor: "#ffffff",
    fontSize: "12px",
    fontWeight: "700",
    padding: "6px 12px",
    borderRadius: "4px",
    textTransform: "uppercase", // uppercase, lowercase, capitalize, none
    borderEnabled: false,
    borderColor: "#000000",
    borderWidth: "2px",
    borderStyle: "solid", // solid, dashed, dotted, double
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowBlur: "10px",
    shadowX: "0px",
    shadowY: "2px",
    opacity: "1",
    animation: "none", // none, pulse, bounce, shake
    icon: "", // emoji o vacío
    iconPosition: "left", // left, right
    showOnProductPage: true,
    showOnCategoryPage: true,
    showOnHomePage: true,
    customCSS: ""
  });

  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await apiRequest(`/api/new-badge-config/${storeId}`);
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/new-badge-config/${storeId}`, {
        method: 'POST',
        body: JSON.stringify(config)
      });

      if (data.success) {
        toast.success(config.enabled 
          ? 'Badge de productos nuevos activado!' 
          : 'Configuración guardada. Activala para que aparezca en tu tienda');
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  // Generar ejemplo de producto para el preview
  const PreviewBadge = () => {
    const positions = {
      'top-left': { top: '10px', left: '10px' },
      'top-right': { top: '10px', right: '10px' },
      'bottom-left': { bottom: '10px', left: '10px' },
      'bottom-right': { bottom: '10px', right: '10px' }
    };

    let shapeStyles = {};
    switch(config.badgeShape) {
      case 'circular':
        shapeStyles = {
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        };
        break;
      case 'ribbon':
        shapeStyles = {
          borderRadius: 0,
          padding: '8px 16px',
          position: 'relative'
        };
        break;
      case 'rounded':
        shapeStyles = { borderRadius: '20px' };
        break;
      default:
        shapeStyles = { borderRadius: config.borderRadius };
    }

    // Construir box-shadow
    let boxShadow = 'none';
    if (config.shadowEnabled) {
      boxShadow = `${config.shadowX} ${config.shadowY} ${config.shadowBlur} ${config.shadowColor}`;
    }

    // Construir border
    let border = 'none';
    if (config.borderEnabled) {
      border = `${config.borderWidth} ${config.borderStyle} ${config.borderColor}`;
    }

    // Construir animación
    let animation = '';
    switch(config.animation) {
      case 'pulse':
        animation = 'pn-badge-pulse 2s infinite';
        break;
      case 'bounce':
        animation = 'pn-badge-bounce 1s infinite';
        break;
      case 'shake':
        animation = 'pn-badge-shake 0.5s infinite';
        break;
      case 'glow':
        animation = 'pn-badge-glow 2s infinite';
        break;
      default:
        animation = 'none';
    }

    // Construir texto con icono
    let badgeContent = config.badgeText;
    if (config.icon) {
      badgeContent = config.iconPosition === 'left' 
        ? `${config.icon} ${config.badgeText}`
        : `${config.badgeText} ${config.icon}`;
    }

    return (
      <div className="preview-container">
        <div className="preview-product">
          <div className="preview-image">
            <img src="https://via.placeholder.com/300x400/f5f5f5/666?text=Producto" alt="Preview" />
            <div 
              className="preview-badge"
              style={{
                position: 'absolute',
                ...positions[config.badgePosition],
                background: config.backgroundColor,
                color: config.textColor,
                fontSize: config.fontSize,
                fontWeight: config.fontWeight,
                padding: config.padding,
                textTransform: config.textTransform,
                border: border,
                boxShadow: boxShadow,
                opacity: config.opacity,
                animation: animation,
                zIndex: 10,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                letterSpacing: '0.5px',
                ...shapeStyles
              }}
            >
              {badgeContent}
            </div>
          </div>
          <div className="preview-details">
            <h4>Producto de Ejemplo</h4>
            <p className="preview-price">$9,999</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="new-badge-config-container">
      <header className="config-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>🏷️ Badge "Producto Nuevo"</h1>
            <p>Destaca automáticamente tus productos recientes</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-toggle ${config.enabled ? 'active' : ''}`}
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          >
            <span className="toggle-dot"></span>
            {config.enabled ? 'Activado' : 'Desactivado'}
          </button>
          <button className="btn-primary" onClick={saveConfig} disabled={loading}>
            <Save size={18} />
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <Settings size={18} />
          Configuración
        </button>
        <button 
          className={`tab ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={18} />
          Diseño
        </button>
        <button 
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <Eye size={18} />
          Preview
        </button>
      </div>

      <div className="tab-content">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="config-section">
            <h2>⚙️ Configuración General</h2>
            
            <div className="form-group">
              <label>📅 Días para considerar "Nuevo"</label>
              <input
                type="number"
                value={config.daysToShowAsNew}
                onChange={(e) => setConfig({ ...config, daysToShowAsNew: parseInt(e.target.value) })}
                min="1"
                max="365"
              />
              <small className="field-hint">
                Los productos con menos de {config.daysToShowAsNew} días de creación mostrarán el badge
              </small>
            </div>

            <div className="form-group">
              <label>📝 Texto del Badge</label>
              <input
                type="text"
                value={config.badgeText}
                onChange={(e) => setConfig({ ...config, badgeText: e.target.value })}
                placeholder="NUEVO"
                maxLength="15"
              />
              <small className="field-hint">Máximo 15 caracteres</small>
            </div>

            <div className="form-group">
              <label>📍 Dónde Mostrar</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.showOnProductPage}
                    onChange={(e) => setConfig({ ...config, showOnProductPage: e.target.checked })}
                  />
                  <span>Página de producto individual</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.showOnCategoryPage}
                    onChange={(e) => setConfig({ ...config, showOnCategoryPage: e.target.checked })}
                  />
                  <span>Páginas de categorías / colecciones</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.showOnHomePage}
                    onChange={(e) => setConfig({ ...config, showOnHomePage: e.target.checked })}
                  />
                  <span>Página de inicio</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="config-section">
            <h2>🎨 Diseño y Estilo</h2>

            <div className="form-group">
              <label>📐 Forma del Badge</label>
              <div className="shape-selector">
                <div 
                  className={`shape-option ${config.badgeShape === 'rectangular' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgeShape: 'rectangular' })}
                >
                  <div className="shape-preview rectangular"></div>
                  <span>Rectangular</span>
                </div>
                <div 
                  className={`shape-option ${config.badgeShape === 'rounded' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgeShape: 'rounded' })}
                >
                  <div className="shape-preview rounded"></div>
                  <span>Redondeado</span>
                </div>
                <div 
                  className={`shape-option ${config.badgeShape === 'circular' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgeShape: 'circular' })}
                >
                  <div className="shape-preview circular"></div>
                  <span>Circular</span>
                </div>
                <div 
                  className={`shape-option ${config.badgeShape === 'ribbon' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgeShape: 'ribbon' })}
                >
                  <div className="shape-preview ribbon"></div>
                  <span>Cinta</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>📍 Posición</label>
              <div className="position-selector">
                <div 
                  className={`position-option ${config.badgePosition === 'top-left' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgePosition: 'top-left' })}
                >
                  <div className="position-preview">
                    <div className="position-dot top-left"></div>
                  </div>
                  <span>Arriba Izq.</span>
                </div>
                <div 
                  className={`position-option ${config.badgePosition === 'top-right' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgePosition: 'top-right' })}
                >
                  <div className="position-preview">
                    <div className="position-dot top-right"></div>
                  </div>
                  <span>Arriba Der.</span>
                </div>
                <div 
                  className={`position-option ${config.badgePosition === 'bottom-left' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgePosition: 'bottom-left' })}
                >
                  <div className="position-preview">
                    <div className="position-dot bottom-left"></div>
                  </div>
                  <span>Abajo Izq.</span>
                </div>
                <div 
                  className={`position-option ${config.badgePosition === 'bottom-right' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, badgePosition: 'bottom-right' })}
                >
                  <div className="position-preview">
                    <div className="position-dot bottom-right"></div>
                  </div>
                  <span>Abajo Der.</span>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>🎨 Color de Fondo</label>
                <div className="color-input">
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                    placeholder="#ff4757"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>✏️ Color de Texto</label>
                <div className="color-input">
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.textColor}
                    onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📏 Tamaño de Fuente</label>
                <input
                  type="text"
                  value={config.fontSize}
                  onChange={(e) => setConfig({ ...config, fontSize: e.target.value })}
                  placeholder="12px"
                />
              </div>

              <div className="form-group">
                <label>💪 Grosor de Fuente</label>
                <select
                  value={config.fontWeight}
                  onChange={(e) => setConfig({ ...config, fontWeight: e.target.value })}
                >
                  <option value="400">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-Bold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extra Bold (800)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>🔤 Transformación de Texto</label>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px'}}>
                <button
                  type="button"
                  className={`style-button ${config.textTransform === 'uppercase' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, textTransform: 'uppercase' })}
                  style={{padding: '10px', border: '2px solid rgba(124, 124, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', background: config.textTransform === 'uppercase' ? '#6366f1' : 'rgba(26, 26, 46, 0.8)', color: config.textTransform === 'uppercase' ? 'white' : 'rgba(255, 255, 255, 0.95)'}}
                >
                  MAYÚSCULAS
                </button>
                <button
                  type="button"
                  className={`style-button ${config.textTransform === 'lowercase' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, textTransform: 'lowercase' })}
                  style={{padding: '10px', border: '2px solid rgba(124, 124, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', background: config.textTransform === 'lowercase' ? '#6366f1' : 'rgba(26, 26, 46, 0.8)', color: config.textTransform === 'lowercase' ? 'white' : 'rgba(255, 255, 255, 0.95)'}}
                >
                  minúsculas
                </button>
                <button
                  type="button"
                  className={`style-button ${config.textTransform === 'capitalize' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, textTransform: 'capitalize' })}
                  style={{padding: '10px', border: '2px solid rgba(124, 124, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', background: config.textTransform === 'capitalize' ? '#6366f1' : 'rgba(26, 26, 46, 0.8)', color: config.textTransform === 'capitalize' ? 'white' : 'rgba(255, 255, 255, 0.95)'}}
                >
                  Capitalizar
                </button>
                <button
                  type="button"
                  className={`style-button ${config.textTransform === 'none' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, textTransform: 'none' })}
                  style={{padding: '10px', border: '2px solid rgba(124, 124, 255, 0.2)', borderRadius: '8px', cursor: 'pointer', background: config.textTransform === 'none' ? '#6366f1' : 'rgba(26, 26, 46, 0.8)', color: config.textTransform === 'none' ? 'white' : 'rgba(255, 255, 255, 0.95)'}}
                >
                  Normal
                </button>
              </div>
              <small className="field-hint">
                Cómo se mostrará el texto del badge
              </small>
            </div>

            <div className="form-group" style={{marginTop: '30px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
                <input
                  type="checkbox"
                  checked={config.borderEnabled}
                  onChange={(e) => setConfig({ ...config, borderEnabled: e.target.checked })}
                  style={{width: '20px', height: '20px'}}
                />
                <span style={{fontSize: '16px', fontWeight: '600'}}>🖼️ Habilitar Borde</span>
              </label>

              {config.borderEnabled && (
                <div style={{marginLeft: '28px', padding: '20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '2px solid rgba(124, 124, 255, 0.2)'}}>
                  <div className="form-row" style={{marginBottom: '16px'}}>
                    <div className="form-group" style={{marginBottom: 0}}>
                      <label>Color del Borde</label>
                      <div className="color-input">
                        <input
                          type="color"
                          value={config.borderColor}
                          onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                        />
                        <input
                          type="text"
                          value={config.borderColor}
                          onChange={(e) => setConfig({ ...config, borderColor: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{marginBottom: 0}}>
                      <label>Grosor</label>
                      <input
                        type="text"
                        value={config.borderWidth}
                        onChange={(e) => setConfig({ ...config, borderWidth: e.target.value })}
                        placeholder="2px"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{marginBottom: 0}}>
                    <label>Estilo del Borde</label>
                    <select
                      value={config.borderStyle}
                      onChange={(e) => setConfig({ ...config, borderStyle: e.target.value })}
                    >
                      <option value="solid">Sólido</option>
                      <option value="dashed">Punteado</option>
                      <option value="dotted">Puntos</option>
                      <option value="double">Doble</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{marginTop: '30px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
                <input
                  type="checkbox"
                  checked={config.shadowEnabled}
                  onChange={(e) => setConfig({ ...config, shadowEnabled: e.target.checked })}
                  style={{width: '20px', height: '20px'}}
                />
                <span style={{fontSize: '16px', fontWeight: '600'}}>✨ Habilitar Sombra</span>
              </label>

              {config.shadowEnabled && (
                <div style={{marginLeft: '28px', padding: '20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '2px solid rgba(124, 124, 255, 0.2)'}}>
                  <div className="form-group" style={{marginBottom: '16px'}}>
                    <label>Color de Sombra</label>
                    <div className="color-input">
                      <input
                        type="color"
                        value={config.shadowColor}
                        onChange={(e) => setConfig({ ...config, shadowColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={config.shadowColor}
                        onChange={(e) => setConfig({ ...config, shadowColor: e.target.value })}
                        placeholder="#000000"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{marginBottom: 0}}>
                      <label>Desenfoque</label>
                      <input
                        type="text"
                        value={config.shadowBlur}
                        onChange={(e) => setConfig({ ...config, shadowBlur: e.target.value })}
                        placeholder="10px"
                      />
                    </div>

                    <div className="form-group" style={{marginBottom: 0}}>
                      <label>Offset X</label>
                      <input
                        type="text"
                        value={config.shadowX}
                        onChange={(e) => setConfig({ ...config, shadowX: e.target.value })}
                        placeholder="0px"
                      />
                    </div>

                    <div className="form-group" style={{marginBottom: 0}}>
                      <label>Offset Y</label>
                      <input
                        type="text"
                        value={config.shadowY}
                        onChange={(e) => setConfig({ ...config, shadowY: e.target.value })}
                        placeholder="2px"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{marginTop: '30px'}}>
              <label>🎪 Animación</label>
              <select
                value={config.animation}
                onChange={(e) => setConfig({ ...config, animation: e.target.value })}
              >
                <option value="none">Sin animación</option>
                <option value="pulse">Pulso (latido)</option>
                <option value="bounce">Rebote</option>
                <option value="shake">Vibración</option>
                <option value="glow">Brillo</option>
              </select>
              <small className="field-hint">
                Efecto de animación para llamar la atención
              </small>
            </div>

            <div className="form-group" style={{marginTop: '20px'}}>
              <label>😀 Emoji / Icono</label>
              <div className="form-row">
                <input
                  type="text"
                  value={config.icon}
                  onChange={(e) => setConfig({ ...config, icon: e.target.value })}
                  placeholder="🔥 ⭐ 💥 ✨"
                  maxLength="2"
                  style={{flex: 2}}
                />
                <select
                  value={config.iconPosition}
                  onChange={(e) => setConfig({ ...config, iconPosition: e.target.value })}
                  style={{flex: 1}}
                >
                  <option value="left">Izquierda</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
              <small className="field-hint">
                Agrega un emoji antes o después del texto (opcional)
              </small>
            </div>

            <div className="form-group" style={{marginTop: '20px'}}>
              <label>👻 Opacidad</label>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.opacity}
                  onChange={(e) => setConfig({ ...config, opacity: e.target.value })}
                  style={{flex: 1}}
                />
                <span style={{minWidth: '40px', fontWeight: '600'}}>{Math.round(config.opacity * 100)}%</span>
              </div>
              <small className="field-hint">
                Transparencia del badge (100% = opaco)
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📦 Padding</label>
                <input
                  type="text"
                  value={config.padding}
                  onChange={(e) => setConfig({ ...config, padding: e.target.value })}
                  placeholder="6px 12px"
                />
              </div>

              {config.badgeShape === 'rectangular' && (
                <div className="form-group">
                  <label>🔄 Border Radius</label>
                  <input
                    type="text"
                    value={config.borderRadius}
                    onChange={(e) => setConfig({ ...config, borderRadius: e.target.value })}
                    placeholder="4px"
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>🎭 CSS Personalizado (Avanzado)</label>
              <textarea
                value={config.customCSS}
                onChange={(e) => setConfig({ ...config, customCSS: e.target.value })}
                placeholder="text-shadow: 0 1px 2px rgba(0,0,0,0.3);"
                rows="3"
              />
              <small className="field-hint">
                CSS adicional que se aplicará al badge (opcional)
              </small>
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="config-section">
            <h2>👁️ Vista Previa</h2>
            <p className="preview-description">
              Así se verá el badge en tus productos nuevos:
            </p>
            <PreviewBadge />
            
            <div className="preview-info">
              <div className="info-card">
                <Tag size={24} />
                <div>
                  <strong>Productos afectados</strong>
                  <p>Todos los productos creados en los últimos {config.daysToShowAsNew} días</p>
                </div>
              </div>
              
              <div className="info-card">
                <Eye size={24} />
                <div>
                  <strong>Visibilidad</strong>
                  <p>
                    {[
                      config.showOnProductPage && 'Producto individual',
                      config.showOnCategoryPage && 'Categorías',
                      config.showOnHomePage && 'Inicio'
                    ].filter(Boolean).join(', ') || 'Ninguna página seleccionada'}
                  </p>
                </div>
              </div>
            </div>

            <div className="auto-activation-box">
              <div className="auto-activation-icon">✅</div>
              <div>
                <strong>Funcionamiento automático</strong>
                <p>El badge ya está activo en tu tienda. No necesitás instalar ni pegar ningún código — PromoNube lo gestiona automáticamente.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default NewBadgeConfig;
