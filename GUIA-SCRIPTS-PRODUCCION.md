# 🚀 Guía Completa: Scripts en Producción (Versión de App)

## 📋 Contexto

Cuando una app de TiendaNube está en **modo PRODUCCIÓN** (con una versión publicada), no es posible agregar scripts dinámicamente vía API. Los scripts deben estar declarados en el **manifest de la app** o agregarse manualmente al tema.

---

## ✅ SOLUCIÓN IMPLEMENTADA

Creamos **archivos JavaScript estáticos** que:
- Se sirven desde Firebase Hosting (público)
- Auto-detectan el `storeId` de la tienda
- Cargan dinámicamente el contenido real desde Cloud Functions
- **Se actualizan sin necesidad de nueva versión de app** ✨

### Archivos creados:

| Feature | URL Estática |
|---------|--------------|
| **Style (Light Toggle, WhatsApp, etc.)** | `https://pedidos-lett-2.web.app/style-widget-version.js` |
| **Ruleta de Premios** | `https://pedidos-lett-2.web.app/spin-wheel-version.js` |
| **Cuenta Regresiva** | `https://pedidos-lett-2.web.app/countdown-version.js` |

---

## 🎯 IMPLEMENTACIÓN: 2 Métodos

### Método A: Agregar al Tema Manualmente ⚡ (RÁPIDO - 5 min)

**Para Alto Rancho o cualquier tienda individual:**

#### Paso 1: Ir al editor de código del tema

1. Entrar al admin de la tienda:
   - https://admin.tiendanube.com/apps/configuration/webshop/themes

2. Click en "Personalizar" en el tema actual

3. "Acciones" → "Editar código"

#### Paso 2: Editar `layout/theme.tpl`

Buscar la etiqueta `</head>` y **ANTES** de ella, agregar:

```html
<!-- PromoNube Widgets -->
<script src="https://pedidos-lett-2.web.app/style-widget-version.js" async></script>
<script src="https://pedidos-lett-2.web.app/spin-wheel-version.js" async></script>
<script src="https://pedidos-lett-2.web.app/countdown-version.js" async></script>
```

#### Paso 3: Guardar y verificar

- **Style (Light Toggle):** 
  - Ir a la categoría configurada (ej: `/lamparas-inalambricas`)
  - Verificar que aparece el toggle al lado de "DESTACADO"

- **Ruleta:**
  - Abrir cualquier página de la tienda
  - Debería aparecer el popup si hay una ruleta activa

- **Countdown:**
  - Ir al producto configurado
  - Verificar que aparece la cuenta regresiva

✅ **VENTAJAS:**
- Funciona inmediatamente
- No requiere aprobación de TiendaNube
- Se actualiza automáticamente cuando cambias la configuración

❌ **DESVENTAJAS:**
- Hay que agregarlo manualmente en cada tienda
- Si el cliente cambia de tema, hay que volver a agregarlo

---

### Método B: Nueva Versión de App 🏆 (PROFESIONAL - Setup único)

**Para que se instale automáticamente en TODAS las tiendas:**

#### Paso 1: Ir a TiendaNube Partners

- https://partners.tiendanube.com/
- Seleccionar la app "PromoNube"

#### Paso 2: Crear Nueva Versión

- Click en "Versiones" → "Crear nueva versión"

#### Paso 3: Configurar App Embeds en manifest.json

Agregar/reemplazar la sección `app_embeds`:

```json
{
  "name": "PromoNube",
  "version": "2.0.0",
  "description": "Sistema completo de promociones inteligentes",
  "app_embeds": [
    {
      "name": "Personalizador Style PromoNube",
      "description": "Personaliza WhatsApp, menú, banners y light toggle",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/style-widget-version.js",
      "event": "onload",
      "location": "store"
    },
    {
      "name": "Ruleta de Premios PromoNube",
      "description": "Popup de ruleta para captar emails y dar descuentos",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/spin-wheel-version.js",
      "event": "onfirstinteraction",
      "location": "store"
    },
    {
      "name": "Cuenta Regresiva PromoNube",
      "description": "Contador de urgencia en productos",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/countdown-version.js",
      "event": "onfirstinteraction",
      "location": "store"
    }
  ]
}
```

#### Paso 4: Publicar la versión

- Completar el proceso de publicación
- Esperar aprobación de TiendaNube (si aplica)

#### Paso 5: Actualizar en tiendas instaladas

- Las tiendas verán "Actualización disponible"
- Al actualizar, los App Embeds se instalarán automáticamente

✅ **VENTAJAS:**
- Setup único para todas las tiendas
- Instalación automática
- Más profesional
- Los clientes pueden activar/desactivar desde su panel

❌ **DESVENTAJAS:**
- Toma más tiempo (proceso de revisión)
- Requiere acceso al panel de Partners
- Las tiendas deben actualizar manualmente

---

## 🔄 Flujo de Actualización de Contenido

**Importante:** Una vez que los archivos estáticos están instalados (Método A o B), puedes actualizar el contenido sin tocar nada más:

1. **Modificas el código en `functions/index.js`:**
   - Ej: Cambias la lógica del Light Toggle

2. **Despliegas:**
   ```bash
   firebase deploy --only functions
   ```

3. **¡Listo!** Los cambios se reflejan automáticamente en todas las tiendas porque el archivo estático carga el contenido dinámico desde Cloud Functions.

**No necesitas:**
- ❌ Actualizar los archivos `.js` en Firebase Hosting
- ❌ Crear nueva versión de la app
- ❌ Tocar el código del tema

---

## 🛠️ Mantenimiento de Archivos Estáticos

Los archivos estáticos solo necesitan actualizarse si:

- Cambias la **lógica de detección de Store ID**
- Cambias la **URL de Cloud Functions**
- Agregas **validaciones previas** antes de cargar el widget

### Cómo actualizar:

1. Editar los archivos en la raíz del proyecto:
   - `style-widget-version.js`
   - `spin-wheel-version.js`
   - `countdown-version.js`

2. Copiar a `public/`:
   ```powershell
   Copy-Item *-version.js public\
   ```

3. Desplegar:
   ```bash
   firebase deploy --only hosting
   ```

4. Los cambios se reflejan en ~5 minutos (cache de CDN)

---

## 📊 Comparación de Métodos

| Aspecto | Método A (Manual) | Método B (Versión App) |
|---------|-------------------|------------------------|
| **Tiempo de setup** | 5 minutos | 1-2 días (revisión) |
| **Escalabilidad** | Baja (manual c/tienda) | Alta (automático) |
| **Profesionalismo** | Medio | Alto |
| **Actualización contenido** | Automática | Automática |
| **Requiere acceso tema** | ✅ Sí | ❌ No |
| **Requiere Partners** | ❌ No | ✅ Sí |

---

## 🎯 RECOMENDACIÓN

### Para Alto Rancho (HOY):
→ **Método A** (Agregar al tema)
- Funciona en 5 minutos
- Sin esperas ni aprobaciones

### Para escalabilidad futura:
→ **Método B** (Nueva versión)
- Una sola vez
- Todos los clientes futuros lo tienen automáticamente

---

## 📝 Checklist: Implementación Método A (Alto Rancho)

**Light Toggle:**
- [ ] Admin → Temas → Editar código
- [ ] Abrir `layout/theme.tpl`
- [ ] Agregar `<script src="https://pedidos-lett-2.web.app/style-widget-version.js" async></script>` antes de `</head>`
- [ ] Guardar
- [ ] Verificar en https://altorancho.com/iluminacion/lamparas-inalambricas

**Ruleta (si está activa):**
- [ ] El mismo script carga la ruleta automáticamente

**Countdown (si está activo):**
- [ ] El mismo script carga el countdown automáticamente

---

## 🐛 Troubleshooting

### Script no se carga:

1. **Verificar que el script está en el HTML:**
   - F12 → Sources → buscar `style-widget-version.js`

2. **Ver errores en consola:**
   - F12 → Console
   - Buscar mensajes de "PromoNube"

3. **Verificar Store ID:**
   - F12 → Console → escribir: `window.LS.store.id`
   - Debería devolver el store ID

### Light Toggle no aparece:

1. **Verificar URL:**
   - Debe estar en la categoría configurada
   - Verificar en Firestore: `promonube_style_config/{storeId}` → `lightToggle.categoryUrl`

2. **Verificar configuración:**
   - Firestore → `promonube_style_config/{storeId}`
   - `lightToggle.enabled` debe ser `true`

### Ruleta no aparece:

1. **Verificar que hay una ruleta activa:**
   - Firestore → `promonube_spin_wheels`
   - Buscar un documento con `storeId` correcto y `active: true`

2. **Verificar que no participaste antes:**
   - localStorage → buscar `promonube_wheel_`
   - Eliminar para testear de nuevo

---

## 📧 Scripts de Diagnóstico

Creamos varios scripts en `functions/` para diagnosticar problemas:

- `check-altorancho-scripts.cjs` - Ver scripts instalados
- `check-app-mode.cjs` - Verificar modo desarrollo/producción
- `setup-production-script.cjs` - Instrucciones de setup

Para ejecutar:
```bash
cd functions
node check-altorancho-scripts.cjs
```

---

## 🎉 Resultado Final

Una vez implementado, Alto Rancho tendrá:

✅ **Light Toggle funcionando** en categoría de lámparas
✅ **Ruleta** (si está activa)
✅ **Countdown** (si está activo)
✅ **WhatsApp personalizado** (si está configurado)
✅ **Menú personalizado** (si está configurado)
✅ **Banners en carrusel** (si están configurados)

Todo **sin necesidad de nueva versión** cuando cambies la configuración.

---

## 🚀 Próximos Pasos

1. **Para Alto Rancho:**
   - Implementar Método A (5 minutos)
   - Verificar que todo funciona

2. **Para escalar:**
   - Implementar Método B (nueva versión)
   - Documentar en onboarding de nuevos clientes

3. **Monitoreo:**
   - Ver logs en Cloud Functions
   - Verificar analytics de uso

---

**Creado:** 26/11/2025  
**Última actualización:** 26/11/2025
