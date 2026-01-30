import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Clock, Zap, Calendar, Link as LinkIcon, Palette } from 'lucide-react';
import { apiRequest } from '../config';
import './CountdownConfig.css';

function CountdownConfig() {
  const navigate = useNavigate();
  const { countdownId } = useParams();
  const [searchParams] = useSearchParams();
  const storeId = localStorage.getItem('promonube_store_id');
  const isEdit = !!countdownId;
  const defaultType = searchParams.get('type') || 'active';

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    name: 'Mi Promoción',
    type: defaultType, // 'active' o 'upcoming'
    enabled: true,
    
    // Fechas
    startDate: '', // Solo para 'upcoming'
    endDate: '',
    
    // Textos
    message: defaultType === 'active' ? '⚡ Últimas horas - Termina en:' : '🚀 Lanzamiento en:',
    icon: defaultType === 'active' ? '⚡' : '🚀',
    buttonText: defaultType === 'active' ? 'Ver Ofertas' : '',
    buttonUrl: '/productos',
    
    // Estilo General
    position: 'top', // 'top' o 'bottom'
    pushContent: true, // true = empuja contenido, false = fixed superpuesto
    showCloseButton: true,
    
    // Colores
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    timerColor: '#f59e0b',
    buttonColor: '#f59e0b',
    buttonTextColor: '#000000',
    buttonHoverColor: '#ea580c',
    
    // Tipografía
    messageFontSize: '16px',
    messageFontWeight: '600',
    timerFontSize: '18px',
    timerFontWeight: '700',
    buttonFontSize: '14px',
    buttonFontWeight: '700',
    letterSpacing: '0.3px',
    timerLetterSpacing: '1px',
    
    // Espaciado
    padding: '14px 20px',
    gap: '24px',
    timerGap: '8px',
    buttonPadding: '10px 28px',
    
    // Bordes y Sombras
    buttonRadius: '8px',
    shadow: '0 4px 12px rgba(0,0,0,0.15)',
    buttonShadow: '0 2px 8px rgba(0,0,0,0.15)',
    buttonHoverShadow: '0 6px 16px rgba(0,0,0,0.25)',
    borderBottom: 'none',
    borderTop: 'none',
    buttonBorder: 'none',
    
    // Efectos
    blur: false,
    buttonTextTransform: 'uppercase'
  });

  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (isEdit) {
      loadConfig();
    } else {
      // Si es nuevo, setear fecha/hora por defecto
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      setConfig(prev => ({
        ...prev,
        startDate: now.toISOString().slice(0, 16),
        endDate: tomorrow.toISOString().slice(0, 16)
      }));
    }
  }, [countdownId]);

  const loadConfig = async () => {
    try {
      const data = await apiRequest(`/api/countdown/${countdownId}?storeId=${storeId}`);
      if (data.success && data.countdown) {
        setConfig(data.countdown);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    // Validaciones
    if (!config.name || !config.endDate) {
      alert('❌ Completa todos los campos requeridos');
      return;
    }

    if (config.type === 'upcoming' && !config.startDate) {
      alert('❌ Fecha de inicio requerida para promociones "Próximamente"');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isEdit ? `/api/countdowns/${countdownId}` : '/api/countdowns/create';
      const method = isEdit ? 'PUT' : 'POST';
      
      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify({
          storeId,
          ...config
        })
      });

      if (data.success) {
        alert(config.enabled 
          ? '✅ Cuenta regresiva guardada y activada!' 
          : '✅ Configuración guardada. Activala para que aparezca en tu tienda');
        if (!isEdit && data.countdownId) {
          navigate(`/countdown/${data.countdownId}/config`);
        }
      } else {
        alert('❌ Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('❌ Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="countdown-config-container">
      <header className="config-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/countdown')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{isEdit ? '⚙️ Configurar Countdown' : '⏰ Nueva Cuenta Regresiva'}</h1>
            <p>{config.name}</p>
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
          <Clock size={18} />
          General
        </button>
        <button 
          className={`tab ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={18} />
          Estilo
        </button>
      </div>

      <div className="tab-content">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="config-section">
            <h2>⚙️ Configuración General</h2>
            
            <div className="form-group">
              <label>Nombre Interno</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Ej: Flash Sale Verano 2024"
              />
            </div>

            <div className="form-group">
              <label>Tipo de Cuenta Regresiva</label>
              <div className="type-selector">
                <div 
                  className={`type-option ${config.type === 'active' ? 'selected' : ''}`}
                  onClick={() => setConfig({ 
                    ...config, 
                    type: 'active',
                    message: '⚡ Últimas horas - Termina en:',
                    buttonText: 'Ver Ofertas',
                    startDate: '' // Limpiar startDate si cambiamos a active
                  })}
                >
                  <Zap size={24} />
                  <strong>Finalización</strong>
                  <span>Cierre de promo o evento activo</span>
                </div>
                <div 
                  className={`type-option ${config.type === 'upcoming' ? 'selected' : ''}`}
                  onClick={() => setConfig({ 
                    ...config, 
                    type: 'upcoming',
                    message: '🔥 Lanzamiento en:',
                    buttonText: ''
                  })}
                >
                  <Calendar size={24} />
                  <strong>Próximamente</strong>
                  <span>Lanzamientos, eventos o promos futuras</span>
                </div>
              </div>
            </div>

            {config.type === 'upcoming' && (
              <div className="form-group">
                <label>📅 ¿Cuándo EMPIEZA? (Fecha y hora de inicio)</label>
                <input
                  type="datetime-local"
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                />
                <small className="field-hint">El countdown mostrará "Comienza en:" hasta esta fecha</small>
              </div>
            )}

            <div className="form-group">
              <label>⏰ ¿Cuándo TERMINA? (Fecha y hora final) *</label>
              <input
                type="datetime-local"
                value={config.endDate}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
              />
              <small className="field-hint">
                {config.type === 'active' ? 'El countdown mostrará "Termina en:" hasta esta fecha' : 'Cuando el countdown llegue a esta fecha, desaparecerá automáticamente'}
              </small>
            </div>

            <div className="form-group">
              <label>💬 Mensaje Principal</label>
              <input
                type="text"
                value={config.message}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="⚡ FLASH SALE - Termina en:"
              />
              <small className="field-hint">Texto que aparece antes del timer</small>
            </div>

            {config.type === 'active' && (
              <>
                <div className="form-group">
                  <label>🔘 Texto del Botón CTA</label>
                  <input
                    type="text"
                    value={config.buttonText}
                    onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                    placeholder="Comprar Ahora"
                  />
                  <small className="field-hint">Deja vacío si no quieres mostrar botón</small>
                </div>

                {config.buttonText && (
                  <div className="form-group">
                    <label>
                      <LinkIcon size={18} />
                      URL del Botón
                    </label>
                    <input
                      type="text"
                      value={config.buttonUrl}
                      onChange={(e) => setConfig({ ...config, buttonUrl: e.target.value })}
                      placeholder="/productos/oferta"
                    />
                    <small className="field-hint">A dónde va cuando hacen clic en el botón</small>
                  </div>
                )}
              </>
            )}

            <div className="info-box">
              <h4>💡 Ejemplos de uso:</h4>
              <ul>
                {config.type === 'active' ? (
                  <>
                    <li><strong>Flash Sale:</strong> "⚡ Flash Sale 50% OFF - Termina en:"</li>
                    <li><strong>Cierre de Promo:</strong> "🔥 Últimas 24hs - Termina en:"</li>
                    <li><strong>Stock Limitado:</strong> "⏰ Hasta agotar stock - Termina en:"</li>
                    <li style={{marginTop: '8px', color: '#059669'}}><strong>✓ Agregá un botón</strong> para llevar a la promo destacada</li>
                  </>
                ) : (
                  <>
                    <li><strong>Lanzamiento:</strong> "🚀 Nuevo producto en:"</li>
                    <li><strong>Evento:</strong> "📅 Black Friday comienza en:"</li>
                    <li><strong>Preventa:</strong> "⭐ Preventa exclusiva en:"</li>
                    <li style={{marginTop: '8px', color: '#059669'}}><strong>✓ Genera expectativa</strong> y anticipa el evento</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="config-section">
            <h2>🎨 Personalización del Estilo</h2>

            <div className="form-group">
              <label>Posición de la Barra</label>
              <div className="position-selector">
                <div 
                  className={`position-option ${config.position === 'top' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, position: 'top' })}
                >
                  <div className="position-preview top">
                    <div className="bar"></div>
                  </div>
                  <strong>Arriba</strong>
                </div>
                <div 
                  className={`position-option ${config.position === 'bottom' ? 'selected' : ''}`}
                  onClick={() => setConfig({ ...config, position: 'bottom' })}
                >
                  <div className="position-preview bottom">
                    <div className="bar"></div>
                  </div>
                  <strong>Abajo</strong>
                </div>
              </div>
            </div>

            <div className="color-grid">
              <div className="form-group">
                <label>🎨 Fondo de la Barra</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>📝 Color del Texto</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.textColor}
                    onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>⏱️ Color del Timer</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.timerColor}
                    onChange={(e) => setConfig({ ...config, timerColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.timerColor}
                    onChange={(e) => setConfig({ ...config, timerColor: e.target.value })}
                    placeholder="#f59e0b"
                  />
                </div>
              </div>

              {config.buttonText && (
                <>
                  <div className="form-group">
                    <label>🔘 Color del Botón</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.buttonColor}
                        onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={config.buttonColor}
                        onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                        placeholder="#f59e0b"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>⚪ Texto del Botón</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.buttonTextColor}
                        onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={config.buttonTextColor}
                        onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Preview */}
            <div className="countdown-preview-wrapper">
              <h3>Vista Previa:</h3>
              <div 
                className="countdown-preview" 
                style={{
                  background: config.backgroundColor,
                  color: config.textColor
                }}
              >
                <span className="preview-message">{config.message}</span>
                <div className="preview-timer" style={{ color: config.timerColor }}>
                  <div className="timer-unit">
                    <span className="timer-value">02</span>
                    <span className="timer-label">días</span>
                  </div>
                  <span className="timer-separator">:</span>
                  <div className="timer-unit">
                    <span className="timer-value">15</span>
                    <span className="timer-label">hs</span>
                  </div>
                  <span className="timer-separator">:</span>
                  <div className="timer-unit">
                    <span className="timer-value">47</span>
                    <span className="timer-label">min</span>
                  </div>
                  <span className="timer-separator">:</span>
                  <div className="timer-unit">
                    <span className="timer-value">23</span>
                    <span className="timer-label">seg</span>
                  </div>
                </div>
                {config.buttonText && (
                  <button 
                    className="preview-button"
                    style={{
                      background: config.buttonColor,
                      color: config.buttonTextColor
                    }}
                  >
                    {config.buttonText}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CountdownConfig;
