# Sistema de Cobros con TiendaNube (App Charges)

## ✅ IMPLEMENTADO

### Endpoints Nuevos

#### 1. **POST `/api/subscription/:storeId/create-charge`**
Crea un cargo en TiendaNube cuando el usuario selecciona un plan.

**Request:**
```json
{
  "planId": "unlimited"
}
```

**Response:**
```json
{
  "success": true,
  "chargeId": 12345,
  "confirmationUrl": "https://www.tiendanube.com/apps/authorize/charge/12345",
  "message": "Redirigir al usuario a confirmation_url para aprobar el cargo"
}
```

**Flujo:**
1. Usuario selecciona un plan en el frontend
2. Frontend llama a este endpoint
3. Backend crea el cargo en TiendaNube
4. Frontend redirige al usuario a `confirmationUrl`
5. Usuario acepta/rechaza el cargo en TiendaNube
6. TiendaNube redirige a `return_url` con status
7. TiendaNube envía webhook a `/api/webhooks/app-charge`

#### 2. **POST `/api/webhooks/app-charge`**
Webhook que TiendaNube envía cuando cambia el estado de un cargo.

**TiendaNube envía:**
```json
{
  "id": 12345,
  "store_id": 6854698,
  "status": "accepted",
  "type": "recurrent",
  "name": "PromoNube - Pro Unlimited",
  "price": "45000.00",
  "currency": "ARS"
}
```

**Estados posibles:**
- `pending`: Cargo creado, esperando aprobación
- `accepted`: Usuario aceptó, suscripción activada ✅
- `rejected`: Usuario rechazó
- `cancelled`: Cargo cancelado
- `expired`: Cargo expiró sin respuesta

**Procesamiento:**
- Si `status === "accepted"`: Activa automáticamente la suscripción y módulos
- Si `status === "rejected"` o `"cancelled"`: Solo registra (opcional: enviar email)

---

## 🔧 Configuración Requerida

### 1. Obtener APP_ID desde Partner Panel

1. Ir a https://partners.tiendanube.com
2. Seleccionar tu app "PromoNube"
3. En la sección de detalles, copiar el **App ID** (número)
4. Agregar en `.env.pedidos-lett-2`:

```bash
TIENDANUBE_APP_ID=TU_APP_ID_AQUI
```

### 2. Configurar Webhook en Partner Panel

1. En Partner Panel → PromoNube → Webhooks
2. Agregar nuevo webhook:
   - **Event**: `app/charge`
   - **URL**: `https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-charge`

### 3. Activar Sistema de Cobros

En Partner Panel → PromoNube → Monetization:
- ✅ Activar "App Charges"
- ✅ Configurar precios (opcionales, ya están en el código)

---

## 💰 Precios por País

```javascript
ARS (Argentina):
  - Gift Cards: $10,000/mes
  - Ruleta: $15,000/mes
  - Style Pro: $25,000/mes
  - Countdown: $10,000/mes
  - Pro Unlimited: $45,000/mes (36% OFF)

MXN (México):
  - Gift Cards: $500/mes
  - Ruleta: $750/mes
  - Style Pro: $1,250/mes
  - Countdown: $500/mes
  - Pro Unlimited: $2,250/mes

COP (Colombia):
  - Gift Cards: $45,000/mes
  - Ruleta: $67,500/mes
  - Style Pro: $112,500/mes
  - Countdown: $45,000/mes
  - Pro Unlimited: $202,500/mes

CLP (Chile):
  - Gift Cards: $11,000/mes
  - Ruleta: $16,500/mes
  - Style Pro: $27,500/mes
  - Countdown: $11,000/mes
  - Pro Unlimited: $49,500/mes
```

---

## 🔄 Flujo Completo

### Usuario selecciona plan:

1. **Frontend**: Usuario hace clic en "Seleccionar Pro Unlimited"

2. **Frontend llama**:
```javascript
const response = await fetch('/api/subscription/6854698/create-charge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'unlimited' })
});

const data = await response.json();
// data.confirmationUrl = "https://www.tiendanube.com/apps/authorize/charge/12345"
```

3. **Frontend redirige**:
```javascript
window.location.href = data.confirmationUrl;
```

4. **Usuario ve modal de TiendaNube** con:
   - Nombre del cargo: "PromoNube - Pro Unlimited"
   - Precio: $45,000 ARS/mes
   - Período de prueba: 7 días gratis
   - Botones: "Aceptar" / "Rechazar"

5. **Usuario acepta** → TiendaNube:
   - Procesa el pago (o programa cobro recurrente)
   - Redirige a: `https://pedidos-lett-2.web.app/dashboard?charge_status=accepted&charge_id=12345`
   - Envía webhook a `/api/webhooks/app-charge`

6. **Backend recibe webhook**:
   - Actualiza estado del cargo en Firestore
   - Activa suscripción y módulos automáticamente
   - Usuario puede usar funcionalidades inmediatamente

---

## 📊 Ventajas vs Mercado Pago

| Aspecto | TiendaNube Charges | Mercado Pago |
|---------|-------------------|--------------|
| **Multi-país** | ✅ Automático (MXN, COP, CLP, ARS) | ❌ Cuenta por país |
| **Setup** | ✅ Webhook + APP_ID | ❌ Tokens + webhooks complejos |
| **UX** | ✅ Modal nativo TiendaNube | ⚠️ Redirige a MP |
| **Confianza** | ✅ Usuario ve cargo en su panel | ⚠️ Pago externo |
| **Comisión** | ⚠️ ~15-20% a TiendaNube | ⚠️ ~5% MP + comisión TN |
| **Mantenimiento** | ✅ TiendaNube gestiona todo | ❌ Gestión manual de suscripciones |
| **Facturación** | ✅ Incluida en factura TiendaNube | ❌ Factura separada |

---

## 🧪 Testing

### Crear cargo de prueba:
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/create-charge \
  -H "Content-Type: application/json" \
  -d '{"planId": "unlimited"}'
```

### Simular webhook accepted:
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/webhooks/app-charge \
  -H "Content-Type: application/json" \
  -d '{
    "id": 99999,
    "store_id": 6854698,
    "status": "accepted",
    "type": "recurrent"
  }'
```

---

## ✅ Checklist de Implementación

- [x] Endpoint para crear cargos
- [x] Webhook para recibir actualizaciones
- [x] Precios multi-país configurados
- [x] Activación automática de suscripción
- [ ] Agregar `TIENDANUBE_APP_ID` en `.env.pedidos-lett-2`
- [ ] Configurar webhook en Partner Panel
- [ ] Actualizar frontend para llamar a create-charge
- [ ] Actualizar frontend para manejar return_url
- [ ] Probar flujo completo en sandbox
- [ ] Desplegar a producción

---

## 📝 Próximos Pasos

1. **Obtener APP_ID** del Partner Panel
2. **Agregar webhook** `app/charge` en Partner Panel
3. **Actualizar frontend** con modal de selección de planes
4. **Probar en store de desarrollo**
5. **Desplegar** cuando esté aprobado
