import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Palette, MessageSquare, Menu as MenuIcon, Eye, Upload, Image } from 'lucide-react';
import { apiRequest } from '../config';
import './StyleConfig.css';
import EmojiPicker from '../components/EmojiPicker';

function StyleConfig() {
  const navigate = useNavigate();
  const storeId = localStorage.getItem('promonube_store_id');
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [tiendanubeMenus, setTiendanubeMenus] = useState([]);
  
  const [config, setConfig] = useState({
    whatsapp: {
      enabled: true,
      backgroundColor: '#25D366',
      hoverColor: '#128C7E'
    },
    menu: {
      enabled: false,
      items: []
    },
    banners: {
      enabled: true,
      slides: []
    },
    lightToggle: {
      enabled: false,
      categoryUrls: [], // Cambiar de categoryUrl a categoryUrls (array)
      label: 'Ver:',
      position: 'top-right',
      style: 'variant', // 'variant', 'light', 'outfit'
      view1Label: 'Apagada',
      view2Label: 'Prendida'
    },
    themeSwitch: {
      enabled: false,
      urls: [],
      backgroundColor: '#000000',
      textColor: '#ffffff',
      accentColor: '#f59e0b',
      invertColors: false
    },
    topHeader: {
      enabled: false,
      backgroundColor: '#f5f5f5',
      textColor: '#333333',
      fontFamily: 'system-ui',
      alignment: 'center', // left, center, right, space-between
      items: [
        { icon: '🚚', text: 'Envío gratis en compras mayores a $50.000', link: '', position: 'left', active: false },
        { icon: '💳', text: '12 cuotas sin interés', link: '', position: 'left', active: false },
        { icon: '✨', text: 'Regalos en todas las compras', link: '', position: 'left', active: false }
      ]
    },
    announcementBar: {
      enabled: false,
      backgroundColor: '#8B0000',
      textColor: '#ffffff',
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'system-ui',
      padding: 11,
      messages: [
        { text: '🎉 Envío gratis en compras mayores a $50.000', link: '' },
        { text: '💳 Hasta 12 cuotas sin interés', link: '' },
        { text: '✨ Ofertas especiales todos los días', link: '' },
        { text: '🚚 Entregas rápidas en todo el país', link: '' }
      ],
      // Configuración de bordes
      borderEnabled: false,
      borderTop: false,
      borderBottom: true,
      borderLeft: false,
      borderRight: false,
      borderStyle: 'solid', // solid, dashed, dotted, double
      borderWidth: 1,
      borderColor: '#ffffff'
    },
    topAnnouncementBar: {
      enabled: false,
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      fontSize: 13,
      fontWeight: 500,
      fontFamily: 'system-ui',
      padding: 11,
      messages: [
        { text: '🔥 Black Friday: hasta 50% OFF', link: '' },
        { text: '🚚 Envío gratis en compras +$50.000', link: '' },
        { text: '💳 12 cuotas sin interés', link: '' }
      ],
      // Configuración de bordes
      borderEnabled: false,
      borderTop: false,
      borderBottom: true,
      borderLeft: false,
      borderRight: false,
      borderStyle: 'solid', // solid, dashed, dotted, double
      borderWidth: 1,
      borderColor: '#ffffff'
    },
    enhancedSearch: {
      enabled: false,
      popularSearches: [
        { text: 'sillas', link: '' },
        { text: 'mesas', link: '' },
        { text: 'decoración', link: '' }
      ],
      primaryColor: '#000000',
      maxResults: 8
    },
    searchBar: {
      enabled: false,
      placeholder: '¿Qué estás buscando?',
      inputPlaceholder: 'Buscar productos...',
      buttonText: 'Buscar',
      backgroundColor: '#000000',
      backgroundOpacity: 0.85,
      buttonColor: '#000000',
      titleColor: '#ffffff',
      titleSize: 42,
      titlePosition: 'center', // 'top', 'center'
      showLogo: false,
      logoUrl: '',
      logoSize: 100,
      suggestions: [],
      closeButtonColor: '#000000'
    }
  });

  useEffect(() => {
    // Verificar autenticación
    if (!storeId) {
      alert('⚠️ Sesión expirada. Por favor, volvé a iniciar sesión.');
      navigate('/');
      return;
    }
    
    loadConfig();
    // Temporalmente deshabilitado - requiere permisos adicionales en TiendaNube
    // loadTiendanubeMenus();
  }, []);

  const loadTiendanubeMenus = async () => {
    setLoadingMenus(true);
    try {
      const data = await apiRequest(`/api/tiendanube/menus?storeId=${storeId}`);
      if (data.success && data.menus) {
        setTiendanubeMenus(data.menus);
      }
    } catch (error) {
      console.error('Error loading TiendaNube menus:', error);
      alert('Error al cargar los menús de TiendaNube');
    } finally {
      setLoadingMenus(false);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await apiRequest(`/api/style-config?storeId=${storeId}`);
      if (data.success && data.config) {
        // Asegurar que banners.slides existe y tiene los campos necesarios
        const slides = (data.config.banners?.slides || []).map(slide => ({
          ...slide,
          columns: slide.columns || 'auto',
          maxWidth: slide.maxWidth || '90%',
          gap: slide.gap || '12px',
          buttons: slide.buttons || []
        }));
        
        // Asegurar que enhancedSearch existe con valores por defecto
        const enhancedSearch = {
          enabled: data.config.enhancedSearch?.enabled || false,
          popularSearches: data.config.enhancedSearch?.popularSearches || [
            { text: 'sillas', link: '' },
            { text: 'mesas', link: '' },
            { text: 'decoración', link: '' }
          ],
          primaryColor: data.config.enhancedSearch?.primaryColor || '#000000',
          textColor: data.config.enhancedSearch?.textColor || '#1a1a1a',
          backgroundColor: data.config.enhancedSearch?.backgroundColor || '#ffffff',
          maxResults: data.config.enhancedSearch?.maxResults || 8
        };
        
        const loadedConfig = {
          ...data.config,
          banners: {
            ...data.config.banners,
            slides: slides
          },
          enhancedSearch: enhancedSearch
        };
        setConfig(loadedConfig);
        console.log('Config cargado:', loadedConfig);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async () => {
    if (!storeId) {
      alert('❌ Error: No se encontró el ID de la tienda. Por favor, volvé a iniciar sesión.');
      return;
    }

    setLoading(true);
    try {
      // Limpiar slides sin botones antes de guardar
      const cleanedConfig = {
        ...config,
        banners: {
          ...config.banners,
          slides: config.banners.slides.filter(slide => slide.buttons && slide.buttons.length > 0)
        }
      };
      
      console.log('Guardando config:', { storeId, config: cleanedConfig });
      
      const data = await apiRequest('/api/style-config', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          config: cleanedConfig
        })
      });

      if (data.success) {
        alert('✅ Configuración guardada! Los cambios se verán en tu tienda en unos segundos');
        // Actualizar el estado local con la config limpia
        setConfig(cleanedConfig);
      } else {
        alert('❌ Error al guardar configuración: ' + (data.message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error completo:', error);
      alert('❌ Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateWhatsApp = (field, value) => {
    setConfig(prev => ({
      ...prev,
      whatsapp: { ...prev.whatsapp, [field]: value }
    }));
  };

  const updateMenu = (field, value) => {
    setConfig(prev => ({
      ...prev,
      menu: { ...prev.menu, [field]: value }
    }));
  };

  const addMenuItem = () => {
    const currentItems = config.menu.items || [];
    const newItem = {
      position: (currentItems.length + 1).toString(),
      emoji: '',
      emojiPosition: 'before', // 'before' o 'after'
      color: '',
      fontWeight: 'normal', // 'normal' o 'bold'
      fontSize: '',
      imageUrl: '' // URL de la imagen para mostrar en el dropdown
    };
    setConfig(prev => ({
      ...prev,
      menu: {
        ...prev.menu,
        items: [...currentItems, newItem]
      }
    }));
  };

  const removeMenuItem = (index) => {
    setConfig(prev => ({
      ...prev,
      menu: {
        ...prev.menu,
        items: prev.menu.items.filter((_, i) => i !== index)
      }
    }));
  };

  const updateMenuItem = (index, field, value) => {
    setConfig(prev => ({
      ...prev,
      menu: {
        ...prev.menu,
        items: prev.menu.items.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const uploadMenuImage = async (index, file) => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('❌ Por favor selecciona una imagen válida');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('❌ La imagen es muy grande. Máximo 5MB');
      return;
    }
    
    try {
      setLoading(true);
      
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const response = await apiRequest('/api/upload-image-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: storeId,
          fileName: file.name,
          fileData: base64Data,
          folder: 'menu-images'
        })
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Error al subir imagen');
      }
      
      updateMenuItem(index, 'imageUrl', response.url);
      alert('✅ Imagen subida correctamente');
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al subir imagen: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const updateBanners = (field, value) => {
    setConfig(prev => ({
      ...prev,
      banners: { ...prev.banners, [field]: value }
    }));
  };

  const addSlide = () => {
    const currentSlides = config.banners.slides || [];
    const newSlide = {
      slideIndex: currentSlides.length,
      position: 'center',
      gap: '12px',
      columns: 'auto',
      maxWidth: '90%',
      buttons: []
    };
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: [...currentSlides, newSlide]
      }
    }));
  };

  const removeSlide = (slideIndex) => {
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: prev.banners.slides.filter((_, i) => i !== slideIndex)
      }
    }));
  };

  const updateSlide = (slideIndex, field, value) => {
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: prev.banners.slides.map((slide, i) => 
          i === slideIndex ? { ...slide, [field]: value } : slide
        )
      }
    }));
  };

  const addButtonToSlide = (slideIndex) => {
    const newButton = {
      text: 'Nuevo Botón',
      url: '/productos',
      backgroundColor: 'rgba(0, 0, 0, 1)',
      textColor: '#ffffff',
      hoverColor: 'rgba(51, 51, 51, 1)',
      padding: '12px 32px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '700',
      shadow: '0 4px 12px rgba(0,0,0,0.2)',
      hoverShadow: '0 6px 20px rgba(0,0,0,0.3)',
      borderWidth: '0px',
      borderStyle: 'solid',
      borderColor: '#000000',
      textTransform: 'uppercase'
    };
    
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: prev.banners.slides.map((slide, i) => 
          i === slideIndex ? { ...slide, buttons: [...slide.buttons, newButton] } : slide
        )
      }
    }));
  };

  const updateButtonInSlide = (slideIndex, buttonIndex, field, value) => {
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: prev.banners.slides.map((slide, i) => 
          i === slideIndex ? {
            ...slide,
            buttons: slide.buttons.map((btn, j) => 
              j === buttonIndex ? { ...btn, [field]: value } : btn
            )
          } : slide
        )
      }
    }));
  };

  const removeButtonFromSlide = (slideIndex, buttonIndex) => {
    setConfig(prev => ({
      ...prev,
      banners: {
        ...prev.banners,
        slides: prev.banners.slides.map((slide, i) => 
          i === slideIndex ? {
            ...slide,
            buttons: slide.buttons.filter((_, j) => j !== buttonIndex)
          } : slide
        )
      }
    }));
  };

  return (
    <div className="style-config-container">
      <header className="page-header-modern">
        <div className="header-content-modern">
          <div className="header-top-modern">
            <button className="btn-back-modern" onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={20} />
              <span>Dashboard</span>
            </button>
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                className="btn-primary-gradient" 
                onClick={saveConfig}
                disabled={loading}
              >
                <Save size={18} />
                <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </div>
          <div className="header-info-section">
            <h1 className="page-title-gradient">🎨 Style - Personalización Avanzada</h1>
            <p className="page-subtitle-modern">Personaliza WhatsApp, Menú y Banners de tu tienda</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="config-tabs">
        <button 
          className={`tab-button ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          <MessageSquare size={18} />
          <span>WhatsApp</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          <MenuIcon size={18} />
          <span>Menú</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'banners' ? 'active' : ''}`}
          onClick={() => setActiveTab('banners')}
        >
          <Image size={18} />
          <span>Banners</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'topHeader' ? 'active' : ''}`}
          onClick={() => setActiveTab('topHeader')}
        >
          <span>📌</span>
          <span>Barra de Encabezado</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'topAnnouncementBar' ? 'active' : ''}`}
          onClick={() => setActiveTab('topAnnouncementBar')}
        >
          <span>📣</span>
          <span>Menu Superior</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'announcementBar' ? 'active' : ''}`}
          onClick={() => setActiveTab('announcementBar')}
        >
          <span>📢</span>
          <span>Menu Inferior</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'enhancedSearch' ? 'active' : ''}`}
          onClick={() => setActiveTab('enhancedSearch')}
        >
          <span>🔍</span>
          <span>Buscador Mejorado</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'searchBar' ? 'active' : ''}`}
          onClick={() => setActiveTab('searchBar')}
        >
          <span>🔎</span>
          <span>Búsqueda Modal</span>
        </button>
        <button 
          className="tab-button"
          onClick={() => setActiveTab('lightToggle')}
        >
          <span>�</span>
          <span>Cambio de Vista</span>
        </button>
      </div>

      <div className="config-content">
        {/* WhatsApp Tab */}
        {activeTab === 'whatsapp' && (
          <div className="config-section">
            <div className="section-header">
              <h2>💬 Botón de WhatsApp</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.whatsapp.enabled}
                  onChange={(e) => updateWhatsApp('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.whatsapp.enabled && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Color de Fondo</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.whatsapp.backgroundColor}
                        onChange={(e) => updateWhatsApp('backgroundColor', e.target.value)}
                      />
                      <input
                        type="text"
                        value={config.whatsapp.backgroundColor}
                        onChange={(e) => updateWhatsApp('backgroundColor', e.target.value)}
                        placeholder="#25D366"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Color Hover</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.whatsapp.hoverColor}
                        onChange={(e) => updateWhatsApp('hoverColor', e.target.value)}
                      />
                      <input
                        type="text"
                        value={config.whatsapp.hoverColor}
                        onChange={(e) => updateWhatsApp('hoverColor', e.target.value)}
                        placeholder="#128C7E"
                      />
                    </div>
                  </div>
                </div>

                <div className="preview-box" style={{marginTop: '30px'}}>
                  <h3 style={{marginBottom: '20px', fontSize: '14px', color: '#666'}}>Vista Previa</h3>
                  <div className="whatsapp-preview">
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        backgroundColor: config.whatsapp.backgroundColor,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = config.whatsapp.hoverColor;
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = config.whatsapp.backgroundColor;
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="config-section">
            <div className="section-header">
              <h2>📋 Menú de Navegación</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.menu.enabled}
                  onChange={(e) => updateMenu('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.menu.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    🎯 Personalizá tu menú, destacá categorías y agregá emojis, imágenes y más. Configurá cada item por posición y diferenciá títulos de subcategorías.
                  </p>
                </div>

                {(!config.menu.items || config.menu.items.length === 0) ? (
                  <div style={{textAlign: 'center', padding: '40px 20px'}}>
                    <p style={{color: '#666', marginBottom: '20px'}}>
                      No hay items configurados. Agrega el primer item del menú.
                    </p>
                    <button className="btn-add" onClick={addMenuItem}>
                      + Agregar Item del Menú
                    </button>
                  </div>
                ) : (
                  <>
                    {config.menu.items.map((item, index) => {
                      const isSubcategory = item.position && item.position.toString().includes('.');
                      return (
                      <div key={index} style={{
                        background: isSubcategory 
                          ? 'linear-gradient(135deg, #f3f4f615 0%, #e5e7eb15 100%)' 
                          : 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                        padding: '25px',
                        borderRadius: '16px',
                        marginBottom: '20px',
                        border: isSubcategory ? '2px dashed #d1d5db' : '2px solid #667eea',
                        marginLeft: isSubcategory ? '30px' : '0'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '20px'
                        }}>
                          <h3 style={{margin: 0, fontSize: '18px', fontWeight: '700'}}>
                            {isSubcategory ? '📎 Subcategoría' : '📍 Categoría Principal'} (Posición {item.position})
                          </h3>
                          <button 
                            className="btn-remove-small"
                            onClick={() => removeMenuItem(index)}
                            style={{fontSize: '18px', padding: '8px 14px'}}
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>🔢 Posición en el Menú</label>
                            <input
                              type="text"
                              value={item.position}
                              onChange={(e) => updateMenuItem(index, 'position', e.target.value)}
                              placeholder="1, 2, 3 o 1.1, 2.3 para subcategorías"
                            />
                            <small style={{color: '#666', fontSize: '11px', display: 'block', marginTop: '4px'}}>
                              Categoría: 1, 2, 3... | Subcategoría: 1.1, 1.2, 2.1, 2.2...
                            </small>
                          </div>

                          <div className="form-group">
                            <label>😀 Emoji</label>
                            <EmojiPicker
                              value={item.emoji}
                              onChange={(emoji) => updateMenuItem(index, 'emoji', emoji)}
                              placeholder="🎉 🔥 ⭐ 💎"
                            />
                          </div>
                        </div>



                        <div className="form-row">
                          <div className="form-group">
                            <label>📍 Posición del Emoji</label>
                            <select
                              value={item.emojiPosition}
                              onChange={(e) => updateMenuItem(index, 'emojiPosition', e.target.value)}
                              style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
                            >
                              <option value="before">Antes del texto</option>
                              <option value="after">Después del texto</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>🎨 Color del Texto</label>
                            <div className="color-input-group">
                              <input
                                type="color"
                                value={item.color || '#000000'}
                                onChange={(e) => updateMenuItem(index, 'color', e.target.value)}
                              />
                              <input
                                type="text"
                                value={item.color}
                                onChange={(e) => updateMenuItem(index, 'color', e.target.value)}
                                placeholder="#FF5733 o rgba(255,87,51,1)"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>📏 Negrita</label>
                            <select
                              value={item.fontWeight}
                              onChange={(e) => updateMenuItem(index, 'fontWeight', e.target.value)}
                              style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Negrita</option>
                              <option value="600">Semi-negrita (600)</option>
                              <option value="700">Negrita (700)</option>
                              <option value="800">Extra negrita (800)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>📐 Tamaño de Fuente</label>
                            <input
                              type="text"
                              value={item.fontSize}
                              onChange={(e) => updateMenuItem(index, 'fontSize', e.target.value)}
                              placeholder="16px, 18px, 1.2rem"
                            />
                          </div>
                        </div>

                        {/* Imagen del Dropdown */}
                        <div style={{
                          marginTop: '20px',
                          padding: '20px',
                          background: 'linear-gradient(135deg, #f093fb15 0%, #f5576c15 100%)',
                          borderRadius: '12px',
                          border: '2px dashed #f093fb'
                        }}>
                          <h4 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937'}}>
                            🖼️ Imagen del Dropdown
                          </h4>
                          <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '15px'}}>
                            Esta imagen aparecerá dentro del dropdown cuando se haga hover en este menú
                          </p>

                          <div className="form-group">
                            <label>URL de la Imagen</label>
                            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                              <input
                                type="text"
                                value={item.imageUrl || ''}
                                onChange={(e) => updateMenuItem(index, 'imageUrl', e.target.value)}
                                placeholder="https://... o sube una imagen"
                                style={{flex: 1}}
                              />
                              <label 
                                htmlFor={`image-upload-${index}`}
                                style={{
                                  cursor: 'pointer',
                                  padding: '10px 16px',
                                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                  color: 'white',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Upload size={16} />
                                Subir
                              </label>
                              <input
                                id={`image-upload-${index}`}
                                type="file"
                                accept="image/*"
                                style={{display: 'none'}}
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) uploadMenuImage(index, file);
                                }}
                              />
                            </div>
                            <small style={{color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '6px'}}>
                              💡 Desktop: aparece dentro del dropdown | Mobile: aparece abajo de las subcategorías
                            </small>
                          </div>

                          {item.imageUrl && (
                            <div style={{marginTop: '15px'}}>
                              <img 
                                src={item.imageUrl} 
                                alt="Preview" 
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '200px',
                                  borderRadius: '8px',
                                  border: '2px solid #e5e7eb',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Vista previa */}
                        <div style={{
                          marginTop: '20px',
                          padding: '15px',
                          background: 'white',
                          borderRadius: '8px',
                          border: '1px solid #ddd'
                        }}>
                          <h4 style={{fontSize: '14px', marginBottom: '10px', color: '#666'}}>Vista Previa:</h4>
                          <span style={{
                            color: item.color || 'inherit',
                            fontWeight: item.fontWeight || 'normal',
                            fontSize: item.fontSize || 'inherit'
                          }}>
                            {item.emoji && item.emojiPosition === 'before' && <span>{item.emoji} </span>}
                            Item del Menú
                            {item.emoji && item.emojiPosition === 'after' && <span> {item.emoji}</span>}
                          </span>
                        </div>
                      </div>
                    );
                    })}

                    <button className="btn-add" onClick={addMenuItem}>
                      + Agregar Otro Item del Menú
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Banners Tab */}
        {activeTab === 'banners' && (
          <div className="config-section">
            <div className="section-header">
              <h2>🖼️ Botones en Carrusel</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.banners.enabled}
                  onChange={(e) => updateBanners('enabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.banners.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    📸 Agrega botones personalizados a cada imagen del carrusel. Selecciona la imagen y configura los botones.
                  </p>
                </div>

                {(!config.banners.slides || config.banners.slides.length === 0) ? (
                  <div style={{textAlign: 'center', padding: '40px 20px'}}>
                    <p style={{color: '#666', marginBottom: '20px'}}>
                      No hay imágenes configuradas. Agrega la primera imagen del carrusel.
                    </p>
                    <button className="btn-add" onClick={addSlide}>
                      + Agregar Imagen del Carrusel
                    </button>
                  </div>
                ) : (
                  <>
                    {config.banners.slides.map((slide, slideIndex) => (
                      <div key={slideIndex} style={{
                        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                        padding: '25px',
                        borderRadius: '16px',
                        marginBottom: '25px',
                        border: '2px solid #e5e7eb'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '20px'
                        }}>
                          <h3 style={{margin: 0, fontSize: '18px', fontWeight: '700'}}>
                            🖼️ Imagen #{slideIndex + 1} del Carrusel
                          </h3>
                          <button 
                            className="btn-remove-small"
                            onClick={() => removeSlide(slideIndex)}
                            style={{fontSize: '18px', padding: '8px 14px'}}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>

                        <h4 style={{fontSize: '15px', marginBottom: '12px', color: '#555'}}>
                          Posición de Botones
                        </h4>
                        <div style={{marginBottom: '20px'}}>
                          <div className="position-selector" style={{marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px'}}>
                            {[
                              {value: 'top-left', label: '↖️ Arriba Izq'},
                              {value: 'top', label: '⬆️ Arriba'},
                              {value: 'top-right', label: '↗️ Arriba Der'},
                              {value: 'center', label: '⏺️ Centro'}
                            ].map(pos => (
                              <div
                                key={pos.value}
                                className={`position-option ${slide.position === pos.value ? 'selected' : ''}`}
                                onClick={() => updateSlide(slideIndex, 'position', pos.value)}
                                style={{padding: '10px 8px', fontSize: '13px'}}
                              >
                                <strong>{pos.label}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="position-selector" style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px'}}>
                            {[
                              {value: 'left', label: '⬅️ Izquierda'},
                              {value: 'bottom', label: '⬇️ Abajo'},
                              {value: 'right', label: '➡️ Derecha'},
                              {value: 'bottom-left', label: '↙️ Abajo Izq'}
                            ].map(pos => (
                              <div
                                key={pos.value}
                                className={`position-option ${slide.position === pos.value ? 'selected' : ''}`}
                                onClick={() => updateSlide(slideIndex, 'position', pos.value)}
                                style={{padding: '10px 8px', fontSize: '13px'}}
                              >
                                <strong>{pos.label}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="position-selector" style={{marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px'}}>
                            {[
                              {value: 'bottom-right', label: '↘️ Abajo Der'}
                            ].map(pos => (
                              <div
                                key={pos.value}
                                className={`position-option ${slide.position === pos.value ? 'selected' : ''}`}
                                onClick={() => updateSlide(slideIndex, 'position', pos.value)}
                                style={{padding: '10px 8px', fontSize: '13px'}}
                              >
                                <strong>{pos.label}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="form-row" style={{marginBottom: '20px'}}>
                          <div className="form-group">
                            <label>📐 Columnas (Layout)</label>
                            <select
                              value={slide.columns || 'auto'}
                              onChange={(e) => updateSlide(slideIndex, 'columns', e.target.value)}
                              style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
                            >
                              <option value="auto">Automático (ajusta según espacio)</option>
                              <option value="1">1 columna (vertical)</option>
                              <option value="2">2 columnas</option>
                              <option value="3">3 columnas</option>
                              <option value="4">4 columnas</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>↔️ Espaciado entre botones</label>
                            <input
                              type="text"
                              value={slide.gap || '12px'}
                              onChange={(e) => updateSlide(slideIndex, 'gap', e.target.value)}
                              placeholder="12px"
                            />
                          </div>
                        </div>

                        <h4 style={{fontSize: '15px', marginBottom: '15px', color: '#555'}}>
                          Botones de esta Imagen
                        </h4>
                        
                        {slide.buttons.length === 0 ? (
                          <p style={{color: '#999', fontStyle: 'italic', marginBottom: '15px'}}>
                            Sin botones. Agrega el primero.
                          </p>
                        ) : (
                          slide.buttons.map((button, buttonIndex) => (
                            <div key={buttonIndex} className="button-config-card">
                              <div className="card-header">
                                <h4>Botón {buttonIndex + 1}</h4>
                                <button 
                                  className="btn-remove-small"
                                  onClick={() => removeButtonFromSlide(slideIndex, buttonIndex)}
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>Texto</label>
                                  <input
                                    type="text"
                                    value={button.text}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'text', e.target.value)}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>URL</label>
                                  <input
                                    type="text"
                                    value={button.url}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'url', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>🎨 Color de Fondo</label>
                                  <div className="color-input-group">
                                    <input
                                      type="color"
                                      value={button.backgroundColor?.startsWith('rgba') || button.backgroundColor?.startsWith('rgb') ? '#000000' : (button.backgroundColor || '#000000')}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'backgroundColor', e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      value={button.backgroundColor}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'backgroundColor', e.target.value)}
                                      placeholder="rgba(0,0,0,0.8) o #FF5733"
                                    />
                                  </div>
                                  <small style={{color: '#666', fontSize: '11px', display: 'block', marginTop: '4px'}}>
                                    💡 Tip: Usa rgba(R,G,B,A) para transparencia. Ejemplo: rgba(0,0,0,0.7)
                                  </small>
                                  
                                  {/* Slider de opacidad */}
                                  <div style={{marginTop: '10px'}}>
                                    <label style={{fontSize: '13px', color: '#666'}}>
                                      🔳 Opacidad: {button.backgroundOpacity !== undefined ? button.backgroundOpacity : 100}%
                                    </label>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={button.backgroundOpacity !== undefined ? button.backgroundOpacity : 100}
                                      onChange={(e) => {
                                        const opacity = parseInt(e.target.value);
                                        
                                        // Convertir el color actual a rgba con la nueva opacidad
                                        let baseColor = button.backgroundColor || '#000000';
                                        let r, g, b;
                                        
                                        if (baseColor.startsWith('rgba')) {
                                          // Extraer RGB de rgba existente
                                          const match = baseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                          if (match) {
                                            r = parseInt(match[1]);
                                            g = parseInt(match[2]);
                                            b = parseInt(match[3]);
                                          }
                                        } else if (baseColor.startsWith('#')) {
                                          // Convertir hex a RGB
                                          r = parseInt(baseColor.slice(1, 3), 16);
                                          g = parseInt(baseColor.slice(3, 5), 16);
                                          b = parseInt(baseColor.slice(5, 7), 16);
                                        }
                                        
                                        const alpha = opacity / 100;
                                        const newColor = `rgba(${r},${g},${b},${alpha})`;
                                        
                                        // Actualizar ambos valores en una sola llamada
                                        const updatedSlides = [...config.banners.slides];
                                        updatedSlides[slideIndex].buttons[buttonIndex] = {
                                          ...updatedSlides[slideIndex].buttons[buttonIndex],
                                          backgroundColor: newColor,
                                          backgroundOpacity: opacity
                                        };
                                        
                                        setConfig(prev => ({
                                          ...prev,
                                          banners: {
                                            ...prev.banners,
                                            slides: updatedSlides
                                          }
                                        }));
                                      }}
                                      style={{width: '100%', marginTop: '5px'}}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>🔤 Color de Texto</label>
                                  <div className="color-input-group">
                                    <input
                                      type="color"
                                      value={button.textColor}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'textColor', e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      value={button.textColor}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'textColor', e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="form-group">
                                  <label>🎨 Color Hover (al pasar mouse)</label>
                                  <div className="color-input-group">
                                    <input
                                      type="color"
                                      value={button.hoverColor?.startsWith('rgba') || button.hoverColor?.startsWith('rgb') ? '#333333' : (button.hoverColor || '#333333')}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'hoverColor', e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      value={button.hoverColor || 'rgba(51,51,51,1)'}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'hoverColor', e.target.value)}
                                      placeholder="rgba(51,51,51,1)"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>📦 Padding (espaciado interno)</label>
                                  <input
                                    type="text"
                                    value={button.padding || '12px 32px'}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'padding', e.target.value)}
                                    placeholder="12px 32px"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>⚪ Esquinas (border-radius)</label>
                                  <input
                                    type="text"
                                    value={button.borderRadius || '8px'}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'borderRadius', e.target.value)}
                                    placeholder="0px = cuadrado | 8px = redondeado | 50px = muy redondo"
                                  />
                                </div>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>📏 Grosor de Borde</label>
                                  <input
                                    type="text"
                                    value={button.borderWidth || '0px'}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'borderWidth', e.target.value)}
                                    placeholder="0px, 2px, 3px"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>📐 Estilo de Borde</label>
                                  <select
                                    value={button.borderStyle || 'solid'}
                                    onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'borderStyle', e.target.value)}
                                    style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}
                                  >
                                    <option value="solid">Sólido</option>
                                    <option value="dashed">Rayado</option>
                                    <option value="dotted">Punteado</option>
                                    <option value="double">Doble</option>
                                    <option value="none">Sin borde</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-row">
                                <div className="form-group">
                                  <label>🎨 Color de Borde</label>
                                  <div className="color-input-group">
                                    <input
                                      type="color"
                                      value={button.borderColor || '#000000'}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'borderColor', e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      value={button.borderColor || '#000000'}
                                      onChange={(e) => updateButtonInSlide(slideIndex, buttonIndex, 'borderColor', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Preview del botón */}
                              <div className="button-preview" style={{marginTop: '15px'}}>
                                <button
                                  style={{
                                    backgroundColor: button.backgroundColor,
                                    color: button.textColor,
                                    padding: button.padding || '12px 32px',
                                    borderRadius: button.borderRadius || '8px',
                                    border: `${button.borderWidth || '0px'} ${button.borderStyle || 'solid'} ${button.borderColor || '#000000'}`,
                                    fontSize: button.fontSize || '16px',
                                    fontWeight: button.fontWeight || '700',
                                    cursor: 'pointer',
                                    boxShadow: button.shadow || '0 4px 12px rgba(0,0,0,0.2)',
                                    textTransform: button.textTransform || 'uppercase'
                                  }}
                                >
                                  {button.text}
                                </button>
                              </div>
                            </div>
                          ))
                        )}

                        <button 
                          className="btn-add" 
                          onClick={() => addButtonToSlide(slideIndex)}
                          style={{marginTop: '15px'}}
                        >
                          + Agregar Botón a esta Imagen
                        </button>
                      </div>
                    ))}

                    <button className="btn-add" onClick={addSlide}>
                      + Agregar Otra Imagen del Carrusel
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Top Header Tab */}
        {activeTab === 'topHeader' && (
          <div className="config-section">
            <div className="section-header">
              <h2>📌 Barra Superior</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.topHeader?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    topHeader: { ...prev.topHeader, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.topHeader?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    📌 Barra de información debajo del header principal. Ideal para mensajes de envío gratis, cuotas sin interés, etc.
                  </p>
                </div>
                <div className="form-row" style={{marginBottom: '24px'}}>
                  <div className="form-group">
                    <label>🎨 Color de Fondo</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.topHeader.backgroundColor || '#f5f5f5'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topHeader: { ...prev.topHeader, backgroundColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.topHeader.backgroundColor || '#f5f5f5'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topHeader: { ...prev.topHeader, backgroundColor: e.target.value }
                        }))}
                        placeholder="#f5f5f5"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>✍️ Color de Texto</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.topHeader.textColor || '#333333'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topHeader: { ...prev.topHeader, textColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.topHeader.textColor || '#333333'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topHeader: { ...prev.topHeader, textColor: e.target.value }
                        }))}
                        placeholder="#333333"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{marginBottom: '24px'}}>
                  <label>� Tipografía</label>
                  <select
                    value={config.topHeader.fontFamily || 'system-ui'}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      topHeader: { ...prev.topHeader, fontFamily: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  >
                    <option value="system-ui">System UI (predeterminada)</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    <option value="'Raleway', sans-serif">Raleway</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Merriweather', serif">Merriweather</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Georgia', serif">Georgia</option>
                  </select>
                </div>

                <div className="form-group" style={{marginBottom: '24px'}}>
                  <label>�📐 Alineación del Contenedor</label>
                  <select
                    value={config.topHeader.alignment || 'center'}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      topHeader: { ...prev.topHeader, alignment: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  >
                    <option value="left">⬅️ Izquierda</option>
                    <option value="center">⬌ Centro</option>
                    <option value="right">➡️ Derecha</option>
                    <option value="space-between">↔️ Distribuido (izq y der)</option>
                  </select>
                </div>

                <div style={{marginBottom: '20px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px'}}>📋 Items del Header</h3>
                  {(config.topHeader.items || []).map((item, index) => (
                    <div key={index} style={{
                      background: item.active ? '#f0fdf4' : 'white',
                      border: item.active ? '2px solid #10b981' : '2px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '16px'
                    }}>
                      <div style={{display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center'}}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          background: item.active ? '#10b981' : '#f3f4f6',
                          color: item.active ? 'white' : '#374151',
                          borderRadius: '8px',
                          fontWeight: '500',
                          fontSize: '13px'
                        }}>
                          <input
                            type="checkbox"
                            checked={item.active || false}
                            onChange={(e) => {
                              const newItems = [...config.topHeader.items];
                              newItems[index].active = e.target.checked;
                              setConfig(prev => ({
                                ...prev,
                                topHeader: { ...prev.topHeader, items: newItems }
                              }));
                            }}
                            style={{cursor: 'pointer'}}
                          />
                          {item.active ? '✓ Activo' : 'Inactivo'}
                        </label>

                        <select
                          value={item.position || 'left'}
                          onChange={(e) => {
                            const newItems = [...config.topHeader.items];
                            newItems[index].position = e.target.value;
                            setConfig(prev => ({
                              ...prev,
                              topHeader: { ...prev.topHeader, items: newItems }
                            }));
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '2px solid #e5e7eb',
                            fontSize: '13px'
                          }}
                        >
                          <option value="left">⬅️ Izquierda</option>
                          <option value="right">➡️ Derecha</option>
                        </select>

                        <button
                          className="btn-danger"
                          onClick={() => {
                            const newItems = config.topHeader.items.filter((_, i) => i !== index);
                            setConfig(prev => ({
                              ...prev,
                              topHeader: { ...prev.topHeader, items: newItems }
                            }));
                          }}
                          style={{marginLeft: 'auto', padding: '8px 12px'}}
                        >
                          🗑️
                        </button>
                      </div>

                      <div className="form-row">
                        <div className="form-group" style={{flex: '0 0 80px'}}>
                          <label>Ícono</label>
                          <EmojiPicker
                            value={item.icon || ''}
                            onChange={(emoji) => {
                              const newItems = [...config.topHeader.items];
                              newItems[index].icon = emoji;
                              setConfig(prev => ({
                                ...prev,
                                topHeader: { ...prev.topHeader, items: newItems }
                              }));
                            }}
                            placeholder="🚚"
                          />
                        </div>
                        <div className="form-group" style={{flex: 1}}>
                          <label>Texto</label>
                          <input
                            type="text"
                            value={item.text || ''}
                            onChange={(e) => {
                              const newItems = [...config.topHeader.items];
                              newItems[index].text = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                topHeader: { ...prev.topHeader, items: newItems }
                              }));
                            }}
                            placeholder="Envio gratis en compras mayores a $50.000"
                          />
                        </div>
                        <div className="form-group" style={{flex: 1}}>
                          <label>Link (opcional)</label>
                          <input
                            type="text"
                            value={item.link || ''}
                            onChange={(e) => {
                              const newItems = [...config.topHeader.items];
                              newItems[index].link = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                topHeader: { ...prev.topHeader, items: newItems }
                              }));
                            }}
                            placeholder="https://tutienda.com/envios"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const newItems = [...(config.topHeader.items || []), { icon: '✨', text: '', link: '', position: 'left', active: false }];
                      setConfig(prev => ({
                        ...prev,
                        topHeader: { ...prev.topHeader, items: newItems }
                      }));
                    }}
                  >
                    ➕ Agregar Item
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Top Announcement Bar Tab */}
        {activeTab === 'topAnnouncementBar' && (
          <div className="config-section">
            <div className="section-header">
              <h2>📣 Barra de Anuncios Superior</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.topAnnouncementBar?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    topAnnouncementBar: { ...prev.topAnnouncementBar, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.topAnnouncementBar?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    📣 Mensajes rotativos arriba de todo en tu tienda. Perfecto para destacar promociones y ofertas importantes.
                  </p>
                </div>
                <div className="form-row" style={{marginBottom: '24px'}}>
                  <div className="form-group">
                    <label>🎨 Color de Fondo</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.topAnnouncementBar.backgroundColor || '#1a1a1a'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topAnnouncementBar: { ...prev.topAnnouncementBar, backgroundColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.topAnnouncementBar.backgroundColor || '#1a1a1a'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topAnnouncementBar: { ...prev.topAnnouncementBar, backgroundColor: e.target.value }
                        }))}
                        placeholder="#1a1a1a"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>✍️ Color de Texto</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.topAnnouncementBar.textColor || '#ffffff'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topAnnouncementBar: { ...prev.topAnnouncementBar, textColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.topAnnouncementBar.textColor || '#ffffff'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topAnnouncementBar: { ...prev.topAnnouncementBar, textColor: e.target.value }
                        }))}
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{marginBottom: '24px'}}>
                  <label>🔤 Tipografía</label>
                  <select
                    value={config.topAnnouncementBar.fontFamily || 'system-ui'}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      topAnnouncementBar: { ...prev.topAnnouncementBar, fontFamily: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  >
                    <option value="system-ui">System UI (predeterminada)</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    <option value="'Raleway', sans-serif">Raleway</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Merriweather', serif">Merriweather</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Georgia', serif">Georgia</option>
                  </select>
                </div>

                <div className="form-row" style={{marginBottom: '24px'}}>
                  <div className="form-group">
                    <label>📏 Tamaño de Fuente (px)</label>
                    <input
                      type="number"
                      min="10"
                      max="20"
                      value={config.topAnnouncementBar.fontSize || 13}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        topAnnouncementBar: { ...prev.topAnnouncementBar, fontSize: parseInt(e.target.value) }
                      }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>📝 Peso de Fuente</label>
                    <select
                      value={config.topAnnouncementBar.fontWeight || 500}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        topAnnouncementBar: { ...prev.topAnnouncementBar, fontWeight: parseInt(e.target.value) }
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px'
                      }}
                    >
                      <option value="300">300 - Light</option>
                      <option value="400">400 - Normal</option>
                      <option value="500">500 - Medium</option>
                      <option value="600">600 - Semi Bold</option>
                      <option value="700">700 - Bold</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>📦 Padding (px)</label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      value={config.topAnnouncementBar.padding || 11}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        topAnnouncementBar: { ...prev.topAnnouncementBar, padding: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                </div>

                {/* Configuración de Bordes */}
                <div style={{marginBottom: '20px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px'}}>🔲 Bordes</h3>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.topAnnouncementBar?.borderEnabled || false}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          topAnnouncementBar: { ...prev.topAnnouncementBar, borderEnabled: e.target.checked }
                        }))}
                      />
                      <span>Activar bordes</span>
                    </label>
                  </div>

                  {config.topAnnouncementBar?.borderEnabled && (
                    <>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px'}}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.topAnnouncementBar?.borderTop || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderTop: e.target.checked }
                            }))}
                          />
                          <span>Borde superior</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.topAnnouncementBar?.borderBottom || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderBottom: e.target.checked }
                            }))}
                          />
                          <span>Borde inferior</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.topAnnouncementBar?.borderLeft || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderLeft: e.target.checked }
                            }))}
                          />
                          <span>Borde izquierdo</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.topAnnouncementBar?.borderRight || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderRight: e.target.checked }
                            }))}
                          />
                          <span>Borde derecho</span>
                        </label>
                      </div>

                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'}}>
                        <div className="form-group">
                          <label>Estilo</label>
                          <select
                            value={config.topAnnouncementBar?.borderStyle || 'solid'}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderStyle: e.target.value }
                            }))}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '2px solid #e5e7eb',
                              fontSize: '14px'
                            }}
                          >
                            <option value="solid">Sólido</option>
                            <option value="dashed">Punteado</option>
                            <option value="dotted">Puntos</option>
                            <option value="double">Doble</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Grosor (px)</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={config.topAnnouncementBar?.borderWidth || 1}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, borderWidth: parseInt(e.target.value) }
                            }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Color</label>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <input
                              type="color"
                              value={config.topAnnouncementBar?.borderColor || '#ffffff'}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                topAnnouncementBar: { ...prev.topAnnouncementBar, borderColor: e.target.value }
                              }))}
                              style={{width: '50px', height: '40px', cursor: 'pointer'}}
                            />
                            <input
                              type="text"
                              value={config.topAnnouncementBar?.borderColor || '#ffffff'}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                topAnnouncementBar: { ...prev.topAnnouncementBar, borderColor: e.target.value }
                              }))}
                              style={{flex: 1}}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{marginBottom: '20px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px'}}>💬 Mensajes</h3>
                  {(config.topAnnouncementBar.messages || []).map((msg, index) => (
                    <div key={index} style={{
                      background: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '12px'
                    }}>
                      <div style={{display: 'flex', gap: '12px', alignItems: 'flex-end'}}>
                        <div className="form-group" style={{flex: 2}}>
                          <label>Texto del Mensaje</label>
                          <input
                            type="text"
                            value={msg.text || ''}
                            onChange={(e) => {
                              const newMessages = [...config.topAnnouncementBar.messages];
                              newMessages[index].text = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                topAnnouncementBar: { ...prev.topAnnouncementBar, messages: newMessages }
                              }));
                            }}
                            placeholder="🔥 Black Friday: hasta 50% OFF"
                          />
                        </div>
                        <div className="form-group" style={{flex: 1}}>
                          <label>Link (opcional)</label>
                          <input
                            type="text"
                            value={msg.link || ''}
                            onChange={(e) => {
                              const newMessages = [...config.topAnnouncementBar.messages];
                              newMessages[index].link = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                topAnnouncementBar: { ...prev.topAnnouncementBar, messages: newMessages }
                              }));
                            }}
                            placeholder="https://tutienda.com/ofertas"
                          />
                        </div>
                        <button
                          className="btn-danger"
                          onClick={() => {
                            const newMessages = config.topAnnouncementBar.messages.filter((_, i) => i !== index);
                            setConfig(prev => ({
                              ...prev,
                              topAnnouncementBar: { ...prev.topAnnouncementBar, messages: newMessages }
                            }));
                          }}
                          style={{alignSelf: 'flex-end', padding: '10px 16px'}}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const newMessages = [...(config.topAnnouncementBar.messages || []), { text: '', link: '' }];
                      setConfig(prev => ({
                        ...prev,
                        topAnnouncementBar: { ...prev.topAnnouncementBar, messages: newMessages }
                      }));
                    }}
                  >
                    ➕ Agregar Mensaje
                  </button>
                </div>

                <div style={{
                  background: '#eff6ff',
                  border: '2px solid #dbeafe',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '20px'
                }}>
                  <h4 style={{fontSize: '14px', fontWeight: '600', color: '#1e3a8a', marginBottom: '8px'}}>
                    💡 Tips de Uso
                  </h4>
                  <ul style={{fontSize: '13px', color: '#1e40af', margin: 0, paddingLeft: '20px'}}>
                    <li>Esta barra se muestra ARRIBA del menú de navegación</li>
                    <li>Desktop: todos los mensajes visibles con separadores |</li>
                    <li>Mobile: los mensajes rotan automáticamente cada 4 segundos</li>
                    <li>Podés combinarla con la "Barra de Ofertas" (abajo del menú)</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* Announcement Bar Tab */}
        {activeTab === 'announcementBar' && (
          <div className="config-section">
            <div className="section-header">
              <h2>📢 Barra de Ofertas</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.announcementBar?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    announcementBar: { ...prev.announcementBar, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.announcementBar?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    🎯 Destaca ofertas y promociones con mensajes rotativos. Se muestran con separadores | entre cada mensaje.
                  </p>
                </div>
                <div className="form-row" style={{marginBottom: '24px'}}>
                  <div className="form-group">
                    <label>🎨 Color de Fondo</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.announcementBar.backgroundColor || '#8B0000'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          announcementBar: { ...prev.announcementBar, backgroundColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.announcementBar.backgroundColor || '#8B0000'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          announcementBar: { ...prev.announcementBar, backgroundColor: e.target.value }
                        }))}
                        placeholder="#8B0000"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>✍️ Color de Texto</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={config.announcementBar.textColor || '#ffffff'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          announcementBar: { ...prev.announcementBar, textColor: e.target.value }
                        }))}
                      />
                      <input
                        type="text"
                        value={config.announcementBar.textColor || '#ffffff'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          announcementBar: { ...prev.announcementBar, textColor: e.target.value }
                        }))}
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{marginBottom: '24px'}}>
                  <label>🔤 Tipografía</label>
                  <select
                    value={config.announcementBar.fontFamily || 'system-ui'}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      announcementBar: { ...prev.announcementBar, fontFamily: e.target.value }
                    }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  >
                    <option value="system-ui">System UI (predeterminada)</option>
                    <option value="'Poppins', sans-serif">Poppins</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Roboto', sans-serif">Roboto</option>
                    <option value="'Open Sans', sans-serif">Open Sans</option>
                    <option value="'Lato', sans-serif">Lato</option>
                    <option value="'Raleway', sans-serif">Raleway</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Merriweather', serif">Merriweather</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Georgia', serif">Georgia</option>
                  </select>
                </div>

                <div className="form-row" style={{marginBottom: '24px'}}>
                  <div className="form-group">
                    <label>📏 Tamaño de Fuente (px)</label>
                    <input
                      type="number"
                      min="10"
                      max="20"
                      value={config.announcementBar.fontSize || 13}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcementBar: { ...prev.announcementBar, fontSize: parseInt(e.target.value) }
                      }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>📝 Peso de Fuente</label>
                    <select
                      value={config.announcementBar.fontWeight || 500}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcementBar: { ...prev.announcementBar, fontWeight: parseInt(e.target.value) }
                      }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        fontSize: '14px'
                      }}
                    >
                      <option value="300">300 - Light</option>
                      <option value="400">400 - Normal</option>
                      <option value="500">500 - Medium</option>
                      <option value="600">600 - Semi Bold</option>
                      <option value="700">700 - Bold</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>📦 Padding (px)</label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      value={config.announcementBar.padding || 11}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        announcementBar: { ...prev.announcementBar, padding: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                </div>

                {/* Configuración de Bordes */}
                <div style={{marginBottom: '20px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px'}}>🔲 Bordes</h3>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.announcementBar?.borderEnabled || false}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          announcementBar: { ...prev.announcementBar, borderEnabled: e.target.checked }
                        }))}
                      />
                      <span>Activar bordes</span>
                    </label>
                  </div>

                  {config.announcementBar?.borderEnabled && (
                    <>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px'}}>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.announcementBar?.borderTop || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderTop: e.target.checked }
                            }))}
                          />
                          <span>Borde superior</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.announcementBar?.borderBottom || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderBottom: e.target.checked }
                            }))}
                          />
                          <span>Borde inferior</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.announcementBar?.borderLeft || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderLeft: e.target.checked }
                            }))}
                          />
                          <span>Borde izquierdo</span>
                        </label>

                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={config.announcementBar?.borderRight || false}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderRight: e.target.checked }
                            }))}
                          />
                          <span>Borde derecho</span>
                        </label>
                      </div>

                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'}}>
                        <div className="form-group">
                          <label>Estilo</label>
                          <select
                            value={config.announcementBar?.borderStyle || 'solid'}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderStyle: e.target.value }
                            }))}
                            style={{
                              width: '100%',
                              padding: '12px',
                              borderRadius: '8px',
                              border: '2px solid #e5e7eb',
                              fontSize: '14px'
                            }}
                          >
                            <option value="solid">Sólido</option>
                            <option value="dashed">Punteado</option>
                            <option value="dotted">Puntos</option>
                            <option value="double">Doble</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Grosor (px)</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={config.announcementBar?.borderWidth || 1}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, borderWidth: parseInt(e.target.value) }
                            }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Color</label>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <input
                              type="color"
                              value={config.announcementBar?.borderColor || '#ffffff'}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                announcementBar: { ...prev.announcementBar, borderColor: e.target.value }
                              }))}
                              style={{width: '50px', height: '40px', cursor: 'pointer'}}
                            />
                            <input
                              type="text"
                              value={config.announcementBar?.borderColor || '#ffffff'}
                              onChange={(e) => setConfig(prev => ({
                                ...prev,
                                announcementBar: { ...prev.announcementBar, borderColor: e.target.value }
                              }))}
                              style={{flex: 1}}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{marginBottom: '20px'}}>
                  <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '16px'}}>💬 Mensajes</h3>
                  {(config.announcementBar.messages || []).map((msg, index) => (
                    <div key={index} style={{
                      background: 'white',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '16px'
                    }}>
                      <div className="form-row">
                        <div className="form-group" style={{flex: 2}}>
                          <label>Texto del Mensaje</label>
                          <input
                            type="text"
                            value={msg.text || ''}
                            onChange={(e) => {
                              const newMessages = [...config.announcementBar.messages];
                              newMessages[index].text = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                announcementBar: { ...prev.announcementBar, messages: newMessages }
                              }));
                            }}
                            placeholder="Limited Time! Free Shipping"
                          />
                        </div>
                        <div className="form-group" style={{flex: 1}}>
                          <label>Link (opcional)</label>
                          <input
                            type="text"
                            value={msg.link || ''}
                            onChange={(e) => {
                              const newMessages = [...config.announcementBar.messages];
                              newMessages[index].link = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                announcementBar: { ...prev.announcementBar, messages: newMessages }
                              }));
                            }}
                            placeholder="https://tutienda.com/ofertas"
                          />
                        </div>
                        <button
                          className="btn-danger"
                          onClick={() => {
                            const newMessages = config.announcementBar.messages.filter((_, i) => i !== index);
                            setConfig(prev => ({
                              ...prev,
                              announcementBar: { ...prev.announcementBar, messages: newMessages }
                            }));
                          }}
                          style={{alignSelf: 'flex-end', padding: '10px 16px'}}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const newMessages = [...(config.announcementBar.messages || []), { text: '', link: '' }];
                      setConfig(prev => ({
                        ...prev,
                        announcementBar: { ...prev.announcementBar, messages: newMessages }
                      }));
                    }}
                  >
                    ➕ Agregar Mensaje
                  </button>
                </div>

                <div style={{
                  background: '#fffbeb',
                  border: '2px solid #fef3c7',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '20px'
                }}>
                  <h4 style={{fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px'}}>
                    💡 Tips de Uso
                  </h4>
                  <ul style={{fontSize: '13px', color: '#78350f', margin: 0, paddingLeft: '20px'}}>
                    <li>Los mensajes rotarán automáticamente cada {config.announcementBar.rotationSpeed || 5} segundos</li>
                    <li>Podés agregar emojis para hacer los mensajes más atractivos</li>
                    <li>Los links son opcionales - dejá vacío si solo querés mostrar texto</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* Cambio de Vista Tab */}
        {activeTab === 'lightToggle' && (
          <div className="config-section">
            <div className="section-header">
              <h2>🔄 Cambio de Vista</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.lightToggle?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    lightToggle: { ...prev.lightToggle, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.lightToggle?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '30px', background: '#f0f9ff', borderColor: '#bfdbfe'}}>
                  <h4 style={{fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '12px'}}>
                    💡 ¿Cómo funciona el Cambio de Vista?
                  </h4>
                  <p style={{margin: '0 0 16px 0', fontSize: '14px', color: '#1e3a8a', lineHeight: '1.6'}}>
                    Este módulo muestra un botón en las páginas de productos que permite a los clientes alternar entre la primera y segunda imagen del producto.
                  </p>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '12px'}}>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <span style={{fontSize: '18px'}}>🏠</span>
                      <div>
                        <strong style={{color: '#1e40af', fontSize: '14px'}}>Decoración:</strong>
                        <p style={{margin: '2px 0 0 0', fontSize: '13px', color: '#1e3a8a'}}>Mostrar producto con luz prendida/apagada</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <span style={{fontSize: '18px'}}>👗</span>
                      <div>
                        <strong style={{color: '#1e40af', fontSize: '14px'}}>Indumentaria:</strong>
                        <p style={{margin: '2px 0 0 0', fontSize: '13px', color: '#1e3a8a'}}>Producto solo vs. outfit completo</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <span style={{fontSize: '18px'}}>👙</span>
                      <div>
                        <strong style={{color: '#1e40af', fontSize: '14px'}}>Ropa de baño:</strong>
                        <p style={{margin: '2px 0 0 0', fontSize: '13px', color: '#1e3a8a'}}>Vista frontal vs. posterior</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <span style={{fontSize: '18px'}}>🎨</span>
                      <div>
                        <strong style={{color: '#1e40af', fontSize: '14px'}}>Variantes:</strong>
                        <p style={{margin: '2px 0 0 0', fontSize: '13px', color: '#1e3a8a'}}>Diferentes ángulos o estilos</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                      <span style={{fontSize: '18px'}}>✨</span>
                      <div>
                        <strong style={{color: '#1e40af', fontSize: '14px'}}>Antes/Después:</strong>
                        <p style={{margin: '2px 0 0 0', fontSize: '13px', color: '#1e3a8a'}}>Transformaciones, resultados</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    ⚙️ Configuración del Botón
                  </h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label>🏷️ Texto del Botón</label>
                      <input
                        type="text"
                        value={config.lightToggle?.label || 'Ver:'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          lightToggle: { ...prev.lightToggle, label: e.target.value }
                        }))}
                        placeholder="Ej: Ver:, Cambiar a:, Mostrar:"
                        style={{
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      <small style={{color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '6px'}}>
                        Texto que aparece antes de las opciones (Ej: "Ver: Prendida / Apagada")
                      </small>
                    </div>

                    <div className="form-group">
                      <label>📍 Posición del Botón</label>
                      <select
                        value={config.lightToggle?.position || 'top-right'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          lightToggle: { ...prev.lightToggle, position: e.target.value }
                        }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="top-left">↖️ Arriba Izquierda</option>
                        <option value="top-right">↗️ Arriba Derecha</option>
                        <option value="bottom-left">↙️ Abajo Izquierda</option>
                        <option value="bottom-right">↘️ Abajo Derecha</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>🎯 Aplicar a (por defecto: TODOS los productos)</label>
                    <div style={{marginBottom: '15px'}}>
                      {(!config.lightToggle?.categoryUrls || config.lightToggle.categoryUrls.length === 0) ? (
                        <div style={{
                          padding: '20px',
                          background: '#f9fafb',
                          borderRadius: '8px',
                          border: '2px dashed #d1d5db',
                          textAlign: 'center'
                        }}>
                          <p style={{margin: 0, color: '#6b7280', fontSize: '14px'}}>
                            Sin URLs específicas - Aparecerá en TODOS los productos
                          </p>
                        </div>
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                          {config.lightToggle.categoryUrls.map((url, index) => (
                            <div key={index} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                              <input
                                type="text"
                                value={url}
                                onChange={(e) => {
                                  const newUrls = [...config.lightToggle.categoryUrls];
                                  newUrls[index] = e.target.value;
                                  setConfig(prev => ({
                                    ...prev,
                                    lightToggle: { ...prev.lightToggle, categoryUrls: newUrls }
                                  }));
                                }}
                                placeholder="URL de categoría (ej: /productos/lamparas)"
                                style={{
                                  flex: 1,
                                  padding: '12px',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '14px'
                                }}
                              />
                              <button
                                onClick={() => {
                                  const newUrls = config.lightToggle.categoryUrls.filter((_, i) => i !== index);
                                  setConfig(prev => ({
                                    ...prev,
                                    lightToggle: { ...prev.lightToggle, categoryUrls: newUrls }
                                  }));
                                }}
                                style={{
                                  padding: '12px 16px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '600'
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          const currentUrls = config.lightToggle?.categoryUrls || [];
                          setConfig(prev => ({
                            ...prev,
                            lightToggle: { 
                              ...prev.lightToggle, 
                              categoryUrls: [...currentUrls, '']
                            }
                          }));
                        }}
                        style={{
                          marginTop: '10px',
                          padding: '12px 20px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          width: '100%'
                        }}
                      >
                        + Agregar URL de Categoría
                      </button>
                    </div>
                    <small style={{color: '#059669', fontSize: '12px', display: 'block', marginTop: '6px', fontWeight: '600'}}>
                      ✅ Sin URLs = aparece en TODOS los productos. Con URLs = solo en esas categorías específicas
                    </small>
                  </div>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    🎨 Etiquetas de las Vistas
                  </h3>
                  <p style={{fontSize: '14px', color: '#6b7280', marginBottom: '16px'}}>
                    Personaliza los nombres que aparecerán en el botón según tu rubro:
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label>🌟 Nombre Vista 1 (Primera imagen)</label>
                      <input
                        type="text"
                        value={config.lightToggle?.view1Label || 'Apagada'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          lightToggle: { ...prev.lightToggle, view1Label: e.target.value }
                        }))}
                        placeholder="Ej: Apagada, Solo, Frontal, Antes"
                        style={{
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>✨ Nombre Vista 2 (Segunda imagen)</label>
                      <input
                        type="text"
                        value={config.lightToggle?.view2Label || 'Prendida'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          lightToggle: { ...prev.lightToggle, view2Label: e.target.value }
                        }))}
                        placeholder="Ej: Prendida, Outfit, Posterior, Después"
                        style={{
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '2px solid #86efac',
                  borderRadius: '16px',
                  padding: '24px',
                  marginTop: '30px'
                }}>
                  <h4 style={{fontSize: '16px', fontWeight: '700', color: '#166534', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>💡</span> Ejemplos de Uso por Rubro
                  </h4>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px'}}>
                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>💡</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>Iluminación/Deco</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Apagada"<br/>
                        Vista 2: "Prendida"
                      </div>
                    </div>

                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>👗</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>Moda/Ropa</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Producto Solo"<br/>
                        Vista 2: "Outfit Completo"
                      </div>
                    </div>

                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>👙</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>Ropa de Baño</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Frontal"<br/>
                        Vista 2: "Posterior"
                      </div>
                    </div>

                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>🎨</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>Belleza/Cosmética</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Antes"<br/>
                        Vista 2: "Después"
                      </div>
                    </div>

                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>🪑</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>Muebles</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Producto"<br/>
                        Vista 2: "Ambientado"
                      </div>
                    </div>

                    <div style={{background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #86efac'}}>
                      <div style={{fontSize: '24px', marginBottom: '8px'}}>📦</div>
                      <div style={{fontWeight: '600', color: '#166534', marginBottom: '4px'}}>General</div>
                      <div style={{fontSize: '13px', color: '#15803d'}}>
                        Vista 1: "Vista 1"<br/>
                        Vista 2: "Vista 2"
                      </div>
                    </div>
                  </div>

                  <div style={{marginTop: '20px', padding: '16px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fbbf24'}}>
                    <strong style={{color: '#92400e', fontSize: '14px'}}>📸 Importante:</strong>
                    <p style={{margin: '8px 0 0 0', fontSize: '13px', color: '#78350f'}}>
                      Para que funcione, tus productos deben tener al menos 2 imágenes cargadas. La primera imagen será la "Vista 1" y la segunda será la "Vista 2".
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Enhanced Search Tab */}
        {activeTab === 'enhancedSearch' && (
          <div className="config-section">
            <div className="section-header">
              <h2>🔍 Buscador Mejorado</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.enhancedSearch?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    enhancedSearch: { ...prev.enhancedSearch, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.enhancedSearch?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    🔍 Mejora la experiencia de búsqueda con sugerencias populares. El buscador muestra un dropdown con búsquedas destacadas cuando el usuario hace click.
                  </p>
                </div>
                <div className="info-box" style={{marginBottom: '30px', background: '#f0f9ff', borderColor: '#bfdbfe'}}>
                  <p style={{margin: 0, fontSize: '14px', color: '#1e40af'}}>
                    💡 <strong>¿Cómo funciona?</strong> El buscador mejorado intercepta el input de búsqueda de TiendaNube y muestra un dropdown con "Popular Searches" cuando el usuario hace click. Cada búsqueda puede tener un link personalizado o buscar en tu tienda.
                  </p>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    📝 Búsquedas Populares
                  </h3>

                  {(config.enhancedSearch?.popularSearches || []).map((search, index) => (
                    <div key={index} style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      border: '2px solid #e5e7eb'
                    }}>
                      <div style={{display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                        <div style={{flex: 1}}>
                          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                            Texto de Búsqueda
                          </label>
                          <input
                            type="text"
                            value={search.text}
                            onChange={(e) => {
                              const newSearches = [...config.enhancedSearch.popularSearches];
                              newSearches[index].text = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                enhancedSearch: { ...prev.enhancedSearch, popularSearches: newSearches }
                              }));
                            }}
                            placeholder="ej: sillas de comedor"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        
                        <div style={{flex: 1}}>
                          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                            Link (opcional)
                          </label>
                          <input
                            type="text"
                            value={search.link}
                            onChange={(e) => {
                              const newSearches = [...config.enhancedSearch.popularSearches];
                              newSearches[index].link = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                enhancedSearch: { ...prev.enhancedSearch, popularSearches: newSearches }
                              }));
                            }}
                            placeholder="/categoria/sillas o https://..."
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px'
                            }}
                          />
                          <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                            Dejá vacío para buscar en tu tienda
                          </small>
                        </div>

                        <button
                          onClick={() => {
                            const newSearches = config.enhancedSearch.popularSearches.filter((_, i) => i !== index);
                            setConfig(prev => ({
                              ...prev,
                              enhancedSearch: { ...prev.enhancedSearch, popularSearches: newSearches }
                            }));
                          }}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            marginTop: '28px'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newSearches = [...(config.enhancedSearch.popularSearches || []), { text: '', link: '' }];
                      setConfig(prev => ({
                        ...prev,
                        enhancedSearch: { ...prev.enhancedSearch, popularSearches: newSearches }
                      }));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    ➕ Agregar Búsqueda Popular
                  </button>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    🎨 Personalización del Dropdown
                  </h3>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color Principal (Borde, Iconos, Hover)
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.enhancedSearch?.primaryColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, primaryColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.enhancedSearch?.primaryColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, primaryColor: e.target.value }
                          }))}
                          placeholder="#000000"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        Se usa para el borde del dropdown, iconos y efectos de hover
                      </small>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color del Texto
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.enhancedSearch?.textColor || '#1a1a1a'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, textColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.enhancedSearch?.textColor || '#1a1a1a'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, textColor: e.target.value }
                          }))}
                          placeholder="#1a1a1a"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        Color del texto de las búsquedas populares
                      </small>
                    </div>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color de Fondo del Dropdown
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.enhancedSearch?.backgroundColor || '#ffffff'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, backgroundColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.enhancedSearch?.backgroundColor || '#ffffff'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            enhancedSearch: { ...prev.enhancedSearch, backgroundColor: e.target.value }
                          }))}
                          placeholder="#ffffff"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        Fondo principal del dropdown
                      </small>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Máximo de Resultados
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="12"
                        value={config.enhancedSearch?.maxResults || 8}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          enhancedSearch: { ...prev.enhancedSearch, maxResults: parseInt(e.target.value) }
                        }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        Cantidad de búsquedas a mostrar (3-12)
                      </small>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Search Bar Modal Tab */}
        {activeTab === 'searchBar' && (
          <div className="config-section">
            <div className="section-header">
              <h2>🔎 Búsqueda Modal</h2>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.searchBar?.enabled || false}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    searchBar: { ...prev.searchBar, enabled: e.target.checked }
                  }))}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {config.searchBar?.enabled && (
              <>
                <div className="info-box" style={{marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '14px'}}>
                    🔎 <strong>Modal de búsqueda fullscreen</strong> - Overlay con diseño moderno que se abre al hacer click en el icono de búsqueda del header.
                  </p>
                </div>

                <div className="info-box" style={{marginBottom: '30px', background: '#f0f9ff', borderColor: '#bfdbfe'}}>
                  <p style={{margin: 0, fontSize: '14px', color: '#1e40af'}}>
                    💡 <strong>¿Cómo funciona?</strong> Intercepta el click en el icono de búsqueda y muestra un modal fullscreen con fondo oscuro, título grande y campo de búsqueda centrado. Se cierra con ESC, click en overlay o botón X.
                  </p>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    ✏️ Textos
                  </h3>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                      Título del Modal
                    </label>
                    <input
                      type="text"
                      value={config.searchBar?.placeholder || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        searchBar: { ...prev.searchBar, placeholder: e.target.value }
                      }))}
                      placeholder="¿Qué estás buscando?"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      Título grande que aparece arriba del buscador
                    </small>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                      Placeholder del Input
                    </label>
                    <input
                      type="text"
                      value={config.searchBar?.inputPlaceholder || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        searchBar: { ...prev.searchBar, inputPlaceholder: e.target.value }
                      }))}
                      placeholder="Buscar productos..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                      Texto dentro del campo de búsqueda
                    </small>
                  </div>

                  <div style={{marginBottom: '20px'}}>
                    <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                      Texto del Botón
                    </label>
                    <input
                      type="text"
                      value={config.searchBar?.buttonText || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        searchBar: { ...prev.searchBar, buttonText: e.target.value }
                      }))}
                      placeholder="Buscar"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    🎨 Diseño y Estilo
                  </h3>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Posición del Título
                      </label>
                      <select
                        value={config.searchBar?.titlePosition || 'center'}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          searchBar: { ...prev.searchBar, titlePosition: e.target.value }
                        }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          background: 'white'
                        }}
                      >
                        <option value="top">Arriba</option>
                        <option value="center">Centro</option>
                      </select>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Tamaño del Título (px)
                      </label>
                      <input
                        type="number"
                        min="20"
                        max="80"
                        value={config.searchBar?.titleSize || 42}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          searchBar: { ...prev.searchBar, titleSize: parseInt(e.target.value) }
                        }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color de Fondo del Overlay
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.searchBar?.backgroundColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, backgroundColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.searchBar?.backgroundColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, backgroundColor: e.target.value }
                          }))}
                          placeholder="#000000"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Opacidad del Fondo (0-1)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={config.searchBar?.backgroundOpacity || 0.85}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          searchBar: { ...prev.searchBar, backgroundOpacity: parseFloat(e.target.value) }
                        }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        0 = Transparente, 1 = Opaco
                      </small>
                    </div>
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color del Título
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.searchBar?.titleColor || '#ffffff'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, titleColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.searchBar?.titleColor || '#ffffff'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, titleColor: e.target.value }
                          }))}
                          placeholder="#ffffff"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color del Botón
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.searchBar?.buttonColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, buttonColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.searchBar?.buttonColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, buttonColor: e.target.value }
                          }))}
                          placeholder="#000000"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                        Color del Botón Cerrar (X)
                      </label>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                          type="color"
                          value={config.searchBar?.closeButtonColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, closeButtonColor: e.target.value }
                          }))}
                          style={{
                            width: '60px',
                            height: '50px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={config.searchBar?.closeButtonColor || '#000000'}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, closeButtonColor: e.target.value }
                          }))}
                          placeholder="#000000"
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                      <small style={{color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                        Color del ícono X para cerrar el modal
                      </small>
                    </div>
                  </div>
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    🖼️ Logo (Opcional)
                  </h3>

                  <div style={{marginBottom: '20px'}}>
                    <label className="toggle-switch" style={{marginBottom: '12px'}}>
                      <input
                        type="checkbox"
                        checked={config.searchBar?.showLogo || false}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          searchBar: { ...prev.searchBar, showLogo: e.target.checked }
                        }))}
                      />
                      <span className="toggle-slider"></span>
                      <span style={{marginLeft: '10px', fontWeight: '600'}}>Mostrar Logo</span>
                    </label>
                  </div>

                  {config.searchBar?.showLogo && (
                    <>
                      <div style={{marginBottom: '20px'}}>
                        <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                          Logo
                        </label>
                        
                        {config.searchBar?.logoUrl && (
                          <div style={{
                            marginBottom: '12px',
                            padding: '12px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <img 
                              src={config.searchBar.logoUrl} 
                              alt="Logo preview"
                              style={{
                                maxWidth: '60px',
                                maxHeight: '60px',
                                objectFit: 'contain',
                                borderRadius: '4px'
                              }}
                            />
                            <button
                              onClick={() => setConfig(prev => ({
                                ...prev,
                                searchBar: { ...prev.searchBar, logoUrl: '' }
                              }))}
                              style={{
                                padding: '6px 12px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                marginLeft: 'auto'
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                        
                        <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              try {
                                // Convertir a base64
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  const base64 = event.target.result;
                                  
                                  try {
                                    // Subir a través del backend
                                    const response = await apiRequest('/api/upload-image-base64', {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        storeId: storeId,
                                        fileName: file.name,
                                        fileData: base64,
                                        folder: 'promonube-search-logos'
                                      })
                                    });
                                    
                                    if (response.success) {
                                      setConfig(prev => ({
                                        ...prev,
                                        searchBar: { ...prev.searchBar, logoUrl: response.url }
                                      }));
                                      alert('✅ Logo subido correctamente');
                                    } else {
                                      alert('❌ Error: ' + response.message);
                                    }
                                  } catch (error) {
                                    console.error('Error uploading logo:', error);
                                    alert('❌ Error al subir el logo: ' + error.message);
                                  }
                                };
                                reader.readAsDataURL(file);
                              } catch (error) {
                                console.error('Error uploading logo:', error);
                                alert('❌ Error al subir el logo');
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              border: '2px dashed #d1d5db',
                              borderRadius: '8px',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                        
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0'}}>
                          <div style={{flex: 1, height: '1px', background: '#e5e7eb'}}></div>
                          <span style={{color: '#6b7280', fontSize: '12px'}}>o ingresar URL</span>
                          <div style={{flex: 1, height: '1px', background: '#e5e7eb'}}></div>
                        </div>
                        
                        <input
                          type="text"
                          value={config.searchBar?.logoUrl || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, logoUrl: e.target.value }
                          }))}
                          placeholder="https://..."
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        />
                      </div>

                      <div style={{marginBottom: '20px'}}>
                        <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                          Tamaño del Logo (px)
                        </label>
                        <input
                          type="number"
                          min="40"
                          max="200"
                          value={config.searchBar?.logoSize || 100}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            searchBar: { ...prev.searchBar, logoSize: parseInt(e.target.value) }
                          }))}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div style={{marginBottom: '30px'}}>
                  <h3 style={{fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937'}}>
                    🖼️ Sugerencias Visuales
                  </h3>

                  <div className="info-box" style={{marginBottom: '20px', background: '#f0fdf4', borderColor: '#86efac'}}>
                    <p style={{margin: 0, fontSize: '13px', color: '#166534'}}>
                      💡 Muestra imágenes clickeables abajo del buscador, como "Te puede interesar"
                    </p>
                  </div>

                  {(config.searchBar?.suggestions || []).map((suggestion, index) => (
                    <div key={index} style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      marginBottom: '16px',
                      border: '2px solid #e5e7eb'
                    }}>
                      {/* Preview de la imagen */}
                      {suggestion.imageUrl && (
                        <div style={{marginBottom: '16px', textAlign: 'center'}}>
                          <img 
                            src={suggestion.imageUrl} 
                            alt="Preview" 
                            style={{
                              maxWidth: '200px',
                              height: '200px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '2px solid #e5e7eb'
                            }}
                          />
                        </div>
                      )}

                      <div style={{display: 'grid', gap: '12px'}}>
                        {/* Upload de imagen */}
                        <div>
                          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                            📁 Subir Imagen
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;

                              try {
                                // Mostrar loading
                                const newSuggestions = [...(config.searchBar?.suggestions || [])];
                                newSuggestions[index] = { ...newSuggestions[index], uploading: true };
                                setConfig(prev => ({
                                  ...prev,
                                  searchBar: { ...prev.searchBar, suggestions: newSuggestions }
                                }));

                                // Convertir a base64
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  const base64 = event.target.result;
                                  
                                  try {
                                    // Subir a través del backend
                                    const response = await apiRequest('/api/upload-image-base64', {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        storeId: storeId,
                                        fileName: file.name,
                                        fileData: base64,
                                        folder: 'promonube-search-suggestions'
                                      })
                                    });
                                    
                                    if (response.success) {
                                      // Actualizar configuración
                                      const updatedSuggestions = [...(config.searchBar?.suggestions || [])];
                                      updatedSuggestions[index] = { 
                                        ...updatedSuggestions[index], 
                                        imageUrl: response.url,
                                        uploading: false 
                                      };
                                      setConfig(prev => ({
                                        ...prev,
                                        searchBar: { ...prev.searchBar, suggestions: updatedSuggestions }
                                      }));
                                      
                                      alert('✅ Imagen subida correctamente');
                                    } else {
                                      alert('❌ Error: ' + response.message);
                                      const errorSuggestions = [...(config.searchBar?.suggestions || [])];
                                      errorSuggestions[index] = { ...errorSuggestions[index], uploading: false };
                                      setConfig(prev => ({
                                        ...prev,
                                        searchBar: { ...prev.searchBar, suggestions: errorSuggestions }
                                      }));
                                    }
                                  } catch (error) {
                                    console.error('Error:', error);
                                    alert('❌ Error al subir la imagen');
                                    const errorSuggestions = [...(config.searchBar?.suggestions || [])];
                                    errorSuggestions[index] = { ...errorSuggestions[index], uploading: false };
                                    setConfig(prev => ({
                                      ...prev,
                                      searchBar: { ...prev.searchBar, suggestions: errorSuggestions }
                                    }));
                                  }
                                };
                                reader.readAsDataURL(file);
                              } catch (error) {
                                console.error('Error:', error);
                                alert('❌ Error al procesar la imagen');
                                const errorSuggestions = [...(config.searchBar?.suggestions || [])];
                                errorSuggestions[index] = { ...errorSuggestions[index], uploading: false };
                                setConfig(prev => ({
                                  ...prev,
                                  searchBar: { ...prev.searchBar, suggestions: errorSuggestions }
                                }));
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: 'white',
                              cursor: 'pointer'
                            }}
                            disabled={suggestion.uploading}
                          />
                          {suggestion.uploading && (
                            <small style={{color: '#6366f1', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                              ⏳ Subiendo imagen...
                            </small>
                          )}
                        </div>

                        {/* O URL manual */}
                        <div>
                          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                            🔗 O pegar URL de imagen
                          </label>
                          <input
                            type="text"
                            value={suggestion.imageUrl || ''}
                            onChange={(e) => {
                              const newSuggestions = [...config.searchBar.suggestions];
                              newSuggestions[index].imageUrl = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                searchBar: { ...prev.searchBar, suggestions: newSuggestions }
                              }));
                            }}
                            placeholder="https://..."
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        
                        {/* Link de destino */}
                        <div>
                          <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151'}}>
                            🎯 Link de Destino
                          </label>
                          <input
                            type="text"
                            value={suggestion.link || ''}
                            onChange={(e) => {
                              const newSuggestions = [...config.searchBar.suggestions];
                              newSuggestions[index].link = e.target.value;
                              setConfig(prev => ({
                                ...prev,
                                searchBar: { ...prev.searchBar, suggestions: newSuggestions }
                              }));
                            }}
                            placeholder="/categoria/... o /productos/..."
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '2px solid #e5e7eb',
                              borderRadius: '8px',
                              fontSize: '14px'
                            }}
                          />
                        </div>

                        {/* Botón eliminar */}
                        <button
                          onClick={() => {
                            const newSuggestions = config.searchBar.suggestions.filter((_, i) => i !== index);
                            setConfig(prev => ({
                              ...prev,
                              searchBar: { ...prev.searchBar, suggestions: newSuggestions }
                            }));
                          }}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newSuggestions = [...(config.searchBar.suggestions || []), { imageUrl: '', link: '' }];
                      setConfig(prev => ({
                        ...prev,
                        searchBar: { ...prev.searchBar, suggestions: newSuggestions }
                      }));
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    ➕ Agregar Sugerencia Visual
                  </button>
                </div>

                <div className="info-box" style={{background: '#fef3c7', borderColor: '#fbbf24', marginBottom: '20px'}}>
                  <p style={{margin: 0, fontSize: '13px', color: '#92400e'}}>
                    <strong>💡 Vista previa:</strong> Activa el widget y visita tu tienda. Haz click en el icono de búsqueda del header para ver el modal en acción.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StyleConfig;
