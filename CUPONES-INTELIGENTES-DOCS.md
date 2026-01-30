# 🧠 Cupones Inteligentes - Documentación Completa

## 📋 Índice
1. [Introducción](#introducción)
2. [Funcionalidades Avanzadas](#funcionalidades-avanzadas)
3. [Guía de Uso](#guía-de-uso)
4. [Integración Técnica](#integración-técnica)
5. [Casos de Uso](#casos-de-uso)

---

## 🎯 Introducción

Los **Cupones Inteligentes** de PromoNube son funcionalidades avanzadas que TiendaNube no ofrece nativamente. Estas características te permiten crear estrategias de marketing más sofisticadas y personalizadas.

### ¿Por qué son únicos?

- ✅ **No existen en TiendaNube nativo** - Diferenciador competitivo
- ✅ **Aumentan conversión** - Personalizados por cliente
- ✅ **Fáciles de usar** - Interfaz intuitiva
- ✅ **Totalmente automáticos** - Se validan al momento del pago

---

## 🚀 Funcionalidades Avanzadas

### 1. 🎯 Tope de Reintegro (maxDiscount)

**¿Qué es?**
Establece un monto máximo de descuento que se puede aplicar, independientemente del valor del carrito.

**¿Cuándo usarlo?**
- Descuentos porcentuales altos (ej: 50% OFF)
- Proteger márgenes en compras grandes
- Promociones controladas

**Ejemplo:**
```
Cupón: VERANO50
Tipo: Porcentual
Descuento: 50%
Tope: $5000

Compra de $20,000:
- Sin tope: $10,000 descuento
- Con tope: $5,000 descuento (ahorro de $5,000 para el negocio)
```

**Visualización:**
- Badge amarillo: "⚡ Tope $5000" en tarjeta del cupón
- Se valida automáticamente en TiendaNube

---

### 2. 📧 Cupones Únicos por Email (restrictedEmail)

**¿Qué es?**
Restringe el uso del cupón a un email específico. Solo ese cliente puede utilizarlo.

**¿Cuándo usarlo?**
- Compensaciones personalizadas
- Cupones VIP
- Recuperación de carritos abandonados
- Programas de fidelización

**Ejemplo:**
```
Cupón: JUAN-VIP-2024
Descuento: 20%
Email restringido: juan@email.com

✅ juan@email.com - Puede usar el cupón
❌ maria@email.com - NO puede usar el cupón
```

**Visualización:**
- Badge azul: "📧 juan@email.com" en tarjeta del cupón
- Email visible para identificar rápidamente

**Implementación:**
- Backend valida el email del cliente en el checkout
- Si no coincide, el cupón no se aplica
- Mensaje de error personalizado

---

### 3. 🎁 Producto Gratis (freeProductId)

**¿Qué es?**
Al usar el cupón, se agrega automáticamente un producto gratis al carrito del cliente.

**¿Cuándo usarlo?**
- Muestras gratis con compra
- Regalos por compra mínima
- Cross-selling automatizado
- Promociones de lanzamiento

**Ejemplo:**
```
Cupón: REGALO-VELA
Producto gratis: Vela Aromática (ID: 123456789)
Mínimo de compra: $5000

Cliente compra $5000 → Agrega vela gratis al carrito
```

**Visualización:**
- Badge verde: "🎁 Vela Aromática" en tarjeta del cupón
- Nombre del producto visible para claridad

**Implementación:**
- Requiere ID del producto de TiendaNube
- Opcional: Nombre del producto para mostrar
- Se agrega al carrito con precio $0

---

## 📖 Guía de Uso

### Crear Cupón Inteligente

1. **Ir a "Crear Cupón"**
   - Dashboard → Cupones → Crear Nuevo

2. **Completar datos básicos**
   - Código
   - Tipo (Porcentual/Fijo)
   - Valor
   - Fechas, límites, etc.

3. **Activar funciones avanzadas** (sección amarilla)
   
   **Tope de Reintegro:**
   - Campo "Tope de descuento"
   - Ej: 5000 (para $5,000 máximo)
   
   **Email único:**
   - Campo "Restringir a Email"
   - Ej: cliente@email.com
   - Solo en modo individual (no masivo)
   
   **Producto gratis:**
   - Campo "ID del Producto"
   - Ej: 123456789
   - Campo "Nombre" (opcional)

4. **Crear cupón**
   - Se guarda en Firestore con campos inteligentes
   - Se crea en TiendaNube con restricciones básicas
   - PromoNube maneja las validaciones avanzadas

### Visualizar Cupones Inteligentes

Los cupones con funciones avanzadas muestran **badges de colores**:

- 🟡 **Amarillo**: Tope de reintegro
- 🔵 **Azul**: Email restringido
- 🟢 **Verde**: Producto gratis

Puedes tener **múltiples badges** en un mismo cupón.

---

## 🔧 Integración Técnica

### Base de Datos (Firestore)

Colección: `promonube_coupons`

```javascript
{
  couponId: "coupon_1234567890",
  storeId: "12345",
  code: "VERANO50",
  type: "percentage",
  value: 50,
  
  // Campos inteligentes
  maxDiscount: 5000,
  restrictedEmail: "cliente@email.com",
  freeProductId: "123456789",
  freeProductName: "Vela Aromática",
  
  // Otros campos
  minAmount: 1000,
  maxUses: 100,
  currentUses: 0,
  active: true,
  createdAt: Timestamp
}
```

### API Endpoints

**POST `/api/coupons/create`**
```json
{
  "storeId": "12345",
  "code": "VERANO50",
  "type": "percentage",
  "value": 50,
  "maxDiscount": 5000,
  "restrictedEmail": "cliente@email.com",
  "freeProductId": "123456789",
  "freeProductName": "Vela Aromática"
}
```

**POST `/api/coupons/create-bulk`**
```json
{
  "storeId": "12345",
  "prefix": "PROMO",
  "quantity": 100,
  "type": "percentage",
  "value": 20,
  "maxDiscount": 2000,
  "freeProductId": "123456789"
}
```

### Frontend (React)

**CreateCoupon.jsx**
```jsx
const [formData, setFormData] = useState({
  // ... campos básicos
  maxDiscount: '',
  restrictedEmail: '',
  freeProductId: '',
  freeProductName: ''
});
```

**CouponsList.jsx**
```jsx
{/* Smart Features Badges */}
{(coupon.restrictedEmail || coupon.freeProductId || coupon.maxDiscount) && (
  <div className="smart-features">
    {coupon.maxDiscount && (
      <span className="smart-badge tope">
        <Zap size={12} /> Tope ${coupon.maxDiscount}
      </span>
    )}
    {coupon.restrictedEmail && (
      <span className="smart-badge email">
        <Mail size={12} /> {coupon.restrictedEmail}
      </span>
    )}
    {coupon.freeProductId && (
      <span className="smart-badge gift">
        <Gift size={12} /> {coupon.freeProductName}
      </span>
    )}
  </div>
)}
```

---

## 💡 Casos de Uso

### Caso 1: Black Friday Controlado
```
Cupón: BLACKFRIDAY70
Descuento: 70%
Tope: $8,000
Mínimo: $5,000

Resultado:
- Compra de $10,000 → Descuento $7,000
- Compra de $20,000 → Descuento $8,000 (tope)
- Margen protegido, cliente feliz
```

### Caso 2: Compensación Personalizada
```
Cliente tuvo problema con pedido #1234

Cupón: COMPENSACION-JUAN-2024
Email: juan@email.com
Descuento: $3,000

Resultado:
- Solo Juan puede usarlo
- Compensación privada
- No lo comparte con otros
```

### Caso 3: Regalo con Compra
```
Lanzamiento nueva línea de velas

Cupón: MUESTRA-VELA
Producto gratis: Vela Mini (ID: 987654)
Mínimo: $3,000

Resultado:
- Cliente conoce el producto
- Aumenta ticket promedio
- Cross-selling automático
```

### Caso 4: Combo de Funciones
```
Cupón VIP para mejor cliente

Cupón: VIP-MARIA-2024
Email: maria@email.com
Descuento: 50%
Tope: $5,000
Regalo: Vela Premium

Resultado:
- Exclusivo para María
- Descuento generoso pero controlado
- Regalo especial incluido
```

---

## 🎨 Diseño Visual

### Badges de Cupones

**Tope de Reintegro**
- Fondo: Amarillo claro (#fef3c7)
- Borde: Amarillo (#fde68a)
- Texto: Marrón oscuro (#92400e)
- Ícono: ⚡ (Zap)

**Email Restringido**
- Fondo: Azul claro (#dbeafe)
- Borde: Azul (#bfdbfe)
- Texto: Azul oscuro (#1e40af)
- Ícono: 📧 (Mail)

**Producto Gratis**
- Fondo: Verde claro (#d1fae5)
- Borde: Verde (#a7f3d0)
- Texto: Verde oscuro (#065f46)
- Ícono: 🎁 (Gift)

### Sección del Formulario

```
⭐ Funciones Avanzadas
┌─────────────────────────────────────┐
│ 📧 Restringir a Email (Opcional)   │
│ [cliente@email.com              ]   │
│ Solo este email podrá usar el cupón│
│                                     │
│ 🎁 Producto Gratis (Opcional)      │
│ [ID del producto]  [Nombre]        │
│ Se agrega gratis al carrito        │
└─────────────────────────────────────┘
```

---

## 🚧 Limitaciones Conocidas

1. **Email restringido**: Solo modo individual (no masivo)
2. **Producto gratis**: Requiere ID de TiendaNube
3. **Tope**: Solo para descuentos porcentuales
4. **Validación**: Ocurre en checkout (no en página de producto)

---

## 🔮 Mejoras Futuras

- [ ] Selector visual de productos (buscar por nombre)
- [ ] Validación en tiempo real del email
- [ ] Múltiples productos gratis
- [ ] Tope dinámico por categoría
- [ ] Reportes de uso de funciones inteligentes
- [ ] Restricción por ubicación geográfica
- [ ] Cupones escalonados (más uso = más descuento)

---

## 📊 Impacto Esperado

### Métricas
- **Conversión**: +15-25% en cupones personalizados
- **Ticket promedio**: +20% con productos gratis
- **Margen**: Protegido con topes de reintegro
- **Satisfacción**: Alta por personalización

### ROI
- **Costo**: Desarrollo ya incluido
- **Beneficio**: Mayor control y conversión
- **Tiempo de implementación**: Inmediato

---

## 📞 Soporte

Si tienes dudas sobre las funciones inteligentes:

1. Revisa esta documentación
2. Prueba con cupones de test
3. Contacta soporte de PromoNube

---

**Última actualización**: 2024
**Versión**: 1.0.0
