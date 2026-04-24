import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Settings, Palette, Target, Clock, Link as LinkIcon, Plus, Trash2, BarChart3, Mail } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './SpinWheelConfig.css';

function SpinWheelConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const { wheelId } = useParams();
  const storeId = localStorage.getItem('promonube_store_id');
  const isEdit = !!wheelId;

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    name: 'Ruleta de Descuentos',
    enabled: true,
    title: '🎉 ¡Gira y Gana!',
    subtitle: 'Dejanos tu email y probá tu suerte',
    buttonText: 'GIRAR RULETA',
    successMessage: '¡Felicitaciones! Tu código es:',
    emailPlaceholder: 'tu@email.com',
    termsText: 'Acepto recibir promociones por email',
    closeButtonText: 'Cerrar',
    copyButtonText: 'Copiar código',
    
    // Logo
    logoUrl: '',
    showLogo: false,
    
    // Integraciones
    perfitListId: '', // ID de lista de Perfit donde van los emails
    centerEmoji: '🎁', // Emoji del centro de la ruleta
    
    // Triggers
    showOnLoad: true,
    delaySeconds: 3,
    specificUrls: '', // URLs separadas por coma
    showOnce: true,
    maxSpinsPerEmail: 1, // Máximo de giros por email (validación backend)
    couponExpirationMinutes: 15, // Tiempo de validez del cupón en minutos
    showEmailField: true, // Mostrar u ocultar campo de email
    requireEmail: true, // Si el email es obligatorio o no
    
    // Segmentos/Premios
    segments: [
      { id: 1, type: 'percentage', value: 10, label: '10% OFF', color: '#FF6B6B', probability: 30 },
      { id: 2, type: 'percentage', value: 15, label: '15% OFF', color: '#4ECDC4', probability: 20 },
      { id: 3, type: 'percentage', value: 20, label: '20% OFF', color: '#45B7D1', probability: 15 },
      { id: 4, type: 'absolute', value: 5000, label: '$5000 OFF', color: '#F7B801', probability: 10 },
      { id: 5, type: 'none', value: 0, label: 'Seguí participando', color: '#95A5A6', probability: 25 }
    ],
    
    // Estilo
    primaryColor: '#667EEA',
    secondaryColor: '#764BA2',
    textColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    buttonColor: '#667EEA',
    buttonTextColor: '#FFFFFF',
    // Dise�o premium
    fontFamily: 'modern',
    modalStyle: 'gradient',
    wheelBorderColor: '#FFFFFF',
    pointerColor: '#FF3860',
    titleFontWeight: '800',
    borderRadiusStyle: 'rounded',
    inputBgColor: 'rgba(255,255,255,0.08)',
    inputTextColor: '#FFFFFF',
    inputBorderColor: 'rgba(128,128,128,0.25)'
  });

  const [activeTab, setActiveTab] = useState('general');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isEdit) {
      loadConfig();
    }
  }, [wheelId]);

  const loadConfig = async () => {
    try {
      const data = await apiRequest(`/api/spin-wheel/${wheelId}?storeId=${storeId}`);
      if (data.success && data.wheel) {
        // Normalizar: convertir prizes a segments si es necesario
        const wheelData = {
          ...data.wheel,
          segments: data.wheel.segments || data.wheel.prizes || config.segments,
          showEmailField: data.wheel.showEmailField !== false,
          requireEmail: data.wheel.requireEmail !== false
        };
        setConfig(wheelData);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const endpoint = isEdit ? `/api/spin-wheel/${wheelId}` : '/api/spin-wheel/create';
      const method = isEdit ? 'PUT' : 'POST';
      
      // Enviar tanto segments como prizes para compatibilidad
      const configToSave = {
        ...config,
        prizes: config.segments, // Backend usa "prizes"
        segments: config.segments // Mantener por compatibilidad
      };
      
      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify({
          storeId,
          ...configToSave
        })
      });

      if (data.success) {
        toast.success(config.enabled 
          ? 'Ruleta guardada y activada! Ya está visible en tu tienda' 
          : 'Configuración guardada. Activala para que aparezca en tu tienda');
        if (!isEdit && data.wheelId) {
          navigate(`/spin-wheel/${data.wheelId}/config`);
        }
      } else {
        toast.info('❌ Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.info('❌ Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const addSegment = () => {
    const newSegment = {
      id: Date.now(),
      type: 'percentage',
      value: 5,
      label: '5% OFF',
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      probability: 10
    };
    setConfig({
      ...config,
      segments: [...config.segments, newSegment]
    });
  };

  const removeSegment = (id) => {
    if (config.segments.length <= 2) {
      toast.info('Debe haber al menos 2 segmentos');
      return;
    }
    setConfig({
      ...config,
      segments: config.segments.filter(s => s.id !== id)
    });
  };

  const updateSegment = (id, field, value) => {
    setConfig({
      ...config,
      segments: config.segments.map(s => 
        s.id === id ? { ...s, [field]: value } : s
      )
    });
  };

  const totalProbability = config.segments.reduce((sum, s) => sum + parseInt(s.probability || 0), 0);

  return (
    <div className="spin-config-container">
      <header className="config-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/spin-wheel')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{isEdit ? '⚙️ Configurar Ruleta' : '🎡 Nueva Ruleta'}</h1>
            <p>{config.name}</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-toggle ${config.enabled ? 'active' : ''}`}
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
          >
            <span className="toggle-dot"></span>
            {config.enabled ? 'Activada' : 'Desactivada'}
          </button>
          {isEdit && (
            <button 
              className="btn-analytics" 
              onClick={() => navigate(`/spin-wheel/${wheelId}/analytics`)}
              title="Ver estadísticas"
            >
              <BarChart3 size={18} />
              Analytics
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowPreview(true)}>
            <Eye size={18} />
            Vista Previa
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
          General
        </button>
        <button 
          className={`tab ${activeTab === 'prizes' ? 'active' : ''}`}
          onClick={() => setActiveTab('prizes')}
        >
          <Target size={18} />
          Premios
        </button>
        <button 
          className={`tab ${activeTab === 'trigger' ? 'active' : ''}`}
          onClick={() => setActiveTab('trigger')}
        >
          <Clock size={18} />
          Trigger
        </button>
        <button 
          className={`tab ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={18} />
          Estilo
        </button>
        <button 
          className={`tab ${activeTab === 'integrations' ? 'active' : ''}`}
          onClick={() => setActiveTab('integrations')}
        >
          <Mail size={18} />
          Integraciones
        </button>
      </div>

      <div className="tab-content">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="config-section">
            <h2>⚙️ Configuración General</h2>
            
            <div className="form-group">
              <label>Nombre de la Ruleta (interno)</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Ruleta de Descuentos"
              />
            </div>

            <div className="form-group">
              <label>Título Principal</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="¡Gira y Gana!"
              />
            </div>

            <div className="form-group">
              <label>Subtítulo</label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                placeholder="Dejanos tu email y probá tu suerte"
              />
            </div>

            <div className="form-group">
              <label>Texto del Botón de Giro</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                placeholder="GIRAR RULETA"
              />
            </div>

            <div className="form-group">
              <label>Mensaje de Éxito</label>
              <input
                type="text"
                value={config.successMessage}
                onChange={(e) => setConfig({ ...config, successMessage: e.target.value })}
                placeholder="¡Felicitaciones! Tu código es:"
              />
            </div>

            <div className="form-group">
              <label>Placeholder del Email</label>
              <input
                type="text"
                value={config.emailPlaceholder}
                onChange={(e) => setConfig({ ...config, emailPlaceholder: e.target.value })}
                placeholder="tu@email.com"
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.showEmailField !== false}
                  onChange={(e) => setConfig({ ...config, showEmailField: e.target.checked })}
                />
                <span>Mostrar campo de email</span>
              </label>
            </div>

            {config.showEmailField !== false && (
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={config.requireEmail !== false}
                    onChange={(e) => setConfig({ ...config, requireEmail: e.target.checked })}
                  />
                  <span>Solicitar email obligatoriamente</span>
                </label>
                <small className="field-hint">Si lo desactivás, los usuarios podrán girar sin ingresar email (no se sincronizará con integraciones)</small>
              </div>
            )}

            <div className="form-group">
              <label>Texto de Términos</label>
              <input
                type="text"
                value={config.termsText}
                onChange={(e) => setConfig({ ...config, termsText: e.target.value })}
                placeholder="Acepto recibir promociones por email"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Texto Botón Copiar</label>
                <input
                  type="text"
                  value={config.copyButtonText}
                  onChange={(e) => setConfig({ ...config, copyButtonText: e.target.value })}
                  placeholder="Copiar código"
                />
              </div>
              <div className="form-group">
                <label>Texto Botón Cerrar</label>
                <input
                  type="text"
                  value={config.closeButtonText}
                  onChange={(e) => setConfig({ ...config, closeButtonText: e.target.value })}
                  placeholder="Cerrar"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Logo (URL de imagen)</label>
              <input
                type="url"
                value={config.logoUrl}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                placeholder="https://tu-tienda.com/logo.png"
              />
              <div className="form-hint">📝 Recomendado: 200x80px, formato PNG con fondo transparente</div>
              {config.logoUrl && (
                <div className="logo-preview">
                  <img src={config.logoUrl} alt="Logo preview" onError={(e) => e.target.style.display = 'none'} />
                </div>
              )}
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.showLogo}
                  onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                />
                <span>Mostrar logo en el popup</span>
              </label>
            </div>

            <div className="form-group">
              <label>Centro de la Ruleta</label>
              <input
                type="text"
                value={config.centerEmoji !== undefined ? config.centerEmoji : '🎁'}
                onChange={(e) => setConfig({ ...config, centerEmoji: e.target.value })}
                placeholder="Dejar vacío para no mostrar"
                maxLength={10}
              />
              <div className="form-hint">Emoji o texto del centro de la rueda. Ej: 🎁 🎯 ⭐ 🔥 o nombre de marca. Deja el campo vacío para ocultarlo.</div>
            </div>
          </div>
        )}

        {/* Prizes Tab */}
        {activeTab === 'prizes' && (
          <div className="config-section">
            <div className="section-header">
              <h2>🎁 Premios y Probabilidades</h2>
              <button className="btn-add" onClick={addSegment}>
                <Plus size={18} />
                Agregar Segmento
              </button>
            </div>

            <div className={`probability-alert ${totalProbability === 100 ? 'success' : 'warning'}`}>
              <Target size={20} />
              <span>
                Probabilidad total: <strong>{totalProbability}%</strong>
                {totalProbability !== 100 && ' - Debe sumar exactamente 100%'}
              </span>
            </div>
            <small className="field-hint" style={{display:'block', marginBottom:'20px'}}>
              La probabilidad controla con qué frecuencia cae cada premio. El total debe sumar 100%. Ejemplo: si querés regalar poco, ponele 5% y compensá con "Sin Premio" al 50-60%.
            </small>

            <div className="segments-list">
              {config.segments.map((segment, index) => (
                <div key={segment.id} className="segment-card">
                  <div className="segment-header">
                    <div className="segment-number" style={{ background: segment.color }}>
                      {index + 1}
                    </div>
                    <input
                      className="segment-label-input"
                      type="text"
                      value={segment.label}
                      onChange={(e) => updateSegment(segment.id, 'label', e.target.value)}
                      placeholder="Texto del premio"
                    />
                    <button 
                      className="btn-remove"
                      onClick={() => removeSegment(segment.id)}
                      disabled={config.segments.length <= 2}
                      title={config.segments.length <= 2 ? 'Mínimo 2 segmentos' : 'Eliminar'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="segment-fields">
                    <div className="field-row">
                      <div className="form-group">
                        <label>Tipo</label>
                        <select
                          value={segment.type}
                          onChange={(e) => updateSegment(segment.id, 'type', e.target.value)}
                        >
                          <option value="percentage">📊 Porcentaje</option>
                          <option value="absolute">💵 Monto Fijo</option>
                          <option value="none">❌ Sin Premio</option>
                        </select>
                      </div>

                      {segment.type !== 'none' && (
                        <div className="form-group">
                          <label>Valor</label>
                          <input
                            type="number"
                            value={segment.value}
                            onChange={(e) => updateSegment(segment.id, 'value', parseFloat(e.target.value))}
                            min="0"
                            max={segment.type === 'percentage' ? 100 : undefined}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label>Color</label>
                        <input
                          type="color"
                          value={segment.color}
                          onChange={(e) => updateSegment(segment.id, 'color', e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Probabilidad (%)</label>
                        <input
                          type="number"
                          value={segment.probability}
                          onChange={(e) => updateSegment(segment.id, 'probability', parseInt(e.target.value) || 0)}
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trigger Tab */}
        {activeTab === 'trigger' && (
          <div className="config-section">
            <h2>⏱️ Cuándo Mostrar la Ruleta</h2>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.showOnLoad}
                  onChange={(e) => setConfig({ ...config, showOnLoad: e.target.checked })}
                />
                <span>Mostrar automáticamente al cargar la página</span>
              </label>
            </div>

            {config.showOnLoad && (
              <div className="form-group">
                <label>⏲️ Delay (segundos)</label>
                <input
                  type="number"
                  value={config.delaySeconds}
                  onChange={(e) => setConfig({ ...config, delaySeconds: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="60"
                />
                <small className="field-hint">Tiempo de espera antes de mostrar el pop-up (0 = inmediato)</small>
              </div>
            )}

            <div className="form-group">
              <label>
                <LinkIcon size={18} />
                URLs Específicas (opcional)
              </label>
              <textarea
                value={config.specificUrls}
                onChange={(e) => setConfig({ ...config, specificUrls: e.target.value })}
                placeholder="/productos, /categoria/ofertas, /coleccion/sale"
                rows="3"
              />
              <small className="field-hint">Separá múltiples URLs con comas. Deja vacío para mostrar en todas las páginas.</small>
            </div>

            <div className="form-group">
              <label>🎯 Máximo de Giros por Email</label>
              <input
                type="number"
                value={config.maxSpinsPerEmail || 1}
                onChange={(e) => setConfig({ ...config, maxSpinsPerEmail: parseInt(e.target.value) || 1 })}
                min="1"
                max="10"
              />
              <small className="field-hint">Cuántas veces puede jugar un usuario con el mismo email (validación en servidor)</small>
            </div>

            <div className="form-group">
              <label>⏰ Tiempo de Validez del Cupón</label>
              <select
                value={config.couponExpirationMinutes || 15}
                onChange={(e) => setConfig({ ...config, couponExpirationMinutes: parseInt(e.target.value) })}
              >
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="120">2 horas</option>
                <option value="180">3 horas</option>
                <option value="360">6 horas</option>
                <option value="720">12 horas</option>
                <option value="1440">24 horas (1 día)</option>
                <option value="2880">48 horas (2 días)</option>
                <option value="4320">72 horas (3 días)</option>
                <option value="10080">7 días</option>
                <option value="43200">30 días</option>
              </select>
              <small className="field-hint">El cupón expirará automáticamente después de este tiempo desde que se genera</small>
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={config.showOnce}
                  onChange={(e) => setConfig({ ...config, showOnce: e.target.checked })}
                />
                <span>Mostrar popup solo una vez por sesión</span>
              </label>
              <small className="field-hint">El usuario puede girar las veces indicadas, pero el popup solo aparece una vez</small>
            </div>

            <div className="info-box">
              <h4>💡 Tips para mejor conversión:</h4>
              <ul>
                <li><strong>3-5 segundos</strong> de delay es ideal para no ser intrusivo</li>
                <li>Muestra la ruleta en <strong>páginas de alta conversión</strong> (checkout, productos populares)</li>
                <li>Usa <strong>"mostrar una vez"</strong> para no molestar a los visitantes recurrentes</li>
                <li><strong>1-2 intentos</strong> máximo mantiene la exclusividad del premio</li>
              </ul>
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="config-section">
            <h2>🎨 Personalización del Estilo</h2>

            {/* --- Estilo premium (tema, tipografía, forma) --- */}
            <div className="premium-style-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px', marginBottom:'28px'}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>🎭 Estilo del modal</label>
                <select
                  value={config.modalStyle || 'gradient'}
                  onChange={(e) => setConfig({ ...config, modalStyle: e.target.value })}
                >
                  <option value="gradient">Gradiente (clásico)</option>
                  <option value="solid">Color sólido</option>
                  <option value="glass">Glass / Vidrio</option>
                </select>
                <small className="field-hint">Cómo se ve el fondo del popup</small>
              </div>

              <div className="form-group" style={{marginBottom:0}}>
                <label>✒️ Tipografía</label>
                <select
                  value={config.fontFamily || 'modern'}
                  onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                >
                  <option value="modern">Modern — Inter (sans)</option>
                  <option value="poppins">Poppins — moderna, redondeada</option>
                  <option value="minimal">Minimal — DM Sans</option>
                  <option value="bold">Bold — Space Grotesk</option>
                  <option value="rounded">Rounded — Nunito</option>
                  <option value="elegant">Elegant — Playfair Display (serif)</option>
                  <option value="editorial">Editorial — Fraunces (serif)</option>
                  <option value="luxe">Luxe — Cormorant (serif)</option>
                  <option value="mono">Mono — JetBrains (monoespacio)</option>
                </select>
                <small className="field-hint">Google Font aplicada al título, texto y botones</small>
              </div>

              <div className="form-group" style={{marginBottom:0}}>
                <label>💪 Peso del título</label>
                <select
                  value={config.titleFontWeight || '800'}
                  onChange={(e) => setConfig({ ...config, titleFontWeight: e.target.value })}
                >
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-Bold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extra-Bold (800)</option>
                  <option value="900">Black (900)</option>
                </select>
              </div>

              <div className="form-group" style={{marginBottom:0}}>
                <label>📐 Forma / esquinas</label>
                <select
                  value={config.borderRadiusStyle || 'rounded'}
                  onChange={(e) => setConfig({ ...config, borderRadiusStyle: e.target.value })}
                >
                  <option value="sharp">Recto (minimal)</option>
                  <option value="rounded">Redondeado (default)</option>
                  <option value="pill">Muy redondeado (pill)</option>
                </select>
              </div>
            </div>

            <div className="color-grid">
              <div className="form-group">
                <label>🎨 Color Primario</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    placeholder="#667EEA"
                  />
                </div>
                <small className="field-hint">Color principal del gradiente del popup</small>
              </div>

              <div className="form-group">
                <label>🌈 Color Secundario</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.secondaryColor}
                    onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                    placeholder="#764BA2"
                  />
                </div>
                <small className="field-hint">Color final del gradiente</small>
              </div>

              <div className="form-group">
                <label>📝 Color de Texto</label>
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
                <small className="field-hint">Color del título y subtítulo</small>
              </div>

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
                    placeholder="#667EEA"
                  />
                </div>
                <small className="field-hint">Color del botón "Girar"</small>
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
                    placeholder="#FFFFFF"
                  />
                </div>
                <small className="field-hint">Color del texto del botón</small>
              </div>

              <div className="form-group">
                <label>📄 Fondo del Modal</label>
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
                    placeholder="#FFFFFF"
                  />
                </div>
                <small className="field-hint">Color de fondo de la tarjeta principal</small>
              </div>

              <div className="form-group">
                <label>🌫️ Overlay (fondo oscuro)</label>
                <input
                  type="text"
                  value={config.overlayColor}
                  onChange={(e) => setConfig({ ...config, overlayColor: e.target.value })}
                  placeholder="rgba(0, 0, 0, 0.7)"
                />
                <small className="field-hint">Usa rgba para transparencia. Ej: rgba(0, 0, 0, 0.7)</small>
              </div>

              <div className="form-group">
                <label>⚪ Borde de la ruleta</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.wheelBorderColor || '#FFFFFF'}
                    onChange={(e) => setConfig({ ...config, wheelBorderColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.wheelBorderColor || '#FFFFFF'}
                    onChange={(e) => setConfig({ ...config, wheelBorderColor: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
                <small className="field-hint">Color del anillo que rodea la rueda</small>
              </div>

              <div className="form-group">
                <label>📍 Puntero / flecha</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.pointerColor || '#FF3860'}
                    onChange={(e) => setConfig({ ...config, pointerColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.pointerColor || '#FF3860'}
                    onChange={(e) => setConfig({ ...config, pointerColor: e.target.value })}
                    placeholder="#FF3860"
                  />
                </div>
                <small className="field-hint">Color del indicador que marca el premio ganador</small>
              </div>

              <div className="form-group">
                <label>📧 Fondo del input de email</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={(config.inputBgColor && config.inputBgColor.startsWith('#')) ? config.inputBgColor : '#FFFFFF'}
                    onChange={(e) => setConfig({ ...config, inputBgColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.inputBgColor || 'rgba(255,255,255,0.08)'}
                    onChange={(e) => setConfig({ ...config, inputBgColor: e.target.value })}
                    placeholder="#FFFFFF o rgba(...)"
                  />
                </div>
                <small className="field-hint">Acepta hex (#FFFFFF) o rgba(r,g,b,a) con transparencia</small>
              </div>

              <div className="form-group">
                <label>✏️ Color del texto del input</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={config.inputTextColor || '#FFFFFF'}
                    onChange={(e) => setConfig({ ...config, inputTextColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.inputTextColor || '#FFFFFF'}
                    onChange={(e) => setConfig({ ...config, inputTextColor: e.target.value })}
                    placeholder="#FFFFFF"
                  />
                </div>
                <small className="field-hint">Color del email escrito y del placeholder</small>
              </div>

              <div className="form-group">
                <label>🔲 Color del borde del input</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={(config.inputBorderColor && config.inputBorderColor.startsWith('#')) ? config.inputBorderColor : '#808080'}
                    onChange={(e) => setConfig({ ...config, inputBorderColor: e.target.value })}
                  />
                  <input
                    type="text"
                    value={config.inputBorderColor || 'rgba(128,128,128,0.25)'}
                    onChange={(e) => setConfig({ ...config, inputBorderColor: e.target.value })}
                    placeholder="#808080 o rgba(...)"
                  />
                </div>
                <small className="field-hint">Acepta hex o rgba(r,g,b,a) con transparencia</small>
              </div>
            </div>

            <div className="style-preview" style={{
              background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`,
              color: config.textColor,
              padding: '40px',
              borderRadius: '16px',
              textAlign: 'center',
              marginTop: '20px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
              {config.showLogo && config.logoUrl && (
                <img src={config.logoUrl} alt="Logo" style={{ maxWidth: '200px', marginBottom: '20px' }} />
              )}
              <h3 style={{ margin: '0 0 10px', fontSize: '28px', color: config.textColor }}>{config.title}</h3>
              <p style={{ margin: '0 0 20px', opacity: 0.9, color: config.textColor }}>{config.subtitle}</p>
              <button style={{
                background: config.buttonColor,
                color: config.buttonTextColor,
                border: 'none',
                padding: '12px 30px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {config.buttonText}
              </button>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="config-section">
            <h2>📧 Integraciones de Email</h2>
            <p className="section-description">
              Conectá la ruleta con tu plataforma de email marketing para enviar automáticamente los contactos capturados.
            </p>

            <div className="integration-card">
              <div className="integration-header">
                <div className="integration-icon" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
                  <Mail size={24} color="white" />
                </div>
                <div>
                  <h3>Perfit</h3>
                  <p>Plataforma de email marketing y automation</p>
                </div>
              </div>

              <div className="form-group">
                <label>ID de Lista de Perfit</label>
                <input
                  type="text"
                  value={config.perfitListId || ''}
                  onChange={(e) => setConfig({ ...config, perfitListId: e.target.value })}
                  placeholder="Ej: 12345"
                />
                <div className="form-hint">
                  💡 El ID numérico de tu lista en Perfit (ej: 12345). Lo encontrás en Perfit: Listas → seleccioná la lista → el número en la URL. Si lo dejás vacío, se usará la lista por defecto configurada en Integraciones.
                  <br />
                  📝 Configurá primero tus credenciales de Perfit en{' '}
                  <button
                    className="link-button"
                    onClick={() => navigate('/integrations')}
                    style={{color: '#667eea', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer'}}
                  >
                    Integraciones
                  </button>
                </div>
              </div>

              <div className="tags-info">
                <strong>Tags automáticos que se agregarán:</strong>
                <div className="tag-list">
                  <span className="tag">spin_wheel</span>
                  <span className="tag">premio_{'{tipo}'}</span>
                  <span className="tag">con_cupon / sin_cupon</span>
                </div>
              </div>

              <div className="custom-fields-info">
                <strong>Campos personalizados incluidos:</strong>
                <ul>
                  <li><code>ultimo_premio</code>: Nombre del premio ganado</li>
                  <li><code>cupon_codigo</code>: Código del cupón (si aplica)</li>
                  <li><code>fecha_giro</code>: Fecha y hora del giro</li>
                </ul>
              </div>
            </div>

            <div className="info-box" style={{marginTop: '24px'}}>
              <strong>ℹ️ Cómo funciona:</strong>
              <ol style={{margin: '8px 0 0 20px'}}>
                <li>El usuario ingresa su email y gira la ruleta</li>
                <li>Se crea el cupón de descuento en TiendaNube</li>
                <li>El email se envía automáticamente a Perfit con tags y datos del premio</li>
                <li>Podés crear automaciones en Perfit basadas en estos tags</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal - Popup real */}
      {showPreview && (() => {
        // Presets de fuente (espejo del widget)
        const FONT_PRESETS = {
          modern: { link: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap', stack: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" },
          poppins: { link: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap', stack: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" },
          elegant: { link: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap', stack: "'Playfair Display', Georgia, serif" },
          luxe: { link: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap', stack: "'Cormorant Garamond', Georgia, serif" },
          minimal: { link: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap', stack: "'DM Sans', -apple-system, sans-serif" },
          bold: { link: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap', stack: "'Space Grotesk', -apple-system, sans-serif" },
          editorial: { link: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700;800;900&display=swap', stack: "'Fraunces', Georgia, serif" },
          rounded: { link: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap', stack: "'Nunito', -apple-system, sans-serif" },
          mono: { link: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap', stack: "'JetBrains Mono', ui-monospace, monospace" }
        };
        const fontPreset = FONT_PRESETS[config.fontFamily] || FONT_PRESETS.modern;
        const RADIUS_PRESETS = { sharp: '4px', rounded: '20px', pill: '32px' };
        const modalRadius = RADIUS_PRESETS[config.borderRadiusStyle] || '20px';
        const buttonRadius = config.borderRadiusStyle === 'pill' ? '999px' : (config.borderRadiusStyle === 'sharp' ? '4px' : '12px');
        let modalBackground;
        if (config.modalStyle === 'solid') {
          modalBackground = config.primaryColor;
        } else if (config.modalStyle === 'glass') {
          modalBackground = 'rgba(20, 20, 30, 0.75)';
        } else {
          modalBackground = `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`;
        }
        const glassStyle = config.modalStyle === 'glass'
          ? { backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)', border: '1px solid rgba(255,255,255,0.15)' }
          : {};
        const titleWeight = parseInt(config.titleFontWeight, 10) || 800;

        return (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.95) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            animation: 'pnFadeIn 0.3s ease-out',
            fontFamily: fontPreset.stack,
            padding: '16px'
          }}
        >
          {/* Cargar la Google Font seleccionada */}
          <link rel="stylesheet" href={fontPreset.link} />
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: modalBackground,
              ...glassStyle,
              padding: '40px 32px 32px',
              borderRadius: modalRadius,
              maxWidth: '440px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              color: config.textColor || '#FFFFFF',
              textAlign: 'center',
              position: 'relative',
              animation: 'pnSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 24px 80px -8px rgba(0, 0, 0, 0.5)',
              fontFamily: fontPreset.stack
            }}
          >
            {/* Botón cerrar */}
            <button
              onClick={() => setShowPreview(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: config.textColor || '#FFFFFF',
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 2,
                lineHeight: 0
              }}
              aria-label="Cerrar"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Logo */}
            {config.showLogo && config.logoUrl && (
              <img
                src={config.logoUrl}
                alt="Logo"
                style={{ maxWidth: '180px', marginBottom: '16px' }}
                onError={(e) => e.target.style.display = 'none'}
              />
            )}

            {/* Título */}
            <h1 style={{
              fontFamily: fontPreset.stack,
              fontSize: '28px',
              margin: '0 0 8px',
              fontWeight: titleWeight,
              letterSpacing: '-0.015em',
              lineHeight: 1.15,
              color: config.textColor || '#FFFFFF'
            }}>
              {config.title}
            </h1>

            {/* Subtítulo */}
            <p style={{
              fontSize: '14px',
              margin: '0 0 24px',
              opacity: 0.82,
              lineHeight: 1.5,
              fontWeight: 400,
              color: config.textColor || '#FFFFFF'
            }}>
              {config.subtitle}
            </p>

            {/* Ruleta SVG minimalista con aro exterior */}
            <div style={{
              position: 'relative',
              width: '300px',
              height: '300px',
              margin: '4px auto 28px',
              padding: '6px',
              boxSizing: 'border-box'
            }}>
              {/* Aro exterior */}
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: config.wheelBorderColor || '#FFFFFF',
                boxShadow: '0 18px 50px -12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.08)',
                zIndex: 0
              }} />

              {/* Puntero minimalista */}
              <div style={{
                position: 'absolute',
                top: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '26px',
                height: '32px',
                zIndex: 10,
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))'
              }}>
                <svg viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
                  <path
                    d="M12 30 L2 4 Q12 -2 22 4 Z"
                    fill={config.pointerColor || '#FF3860'}
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
                <svg
                  viewBox="0 0 320 320"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    display: 'block'
                  }}
                >
                  <g>
                    {(() => {
                      const totalSegs = config.segments.length;
                      let fontSize = 16;
                      let maxLabelLen = 12;
                      let textRadius = 100;
                      if (totalSegs <= 5) { fontSize = 16; maxLabelLen = 12; textRadius = 100; }
                      else if (totalSegs <= 7) { fontSize = 13; maxLabelLen = 10; textRadius = 95; }
                      else if (totalSegs <= 9) { fontSize = 11; maxLabelLen = 8; textRadius = 90; }
                      else { fontSize = 9; maxLabelLen = 7; textRadius = 85; }
                      return config.segments.map((segment, index) => {
                        const segmentAngle = 360 / totalSegs;
                        const startAngle = index * segmentAngle - 90;
                        const endAngle = startAngle + segmentAngle;
                        const startRad = startAngle * Math.PI / 180;
                        const endRad = endAngle * Math.PI / 180;
                        const x1 = 160 + 150 * Math.cos(startRad);
                        const y1 = 160 + 150 * Math.sin(startRad);
                        const x2 = 160 + 150 * Math.cos(endRad);
                        const y2 = 160 + 150 * Math.sin(endRad);
                        const largeArc = segmentAngle > 180 ? 1 : 0;
                        const textAngle = startAngle + (segmentAngle / 2);
                        const textRad = textAngle * Math.PI / 180;
                        const textX = 160 + textRadius * Math.cos(textRad);
                        const textY = 160 + textRadius * Math.sin(textRad);
                        const displayLabel = segment.label.length > maxLabelLen
                          ? segment.label.substring(0, maxLabelLen) + '…'
                          : segment.label;

                        return (
                          <g key={segment.id}>
                            <path
                              d={`M 160 160 L ${x1} ${y1} A 150 150 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={segment.color}
                              stroke="rgba(255,255,255,0.9)"
                              strokeWidth="1"
                            />
                            <text
                              x={textX}
                              y={textY}
                              fill="white"
                              fontSize={fontSize}
                              fontWeight="600"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                              style={{ pointerEvents: 'none', letterSpacing: '0.02em', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                            >
                              {displayLabel}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </g>
                </svg>

                {/* Centro con anillo concéntrico */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '42px',
                  height: '42px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  boxShadow: `0 0 0 4px ${config.wheelBorderColor || '#FFFFFF'}, 0 0 0 5px rgba(0,0,0,0.1), 0 4px 14px rgba(0,0,0,0.22)`,
                  zIndex: 10
                }}>
                  {config.centerEmoji !== undefined ? config.centerEmoji : '🎁'}
                </div>
              </div>
            </div>

            {/* Campo de email */}
            {config.showEmailField !== false && (
              <input
                type="email"
                placeholder={config.emailPlaceholder || 'tu@email.com'}
                readOnly
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `1.5px solid ${config.inputBorderColor || 'rgba(128,128,128,0.25)'}`,
                  borderRadius: buttonRadius,
                  fontSize: '15px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  background: config.inputBgColor || 'rgba(255,255,255,0.08)',
                  color: config.inputTextColor || config.textColor || '#FFFFFF',
                  WebkitTextFillColor: config.inputTextColor || config.textColor || '#FFFFFF',
                  opacity: 1,
                  fontWeight: 500,
                  fontFamily: fontPreset.stack
                }}
              />
            )}

            {/* Botón girar */}
            <button
              disabled
              style={{
                background: config.buttonColor || '#FFFFFF',
                color: config.buttonTextColor || config.primaryColor,
                border: 'none',
                padding: '16px 32px',
                borderRadius: buttonRadius,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'default',
                width: '100%',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: fontPreset.stack,
                opacity: 0.95
              }}
            >
              {config.buttonText}
            </button>

            <p style={{
              fontSize: '12px',
              opacity: 0.65,
              marginTop: '14px',
              color: config.textColor || '#FFFFFF'
            }}>
              {config.termsText}
            </p>

            <div style={{
              marginTop: '14px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              fontSize: '11px',
              opacity: 0.7,
              letterSpacing: '0.02em'
            }}>
              Vista previa — así se verá el popup real en tu tienda
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default SpinWheelConfig;
