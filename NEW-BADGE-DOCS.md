# 🏷️ Badge de Productos Nuevos - PromoNube

## 📋 Descripción

Sistema automático para destacar productos recién agregados a la tienda con un badge visual personalizable. Los productos muestran un indicador "NUEVO" durante un período configurable de días desde su creación.

---

## ✨ Características

### Configuración Flexible
- ⏰ **Días personalizables**: Define cuántos días un producto se considera "nuevo" (1-365 días)
- ✏️ **Texto customizable**: Personaliza el mensaje del badge ("NUEVO", "NEW", "¡RECIÉN LLEGADO!", etc.)
- 🎨 **Diseño totalmente adaptable**: Colores, formas, tamaños y posiciones

### Estilos Disponibles

**Formas:**
- Rectangular (con bordes configurables)
- Redondeado
- Circular
- Ribbon/Cinta

**Posiciones:**
- Esquina superior izquierda
- Esquina superior derecha
- Esquina inferior izquierda
- Esquina inferior derecha

**Personalización Visual:**
- Color de fondo
- Color de texto
- Tamaño de fuente
- Grosor de fuente
- Padding
- Border radius
- CSS personalizado adicional

### Visibilidad
- ✅ Página de producto individual
- ✅ Páginas de categorías/colecciones
- ✅ Página de inicio
- ✅ Cualquier listado de productos

---

## 🚀 Instalación

### Paso 1: Configurar en PromoNube

1. Inicia sesión en PromoNube
2. Ve al Dashboard
3. Haz clic en **"Badge 'Nuevo'"**
4. Configura:
   - Días para considerar nuevo
   - Texto del badge
   - Diseño y colores
   - Posición
5. **Activa** el badge
6. Haz clic en **"Guardar"**

### Paso 2: Instalar Script en TiendaNube

#### Opción A: App Embeds (Recomendado)

1. Ve al **[Panel de Partners de TiendaNube](https://partners.tiendanube.com/)**
2. Selecciona tu app **PromoNube**
3. Ve a la sección **"App Embeds"**
4. Crea un nuevo **Script Tag**:
   ```
   Handle: promonube-badge-productos-nuevos
   Nombre: PromoNube - Badge Productos Nuevos
   URL: https://apipromonube-jlfopowzaq-uc.a.run.app/api/new-badge-script.js?store={{store_id}}
   Evento: onload
   Dónde: store (toda la tienda)
   ```
5. **Guarda** y **publica** el App Embed

#### Opción B: Script Tag Manual

Si tienes acceso a la API:

```javascript
POST https://api.tiendanube.com/v1/{store_id}/scripts

{
  "handle": "promonube-badge-productos-nuevos",
  "src": "https://apipromonube-jlfopowzaq-uc.a.run.app/api/new-badge-script.js?store={{store_id}}",
  "event": "onload",
  "where": "store"
}
```

---

## ⚙️ Configuración Detallada

### Configuración General

| Campo | Descripción | Valores | Por Defecto |
|-------|-------------|---------|-------------|
| `enabled` | Activar/desactivar badge | `true` / `false` | `false` |
| `daysToShowAsNew` | Días desde creación | `1-365` | `30` |
| `badgeText` | Texto mostrado | String (máx 15 chars) | `"NUEVO"` |

### Configuración de Diseño

| Campo | Descripción | Valores | Por Defecto |
|-------|-------------|---------|-------------|
| `badgeShape` | Forma del badge | `rectangular`, `rounded`, `circular`, `ribbon` | `rectangular` |
| `badgePosition` | Posición | `top-left`, `top-right`, `bottom-left`, `bottom-right` | `top-left` |
| `backgroundColor` | Color de fondo | Hex color | `#ff4757` |
| `textColor` | Color de texto | Hex color | `#ffffff` |
| `fontSize` | Tamaño de fuente | CSS size (px, em, rem) | `12px` |
| `fontWeight` | Grosor de fuente | `400`, `500`, `600`, `700`, `800` | `700` |
| `padding` | Espaciado interno | CSS padding | `6px 12px` |
| `borderRadius` | Radio de bordes | CSS border-radius | `4px` |
| `customCSS` | CSS adicional | CSS válido | `""` |

### Configuración de Visibilidad

| Campo | Descripción | Por Defecto |
|-------|-------------|-------------|
| `showOnProductPage` | Mostrar en página de producto | `true` |
| `showOnCategoryPage` | Mostrar en categorías | `true` |
| `showOnHomePage` | Mostrar en inicio | `true` |

---

## 🎨 Ejemplos de Configuración

### Estilo Minimalista
```json
{
  "enabled": true,
  "daysToShowAsNew": 14,
  "badgeText": "NEW",
  "badgeShape": "rectangular",
  "badgePosition": "top-right",
  "backgroundColor": "#000000",
  "textColor": "#ffffff",
  "fontSize": "10px",
  "fontWeight": "600",
  "padding": "4px 10px",
  "borderRadius": "2px"
}
```

### Estilo Bold y Llamativo
```json
{
  "enabled": true,
  "daysToShowAsNew": 30,
  "badgeText": "¡NUEVO!",
  "badgeShape": "rounded",
  "badgePosition": "top-left",
  "backgroundColor": "#ff4757",
  "textColor": "#ffffff",
  "fontSize": "14px",
  "fontWeight": "800",
  "padding": "8px 16px",
  "borderRadius": "25px",
  "customCSS": "box-shadow: 0 4px 12px rgba(255,71,87,0.4);"
}
```

### Estilo Circular Elegante
```json
{
  "enabled": true,
  "daysToShowAsNew": 21,
  "badgeText": "N",
  "badgeShape": "circular",
  "badgePosition": "top-right",
  "backgroundColor": "#6366f1",
  "textColor": "#ffffff",
  "fontSize": "16px",
  "fontWeight": "700"
}
```

---

## 🔧 API Endpoints

### GET `/api/new-badge-config/:storeId`
Obtiene la configuración actual del badge.

**Response:**
```json
{
  "success": true,
  "config": {
    "enabled": true,
    "daysToShowAsNew": 30,
    "badgeText": "NUEVO",
    ...
  }
}
```

### POST `/api/new-badge-config/:storeId`
Guarda o actualiza la configuración.

**Request Body:**
```json
{
  "enabled": true,
  "daysToShowAsNew": 30,
  "badgeText": "NUEVO",
  "badgeShape": "rectangular",
  "badgePosition": "top-left",
  ...
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuración guardada correctamente"
}
```

### GET `/api/new-badge-script.js?store={storeId}`
Devuelve el script JavaScript inyectable.

**Headers:**
- `Content-Type: application/javascript`
- `Cache-Control: no-cache, no-store, must-revalidate`

---

## 🏗️ Arquitectura Técnica

### Base de Datos (Firestore)

**Colección:** `promonube_new_badge_config`

**Documento ID:** `{storeId}`

**Estructura:**
```javascript
{
  storeId: string,
  enabled: boolean,
  daysToShowAsNew: number,
  badgeText: string,
  badgePosition: string,
  badgeShape: string,
  backgroundColor: string,
  textColor: string,
  fontSize: string,
  fontWeight: string,
  padding: string,
  borderRadius: string,
  showOnProductPage: boolean,
  showOnCategoryPage: boolean,
  showOnHomePage: boolean,
  customCSS: string,
  updatedAt: timestamp
}
```

### Script Inyectable

El script se genera dinámicamente y:

1. ✅ Lee la configuración desde Firestore
2. ✅ Busca productos en el DOM usando selectores comunes
3. ✅ Detecta la fecha de creación del producto
4. ✅ Calcula si es "nuevo" según los días configurados
5. ✅ Crea y aplica el badge con los estilos personalizados
6. ✅ Observa cambios en el DOM (lazy loading, filtros)

**Selectores de Productos:**
```javascript
const productSelectors = [
  '[itemtype="http://schema.org/Product"]',
  '.product-item',
  '.item-product',
  '.product',
  '[data-product-id]',
  '.js-item-product'
];
```

**Detección de Fecha de Creación:**
```javascript
// Prioridad 1: Schema.org
const datePublished = product.querySelector('[itemprop="datePublished"]')
  ?.getAttribute('content');

// Prioridad 2: Data attributes
const dataCreated = product.getAttribute('data-created-at') || 
  product.getAttribute('data-date');

// Prioridad 3: Meta tags
const metaDate = product.querySelector('meta[property="product:availability_starts"]')
  ?.getAttribute('content');
```

---

## ⚠️ Requisitos y Limitaciones

### Requisitos

1. **TiendaNube debe incluir fechas de creación** en el HTML de los productos:
   - En markup schema.org (`itemprop="datePublished"`)
   - O en data attributes (`data-created-at`)
   - O en meta tags

2. **Script instalado** en el Panel de Socios como App Embed

3. **Configuración activada** desde el panel de PromoNube

### Limitaciones

- ⚠️ **Depende de TiendaNube**: Si TN no incluye fechas de creación en el HTML, el badge no funcionará
- ⚠️ **No funciona con productos antiguos**: Solo productos con fecha de creación detectable
- ⚠️ **Sin caché**: El script se sirve sin caché para actualizaciones en tiempo real

### Alternativas si TiendaNube No Incluye Fechas

Si TiendaNube no expone `created_at` en el frontend:

**Opción 1:** Webhook + Sincronización
```javascript
// Webhook product/created
// Guardar en Firestore: producto + fecha de creación
// Script consulta Firestore para cada producto
```

**Opción 2:** API Consulta
```javascript
// Script hace fetch a tu backend
// Backend consulta TiendaNube API
// Devuelve lista de IDs de productos nuevos
```

**Opción 3:** Manual
```javascript
// Agregar manualmente data-created-at en el tema
<div class="product" data-created-at="{{ product.created_at }}">
```

---

## 📊 Métricas y Analytics

Actualmente el sistema **no registra métricas** del badge. 

Métricas futuras sugeridas:
- Impresiones del badge
- Clicks en productos con badge
- Conversión de productos con badge vs sin badge
- Productos más vistos con badge

---

## 🔄 Actualización y Mantenimiento

### Actualizar Configuración

1. Modificar configuración en el panel de PromoNube
2. Guardar cambios
3. El script se actualiza automáticamente (sin caché)
4. Los cambios se reflejan en ~1 minuto

### Desactivar Temporalmente

- Opción 1: Desactivar desde el panel (`enabled: false`)
- Opción 2: Eliminar el script tag desde TiendaNube

---

## 🐛 Troubleshooting

### El badge no aparece

1. ✅ Verificar que está **activado** en el panel
2. ✅ Verificar que el **script está instalado** en TiendaNube
3. ✅ Verificar que hay **productos nuevos** (dentro del rango de días)
4. ✅ Inspeccionar la consola del navegador:
   ```
   🏷️ PromoNube New Badge Script cargado
   🏷️ PromoNube: X productos procesados
   ```
5. ✅ Verificar que **TiendaNube incluye fechas** en el HTML

### El badge aparece mal posicionado

- Revisar configuración de `badgePosition`
- Verificar CSS personalizado
- Inspeccionar elemento en DevTools
- Ajustar padding y posición

### El badge se duplica

- Verificar que no hay múltiples scripts instalados
- Revisar que no hay conflictos con otros apps

---

## 📞 Soporte

Para soporte o consultas:
- 📧 Email: contacto@promonube.com
- 🌐 Panel de PromoNube: https://promonube.techdi.com.ar

---

## 📝 Changelog

### v1.0.0 (Enero 2026)
- ✨ Primera versión
- Configuración completa de diseño
- Soporte para 4 formas diferentes
- 4 posiciones configurables
- Preview en tiempo real
- CSS personalizado

---

## 🚀 Roadmap

Funcionalidades futuras:
- [ ] Sincronización automática con webhook `product/created`
- [ ] Analytics y métricas de rendimiento
- [ ] Múltiples badges (NUEVO, OFERTA, BESTSELLER)
- [ ] Animaciones configurables
- [ ] Prioridad de badges
- [ ] A/B Testing de diseños

---

**Creado por PromoNube** 🏷️  
**Versión:** 1.0.0  
**Fecha:** Enero 2026
