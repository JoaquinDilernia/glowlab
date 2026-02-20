import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Image, Trash2, Star, Edit2, Eye } from 'lucide-react';
import { apiRequest } from '../config';
import './GiftCardTemplates.css';

function GiftCardTemplates() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form para nuevo template
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    imageFile: null,
    imagePreview: null,
    textPosition: 'center', // center, top, bottom, custom
    textColor: '#FFFFFF',
    fontSize: 48
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcard-templates?storeId=${storeId}`);
      
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen debe pesar menos de 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setNewTemplate(prev => ({
          ...prev,
          imageFile: file,
          imagePreview: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!newTemplate.name || !newTemplate.imageFile) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      setUploading(true);

      // La imagen ya está en base64 en imagePreview
      const data = await apiRequest('/api/giftcard-templates/create', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          name: newTemplate.name,
          imageBase64: newTemplate.imagePreview,
          textPosition: newTemplate.textPosition,
          textColor: newTemplate.textColor,
          fontSize: newTemplate.fontSize
        })
      });

      if (data.success) {
        alert('✅ Template creado exitosamente');
        setShowUploadModal(false);
        setNewTemplate({
          name: '',
          imageFile: null,
          imagePreview: null,
          textPosition: 'center',
          textColor: '#FFFFFF',
          fontSize: 48
        });
        loadTemplates();
      } else {
        alert('Error al crear template: ' + data.message);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Error al subir template');
    } finally {
      setUploading(false);
    }
  };

  const setAsDefault = async (templateId) => {
    try {
      const data = await apiRequest(`/api/giftcard-templates/${templateId}/set-default`, {
        method: 'PUT',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        loadTemplates();
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!confirm('¿Eliminar este template?')) return;

    try {
      const data = await apiRequest(`/api/giftcard-templates/${templateId}`, {
        method: 'DELETE',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        loadTemplates();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/gift-cards')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>🎨 Diseños de Gift Cards</h1>
            <p>Gestiona los templates visuales de tus gift cards</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
          <Plus size={20} />
          Nuevo Template
        </button>
      </div>

      {/* Info Box */}
      <div className="info-section">
        <div className="info-card">
          <Image size={24} style={{ color: '#3b82f6' }} />
          <div>
            <h3>Recomendaciones para tus diseños</h3>
            <ul>
              <li><strong>Tamaño recomendado:</strong> 1200 x 628 píxeles (formato landscape)</li>
              <li><strong>Formato:</strong> JPG o PNG</li>
              <li><strong>Peso máximo:</strong> 5MB</li>
              <li><strong>Tip:</strong> Deja espacio en el centro o parte superior para que se muestre el monto automáticamente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="templates-grid">
        {templates.length === 0 ? (
          <div className="empty-state">
            <Image size={48} />
            <h3>Sin templates todavía</h3>
            <p>Crea tu primer diseño personalizado para gift cards</p>
            <button className="btn-create-empty" onClick={() => setShowUploadModal(true)}>
              <Plus size={20} />
              Crear Template
            </button>
          </div>
        ) : (
          templates.map(template => (
            <div key={template.templateId} className={`template-card ${template.isDefault ? 'default' : ''}`}>
              {template.isDefault && (
                <div className="default-badge">
                  <Star size={14} fill="#fbbf24" />
                  Por defecto
                </div>
              )}
              
              {/* Preview */}
              <div 
                className="template-preview"
                style={{ backgroundImage: `url(${template.imageUrl})` }}
                onClick={() => setPreviewTemplate(template)}
              >
                <div className="preview-overlay">
                  <Eye size={24} />
                  <span>Vista previa</span>
                </div>
              </div>

              {/* Info */}
              <div className="template-info">
                <h3>{template.name}</h3>
                <div className="template-meta">
                  <span className="meta-item">
                    <Image size={14} />
                    {template.dimensions || '1200x628'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="template-actions">
                {!template.isDefault && (
                  <button 
                    className="btn-action"
                    onClick={() => setAsDefault(template.templateId)}
                    title="Establecer como predeterminado"
                  >
                    <Star size={16} />
                  </button>
                )}
                <button 
                  className="btn-action btn-danger"
                  onClick={() => deleteTemplate(template.templateId)}
                  title="Eliminar"
                  disabled={template.isDefault}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 Nuevo Template</h2>
              <button className="btn-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {/* Nombre */}
              <div className="form-group">
                <label>Nombre del Template *</label>
                <input
                  type="text"
                  placeholder="Ej: Navidad 2024"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Upload */}
              <div className="form-group">
                <label>Imagen *</label>
                <div className="upload-area">
                  {newTemplate.imagePreview ? (
                    <div className="image-preview">
                      <img src={newTemplate.imagePreview} alt="Preview" />
                      <button 
                        className="btn-remove-image"
                        onClick={() => setNewTemplate(prev => ({ 
                          ...prev, 
                          imageFile: null, 
                          imagePreview: null 
                        }))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="upload-box">
                      <Upload size={32} />
                      <span>Click para seleccionar imagen</span>
                      <small>JPG o PNG, máx 5MB</small>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Posición del texto */}
              <div className="form-group">
                <label>Posición del Monto</label>
                <select
                  value={newTemplate.textPosition}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, textPosition: e.target.value }))}
                >
                  <option value="center">Centro</option>
                  <option value="top">Arriba</option>
                  <option value="bottom">Abajo</option>
                </select>
              </div>

              {/* Color del texto */}
              <div className="form-row">
                <div className="form-group">
                  <label>Color del Texto</label>
                  <input
                    type="color"
                    value={newTemplate.textColor}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, textColor: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Tamaño de Fuente</label>
                  <input
                    type="number"
                    min="24"
                    max="72"
                    value={newTemplate.fontSize}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleUpload}
                disabled={uploading || !newTemplate.name || !newTemplate.imageFile}
              >
                {uploading ? (
                  <>
                    <div className="spinner-small"></div>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Crear Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="modal-content modal-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👁️ Vista Previa: {previewTemplate.name}</h2>
              <button className="btn-close" onClick={() => setPreviewTemplate(null)}>×</button>
            </div>

            <div className="modal-body">
              <div className="preview-full">
                <img src={previewTemplate.imageUrl} alt={previewTemplate.name} />
                
                {/* Ejemplo con monto */}
                <div 
                  className="preview-amount"
                  style={{
                    color: previewTemplate.textColor || '#FFFFFF',
                    fontSize: `${previewTemplate.fontSize || 48}px`,
                    justifyContent: previewTemplate.textPosition === 'top' ? 'flex-start' :
                                   previewTemplate.textPosition === 'bottom' ? 'flex-end' : 'center'
                  }}
                >
                  $50.000
                </div>
              </div>
              <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginTop: '16px' }}>
                Así se verá el monto sobre tu diseño
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GiftCardTemplates;
