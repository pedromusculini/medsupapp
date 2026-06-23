# Documentação MedSupAPP

Índice da documentação versionada no repositório.

| Documento | Conteúdo |
|-----------|----------|
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | O que o produto faz (rotas, fluxos) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Auth, middleware, APIs, Supabase |
| [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md) | Isolamento MedSup vs Turquesa (Supabase, OTP, admin) |
| [INTERNAL_OPS.md](./INTERNAL_OPS.md) | Painel `/naomexaaquiseucorno` |
| [ASAAS_BILLING.md](./ASAAS_BILLING.md) | Cobrança Asaas, webhook, `/renovar` |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis de ambiente |
| [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | Commit, build, release |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel, domínio, troubleshooting |
| [COOKIES.md](./COOKIES.md) | Inventário técnico de cookies e storage |
| [SECURITY-LGPD.md](./SECURITY-LGPD.md) | LGPD, Drive, metadados Supabase |
| [SECURITY.md](./SECURITY.md) | Checklist de segurança |
| [ROPA_TEMPLATE.md](./ROPA_TEMPLATE.md) | Template ROPA (preencher com jurídico) |
| [QA_BROWSER_MATRIX.md](./QA_BROWSER_MATRIX.md) | Matriz de testes por navegador |
| [PERFORMANCE.md](./PERFORMANCE.md) | Performance e fluidez |
| [CLEAN_CODE.md](./CLEAN_CODE.md) | Convenções e dívidas técnicas |
| [agent-prompts/](./agent-prompts/) | Prompts para acionar agentes no Cursor |

**Produção:** https://www.medsupapp.com.br

Scripts SQL e de deploy operacional (`scripts/*`, `sql/`) permanecem locais — ver `package.json` e `.env.example`.
