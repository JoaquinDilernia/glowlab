# Mercado Pago Integration - PromoNube

## Configuración

### 1. Obtener Access Token de Mercado Pago

1. Ir a: https://www.mercadopago.com.ar/developers/panel
2. Crear aplicación nueva o usar existente
3. Copiar el **Access Token** (Production)

### 2. Configurar en Firebase Functions

```bash
# Desde el directorio functions/
firebase functions:config:set mercadopago.access_token="APP_USR-tu-access-token-aqui"
```

O agregar a `.env` local:
```
MP_ACCESS_TOKEN=APP_USR-tu-access-token-aqui
```

### 3. Endpoints Implementados

#### POST /api/mp/create-preference
Crea una preferencia de pago en Mercado Pago.

**Request:**
```json
{
  "storeId": "6854698",
  "planId": "premiumpack",
  "storeEmail": "cliente@tienda.com",
  "storeName": "Mi Tienda"
}
```

**Response:**
```json
{
  "success": true,
  "preferenceId": "123456789-abc-def",
  "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "sandboxInitPoint": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=..."
}
```

#### POST /api/mp/webhook
Recibe notificaciones de Mercado Pago sobre pagos.

**Headers:**
```
x-signature: ...
x-request-id: ...
```

### 4. Flujo de Pago

```
1. Usuario selecciona plan en modal → Click "Seleccionar Plan"
2. Frontend llama POST /api/mp/create-preference
3. Backend crea preferencia y retorna initPoint
4. Frontend redirige a initPoint (checkout de MP)
5. Usuario paga en MP
6. MP notifica via webhook → POST /api/mp/webhook
7. Backend activa módulos del plan
8. Usuario regresa a success_url
```

### 5. Testing con Sandbox

Para probar sin pagos reales:

1. Usar **Sandbox Access Token** en lugar de Production
2. Usar tarjetas de prueba de MP: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards
3. Usar `sandboxInitPoint` en lugar de `initPoint`

**Tarjetas de prueba:**
- VISA aprobada: 4509 9535 6623 3704
- VISA rechazada: 4509 9535 6623 3715
- Mastercard aprobada: 5031 7557 3453 0604

### 6. URLs de Callback

Configuradas en la preferencia:
- Success: `https://pedidos-lett-2.web.app/payment-success?plan={planId}`
- Failure: `https://pedidos-lett-2.web.app/payment-failure`
- Pending: `https://pedidos-lett-2.web.app/payment-pending`

### 7. Webhook URL

```
https://apipromonube-jlfopowzaq-uc.a.run.app/api/mp/webhook
```

Esta URL debe configurarse en el panel de Mercado Pago:
- Developers → Webhooks → Agregar URL

### 8. Próximos Pasos

- [ ] Implementar lógica completa del webhook (activar módulos)
- [ ] Crear páginas payment-success/failure/pending en frontend
- [ ] Agregar botón "Pagar con Mercado Pago" en UpgradeModal
- [ ] Implementar renovación automática mensual
- [ ] Manejar fallos de pago (suspender cuenta)
- [ ] Panel admin para ver pagos y suscripciones
