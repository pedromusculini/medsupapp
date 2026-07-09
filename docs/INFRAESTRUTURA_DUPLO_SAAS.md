# Infraestrutura — MedSupAPP e Turquesa Agenda

Dois deploys independentes a partir do mesmo template de código. O isolamento entre produtos é **por projeto de infraestrutura**, não por coluna `product_id` em todas as tabelas de tenant.

**Última revisão:** 2026-07-09

## Resumo

| Camada | MedSupAPP | Turquesa Agenda |
|--------|-----------|-----------------|
| **Produção** | https://www.medsupapp.com.br | https://www.turquesaagenda.com.br |
| **GitHub** | `pedromusculini/medsupapp` | `pedromusculini/turquesa` |
| **Vercel** | Projeto **`medsupapp`** | Projeto **`turquesa`** |
| **Supabase** | Projeto **próprio** (ref: `xbhqxhcryvumrzjiuswx`) | Projeto **próprio** (ref: `xzujpefaifxrxyjmkrhw`) |
| **Google OAuth** | Client **próprio** | Client **próprio** |
| **Asaas** | Conta / webhook **próprios** | Conta / webhook **próprios** (ou mesma conta CNPJ — URLs distintas) |
| **Resend (conta)** | `pedromusculini@gmail.com` | `marrissamartins@gmail.com` |
| **Resend (From)** | `naoresponda@medsupapp.com.br` | `naoresponda@turquesaagenda.com.br` |
| **`INTERNAL_PRODUCT_ID`** | `medsupapp` | `turquesa-agenda` |

**Regra:** nunca copiar `NEXT_PUBLIC_SUPABASE_*`, `AUTH_SECRET`, `GOOGLE_*`, `RESEND_API_KEY` nem `ASAAS_*` de um produto para o outro. Cada `.env.local` deve apontar para **um** Supabase — confira o ref na URL (`https://<ref>.supabase.co`). Ver [CLONAR_PRODUTO_SAAS.md](./CLONAR_PRODUTO_SAAS.md).

### Resend — contas separadas (jul/2026)

Plano free Resend = **1 domínio por conta**. MedSup e Turquesa **não** compartilham conta.

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| Conta Resend | `pedromusculini@gmail.com` | `marrissamartins@gmail.com` |
| Domínio verificado | `medsupapp.com.br` | `turquesaagenda.com.br` |
| Setup | [RESEND_MEDSUP_SETUP.md](./RESEND_MEDSUP_SETUP.md) | `docs/RESEND_TURQUESA_SETUP.md` (repo Turquesa) |

## Painel admin interno

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| **URL canônica** | `/naomexaaquiseucorno` | `/painel-turque-agenda` |
| **API canônica** | `/api/naomexaaquiseucorno/*` | `/api/painel-turque-agenda/*` |
| **Pastas no código** | `app/naomexaaquiseucorno/` | Mesmas pastas + rewrite em `next.config.ts` |
| **`ADMIN_EMAILS` vazio** | Ninguém é admin (404) | Fallback `pedromusculini@gmail.com` em código |
| **Extras no painel** | `/naomexaaquiseucorno/planos`, API `plans`, `reset-prontuario` | API `/pricing` (plano único `ilimitado` R$ 79,90) |
| **Sem link no menu** | Sim | Sim |

Segurança: sessão Google + allowlist `ADMIN_EMAILS` + middleware + `requireInternalAdmin()` nas APIs. Respostas **404** para não revelar o painel.

## Verificação de e-mail (OTP)

Cada app usa **seu** Supabase (`verification_codes`) e **sua** conta Resend.

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| **Tabela** | `verification_codes` | `verification_codes` |
| **TTL do código** | 15 min (`VERIFICATION_CODE_TTL_MINUTES`) | 5 min (`lib/googleVerificationCodes.ts`) |
| **Remetente** | `MedSupAPP <naoresponda@medsupapp.com.br>` | `Turquesa Agenda <naoresponda@turquesaagenda.com.br>` |
| **Rota pós-login** | `/auth/verificar-email` | `/auth/verificar-email` |

Códigos OTP de um produto **não** validam no outro (bancos separados).

## O que `product_id` filtra hoje

`INTERNAL_PRODUCT_ID` identifica o produto em logs e em tabelas **internas**:

| Tabela / uso | Filtro por `product_id` |
|--------------|-------------------------|
| `internal_audit_log` | Sim (leitura e escrita) |
| `subscription_billing_config` | Sim (Turquesa) |
| `internal_tenant_notes` | Grava; leitura **não** filtra por produto |
| `google_account_access`, `onboarding_profiles`, `verification_codes`, `assinaturas` | **Não** — isolamento = Supabase separado |

Se no futuro dois produtos compartilharem o mesmo Supabase, será necessário filtrar tenants e notas por `product_id`.

## Cobrança e `/renovar`

Política idêntica em `lib/asaasBillingPolicy.ts`: trial 30 dias, aviso dia 29, bloqueio após `trial_ends_at`, liberação só via webhook Asaas.

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| **Planos** | `medico-pix`, `clinica-3`, `clinica-ilimitada` | Único `ilimitado` — R$ 79,90/mês |
| **Usuário bloqueado** | Redirect → `/renovar` | Redirect → `/renovar` |
| **Rotas liberadas** | `/login`, `/renovar`, `/dashboard/conta`, `/backup`, webhooks, público | Idem |

Scripts operacionais MedSup (local): `scripts/fix-asaas-sandbox-webhook.mjs`, `scripts/inspect-asaas-sandbox-billing.mjs`, `npm run test:webhook:prod`.

## Checklist de validação (pós-clone)

1. `NEXT_PUBLIC_SUPABASE_URL` **diferente** entre os dois `.env.local` / Vercel (MedSup = `xbhqxhcryvumrzjiuswx`, Turquesa = `xzujpefaifxrxyjmkrhw`).
2. OTP enviado de domínio correto (cabeçalho From no e-mail).
3. Admin: login allowlist → painel; outro e-mail → 404.
4. `internal_audit_log.product_id` = `medsupapp` ou `turquesa-agenda` conforme o deploy.
5. Webhook Asaas aponta para o domínio **do mesmo** produto.

## Documentação relacionada

- [INTERNAL_OPS.md](./INTERNAL_OPS.md) — painel MedSupAPP
- [ENVIRONMENT.md](./ENVIRONMENT.md) — variáveis
- [SECURITY.md](./SECURITY.md) — Git, secrets, checklist
- [RESEND_MEDSUP_SETUP.md](./RESEND_MEDSUP_SETUP.md) — conta Resend MedSup
- Turquesa (espelho): `INFRAESTRUTURA_DUPLO_SAAS.md` na raiz do repo Turquesa
