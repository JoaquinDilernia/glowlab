# 📧 Configuración de Envío de Emails con SendGrid

## Paso 1: Crear cuenta en SendGrid

1. Andá a https://sendgrid.com/
2. Click en "Start for Free" (Plan gratuito: 100 emails/día)
3. Registrate con tu email
4. Verificá tu email

## Paso 2: Crear API Key

1. Login en SendGrid
2. Andá a **Settings** → **API Keys**
3. Click en "Create API Key"
4. Nombre: `PromoNube Production`
5. Permissions: **Full Access** (o al menos "Mail Send")
6. Click "Create & View"
7. **COPIÁ LA API KEY** (solo se muestra una vez)

Ejemplo de API Key: `SG.xxxxxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyy`

## Paso 3: Verificar dominio de envío (Sender Authentication)

### Opción A: Single Sender Verification (más fácil, para empezar)

1. Andá a **Settings** → **Sender Authentication**
2. Click "Verify a Single Sender"
3. Completá:
   - From Name: `PromoNube`
   - From Email: `noreply@tudominio.com` (o tu email personal)
   - Reply To: tu email
   - Company Address: tu dirección
4. Click "Create"
5. **Revisá tu email y verificá** (click en el link)

### Opción B: Domain Authentication (mejor para producción)

1. Andá a **Settings** → **Sender Authentication**
2. Click "Authenticate Your Domain"
3. Seguí los pasos para agregar registros DNS
4. Esperá verificación (puede tardar unas horas)

## Paso 4: Configurar en Firebase Functions

### Opción 1: Variable de entorno (recomendado)

Creá un archivo `.env` en la carpeta `functions`:

```bash
SENDGRID_API_KEY=SG.tu_api_key_aqui
```

**IMPORTANTE:** Agregá `.env` al `.gitignore` para no subir la key al repo.

### Opción 2: Firebase Config (producción)

```bash
cd functions
firebase functions:config:set sendgrid.api_key="SG.tu_api_key_aqui"
```

Luego deployá:
```bash
firebase deploy --only functions:apipromonube
```

## Paso 5: Actualizar email en el código

Editá `functions/index.js` línea ~173:

```javascript
from: {
  email: 'noreply@tudominio.com',  // ← Cambiá esto al email verificado
  name: storeName || 'PromoNube'
},
```

## Paso 6: Probar envío

1. Deployá los cambios
2. Creá una gift card como producto
3. Comprala en tu tienda
4. Verificá que llegue el email

## Troubleshooting

### Error: "The from address does not match a verified Sender Identity"

**Solución:** Asegurate de usar el email que verificaste en SendGrid.

### Error: "Unauthorized"

**Solución:** Verificá que la API key esté bien copiada y configurada.

### Los emails van a spam

**Solución:** 
- Usá Domain Authentication en vez de Single Sender
- Agregá registros SPF y DKIM
- Evitá palabras spam en el asunto

## Alternativas a SendGrid

Si preferís otro servicio:

### Mailgun
- Plan gratuito: 1000 emails/mes
- Web: https://mailgun.com/
- Librería: `npm install mailgun.js`

### Resend (nuevo, muy fácil)
- Plan gratuito: 3000 emails/mes
- Web: https://resend.com/
- Librería: `npm install resend`

### AWS SES
- Muy barato: $0.10 por 1000 emails
- Web: https://aws.amazon.com/ses/
- Librería: `npm install @aws-sdk/client-ses`

## ¿Preguntas?

Si tenés problemas, revisá los logs:
```bash
firebase functions:log --only apipromonube
```
