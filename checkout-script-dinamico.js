// 🎯 Script Inteligente para Checkout de TiendaNube
// Consulta cupones con tope desde PromoNube API
// Insertar en: Configuración → Diseño → Editar código → checkout.liquid

(async function() {
  const PROMONUBE_API = 'https://apipromonube-jlfopowzaq-uc.a.run.app';
  const STORE_ID = '{{ store.id }}'; // Variable de Liquid
  
  // Obtener cupones con tope desde PromoNube
  async function obtenerCuponesConTope() {
    try {
      const response = await fetch(`${PROMONUBE_API}/api/coupons/with-cap?storeId=${STORE_ID}`);
      const data = await response.json();
      return data.coupons || [];
    } catch (error) {
      console.error('PromoNube - Error obteniendo cupones:', error);
      return [];
    }
  }

  // Aplicar tope de descuento
  function aplicarTope(cupon, total) {
    if (!cupon.maxDiscount || cupon.type !== 'percentage') {
      return null; // No tiene tope o no es porcentual
    }

    const descuentoCalculado = (total * cupon.value) / 100;
    const descuentoFinal = Math.min(descuentoCalculado, cupon.maxDiscount);
    
    return {
      original: descuentoCalculado,
      conTope: descuentoFinal,
      seAplicoTope: descuentoCalculado > cupon.maxDiscount,
      ahorro: descuentoFinal
    };
  }

  // Mostrar mensaje de tope aplicado
  function mostrarMensajeTope(cupon, resultado, total) {
    const existente = document.querySelector('.promonube-tope-mensaje');
    if (existente) existente.remove();

    const mensaje = document.createElement('div');
    mensaje.className = 'alert alert-warning promonube-tope-mensaje';
    mensaje.style.cssText = `
      background: #fef3c7;
      border: 2px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 14px;
      color: #92400e;
    `;
    
    if (resultado.seAplicoTope) {
      mensaje.innerHTML = `
        <strong>⚡ Tope de descuento aplicado</strong><br>
        <small>
          ${cupon.value}% de $${total.toLocaleString()} = $${resultado.original.toLocaleString()}<br>
          Descuento máximo: <strong>$${cupon.maxDiscount.toLocaleString()}</strong>
        </small>
      `;
    } else {
      mensaje.innerHTML = `
        <strong>✅ Cupón ${cupon.code} aplicado</strong><br>
        <small>Descuento: $${resultado.ahorro.toLocaleString()} (${cupon.value}%)</small>
      `;
    }

    const checkoutSummary = document.querySelector('.checkout-summary') || 
                           document.querySelector('.order-summary');
    if (checkoutSummary) {
      checkoutSummary.insertAdjacentElement('afterbegin', mensaje);
    }
  }

  // Monitorear cupón aplicado
  async function monitoreoCupon() {
    const cupones = await obtenerCuponesConTope();
    if (cupones.length === 0) return;

    const cuponAplicado = document.querySelector('[data-discount-code]');
    if (!cuponAplicado) return;

    const codigo = cuponAplicado.dataset.discountCode || 
                   cuponAplicado.textContent.trim();
    
    const cupon = cupones.find(c => c.code === codigo.toUpperCase());
    if (!cupon || !cupon.maxDiscount) return;

    // Obtener total del carrito
    const totalElement = document.querySelector('[data-order-total]') ||
                        document.querySelector('.total-price');
    if (!totalElement) return;

    const total = parseFloat(
      totalElement.textContent.replace(/[^0-9.]/g, '') ||
      totalElement.dataset.orderTotal ||
      '0'
    );

    const resultado = aplicarTope(cupon, total);
    if (resultado) {
      mostrarMensajeTope(cupon, resultado, total);
      
      // Log para debugging
      console.log('PromoNube - Tope procesado:', {
        cupon: codigo,
        total: total,
        resultado: resultado
      });
    }
  }

  // Inicializar cuando cargue el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitoreoCupon);
  } else {
    monitoreoCupon();
  }

  // Re-ejecutar cuando cambie el cupón (para checkout dinámicos)
  const observer = new MutationObserver(monitoreoCupon);
  const checkoutContainer = document.querySelector('.checkout-container') ||
                           document.querySelector('#checkout') ||
                           document.body;
  
  observer.observe(checkoutContainer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-discount-code']
  });

})();
