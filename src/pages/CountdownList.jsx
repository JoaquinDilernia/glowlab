import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Clock, Zap, Calendar, Eye, Settings, Trash2, Copy } from 'lucide-react';
import { apiRequest } from '../config';
import { useToast } from '../context/ToastContext';
import './CountdownList.css';

function CountdownList() {
  const navigate = useNavigate();
  const toast = useToast();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState([]);

  useEffect(() => {
    loadCountdowns();
  }, []);

  const loadCountdowns = async () => {
    setLoading(true);
    try {
      console.log('⏰ Loading countdowns for storeId:', storeId);
      const data = await apiRequest(`/api/countdowns?storeId=${storeId}`);
      if (data.success) {
        console.log('✅ Countdowns cargados:', data.countdowns);
        setCountdowns(data.countdowns || []);
      }
    } catch (error) {
      console.error('Error loading countdowns:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCountdown = async (countdownId) => {
    if (!window.confirm('¿Eliminar esta cuenta regresiva?')) return;
    
    try {
      const data = await apiRequest(`/api/countdowns/${countdownId}?storeId=${storeId}`, {
        method: 'DELETE'
      });

      if (data.success) {
        setCountdowns(prev => prev.filter(c => c.countdownId !== countdownId));
        toast.success('Cuenta regresiva eliminada');
      } else {
        toast.error('Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    }
  };

  const toggleStatus = async (countdownId, currentStatus) => {
    try {
      const data = await apiRequest(`/api/countdowns/${countdownId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        setCountdowns(prev => prev.map(c => 
          c.countdownId === countdownId ? { ...c, enabled: data.enabled } : c
        ));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (countdown) => {
    if (!countdown.enabled) {
      return <span className="status-badge inactive">⭕ Pausado</span>;
    }

    const now = new Date();
    const endDate = new Date(countdown.endDate);
    
    if (countdown.type === 'upcoming') {
      const startDate = new Date(countdown.startDate);
      if (now < startDate) {
        return <span className="status-badge upcoming">🕐 Próximo</span>;
      }
      return <span className="status-badge started">🚀 Iniciado</span>;
    }

    if (now > endDate) {
      return <span className="status-badge expired">❌ Finalizado</span>;
    }

    return <span className="status-badge active">✅ Activo</span>;
  };

  const quickActions = [
    {
      icon: Zap,
      title: 'Finalización',
      description: 'Cierre de promo, flash sale o evento activo',
      action: () => navigate('/countdown/create?type=active'),
      color: '#f59e0b'
    },
    {
      icon: Calendar,
      title: 'Próximamente',
      description: 'Lanzamientos, eventos o promos futuras',
      action: () => navigate('/countdown/create?type=upcoming'),
      color: '#8b5cf6'
    }
  ];

  if (loading) {
    return (
      <div className="countdown-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando cuentas regresivas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="countdown-container">
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-primary-gradient" onClick={() => navigate('/countdown/create')}>
              <Plus size={18} />
              <span>Nueva Cuenta Regresiva</span>
            </button>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">⏰ Cuenta Regresiva</h1>
            <p className="page-subtitle-modern">Crea urgencia con timers de promociones limitadas</p>
          </div>
        </div>
      </header>

      {countdowns.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-icon-large">⏰</div>
          <h2 className="empty-title">Crea Tu Primera Cuenta Regresiva</h2>
          <p className="empty-description">Generá urgencia real y aumentá conversiones con contadores en tu tienda</p>

          <div className="quick-actions-modern" style={{marginTop: '40px'}}>
            {quickActions.map((action) => (
              <div key={action.title} className="quick-action-card-modern" onClick={action.action} style={{cursor: 'pointer'}}>
                <div className="action-icon-modern" style={{ color: action.color }}>
                  <action.icon size={40} strokeWidth={2.5} />
                </div>
                <h3 style={{fontSize: '20px', marginTop: '16px'}}>{action.title}</h3>
                <p style={{fontSize: '15px', marginTop: '8px'}}>{action.description}</p>
              </div>
            ))}
          </div>

          <div className="em-usecases-box">
            <h4 className="em-usecases-title">💡 ¿Cuándo usar cada tipo?</h4>
            <div className="em-usecases-list">
              <div className="em-usecase-item">
                <span className="em-usecase-icon">⚡</span>
                <div>
                  <strong>Finalización</strong>
                  <p>Flash sales, últimas horas de promo, stock limitado, cierre de eventos</p>
                </div>
              </div>
              <div className="em-usecase-item">
                <span className="em-usecase-icon">🚀</span>
                <div>
                  <strong>Próximamente</strong>
                  <p>Lanzamiento de productos, Black Friday, preventa exclusiva, eventos futuros</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="countdowns-list-modern">
          <div className="countdowns-grid-modern">
            {countdowns.map(countdown => (
              <div key={countdown.countdownId} className="countdown-card-modern">
                <div className="countdown-card-header">
                  <div className="countdown-type-badge" style={{
                    background: countdown.type === 'active' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                  }}>
                    {countdown.type === 'active' ? (
                      <><Zap size={14} /> Flash Sale</>
                    ) : (
                      <><Calendar size={14} /> Próximo</>
                    )}
                  </div>
                  {getStatusBadge(countdown)}
                </div>

                <div className="countdown-info-modern">
                  <h3 className="countdown-title">{countdown.name}</h3>
                  <p className="countdown-subtitle">{countdown.message}</p>
                  
                  <div className="countdown-dates">
                    {countdown.type === 'upcoming' && (
                      <div className="date-item">
                        <Calendar size={14} />
                        <span>Inicia: {formatDate(countdown.startDate)}</span>
                      </div>
                    )}
                    <div className="date-item">
                      <Clock size={14} />
                      <span>Termina: {formatDate(countdown.endDate)}</span>
                    </div>
                  </div>

                  {countdown.buttonText && (
                    <div className="countdown-cta">
                      <span className="cta-label">Botón:</span>
                      <span className="cta-text">"{countdown.buttonText}"</span>
                    </div>
                  )}
                </div>

                <div className="countdown-actions-modern">
                  <button 
                    className={`btn-toggle-small ${countdown.enabled ? 'active' : ''}`}
                    onClick={() => toggleStatus(countdown.countdownId, countdown.enabled)}
                    title={countdown.enabled ? 'Pausar' : 'Activar'}
                  >
                    <span className="toggle-dot-small"></span>
                    {countdown.enabled ? 'Activo' : 'Pausado'}
                  </button>
                  <button 
                    className="btn-action-modern"
                    onClick={() => navigate(`/countdown/${countdown.countdownId}/config`)}
                  >
                    <Settings size={16} />
                    <span>Editar</span>
                  </button>
                  <button 
                    className="btn-action-modern btn-danger"
                    onClick={() => deleteCountdown(countdown.countdownId)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CountdownList;
