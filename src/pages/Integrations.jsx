import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './Integrations.css';

function Integrations() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  
  const [integrations, setIntegrations] = useState({
    perfit: { enabled: false, configured: false },
    mailchimp: { enabled: false, configured: false },
    activecampaign: { enabled: false, configured: false }
  });

  const [perfitConfig, setPerfitConfig] = useState({
    apiKey: '',
    accountId: '',
    defaultList: '',
    enabled: false
  });

  const [mailchimpConfig, setMailchimpConfig] = useState({
    apiKey: '',
    listId: '',
    enabled: false
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const response = await apiRequest(`/api/integrations?storeId=${storeId}`);
      
      if (response.success) {
        setIntegrations(response.integrations);
        
        // Cargar datos existentes
        setPerfitConfig({
          accountId: response.integrations.perfit.accountId || '',
          defaultList: response.integrations.perfit.defaultList || '',
          enabled: response.integrations.perfit.enabled,
          apiKey: '' // No devolvemos la API key por seguridad
        });
        
        setMailchimpConfig({
          listId: response.integrations.mailchimp.listId || '',
          enabled: response.integrations.mailchimp.enabled,
          apiKey: ''
        });
      }
    } catch (error) {
      console.error('Error cargando integraciones:', error);
      toast.info('Error al cargar integraciones');
    } finally {
      setLoading(false);
    }
  };

  const savePerfitConfig = async () => {
    setSaving(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const response = await apiRequest('/api/integrations/perfit', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          ...perfitConfig
        })
      });

      if (response.success) {
        toast.success('Perfit configurado correctamente');
        loadIntegrations();
      } else {
        toast.error('Error: ' + response.message);
      }
    } catch (error) {
      console.error('Error guardando Perfit:', error);
      toast.info('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const saveMailchimpConfig = async () => {
    setSaving(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const response = await apiRequest('/api/integrations/mailchimp', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          ...mailchimpConfig
        })
      });

      if (response.success) {
        toast.success('Mailchimp configurado correctamente');
        loadIntegrations();
      } else {
        toast.error('Error: ' + response.message);
      }
    } catch (error) {
      console.error('Error guardando Mailchimp:', error);
      toast.info('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };
  const testIntegration = async (integration) => {
    const email = prompt('Ingresá un email para probar la integración:');
    if (!email) return;

    setTesting(integration);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const response = await apiRequest('/api/integrations/test', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          integration,
          email
        })
      });

      if (response.success) {
        toast.success(`Test exitoso! El contacto "${email}" fue enviado a ${integration}`);
      } else {
        const detail = response.details
          ? `\nHTTP ${response.details.status || ''} ${response.details.statusText || ''}\n${response.details.body || ''}`
          : (response.error ? `\n${response.error}` : '');
        toast.error(`Error: ${response.error || response.message || 'No se pudo enviar'}${detail}`);
      }
    } catch (error) {
      console.error('Error probando integración:', error);
      toast.error('Error al probar integración: ' + error.message);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="integrations-loading">Cargando integraciones...</div>;
  }

  return (
    <div className="integrations-container">
      <div className="integrations-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Volver
        </button>
        <h1>🔌 Integraciones de Email Marketing</h1>
        <p className="subtitle">
          Conectá GlowLab con tus plataformas de email marketing para automatizar 
          la captura y segmentación de contactos
        </p>
      </div>

      <div className="integrations-grid">
        
        {/* PERFIT */}
        <div className="integration-card">
          <div className="integration-header">
            <div className="integration-logo perfit-logo">📧</div>
            <div>
              <h2>Perfit</h2>
              <span className={`status-badge ${integrations.perfit.configured ? 'configured' : 'not-configured'}`}>
                {integrations.perfit.configured ? '✓ Configurado' : '○ Sin configurar'}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={perfitConfig.enabled}
                onChange={(e) => setPerfitConfig({...perfitConfig, enabled: e.target.checked})}
              />
              <span className="slider"></span>
            </label>
          </div>

          <p className="integration-description">
            Perfit es la plataforma de email marketing líder en LATAM. 
            Conectá tu cuenta para sincronizar automáticamente los contactos de la ruleta.
          </p>

          <div className="integration-form">
            <div className="form-group">
              <label>
                API Key 
                <a 
                  href="https://app.perfit.com/settings/altorancho2/users/me" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{marginLeft: '10px', fontSize: '12px', color: '#667eea'}}
                >
                  ¿Cómo obtenerla? →
                </a>
              </label>
              <input
                type="password"
                placeholder="altoranchio2-XXXXXXXXXXX"
                value={perfitConfig.apiKey}
                onChange={(e) => setPerfitConfig({...perfitConfig, apiKey: e.target.value})}
              />
              <small>📍 En tu cuenta Perfit: Configuración → Usuarios → Tu nombre → "Obtener API key"</small>
            </div>

            <div className="form-group">
              <label>Account ID</label>
              <input
                type="text"
                placeholder="altorancho2"
                value={perfitConfig.accountId}
                onChange={(e) => setPerfitConfig({...perfitConfig, accountId: e.target.value})}
              />
              <small>📍 Nombre de tu cuenta en Perfit (aparece en la URL: app.perfit.com/settings/<strong>nombre-cuenta</strong>)</small>
            </div>

            <div className="form-group">
              <label>ID de Lista Perfit (opcional)</label>
              <input
                type="text"
                placeholder="Ej: 12345"
                value={perfitConfig.defaultList}
                onChange={(e) => setPerfitConfig({...perfitConfig, defaultList: e.target.value})}
              />
              <small>💡 El ID numérico de tu lista en Perfit. Lo encontrás en Perfit: Listas → seleccionar lista → el número en la URL. Si lo dejás vacío, los contactos se agregan sin lista asignada.</small>
            </div>

            <div className="integration-actions">
              <button 
                onClick={savePerfitConfig} 
                disabled={saving}
                className="btn-save"
              >
                {saving ? 'Guardando...' : '💾 Guardar Configuración'}
              </button>

              <button
                onClick={() => testIntegration('perfit')}
                disabled={testing === 'perfit'}
                className="btn-test"
              >
                {testing === 'perfit' ? 'Probando...' : '🧪 Probar Conexión'}
              </button>
            </div>
          </div>

          <div className="integration-benefits">
            <h4>✨ Beneficios:</h4>
            <ul>
              <li>Sincronización automática de emails</li>
              <li>Segmentación por premio ganado</li>
              <li>Tags automáticos (spin_wheel, con_cupon, etc)</li>
              <li>Custom fields con datos del giro</li>
            </ul>
          </div>
        </div>

        {/* MAILCHIMP */}
        <div className="integration-card">
          <div className="integration-header">
            <div className="integration-logo mailchimp-logo">🐵</div>
            <div>
              <h2>Mailchimp</h2>
              <span className={`status-badge ${integrations.mailchimp.configured ? 'configured' : 'not-configured'}`}>
                {integrations.mailchimp.configured ? '✓ Configurado' : '○ Sin configurar'}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={mailchimpConfig.enabled}
                onChange={(e) => setMailchimpConfig({...mailchimpConfig, enabled: e.target.checked})}
              />
              <span className="slider"></span>
            </label>
          </div>

          <p className="integration-description">
            Conectá con Mailchimp para agregar automáticamente los contactos 
            de tu ruleta a tus listas de suscriptores.
          </p>

          <div className="integration-form">
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                placeholder="Tu API Key de Mailchimp"
                value={mailchimpConfig.apiKey}
                onChange={(e) => setMailchimpConfig({...mailchimpConfig, apiKey: e.target.value})}
              />
              <small>Encontrala en Mailchimp → Profile → Extras → API keys</small>
            </div>

            <div className="form-group">
              <label>List ID (Audience ID)</label>
              <input
                type="text"
                placeholder="abc123def4"
                value={mailchimpConfig.listId}
                onChange={(e) => setMailchimpConfig({...mailchimpConfig, listId: e.target.value})}
              />
              <small>Settings → Audience name and defaults → Audience ID</small>
            </div>

            <div className="integration-actions">
              <button 
                onClick={saveMailchimpConfig} 
                disabled={saving}
                className="btn-save"
              >
                {saving ? 'Guardando...' : '💾 Guardar Configuración'}
              </button>
              
              {integrations.mailchimp.configured && (
                <button 
                  onClick={() => testIntegration('mailchimp')}
                  disabled={testing === 'mailchimp'}
                  className="btn-test"
                >
                  {testing === 'mailchimp' ? 'Probando...' : '🧪 Probar Conexión'}
                </button>
              )}
            </div>
          </div>

          <div className="integration-benefits">
            <h4>✨ Beneficios:</h4>
            <ul>
              <li>Agregar contactos automáticamente</li>
              <li>Tags por tipo de premio</li>
              <li>Merge fields personalizados</li>
              <li>Sincronización bidireccional</li>
            </ul>
          </div>
        </div>

        {/* ACTIVECAMPAIGN - Próximamente */}
        <div className="integration-card coming-soon">
          <div className="integration-header">
            <div className="integration-logo">📬</div>
            <div>
              <h2>ActiveCampaign</h2>
              <span className="status-badge coming-soon-badge">🚀 Próximamente</span>
            </div>
          </div>

          <p className="integration-description">
            Próximamente podrás conectar con ActiveCampaign para automatizar 
            tus campañas de email marketing.
          </p>

          <div className="coming-soon-info">
            <p>📢 Esta integración estará disponible pronto</p>
            <button className="btn-notify" disabled>
              Notificarme cuando esté lista
            </button>
          </div>
        </div>

      </div>

      <div className="integrations-footer">
        <div className="help-box">
          <h3>💡 ¿Necesitás ayuda?</h3>
          <p>
            Si tenés dudas sobre cómo configurar las integraciones, 
            visitá nuestra <a href="#docs">documentación</a> o contactanos 
            en <a href="mailto:info@techdi.com.ar">info@techdi.com.ar</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Integrations;
