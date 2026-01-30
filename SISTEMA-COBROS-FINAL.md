# Sistema de Cobros PromoNube - CONFIGURACIÓN FINAL

## ✅ YA CONFIGURADO

### 1. Plan Único PRO
- **Un solo plan**: PromoNube Pro con TODAS las funcionalidades
- **Precio**: $30,000 ARS/mes (7 días gratis)
- **Incluye**: Cupones, Gift Cards, Ruleta, Style Pro, Countdown

### 2. Webhooks Configurados

**Debes agregar en Partner Panel:**

| Evento | URL |
|--------|-----|
| `app/charge` | `https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-charge` |
| `app/suspended` | `https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-suspended` |
| `app/resumed` | `https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-resumed` |

### 3. Credenciales Configuradas
```env
TIENDANUBE_APP_ID=23137
TIENDANUBE_CLIENT_SECRET=4aa553dd36bcad0848bfbe73f2b7894299b38226beab859d
ADMIN_KEY=PromoNube2026Admin!SecretKey
```

---

## 🔄 Flujo Automático

### Cuando un usuario instala la app:

1. **TiendaNube muestra modal**:
   - "PromoNube Pro - $30,000/mes"
   - "7 días de prueba gratis"
   - Botones: Aceptar / Rechazar

2. **Usuario ACEPTA**:
   - TiendaNube crea suscripción automática
   - Envía webhook `app/charge` con `status: "accepted"`
   - Backend activa TODOS los módulos
   - Usuario tiene 7 días gratis
   - Día 16 del mes: TiendaNube cobra automáticamente

3. **Usuario RECHAZA**:
   - Envía webhook con `status: "rejected"`
   - Backend mantiene plan FREE (solo cupones)

### Si el usuario no paga:

1. **TiendaNube envía webhook** `app/suspended`
2. **Backend desactiva módulos** (excepto cupones)
3. **Scripts y webhooks se desactivan automáticamente**
4. **API devuelve error 402** en todas las llamadas

### Cuando regulariza el pago:

1. **TiendaNube envía webhook** `app/resumed`
2. **Backend reactiva todos los módulos**
3. **Scripts y webhooks se reactivan automáticamente**

---

## 🎯 Sistema de Tiendas DEMO

### Activar tienda DEMO (plan PRO gratis por 30 días)

```bash
POST /api/admin/activate-demo
Content-Type: application/json

{
  "storeId": "6854698",
  "adminKey": "PromoNube2026Admin!SecretKey",
  "demoUntil": "2026-02-07T00:00:00Z"  // Opcional, default 30 días
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Tienda DEMO activada",
  "storeId": "6854698",
  "expiresAt": "2026-02-07T00:00:00Z",
  "modules": {
    "coupons": true,
    "giftcards": true,
    "spinWheel": true,
    "style": true,
    "countdown": true
  }
}
```

### Desactivar tienda DEMO

```bash
POST /api/admin/deactivate-demo
Content-Type: application/json

{
  "storeId": "6854698",
  "adminKey": "PromoNube2026Admin!SecretKey"
}
```

### Características de cuentas DEMO:
- ✅ Todos los módulos activos
- ✅ No requiere pago
- ✅ Fecha de expiración automática
- ✅ Al expirar vuelve a plan FREE
- ✅ Se verifica automáticamente en cada request

---

## 📊 Consultar Estado de Pago

### Ver estado completo de suscripción

```bash
GET /api/subscription/:storeId/status
```

**Respuesta:**
```json
{
  "success": true,
  "subscription": {
    "plan": "pro",
    "status": "active",  // "active" | "suspended" | "demo" | "inactive"
    "modules": {
      "coupons": true,
      "giftcards": true,
      "spinWheel": true,
      "style": true,
      "countdown": true
    },
    "isDemoAccount": false,
    "lastCharge": {
      "chargeId": "12345",
      "status": "accepted",
      "amount": 30000,
      "currency": "ARS"
    },
    "hasActivePayment": true
  }
}
```

### Ver historial de cargos

```bash
GET /api/subscription/:storeId/charges
```

---

## ⚠️ Manejo de Error 402 (No Pago)

TiendaNube automáticamente:
- ❌ Desactiva scripts en la tienda
- ❌ Deja de enviar webhooks
- ❌ Devuelve 402 en API calls

**Tu app debe manejar el 402:**
```javascript
const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/...`, {
  headers: {
    'Authentication': `bearer ${accessToken}`
  }
});

if (response.status === 402) {
  // Usuario suspendido por falta de pago
  return {
    error: 'payment_required',
    message: 'Regulariza tu pago en el panel de TiendaNube para continuar usando PromoNube'
  };
}
```

---

## 🎨 Estados Posibles

| Status | Descripción | Módulos Activos |
|--------|-------------|-----------------|
| `active` | Pagando correctamente | Todos (PRO) |
| `demo` | Cuenta de prueba | Todos (PRO) |
| `suspended` | Suspendido por falta de pago | Solo cupones |
| `inactive` | Plan FREE | Solo cupones |

---

## 🧪 Testing

### 1. Probar instalación
```bash
# Instala la app en tu tienda de prueba
# TiendaNube mostrará modal de pago
# Acepta el cargo
# Verifica logs en Firebase
```

### 2. Activar tienda DEMO para testing
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/admin/activate-demo \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "TU_STORE_ID",
    "adminKey": "PromoNube2026Admin!SecretKey"
  }'
```

### 3. Verificar estado
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/TU_STORE_ID/status
```

---

## 📝 Checklist Final

- [x] Plan único PRO configurado
- [x] Precios multi-país listos
- [x] Webhook app/charge implementado
- [x] Webhook app/suspended implementado
- [x] Webhook app/resumed implementado
- [x] Sistema de cuentas DEMO
- [x] Verificación automática de expiración DEMO
- [x] Manejo de estados (active/suspended/demo/inactive)
- [ ] Configurar webhooks en Partner Panel
- [ ] Probar flujo completo
- [ ] Desplegar a producción

---

## 🚀 Próximos Pasos

1. **Configurar los 3 webhooks** en Partner Panel
2. **Probar instalación** en tienda de desarrollo
3. **Verificar logs** en Firebase Functions
4. **Crear panel de admin** para gestionar DEMOs
5. **Actualizar frontend** para mostrar estado de pago

---

## 💡 Ventajas del Sistema Final

✅ **Simplicidad**: Un solo plan, fácil de entender
✅ **Automático**: TiendaNube maneja TODO el cobro
✅ **Multi-país**: Funciona en AR, MX, CO, CL sin cambios
✅ **DEMOs fáciles**: Activas/desactivas con un endpoint
✅ **Sin fricción**: Usuario paga con su cuenta de TiendaNube
✅ **Cero mantenimiento**: No gestionás suscripciones manualmente

**Ya NO necesitás Mercado Pago ni lógica compleja de planes** 🎉
