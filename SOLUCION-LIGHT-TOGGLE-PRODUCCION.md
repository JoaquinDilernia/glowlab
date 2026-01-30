# 🔧 Solución: Light Toggle en Producción

## 📋 El Problema

El **Light Toggle** funciona en desarrollo pero NO en producción (versión publicada) porque:

- ✅ Configuración guardada correctamente
- ✅ Feature activado en Firestore
- ❌ **App en modo PRODUCCIÓN** → No permite scripts dinámicos vía API
- ❌ App Embeds sin código (`current_version: null`)

---

## ✅ SOLUCIÓN RECOMENDADA: Script Estático + Carga Dinámica

Ya implementamos un **archivo estático** que auto-detecta el store ID y carga el contenido dinámico:

**URL del script:** `https://pedidos-lett-2.web.app/style-widget-version.js`

### Cómo funciona:
1. El archivo `.js` estático se sirve desde Firebase Hosting
2. Auto-detecta el store ID de la tienda (compatible con todas las tiendas)
3. Carga dinámicamente el contenido real desde Cloud Functions
4. **Se actualiza sin necesidad de nueva versión de app** ✨

---

## 🚀 IMPLEMENTACIÓN

### Opción A: Agregar al Tema Manualmente (5 minutos)

**La forma MÁS RÁPIDA de hacerlo funcionar:**

1. **Ir al admin de Alto Rancho:**
   - https://admin.tiendanube.com/apps/configuration/webshop/themes

2. **Personalizar tema:**
   - Click en "Personalizar" en el tema actual
   - Ir a "Acciones" → "Editar código"

3. **Editar `layout/theme.tpl`:**
   - Buscar la etiqueta `</head>`
   - **ANTES** de `</head>`, agregar:
   
   ```html
   <!-- PromoNube Style Widget -->
   <script src="https://pedidos-lett-2.web.app/style-widget-version.js" async></script>
   ```

4. **Guardar y verificar:**
   - Ir a: https://altorancho.com/iluminacion/lamparas-inalambricas
   - El toggle debería aparecer al lado de "DESTACADO"

**✅ VENTAJAS:**
- Funciona INMEDIATAMENTE
- No requiere nueva versión de app
- Compatible con todas las funciones (WhatsApp, Banners, Menú, Light Toggle)

**❌ DESVENTAJAS:**
- Hay que agregar el código manualmente
- Si el cliente cambia de tema, hay que volver a agregarlo

---

### Opción B: Nueva Versión de App (Solución Profesional)

Para que el script se instale **automáticamente** al activar la app:

1. **Ir a TiendaNube Partners:**
   - https://partners.tiendanube.com/

2. **Seleccionar PromoNube App**

3. **Crear Nueva Versión:**
   - Click en "Versiones" → "Crear nueva versión"

4. **Agregar App Embed al manifest.json:**

```json
{
  "app_embeds": [
    {
      "name": "Personalizador Style PromoNube",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/style-widget-version.js",
      "event": "onload",
      "location": "store"
    },
    {
      "name": "Ruleta de Premios PromoNube",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/spin-wheel-version.js",
      "event": "onfirstinteraction",
      "location": "store"
    },
    {
      "name": "Cuenta Regresiva PromoNube",
      "type": "external_javascript",
      "url": "https://pedidos-lett-2.web.app/countdown-version.js",
      "event": "onfirstinteraction",
      "location": "store"
    }
  ]
}
```

5. **Publicar la versión**

6. **Actualizar en Alto Rancho:**
   - La nueva versión aparecerá como "Actualización disponible"
   - Instalarla

**✅ VENTAJAS:**
- Instalación automática
- Profesional
- Fácil para el cliente activar/desactivar

**❌ DESVENTAJAS:**
- Toma más tiempo (proceso de revisión de TiendaNube)
- Requiere acceso al panel de Partners

---

### Opción C: Modo Desarrollo Temporal (Para Testing)

Si necesitas testear rápidamente:

1. **Desinstalar la versión actual** de PromoNube en Alto Rancho
2. **Reinstalar en modo desarrollo** (sin versión publicada)
3. El script se agregará vía API automáticamente
4. Una vez testeado, volver a publicar versión

**⚠️ NO RECOMENDADO** para producción, solo para testing.

---

## 🎯 RECOMENDACIÓN FINAL

**Para Alto Rancho (HOY):**
→ **Usar Opción A** (Agregar al tema manualmente)
- Funciona en 5 minutos
- No requiere esperar aprobación de TiendaNube
- El cliente puede probar el feature inmediatamente

**Para el futuro (Próximos clientes):**
→ **Implementar Opción B** (Nueva versión de app)
- Una sola vez
- Todos los clientes futuros lo tendrán automáticamente
- Más profesional y escalable

---

## 📝 Checklist de Implementación (Opción A)

- [ ] Ir a admin Alto Rancho → Temas
- [ ] Personalizar tema actual → Editar código
- [ ] Abrir `layout/theme.tpl`
- [ ] Buscar `</head>`
- [ ] Agregar `<script src="https://pedidos-lett-2.web.app/style-widget-version.js" async></script>`
- [ ] Guardar cambios
- [ ] Abrir https://altorancho.com/iluminacion/lamparas-inalambricas
- [ ] Verificar que aparece el toggle "Light:"
- [ ] Probar activar/desactivar
- [ ] Verificar que cambian las imágenes de los productos

---

## 🐛 Troubleshooting

### El toggle no aparece:
1. Abrir consola del navegador (F12)
2. Buscar logs de "PromoNube"
3. Verificar que no haya errores de carga
4. Verificar que estás en la URL correcta: `/lamparas-inalambricas`

### El toggle aparece pero no funciona:
1. Verificar que los productos tienen 2 imágenes (apagada y prendida)
2. Ver consola: debería decir "Luz ENCENDIDA" o "Luz APAGADA"
3. Verificar configuración en Firestore (categoryUrl debe ser correcto)

### Quiero cambiar el texto o la categoría:
1. Ir al panel de PromoNube → Style → Toggle Luz
2. Cambiar configuración
3. Guardar
4. El cambio es instantáneo (el script carga la config dinámicamente)

---

## 📧 Soporte

Si necesitas ayuda:
- La configuración se guarda en Firestore: `promonube_style_config/{storeId}`
- El script dinámico se genera en: `/api/style-widget.js`
- El archivo estático está en Firebase Hosting

---

## 🎉 Resultado Esperado

Una vez implementado, en la categoría de lámparas:

```
Filtros:  [DESTACADO]    Light: [⚪ OFF]  ← Toggle aparece aquí
```

Al activar el toggle:
- Las imágenes de productos cambian de apagada → prendida
- El toggle cambia a [🟠 ON]
- Se guarda el estado en localStorage
