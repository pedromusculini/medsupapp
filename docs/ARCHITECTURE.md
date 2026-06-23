# Arquitetura

## Stack

- **Next.js 16** (App Router, webpack build)
- **React 19**, TypeScript
- **Auth.js (NextAuth)** — Google OAuth
- **Supabase** — Postgres + Storage (`portfolio-fotos`)
- **Vercel** — hosting, env, domínio `www.medsupapp.com.br`
- **Resend** — e-mail OTP

## Camadas

```
app/           Páginas e Route Handlers (API)
components/    UI client/server
lib/           Regras de negócio, integrações
middleware.ts  Auth gate, billing, onboarding, redirect apex→www
auth.ts        Config NextAuth
```

## Autenticação

1. Google OAuth → sessão JWT (cookie NextAuth).
2. `google_account_access` — `email_verified_at`, trial, último login.
3. `requireVerifiedOwner()` nas APIs privadas — 403 se OTP pendente.
4. `requireClinicaTitular()` no financeiro.

## Middleware (`middleware.ts`)

Ordem relevante:

- Redirect `medsupapp.com.br` → `www.medsupapp.com.br`
- Bloqueio rotas cadastro e-mail legado
- Rotas públicas (`isPublicPath`) — `/`, `/agendar/`, `/pro/`, `/f/`, etc.
- APIs sem verificação (`isUnverifiedApiPath`) — OTP, formulário público
- Páginas pós-login sem e-mail verificado → `/auth/verificar-email`
- Onboarding, assinatura, admin interno

## APIs públicas sensíveis

Rate limit via `lib/rateLimit.ts` (Supabase `rate_limits` ou fallback memória):

- Agendamento, formulário, portfólio público, OTP send-code, PIN prontuário.

## Dados sensíveis

- `SUPABASE_SERVICE_ROLE_KEY` — **apenas server** (`lib/supabaseClient.ts` admin).
- Tokens Google — cookies httpOnly ou `owner_google_integracao` no Supabase.
- Prontuário — PIN + cookie `prontuario_unlock` assinado.

## Portfólio

- Tabela `profissional_portfolio`, slug por médico.
- Upload `sharp` → WebP no bucket `portfolio-fotos`.
- URL pública: `/pro/{ownerSlug}/{medicoSlug}`.

## Dois produtos no mesmo template (MedSup + Turquesa)

MedSupAPP e Turquesa Agenda são deploys **separados** (Vercel, Supabase, OAuth, Asaas, Resend). O código compartilhado usa `INTERNAL_PRODUCT_ID` em tabelas internas (`internal_audit_log`), mas **não** isola tenants por `product_id` — cada app aponta para seu próprio Supabase.

Detalhes, comparação de painéis admin e OTP: [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md).

## Deploy

Ver [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md). Build exige `verify-auth-env.mjs` em produção.
