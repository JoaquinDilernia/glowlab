# 🎁 Gift Cards - Sistema Completo

## ✅ Solución al Problema del Monto

### 🔴 El Problema Original
Una marca crea una gift card de $100.000 pero ofrece 15% OFF en efectivo. El cliente paga $85.000 pero ¿debería recibir una gift de $100.000 o $85.000?

### ✅ La Solución Implementada
**La gift card vale lo que el cliente REALMENTE pagó**, no el precio del producto.

**Ventajas:**
- ✅ No hay confusión para el cliente
- ✅ No perdés plata como negocio
- ✅ Transparente y justo para ambas partes
- ✅ Se explica claramente en la descripción del producto

---

## 🚀 Cómo Funciona

### Paso 1: Crear Gift Card como Producto

**En PromoNube:**
1. Ir a "Gift Cards" → "Nueva Gift Card"
2. Configurar monto (ej: $100.000)
3. ✅ Marcar "Publicar como producto en mi tienda"
4. Crear

**Resultado:**
- Se crea automáticamente un producto en TiendaNube
- Precio: $100.000
- Descripción clara explicando el tema del monto
- Sin envío físico
- Categoría: Gift Cards

---

### Paso 2: Cliente Compra la Gift Card

**En TiendaNube:**
1. Cliente agrega gift card al carrito
2. Aplica descuento (15% efectivo, cupón, etc.)
3. Precio original: $100.000
4. Precio con descuento: $85.000
5. **Paga: $85.000** ✅

---

### Paso 3: Sistema Genera la Gift Card Automáticamente

**Webhook detecta la compra:**
```javascript
// Detecta producto "Gift Card" en la orden
// Calcula monto REAL pagado (con descuentos)
productPrice = $100.000
orderTotal = $85.000 (con 15% OFF)

// Prorrateo inteligente
giftCardAmount = productPrice * (orderTotal / orderSubtotal)
giftCardAmount = $85.000 ✅

// Genera código único
code = "GIFT-A1B2C3"
```

**Se guarda en Firestore:**
```javascript
{
  giftCardId: "gift_1234567890_order_123",
  code: "GIFT-A1B2C3",
  balance: 85000,
  initialAmount: 85000,
  originalProductPrice: 100000,
  actualAmountPaid: 85000,
  
  recipientEmail: "cliente@email.com",
  recipientName: "Juan Pérez",
  
  orderId: "123",
  orderNumber: "1001",
  productName: "Gift Card $100.000",
  
  status: "active",
  isProductBased: true,
  
  expiresAt: "2025-12-31",
  createdAt: Timestamp,
  sentAt: Timestamp
}
```

---

### Paso 4: Cliente Recibe Email con el Código

**Email automático incluye:**
- 🎁 Código de gift card: **GIFT-A1B2C3**
- 💰 Monto disponible: **$85.000**
- 📅 Vencimiento (si aplica)
- 📋 Instrucciones de uso
- 🔗 Link a la tienda

**Template del email:**
- Header atractivo con gradiente
- Código destacado en grande
- Instrucciones paso a paso
- Diseño responsive
- Footer con info de la tienda

---

### Paso 5: Cliente Usa la Gift Card

**En el checkout:**
1. Cliente ingresa el código **GIFT-A1B2C3**
2. Se valida contra Firestore
3. Se descuenta del total de la compra
4. Si sobra saldo, queda disponible para futuras compras

---

## 💡 Casos de Uso

### Caso 1: Gift Card con Descuento en Efectivo
```
Producto: Gift Card $100.000
Descuento: 15% efectivo
Cliente paga: $85.000
Gift generada: $85.000 ✅

✅ Cliente sabe que tiene $85.000 para gastar
✅ No hay confusión
✅ Negocio no pierde plata
```

### Caso 2: Gift Card sin Descuento
```
Producto: Gift Card $50.000
Sin descuentos
Cliente paga: $50.000
Gift generada: $50.000 ✅

✅ Funciona perfecto
```

### Caso 3: Gift Card con Cupón
```
Producto: Gift Card $100.000
Cupón: 20% OFF
Cliente paga: $80.000
Gift generada: $80.000 ✅

✅ El cupón se aplica, gift refleja el monto real
```

### Caso 4: Carrito con Múltiples Items
```
Items en carrito:
- Gift Card $100.000
- Remera $20.000

Subtotal: $120.000
Descuento general 10%: -$12.000
Total: $108.000

Prorrateo:
- Gift Card: $100.000 * (108.000 / 120.000) = $90.000
- Remera: $20.000 * (108.000 / 120.000) = $18.000

Gift generada: $90.000 ✅
```

---

## 📊 Estructura de Datos

### Collection: `promonube_giftcards`

```javascript
{
  // Identificación
  giftCardId: "gift_1234567890_order_123",
  code: "GIFT-A1B2C3",
  storeId: "12345",
  
  // Montos
  balance: 85000,              // Saldo actual
  initialAmount: 85000,        // Monto original
  originalProductPrice: 100000, // Precio del producto
  actualAmountPaid: 85000,     // Lo que realmente se pagó
  
  // Destinatario
  recipientEmail: "cliente@email.com",
  recipientName: "Juan Pérez",
  senderName: null,
  message: null,
  
  // Origen
  orderId: "123",
  orderNumber: "1001",
  productId: "456",
  productName: "Gift Card $100.000",
  isProductBased: true,
  
  // Estado
  status: "active", // active, partially_used, used, expired
  templateId: "auto-generated",
  
  // Fechas
  createdAt: Timestamp,
  expiresAt: Timestamp,
  sentAt: Timestamp,
  lastUsedAt: null,
  
  // Uso
  usageCount: 0
}
```

---

## 🎨 Comunicación Clara al Cliente

### En la Descripción del Producto (TiendaNube)

```
💡 IMPORTANTE SOBRE EL MONTO:
Si comprás esta Gift Card con algún descuento (15% en efectivo, 
promoción, etc.), el código que recibas tendrá el valor del monto 
que realmente pagaste, no el precio original del producto.

Ejemplo: Si esta Gift Card cuesta $100.000 pero pagás $85.000 
con un descuento, recibirás un código por $85.000 para usar en 
futuras compras.
```

### En el Panel de PromoNube

```
💡 Importante: Monto de la Gift Card

El valor de la gift card será el monto que el cliente REALMENTE 
pague, no el precio del producto.

Ejemplo: Si publicas una gift card de $100.000 pero el cliente 
paga con 15% de descuento en efectivo ($85.000), recibirá una 
gift card por $85.000.
```

### En el Email al Cliente

```
🎁 Tu Gift Card

Código: GIFT-A1B2C3
Monto: $85.000

Este monto corresponde al valor que pagaste por la Gift Card 
(después de descuentos aplicados).
```

---

## 🔧 Implementación Técnica

### Backend (Firebase Functions)

**1. Crear Producto en TiendaNube**
```javascript
POST /api/giftcards/create
{
  publishAsProduct: true,
  amount: 100000,
  productName: "Gift Card $100.000",
  expiresInDays: 365
}

→ Crea producto en TiendaNube
→ Guarda template en Firestore (para referencia)
```

**2. Webhook de Órdenes**
```javascript
POST /api/webhooks/order
(automático desde TiendaNube)

→ Detecta productos "Gift Card"
→ Calcula monto real con prorrateo
→ Genera código único
→ Guarda en Firestore
→ Envía email al cliente
```

### Frontend (React)

**1. CreateGiftCard.jsx**
- ✅ Checkbox "Publicar como producto"
- ✅ Info box explicando el monto
- ✅ Montos preset
- ✅ Personalización de descripción

**2. GiftCardsList.jsx**
- 📊 Stats de gift cards
- 📋 Lista con filtros
- 💰 Saldos y estados
- 📥 Export CSV

---

## 🚀 Para Implementar

### 1. Desplegar Backend
```bash
cd functions
firebase deploy --only functions
```

### 2. Verificar Webhook
El webhook de órdenes debe estar registrado (ya lo hiciste para cupones):
```bash
node register-webhook.js list
```

Si está el webhook `order/created`, ya funciona para gift cards también.

### 3. Crear Gift Card de Test
1. En PromoNube: Crear gift de $100.000 como producto
2. En TiendaNube: Hacer compra con descuento
3. Verificar que llega email con código correcto

---

## 📈 Métricas y Analytics

### Stats Disponibles (GiftCardsList)
- 💰 Saldo total disponible
- 💳 Total emitido
- 🎁 Total usado
- 👥 Cards activas

### Por Implementar
- [ ] Analytics por gift card individual
- [ ] Gráfico de ventas de gift cards
- [ ] Tasa de uso (cuántas se usan vs quedan sin usar)
- [ ] ROI de gift cards

---

## 💡 Alternativas Consideradas

### Opción 1: Monto Fijo (Implementada) ✅
- Gift = Lo que pagaste
- Sin confusión
- Transparente

### Opción 2: Monto con Bonus
- Gift = Lo que pagaste + bonus%
- Marketing positivo
- Más atractivo

**Ejemplo bonus 10%:**
```
Producto: $100.000
Cliente paga: $85.000 (con 15% OFF)
Gift: $85.000 + 10% = $93.500
```

Esto se puede implementar agregando un campo `bonusPercent` en el create.

---

## 🐛 Troubleshooting

### La gift card no se genera

1. Verificar que el webhook está registrado
2. Ver logs de Firebase:
```bash
firebase functions:log --only apipromonube
```
3. Verificar que el producto tiene "Gift Card" en el nombre

### El monto está mal

1. Verificar el cálculo del prorrateo en los logs
2. Revisar que `order.total` y `order.subtotal` llegan correctamente
3. Ver el documento en Firestore para debug

### El email no llega

1. Por ahora el email está mockeado (solo logs)
2. Implementar servicio real (SendGrid, Mailgun, etc.)
3. Verificar que `recipientEmail` existe en la orden

---

## 🎯 Próximos Pasos

### Fase 1: Básico (✅ Completado)
- [x] Crear gift cards como productos
- [x] Webhook detecta compras
- [x] Calcula monto real pagado
- [x] Genera código único
- [x] Template de email

### Fase 2: Email Real
- [ ] Integrar SendGrid o Mailgun
- [ ] Enviar emails automáticos
- [ ] Template personalizable por tienda
- [ ] Tracking de emails enviados

### Fase 3: Validación en Checkout
- [ ] Webhook de aplicación de cupón
- [ ] Validar código de gift card
- [ ] Descontar del saldo
- [ ] Actualizar estado en Firestore

### Fase 4: Analytics
- [ ] Dashboard de gift cards individual
- [ ] Tracking de uso
- [ ] Gráficos de conversión
- [ ] ROI y métricas

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0.0
