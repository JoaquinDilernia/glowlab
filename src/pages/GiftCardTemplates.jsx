import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Image, Trash2, Star, Palette } from 'lucide-react';
import { apiRequest } from '../config';
import './GiftCardTemplates.css';

// TEMPLATES PREDETERMINADOS (vienen de fábrica)
const DEFAULT_TEMPLATES = [
  {
    id: 'default-elegant',
    name: 'Elegante Negro',
    category: 'Predeterminado',
    isPredefined: true,
    backgroundColor: '#1a1a1a'
  },
  {
    id: 'default-gold',
    name: 'Dorado Premium',
    category: 'Predeterminado',
    isPredefined: true,
    backgroundColor: '#d4af37'
  },
  {
    id: 'default-blue',
    name: 'Azul Moderno',
    category: 'Predeterminado',
    isPredefined: true,
    backgroundColor: '#0ea5e9'
  },
  {
    id: 'default-pink',
    name: 'Rosa Festivo',
    category: 'Predeterminado',
    isPredefined: true,
    backgroundColor: '#ec4899'
  }
];

// VERSION ULTRA SIMPLIFICADA
// Solo: Templates predeterminados + Subir imagen + Color de fondo
function GiftCardTemplates() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');

  const [customTemplates, setCustomTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('image'); // 'image' o 'color'

  // Form simplificado
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    imageFile: null,
    imagePreview: null,
    backgroundColor: '#0ea5e9'
  });

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/giftcard-templates?storeId=${storeId}`);
      
      if (data.success) {
        // Solo guardamos los templates personalizados (no los predeterminados)
        setCustomTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Combinar templates predeterminados con personalizados
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen debe pesar menos de 5MB');
        return;
      }

      if (!file.type.match('image.*')) {
        alert('❌ Solo se permiten archivos de imagen (JPG, PNG)');
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
    if (!newTemplate.name.trim()) {
      alert('❌ Por favor ingresa un nombre para el diseño');
      return;
    }

    // Validación según tipo
    if (createType === 'image' && !newTemplate.imageFile) {
      alert('❌ Por favor selecciona una imagen');
      return;
    }

    try {
      setUploading(true);

      const templateData = {
        storeId,
        name: newTemplate.name,
        category: 'Personalizado',
        textPosition: 'center',
        textColor: '#FFFFFF',
        fontSize: 48
      };

      // Si es tipo imagen, enviar imageBase64
      if (createType === 'image') {
        templateData.imageBase64 = newTemplate.imagePreview;
      } else {
        // Si es tipo color, enviar backgroundColor
        templateData.backgroundColor = newTemplate.backgroundColor;
      }

      const data = await apiRequest('/api/giftcard-templates/create', {
        method: 'POST',
        body: JSON.stringify(templateData)
      });

      if (data.success) {
        alert('✅ Diseño creado exitosamente');
        setShowCreateModal(false);
        setNewTemplate({
          name: '',
          imageFile: null,
          imagePreview: null,
          backgroundColor: '#0ea5e9'
        });
        setCreateType('image');
        loadCustomTemplates();
      } else {
        alert('❌ Error: ' + (data.message || 'Error al crear diseño'));
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('❌ Error al subir diseño');
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
        alert('✅ Diseño marcado como predeterminado');
        loadTemplates();
      }
    } catch (error) {
      console.error('Error setting default:', error);
      alert('❌ Error al marcar como predeterminado');
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!confirm('¿Eliminar este diseño personalizado?')) return;

    try {
      const data = await apiRequest(`/api/giftcard-templates/${templateId}`, {
        method: 'DELETE',
        body: JSON.stringify({ storeId })
      });

      if (data.success) {
        alert('✅ Diseño eliminado');
        loadCustomTemplates();
      } else {
        alert('❌ Error: ' + (data.error || 'Error al eliminar'));
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('❌ Error al eliminar diseño');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando diseños...</p>
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
            <p>Elegí un diseño predeterminado o creá uno personalizado</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={20} />
          Crear Diseño
        </button>
      </div>

      {/* Info simple */}
      <div className="info-card" style={{
        background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
        border: '1px solid #0ea5e9',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        display: 'flex',
        gap: '16px',
        alignItems: 'start'
      }}>
        <Palette size={24} style={{ color: '#0369a1', flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '16px', fontWeight: '600' }}>
            💡 Tenés 3 opciones
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#075985', fontSize: '14px' }}>
            <li><strong>Diseños predeterminados:</strong> Listos para usar (abajo)</li>
            <li><strong>Subir imagen:</strong> Cargá tu propio diseño (JPG/PNG, máx 5MB)</li>
            <li><strong>Color de fondo:</strong> Creá un diseño con color sólido</li>
          </ul>
        </div>
      </div>

      {/* Sección: Predeterminados */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '700', 
          marginBottom: '16px',
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Star size={20} style={{ color: '#f59e0b' }} />
          Diseños Predeterminados
        </h2>
        <div className="templates-grid-simple">
          {DEFAULT_TEMPLATES.map(template => (
            <div key={template.id} className="template-card-item">
              <div 
                className="template-preview"
                style={{ 
                  backgroundColor: template.backgroundColor,
                  backgroundImage: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '700',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <span>🎁</span>
              </div>
              
              <div className="template-details">
                <div className="template-header">
                  <h4>{template.name}</h4>
                  <span className="category-pill-gold">
                    <Star size={12} fill="currentColor" /> {template.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sección: Personalizados (si hay) */}
      {customTemplates.length > 0 && (
        <div>
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: '700', 
            marginBottom: '16px',
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Palette size={20} style={{ color: '#8b5cf6' }} />
            Mis Diseños Personalizados
          </h2>
          <div className="templates-grid-simple">
            {customTemplates.map(template => (
              <div key={template.templateId} className="template-card-item">
                <div 
                  className="template-preview"
                  style={{ 
                    backgroundImage: template.imageUrl ? `url(${template.imageUrl})` : 'none',
                    backgroundColor: template.backgroundColor || '#f3f4f6'
                  }}
                >
                  {template.isDefault && (
                    <span className="badge-star">
                      <Star size={14} fill="currentColor" /> Por defecto
                    </span>
                  )}
                </div>
                
                <div className="template-details">
                  <div className="template-header">
                    <h4>{template.name}</h4>
                  </div>
                  
                  <div className="template-actions">
                    {!template.isDefault && (
                      <button 
                        className="btn-action"
                        onClick={() => setAsDefault(template.templateId)}
                        title="Marcar como predeterminado"
                      >
                        <Star size={18} />
                      </button>
                    )}
                    <button 
                      className="btn-action btn-danger"
                      onClick={() => deleteTemplate(template.templateId)}
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Creación Simplificado */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '550px',
            padding: '32px'
          }}>
            <h2 style={{ margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Plus size={24} />
              Crear Diseño Personalizado
            </h2>

            {/* Selector de tipo */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '24px',
              padding: '4px',
              background: '#f3f4f6',
              borderRadius: '10px'
            }}>
              <button
                onClick={() => setCreateType('image')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: createType === 'image' ? '#0ea5e9' : 'transparent',
                  color: createType === 'image' ? 'white' : '#6b7280',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={18} />
                Subir Imagen
              </button>
              <button
                onClick={() => setCreateType('color')}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: createType === 'color' ? '#0ea5e9' : 'transparent',
                  color: createType === 'color' ? 'white' : '#6b7280',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <Palette size={18} />
                Color de Fondo
              </button>
            </div>

            {/* Nombre */}
            <div className="form-group">
              <label>Nombre del diseño *</label>
              <input
                type="text"
                placeholder="Ej: Navidad 2026"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                style={{ width: '100%', padding: '12px', fontSize: '16px' }}
              />
            </div>

            {/* Opción 1: Subir Imagen */}
            {createType === 'image' && (
              <div className="form-group">
                <label>Imagen del diseño *</label>
                
                {!newTemplate.imagePreview ? (
                  <label className="upload-area" style={{
                    display: 'block',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <Upload size={40} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                    <p style={{ margin: '0', color: '#475569', fontWeight: '600' }}>
                      Click para seleccionar imagen
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      JPG o PNG • Máx. 5MB • Recomendado: 1200x628px
                    </p>
                  </label>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={newTemplate.imagePreview} 
                      alt="Preview"
                      style={{
                        width: '100%',
                        borderRadius: '12px',
                        border: '2px solid #e2e8f0'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setNewTemplate({...newTemplate, imageFile: null, imagePreview: null})}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Opción 2: Color de fondo */}
            {createType === 'color' && (
              <div className="form-group">
                <label>Color de fondo *</label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={newTemplate.backgroundColor}
                    onChange={(e) => setNewTemplate({...newTemplate, backgroundColor: e.target.value})}
                    style={{
                      width: '80px',
                      height: '80px',
                      border: '3px solid #e5e7eb',
                      borderRadius: '12px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#374151' }}>
                      {newTemplate.backgroundColor}
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                      Click para elegir otro color
                    </p>
                  </div>
                </div>
                {/* Preview */}
                <div style={{
                  marginTop: '16px',
                  height: '150px',
                  borderRadius: '12px',
                  backgroundColor: newTemplate.backgroundColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '32px',
                  fontWeight: '700',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  border: '3px solid #e5e7eb'
                }}>
                  🎁 Vista Previa
                </div>
              </div>
            )}

            {/* Botones */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTemplate({
                    name: '',
                    imageFile: null,
                    imagePreview: null,
                    backgroundColor: '#0ea5e9'
                  });
                  setCreateType('image');
                }}
                disabled={uploading}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUpload}
                disabled={
                  uploading || 
                  !newTemplate.name || 
                  (createType === 'image' && !newTemplate.imageFile)
                }
                style={{ flex: 1 }}
              >
                {uploading ? (
                  <>
                    <div className="spinner-small"></div>
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Crear Diseño
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GiftCardTemplates;
