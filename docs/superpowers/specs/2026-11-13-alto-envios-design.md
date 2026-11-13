# Envíos agrupados de Alto Rancho dentro de GlowLab — diseño

Fecha: 2026-11-13. Origen: paquete `altorancho_envios_carrito_checkout_2026-11-12.zip` (hecho por logística de
Alto Rancho, aprobado por los dueños). Se aloja en GlowLab para no aprobar una app nueva en TiendaNube.

## Intención

Alto Rancho quiere que el cliente vea los envíos en tres desplegables cerrados (Envío a domicilio → Retiro en
nuestros locales → Entrega en punto de retiro). En cada grupo se ven la opción más barata y la más rápida, la más
barata de cada proveedor que falte (Zipnova o Envío Nube), el envío propio y la opción elegida. El resto queda en
"Ver N opciones más". Además, el checkout oculta de verdad las opciones de Zipnova y Envío Nube que no son ni la
más barata ni la más rápida.

**Se implementa tal cual está.** El criterio, los textos, el diseño visual y las reglas de seguridad no cambian.
Solo cambia dónde corre: el backend de GlowLab en Railway (Node + Firestore), en lugar de Python + Supabase + Render.

## Objetivos / no objetivos

- Objetivo: las tres partes del paquete funcionando en altorancho.com desde GlowLab:
  1. desplegables en el carrito lateral y en el calculador del producto (script de tienda);
  2. desplegables en el checkout (script NubeSDK);
  3. filtro real de opciones (regla de negocio `shipping/before-filter`) que solo oculta con cotizaciones reales.
- No objetivo: hacerlo configurable para otras tiendas o venderlo como módulo. Es interno de Alto Rancho
  (store 2547699), igual que Stock en locales.
- No se porta: el "laboratorio" de NubeSDK (`nube_lab` y sus experimentos), la página de capturas, los pasos de
  diagnóstico, el OAuth y los webhooks de privacidad propios (GlowLab ya tiene los suyos), `tienda.js` (era una
  sonda) ni el modo `lista`/`respuesta_prueba`.
- Anti-objetivo: que el checkout se quede sin envíos. Ante cualquier duda (no hay datos, falta el catálogo, error,
  demora) la regla contesta 204 y TiendaNube muestra todo.

## Enfoques considerados

- **A — Pasarlo al backend de GlowLab (ELEGIDO por el usuario).** Un solo servicio que siempre está despierto,
  usa el token que GlowLab ya tiene en Altorancho (con scope `read_shipping`, verificado) y no requiere instalar
  nada aparte.
- B — Dejar el servicio Python aparte en Railway, con el token de GlowLab. Más fiel al código original, pero
  quedan dos servicios y dos bases, y el secreto de GlowLab tendría que estar en otro servicio.
- (Descartado) Editar el tema Ipanema para el carrito: GlowLab ya inyecta scripts de tienda, así que no hace falta,
  y el tema sigue recibiendo actualizaciones.

## Diseño

### Backend: `functions/alto-envios.js` (+ `alto-envios.test.js`)

- **Lógica pura** portada 1:1 de `filtro.py`: `huella`, `claves`, `guardar` (con mezcla y tope de 60 opciones por
  clave), `clasificar`, `elegidas`, `aOcultar` (grupos de 1 o 2 opciones no se tocan), `cargarCatalogo`,
  `formatoTn` (también con `table-<code>`), `decidir` (devuelve las que QUEDAN; si una opción no está en el
  catálogo, no se oculta nada), `marcarVisto`/`visto`. TTL de 12 h y tope de 5000 claves.
- Las pruebas de `test_app.py` que aplican a la lógica se portan a `node:test`.
- `registerAltoEnviosRoutes(app, { db, ... })`, registrado desde `index.js`. Rutas:
  - `POST /api/alto-envios/regla`: callback de TiendaNube. Hace `marcarVisto` y, si `ocultar` está prendido para
    la tienda, ejecuta `decidir` y devuelve `{command:"filter_shipping_options", detail:{filtered_options}}`;
    si no, contesta 204. **Nunca espera a Firestore**: la config se lee de memoria, que se refresca en segundo
    plano cada 30 s.
  - `POST|OPTIONS /api/alto-envios/foto`: público, con CORS. Tope de 64 KB y de 120 fotos por minuto. Si el
    carrito no pasó por `visto`, contesta 403. Las fotos aceptadas se guardan en memoria y en Firestore.
  - `GET /api/alto-envios/config?storeId=`: público. Devuelve `{enabled}` para el script del checkout.
  - `GET /api/alto-envios-widget.js?store=`: el `alto-envios.js` del tema sin cambios. Si `enabled` está apagado,
    devuelve un script vacío.
  - `POST /api/alto-envios/install {storeId}`: con el token de `promonube_stores`, hace PUT
    `business_rules/integrations/shipping` (url = `/api/alto-envios/regla`), instala el script de tienda (POST
    `/scripts`, sin duplicar), carga el catálogo y devuelve el estado de cada paso.
  - `POST /api/alto-envios/uninstall {storeId}`: saca el script de tienda y pone `ocultar=false`. La regla queda
    registrada, pero sin `ocultar` contesta 204 y no oculta nada.
  - `GET /api/alto-envios/salud?storeId=`: cantidad de cotizaciones, tamaño del catálogo, últimas ~200
    decisiones (fuente / ocultas / mostradas / ms) y el resultado de la última instalación.
- **Datos (Firestore):**
  - `promonube_alto_envios/{storeId}`: `{enabled, ocultar, install:{...}, updatedAt}`.
  - `promonube_alto_envios_fotos/{auto}`: `{storeId, ts, foto}`. Al arrancar se recuperan las de las últimas
    12 h (hasta 300), igual que `_recuperar_fotos`. Se borran las viejas de forma oportunista.
  - El catálogo (`GET shipping_carriers/options`) se carga al arrancar y se refresca cada hora en memoria.
- **Decisión mía:** no se guarda cada callback en la base (el original lo guardaba en `lett_ce_consultas`). En
  Firestore eso son muchas escrituras por cada checkout. Las decisiones quedan en una memoria circular que se ve
  en `/salud`.

### Checkout: `nube-sdk-envios-checkout/`

- `src/main.js`: el `nube/main.js` del paquete sin el laboratorio. Lo que antes se prendía con `agrupado` ahora
  corre siempre. Se mantienen sin cambios la preselección de la más barata a domicilio, los custom labels con los
  nombres cortos y la foto a `/api/alto-envios/foto`.
- Se agregan dos controles: solo corre en la tienda 2547699 (igual que checkout-notice) y antes de dibujar
  consulta `/api/alto-envios/config` (si `enabled` está apagado, no hace nada). La foto se manda siempre que el
  script corra, porque el filtro la necesita.
- Build con esbuild a `dist/main.js`, igual que `nube-sdk-checkout-notice`.
- **Paso del usuario:** subirlo al Portal de Socios de GlowLab como script nuevo (ubicación checkout) y activarlo.
  Si el Portal no deja agregar un script sin revisión, alternativa: subirlo como versión nueva del script 6288
  (`checkout-notice`). El aviso de Factura A hoy corre por el bootstrap de "Códigos externos" y no por ese script.

### Panel (frontend)

Una página chica "Envíos agrupados", visible solo para la tienda 2547699. Tiene:
- el interruptor "Desplegables en carrito y checkout" (`enabled`);
- el interruptor "Ocultar opciones en el checkout" (`ocultar`), con la nota del paquete: dejarlo unos días
  apagado registrando antes de prenderlo;
- el botón "Instalar / reinstalar", con el resultado de cada paso;
- el estado tomado de `/salud`.

Hace falta porque los datos de producción los cambia el usuario desde el panel.

## Restricciones y riesgos

- **Reglas de negocio tiene que estar habilitado para la app GlowLab** (lo habilita Soporte de Partners). Si no lo
  está, el PUT de install falla y el panel lo muestra. Las partes 1 y 2 funcionan igual.
- La regla tiene que contestar en menos de 800 ms. Se resuelve todo en memoria y Railway no se duerme.
- Conocido de TiendaNube y aceptado: en el paso de pago, "Cambiar" abre la lista nativa. Las opciones de retiro
  no aceptan nombres propios.
- Un solo proceso de Railway: el estado en memoria es único (el problema de varios workers no aplica).

## Queda a criterio del implementador

Los nombres internos de las funciones, el formato exacto de `/salud`, el estilo de la página del panel (siguiendo
las demás páginas de GlowLab) y la limpieza de fotos viejas.
