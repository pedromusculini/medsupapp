# MedSupAPP - Vercel Deployment Script (PowerShell)
# Execute: .\deploy.ps1

Write-Host "MedSupAPP - Vercel Deployment Automatico" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar git status
Write-Host "Verificando status do repositorio..." -ForegroundColor Yellow
git status
Write-Host ""

# 2. Verificar branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch atual: $currentBranch" -ForegroundColor Green
Write-Host ""

# 3. Adicionar arquivos
Write-Host "Adicionando arquivos de configuracao..." -ForegroundColor Yellow
git add vercel.json next.config.ts .gitignore VERCEL_DEPLOYMENT_GUIDE.md
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Arquivos staged" -ForegroundColor Green
} else {
    Write-Host "ERRO ao staged arquivos" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Commit
Write-Host "Fazendo commit..." -ForegroundColor Yellow
git commit -m "feat: Configurar Vercel e otimizar Next.js v16 para deploy automatico"

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Commit feito" -ForegroundColor Green
} else {
    Write-Host "ERRO ao fazer commit" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 5. Push
Write-Host "Fazendo push para o repositorio..." -ForegroundColor Yellow
git push origin $currentBranch
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK - Push concluido" -ForegroundColor Green
} else {
    Write-Host "ERRO ao fazer push" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 6. Confirmar
Write-Host "==========================================" -ForegroundColor Green
Write-Host "OK - DEPLOY INICIADO!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Acesse: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Selecione projeto: MedSupAPP" -ForegroundColor White
Write-Host "3. Veja o deploy em Deployments" -ForegroundColor White
Write-Host "4. Aguarde 2-3 minutos para completar" -ForegroundColor White
Write-Host "5. Verifique em: https://medsupapp.vercel.app" -ForegroundColor White
Write-Host ""
Write-Host "Dica: Se nao atualizar, force um rebuild:" -ForegroundColor Yellow
Write-Host "git commit --allow-empty -m 'chore: Force rebuild'" -ForegroundColor Gray
Write-Host "git push origin" $currentBranch -ForegroundColor Gray
Write-Host ""
