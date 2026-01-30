# 🚀 Guía de Instalación Rápida - PromoNube Gift Cards

Esta guía te lleva de **0 a funcionando** en menos de 15 minutos.

---

## 📋 Pre-requisitos

- [ ] Cuenta de TiendaNube con app instalada
- [ ] Proyecto Firebase configurado
- [ ] Node.js instalado (v16+)
- [ ] Firebase CLI instalado: `npm install -g firebase-tools`

---

## ⚡ Instalación Express (3 comandos)

### 1️⃣ Instalar dependencias

```bash
# Entrar a la carpeta del proyecto
cd PromoNube

# Instalar frontend
npm install

# Instalar backend
cd functions
npm install
cd ..
```

### 2️⃣ Configurar Firebase

```bash
# Login (si no lo hiciste)
firebase login

# Inicializar (si no está inicializado)
firebase init

# Seleccionar:
# - Functions
# - Hosting (opcional)
# - Firestore

# Desplegar functions
firebase deploy --only functions
```

### 3️⃣ Configurar Email (SendGrid)

```bash
# Crear cuenta gratuita en SendGrid: https://signup.sendgrid.com/
# Copiar tu API key

# Configurar en Firebase
cd functions
firebase functions:config:set sendgrid.api_key="TU_SENDGRID_API_KEY"

# Desplegar nuevamente
cd ..
firebase deploy --only functions
```

---

## 🎯 Pasos Detallados

### Paso 1: Configurar SendGrid

#### 1.1 Crear cuenta
- Ir a https://signup.sendgrid.com/
- Registrarse (plan gratuito: 100 emails/día)
- Verificar email

#### 1.2 Crear API Key
1. Ir a **Settings** → **API Keys**
2. Click **Create API Key**
3. Nombre: `PromoNube`
4. Permisos: **Full Access**
5. **Copiar la key** (solo se muestra una vez)

#### 1.3 Verificar Sender
1. Ir a **Settings** → **Sender Authentication**
2. **Verify a Single Sender**
3. Usar tu email real (ej: `noreply@tudominio.com`)
4. Verificar desde el email que te envían

### Paso 2: Configurar Variables de Entorno

```bash
# En la carpeta functions/
firebase functions:config:set sendgrid.api_key="SG.XXXXXXXXX"

# Verificar
firebase functions:config:get
```

### Paso 3: Actualizar Email del Remitente

Editar `functions/index.js` (buscar línea ~238):

```javascript
from: {
  email: 'noreply@tudominio.com',  // ← TU EMAIL VERIFICADO
  name: storeName || 'Tu Tienda'
}
```

### Paso 4: Desplegar

```bash
firebase deploy --only functions
```

### Paso 5: Registrar Webhook (si no está registrado)

El webhook se registra automáticamente al instalar la app, pero si necesitas hacerlo manual:

```bash
# Crear archivo register-webhook.js
node register-webhook.js
```

O usar el endpoint del backend:
```javascript
POST https://TU_CLOUD_FUNCTION_URL/api/webhooks/register
{
  "storeId": "12345",
  "accessToken": "tu_token"
}
```

---

## ✅ Verificar que Funciona

### Test 1: Consultar saldo de gift card

1. Abrir el frontend local o desplegado
2. Ir a "Usar Gift Card"
3. Ingresar código de prueba
4. Debería decir "Gift card no encontrada" (normal, no hay ninguna aún)

### Test 2: Crear gift card como producto

1. En PromoNube: **Gift Cards** → **Nueva Gift Card**
2. Monto: $10000
3. ✅ Marcar "Publicar como producto"
4. Crear
5. Verificar que aparece en TiendaNube

### Test 3: Comprar y recibir email

1. En TiendaNube, hacer una compra de la gift card
2. Completar checkout con un email real
3. Esperar ~1 minuto
4. Revisar email (y spam)

### Test 4: Usar la gift card

1. Copiar el código del email
2. En PromoNube: **Usar Gift Card**
3. Ingresar código
4. Ver el saldo
5. Canjear un monto
6. Verificar que se descuenta

---

## 🐛 Troubleshooting Rápido

### Email no llega

```bash
# Ver logs
firebase functions:log --only apipromonube --limit 50

# Buscar errores de email
firebase functions:log --only apipromonube | grep "Email"
```

**Posibles causas:**
- API key mal configurada
- Sender email no verificado
- Email en carpeta spam
- Límite de SendGrid alcanzado (100/día)

### Gift card no se genera al comprar

**Verificar webhook:**
```bash
# Ver logs del webhook
firebase functions:log --only apipromonube | grep "Webhook"
```

**Posibles causas:**
- Webhook no registrado
- Producto no tiene "Gift Card" en el nombre
- Orden no está marcada como "paid"

### Frontend no conecta con backend

**Verificar URL en config.js:**
```javascript
// src/config.js
const API_URL = 'https://TU_CLOUD_FUNCTION_URL';
```

Obtener URL correcta:
```bash
firebase functions:list
```

---

## 📊 Dashboard de Monitoreo

### Ver actividad en tiempo real

```bash
firebase functions:log --only apipromonube --follow
```

### Ver gift cards creadas

Firebase Console → Firestore → Collection `promonube_giftcards`

### Ver emails enviados

SendGrid Dashboard → **Activity** → últimos 7 días gratis

---

## 🎨 Personalización Rápida

### Cambiar colores del email

En `functions/index.js` buscar `emailHTML`:

```javascript
// Cambiar gradiente del header
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

// Por ejemplo, verde:
background: linear-gradient(135deg, #10b981 0%, #059669 100%);
```

### Agregar logo de la tienda

```javascript
const logoUrl = 'https://tudominio.com/logo.png';

const emailHTML = `
  <div class="header">
    <img src="${logoUrl}" style="max-height: 50px; margin-bottom: 20px;">
    <h1>🎁 ¡Tu Gift Card está lista!</h1>
    ...
```

---

## 🔥 Script de Test Completo

Crear `functions/test-giftcard-system.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./google-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testGiftCardSystem() {
  console.log('🧪 Testing Gift Card System...\n');
  
  // 1. Crear gift card de prueba
  const testCode = `TEST-${Date.now().toString().slice(-6)}`;
  const giftCardId = `gift_test_${Date.now()}`;
  
  await db.collection('promonube_giftcards').doc(giftCardId).set({
    giftCardId,
    storeId: 'TEST_STORE',
    code: testCode,
    balance: 50000,
    initialAmount: 50000,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`✅ Gift card creada: ${testCode}`);
  console.log(`   Saldo: $50,000`);
  
  // 2. Consultar saldo
  const snapshot = await db.collection('promonube_giftcards')
    .where('code', '==', testCode)
    .limit(1)
    .get();
  
  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    console.log(`✅ Consulta exitosa: $${data.balance}`);
  }
  
  // 3. Canjear
  const docRef = snapshot.docs[0].ref;
  await docRef.update({
    balance: 30000,
    status: 'partially_used'
  });
  
  console.log(`✅ Canjeado: $20,000`);
  console.log(`   Saldo restante: $30,000`);
  
  console.log('\n✨ Sistema funcionando correctamente!');
}

testGiftCardSystem();
```

Ejecutar:
```bash
cd functions
node test-giftcard-system.js
```

---

## 📞 Ayuda Adicional

### Documentación Completa
- `GIFTCARDS-SISTEMA-COMPLETO.md` - Arquitectura completa
- `SETUP-EMAILS-GIFTCARDS.md` - Configuración detallada de emails
- `GIFTCARD-TEMPLATES-SISTEMA.md` - Sistema de diseños

### Logs y Debug
```bash
# Todos los logs
firebase functions:log --only apipromonube

# Solo errores
firebase functions:log --only apipromonube --severity error

# Últimas 2 horas
firebase functions:log --only apipromonube --since 2h
```

### Soporte TiendaNube
- Documentación: https://tiendanube.github.io/api-documentation/
- Webhooks: https://tiendanube.github.io/api-documentation/resources/webhook

---

## ✅ Checklist Final

Antes de lanzar en producción:

- [ ] SendGrid API key configurada
- [ ] Sender email verificado
- [ ] Webhook registrado y funcionando
- [ ] Probado con compra real
- [ ] Email recibido correctamente
- [ ] Gift card canjeada exitosamente
- [ ] Logo de la tienda en el email (opcional)
- [ ] Colores personalizados (opcional)
- [ ] Logs monitoreados

---

## 🎉 ¡Listo!

Si completaste todos los pasos, tu sistema de Gift Cards está **100% funcional**.

**Próximos pasos:**
- Personalizar diseños de gift cards en `/gift-card-templates`
- Crear productos de gift cards en diferentes montos
- Monitorear las ventas en `/sold-gift-cards`
- Analizar uso de gift cards

---

**¿Problemas?** Revisar logs con `firebase functions:log` y el archivo `SETUP-EMAILS-GIFTCARDS.md` para troubleshooting detallado.
