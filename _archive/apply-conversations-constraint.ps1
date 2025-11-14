# Script para aplicar constraint UNIQUE na tabela conversations
# Execute este script para copiar o SQL e aplicar no Supabase SQL Editor

Write-Host "=== Aplicar Constraint UNIQUE em Conversations ===" -ForegroundColor Cyan
Write-Host ""

$sqlPath = "supabase\migrations\20251022230000_add_conversations_unique_constraint.sql"

if (Test-Path $sqlPath) {
    $sqlContent = Get-Content $sqlPath -Raw
    
    Write-Host "SQL copiado para clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cole no Supabase SQL Editor e execute:" -ForegroundColor Yellow
    Write-Host "https://supabase.com/dashboard/project/cvyagrunpypnznptkcsf/sql/new" -ForegroundColor Blue
    Write-Host ""
    Write-Host "--- SQL ---" -ForegroundColor Cyan
    Write-Host $sqlContent
    Write-Host "----------" -ForegroundColor Cyan
    
    # Copiar para clipboard
    Set-Clipboard -Value $sqlContent
    
    Write-Host ""
    Write-Host "Após executar no Supabase:" -ForegroundColor Yellow
    Write-Host "1. Salve ou edite um agente na página Agents" -ForegroundColor White
    Write-Host "2. Envie uma mensagem para o agente via WhatsApp" -ForegroundColor White
    Write-Host "3. Verifique a tabela conversations no Supabase" -ForegroundColor White
    Write-Host "4. Confirme que as estatísticas mostram 'Contatos Respondidos'" -ForegroundColor White
} else {
    Write-Host "Erro: arquivo SQL não encontrado!" -ForegroundColor Red
    Write-Host "Caminho esperado: $sqlPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
