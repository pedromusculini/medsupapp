@echo off
REM MedSupAPP - Vercel Deployment Script (Git Bash)
REM Execute: deploy.bat

cd /d "%~dp0"
bash -c "
echo 'MedSupAPP - Vercel Deploy via Git Bash'
echo '========================================='
echo ''

# Verificar status
echo 'Verificando repositorio...'
git status
echo ''

# Obter branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo \"Branch atual: \$BRANCH\"
echo ''

# Add files
echo 'Adicionando arquivos...'
git add vercel.json next.config.ts .gitignore VERCEL_DEPLOYMENT_GUIDE.md
echo 'OK - Arquivos staged'
echo ''

# Commit
echo 'Fazendo commit...'
git commit -m 'feat: Configurar Vercel e otimizar Next.js v16 para deploy automatico'
echo 'OK - Commit feito'
echo ''

# Push
echo 'Fazendo push...'
git push origin \$BRANCH
echo 'OK - Push concluido'
echo ''

echo '========================================='
echo 'OK - DEPLOY INICIADO!'
echo '========================================='
echo ''
echo 'Acesse https://vercel.com/dashboard'
echo 'Aguarde 2-3 minutos...'
echo 'Verifique em: https://medsupapp.vercel.app'
"

pause
