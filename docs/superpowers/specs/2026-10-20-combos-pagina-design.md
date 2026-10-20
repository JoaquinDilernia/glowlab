# Combos: página en la tienda con ficha propia por combo

Fecha: 2026-10-20 · Módulo: `functions/combos.js`, `src/pages/CombosConfig.jsx`
Mockup aprobado: `.superpowers/brainstorm/1426-1792509237/content/combos-v1.html`

## Intención

Hoy un combo solo se ve como una card dentro de la ficha de cada producto que lo
compone. El comercio quiere mostrarlo **como si fuera un producto**: una página
en el menú de la tienda con todos los combos y una ficha por combo, con fotos,
textos y precio propios, editable desde el admin.

**No** se crea un producto en Tiendanube (pedido explícito: puede traer
problemas de stock y pedidos). El combo sigue siendo lo que es hoy: al carrito
entran los productos reales y el descuento lo aplica la Discounts API.

## Qué se construye

### 1. Página de combos en la tienda — `/combos/`

- El comercio crea en Tiendanube una página vacía con esa dirección
  (configurable en el admin, igual que la lista de regalos) y la suma al menú.
  Todo queda en el dominio de la tienda.
- El script de combos (que ya carga desde el de Grupos de Variantes) detecta la
  página y la llena con una grilla tipo categoría: 4 columnas en escritorio y 2
  en el celular.
- Cada card muestra: la foto principal (al pasar el mouse cambia a la segunda,
  si la hay), el badge `-15%`, el nombre, la línea "qué incluye" (generada:
  `2 Lámpara Mini Hongo · cualquier color`, o el texto que cargue el comercio)
  y el precio **desde** con descuento, junto al precio por separado tachado.
- **Precio desde** = suma, por cada pieza, del precio más bajo con stock × la
  cantidad. Después se aplica el %. El tachado es esa misma suma sin descuento.
- Solo aparecen los combos activos, con "Mostrar en la página" encendido y con
  stock en todas sus piezas (la misma regla que hoy usa la card de la ficha).
- El orden es el de la lista del admin.
- Encabezado: título y bajada configurables (por defecto "Combos" y "Armá el
  conjunto en los colores que quieras y llevátelo con descuento.").

### 2. Ficha del combo — `/combos/?combo=<slug>`

- Es la misma página de Tiendanube con un parámetro. Tiendanube no tiene rutas
  propias para apps, así que no se puede `/combos/mesa-de-luz/` sin que dé 404.
- Layout de ficha de producto:
  - **Galería:** miniaturas a la izquierda e imagen grande. En el celular, la
    galería va arriba con las miniaturas abajo.
  - **Ruta de navegación:** Inicio / Combos / nombre.
  - **Precio:** nombre, precio con descuento según los colores elegidos,
    precio por separado tachado y "Ahorrás $X".
  - **Descripción corta** al lado del precio.
  - **Piezas:** la lista de piezas con su selector de colores. Es el mismo
    componente que la card actual de la ficha de producto: se reutiliza el
    render.
  - **Compra:** cantidad de combos y botón "Agregar combo al carrito", que
    agrega cada pieza × cantidad y lleva a `/comprar/`.
  - **Abajo:** la descripción larga.
- Si el slug no existe o el combo no está disponible, se muestra "Este combo ya
  no está disponible" y un link a `/combos/`.
- Título de la pestaña: `<nombre del combo> | <tienda>`.
- La card que hoy aparece en la ficha de cada producto se mantiene, y suma el
  link "Ver combo" a la ficha nueva.

### 3. Admin — pestaña "Ficha" en cada combo

Campos nuevos por combo:

- `slug`: se genera del nombre y es editable. Es único entre los combos de la
  tienda, y se valida al guardar.
- `showOnPage`: "Mostrar en la página de combos" (encendido por defecto).
- `images`: hasta 6 URLs, ordenables. La primera es la principal. Si no hay
  ninguna, se usa la foto de la opción elegida por defecto de cada pieza.
- `includesText`: opcional, reemplaza la línea "qué incluye" generada.
- `shortDescription`: hasta 300 caracteres, texto plano.
- `description`: hasta 3000 caracteres, texto plano con saltos de línea. Se
  muestra con `textContent`, sin HTML.

A nivel módulo: `pagePath` (por defecto `/combos/`) y los textos `pageTitle` y
`pageIntro`.

### Fotos optimizadas

- El texto de ayuda muestra **Tamaño recomendado: 1200 × 1200 px (cuadrada).
  Mínimo 800 × 800 px. JPG, PNG o WebP de hasta 5 MB.**
- **En el navegador**, antes de subir:
  - se rechaza si el archivo pesa más de 5 MB o no es jpg/png/webp, con un
    mensaje que dice el peso;
  - se rechaza si el lado más corto mide menos de 800 px, con un mensaje que
    dice el tamaño real;
  - si no es cuadrada, igual se acepta, pero se avisa que en la grilla se va a
    recortar al centro;
  - se achica a 1200 px como máximo en canvas y se manda como JPEG 0.9.
- **En el servidor** se usa `/api/upload-image-base64` con `folder: "combos"`,
  que ya pasa la imagen a WebP q80 a 1200 px como máximo.
- El servidor además valida al guardar que las imágenes sean URLs https de
  Storage (`storage.googleapis.com/.../combos/...`). No se aceptan URLs
  externas.

## Datos

Todo vive en el doc existente `promonube_combos/{storeId}`. Los campos nuevos
de cada combo son opcionales, así que los combos de hoy siguen funcionando sin
migración: el slug se genera al primer guardado.

Endpoint nuevo: `GET /api/combos-page.json?store=X`. Devuelve los combos de la
página con las piezas ya resueltas (las mismas opciones que
`buildWidgetCombos`, pero sin filtrar por producto) y los textos de la página.
Usa el mismo cache de productos de 5 minutos.

## Fuera de alcance

- Que los combos aparezcan en las categorías nativas o en el buscador de la
  tienda.
- SEO por combo: el contenido se arma con JS y la URL tiene parámetro.
- Las cuotas en la ficha: dependen del medio de pago de cada tienda.
- Editor de texto enriquecido.

## Decisiones tomadas por Claude (a revisar)

- Las URLs con parámetro (`?combo=`) en lugar de una ruta, por la limitación
  de Tiendanube.
- El precio "desde" se calcula con la opción más barata con stock.
- Sin fotos propias, se usan las de los productos.
- El límite de 6 fotos y de 5 MB por archivo.
- No mostrar cuotas.
