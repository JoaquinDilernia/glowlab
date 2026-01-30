// Script para inyectar en TiendaNube Checkout
// Ubicación: Configuración → Diseño → Editar código → checkout.liquid

(function() {
  // Configuración de cupones con tope
  const CUPONES_CON_TOPE = {
    'SOOFF': { tope: 100000, porcentaje: 50 },
    // Agregar más cupones aquí
  };

  function aplicarTopeDescuento() {
    const couponInput = document.querySelector('[name="discount"]');
    if (!couponInput) return;

    const couponCode = couponInput.value.toUpperCase();
    const config = CUPONES_CON_TOPE[couponCode];
    
    if (!config) return; // No tiene tope configurado

    // Obtener total del carrito
    const totalElement = document.querySelector('.total-price');
    if (!totalElement) return;
    
    const total = parseFloat(totalElement.textContent.replace(/[^0-9.]/g, ''));
    const descuentoCalculado = (total * config.porcentaje) / 100;
    const descuentoFinal = Math.min(descuentoCalculado, config.tope);

    // Mostrar mensaje si se aplicó el tope
    if (descuentoCalculado > config.tope) {
      const mensaje = document.createElement('div');
      mensaje.className = 'alert alert-info';
      mensaje.innerHTML = `
        ⚡ Se aplicó el tope de descuento de $${config.tope.toLocaleString()}
        (${config.porcentaje}% de $${total.toLocaleString()} = $${descuentoCalculado.toLocaleString()})
      `;
      
      const checkoutForm = document.querySelector('.checkout-form');
      if (checkoutForm) {
        checkoutForm.insertBefore(mensaje, checkoutForm.firstChild);
      }
    }

    console.log('PromoNube - Tope aplicado:', {
      cupon: couponCode,
      total: total,
      descuentoCalculado: descuentoCalculado,
      tope: config.tope,
      descuentoFinal: descuentoFinal
    });
  }

  // Ejecutar cuando cambie el cupón
  document.addEventListener('DOMContentLoaded', function() {
    const couponForm = document.querySelector('.discount-form');
    if (couponForm) {
      couponForm.addEventListener('submit', function(e) {
        setTimeout(aplicarTopeDescuento, 500);
      });
    }
  });
})();
