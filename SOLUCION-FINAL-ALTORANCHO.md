# ✅ SOLUCIÓN FINAL: Light Toggle en Alto Rancho

## 📊 Estado Actual

Según la captura de "Scripts" en TiendaNube:
- ✅ Script #3564 - Ruleta (Auto instalado, Dev mode)
- ✅ Script #3573 - Countdown (Auto instalado, Dev mode)
- ✅ Script #3575 - Personalizador Style (1 versión, Dev mode)
- ✅ Script #3644 - Light Toggle (2 versiones, Auto instalado)

**Los scripts YA ESTÁN REGISTRADOS** pero están en "Dev mode" y **sin contenido** (por eso no funcionan).

---

## 🎯 SOLUCIÓN IMPLEMENTADA

### 1. Auto-instalación al guardar config
- ✅ Cuando guardas en el panel de Style, el backend automáticamente verifica e instala el script
- ✅ Agregué botón "🔄 Sincronizar Script" para forzar la instalación manualmente

### 2. Archivos estáticos desplegados
- ✅ `https://pedidos-lett-2.web.app/style-widget-version.js` (auto-detecta store ID)
- ✅ `https://pedidos-lett-2.web.app/spin-wheel-version.js`
- ✅ `https://pedidos-lett-2.web.app/countdown-version.js`

---

## 🚀 PRÓXIMOS PASOS (2 opciones)

### OPCIÓN A: Actualizar App Embeds desde TiendaNube Partners (RECOMENDADO)

Como tu app NO está en el catálogo público aún, tienes acceso al panel de Partners:

#### Paso 1: Ir a TiendaNube Partners
- https://partners.tiendanube.com/

#### Paso 2: Editar los App Embeds existentes

Para cada uno de los 4 scripts (#3564, #3573, #3575, #3644):

1. Click en el script → "Editar versión" o "Crear nueva versión"

2. En el código del App Embed, cambiar la URL a:

**#3575 - Personalizador Style:**
```javascript
url: "https://pedidos-lett-2.web.app/style-widget-version.js"
event: "onload"
location: "store"
```

**#3564 - Ruleta:**
```javascript
url: "https://pedidos-lett-2.web.app/spin-wheel-version.js"
event: "onfirstinteraction"
location: "store"
```

**#3573 - Countdown:**
```javascript
url: "https://pedidos-lett-2.web.app/countdown-version.js"
event: "onfirstinteraction"  
location: "store"
```

3. **Publicar las versiones**

4. En Alto Rancho, ir a "Scripts" y **actualizar cada App Embed** a la nueva versión

✅ **RESULTADO:** Los scripts se cargarán automáticamente con el contenido correcto

---

### OPCIÓN B: Agregar manualmente al tema (5 minutos)

Si no tienes acceso a Partners o quieres probar YA:

1. Admin Alto Rancho → Temas → Personalizar → Editar código

2. Abrir `layout/theme.tpl`

3. Buscar `</head>` y ANTES agregar:

```html
<!-- PromoNube Widgets -->
<script src="https://pedidos-lett-2.web.app/style-widget-version.js" async></script>
```

4. Guardar y verificar en: https://altorancho.com/iluminacion/lamparas-inalambricas

---

## 🔍 POR QUÉ NO FUNCIONA ACTUALMENTE

Los App Embeds que ves en la captura son **"placeholders"** creados cuando instalaste la app en Dev mode. Están registrados pero **no tienen código/contenido**.

TiendaNube los lista como "Auto instalado" porque detecta que la app los declaró, pero al no tener una **versión con código**, no hacen nada.

**Analogía:** Es como tener el "envoltorio" del regalo (el App Embed registrado) pero vacío por dentro (sin código JavaScript).

---

## 🎯 RECOMENDACIÓN FINAL

**Para PROBAR HOY (Alto Rancho):**
→ **Opción B** (Agregar al tema manualmente)
- Tiempo: 5 minutos
- Funciona inmediatamente
- Sin depender de Partners

**Para ESCALAR (antes de lanzar al catálogo):**
→ **Opción A** (Actualizar App Embeds)
- Setup único
- Todas las tiendas futuras lo tienen automáticamente
- Más profesional

---

## 🧪 TESTEO

Una vez implementada una de las 2 opciones:

1. **Abrir:** https://altorancho.com/iluminacion/lamparas-inalambricas

2. **Buscar el toggle** al lado de "DESTACADO":
   ```
   Filtros:  [DESTACADO]    Light: [⚪ OFF]
   ```

3. **Activar el toggle:**
   - Las imágenes de productos deben cambiar
   - El toggle debe cambiar a [🟠 ON]

4. **Verificar en consola** (F12):
   ```
   PromoNube Style Widget: Loading for store 2547699
   PromoNube: ✅ Estamos en la categoría correcta! Creando toggle...
   ```

---

## 💡 BONUS: Botón de Sincronización

Ya agregué un botón "🔄 Sincronizar Script" en el panel de Style.

**Cómo usarlo:**
1. Abrir panel PromoNube → Style
2. Click en "🔄 Sincronizar Script"
3. Esperar confirmación

Esto intenta registrar el script vía API (solo funciona en Dev mode, que es tu caso).

---

## 📋 Resumen de lo que hicimos hoy

✅ Diagnosticamos el problema (app en producción sin versiones de App Embeds)
✅ Creamos archivos JavaScript estáticos auto-detectores de store ID
✅ Los desplegamos en Firebase Hosting (públicos)
✅ Agregamos auto-instalación al guardar configuración (backend)
✅ Agregamos botón manual de sincronización (frontend)
✅ Documentamos 2 soluciones claras

---

## 🎉 ¡Todo listo!

Ahora solo falta **elegir e implementar una de las 2 opciones** y el Light Toggle funcionará perfectamente en Alto Rancho.

---

**Creado:** 26/11/2025  
**Archivo:** SOLUCION-FINAL-ALTORANCHO.md
