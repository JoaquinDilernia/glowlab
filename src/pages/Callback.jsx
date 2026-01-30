import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import './Callback.css';

function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Finalizando instalación...');

  useEffect(() => {
    const storeId = searchParams.get('storeId');
    const userId = searchParams.get('userId');
    const installed = searchParams.get('installed');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Error al instalar la aplicación. Por favor intentá de nuevo.');
      return;
    }

    if (storeId && userId && installed === 'true') {
      // Guardar en localStorage
      localStorage.setItem('promonube_store_id', storeId);
      localStorage.setItem('promonube_user_id', userId);
      
      setStatus('success');
      setMessage('¡Instalación exitosa! Redirigiendo...');
      
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } else {
      setStatus('error');
      setMessage('Faltan datos de instalación. Por favor intentá de nuevo.');
    }
  }, [searchParams, navigate]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        {status === 'loading' && (
          <>
            <div className="spinner-large"></div>
            <h2>{message}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={64} className="icon-success" />
            <h2>¡Instalación Exitosa!</h2>
            <p>{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={64} className="icon-error" />
            <h2>Error en la Instalación</h2>
            <p>{message}</p>
            <button 
              className="btn-retry" 
              onClick={() => navigate('/')}
            >
              Volver a Intentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Callback;
