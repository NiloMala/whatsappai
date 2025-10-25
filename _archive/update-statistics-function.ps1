# Script para atualizar a função get_user_statistics no Supabase

Write-Host "📊 Atualizar função de estatísticas" -ForegroundColor Cyan
Write-Host ""

# Ler o arquivo SQL
$sqlPath = "supabase\migrations\20251022210000_update_statistics_active_contacts.sql"
$sqlContent = Get-Content -Path $sqlPath -Raw

Write-Host "📄 SQL carregado: $($sqlContent.Length) caracteres" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  INSTRUÇÕES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. O código SQL foi copiado para o clipboard!" -ForegroundColor White
Write-Host ""
Write-Host "2. Acesse: https://supabase.com/dashboard/project/cvyagrunpypnznptkcsf/editor" -ForegroundColor White
Write-Host ""
Write-Host "3. Cole o código (Ctrl+V) e clique em 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "PRINCIPAIS MUDANÇAS:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Tempo Médio de Resposta:" -ForegroundColor Green
Write-Host "   - Calcula tempo entre mensagem 'customer' (received)" -ForegroundColor White
Write-Host "   - E próxima mensagem 'agent' (sent)" -ForegroundColor White
Write-Host "   - Usa created_at de ambas as mensagens" -ForegroundColor White
Write-Host "   - Não depende mais de conversation_id" -ForegroundColor White
Write-Host ""
Write-Host "✅ Contatos Respondidos:" -ForegroundColor Green
Write-Host "   - Conta contact_phone únicos da tabela conversations" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Copiar para clipboard
Set-Clipboard -Value $sqlContent
Write-Host "✅ SQL copiado para o clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
