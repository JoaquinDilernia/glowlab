# 📊 Trackeo de Cupones - Implementación Completa

## ✅ Lo que se implementó

### Backend (Firebase Functions)

**1. Webhook de Órdenes** (`POST /api/webhooks/order`)
- Recibe notificaciones automáticas de TiendaNube cuando se crea una orden
- Detecta si la orden tiene un cupón aplicado
- Guarda el registro en Firestore (`coupon_usage` collection)
- Actualiza el contador `currentUses` del cupón

**Datos que se guardan por cada uso:**
```javascript
{
  usageId: "usage_1234567890_123",
  couponId: "coupon_1234567890",
  couponCode: "VERANO2024",
  storeId: "12345",
  orderId: "123",
  orderNumber: "1001",
  customerEmail: "cliente@email.com",
  customerName: "Juan Pérez",
  customerId: "456",
  subtotal: 10000,
  total: 8000,
  discountValue: 2000,
  orderStatus: "open",
  paymentStatus: "paid",
  createdAt: Timestamp,
  orderDate: "2024-12-01T10:00:00Z"
}
```

**2. Endpoint de Analytics** (`GET /api/coupons/usage`)
- Obtiene historial de uso por tienda o por cupón específico
- Calcula estadísticas automáticas:
  - Total de usos
  - Descuento total aplicado
  - Ingresos generados
  - Ticket promedio
  - Descuento promedio

**Uso:**
```
GET /api/coupons/usage?storeId=12345&couponId=coupon_123
```

---

### Frontend (React)

**1. Página de Analytics** (`/coupon-analytics/:couponId`)

**Features:**
- 📊 **Stats Cards**: Métricas clave del cupón
  - Total de usos (vs máximo permitido)
  - Descuento total otorgado
  - Ingresos generados con el cupón
  - Conversión y ticket promedio

- 📈 **Gráfico de barras**: Usos en los últimos 30 días
  - Visual, interactivo
  - Muestra cantidad de usos por día
  - Hover muestra detalles

- 📋 **Tabla de órdenes**: Historial completo
  - Fecha y hora
  - Cliente (nombre + email)
  - Número de orden
  - Subtotal, descuento, total
  - Estado de pago

- 💾 **Export CSV**: Descarga todos los datos

**2. Botón en lista de cupones**
- Cada cupón tiene un botón 📊 que abre su analytics
- Acceso directo desde `CouponsList`

---

## 🚀 Cómo usar

### Paso 1: Desplegar el backend

```bash
cd functions
firebase deploy --only functions
```

Esto despliega el webhook y el endpoint de analytics.

### Paso 2: Registrar el webhook en TiendaNube

**Opción A: Automático (recomendado)**

1. Actualizar la URL del webhook en `register-webhook.js`:
```javascript
const WEBHOOK_URL = "https://us-central1-TU-PROYECTO.cloudfunctions.net/apipromonube/api/webhooks/order";
```

2. Ejecutar:
```bash
node register-webhook.js register
```

**Opción B: Manual**

Hacer POST a TiendaNube API:
```bash
curl -X POST "https://api.tiendanube.com/v1/STORE_ID/webhooks" \
  -H "Authentication: bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-cloud-function.com/api/webhooks/order",
    "event": "order/created"
  }'
```

### Paso 3: Probar

1. Crear un cupón en PromoNube
2. Hacer una compra en tu tienda usando el cupón
3. Ir a la lista de cupones y hacer clic en el botón 📊
4. Ver el analytics con la orden registrada

---

## 🔍 Comandos útiles

### Ver webhooks registrados
```bash
node register-webhook.js list
```

### Eliminar un webhook
```bash
node register-webhook.js delete WEBHOOK_ID
```

### Ver logs del webhook (Firebase)
```bash
firebase functions:log --only apipromonube
```

---

## 📊 Estructura de Datos (Firestore)

### Collection: `coupon_usage`

Cada documento representa un uso del cupón:

```
coupon_usage/
  └── usage_1234567890_123/
        ├── usageId: "usage_1234567890_123"
        ├── couponId: "coupon_1234567890"
        ├── couponCode: "VERANO2024"
        ├── storeId: "12345"
        ├── orderId: "123"
        ├── orderNumber: "1001"
        ├── customerEmail: "cliente@email.com"
        ├── customerName: "Juan Pérez"
        ├── customerId: "456"
        ├── subtotal: 10000
        ├── total: 8000
        ├── discountValue: 2000
        ├── orderStatus: "open"
        ├── paymentStatus: "paid"
        ├── createdAt: Timestamp
        └── orderDate: "2024-12-01T10:00:00Z"
```

### Collection: `promonube_coupons`

Se actualiza automáticamente:
- `currentUses`: Incrementa +1 por cada uso
- `lastUsedAt`: Timestamp del último uso

---

## 💡 Valor Diferencial

### ¿Por qué esto es único?

**TiendaNube NO ofrece:**
- ❌ Notificaciones cuando se usa un cupón
- ❌ Analytics detallados por cupón
- ❌ Historial de órdenes con cupón aplicado
- ❌ Estadísticas de conversión
- ❌ Export de datos de uso

**PromoNube SÍ ofrece:**
- ✅ Notificación en tiempo real (webhook)
- ✅ Dashboard visual con gráficos
- ✅ Métricas clave (ROI, conversión, ticket promedio)
- ✅ Historial completo por cupón
- ✅ Export a CSV para análisis
- ✅ Tracking automático

---

## 🎯 Casos de Uso

### 1. Ver ROI de campañas
- Crear cupón "BLACKFRIDAY2024"
- Ver cuánto descuento se otorgó vs ingresos generados
- Calcular si la campaña fue rentable

### 2. Identificar clientes VIP
- Ver quién usa más tus cupones
- Emails de clientes frecuentes
- Crear cupones personalizados para ellos

### 3. Optimizar descuentos
- Comparar cupones de 10%, 20%, 30%
- Ver cuál genera más conversión
- Ajustar estrategia según datos

### 4. Detectar fraude
- Ver si un cupón se usa más de lo esperado
- Identificar patrones sospechosos
- Bloquear cupones comprometidos

---

## 🔮 Mejoras Futuras

### Fase 2: Notificaciones
- [ ] Email cuando alguien usa un cupón
- [ ] Push notifications en el dashboard
- [ ] Alertas cuando un cupón está por agotarse

### Fase 3: Analytics Avanzados
- [ ] Comparar múltiples cupones
- [ ] Análisis de cohortes
- [ ] Predicción de conversión
- [ ] Segmentación de clientes

### Fase 4: Automatización
- [ ] Auto-desactivar cupones exhaustos
- [ ] Crear cupones dinámicos basados en uso
- [ ] Recomendaciones de optimización

---

## 🐛 Troubleshooting

### El webhook no se dispara

1. Verificar que está registrado:
```bash
node register-webhook.js list
```

2. Ver logs de Firebase:
```bash
firebase functions:log --only apipromonube
```

3. Probar el webhook manualmente:
```bash
curl -X POST "https://tu-url/api/webhooks/order" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "12345",
    "id": "123",
    "number": "1001",
    "coupon": {
      "code": "TEST"
    },
    "customer": {
      "email": "test@test.com"
    },
    "total": 1000,
    "subtotal": 1200,
    "discount_coupon": {
      "value": 200
    }
  }'
```

### No aparecen datos en analytics

1. Verificar que el cupón fue creado en PromoNube (no nativo de TiendaNube)
2. Verificar que la orden tiene el cupón aplicado
3. Ver colección `coupon_usage` en Firestore

### Error al cargar la página

1. Verificar que el backend está desplegado
2. Ver consola del navegador (F12)
3. Verificar URL del API en `config.js`

---

## 📞 Soporte

Si tenés problemas:

1. Ver logs de Firebase
2. Revisar consola del navegador
3. Verificar que el webhook está registrado
4. Probar con cupón de test

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0.0
