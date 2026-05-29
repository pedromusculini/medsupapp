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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client (**must** be the `service_role` secret) |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token for `npm run db:operacional` and `npm run db:google-access` |

## Email

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender (default: `MedSupAPP <naoresponda@medsupapp.com.br>`) |

## WhatsApp

See [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md).

## Vercel

Add the same variables under **Settings → Environments → Production**, then redeploy. Cron requires `CRON_SECRET` in production.
