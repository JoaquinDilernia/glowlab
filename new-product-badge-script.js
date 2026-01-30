// ============================================
// PROMONUBE - NEW PRODUCT BADGE SCRIPT
// ============================================
// Este script se registra en el Panel de Socios de TiendaNube
// URL: https://apipromonube-jlfopowzaq-uc.a.run.app/api/new-badge-script.js?store={STORE_ID}

/*
FUNCIONALIDAD:
- Detecta productos creados recientemente (configurable en días)
- Agrega automáticamente un badge "NUEVO" visual
- Totalmente personalizable: colores, forma, posición, texto
- Compatible con temas de TiendaNube
- Sin modificar código del tema

CONFIGURACIÓN:
Desde el panel de PromoNube:
1. Ir a "Badge 'Nuevo'" en el Dashboard
2. Configurar días, texto, colores y posición
3. Activar el badge
4. El script se actualiza automáticamente

INSTALACIÓN EN TIENDANUBE:
1. Panel de Partners → Tu App → App Embeds
2. Crear nuevo script:
   - Nombre: PromoNube - Badge Productos Nuevos
   - URL: https://apipromonube-jlfopowzaq-uc.a.run.app/api/new-badge-script.js?store={STORE_ID}
   - Evento: onload
   - Donde: store (toda la tienda)
3. Guardar y publicar

COMPATIBILIDAD:
- Detecta productos usando schema.org markup
- Funciona con lazy loading
- Observa cambios dinámicos en el DOM
- Compatible con todos los temas de TiendaNube

PERSONALIZACIÓN:
El script lee la configuración desde Firestore:
- daysToShowAsNew: Cantidad de días para considerar "nuevo"
- badgeText: Texto del badge (ej: "NUEVO", "NEW", "¡RECIÉN LLEGADO!")
- badgePosition: top-left, top-right, bottom-left, bottom-right
- badgeShape: rectangular, rounded, circular, ribbon
- backgroundColor: Color de fondo (hex)
- textColor: Color del texto (hex)
- fontSize: Tamaño de fuente
- fontWeight: Grosor de fuente
- padding: Espaciado interno
- borderRadius: Radio de bordes
- customCSS: CSS adicional personalizado

EJEMPLO DE CONFIGURACIÓN:
{
  "enabled": true,
  "daysToShowAsNew": 30,
  "badgeText": "NUEVO",
  "badgePosition": "top-left",
  "badgeShape": "rounded",
  "backgroundColor": "#ff4757",
  "textColor": "#ffffff",
  "fontSize": "12px",
  "fontWeight": "700",
  "padding": "6px 12px",
  "borderRadius": "20px"
}

DETECCIÓN DE PRODUCTOS:
El script busca la fecha de creación en:
1. Schema.org: <meta itemprop="datePublished" content="...">
2. Data attributes: data-created-at, data-date
3. Meta tags: <meta property="product:availability_starts">

Para asegurar compatibilidad, TiendaNube debería incluir:
<div itemtype="http://schema.org/Product" data-created-at="2026-01-01T00:00:00Z">
  <meta itemprop="datePublished" content="2026-01-01T00:00:00Z">
  ...
</div>

NOTAS IMPORTANTES:
⚠️ El script es generado dinámicamente por el backend
⚠️ La configuración se actualiza en tiempo real
⚠️ No cachear el script (headers: no-cache)
⚠️ Requiere que TiendaNube incluya fechas de creación en el HTML

VERSIÓN: 1.0.0
AUTOR: PromoNube
FECHA: Enero 2026
*/

// El código real se sirve dinámicamente desde:
// /api/new-badge-script.js
