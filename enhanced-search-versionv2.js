// 🔍 PromoNube Enhanced Search - Script de Buscador Mejorado
// Version: 1.1.0
// Última actualización: Enero 13, 2026
// Cambios v1.1: Corrección en detección de storeId (usa window.LS.store.id)

(function() {
  'use strict';
  
  console.log('🔍 PromoNube Enhanced Search cargando...');
  
  // CONFIGURACIÓN - Se carga desde Firestore
  const API_URL = 'https://apipromonube-jlfopowzaq-uc.a.run.app';
  
  // Detectar storeId automáticamente
  let STORE_ID = null;
  
  // 1. Intentar obtener del objeto window.LS (más confiable)
  if (typeof window.LS !== 'undefined' && window.LS.store) {
    STORE_ID = window.LS.store.id || window.LS.store.storeId;
  }
  
  // 2. Intentar obtener de meta tags
  if (!STORE_ID) {
    const storeIdMeta = document.querySelector('meta[name="store-id"]');
    if (storeIdMeta) {
      STORE_ID = storeIdMeta.getAttribute('content');
    }
  }
  
  // 3. Intentar obtener desde el HTML de TiendaNube (data attributes)
  if (!STORE_ID) {
    const storeData = document.querySelector('[data-store-id]');
    if (storeData) {
      STORE_ID = storeData.getAttribute('data-store-id');
    }
  }
  
  if (!STORE_ID) {
    console.error('❌ PromoNube Enhanced Search: No se pudo detectar el storeId');
    return;
  }
  
  console.log('✅ PromoNube Enhanced Search: Store ID detectado:', STORE_ID);
  
  if (window.promonubeEnhancedSearchLoaded) {
    console.log('⚠️ PromoNube Enhanced Search: Ya está cargado');
    return;
  }
  window.promonubeEnhancedSearchLoaded = true;
  
  // Cargar configuración desde la API
  fetch(`${API_URL}/api/enhanced-search-config/${STORE_ID}`)
    .then(response => response.json())
    .then(data => {
      if (!data.success || !data.config) {
        console.log('⚠️ PromoNube Enhanced Search: No hay configuración');
        return;
      }
      
      const CONFIG = data.config;
      
      if (!CONFIG.enabled) {
        console.log('ℹ️ PromoNube Enhanced Search: Desactivado en configuración');
        return;
      }
      
      console.log('✅ PromoNube Enhanced Search: Configuración cargada', CONFIG);
      initEnhancedSearch(CONFIG);
    })
    .catch(error => {
      console.error('❌ PromoNube Enhanced Search: Error cargando configuración', error);
    });
  
  // Buscar el input de búsqueda de TiendaNube
  function findSearchInput() {
    const selectors = [
      'input[type="search"]',
      'input[name="q"]',
      'input[placeholder*="uscar"]',
      'input[placeholder*="earch"]',
      '.js-search-input',
      '.search-input',
      '#search-input',
      'input[aria-label*="uscar"]',
      'input[aria-label*="earch"]'
    ];
    
    for (const sel of selectors) {
      const input = document.querySelector(sel);
      if (input) {
        console.log('✅ Input de búsqueda encontrado:', sel);
        return input;
      }
    }
    return null;
  }
  
  // Crear dropdown de Popular Searches
  function createPopularDropdown(CONFIG) {
    const primaryColor = CONFIG.primaryColor || '#000000';
    const textColor = CONFIG.textColor || '#1a1a1a';
    const bgColor = CONFIG.backgroundColor || '#ffffff';
    
    const dropdown = document.createElement('div');
    dropdown.id = 'pn-search-dropdown';
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: linear-gradient(to bottom, ${bgColor} 0%, ${adjustColorBrightness(bgColor, -5)} 100%);
      border: 2px solid ${primaryColor};
      border-top: none;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      z-index: 99999;
      display: none;
      max-height: 450px;
      overflow-y: auto;
      margin-top: -2px;
    `;
    
    // Popular Searches header
    if (CONFIG.popularSearches && CONFIG.popularSearches.length > 0) {
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 20px 24px 14px 24px;
        font-weight: 800;
        font-size: 11px;
        color: ${primaryColor};
        text-transform: uppercase;
        letter-spacing: 1.2px;
        border-bottom: 2px solid ${primaryColor}20;
        background: linear-gradient(135deg, ${primaryColor}05 0%, ${primaryColor}10 100%);
      `;
      header.innerHTML = '🔥 <span style="margin-left: 6px;">Búsquedas Populares</span>';
      dropdown.appendChild(header);
      
      // Lista de búsquedas populares
      CONFIG.popularSearches.forEach(function(search) {
        if (!search.text || search.text.trim() === '') return;
        
        const item = document.createElement('a');
        item.href = search.link || `/search?q=${encodeURIComponent(search.text)}`;
        item.style.cssText = `
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
          color: ${textColor};
          text-decoration: none;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border-bottom: 1px solid ${adjustColorBrightness(bgColor, -10)};
          background: ${bgColor};
          position: relative;
          overflow: hidden;
        `;
        
        // Icono de búsqueda con círculo de fondo
        const iconWrapper = document.createElement('div');
        iconWrapper.style.cssText = `
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}25 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.25s;
        `;
        iconWrapper.innerHTML = '<span style="font-size: 18px;">🔍</span>';
        item.appendChild(iconWrapper);
        
        // Texto con flecha
        const textWrapper = document.createElement('div');
        textWrapper.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: space-between;';
        
        const text = document.createElement('span');
        text.textContent = search.text;
        text.style.cssText = `font-weight: 600; color: ${textColor};`;
        textWrapper.appendChild(text);
        
        const arrow = document.createElement('span');
        arrow.innerHTML = '→';
        arrow.style.cssText = `
          font-size: 20px;
          color: ${primaryColor};
          opacity: 0;
          transform: translateX(-10px);
          transition: all 0.25s;
        `;
        textWrapper.appendChild(arrow);
        
        item.appendChild(textWrapper);
        
        item.addEventListener('mouseenter', function() {
          item.style.background = `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}12 100%)`;
          item.style.paddingLeft = '28px';
          item.style.transform = 'scale(1.02)';
          iconWrapper.style.transform = 'rotate(15deg) scale(1.1)';
          iconWrapper.style.background = `linear-gradient(135deg, ${primaryColor}25 0%, ${primaryColor}35 100%)`;
          arrow.style.opacity = '1';
          arrow.style.transform = 'translateX(0)';
        });
        
        item.addEventListener('mouseleave', function() {
          item.style.background = bgColor;
          item.style.paddingLeft = '24px';
          item.style.transform = 'scale(1)';
          iconWrapper.style.transform = 'rotate(0) scale(1)';
          iconWrapper.style.background = `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}25 100%)`;
          arrow.style.opacity = '0';
          arrow.style.transform = 'translateX(-10px)';
        });
        
        dropdown.appendChild(item);
      });
    }
    
    return dropdown;
  }
  
  // Helper para ajustar brillo de color
  function adjustColorBrightness(hex, percent) {
    // Si no es un color hex válido, retornar el original
    if (!hex || !hex.match(/^#[0-9A-F]{6}$/i)) {
      return hex;
    }
    
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
    const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
    
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  
  // Inicializar Enhanced Search
  function initEnhancedSearch(CONFIG) {
    const searchInput = findSearchInput();
    
    if (!searchInput) {
      console.log('⚠️ PromoNube Enhanced Search: Input de búsqueda no encontrado');
      // Reintentar después de 1 segundo
      setTimeout(() => initEnhancedSearch(CONFIG), 1000);
      return;
    }
    
    console.log('✅ PromoNube Enhanced Search: Inicializando...');
    
    // Asegurar que el contenedor del input tenga position relative
    const container = searchInput.closest('form, .search-form, .search-container, .header-search') || searchInput.parentElement;
    const currentPosition = window.getComputedStyle(container).position;
    if (currentPosition === 'static') {
      container.style.position = 'relative';
    }
    
    // Crear y agregar dropdown
    const dropdown = createPopularDropdown(CONFIG);
    container.appendChild(dropdown);
    
    // Mejorar el input
    const primaryColor = CONFIG.primaryColor || '#000000';
    const originalBorder = searchInput.style.border;
    const originalBorderRadius = searchInput.style.borderRadius;
    
    searchInput.style.transition = 'all 0.3s ease';
    
    // Guardar estilos originales
    const originalStyles = {
      border: searchInput.style.border,
      borderRadius: searchInput.style.borderRadius,
      padding: searchInput.style.padding,
      fontSize: searchInput.style.fontSize
    };
    
    // Mostrar dropdown al hacer focus
    searchInput.addEventListener('focus', function() {
      dropdown.style.display = 'block';
      searchInput.style.borderColor = primaryColor;
      searchInput.style.borderWidth = '2px';
      searchInput.style.borderRadius = '12px 12px 0 0';
      searchInput.style.outline = 'none';
      searchInput.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
    });
    
    // Ocultar dropdown al hacer click fuera
    document.addEventListener('click', function(e) {
      if (!container.contains(e.target)) {
        dropdown.style.display = 'none';
        searchInput.style.borderRadius = originalBorderRadius || '12px';
        searchInput.style.boxShadow = 'none';
      }
    });
    
    // Ocultar dropdown al presionar ESC
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        searchInput.blur();
        searchInput.style.borderRadius = originalBorderRadius || '12px';
        searchInput.style.boxShadow = 'none';
      }
    });
    
    // Cerrar dropdown al seleccionar una opción
    dropdown.addEventListener('click', function() {
      dropdown.style.display = 'none';
      searchInput.style.borderRadius = originalBorderRadius || '12px';
      searchInput.style.boxShadow = 'none';
    });
    
    console.log('✅ PromoNube Enhanced Search: Inicializado correctamente');
  }
})();
