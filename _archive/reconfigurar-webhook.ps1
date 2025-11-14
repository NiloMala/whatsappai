# Script para reconfigurar webhook após reconexão
# Execute este script sempre que desconectar e reconectar o WhatsApp

$INSTANCE_NAME = "instance_c1676e45_1761016520734"
$WEBHOOK_PATH = "679fa158-b3c4-4f1e-ba21-4d4b66d4c576"
$EVOLUTION_API_KEY = "c844dbc243884b4eded9ec69b449ed3b"

$body = @"
{
  "webhook": {
    "enabled": true,
    "url": "https://webhook.auroratech.tech/webhook/$WEBHOOK_PATH",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }
}
"@

Write-Host "Reconfigurando webhook para $INSTANCE_NAME..." -ForegroundColor Yellow

try {
    $result = Invoke-RestMethod -Uri "https://evo.auroratech.tech/webhook/set/$INSTANCE_NAME" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"; "apikey"=$EVOLUTION_API_KEY} `
        -Body $body
    
    Write-Host "✅ Webhook reconfigurado com sucesso!" -ForegroundColor Green
    Write-Host "URL: $($result.url)" -ForegroundColor Cyan
    Write-Host "Enabled: $($result.enabled)" -ForegroundColor Cyan
    Write-Host "Events: $($result.events)" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Erro ao reconfigurar webhook:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
