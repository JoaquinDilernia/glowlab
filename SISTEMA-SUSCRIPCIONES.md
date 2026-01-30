# Sistema de Suscripciones PromoNube

## ✅ IMPLEMENTADO

### 1. Feature Flags y Middleware
- ✅ Función `checkModuleAccess(storeId, moduleName)` 
- ✅ Middleware `requireModule(moduleName)` para proteger endpoints
- ✅ Inicialización automática de suscripción FREE para nuevos stores

### 2. Estructura Firestore
```
stores/{storeId}/subscription/current
├── plan: "free" | "promopack" | "premiumpack" | "unlimited"
├── status: "active" | "inactive" | "trial" | "cancelled"
├── modules: {
│   coupons: true (siempre),
│   giftcards: false,
│   spinWheel: false,
│   style: false,
│   countdown: false
│ }
├── createdAt: timestamp
├── updatedAt: timestamp
├── trialEndsAt: timestamp | null
├── nextBillingDate: timestamp | null
└── mpSubscriptionId: string | null
```

### 3. Módulos y Precios (ARS/mes)
```javascript
coupons: $0 (GRATIS)
giftcards: $12,000
spinWheel: $12,000
style: $10,000
countdown: $8,000
```

### 4. Planes Disponibles
- **Free**: $0 - Solo Cupones
- **Promo Pack**: $16,000 (20% off) - Cupones + Ruleta + Countdown
- **Premium Pack**: $26,000 (28% off) - Cupones + GiftCards + Ruleta + Style
- **Pro Unlimited**: $35,000 (35% off) - Todos los módulos

## 🔥 ENDPOINTS NUEVOS

### GET /api/subscription/:storeId
Obtiene suscripción actual del store
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "plan": "free",
    "status": "active",
    "modules": {
      "coupons": true,
      "giftcards": false,
      "spinWheel": false,
      "style": false,
      "countdown": false
    }
  },
  "availableModules": {...},
  "availablePlans": {...}
}
```

### POST /api/subscription/:storeId/activate
Activa un módulo individual
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/activate \
  -H "Content-Type: application/json" \
  -d '{"moduleName": "giftcards"}'
```

### POST /api/subscription/:storeId/deactivate
Desactiva un módulo
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/deactivate \
  -H "Content-Type: application/json" \
  -d '{"moduleName": "giftcards"}'
```

### POST /api/subscription/:storeId/change-plan
Cambia el plan completo
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/change-plan \
  -H "Content-Type: application/json" \
  -d '{"planId": "premiumpack"}'
```

### GET /api/subscription/:storeId/check/:module
Verifica acceso a un módulo específico
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/check/giftcards
```

## 📋 PRÓXIMOS PASOS

### Fase 1: Proteger Endpoints Existentes ⏳
Aplicar middleware `requireModule()` a:
- [ ] `/api/giftcards/*` → `requireModule('giftcards')`
- [ ] `/api/spin-wheel/*` → `requireModule('spinWheel')`
- [ ] `/api/countdown/*` → `requireModule('countdown')`
- [ ] `/api/style-widget.js` → `requireModule('style')`

### Fase 2: Frontend - Dashboard de Suscripción 📱
Crear página `/subscription` en React que muestre:
- Plan actual
- Módulos activos/bloqueados
- Botones "Activar" con redirect a MP
- Historial de pagos
- Upgrade/downgrade

### Fase 3: Integración Mercado Pago 💳
- [ ] Crear endpoint `/api/mp/create-subscription`
- [ ] Webhook `/api/mp/notifications` para pagos
- [ ] Auto-activación de módulos al confirmar pago
- [ ] Auto-suspensión al fallar pago

### Fase 4: Panel Admin 👨‍💼
Crear `/admin` con:
- Lista de todos los stores
- Revenue metrics
- Activar/desactivar módulos manualmente
- Ver estados de pago
- Analytics de conversión

## 🧪 TESTING

### 1. Verificar suscripción actual
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698
```

### 2. Activar Gift Cards
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/activate \
  -H "Content-Type: application/json" \
  -d '{"moduleName": "giftcards"}'
```

### 3. Verificar acceso
```bash
curl https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/check/giftcards
```

### 4. Cambiar a plan Premium
```bash
curl -X POST https://apipromonube-jlfopowzaq-uc.a.run.app/api/subscription/6854698/change-plan \
  -H "Content-Type: application/json" \
  -d '{"planId": "premiumpack"}'
```

## 💡 USO DEL MIDDLEWARE

Para proteger un endpoint:
```javascript
// Antes
app.get('/api/giftcards/list', async (req, res) => {
  // código
});

// Después
app.get('/api/giftcards/list', requireModule('giftcards'), async (req, res) => {
  // código - solo se ejecuta si tiene acceso
});
```

Si el usuario no tiene acceso, recibirá:
```json
{
  "error": "Módulo no disponible",
  "module": "giftcards",
  "reason": "module_not_included",
  "message": "El módulo Gift Cards no está activo en tu plan.",
  "upgrade_url": "https://pedidos-lett-2.web.app/upgrade?module=giftcards"
}
```
