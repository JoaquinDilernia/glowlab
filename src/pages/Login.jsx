import { useState, useEffect } from 'react';
import { Zap, Mail, Lock, AlertCircle } from 'lucide-react';
import { apiRequest } from '../config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setInfo(message);
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
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
        setError(data.message || 'Email o contraseña incorrectos');
      }
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="logo-section">
          <img src="/logo.png" alt="GlowLab" className="login-logo" />
          <p className="tagline">Promociones sin límites para tu TiendaNube</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {info && (
            <div className="info-message">
              {info}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-install"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Ingresando...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>¿Problemas para acceder? <a href="mailto:info@techdi.com.ar">Contactanos</a></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
