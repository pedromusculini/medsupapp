# MedSupAPP

SaaS for solo physicians and small clinics in Brazil: scheduling, public booking links, finances, patient intake forms, Google Calendar/Drive integration, and semi-manual WhatsApp reminders (wa.me)—with LGPD-oriented data handling (clinical files on the user's Google Drive; operational metadata in Supabase).

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Auth:** [Auth.js / NextAuth v5](https://authjs.dev) — Google OAuth only (Calendar + Drive scopes)
- **Database:** Supabase (profiles, queue, verification codes)
- **Email:** Resend
- **Messaging:** WhatsApp semi-manual via `wa.me` (templates in Comunicação; no Meta API required)
- **Deploy:** Vercel (`sfo1`) — production URL: **https://www.medsupapp.com.br**

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — see docs/ENVIRONMENT.md
npm run db:operacional
npm run db:google-access
npm run db:agendamento
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google at `/login`, confirm email at `/auth/verificar-email`, then complete `/onboarding`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:operacional` | Apply operational Supabase schema |
| `npm run db:google-access` | Apply `google_account_access` schema |
| `npm run db:agendamento` | Public booking + WhatsApp message templates |
| `npm run db:assinaturas` | Subscription / Asaas billing tables |
| `npm run deploy:promote` | Point www/apex to latest Vercel Production deploy |
| `npm run test:webhook:prod` | Smoke test webhook Asaas on production |
| `npm run test:billing` | Unit tests for billing policy |

## Documentation

Índice completo: **[docs/README.md](docs/README.md)**

- [Commit & deploy](docs/COMMIT_AND_DEPLOY.md) — push + `deploy:promote` + smoke tests
- [Environment variables](docs/ENVIRONMENT.md)
- [Google OAuth production & verification](docs/GOOGLE_OAUTH_PRODUCAO.md)
- [Asaas billing](docs/ASAAS_BILLING.md) — trial, webhook, bloqueio, Minha conta
- [Features overview](docs/FUNCIONALIDADES.md)
- [Your next steps (PT)](docs/SEUS_PROXIMOS_PASSOS.md)
- [Project summary](project_summary.txt) — architecture snapshot for contributors/AI

## Main routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing |
| `/login` | Google sign-in |
| `/auth/verificar-email` | Post-login email verification (4-digit code) |
| `/onboarding` | Clinic/doctor profile setup |
| `/dashboard` | Home: Google connect/sync, WhatsApp reminders |
| `/dashboard/comunicacao` | Message templates + public booking link |
| `/agendar/[slug]` | Public patient booking |
| `/agenda` | Calendar (Google Calendar integration) |
| `/clientes` | Patients (Google Drive + optional Google Contacts) |
| `/financeiro` | Financial records |
| `/backup` | Backup utilities |
| `/dashboard/conta` | Plan, payment (Asaas), subscription status |
| `/f/[token]` | Public patient form link |

## Security & LGPD

See [docs/SECURITY-LGPD.md](docs/SECURITY-LGPD.md). After deploying schemas, run `sql/security_hardening.sql` in Supabase.

- Do not commit `.env.local`, service role keys, or WhatsApp tokens.
- Rotate any secret that was shared in chat or logs.
- Use the Supabase **service_role** key only on the server (`SUPABASE_SERVICE_ROLE_KEY`).
- Legal pages: `/privacidade`, `/termos`.

## License

Private — all rights reserved unless otherwise stated by the repository owner.
