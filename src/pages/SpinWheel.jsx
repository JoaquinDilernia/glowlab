import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Settings, Eye, Code, Sparkles, Palette, Zap, Mail, Gift, BarChart2 } from 'lucide-react';
import { apiRequest } from '../config';
import './SpinWheel.css';

function SpinWheel() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(true);
  const [wheels, setWheels] = useState([]);

  useEffect(() => {
    loadWheels();
  }, []);

  const loadWheels = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/spin-wheels?storeId=${storeId}`);
      if (data.success) {
        console.log('🎰 Ruletas cargadas:', data.wheels);
        setWheels(data.wheels || []);
      }
    } catch (error) {
      console.error('Error loading wheels:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      icon: Plus,
      title: 'Nueva Ruleta',
      description: 'Crear ruleta desde cero',
      action: () => navigate('/spin-wheel/create'),
      color: '#667eea'
    },
    {
      icon: Sparkles,
      title: 'Usar Template',
      description: 'Plantillas prediseñadas',
      action: () => navigate('/spin-wheel/templates'),
      color: '#f59e0b'
    }
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando ruletas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spin-wheel-container">
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-primary-gradient" onClick={() => navigate('/spin-wheel/create')}>
              <Plus size={18} />
              <span>Nueva Ruleta</span>
            </button>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">🎰 Ruleta de la Suerte</h1>
            <p className="page-subtitle-modern">Gamificación que convierte visitantes en clientes</p>
          </div>
        </div>
      </header>

      {wheels.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-icon-large">🎰</div>
          <h2 className="empty-title">¡Tu Primera Ruleta te Espera!</h2>
          <p className="empty-description">Captura emails y aumenta ventas con gamificación</p>
          
          <div className="benefits-grid">
            <div className="benefit-card">
              <span className="benefit-icon">📧</span>
              <h3>Captura Emails</h3>
              <p>Construí tu lista con visitantes</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">🎯</span>
              <h3>Aumenta Engagement</h3>
              <p>Gamificación que convierte</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">💰</span>
              <h3>Impulsa Ventas</h3>
              <p>Cupones únicos y urgencia</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">📊</span>
              <h3>Analytics Completo</h3>
              <p>Seguimiento detallado</p>
            </div>
          </div>

          <div className="quick-actions-modern">
            {quickActions.map((action, index) => (
              <div
                key={index}
                className="quick-action-card-modern"
                onClick={action.action}
              >
                <div className="action-icon-modern" style={{ color: action.color }}>
                  <action.icon size={32} strokeWidth={2} />
                </div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="wheels-list-modern">
          <div className="wheels-grid-modern">
            {wheels.map(wheel => {
              const prizes = wheel.prizes || wheel.segments || [];
              const isActive = wheel.active || wheel.enabled || false;
              
              return (
                <div key={wheel.wheelId} className="wheel-card-modern">
                  <div className="wheel-card-header">
                    <div className="wheel-preview-modern">
                      {prizes.length > 0 ? (
                        <div className="wheel-mini-modern" style={{
                          background: `conic-gradient(${prizes.map((p, i) => 
                            `${p.color || '#667eea'} ${i * (360 / prizes.length)}deg ${(i + 1) * (360 / prizes.length)}deg`
                          ).join(', ')})`
                        }}>
                          <div className="wheel-center">🎰</div>
                        </div>
                      ) : (
                        <div className="wheel-mini-modern" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                          <div className="wheel-center">🎰</div>
                        </div>
                      )}
                    </div>
                    <span className={`status-badge-modern ${isActive ? 'active' : 'inactive'}`}>
                      {isActive ? '✓ Activo' : '○ Inactivo'}
                    </span>
                  </div>

                  <div className="wheel-info-modern">
                    <h3 className="wheel-title">{wheel.name || 'Ruleta sin nombre'}</h3>
                    <p className="wheel-subtitle">{wheel.description || wheel.subtitle || 'Sin descripción'}</p>
                    
                    <div className="wheel-stats-modern">
                      <div className="stat-item-modern">
                        <Zap size={16} className="stat-icon" />
                        <div>
                          <span className="stat-value">{wheel.totalSpins || 0}</span>
                          <span className="stat-label">Giros</span>
                        </div>
                      </div>
                      <div className="stat-item-modern">
                        <Mail size={16} className="stat-icon" />
                        <div>
                          <span className="stat-value">{wheel.emailsCollected || 0}</span>
                          <span className="stat-label">Emails</span>
                        </div>
                      </div>
                      <div className="stat-item-modern">
                        <Gift size={16} className="stat-icon" />
                        <div>
                          <span className="stat-value">{prizes.length}</span>
                          <span className="stat-label">Premios</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="wheel-actions-modern">
                    <button 
                      className="btn-action-modern btn-primary"
                      onClick={() => navigate(`/spin-wheel/${wheel.wheelId}/config`)}
                    >
                      <Settings size={16} />
                      <span>Configurar</span>
                    </button>
                    <button 
                      className="btn-action-modern"
                      onClick={() => navigate(`/spin-wheel/${wheel.wheelId}/analytics`)}
                    >
                      <BarChart2 size={16} />
                      <span>Analytics</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SpinWheel;
