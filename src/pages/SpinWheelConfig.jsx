import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Settings, Palette, Target, Clock, Link as LinkIcon, Plus, Trash2, Code, Copy, BarChart3, Mail } from 'lucide-react';
import { apiRequest } from '../config';
import './SpinWheelConfig.css';

function SpinWheelConfig() {
  const navigate = useNavigate();
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
    buttonTextColor: '#FFFFFF'
  });

  const [activeTab, setActiveTab] = useState('general');
  const [showPreview, setShowPreview] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadConfig();
    }
    setScriptUrl(`https://apipromonube-jlfopowzaq-uc.a.run.app/api/spin-wheel/script.js?storeId=${storeId}`);
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
        alert(config.enabled 
          ? '✅ Ruleta guardada y activada! Ya está visible en tu tienda' 
          : '✅ Configuración guardada. Activala para que aparezca en tu tienda');
        if (!isEdit && data.wheelId) {
          navigate(`/spin-wheel/${data.wheelId}/config`);
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
      alert('Debe haber al menos 2 segmentos');
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

  const copyScript = () => {
    const scriptCode = `<!-- GlowLab Spin Wheel -->\n<script src="${scriptUrl}" async></script>`;
    navigator.clipboard.writeText(scriptCode);
    alert('✅ Código copiado al portapapeles!');
  };

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
                value={config.centerEmoji || '🎁'}
                onChange={(e) => setConfig({ ...config, centerEmoji: e.target.value })}
                placeholder="🎁"
                maxLength={10}
              />
              <div className="form-hint">Emoji o texto que aparece en el centro de la rueda. Ej: 🎁 🎯 ⭐ 🔥 o el nombre de tu marca</div>
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

            <div className="info-box" style={{marginTop: '24px', padding: '16px', background: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '8px'}}>
              <strong style={{color: '#0284c7'}}>ℹ️ Cómo funciona:</strong>
              <ol style={{margin: '8px 0 0 20px', color: '#0369a1'}}>
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
      {showPreview && (
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
            background: config.overlayColor || 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            animation: 'pnFadeIn 0.3s ease-out',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          }}
        >
          <div 
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
              padding: '40px 30px',
              borderRadius: '24px',
              maxWidth: '480px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: config.textColor || '#FFFFFF',
              textAlign: 'center',
              position: 'relative',
              animation: 'pnSlideUp 0.4s ease-out',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Botón cerrar */}
            <button 
              onClick={() => setShowPreview(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: '#1a1a1a',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '28px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              ×
            </button>

            {/* Logo */}
            {config.showLogo && config.logoUrl && (
              <img 
                src={config.logoUrl} 
                alt="Logo" 
                style={{ maxWidth: '200px', marginBottom: '20px' }} 
                onError={(e) => e.target.style.display = 'none'} 
              />
            )}

            {/* Título */}
            <h1 style={{
              fontSize: '32px',
              margin: '0 0 8px',
              fontWeight: 800,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              lineHeight: 1.2,
              color: config.textColor || '#FFFFFF'
            }}>
              {config.title}
            </h1>

            {/* Subtítulo */}
            <p style={{
              fontSize: '16px',
              margin: '0 0 24px',
              opacity: 0.95,
              lineHeight: 1.4,
              color: config.textColor || '#FFFFFF'
            }}>
              {config.subtitle}
            </p>

            {/* Ruleta SVG */}
            <div style={{
              position: 'relative',
              width: '300px',
              height: '300px',
              margin: '0 auto 24px'
            }}>
              {/* Puntero */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '20px solid transparent',
                borderRight: '20px solid transparent',
                borderTop: '35px solid #FF0040',
                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))',
                zIndex: 10
              }} />

              <div style={{ position: 'relative' }}>
                <svg 
                  viewBox="0 0 320 320" 
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '10px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 0 0 3px rgba(0, 0, 0, 0.1), 0 0 32px rgba(0, 0, 0, 0.2) inset, 0 16px 48px rgba(0, 0, 0, 0.3)',
                    background: config.backgroundColor || '#FFFFFF'
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
                              stroke="white"
                              strokeWidth="2"
                            />
                            <text
                              x={textX}
                              y={textY}
                              fill="white"
                              fontSize={fontSize}
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                              style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                            >
                              {displayLabel}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </g>
                </svg>

                {/* Centro de la ruleta */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '72px',
                  height: '72px',
                  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  boxShadow: '0 0 0 4px rgba(0, 0, 0, 0.05), 0 8px 24px rgba(0, 0, 0, 0.3)',
                  zIndex: 10,
                  fontWeight: 'bold',
                  border: '3px solid rgba(255, 255, 255, 0.9)'
                }}>
                  {config.centerEmoji || '🎁'}
                </div>
              </div>
            </div>

            {/* Campo de email */}
            {config.showEmailField !== false && (
              <input
                type="email"
                placeholder={config.emailPlaceholder || 'tu@email.com'}
                disabled
                style={{
                  width: '100%',
                  padding: '16px',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  color: '#999',
                  fontWeight: 500
                }}
              />
            )}

            {/* Botón girar */}
            <button
              disabled
              style={{
                background: config.buttonColor || 'white',
                color: config.buttonTextColor || config.primaryColor,
                border: 'none',
                padding: '18px 32px',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'default',
                width: '100%',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                opacity: 0.9
              }}
            >
              {config.buttonText}
            </button>

            <p style={{
              fontSize: '12px',
              opacity: 0.7,
              marginTop: '16px',
              color: config.textColor || '#FFFFFF'
            }}>
              {config.termsText}
            </p>

            <div style={{
              marginTop: '16px',
              padding: '10px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              opacity: 0.7
            }}>
              👆 Esta es una vista previa. Así se verá el popup en tu tienda.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpinWheelConfig;
