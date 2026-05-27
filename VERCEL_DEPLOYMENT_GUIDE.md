# 🚀 MEDSUPAPP - Vercel Deployment Guide

## ✅ Arquivos Configurados

Os seguintes arquivos foram criados/atualizados para garantir um deploy automático correto no Vercel:

### 1. **vercel.json** ✨ NOVO
- Configuração otimizada para Next.js 16
- Build command: `npm run build`
- Node version: 20.x
- Região: São Paulo (sao-paulo)
- Headers de segurança LGPD/compliance
- Função API com timeout de 30s

### 2. **next.config.ts** 📝 ATUALIZADO
- SWC minification ativado
- Otimização de imagens (AVIF + WebP)
- Headers de segurança
- Suporte TypeScript completo
- ISR (Incremental Static Regeneration) configurado

### 3. **.gitignore** 📝 ATUALIZADO
- Excluções corretas para Next.js
- Arquivos sensíveis protegidos

---

## 📋 COMANDOS PARA EXECUTAR AGORA

### 1️⃣ Verificar status local
```bash
git status
git log --oneline -5
```

### 2️⃣ Adicionar as novas configurações ao git
```bash
git add vercel.json next.config.ts .gitignore
git commit -m "feat: Configurar Vercel e otimizar Next.js v16"
```

### 3️⃣ Verificar branch atual
```bash
git branch -a
```
> **IMPORTANTE**: Verifique qual é o branch padrão:
> - Se for `master`, use o comando abaixo para `master`
> - Se for `main`, use o comando abaixo para `main`

### 4️⃣ Fazer push para o repositório remoto

**Se o branch é MAIN:**
```bash
git push origin main
```

**Se o branch é MASTER:**
```bash
git push origin master
```

**Se não tem certeza, rode antes:**
```bash
git branch
```
(O branch com asterisco * é o atual)

### 5️⃣ Forçar rebuild no Vercel (3 opções)

#### **OPÇÃO A**: Via Git (recomendado)
```bash
git commit --allow-empty -m "chore: Trigger Vercel rebuild"
git push origin [seu-branch]
```

#### **OPÇÃO B**: Manualmente no Vercel
1. Acesse https://vercel.com/dashboard
2. Selecione o projeto "MedSupAPP"
3. Clique em "Deployments"
4. Clique nos 3 pontinhos (⋯) → "Redeploy"

#### **OPÇÃO C**: Via CLI do Vercel
```bash
npm install -g vercel
vercel --prod
```

---

## 🔍 Como Saber se Funcionou

### ✓ Deploy bem-sucedido:
- [ ] No Vercel Dashboard: Status "Ready" com ✅
- [ ] Site atualizado em: https://medsupapp.vercel.app
- [ ] Domínio funcionando: https://medsupapp.com.br
- [ ] Landing Page visível com cores verdes e 30 dias grátis

### ✗ Se não funcionou:
1. Verifique no Vercel Dashboard → Deployments → Logs
2. Procure por erros de build
3. Rode localmente: `npm run build && npm start`
4. Se erro persistir, rode: `npm install` antes

---

## 🔧 Troubleshooting

### Problema: "Command 'npm install' failed"
**Solução:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problema: "File path too long / Next.js build failed"
**Solução:**
```bash
npm run lint
npm run build -- --debug
```

### Problema: "Environment variables not found"
**Solução:**
1. No Vercel Dashboard → Settings → Environment Variables
2. Adicione: `NEXTAUTH_SECRET` e `NEXTAUTH_URL`

---

## 📊 Checklist Final

- [ ] `vercel.json` criado ✅
- [ ] `next.config.ts` atualizado ✅
- [ ] `.gitignore` corrigido ✅
- [ ] Git staged com `git add`
- [ ] Commit feito com `git commit`
- [ ] Push feito com `git push origin [branch]`
- [ ] Vercel Dashboard mostrando novo deploy
- [ ] medsupapp.vercel.app atualizado
- [ ] Landing Page visível em produção

---

## 🎯 Próximas Ações

1. **Rode os comandos acima agora**
2. **Aguarde 2-3 minutos** para o Vercel fazer build
3. **Acesse:** https://medsupapp.vercel.app
4. **Verifique domínio:** https://medsupapp.com.br

Se tudo estiver certo, o site vai mostrar a Landing Page nova com:
- Hero "Consultório sem complicações"
- CTA verde "Testar 30 dias grátis"
- Todos os benefícios e preços
- Footer com login

---

## 💡 Dica Pro

Para monitorar deploys em tempo real:
```bash
git log --oneline --graph --all
```

E para ver o último status:
```bash
git status
git remote -v
```

---

**Criado:** 27/05/2026
**Projeto:** MedSupAPP
**Status:** Pronto para Deploy ✅
