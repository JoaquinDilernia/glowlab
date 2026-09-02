import { useState } from 'react';
import { apiRequest } from '../config';

// Subida de imagen a Storage vía /api/upload-image-base64, extraído de
// ShopTheLookConfig.jsx para reutilizar entre los bloques de Vidriera Shoppable.
export function useImageUpload(storeId, folder = 'storefront-blocks') {
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen supera 5MB');
      return null;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await apiRequest('/api/upload-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, fileName: file.name, fileData: base64, folder }),
      });
      if (!response.success) throw new Error(response.message);
      return response.url;
    } catch (e) {
      alert('Error al subir la imagen: ' + e.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
