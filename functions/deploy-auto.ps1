# Script para desplegar funciones automáticamente respondiendo N a la eliminación
Write-Host "Iniciando deployment..."
"N" | firebase deploy --only functions
