# Script para configurar CORS en Firebase Storage
# Instrucciones:
# 1. Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install
# 2. Ejecuta: gcloud init
# 3. Selecciona el proyecto: pedidos-lett-2
# 4. Ejecuta este script: .\configure-cors.ps1

Write-Host "Configurando CORS para Firebase Storage..." -ForegroundColor Green

# Verificar si gsutil está instalado
if (-not (Get-Command gsutil -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gsutil no está instalado" -ForegroundColor Red
    Write-Host "Instala Google Cloud SDK desde: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Aplicar configuración CORS
gsutil cors set cors.json gs://promonube-56c03.firebasestorage.app

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CORS configurado correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error configurando CORS" -ForegroundColor Red
}
