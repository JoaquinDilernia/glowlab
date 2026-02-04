import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Sparkles, 
  Calendar,
  MapPin,
  Search,
  X,
  Package,
  Tag,
  Percent,
  Layers,
  FolderTree,
  Circle,
  Square,
  Maximize2,
  Zap
} from 'lucide-react';
import { apiRequest } from '../config';
import './BadgeConfig.css';

function BadgeConfig() {
  const { badgeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Get rule type from URL or default to new_products
  const urlRuleType = searchParams.get('type') || 'new_products';
  
  // General config
  const [badgeName, setBadgeName] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [ruleType, setRuleType] = useState(urlRuleType);
  const [isActive, setIsActive] = useState(true);
  
  // Dates
  const [hasStartDate, setHasStartDate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  
  // Rule-specific config
  const [daysToShowAsNew, setDaysToShowAsNew] = useState(7);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [priceMode, setPriceMode] = useState('min'); // min, max, range
  const [minDiscount, setMinDiscount] = useState(10);
  const [maxStock, setMaxStock] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  // Design config
  const [shape, setShape] = useState('rectangle');
  const [position, setPosition] = useState('top-right');
  const [backgroundColor, setBackgroundColor] = useState('#FF6B6B');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState('bold');
  const [textTransform, setTextTransform] = useState('uppercase');
  const [animation, setAnimation] = useState('pulse');
  const [borderRadius, setBorderRadius] = useState(4);
  const [showIcon, setShowIcon] = useState(false);
  const [icon, setIcon] = useState('⭐');
  
  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  
  // Categories
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Suggestions for badge text
  const suggestions = {
    new_products: ['NUEVO', '🆕 NUEVO', 'RECIÉN LLEGADO', 'NOVEDAD', '✨ NUEVO'],
    manual: ['DESTACADO', '⭐ DESTACADO', 'RECOMENDADO', 'POPULAR', 'TOP'],
    price_range: ['OFERTA', '🔥 OFERTA', 'PRECIO ESPECIAL', 'PROMOCIÓN', '💰 SUPER PRECIO'],
    discount: ['DESCUENTO', '% OFF', '🎉 OFERTA', 'REBAJA', '💥 DESCUENTO'],
    stock: ['ÚLTIMAS UNIDADES', '⚡ POCAS UNIDADES', 'STOCK LIMITADO', '🔴 ÚLTIMAS', 'APROVECHA'],
    category: ['CATEGORÍA', '📁 CATEGORÍA', 'ESPECIAL', 'COLECCIÓN', '✨ ESPECIAL']
  };

  const ruleTypesInfo = {
    new_products: { title: 'Productos Nuevos', icon: Package, color: '#3B82F6', emoji: '🆕' },
    manual: { title: 'Selección Manual', icon: Tag, color: '#8B5CF6', emoji: '✋' },
    price_range: { title: 'Rango de Precio', icon: MapPin, color: '#F59E0B', emoji: '💰' },
    discount: { title: 'Descuentos', icon: Percent, color: '#EF4444', emoji: '%' },
    stock: { title: 'Stock Bajo', icon: Layers, color: '#EC4899', emoji: '📦' },
    category: { title: 'Por Categoría', icon: FolderTree, color: '#10B981', emoji: '📁' }
  };

  useEffect(() => {
    if (badgeId) {
      loadBadgeConfig();
    }
    if (ruleType === 'category' && categories.length === 0) {
      loadCategories();
    }
  }, [badgeId, ruleType]);

  const loadBadgeConfig = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const data = await apiRequest(`/api/badges/${badgeId}?storeId=${storeId}`);
      
      setBadgeName(data.badgeName || '');
      setBadgeText(data.badgeText || '');
      setRuleType(data.ruleType || 'new_products');
      setIsActive(data.isActive ?? true);
      
      if (data.startDate) {
        setHasStartDate(true);
        setStartDate(data.startDate);
      }
      if (data.endDate) {
        setHasEndDate(true);
        setEndDate(data.endDate);
      }
      
      if (data.ruleConfig) {
        setDaysToShowAsNew(data.ruleConfig.daysToShowAsNew || 7);
        setSelectedProducts(data.ruleConfig.products || []);
        setMinPrice(data.ruleConfig.minPrice || '');
        setMaxPrice(data.ruleConfig.maxPrice || '');
        setMinDiscount(data.ruleConfig.minDiscount || 10);
        setMaxStock(data.ruleConfig.maxStock || 5);
        setSelectedCategories(data.ruleConfig.categoryIds || []);
      }
      
      if (data.design) {
        setShape(data.design.shape || 'rectangle');
        setPosition(data.design.position || 'top-right');
        setBackgroundColor(data.design.backgroundColor || '#FF6B6B');
        setTextColor(data.design.textColor || '#FFFFFF');
        setFontSize(data.design.fontSize || 12);
        setFontWeight(data.design.fontWeight || 'bold');
        setTextTransform(data.design.textTransform || 'uppercase');
        setAnimation(data.design.animation || 'pulse');
        setBorderRadius(data.design.borderRadius || 4);
        setShowIcon(data.design.showIcon || false);
        setIcon(data.design.icon || '⭐');
      }
    } catch (error) {
      console.error('Error cargando badge:', error);
      alert('Error al cargar la configuración del badge');
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (query) => {
    const searchQuery = query || productSearch;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchingProducts(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const accessToken = localStorage.getItem('promonube_access_token');
      
      // Buscar directamente en TiendaNube API
      const response = await fetch(
        `https://api.tiendanube.com/v1/${storeId}/products?q=${encodeURIComponent(searchQuery)}&per_page=10`,
        {
          headers: {
            'Authentication': `bearer ${accessToken}`,
            'User-Agent': 'GlowLab (contacto@glowlab.com)'
          }
        }
      );
      
      if (!response.ok) throw new Error('Error buscando productos');
      
      const data = await response.json();
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error buscando productos:', error);
      setSearchResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  // Debounce para la búsqueda
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  const handleSearchChange = (value) => {
    setProductSearch(value);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const timeout = setTimeout(() => {
      searchProducts(value);
    }, 500);
    
    setSearchTimeout(timeout);
  };

  const addProduct = (product) => {
    // Normalizar el producto para guardar solo lo necesario
    const normalizedProduct = {
      id: product.id,
      name: product.name?.es || product.name,
      price: product.variants?.[0]?.price || product.price || 0,
      image: product.images?.[0]?.src || null
    };
    
    if (!selectedProducts.find(p => p.id === normalizedProduct.id)) {
      setSelectedProducts([...selectedProducts, normalizedProduct]);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  const removeProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      const data = await apiRequest(`/api/tiendanube/categories?storeId=${storeId}`);
      setCategories(data || []);
    } catch (error) {
      console.error('Error cargando categorías:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const toggleCategory = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  const handleSave = async () => {
    if (!badgeName.trim()) {
      alert('Por favor ingresa un nombre para el badge');
      return;
    }
    if (!badgeText.trim()) {
      alert('Por favor ingresa el texto del badge');
      return;
    }

    // Validate rule-specific
    if (ruleType === 'manual' && selectedProducts.length === 0) {
      alert('Por favor selecciona al menos un producto');
      return;
    }
    if (ruleType === 'category' && selectedCategories.length === 0) {
      alert('Por favor selecciona al menos una categoría');
      return;
    }

    setSaving(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      
      const ruleConfig = {};
      if (ruleType === 'new_products') {
        ruleConfig.daysToShowAsNew = parseInt(daysToShowAsNew);
      } else if (ruleType === 'manual') {
        ruleConfig.productIds = selectedProducts.map(p => p.id);
      } else if (ruleType === 'price_range') {
        if (minPrice) ruleConfig.minPrice = parseFloat(minPrice);
        if (maxPrice) ruleConfig.maxPrice = parseFloat(maxPrice);
      } else if (ruleType === 'discount') {
        ruleConfig.minDiscount = parseFloat(minDiscount);
      } else if (ruleType === 'stock') {
        ruleConfig.maxStock = parseInt(maxStock);
      } else if (ruleType === 'category') {
        ruleConfig.categoryIds = selectedCategories;
      }
      
      const badgeData = {
        storeId,
        badgeName,
        badgeText,
        ruleType,
        ruleConfig,
        isActive,
        startDate: hasStartDate ? startDate : null,
        endDate: hasEndDate ? endDate : null,
        design: {
          shape,
          position,
          backgroundColor,
          textColor,
          fontSize,
          fontWeight,
          textTransform,
          animation,
          borderRadius,
          showIcon,
          icon
        }
      };
      
      if (badgeId) {
        await apiRequest(`/api/badges/${badgeId}`, {
          method: 'PUT',
          body: JSON.stringify(badgeData)
        });
        alert('Badge actualizado correctamente');
      } else {
        await apiRequest('/api/badges', {
          method: 'POST',
          body: JSON.stringify(badgeData)
        });
        alert('Badge creado correctamente');
      }
      
      navigate('/badges');
    } catch (error) {
      console.error('Error guardando badge:', error);
      alert('Error al guardar el badge: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const ruleInfo = ruleTypesInfo[ruleType];
  const RuleIcon = ruleInfo?.icon || Tag;

  if (loading) {
    return (
      <div className="badge-config-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="badge-config-page">
      {/* Header */}
      <header className="config-header">
        <button className="btn-back" onClick={() => navigate('/badges')}>
          <ArrowLeft size={20} />
          Volver a Badges
        </button>
        <div className="header-content">
          <div className="header-title">
            <div className="rule-badge" style={{ background: ruleInfo?.color }}>
              <span className="rule-emoji">{ruleInfo?.emoji}</span>
            </div>
            <div>
              <h1>{badgeId ? 'Editar' : 'Crear'} Badge - {ruleInfo?.title}</h1>
              <p>Configura las reglas y el diseño de tu badge personalizado</p>
            </div>
          </div>
        </div>
      </header>

      <div className="config-container">
        {/* Left Panel - Configuration */}
        <div className="config-panel">
          
          {/* General Section */}
          <section className="config-section">
            <div className="section-header">
              <Sparkles size={20} />
              <h2>Información General</h2>
            </div>
            
            <div className="form-group">
              <label>Nombre del Badge (interno)</label>
              <input
                type="text"
                value={badgeName}
                onChange={(e) => setBadgeName(e.target.value)}
                placeholder="Ej: Badge de productos nuevos"
                className="input-field"
              />
              <span className="input-hint">Este nombre solo lo verás tú en el panel</span>
            </div>

            <div className="form-group">
              <label>Texto del Badge</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="Ej: NUEVO"
                className="input-field"
                maxLength="20"
              />
              <span className="input-hint">Texto que verán tus clientes ({badgeText.length}/20)</span>
            </div>

            {/* Suggestions */}
            <div className="suggestions">
              <label className="suggestions-label">Sugerencias:</label>
              <div className="suggestions-chips">
                {suggestions[ruleType]?.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="suggestion-chip"
                    onClick={() => setBadgeText(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Date Range Section */}
          <section className="config-section">
            <div className="section-header">
              <Calendar size={20} />
              <h2>Vigencia</h2>
            </div>

            <div className="date-controls">
              <div className="date-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasStartDate}
                    onChange={(e) => setHasStartDate(e.target.checked)}
                  />
                  <span>Fecha de inicio</span>
                </label>
                {hasStartDate && (
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field"
                  />
                )}
              </div>

              <div className="date-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasEndDate}
                    onChange={(e) => setHasEndDate(e.target.checked)}
                  />
                  <span>Fecha de fin</span>
                </label>
                {hasEndDate && (
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field"
                  />
                )}
              </div>
            </div>

            {!hasStartDate && !hasEndDate && (
              <div className="info-box">
                <span>✓ Sin vencimiento - el badge estará siempre activo</span>
              </div>
            )}
          </section>

          {/* Rule Configuration */}
          <section className="config-section">
            <div className="section-header">
              <RuleIcon size={20} />
              <h2>Configuración de Regla</h2>
            </div>

            {ruleType === 'new_products' && (
              <div className="form-group">
                <label>Días para considerar "nuevo"</label>
                <input
                  type="number"
                  value={daysToShowAsNew}
                  onChange={(e) => setDaysToShowAsNew(e.target.value)}
                  min="1"
                  max="90"
                  className="input-field"
                />
                <span className="input-hint">Productos creados en los últimos {daysToShowAsNew} días</span>
              </div>
            )}

            {ruleType === 'manual' && (
              <div className="products-selector">
                <label>Buscar productos</label>
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Buscar por nombre o SKU..."
                    className="search-input"
                  />
                  {searchingProducts && <div className="mini-spinner"></div>}
                </div>

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map(product => (
                      <div key={product.id} className="search-result-item" onClick={() => addProduct(product)}>
                        {product.images && product.images.length > 0 && (
                          <img src={product.images[0]?.src || 'https://via.placeholder.com/48'} alt={product.name?.es || product.name} />
                        )}
                        {(!product.images || product.images.length === 0) && (
                          <div style={{ width: 48, height: 48, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                        )}
                        <div>
                          <div className="product-name">{product.name?.es || product.name}</div>
                          <div className="product-price">${product.variants?.[0]?.price || product.price || '0'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedProducts.length > 0 && (
                  <div className="selected-products">
                    <label>Productos seleccionados ({selectedProducts.length})</label>
                    <div className="selected-list">
                      {selectedProducts.map(product => (
                        <div key={product.id} className="selected-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {product.image && (
                              <img src={product.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                            )}
                            <span>{product.name}</span>
                          </div>
                          <button onClick={() => removeProduct(product.id)}>
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {ruleType === 'price_range' && (
              <div className="price-range-config">
                <div className="form-group">
                  <label>Precio mínimo ($)</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Precio máximo ($)</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="99999"
                    className="input-field"
                  />
                </div>
                <span className="input-hint">
                  {minPrice && maxPrice ? `Productos entre $${minPrice} y $${maxPrice}` :
                   minPrice ? `Productos desde $${minPrice}` :
                   maxPrice ? `Productos hasta $${maxPrice}` :
                   'Configura el rango de precios'}
                </span>
              </div>
            )}

            {ruleType === 'discount' && (
              <div className="form-group">
                <label>Descuento mínimo (%)</label>
                <div className="slider-group">
                  <input
                    type="range"
                    value={minDiscount}
                    onChange={(e) => setMinDiscount(e.target.value)}
                    min="5"
                    max="90"
                    step="5"
                    className="range-slider"
                  />
                  <span className="slider-value">{minDiscount}%</span>
                </div>
                <span className="input-hint">Productos con descuento del {minDiscount}% o más</span>
              </div>
            )}

            {ruleType === 'stock' && (
              <div className="form-group">
                <label>Stock máximo (últimas unidades)</label>
                <input
                  type="number"
                  value={maxStock}
                  onChange={(e) => setMaxStock(e.target.value)}
                  min="1"
                  max="20"
                  className="input-field"
                />
                <span className="input-hint">Productos con {maxStock} unidades o menos en stock</span>
              </div>
            )}

            {ruleType === 'category' && (
              <div className="categories-selector">
                <label>Selecciona categorías</label>
                {loadingCategories ? (
                  <div className="mini-spinner"></div>
                ) : categories.length === 0 ? (
                  <button onClick={loadCategories} className="btn-load">Cargar categorías</button>
                ) : (
                  <div className="categories-list">
                    {categories.map(cat => (
                      <label key={cat.id} className="checkbox-label category-item">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Design Section */}
          <section className="config-section">
            <div className="section-header">
              <Sparkles size={20} />
              <h2>Diseño y Estilo</h2>
            </div>

            {/* Position */}
            <div className="form-group">
              <label>Posición del Badge</label>
              <div className="position-grid">
                {['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].map(pos => (
                  <button
                    key={pos}
                    className={`position-btn ${position === pos ? 'active' : ''}`}
                    onClick={() => setPosition(pos)}
                    title={pos.replace(/-/g, ' ')}
                  >
                    <div className={`position-indicator ${pos}`}></div>
                  </button>
                ))}
              </div>
            </div>

            {/* Shape */}
            <div className="form-group">
              <label>Forma</label>
              <div className="shape-buttons">
                <button
                  className={`shape-btn ${shape === 'rectangle' ? 'active' : ''}`}
                  onClick={() => setShape('rectangle')}
                >
                  <Square size={20} />
                  <span>Rectángulo</span>
                </button>
                <button
                  className={`shape-btn ${shape === 'rounded' ? 'active' : ''}`}
                  onClick={() => setShape('rounded')}
                >
                  <Maximize2 size={20} />
                  <span>Redondeado</span>
                </button>
                <button
                  className={`shape-btn ${shape === 'circle' ? 'active' : ''}`}
                  onClick={() => setShape('circle')}
                >
                  <Circle size={20} />
                  <span>Círculo</span>
                </button>
              </div>
            </div>

            {/* Colors */}
            <div className="colors-row">
              <div className="form-group">
                <label>Color de fondo</label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="color-picker"
                />
              </div>
              <div className="form-group">
                <label>Color de texto</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="color-picker"
                />
              </div>
            </div>

            {/* Text Format */}
            <div className="form-group">
              <label>Formato de texto</label>
              <div className="text-format-buttons">
                <button
                  className={`format-btn ${textTransform === 'uppercase' ? 'active' : ''}`}
                  onClick={() => setTextTransform('uppercase')}
                  title="Mayúsculas"
                >
                  A↑
                </button>
                <button
                  className={`format-btn ${textTransform === 'lowercase' ? 'active' : ''}`}
                  onClick={() => setTextTransform('lowercase')}
                  title="Minúsculas"
                >
                  A↓
                </button>
                <button
                  className={`format-btn ${textTransform === 'capitalize' ? 'active' : ''}`}
                  onClick={() => setTextTransform('capitalize')}
                  title="Capitalizar"
                >
                  Aa
                </button>
                <button
                  className={`format-btn ${fontWeight === 'bold' ? 'active' : ''}`}
                  onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                  title="Negrita"
                >
                  <strong>B</strong>
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="form-group">
              <label>Tamaño de fuente</label>
              <div className="slider-group">
                <input
                  type="range"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  min="8"
                  max="24"
                  className="range-slider"
                />
                <span className="slider-value">{fontSize}px</span>
              </div>
            </div>

            {/* Animation */}
            <div className="form-group">
              <label>Animación</label>
              <select
                value={animation}
                onChange={(e) => setAnimation(e.target.value)}
                className="select-field"
              >
                <option value="none">Sin animación</option>
                <option value="pulse">Pulso</option>
                <option value="bounce">Rebote</option>
                <option value="shake">Vibración</option>
                <option value="glow">Brillo</option>
              </select>
            </div>

            {/* Icon */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showIcon}
                  onChange={(e) => setShowIcon(e.target.checked)}
                />
                <span>Incluir emoji/icono</span>
              </label>
              {showIcon && (
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="input-field"
                  placeholder="⭐"
                  maxLength="2"
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>
          </section>
        </div>

        {/* Right Panel - Preview */}
        <div className="preview-panel">
          <div className="preview-sticky">
            <div className="section-header">
              <Eye size={20} />
              <h2>Vista Previa</h2>
            </div>
            
            <div className="preview-container">
              <div className="product-mockup">
                <img src="https://via.placeholder.com/300x300?text=Producto" alt="Preview" />
                <div 
                  className={`badge-preview ${position} ${animation}`}
                  style={{
                    backgroundColor,
                    color: textColor,
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    textTransform,
                    borderRadius: shape === 'circle' ? '50%' : 
                                 shape === 'rounded' ? '12px' : 
                                 `${borderRadius}px`,
                    padding: shape === 'circle' ? '12px' : '6px 14px'
                  }}
                >
                  {showIcon && <span style={{ marginRight: '4px' }}>{icon}</span>}
                  {badgeText || 'TEXTO'}
                </div>
              </div>
            </div>

            <div className="preview-info">
              <div className="info-item">
                <span className="info-label">Regla:</span>
                <span className="info-value">{ruleInfo?.title}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Posición:</span>
                <span className="info-value">{position.replace(/-/g, ' ')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Estado:</span>
                <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <footer className="config-footer">
        <button className="btn-cancel" onClick={() => navigate('/badges')}>
          Cancelar
        </button>
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Guardando...' : badgeId ? 'Actualizar Badge' : 'Crear Badge'}
        </button>
      </footer>
    </div>
  );
}

export default BadgeConfig;
