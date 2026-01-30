// Configuración de API endpoints
const isDevelopment = import.meta.env.MODE === 'development';

export const API_CONFIG = {
  // URL del backend (local o producción)
  BASE_URL: 'https://apipromonube-jlfopowzaq-uc.a.run.app',
  
  // OAuth TiendaNube
  TIENDANUBE_CLIENT_ID: '23137',
  TIENDANUBE_AUTH_URL: 'https://www.tiendanube.com/apps/authorize/token',
  
  // Frontend URLs
  FRONTEND_URL: isDevelopment 
    ? 'http://localhost:5173'
    : 'https://promonube.techdi.com.ar'
};

// Helper para hacer requests
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    // Intentar parsear JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    } else {
      const text = await response.text();
      console.error('❌ Respuesta no-JSON:', text);
      throw new Error('La respuesta no es JSON válido');
    }
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default API_CONFIG;
