# Documentação MedSupAPP

Índice da pasta `docs/`. Produção: **https://www.medsupapp.com.br**

## Operação diária

| Documento | Quando usar |
|-----------|-------------|
| [SEUS_PROXIMOS_PASSOS.md](./SEUS_PROXIMOS_PASSOS.md) | Checklist pós-deploy, primeiro uso, Google, WhatsApp wa.me |
| [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | **Obrigatório** após cada push: build → `deploy:promote` → smoke tests |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel, domínio, www preso em deploy antigo |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis `.env.local` e Vercel Production |

## Cobrança Asaas (produção ativa)

| Documento | Conteúdo |
|-----------|----------|
| [ASAAS_BILLING.md](./ASAAS_BILLING.md) | Regras de negócio, código, bloqueio, Minha conta |
| [ASAAS_WEBHOOK_PASSO_A_PASSO.md](./ASAAS_WEBHOOK_PASSO_A_PASSO.md) | Configurar webhook (sandbox e produção) |
| [ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md) | Homologação no sandbox antes de produção |

### Comandos de verificação (produção)

```bash
curl -sS https://www.medsupapp.com.br/api/health/auth-config
npm run test:webhook:prod
npm run test:billing
npm run deploy:promote   # após push, se www não atualizar
```

## Produto e compliance

| Documento | Conteúdo |
|-----------|----------|
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Módulos e rotas |
| [SECURITY-LGPD.md](./SECURITY-LGPD.md) | Dados, RLS, hardening |
| [INTERNAL_OPS.md](./INTERNAL_OPS.md) | Backoffice `/internal` |

## Legado / referência

| Documento | Nota |
|-----------|------|
| [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md) | API Meta (opcional; app usa wa.me) |
| [WHATSAPP_ROADMAP.md](./WHATSAPP_ROADMAP.md) | Roadmap antigo |

## Status produção (última verificação)

| Check | Comando / URL |
|-------|----------------|
| Env + Asaas | `GET /api/health/auth-config` → `ASAAS_*` true |
| Webhook | `npm run test:webhook:prod` → POST 200 + evento no Supabase |
| Política | `npm run test:billing` |
| Bloqueio | `ASAAS_BILLING_ENFORCED=true` na Vercel Production |
