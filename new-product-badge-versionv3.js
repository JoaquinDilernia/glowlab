// 🏷️ PromoNube New Product Badge - Badge de Productos Nuevos
// Version: 2.0.0
// Última actualización: Enero 13, 2026
// Cambios v2.0: Obtiene fechas de productos desde API de TiendaNube

(function() {
  'use strict';

  // URL de la API
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

  // Prevenir múltiples inicializaciones
  if (window.promonubeNewBadgeLoaded) return;
  window.promonubeNewBadgeLoaded = true;

  console.log('🏷️ PromoNube New Badge Script cargado - Store:', STORE_ID);

  let BADGE_CONFIG = null;

  // Función para cargar la configuración desde la API
  async function loadConfig() {
    if (!STORE_ID) {
      console.warn('⚠️ No se pudo determinar el storeId');
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/new-badge-config/${STORE_ID}`);
      const data = await response.json();
      
      if (data.success && data.config) {
        return data.config;
      }
      return null;
    } catch (error) {
      console.error('Error cargando configuración del badge:', error);
      return null;
    }
  }

  // Función para calcular si un producto es "nuevo"
  function isProductNew(createdAtString) {
    if (!createdAtString || !BADGE_CONFIG) return false;
    
    const createdAt = new Date(createdAtString);
    const now = new Date();
    const daysDiff = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    
    return daysDiff <= BADGE_CONFIG.daysToShowAsNew;
  }

  // Función para crear el badge
  function createBadge() {
    const badge = document.createElement('div');
    badge.className = 'pn-new-product-badge';
    badge.textContent = BADGE_CONFIG.badgeText || 'NUEVO';
    
    // Posiciones
    const positions = {
      'top-left': 'top: 10px; left: 10px;',
      'top-right': 'top: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;'
    };

    // Formas
    let shapeStyles = '';
    switch(BADGE_CONFIG.badgeShape) {
      case 'circular':
        shapeStyles = 'border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; padding: 0;';
        break;
      case 'ribbon':
        shapeStyles = `
          border-radius: 0;
          padding: 8px 16px;
          position: relative;
          ${BADGE_CONFIG.badgePosition.includes('right') ? 'padding-right: 20px;' : 'padding-left: 20px;'}
        `;
        break;
      case 'rounded':
        shapeStyles = 'border-radius: 20px;';
        break;
      default:
        shapeStyles = `border-radius: ${BADGE_CONFIG.borderRadius || '4px'};`;
    }

    badge.style.cssText = `
      position: absolute !important;
      ${positions[BADGE_CONFIG.badgePosition] || positions['top-left']}
      background: ${BADGE_CONFIG.backgroundColor || '#ff4757'} !important;
      color: ${BADGE_CONFIG.textColor || '#ffffff'} !important;
      font-size: ${BADGE_CONFIG.fontSize || '12px'} !important;
      font-weight: ${BADGE_CONFIG.fontWeight || '700'} !important;
      padding: ${BADGE_CONFIG.padding || '6px 12px'} !important;
      ${shapeStyles}
      z-index: 999999 !important;
      pointer-events: none !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      letter-spacing: 0.5px !important;
      text-transform: uppercase !important;
      animation: pnBadgeFadeIn 0.3s ease-out !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      ${BADGE_CONFIG.customCSS || ''}
    `;

    // Añadir pseudo-elemento para ribbon si aplica
    if (BADGE_CONFIG.badgeShape === 'ribbon') {
      const style = document.getElementById('pn-badge-ribbon-style') || document.createElement('style');
      if (!document.getElementById('pn-badge-ribbon-style')) {
        style.id = 'pn-badge-ribbon-style';
        style.textContent = `
          .pn-new-product-badge.ribbon::after {
            content: '';
            position: absolute;
            ${BADGE_CONFIG.badgePosition.includes('right') ? 'right: 0;' : 'left: 0;'}
            bottom: -6px;
            width: 0;
            height: 0;
            border-style: solid;
            border-width: 6px 6px 0 0;
            border-color: ${BADGE_CONFIG.backgroundColor}44 transparent transparent transparent;
          }
        `;
        document.head.appendChild(style);
      }
      badge.classList.add('ribbon');
    }

    return badge;
  }

  // Variable global para almacenar fechas de productos
  let productDatesMap = {};

  // Función para obtener fechas de productos desde la API
  async function loadProductDates() {
    if (!STORE_ID) {
      console.warn('⚠️ No se pudo determinar el storeId');
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/product-dates/${STORE_ID}`);
      const data = await response.json();
      
      if (data.success && data.productDates) {
        productDatesMap = data.productDates;
        console.log(`🏷️ PromoNube: ${Object.keys(productDatesMap).length} fechas de productos cargadas`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cargando fechas de productos:', error);
      return false;
    }
  }

  // Función para agregar badge a un producto
  function addBadgeToProduct(productElement, createdAt) {
    if (!isProductNew(createdAt)) return;
    
    // Verificar que no tenga ya un badge
    if (productElement.querySelector('.pn-new-product-badge')) return;

    // Estrategia 1: Buscar contenedor de imagen específico
    let imageContainer = productElement.querySelector('.product-image, .item-image, .product__media, .product-img, .item-img, figure');
    
    // Estrategia 2: Buscar cualquier imagen y tomar su contenedor padre
    if (!imageContainer) {
      const img = productElement.querySelector('img');
      if (img) {
        imageContainer = img.closest('div, a, figure') || img.parentElement;
      }
    }
    
    // Estrategia 3: Buscar el primer link o div con imagen dentro
    if (!imageContainer) {
      imageContainer = productElement.querySelector('a[href*="/products/"], a[href*="/producto/"]') || 
                      productElement.querySelector('div');
    }
    
    if (!imageContainer) {
      return;
    }

    // Asegurar que el contenedor tenga posición relativa y overflow visible
    const currentPosition = window.getComputedStyle(imageContainer).position;
    if (currentPosition === 'static') {
      imageContainer.style.position = 'relative';
    }
    imageContainer.style.overflow = 'visible';

    const badge = createBadge();
    
    // Asegurar z-index alto
    badge.style.zIndex = '999999';
    badge.style.pointerEvents = 'none'; // No interferir con clicks
    
    imageContainer.appendChild(badge);
  }

  // Función para procesar productos en TiendaNube
  function processProducts() {
    if (!BADGE_CONFIG || !BADGE_CONFIG.enabled) return;

    // Selectores comunes para productos en TiendaNube
    const productSelectors = [
      '[itemtype="http://schema.org/Product"]',
      '[itemtype="https://schema.org/Product"]',
      '.product-item',
      '.item-product',
      '.product',
      '[data-product-id]',
      '.js-item-product',
      '.js-product-container',
      'article.product',
      '.product-card'
    ];

    let productsFound = 0;
    const processedElements = new Set();

    productSelectors.forEach(selector => {
      const products = document.querySelectorAll(selector);
      
      products.forEach(product => {
        // Evitar procesar el mismo elemento dos veces
        if (processedElements.has(product)) return;
        
        // Intentar obtener el product_id del elemento
        let productId = product.getAttribute('data-product-id') || 
                       product.getAttribute('data-id') ||
                       product.getAttribute('data-product') ||
                       product.querySelector('[data-product-id]')?.getAttribute('data-product-id');
        
        // Si no está en data attributes, buscar en el link del producto
        if (!productId) {
          const productLink = product.querySelector('a[href*="/products/"], a[href*="/producto/"]');
          if (productLink) {
            const match = productLink.href.match(/\/products?\/(\d+)/);
            if (match) productId = match[1];
          }
        }

        // Buscar por href en schema.org
        if (!productId) {
          const schemaUrl = product.querySelector('[itemprop="url"]')?.getAttribute('href');
          if (schemaUrl) {
            const match = schemaUrl.match(/\/products?\/(\d+)/);
            if (match) productId = match[1];
          }
        }

        // Buscar en clases o IDs del elemento
        if (!productId) {
          const classMatch = product.className.match(/product[_-](\d+)/i);
          if (classMatch) productId = classMatch[1];
        }

        if (productId && productDatesMap[productId]) {
          addBadgeToProduct(product, productDatesMap[productId]);
          processedElements.add(product);
          productsFound++;
        }
      });
    });

    if (productsFound > 0) {
      console.log(`✅ PromoNube: ${productsFound} badges agregados`);
    }
  }

  // Inyectar estilos CSS
  function injectStyles() {
    if (document.getElementById('pn-new-badge-styles')) return;

    const style = document.createElement('style');
    style.id = 'pn-new-badge-styles';
    style.textContent = `
      @keyframes pnBadgeFadeIn {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Observar cambios en el DOM para productos cargados dinámicamente
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
        }
      });
      if (shouldProcess) {
        setTimeout(processProducts, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Inicializar cuando el DOM esté listo
  async function init() {
    // Cargar configuración
    BADGE_CONFIG = await loadConfig();
    
    if (!BADGE_CONFIG) {
      console.log('⚠️ No hay configuración de badge disponible');
      return;
    }

    if (!BADGE_CONFIG.enabled) {
      console.log('ℹ️ Badge de productos nuevos desactivado');
      return;
    }

    console.log('✅ Badge configurado:', BADGE_CONFIG);
    
    injectStyles();
    
    // Cargar fechas de productos primero
    const datesLoaded = await loadProductDates();
    
    if (datesLoaded) {
      processProducts();
      observeDOM();

      // Re-procesar después de 1 segundo por si hay lazy loading
      setTimeout(processProducts, 1000);
    } else {
      console.warn('⚠️ PromoNube: No se pudieron cargar las fechas de productos');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
