# Script para fazer deploy manual da função configure-webhook no Supabase

Write-Host "🚀 Deploy da função configure-webhook" -ForegroundColor Cyan
Write-Host ""

# Ler o arquivo da função
$functionPath = "supabase\functions\configure-webhook\index.ts"
$functionCode = Get-Content -Path $functionPath -Raw

Write-Host "📄 Código da função carregado: $($functionCode.Length) caracteres" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  INSTRUÇÕES PARA DEPLOY MANUAL:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Acesse: https://supabase.com/dashboard/project/cvyagrunpypnznptkcsf/functions" -ForegroundColor White
Write-Host ""
Write-Host "2. Encontre a função 'configure-webhook' e clique nela" -ForegroundColor White
Write-Host ""
Write-Host "3. Clique no botão 'Edit function' ou 'Deploy new version'" -ForegroundColor White
Write-Host ""
Write-Host "4. Copie o código abaixo (já está no clipboard!):" -ForegroundColor White
Write-Host ""

# Copiar para o clipboard
Set-Clipboard -Value $functionCode
Write-Host "✅ Código copiado para o clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "5. Cole no editor do Supabase e clique em 'Deploy'" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "CÓDIGO (já copiado):" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host $functionCode -ForegroundColor Gray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚡ A mudança principal:" -ForegroundColor Yellow
Write-Host "   - events: ['MESSAGES_UPSERT']  (array, não objeto)" -ForegroundColor White
Write-Host "   - webhookByEvents: false       (camelCase)" -ForegroundColor White
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
