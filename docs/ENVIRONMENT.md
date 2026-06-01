# Environment variables

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local` or production secrets.

## Core

| Variable | Purpose |
|----------|---------|
| `AUTH_URL` / `NEXTAUTH_URL` | Public app URL (OAuth redirects, links in emails/WhatsApp) |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Session encryption (use a strong random value in production) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (Calendar + Drive scopes) |

Aliases supported in code: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

## Supabase

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (**must** be the `service_role` secret; never the anon key) |

After schemas are applied, run `sql/security_hardening.sql` in the Supabase SQL Editor (see [SECURITY-LGPD.md](./SECURITY-LGPD.md)).
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token for `npm run db:operacional` and `npm run db:google-access` |

## Email

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender (default: `MedSupAPP <naoresponda@medsupapp.com.br>`) |

## WhatsApp

See [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md).

## Internal operations (backoffice)

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAILS` | Comma-separated Google emails allowed to use `/internal` and `/api/internal/*` (server-only). **Configure na Vercel** (Production); use placeholder em `.env.example` / `.env.local` local. |
| `INTERNAL_PRODUCT_ID` | Product slug for audit logs (default: `medsupapp`; future sibling SaaS) |

See [INTERNAL_OPS.md](./INTERNAL_OPS.md). Do **not** commit real admin e-mail addresses to the repository.

## Asaas (futuro)

> Cobrança **não implementada** na fase atual de testes. Especificação: [ASAAS_BILLING.md](./ASAAS_BILLING.md).

| Variable | Purpose |
|----------|---------|
| `ASAAS_API_KEY` | API key (sandbox ou produção) |
| `ASAAS_API_URL` | Base URL (`https://sandbox.asaas.com/api/v3` em testes) |
| `ASAAS_WEBHOOK_TOKEN` / `ASAAS_WEBHOOK_ACCESS_TOKEN` | Validação do `POST /api/webhooks/asaas` |

Após implementar: `npm run db:assinaturas` no Supabase.

## Vercel

Add the same variables under **Settings → Environments → Production**, then redeploy. Cron requires `CRON_SECRET` in production.
