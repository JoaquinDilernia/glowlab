# Banner Home — imágenes independientes desktop/mobile — Spec de diseño
**Fecha:** 2026-08-07
**Estado:** Aprobado para implementación

---

## Resumen

Cambia el módulo **Banner Home** (`src/pages/BannerConfig.jsx`, widget servido por `GET /api/banner-widget.js` en `functions/index.js`) en dos aspectos:

1. La medida sugerida pasa de "1920×600 desktop / 768×500 mobile" a **1080×1350 px para ambos**, con aviso no bloqueante si la imagen subida no coincide.
2. Las imágenes de desktop y mobile dejan de tener relación de respaldo entre sí. Hoy, si falta la imagen mobile, se usa la de desktop como fallback en celulares. A partir de este cambio son dos casilleros completamente independientes: si falta la imagen de un dispositivo, el banner simplemente no se muestra en ese dispositivo.

No se agregan campos nuevos al modelo de datos — `imageUrl` (desktop) e `imageMobileUrl` (mobile) ya existen en `promonube_banners/{docId}`. El cambio es de comportamiento, no de esquema.

---

## Arquitectura

### 1. Validación de medidas (frontend, `src/pages/BannerConfig.jsx`)

Al seleccionar un archivo en cualquiera de los dos uploads (desktop o mobile), antes de subirlo:
- Se carga el archivo en un `Image()` de JS (`URL.createObjectURL` + `onload`) para leer `naturalWidth`/`naturalHeight`.
- Si `naturalWidth !== 1080 || naturalHeight !== 1350`, se muestra un aviso (toast o texto inline, no modal bloqueante) del tipo: *"Esta imagen mide {w}×{h}px. Se recomienda 1080×1350px."*
- La subida continúa igual sin importar el resultado de la validación — es informativa, no restrictiva.
- El cartel informativo existente en la pestaña "Imagen" (hoy: *"📐 Medidas recomendadas: 1920 × 600 px mínimo para desktop · 768 × 500 px para mobile"*) se actualiza a: *"📐 Medida recomendada: 1080 × 1350 px, tanto para desktop como para mobile."*

Esta validación se implementa una sola vez (función auxiliar) y se reutiliza para ambos uploads (desktop y mobile), ya que ambos comparten la misma medida objetivo.

### 2. Independencia total en el widget de la tienda (`functions/index.js`, `GET /api/banner-widget.js`)

**Estado actual** (líneas ~18266, ~18322-18324):
```js
const bannerEnabled = b.enabled && b.imageUrl; // requiere SÍ o SÍ imagen desktop

const imgInner = b.imageMobileUrl
  ? `<picture><source media="(max-width:767px)" srcset="${mobileUrl}"><img src="${desktopUrl}" ...></picture>`
  : `<img src="${desktopUrl}" ...>`;
```
Con `<picture>`, la imagen desktop (`<img>`) es siempre el elemento de respaldo — si no hay `srcset` de mobile aplicable (o directamente no existe `imageMobileUrl`), el navegador cae en el `<img>` de desktop en cualquier tamaño de pantalla. Por eso hoy mobile "hereda" la imagen de desktop cuando falta la propia.

**Nuevo comportamiento:**
- `bannerEnabled` pasa a `b.enabled && (b.imageUrl || b.imageMobileUrl)` — el banner se activa con **cualquiera** de las dos imágenes presentes, no solo desktop.
- Se reemplaza el patrón `<picture>` por dos elementos independientes, cada uno controlado por `@media` y cada uno **omitido del HTML si su URL no está seteada** (sin fallback entre ellos):

```html
<style>
  @media (max-width:767px){ .pn-banner-desktop{ display:none !important; } }
  @media (min-width:768px){ .pn-banner-mobile{ display:none !important; } }
</style>
<!-- Solo se emite el <img> de cada dispositivo si b.imageUrl / b.imageMobileUrl existen -->
<img class="pn-banner-desktop" src="..." alt="..." style="display:block;width:100%;height:auto;" loading="lazy">
<img class="pn-banner-mobile" src="..." alt="..." style="display:block;width:100%;height:auto;" loading="lazy">
```
- Si `linkUrl` está seteado, ambos `<img>` (los que existan) se envuelven en el mismo `<a>`, igual que hoy.
- El resto del widget (overlay, elementos de texto/botón superpuestos, selector de inyección, ancho contenido/completo) no cambia — sigue aplicándose igual sobre el contenedor que envuelve la(s) imagen(es).

### 3. Panel de admin (`src/pages/BannerConfig.jsx`)

No se agrega ningún toggle nuevo de "mostrar en desktop/mobile" — la visibilidad por dispositivo queda determinada implícitamente por si hay o no una URL cargada en cada casillero (subís → se muestra en ese dispositivo; usás el botón "Quitar" existente → deja de mostrarse en ese dispositivo). Se actualiza el texto de ayuda debajo de "Imagen mobile (opcional)" — hoy dice *"Si no la subís, se usa la imagen principal en todos los dispositivos"* — pasa a decir algo como *"Si no la subís, el banner no se muestra en mobile."*

---

## Fuera de alcance

- No se toca la pestaña "Contenido" (textos/botones superpuestos), "Diseño" (alineación, overlay, padding) ni "Posición" (selector CSS de inyección) — siguen funcionando igual sobre el contenedor combinado.
- No se recorta ni redimensiona la imagen automáticamente del lado del servidor — la validación es solo informativa client-side, tal como se definió.
- No se cambia el modelo de datos ni se migra nada existente — las tiendas que ya tengan imágenes cargadas con las medidas viejas siguen funcionando (la validación solo aplica a subidas nuevas).

---

## Testing

- Frontend: subir una imagen que no mida 1080×1350 y confirmar que aparece el aviso pero la subida se completa igual; subir una que sí mida 1080×1350 y confirmar que no aparece aviso.
- Backend/widget: con Firestore de prueba, verificar `GET /api/banner-widget.js?store=X` en tres escenarios — (a) solo `imageUrl` seteado → el HTML generado no debe contener ningún `<img class="pn-banner-mobile">`; (b) solo `imageMobileUrl` seteado → el banner debe activarse (`bannerEnabled` true) y el HTML no debe contener `<img class="pn-banner-desktop">`; (c) ambos seteados → deben estar los dos `<img>`, cada uno oculto por CSS fuera de su rango de pantalla.
