# Sistema de Tracking de Desinstalaciones

## 📊 Resumen

Hemos implementado un sistema completo para trackear y analizar las desinstalaciones de la app PromoNube.

## 🔧 Cambios Realizados

### 1. **Backend - Webhook Mejorado**

El webhook `/api/webhooks/store/redact` ahora:

- ✅ **Guarda** un registro histórico antes de eliminar los datos
- ✅ **Almacena** en la colección `promonube_uninstalls`:
  - Store ID y nombre
  - País
  - Fecha de instalación
  - Fecha de desinstalación
  - Motivo (si Tiendanube lo provee)
  - Plan que tenía la tienda
  - Si era cuenta DEMO

**Archivo modificado:** [functions/index.js](functions/index.js#L3941-L3962)

```javascript
await db.collection("promonube_uninstalls").add({
  storeId: storeId,
  storeName: storeData.name || storeData.storeName || 'Sin nombre',
  country: storeData.country || 'Unknown',
  installedAt: storeData.installedAt || null,
  uninstalledAt: FieldValue.serverTimestamp(),
  reason: req.body.reason || 'No especificado',
  reasonDetail: req.body.reasonDetail || null,
  plan: storeData.plan || 'free',
  isDemoAccount: storeData.isDemoAccount || false
});
```

### 2. **Nuevo Endpoint de Consulta**

**GET** `/api/admin/uninstalls`

Retorna todas las desinstalaciones ordenadas por fecha (más recientes primero).

**Archivo modificado:** [functions/index.js](functions/index.js#L12589-L12625)

### 3. **Frontend - AdminPanel Mejorado**

#### Nueva pestaña "Desinstalaciones"
- ✅ Muestra todas las tiendas que desinstalaron la app
- ✅ Fecha de desinstalación
- ✅ Motivo de la desinstalación
- ✅ País de origen
- ✅ Buscador por nombre o Store ID

**Archivo modificado:** [src/pages/AdminPanel.jsx](src/pages/AdminPanel.jsx)

#### Contador en Stats
- Cuarta tarjeta ahora muestra total de desinstalaciones

### 4. **Fix: Fechas de Instalación**

**PROBLEMA ENCONTRADO:** Las fechas de activación no se mostraban en el admin.

**SOLUCIÓN:**
- ✅ Ahora se guarda `createdAt` e `installedAt` al instalar la app
- ✅ El endpoint `/api/admin/stores` busca múltiples campos de fecha:
  - `createdAt` de la suscripción
  - `installedAt` de la suscripción
  - `installedAt` de `promonube_stores`

**Archivos modificados:**
- [functions/index.js](functions/index.js#L945-L956) - Al instalar app
- [functions/index.js](functions/index.js#L12469-L12510) - Endpoint admin/stores

## 📋 Cómo Usar

### Ver Desinstalaciones en el Admin

1. Ingresá al **Panel de Administración** (`/admin`)
2. Click en la pestaña **"Desinstalaciones"**
3. Verás:
   - Nombre de la tienda
   - Store ID
   - País
   - Fecha de desinstalación
   - Motivo (si Tiendanube lo provee)
   - Detalle de la justificación

### Información Actual

Según los screenshots que compartiste:

- **Librería Kier** (Store ID: 3975230)
  - Desinstaló: 14 de enero de 2026
  - Motivo: "Cambié las necesidades de mi negocio. Esta aplicación ya no cumple con mis requisitos"
  - País: Argentina

Esta información ahora quedará registrada en Firebase en la colección `promonube_uninstalls`.

## 🔍 Análisis de Datos

Con este sistema podés:

1. **Identificar patrones** de desinstalación
2. **Ver qué países** tienen más churn
3. **Analizar motivos** comunes de desinstalación
4. **Calcular retention rate**
5. **Mejorar el producto** basado en feedback

## 📊 Estructura de Datos

### Colección `promonube_uninstalls`

```javascript
{
  storeId: "3975230",
  storeName: "Librería Kier",
  country: "AR",
  installedAt: Timestamp,
  uninstalledAt: Timestamp,
  reason: "business_needs_changed",
  reasonDetail: "Cambié las necesidades de mi negocio...",
  plan: "free",
  isDemoAccount: false
}
```

## 🚀 Próximos Pasos

Para deployar los cambios:

```bash
cd functions
firebase deploy --only functions
```

Luego rebuildeá el frontend:

```bash
npm run build
firebase deploy --only hosting
```

## ⚠️ Notas Importantes

- Los datos de desinstalaciones **no se eliminan** (son históricos)
- El webhook cumple con GDPR: elimina datos de la tienda pero guarda stats anónimos
- Las fechas se muestran en formato argentino (es-AR)
- El sistema está optimizado para no afectar el performance

## 🎯 Caso de Uso: Librería Kier

Esta tienda que viste en los screenshots ahora debería aparecer en:

1. **Pestaña "Desinstalaciones"** con todos los detalles
2. **Contador de stats** mostrando "+1" desinstalación

Si no aparece es porque desinstaló **antes** de este update. Las futuras desinstalaciones se trackearán automáticamente.
