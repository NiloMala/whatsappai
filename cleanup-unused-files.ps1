# Script para limpar arquivos nao utilizados do projeto
# Move arquivos para _archive ao inves de deletar

Write-Host "=== Limpeza de Arquivos Nao Utilizados ===" -ForegroundColor Cyan
Write-Host ""

# Criar pasta _archive se nao existir
$archivePath = "_archive"
if (-not (Test-Path $archivePath)) {
    New-Item -ItemType Directory -Path $archivePath | Out-Null
    Write-Host "Pasta _archive criada" -ForegroundColor Green
}

# Lista de arquivos para arquivar
$filesToArchive = @(
    ".env.workflow",
    "test-n8n.json",
    "test-n8n-apikey.json",
    "test-webhook.json",
    "webhook-config.json",
    "simple-workflow-test.json",
    "scripts\test-redis.js",
    "scripts\test-redis.ts",
    "reconfigurar-webhook.ps1",
    "deploy-configure-webhook.ps1",
    "update-statistics-function.ps1",
    "apply-conversations-constraint.ps1"
)

$movedCount = 0
$notFoundCount = 0

foreach ($file in $filesToArchive) {
    if (Test-Path $file) {
        $fileName = Split-Path $file -Leaf
        $destination = Join-Path $archivePath $fileName
        
        # Se ja existe no archive, adicionar timestamp
        if (Test-Path $destination) {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
            $extension = [System.IO.Path]::GetExtension($fileName)
            $fileName = "${baseName}_${timestamp}${extension}"
            $destination = Join-Path $archivePath $fileName
        }
        
        Move-Item -Path $file -Destination $destination -Force
        Write-Host "OK Movido: $file -> _archive\$fileName" -ForegroundColor Green
        $movedCount++
    } else {
        Write-Host "X Nao encontrado: $file" -ForegroundColor Yellow
        $notFoundCount++
    }
}

Write-Host ""
Write-Host "=== Resumo ===" -ForegroundColor Cyan
Write-Host "Arquivos movidos: $movedCount" -ForegroundColor Green
Write-Host "Arquivos nao encontrados: $notFoundCount" -ForegroundColor Yellow
Write-Host ""
Write-Host "Os arquivos foram movidos para a pasta _archive" -ForegroundColor White
Write-Host "Voce pode deletar essa pasta depois se nao precisar mais dos arquivos" -ForegroundColor White
