# 🔐 Email Restringido - Validación por Webhook

## 📋 Resumen

Los cupones con **email restringido** se validan automáticamente mediante el webhook de TiendaNube. Cuando un cliente usa un cupón que no le corresponde, el sistema lo detecta y registra como "uso no autorizado".

---

## 🎯 Cómo Funciona

### 1. Crear Cupón con Email Restringido

En PromoNube, al crear un cupón:

```javascript
{
  code: "VIP-JUAN",
  type: "percentage",
  value: 20,
  restrictedEmail: "juan@email.com"
}
```

### 2. Cliente Usa el Cupón

1. Cliente ingresa "VIP-JUAN" en el checkout
2. TiendaNube aplica el descuento (20% OFF)
3. Cliente completa la compra

### 3. Webhook Valida el Email

Cuando el pedido se marca como pagado:

```javascript
// TiendaNube envía webhook
POST /webhook/order-paid
{
  orderId: 12345,
  customer: {
    email: "maria@email.com"  // ← Email diferente!
  },
  coupon: {
    code: "VIP-JUAN"
  }
}

// PromoNube valida
if (customerEmail !== coupon.restrictedEmail) {
  // ❌ NO AUTORIZADO
  registrar({
    emailAutorizado: false,
    motivoRechazo: "Cupón exclusivo para juan@email.com. Usado por: maria@email.com",
    requiereRevision: true
  });
}
```

### 4. Dashboard Muestra Alerta

En el historial de uso del cupón:

```
┌─────────────────────────────────────────────────┐
│ Fecha    │ Pedido  │ Cliente          │ Estado │
├──────────┼─────────┼──────────────────┼────────┤
│ 12/11/24 │ #12345  │ maria@email.com  │ ❌ No  │
│          │         │                  │  autorizado
└─────────────────────────────────────────────────┘
                    ⚠️ Fila resaltada en amarillo
```

---

## ✅ Ventajas de Validación por Webhook

### 1. **Simple**
- No requiere modificar el checkout
- No necesita JavaScript personalizado
- Solo configurar el webhook una vez

### 2. **Automático**
- Todos los cupones se validan automáticamente
- No hay que configurar nada por cupón
- Funciona para cupones nuevos sin cambios

### 3. **Auditable**
- Registro completo de intentos no autorizados
- Historial de quién usó cada cupón
- Reportes de uso indebido

### 4. **Accionable**
- Se puede cancelar/modificar el pedido manualmente
- Se puede contactar al cliente
- Se puede bloquear emails abusivos

---

## ⚠️ Limitaciones

### 1. **Post-Facto (Después del Hecho)**

El cupón **ya se aplicó** cuando llega el webhook:

- ✅ Cliente obtuvo el descuento
- ❌ No podemos bloquearlo preventivamente
- ℹ️ Solo podemos detectarlo y actuar después

### 2. **Acción Manual Requerida**

Si detectás un uso no autorizado:

1. **Revisar el pedido** en TiendaNube Admin
2. **Contactar al cliente** (si es necesario)
3. **Modificar el pedido** (ajustar precio si corresponde)
4. **Cancelar/reembolsar** (en casos graves)

### 3. **No es Bloqueo Preventivo**

Para bloqueo preventivo necesitarías:
- Script en el checkout (más complejo)
- Plan TiendaNube Plus/Pro (para scripts avanzados)
- Validación en tiempo real

---

## 📊 Campos de Validación en Firestore

### Colección: `coupon_usage`

```javascript
{
  // Campos básicos
  couponId: "coupon_123",
  couponCode: "VIP-JUAN",
  orderId: "12345",
  customerEmail: "maria@email.com",
  discountAmount: 1000,
  
  // 🆕 Campos de validación
  emailAutorizado: false,
  motivoRechazo: "Cupón exclusivo para juan@email.com. Usado por: maria@email.com",
  requiereRevision: true,
  
  // Para cupones con tope
  topeExcedido: false,
  descuentoEsperado: null,
  
  usedAt: Timestamp
}
```

---

## 🎨 Visualización en Dashboard

### Modal de Historial

Columna nueva: **Estado**

**Estado: ✅ OK**
```
┌──────────────────────┐
│ ✅ OK               │  ← Badge verde
└──────────────────────┘
```

**Estado: ❌ No autorizado**
```
┌──────────────────────┐
│ ❌ No autorizado    │  ← Badge rojo
└──────────────────────┘
Hover: "Cupón exclusivo para juan@email.com. Usado por: maria@email.com"
```

**Estado: ⚠️ Tope excedido**
```
┌──────────────────────┐
│ ⚠️ Tope excedido    │  ← Badge amarillo
└──────────────────────┘
```

### Fila Resaltada

Usos con `requiereRevision: true` se resaltan en amarillo:

```css
.row-warning {
  background: #fef3c7;  /* Amarillo claro */
}
```

---

## 🔧 Configuración del Webhook

### Paso 1: Ir a TiendaNube Admin

```
Panel Admin → Configuración → API → Webhooks
```

O directo:
```
https://www.tiendanube.com/admin/webservices/webhooks
```

### Paso 2: Crear Webhook

- **Evento**: `order/paid` (Pedido Pagado)
- **URL**: `https://apipromonube-jlfopowzaq-uc.a.run.app/webhook/order-paid`
- **Activo**: ✅ Sí

### Paso 3: Guardar

El webhook ya está configurado y validará automáticamente todos los cupones.

---

## 🧪 Testing

### Test 1: Email Correcto ✅

```
Cupón: VIP-JUAN (email: juan@email.com)
Cliente: juan@email.com compra con el cupón

Resultado en webhook:
{
  emailAutorizado: true,
  motivoRechazo: null,
  requiereRevision: false
}

Dashboard: Badge verde "✅ OK"
```

### Test 2: Email Incorrecto ❌

```
Cupón: VIP-JUAN (email: juan@email.com)
Cliente: maria@email.com intenta usar el cupón

Resultado en webhook:
{
  emailAutorizado: false,
  motivoRechazo: "Cupón exclusivo para juan@email.com. Usado por: maria@email.com",
  requiereRevision: true
}

Dashboard:
- Badge rojo "❌ No autorizado"
- Fila amarilla (requiere revisión)
- Tooltip con el motivo
```

### Test 3: Sin Restricción ✅

```
Cupón: VERANO20 (sin email restringido)
Cliente: cualquier@email.com

Resultado:
{
  emailAutorizado: true,  // Por defecto si no hay restricción
  motivoRechazo: null,
  requiereRevision: false
}

Dashboard: Badge verde "✅ OK"
```

---

## 📈 Reportes y Acciones

### Dashboard: Filtro de Revisión Pendiente

Próxima mejora:

```javascript
// Filtrar cupones con usos no autorizados
const usosNoAutorizados = usageHistory.filter(u => !u.emailAutorizado);

// Mostrar alerta
if (usosNoAutorizados.length > 0) {
  <Alert type="warning">
    ⚠️ {usosNoAutorizados.length} usos no autorizados requieren revisión
  </Alert>
}
```

### Acciones Sugeridas

**Si detectás uso no autorizado:**

1. **Opción A: Ajustar manualmente**
   - Ir al pedido en TiendaNube
   - Editar el total (agregar el descuento indebido)
   - Cobrar la diferencia

2. **Opción B: Contactar al cliente**
   - Email explicando la situación
   - Solicitar pago de la diferencia
   - Ofrecer cupón correcto si corresponde

3. **Opción C: Permitir (caso por caso)**
   - Si es un error menor
   - Si el cliente es bueno
   - Marcar como revisado

4. **Opción D: Bloquear email**
   - Si hay abuso sistemático
   - Agregar a lista negra
   - Deshabilitar futuros cupones

---

## 🔮 Mejoras Futuras

### 1. Notificaciones Email
```javascript
if (!emailAutorizado) {
  enviarEmail({
    to: 'admin@tienda.com',
    subject: '⚠️ Cupón usado por email no autorizado',
    body: `El cupón ${couponCode} fue usado por ${customerEmail} pero es exclusivo para ${restrictedEmail}`
  });
}
```

### 2. Bloqueo Automático
```javascript
if (usos NoAutorizados > 3) {
  deshabilitarCupon(couponId);
}
```

### 3. Lista Negra
```javascript
const emailsAbusivos = ['spammer@email.com'];
if (emailsAbusivos.includes(customerEmail)) {
  bloquearCompra();
}
```

---

## 💡 Casos de Uso

### Caso 1: Compensación Personalizada

```
Cliente tuvo problema con pedido #1000

Solución:
- Crear cupón "COMPENSACION-JUAN-2024"
- Email restringido: juan@cliente.com
- Descuento: $5,000

Resultado:
- Solo Juan puede usarlo
- Si otro lo intenta → alerta en dashboard
- Cupón seguro y privado
```

### Caso 2: Programa VIP

```
Cliente VIP: maria@vip.com

Solución:
- Crear cupón "VIP-MARIA-DIC"
- Email restringido: maria@vip.com
- Descuento: 30%

Resultado:
- Cupón exclusivo mensual
- No se comparte con otros
- Tracking individual de uso
```

### Caso 3: Influencer/Embajador

```
Influencer: @juanperez

Solución:
- Crear cupón "JUAN20"
- Email restringido: juan@influencer.com
- Descuento: 20%

Resultado:
- Solo el influencer lo usa primero
- Se detecta si otros lo intentan antes
- Control de activación
```

---

## ✅ Resumen

**Email restringido por webhook:**

✅ **Simple** - Solo configurar webhook una vez  
✅ **Automático** - Valida todos los cupones  
✅ **Auditable** - Registro completo  
✅ **Sin código** - No requiere modificar checkout  

⚠️ **Post-facto** - Detecta después, no bloquea antes  
⚠️ **Manual** - Requiere acción humana si hay problema  

**Ideal para:**
- Compensaciones personalizadas
- Cupones VIP
- Programas de fidelización
- Cupones de influencers

**No ideal para:**
- Bloqueo preventivo estricto
- Seguridad crítica
- Casos donde el descuento no puede aplicarse bajo ninguna circunstancia

---

**Creado**: Diciembre 2024  
**Versión**: 1.0.0
