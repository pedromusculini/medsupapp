#!/bin/bash
# MedSupAPP - Automated Vercel Deployment Script
# Este script automatiza todo o processo de push e deploy

set -e  # Exit on error

echo "🚀 MedSupAPP - Vercel Deployment Automático"
echo "=========================================="
echo ""

# 1. Verificar git status
echo "📋 Verificando status do repositório..."
git status
echo ""

# 2. Verificar branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📌 Branch atual: $CURRENT_BRANCH"
echo ""

# 3. Adicionar arquivos
echo "📝 Adicionando arquivos de configuração..."
git add vercel.json next.config.ts .gitignore VERCEL_DEPLOYMENT_GUIDE.md
echo "✅ Arquivos staged"
echo ""

# 4. Commit
echo "💾 Fazendo commit..."
git commit -m "feat: Configurar Vercel e otimizar Next.js v16 para deploy automático

- Criar vercel.json com otimizações para Next.js 16
- Atualizar next.config.ts com headers de segurança
- Melhorar .gitignore para excluir arquivos corretos
- Adicionar guia de deployment

Esta mudança força o Vercel a fazer uma rebuild completa
da Landing Page de Vendas do MedSupAPP."

echo "✅ Commit feito"
echo ""

# 5. Push
echo "🔄 Fazendo push para o repositório..."
git push origin $CURRENT_BRANCH
echo "✅ Push concluído"
echo ""

# 6. Confirmar
echo "=========================================="
echo "✅ DEPLOY INICIADO!"
echo "=========================================="
echo ""
echo "📊 Próximos passos:"
echo "1. Acesse: https://vercel.com/dashboard"
echo "2. Selecione projeto: MedSupAPP"
echo "3. Veja o deploy em tempo real em 'Deployments'"
echo "4. Aguarde 2-3 minutos para completar"
echo "5. Verifique em: https://medsupapp.vercel.app"
echo ""
echo "💡 Dica: Se não atualizar, force um rebuild:"
echo "git commit --allow-empty -m 'chore: Force rebuild'"
echo "git push origin $CURRENT_BRANCH"
echo ""
