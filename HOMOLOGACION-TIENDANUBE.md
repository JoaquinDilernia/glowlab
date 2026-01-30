# Homologación TiendaNube - PromoNube

## Información General

**Nombre de la Aplicación:** PromoNube  
**URL:** https://promonube.techdi.com.ar  
**Cuenta Demo:** jdilernis99@gmail.com  
**Contraseña Demo:** joacodiler1  
**Store ID Demo:** 6854698  

**Panel de Partners:** https://partners.tiendanube.com/  
**App ID:** 23137  
**Client ID:** 23137  
**Client Secret:** [Configurado en TiendaNube Partners]

---

## 1. Diagrama de Secuencia

### Flujo de Autenticación OAuth 2.0

```
Usuario                 PromoNube              TiendaNube API
  |                        |                         |
  |--[Instalar App]------->|                         |
  |                        |--[Redirect OAuth]------>|
  |                        |                         |
  |<------[Autorización]----------------------|      |
  |                        |                         |
  |--[Aprobar]------------>|                         |
  |                        |<--[Auth Code]-----------|
  |                        |                         |
  |                        |--[Exchange Token]------>|
  |                        |<--[Access Token]--------|
  |                        |                         |
  |                        |--[Store Info]---------->|
  |                        |<--[Store Data]----------|
  |                        |                         |
  |<--[Dashboard Access]---|                         |
```

### Alcances (Scopes) Utilizados

**Obligatorios:**
- `read_products` - Leer catálogo de productos para Gift Cards
- `write_products` - Crear/actualizar productos de Gift Cards
- `read_orders` - Leer pedidos para validación de cupones y gift cards
- `write_orders` - Aplicar descuentos y modificar pedidos
- `read_customers` - Acceso a información de clientes para cupones personalizados
- `write_scripts` - Inyectar scripts de Ruleta, Countdown y Style en la tienda

### Flujo de Funcionalidades Principales

#### A) Instalación y Configuración
```
1. Usuario → Instala app desde TiendaNube App Store
2. PromoNube → Solicita autorización OAuth
3. TiendaNube → Redirige con código de autorización
4. PromoNube → Intercambia código por Access Token
5. PromoNube → Registra webhook para pedidos
6. PromoNube → Crea suscripción inicial (Plan Free)
7. Usuario → Accede al Dashboard de PromoNube
```

#### B) Creación de Cupón Inteligente
```
1. Usuario → Crea cupón en Dashboard
2. PromoNube → Genera código único
3. PromoNube → POST /admin/coupons a TiendaNube
4. TiendaNube → Retorna coupon_id
5. PromoNube → Guarda en Firestore con tracking
```

#### C) Uso de Cupón en Checkout
```
1. Cliente → Aplica cupón en checkout
2. TiendaNube → Webhook order/paid
3. PromoNube → Valida cupón (usos, vencimiento, restricciones)
4. PromoNube → Actualiza contador de usos
5. PromoNube → Registra analytics
```

#### D) Gift Cards
```
1. Usuario → Crea template de Gift Card
2. PromoNube → Genera diseño personalizado
3. PromoNube → POST /products con variant de valor
4. Cliente → Compra Gift Card
5. TiendaNube → Webhook order/paid
6. PromoNube → Genera código único
7. PromoNube → Envía email con diseño y código
```

#### E) Ruleta de Premios (App Embed)
```
1. Usuario → Configura ruleta en Dashboard
2. PromoNube → POST /script_tags con URL del script
3. TiendaNube → Inyecta script en storefront
4. Cliente → Interactúa con ruleta
5. PromoNube → Genera cupón ganador
6. PromoNube → POST /admin/coupons
7. Cliente → Recibe código por email
```

---

## 2. Requisitos Técnicos - Planes de Pago

### Sistema de Suscripciones

PromoNube implementa un sistema de suscripción mensual con 4 planes:

#### **Plan Free** - $0/mes
- ✅ Cupones Inteligentes ilimitados
- ✅ Analytics básico
- ✅ Soporte por email
- **Sin cobro, sin renovación**

#### **Promo Pack** - $16.000 ARS/mes
- Incluye: Cupones + Ruleta + Countdown
- 20% descuento vs compra individual
- **Renovación automática mensual**

#### **Premium Pack** - $26.000 ARS/mes
- Incluye: Cupones + Gift Cards + Ruleta + Style
- 28% descuento vs compra individual
- **Renovación automática mensual**

#### **Pro Unlimited** - $35.000 ARS/mes
- Todos los módulos incluidos
- 35% descuento vs compra individual
- **Renovación automática mensual**

### Flujo de Suscripción

```
1. Usuario → Selecciona plan en Dashboard
2. PromoNube → Redirige a Mercado Pago Checkout Pro
3. Usuario → Completa pago con tarjeta
4. Mercado Pago → Webhook a PromoNube
5. PromoNube → Activa módulos del plan (30 días)
6. PromoNube → Actualiza badge en Dashboard
7. Usuario → Accede a funcionalidades desbloqueadas
```

### Precauciones Implementadas

#### 1. **Feature Flags (Control de Acceso)**
```javascript
// Middleware que verifica acceso antes de cada operación
checkModuleAccess(storeId, 'giftcards')
// → Retorna 403 si el módulo no está activo
```

#### 2. **Expiración de Planes**
- Cada plan se activa por 30 días desde el pago
- Campo `expiresAt` en Firestore
- Verificación en cada request API

#### 3. **Estado de Suscripción**
- `active` - Plan vigente y pagado
- `expired` - Plan vencido, requiere renovación
- `cancelled` - Cancelado manualmente

#### 4. **Webhook de Mercado Pago**
- Endpoint: `POST /api/mp/webhook`
- Validación de firma x-signature
- Estados: approved, rejected, pending
- Activación automática al aprobar pago
- Logs completos de transacciones

#### 5. **Manejo de Fallos de Pago**
- Pago rechazado → Usuario recibe notificación
- Renovación fallida → Plan se marca como `expired`
- Usuario puede reintentar pago desde Dashboard

#### 6. **Panel Admin**
- URL: `/admin`
- Activación manual de planes
- Visualización de todas las suscripciones
- Historial completo de pagos
- Desactivación de cuentas

### Seguridad en Pagos

- ✅ **PCI Compliant**: Mercado Pago maneja datos de tarjetas
- ✅ **HTTPS**: Todas las comunicaciones encriptadas
- ✅ **Webhook Signature**: Validación de origen de notificaciones
- ✅ **Tokens de prueba**: Ambiente TEST separado de producción
- ✅ **Idempotencia**: Manejo de webhooks duplicados

---

## 3. Información Técnica

### Arquitectura

**Frontend:**
- React 18.3.1 + Vite 7.2.2
- React Router DOM para navegación
- Hosting: Firebase Hosting
- URL: https://pedidos-lett-2.web.app

**Backend:**
- Firebase Cloud Functions (Node.js 22)
- Express.js para API REST
- Region: us-central1
- URL: https://apipromonube-jlfopowzaq-uc.a.run.app

**Base de Datos:**
- Firebase Firestore
- Colecciones: 
  - `promonube_stores` - Datos de tiendas
  - `promonube_subscription` - Suscripciones activas
  - `promonube_payments` - Historial de pagos
  - `promonube_coupons` - Cupones creados
  - `promonube_giftcards` - Gift cards activas
  - `promonube_spin_wheels` - Configuraciones de ruletas
  - `promonube_countdowns` - Cuenta regresivas
  - `promonube_style_config` - Personalizaciones de style

**Almacenamiento:**
- Firebase Storage para imágenes de menú y templates

**Email:**
- SendGrid para envío de Gift Cards y notificaciones

**Pagos:**
- Mercado Pago Checkout Pro
- SDK: mercadopago v2.0.11
- Credenciales de producción configuradas

### Endpoints Principales

**OAuth & Auth:**
- `GET /callback` - Callback OAuth TiendaNube
- `GET /store-info` - Información de la tienda conectada

**Cupones:**
- `GET /api/coupons` - Listar cupones
- `POST /api/coupons` - Crear cupón
- `GET /api/coupon/:id` - Detalle de cupón
- `GET /api/coupon/:id/analytics` - Analytics del cupón

**Gift Cards:**
- `GET /api/giftcards` - Listar gift cards
- `POST /api/giftcards` - Crear gift card
- `GET /api/giftcard/:id` - Detalle de gift card
- `POST /api/giftcard/validate` - Validar código en checkout

**Ruleta:**
- `GET /api/spin-wheels` - Listar ruletas
- `POST /api/spin-wheels` - Crear ruleta
- `POST /api/spin-wheel/spin` - Girar ruleta

**Countdown:**
- `GET /api/countdowns` - Listar countdowns
- `POST /api/countdowns` - Crear countdown

**Style:**
- `GET /api/style-config` - Obtener configuración
- `POST /api/style-config` - Guardar configuración

**Suscripciones:**
- `GET /api/subscription/:storeId` - Estado de suscripción
- `POST /api/subscription/:storeId/activate` - Activar módulo
- `POST /api/subscription/:storeId/deactivate` - Desactivar módulo

**Mercado Pago:**
- `POST /api/mp/create-preference` - Crear checkout
- `POST /api/mp/webhook` - Notificaciones de pago

**Admin:**
- `GET /api/admin/stores` - Todas las tiendas
- `GET /api/admin/payments` - Todos los pagos
- `POST /api/admin/activate-plan` - Activar plan manualmente
- `POST /api/admin/deactivate-plan` - Desactivar plan

### Webhooks Registrados

**TiendaNube → PromoNube:**
- `order/paid` - Validación de cupones y activación de gift cards
- `product/updated` - Sincronización de catálogo

**Mercado Pago → PromoNube:**
- `payment` - Notificaciones de pagos aprobados/rechazados

### Scripts Inyectados (App Embeds)

**1. Ruleta de Premios**
- URL: `https://pedidos-lett-2.web.app/spin-wheel-version.js`
- Ubicación: Overlay modal en toda la tienda
- Trigger: Configurable (tiempo, scroll, exit intent)

**2. Cuenta Regresiva**
- URL: `https://pedidos-lett-2.web.app/countdown-version.js`
- Ubicación: Banner superior de la tienda
- Tipo: Sticky, no intrusivo

**3. Style Customization**
- URL: `https://pedidos-lett-2.web.app/style-widget-version.js`
- Modificaciones: Colores, logos, menú, botones
- Aplicación: CSS dinámico en todo el sitio

---

## 4. Credenciales de Acceso

### Cuenta Demo TiendaNube
- **Email:** jdilernis99@gmail.com
- **Contraseña:** joacodiler1
- **Store ID:** 6854698
- **URL Tienda:** [Configurada en TiendaNube]

### Panel PromoNube
- **URL Dashboard:** https://pedidos-lett-2.web.app/#/dashboard
- **URL Admin Panel:** https://pedidos-lett-2.web.app/#/admin
- **Login:** Automático via OAuth de TiendaNube

### Credenciales de Prueba MP
- **Public Key:** TEST-fbf04c58-3637-4e7a-aa19-febb7fcd7a16
- **Access Token:** TEST-6395817858616796-112613-...
- **Tarjeta Aprobada:** 5031 7557 3453 0604 | CVV: 123

### Credenciales de Producción MP
- **Public Key:** APP_USR-05bf79df-184b-44f2-8232-7f3eaac161b7
- **Access Token:** APP_USR-7929306020731235-112613-...
- **Configuradas en:** Firebase Functions .env

---

## 5. Casos de Prueba para Video Demo

### Escenario 1: Instalación
1. Acceder a TiendaNube App Store
2. Buscar "PromoNube"
3. Click en "Instalar"
4. Aceptar permisos OAuth
5. Redirigir a Dashboard de PromoNube
6. Verificar conexión exitosa

### Escenario 2: Crear Cupón Inteligente
1. Dashboard → "Abrir Cupones"
2. Click "Crear Cupón"
3. Configurar: código, descuento, restricciones
4. Guardar cupón
5. Verificar en TiendaNube admin que se creó

### Escenario 3: Gift Card
1. Dashboard → "Gift Cards"
2. Crear template personalizado
3. Configurar producto con valores
4. Simular compra en storefront
5. Verificar email con código generado

### Escenario 4: Ruleta de Premios
1. Dashboard → "Ruleta"
2. Configurar premios y probabilidades
3. Activar en tienda
4. Abrir storefront → Ver modal de ruleta
5. Girar y ganar cupón
6. Verificar cupón generado

### Escenario 5: Suscripción
1. Dashboard → Click en plan PRO
2. Redirigir a Mercado Pago
3. Pagar con tarjeta de prueba
4. Verificar activación automática
5. Ver módulos desbloqueados

### Escenario 6: Reinstalación
1. TiendaNube admin → Desinstalar app
2. Volver a instalar desde App Store
3. Verificar que datos persisten
4. Confirmar suscripción activa se mantiene

---

## 6. Checklist de Homologación

### Artefactos Obligatorios
- ✅ Diagrama de secuencia (incluido arriba)
- ✅ Video de demostración (a cargo del partner)
- ✅ Requisitos técnicos de suscripción (documentado)

### Archivos de Publicación
- ⏳ Plantilla de FAQs (siguiente sección)
- ⏳ Formulario de Registro de Partners
- ⏳ Perfil completo en Partners Panel

---

## Contacto

**Desarrollador:** Joaquín Di Lernia  
**Email:** jdilernis99@gmail.com  
**Empresa:** TechDi  
**Sitio Web:** https://promonube.techdi.com.ar
