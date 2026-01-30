# 📧 Configuración de Emails para Gift Cards

## ✅ Estado Actual

El sistema de Gift Cards está **completamente funcional** excepto por el envío de emails, que está en modo mock (solo logs).

### ¿Qué funciona ahora?
- ✅ Creación de gift cards como productos
- ✅ Generación automática de códigos al comprar
- ✅ Consulta de saldo
- ✅ Canje/uso de gift cards
- ✅ Template HTML del email diseñado
- ❌ **Envío real de emails (falta configurar)**

---

## 🚀 Configurar SendGrid para Enviar Emails

### Opción 1: SendGrid (Recomendado)

SendGrid ya está integrado en el código. Solo falta la API key.

#### Paso 1: Crear cuenta en SendGrid

1. Ir a [https://signup.sendgrid.com/](https://signup.sendgrid.com/)
2. Crear cuenta gratuita (hasta 100 emails/día gratis)
3. Verificar email

#### Paso 2: Crear API Key

1. Ir a **Settings** → **API Keys**
2. Click en **Create API Key**
3. Nombre: `PromoNube Gift Cards`
4. Permisos: **Full Access** (o mínimo: Mail Send)
5. Copiar la API key (solo se muestra una vez)

#### Paso 3: Configurar en Firebase Functions

Hay dos formas de configurar la API key:

**Opción A: Variables de entorno (Recomendado para producción)**

```bash
# En la carpeta functions/
firebase functions:config:set sendgrid.api_key="TU_API_KEY_AQUI"

# Verificar que se guardó
firebase functions:config:get

# Desplegar para aplicar
firebase deploy --only functions
```

**Opción B: Variable de entorno local (Para desarrollo)**

Crear archivo `.env` en `functions/`:

```env
SENDGRID_API_KEY=TU_API_KEY_AQUI
```

Luego instalar dotenv:
```bash
cd functions
npm install dotenv
```

Y agregar al inicio de `index.js`:
```javascript
require('dotenv').config();
```

#### Paso 4: Verificar Sender Email

SendGrid requiere verificar el email del remitente:

1. Ir a **Settings** → **Sender Authentication**
2. Click en **Verify a Single Sender**
3. Completar datos:
   - From Email: `noreply@tudominio.com` (o el que uses)
   - From Name: `Tu Tienda` o `PromoNube`
4. Verificar el email

#### Paso 5: Actualizar el email remitente en el código

Editar `functions/index.js` línea ~238:

```javascript
from: {
  email: 'noreply@tudominio.com',  // ← Cambiar por tu email verificado
  name: storeName || 'PromoNube'
}
```

#### Paso 6: Desplegar y probar

```bash
firebase deploy --only functions
```

Luego crear una gift card de prueba y verificar que llegue el email.

---

### Opción 2: Mailgun (Alternativa)

Si preferís Mailgun en lugar de SendGrid:

#### Paso 1: Crear cuenta
1. Ir a [https://www.mailgun.com/](https://www.mailgun.com/)
2. Plan gratuito: 5,000 emails/mes primeros 3 meses

#### Paso 2: Instalar SDK
```bash
cd functions
npm install mailgun-js
```

#### Paso 3: Modificar código

Reemplazar en `functions/index.js`:

```javascript
// Antes (SendGrid)
const sgMail = require('@sendgrid/mail');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || ...;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Después (Mailgun)
const mailgun = require('mailgun-js');
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const mg = mailgun({ apiKey: MAILGUN_API_KEY, domain: MAILGUN_DOMAIN });
```

Y en la función `sendGiftCardEmail`:

```javascript
// Reemplazar el bloque de SendGrid por:
const data = {
  from: `${storeName} <noreply@${MAILGUN_DOMAIN}>`,
  to: recipientEmail,
  subject: `🎁 Tu Gift Card de $${amount.toLocaleString('es-AR')} está lista`,
  html: emailHTML
};

await mg.messages().send(data);
```

---

### Opción 3: Gmail SMTP (Solo desarrollo/pruebas)

Para pruebas locales usando Gmail:

#### Paso 1: Instalar Nodemailer
```bash
cd functions
npm install nodemailer
```

#### Paso 2: Configurar
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tucorreo@gmail.com',
    pass: 'tu-app-password'  // Generar en Google Account > Security > App passwords
  }
});

// En sendGiftCardEmail:
await transporter.sendMail({
  from: '"Tu Tienda" <tucorreo@gmail.com>',
  to: recipientEmail,
  subject: `🎁 Tu Gift Card de $${amount.toLocaleString('es-AR')} está lista`,
  html: emailHTML
});
```

⚠️ **No usar en producción** - Gmail tiene límites estrictos y puede marcar como spam.

---

## 🧪 Probar el Sistema de Emails

### Test 1: Email de bienvenida

Crear un endpoint de prueba en `functions/index.js`:

```javascript
app.post("/api/test-email", async (req, res) => {
  const { email } = req.body;
  
  try {
    await sendGiftCardEmail(
      email,
      'GIFT-TEST123',
      50000,
      'Mi Tienda de Prueba',
      null
    );
    
    res.json({ success: true, message: 'Email enviado!' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});
```

### Test 2: Compra real

1. Crear una gift card como producto
2. Hacer una compra de prueba en TiendaNube
3. Verificar los logs de Firebase Functions:
```bash
firebase functions:log --only apipromonube
```

---

## 📊 Monitoreo y Logs

### Ver logs de emails enviados

```bash
# Logs en tiempo real
firebase functions:log --only apipromonube --follow

# Últimos 100 logs
firebase functions:log --only apipromonube --limit 100
```

### Buscar errores específicos
```bash
firebase functions:log --only apipromonube | grep "Email"
firebase functions:log --only apipromonube | grep "ERROR"
```

---

## 🎨 Personalizar el Template del Email

El template está en `functions/index.js` en la función `sendGiftCardEmail` (línea ~151).

### Variables disponibles:
- `recipientEmail`: Email del destinatario
- `code`: Código de la gift card
- `amount`: Monto de la gift card
- `storeName`: Nombre de la tienda
- `expiresAt`: Fecha de vencimiento (puede ser null)

### Ejemplo de personalización:

```javascript
// Agregar logo de la tienda
const logoUrl = storeDoc?.data()?.logo || 'https://via.placeholder.com/150x50?text=Logo';

const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* ... estilos existentes ... */
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="${storeName}" style="max-height: 50px; margin-bottom: 20px;">
      <h1>🎁 ¡Tu Gift Card está lista!</h1>
      <!-- ... resto del HTML ... -->
```

---

## 🔒 Seguridad y Mejores Prácticas

### ✅ Hacer
- Usar variables de entorno para API keys
- Verificar sender authentication en SendGrid
- Implementar rate limiting
- Guardar logs de emails enviados
- Usar templates personalizados por tienda

### ❌ No hacer
- Hardcodear API keys en el código
- Usar Gmail en producción
- Enviar emails sin verificar el destinatario
- Ignorar errores de envío

---

## 💡 Alternativas Avanzadas

### Resend (Moderno y simple)
- [https://resend.com/](https://resend.com/)
- 100 emails/día gratis
- API muy simple
- Excelente para Next.js/React

### Amazon SES (Escalable)
- [https://aws.amazon.com/ses/](https://aws.amazon.com/ses/)
- Muy barato ($0.10 por 1000 emails)
- Requiere más configuración

### Postmark (Transaccional)
- [https://postmarkapp.com/](https://postmarkapp.com/)
- Especializado en emails transaccionales
- 100 emails/mes gratis

---

## 📝 Checklist Final

Antes de poner en producción:

- [ ] API key de SendGrid configurada
- [ ] Sender email verificado
- [ ] Template de email personalizado con logo de la tienda
- [ ] Probado con email real
- [ ] Logs funcionando correctamente
- [ ] Webhook de TiendaNube registrado
- [ ] Variables de entorno en Firebase Functions
- [ ] Dominio propio configurado (opcional pero recomendado)

---

## 🆘 Troubleshooting

### "Error: Unauthorized"
- Verificar que la API key sea correcta
- Verificar que la API key tenga permisos de Mail Send

### "Email no llega"
- Revisar carpeta de spam
- Verificar que el sender email esté verificado
- Revisar logs de Firebase Functions
- Verificar límites de SendGrid (100/día en plan free)

### "Webhook no genera email"
- Verificar que el webhook esté registrado
- Verificar que el producto tenga "gift card" en el nombre
- Revisar logs del webhook: `firebase functions:log`

### "Invalid email"
- Verificar que el cliente ingresó un email válido al comprar
- Verificar que el campo `customer.email` existe en el webhook

---

## 📞 Soporte

Si seguís teniendo problemas:

1. Revisar logs detallados: `firebase functions:log`
2. Probar el endpoint de test de email
3. Verificar configuración de SendGrid
4. Revisar que el webhook esté recibiendo las órdenes

---

**Última actualización**: Noviembre 2024  
**Versión**: 1.0.0
