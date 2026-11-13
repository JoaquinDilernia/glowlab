# GlowLab - Envíos agrupados en el checkout (NubeSDK)

Desplegables de envío (domicilio / locales / punto de retiro) en el checkout de Alto Rancho (2547699), más la
"foto" de las opciones que usa el filtro `shipping/before-filter` del backend (`functions/alto-envios.js`).
Portado del paquete de logística de Alto Rancho (12/11/2026).
Diseño: `docs/superpowers/specs/2026-11-13-alto-envios-design.md`.

## Build

```powershell
cd nube-sdk-envios-checkout
npm install
npm run build
```

Genera `dist/main.js`.

## Subir a TiendaNube (una vez)

Portal de socios → GlowLab (23137) → Scripts → **Agregar script**:
- Nombre: `Envíos agrupados (Alto Rancho)`
- Tipo: **NubeSDK**
- Ubicación: **checkout**
- Evento: **onfirstinteraction**
- Auto instalado: sí
- Archivo: `dist/main.js` → Activar.

Se prende y se apaga desde el panel de GlowLab ("Envíos agrupados"), sin volver a subirlo.
