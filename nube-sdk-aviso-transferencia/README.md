# GlowLab - Aviso de transferencia (NubeSDK, checkout)

Solo Alto Rancho (2547699). Cuando el cliente elige pagar por transferencia, muestra dos carteles debajo de los
medios de pago (slot `after_payment_options`): transferencia inmediata y "si querés pagar sin retenciones, no pagues
y escribinos por WhatsApp". Textos, colores, WhatsApp y palabras que identifican la transferencia se editan en el
panel (Aviso de transferencia); el script los lee de `GET /api/aviso-transferencia/config` (Railway).

## Build

```powershell
cd nube-sdk-aviso-transferencia
npm install
npm run build
```

Genera `dist/main.js`.

## Portal de partners

App GlowLab (23137) → Scripts → "Aviso de transferencia - checkout": NubeSDK, location **checkout**, evento
**onfirstinteraction**, auto instalado. Cada cambio del script (no de los textos) es una versión nueva.
