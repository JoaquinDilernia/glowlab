import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../config';
import './BadgeConfig.css';

function BadgeConfig() {
  const { badgeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // General config
  const [badgeName, setBadgeName] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [ruleType, setRuleType] = useState('new_products');
  const [isActive, setIsActive] = useState(true);
  
  // Rule-specific config
  const [daysToShowAsNew, setDaysToShowAsNew] = useState(7);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minDiscount, setMinDiscount] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  // Design config
  const [shape, setShape] = useState('rectangle');
  const [position, setPosition] = useState('top-right');
  const [backgroundColor, setBackgroundColor] = useState('#FF6B6B');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState('bold');
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

  useEffect(() => {
    if (badgeId) {
      loadBadgeConfig();
    }
  }, [badgeId]);

  const loadBadgeConfig = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      
      const data = await apiRequest(
        `/api/badges/${badgeId}?storeId=${storeId}`
      );
      
      // General
      setBadgeName(data.badgeName || '');
      setBadgeText(data.badgeText || '');
      setRuleType(data.ruleType || 'new_products');
      setIsActive(data.isActive ?? true);
      
      // Rules
      if (data.ruleConfig) {
        setDaysToShowAsNew(data.ruleConfig.daysToShowAsNew || 7);
        setSelectedProducts(data.ruleConfig.productIds || []);
        setMinPrice(data.ruleConfig.minPrice || '');
        setMaxPrice(data.ruleConfig.maxPrice || '');
        setMinDiscount(data.ruleConfig.minDiscount || '');
        setMaxStock(data.ruleConfig.maxStock || '');
        setSelectedCategories(data.ruleConfig.categoryIds || []);
      }
      
      // Design
      if (data.design) {
        setShape(data.design.shape || 'rectangle');
        setPosition(data.design.position || 'top-right');
        setBackgroundColor(data.design.backgroundColor || '#FF6B6B');
        setTextColor(data.design.textColor || '#FFFFFF');
        setFontSize(data.design.fontSize || 12);
        setFontWeight(data.design.fontWeight || 'bold');
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

  const searchProducts = async () => {
    if (!productSearch.trim()) return;
    
    setSearchingProducts(true);
    try {
      const storeId = localStorage.getItem('promonube_store_id');
      
      const data = await apiRequest(
        `/api/tiendanube/products/search?storeId=${storeId}&q=${encodeURIComponent(productSearch)}`
      );
      
      setSearchResults(data);
    } catch (error) {
      console.error('Error buscando productos:', error);
      alert('Error al buscar productos');
    } finally {
      setSearchingProducts(false);
    }
  };

  const addProduct = (product) => {
    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
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
      
      const data = await apiRequest(
        `/api/tiendanube/categories?storeId=${storeId}`
      );
      
      setCategories(data);
    } catch (error) {
      console.error('Error cargando categorías:', error);
      alert('Error al cargar las categorías');
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
      alert('Por favor ingresa el texto que se mostrará en el badge');
      return;
    }
    
    // Validate rule-specific fields
    if (ruleType === 'manual' && selectedProducts.length === 0) {
      alert('Por favor selecciona al menos un producto');
      return;
    }
    
    if (ruleType === 'price_min' && !minPrice) {
      alert('Por favor ingresa el precio mínimo');
      return;
    }
    
    if (ruleType === 'price_max' && !maxPrice) {
      alert('Por favor ingresa el precio máximo');
      return;
    }
    
    if (ruleType === 'discount' && !minDiscount) {
      alert('Por favor ingresa el descuento mínimo');
      return;
    }
    
    if (ruleType === 'stock_low' && !maxStock) {
      alert('Por favor ingresa el stock máximo');
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
      } else if (ruleType === 'price_min') {
        ruleConfig.minPrice = parseFloat(minPrice);
      } else if (ruleType === 'price_max') {
        ruleConfig.maxPrice = parseFloat(maxPrice);
      } else if (ruleType === 'discount') {
        ruleConfig.minDiscount = parseFloat(minDiscount);
      } else if (ruleType === 'stock_low') {
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
        design: {
          shape,
          position,
          backgroundColor,
          textColor,
          fontSize,
          fontWeight,
          animation,
          borderRadius,
          showIcon,
          icon,
        }
      };
      
      if (badgeId) {
        // Update existing
        await apiRequest(
          `/api/badges/${badgeId}`,
          {
            method: 'PUT',
            body: JSON.stringify(badgeData)
          }
        );
        alert('Badge actualizado correctamente');
      } else {
        // Create new
        await apiRequest(
          '/api/badges',
          {
            method: 'POST',
            body: JSON.stringify(badgeData)
          }
        );
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

  const renderRuleConfig = () => {
    switch (ruleType) {
      case 'new_products':
        return (
          <div className="rule-config-section">
            <h3>⏰ Configuración: Productos Nuevos</h3>
            <p className="rule-description">
              Se mostrará el badge en productos creados hace menos de X días
            </p>
            
            <div className="form-group">
              <label>Días para mostrar como "nuevo"</label>
              <input
                type="number"
                min="1"
                max="365"
                value={daysToShowAsNew}
                onChange={(e) => setDaysToShowAsNew(e.target.value)}
                className="input-field"
              />
              <small>Productos creados en los últimos {daysToShowAsNew} días mostrarán este badge</small>
            </div>
          </div>
        );
      
      case 'manual':
        return (
          <div className="rule-config-section">
            <h3>✋ Configuración: Selección Manual</h3>
            <p className="rule-description">
              Selecciona manualmente los productos que tendrán este badge
            </p>
            
            <div className="form-group">
              <label>Buscar y agregar productos</label>
              <div className="product-search-box">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                  placeholder="Buscar por nombre..."
                  className="input-field"
                />
                <button
                  onClick={searchProducts}
                  disabled={searchingProducts}
                  className="btn-search"
                >
                  {searchingProducts ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(product => (
                    <div key={product.id} className="search-result-item">
                      <div className="product-info">
                        {product.images?.[0] && (
                          <img src={product.images[0].src} alt={product.name.es} />
                        )}
                        <span>{product.name.es}</span>
                      </div>
                      <button
                        onClick={() => addProduct(product)}
                        className="btn-add-product"
                        disabled={selectedProducts.find(p => p.id === product.id)}
                      >
                        {selectedProducts.find(p => p.id === product.id) ? 'Agregado' : 'Agregar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedProducts.length > 0 && (
                <div className="selected-products">
                  <h4>Productos seleccionados ({selectedProducts.length})</h4>
                  <div className="selected-products-list">
                    {selectedProducts.map(product => (
                      <div key={product.id} className="selected-product-item">
                        {product.images?.[0] && (
                          <img src={product.images[0].src} alt={product.name.es} />
                        )}
                        <span>{product.name.es}</span>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="btn-remove-product"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'price_min':
        return (
          <div className="rule-config-section">
            <h3>💰 Configuración: Precio Mínimo</h3>
            <p className="rule-description">
              Se mostrará el badge en productos con precio igual o mayor al especificado
            </p>
            
            <div className="form-group">
              <label>Precio mínimo ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="input-field"
                placeholder="Ej: 10000"
              />
              <small>Productos con precio ≥ ${minPrice || '0'}</small>
            </div>
          </div>
        );
      
      case 'price_max':
        return (
          <div className="rule-config-section">
            <h3>💰 Configuración: Precio Máximo</h3>
            <p className="rule-description">
              Se mostrará el badge en productos con precio igual o menor al especificado
            </p>
            
            <div className="form-group">
              <label>Precio máximo ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="input-field"
                placeholder="Ej: 5000"
              />
              <small>Productos con precio ≤ ${maxPrice || '0'}</small>
            </div>
          </div>
        );
      
      case 'discount':
        return (
          <div className="rule-config-section">
            <h3>📉 Configuración: Descuento Mínimo</h3>
            <p className="rule-description">
              Se mostrará el badge en productos con descuento igual o mayor al especificado
            </p>
            
            <div className="form-group">
              <label>Descuento mínimo (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={minDiscount}
                onChange={(e) => setMinDiscount(e.target.value)}
                className="input-field"
                placeholder="Ej: 20"
              />
              <small>Productos con descuento ≥ {minDiscount || '0'}%</small>
            </div>
          </div>
        );
      
      case 'stock_low':
        return (
          <div className="rule-config-section">
            <h3>📦 Configuración: Stock Bajo</h3>
            <p className="rule-description">
              Se mostrará el badge en productos con stock igual o menor al especificado
            </p>
            
            <div className="form-group">
              <label>Stock máximo</label>
              <input
                type="number"
                min="0"
                value={maxStock}
                onChange={(e) => setMaxStock(e.target.value)}
                className="input-field"
                placeholder="Ej: 5"
              />
              <small>Productos con stock ≤ {maxStock || '0'} unidades</small>
            </div>
          </div>
        );
      
      case 'category':
        return (
          <div className="rule-config-section">
            <h3>📂 Configuración: Por Categoría</h3>
            <p className="rule-description">
              Se mostrará el badge en productos de las categorías seleccionadas
            </p>
            
            <div className="form-group">
              <label>Categorías</label>
              {categories.length === 0 && (
                <button
                  onClick={loadCategories}
                  disabled={loadingCategories}
                  className="btn-load-categories"
                >
                  {loadingCategories ? 'Cargando...' : 'Cargar Categorías'}
                </button>
              )}
              
              {categories.length > 0 && (
                <div className="categories-list">
                  {categories.map(category => (
                    <label key={category.id} className="category-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                      />
                      <span>{category.name.es}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {selectedCategories.length > 0 && (
                <small>{selectedCategories.length} categoría(s) seleccionada(s)</small>
              )}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="badge-config-container">
        <div className="loading-state">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="badge-config-container">
      <div className="badge-config-header">
        <button onClick={() => navigate('/badges')} className="btn-back">
          ← Volver
        </button>
        <h1>{badgeId ? 'Editar Badge' : 'Nuevo Badge'}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-save-header"
        >
          {saving ? 'Guardando...' : 'Guardar Badge'}
        </button>
      </div>

      <div className="config-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}
        >
          Diseño
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'general' && (
          <div className="general-tab">
            <div className="form-group">
              <label>Nombre del Badge (interno)</label>
              <input
                type="text"
                value={badgeName}
                onChange={(e) => setBadgeName(e.target.value)}
                className="input-field"
                placeholder="Ej: Badge de Ofertas"
              />
              <small>Este nombre es solo para identificar el badge en tu panel</small>
            </div>

            <div className="form-group">
              <label>Texto del Badge (visible)</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="input-field"
                placeholder="Ej: ¡OFERTA!"
              />
              <small>Este texto se mostrará en los productos</small>
            </div>

            <div className="form-group">
              <label>Tipo de Regla</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="select-field"
              >
                <option value="new_products">🆕 Productos Nuevos</option>
                <option value="manual">✋ Selección Manual</option>
                <option value="price_min">💰 Precio Mínimo</option>
                <option value="price_max">💰 Precio Máximo</option>
                <option value="discount">📉 Descuento Mínimo</option>
                <option value="stock_low">📦 Stock Bajo</option>
                <option value="category">📂 Por Categoría</option>
              </select>
            </div>

            {renderRuleConfig()}

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Badge activo</span>
              </label>
              <small>Desactiva el badge para ocultarlo sin eliminarlo</small>
            </div>
          </div>
        )}

        {activeTab === 'design' && (
          <div className="design-tab">
            <div className="design-preview">
              <h3>Vista Previa</h3>
              <div className="preview-product" style={{position: 'relative', display: 'inline-block', width: '300px', height: '300px'}}>
                <div
                  className={`badge-preview badge-${shape} badge-${position} badge-animation-${animation}`}
                  style={{
                    position: 'absolute',
                    backgroundColor,
                    color: textColor,
                    fontSize: `${fontSize}px`,
                    fontWeight,
                    padding: '8px 12px',
                    borderRadius: shape === 'circle' ? '50%' : `${borderRadius}px`,
                    zIndex: 10,
                    ...(position === 'top-left' && { top: '10px', left: '10px' }),
                    ...(position === 'top-right' && { top: '10px', right: '10px' }),
                    ...(position === 'bottom-left' && { bottom: '10px', left: '10px' }),
                    ...(position === 'bottom-right' && { bottom: '10px', right: '10px' })
                  }}
                >
                  {showIcon && <span className="badge-icon">{icon}</span>}
                  {badgeText || 'BADGE'}
                </div>
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop"
                  alt="Producto de ejemplo"
                  className="preview-product-image"
                  style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px'}}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23ddd" width="300" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="16"%3EProducto de ejemplo%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            </div>

            <div className="design-controls">
              <div className="form-group">
                <label>Forma</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="rectangle"
                      checked={shape === 'rectangle'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Rectángulo
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="rounded"
                      checked={shape === 'rounded'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Redondeado
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="circle"
                      checked={shape === 'circle'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Círculo
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="flag"
                      checked={shape === 'flag'}
                      onChange={(e) => setShape(e.target.value)}
                    />
                    Bandera
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Posición</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="top-left"
                      checked={position === 'top-left'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Arriba Izquierda
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="top-right"
                      checked={position === 'top-right'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Arriba Derecha
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="bottom-left"
                      checked={position === 'bottom-left'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Abajo Izquierda
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="bottom-right"
                      checked={position === 'bottom-right'}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                    Abajo Derecha
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Color de Fondo</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="color-text"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Color de Texto</label>
                <div className="color-picker-group">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="color-text"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tamaño de Fuente ({fontSize}px)</label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="range-slider"
                />
              </div>

              <div className="form-group">
                <label>Peso de Fuente</label>
                <select
                  value={fontWeight}
                  onChange={(e) => setFontWeight(e.target.value)}
                  className="select-field"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Negrita</option>
                  <option value="bolder">Extra Negrita</option>
                </select>
              </div>

              {shape !== 'circle' && (
                <div className="form-group">
                  <label>Radio del Borde ({borderRadius}px)</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value)}
                    className="range-slider"
                  />
                </div>
              )}

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

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showIcon}
                    onChange={(e) => setShowIcon(e.target.checked)}
                  />
                  <span>Mostrar icono</span>
                </label>
              </div>

              {showIcon && (
                <div className="form-group">
                  <label>Icono (emoji)</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="input-field"
                    placeholder="⭐"
                    maxLength="2"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="config-footer">
        <button
          onClick={() => navigate('/badges')}
          className="btn-cancel"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-save"
        >
          {saving ? 'Guardando...' : 'Guardar Badge'}
        </button>
      </div>
    </div>
  );
}

export default BadgeConfig;
