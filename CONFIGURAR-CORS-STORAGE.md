# Configurar CORS en Firebase Storage

El error que estás viendo es porque Firebase Storage no permite uploads desde dominios externos por defecto.

## Opción 1: Usar Google Cloud Console (MÁS FÁCIL)

1. Ve a: https://console.cloud.google.com/storage/browser/promonube-56c03.firebasestorage.app?project=pedidos-lett-2

2. Click en los 3 puntitos (⋮) del bucket → **Edit bucket permissions**

3. Ir a la pestaña **CORS**

4. Agregar esta configuración JSON:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "X-Requested-With"],
    "maxAgeSeconds": 3600
  }
]
```

5. Guardar


## Opción 2: Instalar Google Cloud SDK

1. Descargar e instalar: https://cloud.google.com/sdk/docs/install

2. Abrir una nueva terminal PowerShell y ejecutar:
```powershell
gcloud init
```

3. Seleccionar el proyecto `pedidos-lett-2`

4. Ejecutar:
```powershell
gsutil cors set cors-storage.json gs://promonube-56c03.firebasestorage.app
```

## Verificar que funcionó

Después de configurar CORS, intentá subir el logo de nuevo. El error debería desaparecer.

## Alternativa Temporal: Usar URLs en vez de uploads

Mientras tanto, podés usar URLs directas de imágenes (subidas a otro servicio como Imgur, Cloudinary, etc.) en vez de subir archivos directamente.
