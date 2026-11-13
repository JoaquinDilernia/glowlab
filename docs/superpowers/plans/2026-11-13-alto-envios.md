# Envíos agrupados Alto Rancho — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alojar en GlowLab los envíos agrupados de Alto Rancho: desplegables en carrito/producto y checkout, y el filtro real `shipping/before-filter`.

**Architecture:** Lógica pura en `functions/alto-envios.js`, portada 1:1 de `filtro.py`, más sus rutas Express registradas desde `index.js`. El estado del filtro vive en memoria y las fotos se respaldan en Firestore. El script de tienda (`alto-envios.js` del paquete) se sirve como widget. El script del checkout es un bundle NubeSDK aparte. El panel es una página chica, exclusiva de 2547699.

**Tech Stack:** Node/Express + Firestore (Railway), `node:test`, esbuild (NubeSDK), React/Vite (panel).

**Spec:** `docs/superpowers/specs/2026-11-13-alto-envios-design.md`

Fuente original (sin cambios de lógica): `<scratchpad>/envios_zip/altorancho_envios_carrito_checkout/` (`filtro.py`, `app.py`, `nube/main.js`, `1_carrito_tema/alto-envios.js`, `test_app.py`).

## Global Constraints

- Tienda única: `2547699`. Backend: `https://glowlab-production.up.railway.app` (constante `BASE`, que se puede pisar con `process.env.ALTO_ENVIOS_BASE`).
- TTL de cotización: 12 h. Tope de claves: 5000. Tope de opciones por clave: 60. Foto ≤ 64 KB. Hasta 120 fotos por minuto.
- `filtered_options` = las opciones que QUEDAN. Ante sin datos, sin catálogo o error, contestar 204.
- La regla nunca espera a Firestore ni a TiendaNube.
- Defaults de config: `enabled:false`, `ocultar:false`.
- Textos, criterio y diseño visual idénticos al paquete.

## Review Focus

- Foto de un carrito por el que TiendaNube no consultó → 403 y no se guarda (test en Task 2).
- Opción vista que falta en el catálogo → no se manda lista: `fuente:'sin_catalogo'` (test en Task 1).
- `ocultar` apagado o tienda distinta de la configurada → 204 aunque haya datos (test en Task 2).
- Cambio de cantidad en el mismo carrito → la huella cambia y la cotización vieja no aplica (test en Task 1).
- Reinicio de Railway → las fotos de las últimas 12 h se recuperan de Firestore (Task 2, `recuperarFotos` con un db falso).

---

### Task 1: Lógica del filtro (`functions/alto-envios.js`, parte pura)

**Files:** Create `functions/alto-envios.js`, `functions/alto-envios.test.js`

**Interfaces — Produces (todo exportado):** `huella(items)→string`, `guardar(foto, ahora?)→number`, `clasificar(o)→[grupo, transp]`, `elegidas(lista)→[]`, `aOcultar(ops)→[]`, `cargarCatalogo(storeId, carriers)→number`, `catalogo(storeId)→{}`, `formatoTn(o, cat)→{id,option_id,code}|null`, `decidir(storeId, cartId, zip, items, ahora?)→{mostrar, fuente, ocultas, falta?}`, `marcarVisto(s,c,ahora?)`, `visto(s,c,ahora?)→bool`, `cantidad()→number`, `borrarTodo()`.

- [ ] Port `test_app.py` tests that cover filtro to `node:test`. Add: same cart with different quantities → `fuente:'sin_datos'`; missing catalog option → `fuente:'sin_catalogo'`; group of 2 options → nothing hidden; envío propio code `7620339` maps to catalog `table-7620339`.
- [ ] Run `cd functions && node --test alto-envios.test.js` → FAIL.
- [ ] Port `filtro.py` 1:1 (same constants, same tie-breaking order).
- [ ] Run tests → PASS. Commit.

### Task 2: Rutas, config y persistencia

**Files:** Modify `functions/alto-envios.js` (add `registerAltoEnviosRoutes(app, { db, FieldValue })` and `crearServicio(...)` testable), `functions/index.js` (register next to the other modules), tests in `alto-envios.test.js`.

**Interfaces — Produces:** routes `POST /api/alto-envios/regla`, `POST|OPTIONS /api/alto-envios/foto`, `GET /api/alto-envios/config?storeId`, `POST /api/alto-envios/config {storeId, enabled, ocultar}`, `GET /api/alto-envios-widget.js?store`, `POST /api/alto-envios/install {storeId}`, `GET /api/alto-envios/salud?storeId`. Firestore `promonube_alto_envios/{storeId}`, `promonube_alto_envios_fotos/{auto}`.

- [ ] Tests with a fake express app/db: regla with `ocultar` off → 204; regla after a foto from the same cart with `ocultar` on and catalog loaded → 200 with `filtered_options` excluding the hidden ones; foto without a previous regla → 403; foto > 64 KB → 413; `recuperarFotos` restores from the fake db.
- [ ] Implement: config cache in memory refreshed in background every 30 s (triggered on request, like `config()` in `app.py`); catalog loaded with the token in `promonube_stores/{id}.accessToken` at startup and every hour; fotos persisted fire-and-forget; ring buffer of 200 decisions; widget serves `alto-envios.js` (copied to `functions/alto-envios-widget.js`) or an empty script if `enabled` is off; install = PUT `business_rules/integrations/shipping` `{url: BASE+'/api/alto-envios/regla', event:'shipping/before-filter'}` + load catalog, and saves the result in config.
- [ ] Tests PASS; `node -e "require('./functions/index.js')"` is not run (it starts the server). Check with `node --check functions/index.js`. Commit.

### Task 3: Script de checkout NubeSDK

**Files:** Create `nube-sdk-envios-checkout/{package.json, src/main.js, README.md}`; `dist/main.js` gets built.

- [ ] Copy `nube/main.js`, then: remove LAB/labInicio/labSelector/labOpciones/pintarSlots/OCULTAR_PRUEBA; `agrupado` always runs; `BASE` = backend; foto → `/api/alto-envios/foto`; gate `store.id === '2547699'` and fetch `/api/alto-envios/config` once (`enabled` false → don't render or send labels, but keep the foto).
- [ ] `npm install && npm run build` (esbuild, same as checkout-notice) → `dist/main.js` is produced with no errors. Commit (README with the Portal steps).

### Task 4: Bootstrap de tienda

**Files:** Create `alto-envios-version.js` (root, pattern from `local-stock-version.js`; URL Railway `/api/alto-envios-widget.js?store=`).

- [ ] `node --check alto-envios-version.js`. Commit.

### Task 5: Panel

**Files:** Create `src/pages/AltoEnviosConfig.jsx` (reuses `LocalStockConfig.css`); modify `src/App.jsx` (route `/envios-agrupados`), `src/components/Sidebar.jsx` (exclusive 2547699, icon `Truck`, label "Envíos agrupados").

- [ ] Toggles `enabled` / `ocultar` (note: "dejarlo unos días apagado…"), "Instalar regla" button showing the result, status from `/salud` (consultas recibidas, catálogo, cotizaciones, últimas decisiones).
- [ ] `npm run build` OK. Commit.

### Task 6: Cierre

- [ ] `cd functions && npm test` all green. Push to main (Railway). Tell the user: upload `dist` to Hostinger, the 2 Portal scripts, and in the panel: Instalar → enabled → check `/salud`.
