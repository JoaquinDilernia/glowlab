# Configuración de Webhook para Tracking de Cupones

## 📋 Resumen

Para poder trackear cuando se usa un cupón, necesitamos configurar un webhook en TiendaNube que notifique a PromoNube cada vez que se completa un pedido con cupón.

## 🔗 Endpoint del Webhook

```
POST https://apipromonube-jlfopowzaq-uc.a.run.app/webhook/order-paid
```

## 📝 Pasos para Configurar en TiendaNube

### 1. Acceder a la Configuración de Webhooks

```
Panel de Admin → Configuración → API → Webhooks
```

O directamente:
```
https://www.tiendanube.com/admin/webservices/webhooks
```

### 2. Crear Nuevo Webhook

- **URL**: `https://apipromonube-jlfopowzaq-uc.a.run.app/webhook/order-paid`
- **Evento**: `order/paid` (Pedido Pagado)
- **Activo**: ✅ Sí

### 3. Datos que Recibirá el Webhook

Cuando un pedido se marca como pagado, TiendaNube enviará un POST con:

```json
{
  "id": 123456,
  "number": 1001,
  "store_id": "6854698",
  "total": "5999.00",
  "customer": {
    "email": "cliente@email.com",
    "name": "Juan Pérez"
  },
  "coupon": {
    "code": "DESCUENTO20",
    "type": "percentage",
    "value": "1199.80"
  }
}
```

## 🎯 Flujo de Tracking

1. **Cliente aplica cupón** en el checkout
2. **Pedido se marca como pagado** (trigger del webhook)
3. **TiendaNube envía notificación** a PromoNube
4. **PromoNube registra el uso**:
   - Guarda en colección `coupon_usage`
   - Incrementa `currentUses` del cupón
   - Actualiza `lastUsedAt`

## 📊 Estructura de Datos en Firestore

### Colección: `coupon_usage`

```javascript
{
  couponId: "PROMO-abc123",
  couponCode: "DESCUENTO20",
  storeId: "6854698",
  orderId: "123456",
  orderNumber: 1001,
  customerEmail: "cliente@email.com",
  customerName: "Juan Pérez",
  orderTotal: 5999.00,
  discountAmount: 1199.80,
  usedAt: Timestamp,
  createdAt: Timestamp
}
```

### Actualización en `promonube_coupons`

```javascript
{
  currentUses: increment(1),
  lastUsedAt: Timestamp
}
```

## 🔍 Verificación

Para verificar que el webhook funciona:

1. Hacer un pedido de prueba con cupón
2. Marcar el pedido como pagado
3. Verificar en Cloud Functions logs:
   ```
   🔔 Webhook de pedido pagado recibido
   🎟️ Pedido con cupón: DESCUENTO20
   ✅ Uso de cupón registrado
   ```

## 📈 Visualización en el Dashboard

El historial de uso se mostrará en:
- **Lista de Cupones** → Click en ícono de gráfico (📊)
- **Modal con**:
  - Stats: Total usos, descuento total, ticket promedio
  - Tabla: Fecha, pedido, cliente, monto, descuento

## 🚀 Eventos Disponibles

TiendaNube ofrece varios eventos de webhook. Los más útiles para PromoNube:

- `order/paid` - **Implementado** ✅
- `order/created` - Pedido creado (opcional para tracking temprano)
- `order/cancelled` - Para restar usos si se cancela (futuro)

## 🔐 Seguridad

### Verificación de Origen (Futuro)

```javascript
// Agregar validación de webhook signature
const signature = req.headers['x-tiendanube-signature'];
const isValid = verifyWebhookSignature(req.body, signature);
```

## 📝 Notas

- El webhook solo registra cupones creados desde PromoNube
- Si el cupón no existe en `promonube_coupons`, se ignora
- Los datos históricos no se registran (solo desde la configuración)
- Se puede backfill datos históricos mediante la API de TiendaNube si es necesario

## 🛠️ Testing Local

Para probar localmente (con ngrok o similar):

```bash
# Exponer puerto local
ngrok http 5001

# Webhook URL temporal
https://abc123.ngrok.io/webhook/order-paid
```

---

**Última actualización**: 12 Nov 2025
**Versión PromoNube**: 1.0.0
