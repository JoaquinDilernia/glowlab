# Imagen del Dropdown (Menú) — imágenes independientes desktop/mobile — Spec de diseño
**Fecha:** 2026-08-07
**Estado:** Aprobado para implementación

---

## Resumen

Cambia el módulo **Imagen del Dropdown** dentro de Style → Menú de Navegación (`src/pages/StyleConfig.jsx`, widget servido en el script de menú de `functions/index.js`), replicando el mismo esquema ya implementado en Banner Home:

1. Se agrega la medida recomendada **1080×1350 px**, con aviso no bloqueante si la imagen subida no coincide.
2. La imagen del dropdown pasa de ser un único campo (`item.imageUrl`, mostrado igual en desktop y mobile) a dos casilleros independientes: **desktop** (`item.imageUrl`, campo existente, sin renombrar) y **mobile** (`item.imageMobileUrl`, campo nuevo, opcional). Sin fallback entre ellos: si falta la imagen de un dispositivo, no se muestra nada del módulo en ese dispositivo.

Las tiendas que ya tienen una imagen de dropdown cargada la conservan tal cual — ese valor pasa a interpretarse como la imagen **desktop**. En mobile no se muestra nada hasta que carguen explícitamente una imagen mobile nueva (decisión confirmada: sin fallback, igual que Banner Home).

**Fuera de alcance:** el modo avanzado opt-in "Mega-menú flotante" (`item.megaMenu === true`, panel activado por hover) no se toca — sigue usando únicamente `item.imageUrl` (desktop) como hoy, porque es una función pensada para desktop (activada por hover, no aplica en touch).

---

## Arquitectura

### 1. Panel de admin (`src/pages/StyleConfig.jsx`)

**Estado actual** (líneas ~1225-1350, dentro del `.map` de `config.menu.items`): un único bloque "Imagen del Dropdown" con un `<input type="text">` (`item.imageUrl`, placeholder `https://mitienda.com/imagen.jpg`) y un botón "Subir" que dispara `uploadMenuImage(index, file)` → `POST /api/upload-image-base64` (folder `menu-images`) → guarda la URL resultante en `item.imageUrl` vía `updateMenuItem(index, 'imageUrl', url)`. Debajo, preview de `item.imageUrl` si existe, con botón de eliminar.

**Nuevo comportamiento**, mismo patrón visual que Banner Home:

- El bloque "Imagen del Dropdown" se divide en dos sub-bloques, cada uno con su propio campo de URL, botón "Subir", input de archivo oculto, mensaje de estado inline y preview con botón eliminar:
  - **"Imagen desktop"** — campo `item.imageUrl` (el mismo de siempre, sin migración de datos).
  - **"Imagen mobile (opcional)"** — campo nuevo `item.imageMobileUrl`, con hint *"Si no la subís, no se muestra en mobile."*
- Se agrega el aviso **"📐 Medida recomendada: 1080 × 1350 px"** en el encabezado del bloque (mismo lugar donde hoy está el texto "Desktop: aparece dentro del dropdown · Mobile: debajo de las subcategorías", que se conserva porque describe la ubicación, no la medida).
- `uploadMenuImage(index, file, field)` se generaliza con un tercer parámetro `field` (`'imageUrl'` o `'imageMobileUrl'`) para poder reusar la misma función con ambos campos, en vez de duplicarla. `fileInputRefs`, `uploadingIndex` y `uploadMessages` pasan a indexarse por una clave compuesta (`` `${index}-${field}` ``) en vez de solo `index`, para que subir la imagen mobile no pise el estado de "subiendo" de la desktop (y viceversa).
- Validación de medida: mismo mecanismo que Banner Home — al seleccionar un archivo, se lee `naturalWidth`/`naturalHeight` vía `Image()` + `URL.createObjectURL` antes de subir; si no es 1080×1350 se muestra un aviso no bloqueante (`toast.info`) y la subida continúa igual. Se implementa como función auxiliar local a `StyleConfig.jsx` (mismo enfoque que `getImageDimensions` en `BannerConfig.jsx`, sin extraer a un util compartido — no hay un módulo de utils compartido hoy entre páginas de config).

### 2. Widget de la tienda (`functions/index.js`, script de menú, ~líneas 11349-11655)

**Condición de activación** (línea ~11349): hoy `if (item.imageUrl && item.imageUrl.trim() !== '')`. Pasa a:
```js
var hasDesktopImg = item.imageUrl && item.imageUrl.trim() !== '';
var hasMobileImg = item.imageMobileUrl && item.imageMobileUrl.trim() !== '';
if (hasDesktopImg || hasMobileImg) {
```
para que el bloque se ejecute aunque solo exista la imagen mobile.

**Mega-menú flotante** (~líneas 11360-11447): sin cambios de esquema — sigue usando `item.imageUrl` como única fuente (`config.imageUrl: item.imageUrl`). Se agrega solo un guard: si `!hasDesktopImg`, se saltea la rama `megaMenu` (`continue` a la lógica normal) en vez de crear un panel con `<img src="">` vacío — cubre el caso borde de una tienda que solo cargó imagen mobile y tiene `megaMenu: true` activado.

**Inyección normal del dropdown** (tres lugares — wrapper existente ~11510-11516, wrapper nuevo ~11517-11549, fallback dropdown ~11553-11582): hoy cada uno crea/actualiza **un** `<img src="item.imageUrl">`. Pasa a crear/actualizar **hasta dos** `<img>`, cada uno omitido si su URL no existe (sin fallback entre sí, igual que Banner Home):

```js
// en vez de un solo <img>:
if (hasDesktopImg) {
  var imgDesktop = document.createElement('img');
  imgDesktop.src = item.imageUrl;
  imgDesktop.alt = 'Menu Image';
  imgDesktop.className = 'pn-menu-dropdown-img pn-menu-dropdown-img-desktop';
  // ...mismos estilos que hoy...
  imageContainer.appendChild(imgDesktop);
}
if (hasMobileImg) {
  var imgMobile = document.createElement('img');
  imgMobile.src = item.imageMobileUrl;
  imgMobile.alt = 'Menu Image';
  imgMobile.className = 'pn-menu-dropdown-img pn-menu-dropdown-img-mobile';
  // ...mismos estilos que hoy...
  imageContainer.appendChild(imgMobile);
}
```
Misma lógica aplica al branch de "actualizar imagen existente" (buscar ambos `<img>` por clase dentro del wrapper, o recrear el contenido — lo que resulte más simple de implementar sin duplicar código, a criterio de quien implemente) y al fallback dropdown.

**CSS** (~líneas 11590-11655, dentro del `<style id="pn-menu-image-styles">` ya existente): se agrega, junto al `@media (max-width: 768px)` que ya existe en ese bloque:
```css
@media (max-width: 768px) {
  .pn-menu-dropdown-img-desktop { display: none !important; }
}
@media (min-width: 769px) {
  .pn-menu-dropdown-img-mobile { display: none !important; }
}
```
(El resto de las reglas existentes para `.pn-menu-dropdown-img` — `max-height`, `border-radius`, `object-fit`, etc. — se mantienen igual, aplican a ambas por el selector compartido `.pn-menu-dropdown-img`.)

---

## Fuera de alcance

- Mega-menú flotante: no se le agrega imagen mobile (confirmado — es una función de hover, pensada para desktop).
- No se recorta ni redimensiona la imagen del lado del servidor — la validación de medida es solo informativa, client-side.
- No se migra ningún dato existente — `item.imageUrl` conserva su valor y su significado pasa a ser "imagen desktop" sin ningún cambio de esquema en Firestore.
- No se cambia la lógica de posicionamiento del dropdown (las 5 estrategias de búsqueda del elemento `dropdown` en el DOM del tema) ni el resto de las funciones del item de menú (emoji, color, negrita, tamaño de fuente, posición).

---

## Testing

- Frontend: en un item de menú, subir una imagen desktop y una mobile por separado, confirmar que cada una tiene su propio estado de "subiendo"/mensaje/preview independiente (subir una no debe afectar el estado de la otra). Subir una imagen que no mida 1080×1350 y confirmar que aparece el aviso pero la subida se completa igual.
- Backend/widget: con datos de prueba, verificar el HTML/JS generado en tres escenarios — (a) solo `imageUrl` seteado → el dropdown debe insertar únicamente el `<img class="pn-menu-dropdown-img-desktop">`; (b) solo `imageMobileUrl` seteado → debe insertarse únicamente el `<img class="pn-menu-dropdown-img-mobile">` (y el bloque debe activarse pese a no haber `imageUrl`); (c) ambos seteados → deben insertarse los dos, cada uno oculto por CSS fuera de su rango de pantalla.
- Mega-menú: con `item.megaMenu === true` y solo `imageMobileUrl` seteado (sin `imageUrl`), confirmar que el panel flotante NO se crea (guard aplicado) y que no rompe la ejecución del resto del loop de items.
