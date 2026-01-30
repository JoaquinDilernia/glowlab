# 🎯 Implementación de Tope de Reintegro - Solución Completa

## 📋 Resumen

El tope de reintegro NO se puede implementar nativamente con la API de TiendaNube, pero podemos hacerlo mediante **script personalizado en el checkout**.

---

## ✅ Solución Implementada

### 1. Backend: Endpoint para Cupones con Tope

**Endpoint**: `GET /api/coupons/with-cap?storeId=XXXXX`

Retorna solo cupones activos que tienen `maxDiscount` configurado:

```json
{
  "success": true,
  "coupons": [
    {
      "code": "SOOFF",
      "type": "percentage",
      "value": 50,
      "maxDiscount": 100000,
      "minAmount": 0
    }
  ],
  "total": 1
}
```

### 2. Frontend: Script de Checkout

Archivo: `checkout-script-dinamico.js`

**Funcionalidad**:
- Consulta cupones con tope desde PromoNube API
- Monitorea cuando se aplica un cupón en el checkout
- Calcula si se excede el tope
- Muestra mensaje visual al usuario

---

## 📝 Pasos para Activar en TiendaNube

### Paso 1: Acceder al Editor de Código

```
Panel Admin → Diseño → Editar código → checkout.liquid
```

O directamente:
```
https://www.tiendanube.com/admin/themes/current/edit
```

### Paso 2: Agregar el Script

Buscar la etiqueta `</body>` al final del archivo y **ANTES** de ella, pegar:

```html
<script>
// 🎯 PromoNube - Script de Tope de Descuento
(async function() {
  const PROMONUBE_API = 'https://apipromonube-jlfopowzaq-uc.a.run.app';
  const STORE_ID = '{{ store.id }}';
  
  async function obtenerCuponesConTope() {
    try {
      const response = await fetch(`${PROMONUBE_API}/api/coupons/with-cap?storeId=${STORE_ID}`);
      const data = await response.json();
      return data.coupons || [];
    } catch (error) {
      console.error('PromoNube - Error:', error);
      return [];
    }
  }

  function aplicarTope(cupon, total) {
    if (!cupon.maxDiscount || cupon.type !== 'percentage') return null;
    
    const descuentoCalculado = (total * cupon.value) / 100;
    const descuentoFinal = Math.min(descuentoCalculado, cupon.maxDiscount);
    
    return {
      original: descuentoCalculado,
      conTope: descuentoFinal,
      seAplicoTope: descuentoCalculado > cupon.maxDiscount,
      ahorro: descuentoFinal
    };
  }

  function mostrarMensajeTope(cupon, resultado, total) {
    const existente = document.querySelector('.promonube-tope-mensaje');
    if (existente) existente.remove();

    const mensaje = document.createElement('div');
    mensaje.className = 'promonube-tope-mensaje';
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
          ${cupon.value}% de $${total.toLocaleString()} = $${Math.round(resultado.original).toLocaleString()}<br>
          Descuento máximo: <strong>$${cupon.maxDiscount.toLocaleString()}</strong>
        </small>
      `;
    } else {
      mensaje.innerHTML = `
        <strong>✅ Cupón ${cupon.code} aplicado</strong><br>
        <small>Descuento: $${Math.round(resultado.ahorro).toLocaleString()} (${cupon.value}%)</small>
      `;
    }

    const summary = document.querySelector('.order-summary') || 
                   document.querySelector('.checkout-summary') ||
                   document.querySelector('.totals');
    if (summary) {
      summary.insertAdjacentElement('afterbegin', mensaje);
    }
  }

  async function monitoreoCupon() {
    const cupones = await obtenerCuponesConTope();
    if (cupones.length === 0) return;

    // Buscar cupón aplicado
    const discountElement = document.querySelector('[data-discount-code]') ||
                           document.querySelector('.discount-code') ||
                           document.querySelector('[class*="discount"]');
    
    if (!discountElement) return;

    const codigo = (discountElement.dataset.discountCode || 
                   discountElement.textContent || '').trim().toUpperCase();
    
    const cupon = cupones.find(c => c.code === codigo);
    if (!cupon) return;

    // Obtener total
    const totalElement = document.querySelector('[data-order-total]') ||
                        document.querySelector('.total-price') ||
                        document.querySelector('[class*="total"]');
    
    if (!totalElement) return;

    const totalText = totalElement.textContent || 
                     totalElement.dataset.orderTotal || 
                     '0';
    const total = parseFloat(totalText.replace(/[^0-9.]/g, ''));

    const resultado = aplicarTope(cupon, total);
    if (resultado) {
      mostrarMensajeTope(cupon, resultado, total);
    }
  }

  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitoreoCupon);
  } else {
    monitoreoCupon();
  }

  // Observar cambios en el DOM
  const observer = new MutationObserver(monitoreoCupon);
  const container = document.querySelector('#checkout') || document.body;
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true
  });

})();
</script>
```

### Paso 3: Guardar y Probar

1. Click en **"Guardar cambios"**
2. Ir al checkout de tu tienda
3. Aplicar un cupón con tope configurado
4. Verificar que aparezca el mensaje amarillo

---

## 🎨 Personalización

### Cambiar Colores del Mensaje

```css
/* Agregar en la sección <style> del checkout.liquid */
.promonube-tope-mensaje {
  background: #d1fae5 !important;  /* Verde */
  border-color: #a7f3d0 !important;
  color: #065f46 !important;
}
```

### Cambiar Posición del Mensaje

Modificar esta línea en el script:

```javascript
// Mostrar arriba del resumen
const summary = document.querySelector('.order-summary');
summary.insertAdjacentElement('afterbegin', mensaje);

// O mostrar antes del botón de pagar
const payButton = document.querySelector('.checkout-button');
payButton.insertAdjacentElement('beforebegin', mensaje);
```

---

## 🧪 Testing

### Test 1: Cupón SIN Tope
```
Cupón: VERANO20 (20% sin tope)
Compra: $100,000
Resultado: Descuento $20,000 ✅
Mensaje: "✅ Cupón VERANO20 aplicado"
```

### Test 2: Cupón CON Tope (no se alcanza)
```
Cupón: SOOFF (50% con tope $100,000)
Compra: $100,000
Descuento calculado: $50,000
Resultado: Descuento $50,000 ✅
Mensaje: "✅ Cupón SOOFF aplicado - Descuento: $50,000"
```

### Test 3: Cupón CON Tope (se excede)
```
Cupón: SOOFF (50% con tope $100,000)
Compra: $500,000
Descuento calculado: $250,000
Resultado: Descuento $100,000 (topado) ⚡
Mensaje: "⚡ Tope de descuento aplicado
50% de $500,000 = $250,000
Descuento máximo: $100,000"
```

---

## ⚠️ Limitaciones y Consideraciones

### 1. Visual vs. Funcional

**Importante**: Este script es **informativo**, NO modifica el descuento real aplicado por TiendaNube.

- ✅ Muestra al cliente que existe un tope
- ✅ Calcula y muestra el descuento correcto
- ❌ No puede modificar el checkout de TiendaNube

### 2. Alternativa: Crear Cupón Absoluto

Para que el tope se aplique funcionalmente:

```javascript
// En PromoNube, al crear cupón con tope:
Si tiene maxDiscount:
  - Crear en TiendaNube como: type="absolute", value=maxDiscount
  - Guardar en Firestore: type="percentage", value=X, maxDiscount=Y
  - Mostrar al usuario: "50% OFF hasta $100,000"
```

**Ventajas**:
- ✅ El tope se aplica realmente
- ✅ Cliente no puede exceder el límite

**Desventajas**:
- ❌ Pierde el beneficio del porcentaje en compras pequeñas
- ❌ Compra de $50,000 → Descuento $100,000 (gratis!)

### 3. Solución Híbrida (RECOMENDADA)

Calcular el **mínimo de compra** para que el tope tenga sentido:

```javascript
Si: 50% con tope $100,000
Entonces: Mínimo $200,000 (para que 50% = $100,000)

Cupón en TiendaNube:
- type: "absolute"
- value: 100000
- min_price: 200000
```

**Resultado**:
- Compra $150,000 → Cupón no aplica (< mínimo)
- Compra $200,000 → Descuento $100,000 (50%) ✅
- Compra $500,000 → Descuento $100,000 (tope) ✅

---

## 📊 Dashboard: Mostrar Advertencia

En `CreateCoupon.jsx` ya se muestra:

```javascript
{formData.maxDiscount && formData.value && (
  <div className="alert-info">
    💡 Sugerencia: Para que el descuento no supere ${formData.maxDiscount},
    establecé un mínimo de compra de ${Math.ceil((formData.maxDiscount * 100) / formData.value)}
  </div>
)}
```

Ejemplo:
```
Cupón: 50% con tope $100,000
Sugerencia: "Establecé un mínimo de compra de $200,000"
```

---

## 🚀 Próximos Pasos

1. **Deploy del backend** con nuevo endpoint
2. **Agregar script al checkout** de TiendaNube
3. **Probar con cupón real**
4. **Decidir estrategia**:
   - Opción A: Solo informativo (script actual)
   - Opción B: Cupón absoluto con mínimo calculado
   - Opción C: Híbrida (script + sugerencia de mínimo)

---

## 📝 Notas para el Usuario

Al crear un cupón con tope en PromoNube:

1. **Se guardará el tope** en la base de datos
2. **Se mostrará en el badge** del cupón (⚡ Tope $X)
3. **Se sugerirá un mínimo** para que tenga sentido
4. **El script del checkout** lo detectará automáticamente
5. **Se mostrará el mensaje** visual al cliente

**No requiere configuración manual** por cupón, el script consulta la API y obtiene todos los cupones con tope activos.

---

**Creado**: Diciembre 2024  
**Versión**: 1.0.0
