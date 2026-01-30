# Cómo Usar el Sistema de Cobros de TiendaNube

## 🎯 Lo que YA tenés configurado

✅ Activaste "Precio por mes" en Partner Panel
✅ Configuraste $30000 ARS/mes con 7 días de prueba
✅ El backend ya tiene todo el código listo

## 📋 Pasos que FALTAN

### 1. Obtener tu APP_ID

1. Ve a https://partners.tiendanube.com
2. Abre tu app "GlowLab" 
3. En la sección superior verás un número (ej: 12345)
4. Ese es tu **APP_ID**

### 2. Configurar APP_ID en el código

Edita el archivo `.env.pedidos-lett-2` y reemplaza:
```
TIENDANUBE_APP_ID=TU_APP_ID_AQUI
```

Por (ejemplo):
```
TIENDANUBE_APP_ID=12345
```

### 3. Configurar Webhook en Partner Panel

1. En Partner Panel → GlowLab → Webhooks
2. Click "Agregar Webhook"
3. Configurar:
   - **Evento**: `app/charge` 
   - **URL**: `https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-charge`
4. Guardar

---

## 🔄 Cómo Funciona el Flujo

### Cuando un usuario instala tu app:

**ANTES (sin cobros):**
- Usuario instala → Tiene plan FREE gratis para siempre

**AHORA (con cobros):**
1. Usuario instala la app
2. TiendaNube le muestra un modal: "Esta app cuesta $30,000/mes con 7 días gratis"
3. Usuario acepta/rechaza:
   
   **Si ACEPTA:**
   - TiendaNube envía webhook a tu servidor
   - Tu backend activa automáticamente todos los módulos
   - Usuario tiene 7 días gratis, luego TiendaNube cobra automáticamente
   
   **Si RECHAZA:**
   - TiendaNube envía webhook con `status: "rejected"`
   - Usuario queda con plan FREE (solo cupones)

---

## 📊 Cómo Consultar el Estado de Pago

### Consultar si un usuario está pagando:

```bash
GET /api/subscription/:storeId/status
```

**Ejemplo:**
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/status
```

**Respuesta:**
```json
{
  "success": true,
  "subscription": {
    "plan": "unlimited",
    "status": "active",
    "modules": {
      "coupons": true,
      "giftcards": true,
      "spinWheel": true,
      "style": true,
      "countdown": true
    },
    "lastCharge": {
      "chargeId": "12345",
      "status": "accepted",
      "amount": 30000,
      "currency": "ARS",
      "createdAt": "2026-01-07T15:30:00Z"
    },
    "hasActivePayment": true
  }
}
```

### Ver todos los cargos de una tienda:

```bash
GET /api/subscription/:storeId/charges
```

**Respuesta:**
```json
{
  "success": true,
  "charges": [
    {
      "id": "12345",
      "storeId": "6854698",
      "planId": "unlimited",
      "status": "accepted",
      "amount": 30000,
      "currency": "ARS",
      "createdAt": "2026-01-07T15:30:00Z"
    }
  ],
  "total": 1,
  "active": 1,
  "pending": 0
}
```

---

## 🎨 Integrar en el Frontend

### Mostrar estado de pago en Dashboard:

```javascript
// En Dashboard.jsx
useEffect(() => {
  async function checkPaymentStatus() {
    const storeId = localStorage.getItem('promonube_store_id');
    
    const response = await fetch(`/api/subscription/${storeId}/status`);
    const data = await response.json();
    
    if (data.success) {
      if (data.subscription.hasActivePayment) {
        console.log('✅ Usuario está pagando');
        console.log('Plan activo:', data.subscription.plan);
      } else {
        console.log('⚠️ Usuario no está pagando');
        console.log('Plan:', data.subscription.plan);
      }
    }
  }
  
  checkPaymentStatus();
}, []);
```

---

## ❓ Estados Posibles de un Cargo

| Status | Significado | Acción |
|--------|------------|--------|
| `pending` | Esperando que usuario acepte | No hacer nada aún |
| `accepted` | ✅ Usuario aceptó y está pagando | Activar módulos |
| `rejected` | ❌ Usuario rechazó | Mantener plan FREE |
| `cancelled` | Usuario canceló su suscripción | Desactivar módulos |
| `expired` | Cargo expiró sin respuesta | Mantener plan FREE |

---

## 🧪 Cómo Probar

### 1. Instalar tu app en una tienda de prueba

1. Ve a tu tienda de prueba en TiendaNube
2. Ve a Apps → Instalar tu app (usa la URL de instalación)
3. TiendaNube te mostrará: "Esta app cuesta $30,000/mes (7 días gratis)"
4. Acepta el cargo
5. TiendaNube enviará webhook a tu servidor
6. Revisa los logs en Firebase Functions

### 2. Ver logs del webhook:

```bash
firebase functions:log --only apipromonube
```

Busca:
```
💳 Webhook app-charge recibido: { id: 12345, status: "accepted", ... }
✅ Cargo aceptado, activando plan unlimited para store 6854698
```

### 3. Verificar en Firestore:

Ve a Firebase Console → Firestore → `app_charges`

Deberías ver:
```
app_charges/12345:
  - chargeId: 12345
  - storeId: "6854698"
  - status: "accepted"
  - planId: "unlimited"
  - amount: 30000
  - currency: "ARS"
```

---

## ⚠️ Importante

- **NO necesitás crear cargos manualmente** desde el código
- TiendaNube crea el cargo automáticamente cuando el usuario instala la app
- Tu código solo necesita **ESCUCHAR** el webhook y activar/desactivar módulos

Si ya configuraste el precio en Partner Panel ($30,000/mes), TiendaNube se encarga de:
- Mostrar el modal al usuario
- Crear el cargo
- Cobrar mensualmente
- Enviar webhooks cuando cambia el estado

Tu app solo necesita reaccionar a esos webhooks ✅

---

## 🚀 Próximos Pasos

1. [ ] Obtener APP_ID del Partner Panel
2. [ ] Agregar APP_ID al `.env.pedidos-lett-2`
3. [ ] Configurar webhook `app/charge` en Partner Panel
4. [ ] Desplegar cambios: `firebase deploy --only functions:apipromonube`
5. [ ] Probar instalando la app en tienda de prueba
6. [ ] Verificar que el webhook llega correctamente
7. [ ] Verificar que los módulos se activan automáticamente
