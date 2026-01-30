# Script: Barra de Ofertas Superior - TiendaNube

## 📋 Información del Script

**Nombre del script:** `PromoNube - Barra de Ofertas Superior`

**Script handle:** `promonube-barra-de-ofertas-superior`

**Versión:** 1.0.0

**Fecha de creación:** 12/01/2026

---

## 🚀 Instrucciones de Instalación en TiendaNube

### Paso 1: Acceder a Scripts
1. Ir a **TiendaNube** → **Aplicaciones** → **Mis aplicaciones** → **Scripts**
2. Click en **"Agregar script"**

### Paso 2: Configuración del Script

**Nombre del script:**
```
PromoNube - Barra de Ofertas Superior
```

**Script handle:** (dejar vacío, se auto-genera)

**Lugar de activación:**
- ✅ **Store** (en la tienda)

**Evento:**
- ✅ **onfirstinteraction** (al primer click/scroll del usuario)

**Usa NubeSDK:** NO (dejar apagado)

**Modo de desarrollo:** NO (dejar apagado)

**Instalación automática:** ✅ SÍ (activar el toggle)

### Paso 3: Copiar el Código

```javascript
// PromoNube Top Announcement Bar - Production Version
// Barra de ofertas SUPERIOR (arriba del menú de navegación)
// Auto-detects store ID from URL

(function() {
  'use strict';
  
  // Detectar store ID desde meta tags de TiendaNube
  function getStoreId() {
    // Método 1: Desde meta tag store-id
    const metaStoreId = document.querySelector('meta[name="store-id"]');
    if (metaStoreId && metaStoreId.content) {
      return metaStoreId.content;
    }
    
    // Método 2: Desde window.LS (TiendaNube object)
    if (window.LS && window.LS.store && window.LS.store.id) {
      return window.LS.store.id.toString();
    }
    
    // Método 3: Desde data-store en body
    const bodyStore = document.body.getAttribute('data-store');
    if (bodyStore) {
      return bodyStore;
    }
    
    // Método 4: Extraer de URLs de API en el HTML
    const apiLinks = document.querySelectorAll('[href*="/v1/"]');
    for (const link of apiLinks) {
      const match = link.href.match(/\/v1\/(\d+)\//);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    console.warn('PromoNube Top Announcement Bar: No se pudo detectar store ID');
    return null;
  }
  
  // Evitar carga doble
  if (window.promonubeTopAnnouncementBarLoading) {
    return;
  }
  window.promonubeTopAnnouncementBarLoading = true;
  
  const storeId = getStoreId();
  
  if (!storeId) {
    console.error('PromoNube Top Announcement Bar: Store ID no detectado. Script no se cargará.');
    return;
  }
  
  console.log('PromoNube Top Announcement Bar: Loading for store', storeId);
  
  // Cargar el script dinámico
  const script = document.createElement('script');
  script.src = `https://us-central1-pedidos-lett-2.cloudfunctions.net/apipromonube/api/top-announcement-bar-widget.js?store=${storeId}`;
  script.async = true;
  script.onerror = function() {
    console.error('PromoNube Top Announcement Bar: Error loading widget');
    window.promonubeTopAnnouncementBarLoading = false;
  };
  document.head.appendChild(script);
  
  console.log('PromoNube Top Announcement Bar: Script injected');
})();
```

### Paso 4: Guardar y Activar
1. Click en **"Crear script"**
2. El script quedará **Activado** automáticamente (instalación automática habilitada)

---

## ⚙️ Configuración en el Panel PromoNube

Después de crear el script:

1. Ir a **https://pedidos-lett-2.web.app**
2. Login con tus credenciales
3. Ir a **Style Pro** → **Barra Ofertas Superior** (pestaña 📣)
4. Activar el **toggle** principal
5. Configurar:
   - **Color de fondo** (default: #1a1a1a - negro)
   - **Color de texto** (default: #ffffff - blanco)
   - **Tamaño de fuente** (default: 13px)
   - **Peso de fuente** (default: 500 - Medium)
   - **Padding** (default: 11px)
6. Agregar **mensajes**:
   - Texto del mensaje (ej: "🔥 Black Friday: hasta 50% OFF")
   - Link opcional (ej: "https://tutienda.com/ofertas")
7. Click en **"Guardar Configuración"**

---

## 📊 Diferencias entre las 2 Barras

| Característica | Barra Superior | Barra Inferior |
|----------------|----------------|----------------|
| **Nombre** | PromoNube - Barra de Ofertas Superior | PromoNube - Barra de Ofertas |
| **Script ID** | (nuevo) | #3840 |
| **Posición** | ARRIBA del menú de navegación | ABAJO del menú de navegación |
| **Color default** | Negro (#1a1a1a) | Rojo oscuro (#8B0000) |
| **Pestaña en panel** | 📣 Barra Ofertas Superior | 📢 Barra de Ofertas |
| **Campo en DB** | `topAnnouncementBar` | `announcementBar` |
| **Endpoint backend** | `/api/top-announcement-bar-widget.js` | `/api/announcement-bar-widget.js` |

---

## 🔍 Verificación de Funcionamiento

### 1. Verificar que el script está activo
- TiendaNube → Aplicaciones → Scripts → Ver "PromoNube - Barra de Ofertas Superior" con badge **"Activado"**

### 2. Verificar configuración guardada
- Panel PromoNube → Style Pro → Barra Ofertas Superior → Debe mostrar la config guardada

### 3. Verificar en la tienda
1. Abrir la tienda en **modo incógnito** (Ctrl+Shift+N)
2. Abrir **DevTools** (F12) → pestaña **Console**
3. Buscar el log: `[PromoNube] Top Announcement Bar creada ✅`
4. Verificar visualmente que aparece la barra **ARRIBA** del menú

### 4. Verificar comportamiento
- **Desktop:** Todos los mensajes visibles con separadores `|`
- **Mobile:** Mensajes rotan cada 4 segundos (carrusel automático)
- **Links:** Si tiene link, el texto es clickeable

---

## 🐛 Troubleshooting

### ❌ No aparece la barra

**Causa 1:** Script no activado
- **Solución:** Ir a Scripts → Verificar que el toggle está en verde

**Causa 2:** Configuración no guardada
- **Solución:** Ir al panel → Activar toggle → Guardar configuración

**Causa 3:** Caché del navegador
- **Solución:** Ctrl+Shift+R o abrir en incógnito

**Causa 4:** Backend no desplegado
- **Solución:** Verificar que functions están deployadas (`firebase deploy --only functions`)

### ❌ Aparece pero no se ven los mensajes

**Causa:** Array de mensajes vacío
- **Solución:** Agregar al menos 1 mensaje en la configuración

### ❌ Aparece en posición incorrecta

**Causa:** Tema de TiendaNube con estructura diferente
- **Solución:** Revisar console para warnings del script

---

## 📝 Notas Técnicas

- **ID del elemento:** `pn-top-announcement-bar`
- **z-index:** 999 (superior al menú que suele ser 998)
- **Inserción:** Se inserta ANTES del `<header>` principal
- **Carga:** Asíncrona, no bloquea renderizado
- **Performance:** ~2KB gzipped
- **Compatible:** Todos los temas de TiendaNube

---

## 📞 Soporte

Si tenés problemas con la instalación:
- **Email:** info@techdi.com.ar
- **WhatsApp:** +54 9 11 64212370
