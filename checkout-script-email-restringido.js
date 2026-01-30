// 🔐 Script para Cupones con Email Restringido
// Insertar en checkout.liquid de TiendaNube

(async function() {
  const PROMONUBE_API = 'https://apipromonube-jlfopowzaq-uc.a.run.app';
  const STORE_ID = '{{ store.id }}';
  
  // Obtener cupones con email restringido
  async function obtenerCuponesRestringidos() {
    try {
      const response = await fetch(`${PROMONUBE_API}/api/coupons/restricted?storeId=${STORE_ID}`);
      const data = await response.json();
      return data.coupons || [];
    } catch (error) {
      console.error('PromoNube - Error:', error);
      return [];
    }
  }

  // Obtener email del cliente
  function obtenerEmailCliente() {
    // Email del campo de checkout
    const emailInput = document.querySelector('input[type="email"]') ||
                      document.querySelector('[name="email"]') ||
                      document.querySelector('#email');
    
    if (emailInput) {
      return emailInput.value.toLowerCase().trim();
    }

    // Si ya está logueado (Liquid variable)
    const customerEmail = '{{ customer.email }}';
    if (customerEmail && customerEmail !== '') {
      return customerEmail.toLowerCase().trim();
    }

    return null;
  }

  // Validar cupón restringido
  async function validarCuponRestringido() {
    const cupones = await obtenerCuponesRestringidos();
    if (cupones.length === 0) return;

    // Buscar cupón aplicado
    const discountElement = document.querySelector('[data-discount-code]') ||
                           document.querySelector('.discount-code');
    
    if (!discountElement) return;

    const codigoCupon = (discountElement.dataset.discountCode || 
                        discountElement.textContent || '').trim().toUpperCase();
    
    const cupon = cupones.find(c => c.code === codigoCupon);
    if (!cupon) return; // No es un cupón restringido

    const emailCliente = obtenerEmailCliente();
    
    if (!emailCliente) {
      mostrarAlerta('error', '⚠️ Por favor ingresá tu email para validar el cupón');
      return;
    }

    const emailRestringido = cupon.restrictedEmail.toLowerCase().trim();
    
    if (emailCliente !== emailRestringido) {
      // Email no coincide - cupón no autorizado
      mostrarAlerta('error', `❌ Este cupón es exclusivo para ${cupon.restrictedEmail}`);
      
      // Intentar remover el cupón (si TiendaNube lo permite)
      removerCupon();
      
      console.log('PromoNube - Cupón bloqueado:', {
        cupon: codigoCupon,
        emailIntento: emailCliente,
        emailAutorizado: emailRestringido
      });
    } else {
      // Email correcto - cupón autorizado
      mostrarAlerta('success', `✅ Cupón ${codigoCupon} validado para tu email`);
      
      console.log('PromoNube - Cupón autorizado:', {
        cupon: codigoCupon,
        email: emailCliente
      });
    }
  }

  // Mostrar alerta visual
  function mostrarAlerta(tipo, mensaje) {
    const existente = document.querySelector('.promonube-email-alerta');
    if (existente) existente.remove();

    const alerta = document.createElement('div');
    alerta.className = 'promonube-email-alerta';
    
    const colores = {
      error: { bg: '#fee2e2', border: '#fecaca', text: '#991b1b' },
      success: { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46' }
    };
    
    const color = colores[tipo] || colores.error;
    
    alerta.style.cssText = `
      background: ${color.bg};
      border: 2px solid ${color.border};
      border-radius: 8px;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 14px;
      color: ${color.text};
      font-weight: 600;
    `;
    
    alerta.innerHTML = mensaje;

    const summary = document.querySelector('.order-summary') || 
                   document.querySelector('.checkout-summary') ||
                   document.querySelector('.discount-form');
    
    if (summary) {
      summary.insertAdjacentElement('afterend', alerta);
    }
  }

  // Intentar remover cupón (puede no funcionar en todos los checkouts)
  function removerCupon() {
    const removeButton = document.querySelector('[data-discount-remove]') ||
                        document.querySelector('.discount-remove') ||
                        document.querySelector('[class*="remove"]');
    
    if (removeButton) {
      removeButton.click();
    }
  }

  // Monitorear cambios en el email
  function monitorearEmail() {
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput) {
      emailInput.addEventListener('blur', validarCuponRestringido);
      emailInput.addEventListener('change', validarCuponRestringido);
    }
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      validarCuponRestringido();
      monitorearEmail();
    });
  } else {
    validarCuponRestringido();
    monitorearEmail();
  }

  // Observar cambios
  const observer = new MutationObserver(validarCuponRestringido);
  const container = document.querySelector('#checkout') || document.body;
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-discount-code']
  });

})();
