import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, User, Mail, Lock, CheckCircle } from 'lucide-react';
import { apiRequest } from '../config';
import './Register.css';

function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storeId, setStoreId] = useState(null);

  useEffect(() => {
    const store_id = searchParams.get('store_id');
    const installed = searchParams.get('installed');
    
    if (!store_id || installed !== 'true') {
      // Si no viene de instalación, redirigir a login
      navigate('/login');
      return;
    }
    
    setStoreId(store_id);
  }, [searchParams, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          storeId: storeId
        })
      });

      if (data.success) {
        // Guardar en localStorage
        localStorage.setItem('promonube_store_id', data.user.storeId);
        localStorage.setItem('promonube_access_token', data.store.accessToken);
        localStorage.setItem('promonube_user_email', data.user.email);
        localStorage.setItem('promonube_user_name', data.user.name);
        localStorage.setItem('promonube_store_name', data.store.storeName);
        
        // Redirigir al dashboard
        navigate('/dashboard');
      } else {
        setError(data.message || 'Error al registrar');
      }
    } catch (err) {
      console.error('Error en registro:', err);
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!storeId) {
    return (
      <div className="register-container" style={{background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)'}}>
        <div className="spinner-large"></div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-box">
        <div className="register-header">
          <img src="/logo.png" alt="GlowLab" className="login-logo" />
          <h1>¡Bienvenido a GlowLab!</h1>
          <p>Creá tu cuenta para empezar a usar la app</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label>
              <User size={18} />
              Nombre completo
            </label>
            <input
              type="text"
              name="name"
              placeholder="Juan Pérez"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Lock size={18} />
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>
              <CheckCircle size={18} />
              Confirmar contraseña
            </label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Repetí tu contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-register"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <div className="register-footer">
          <p>
            ¿Ya tenés cuenta? 
            <a href="/#/login"> Iniciá sesión</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
