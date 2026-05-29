# MedSupAPP

SaaS for solo physicians and small clinics in Brazil: scheduling, finances, patient intake forms, Google Calendar/Drive integration, and WhatsApp reminders—with LGPD-oriented data handling (clinical files on the user's Google Drive; operational metadata in Supabase).

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Auth:** [Auth.js / NextAuth v5](https://authjs.dev) — Google OAuth only (Calendar + Drive scopes)
- **Database:** Supabase (profiles, queue, verification codes)
- **Email:** Resend
- **Messaging:** Meta WhatsApp Cloud API (optional; manual `wa.me` works without it)
- **Deploy:** Vercel (`sfo1`) — production URL: **https://www.medsupapp.com.br**

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — see docs/ENVIRONMENT.md
npm run db:operacional
npm run db:google-access
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

## Documentation

- [Environment variables](docs/ENVIRONMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [WhatsApp Business setup](docs/WHATSAPP_BUSINESS_SETUP.md)
- [Project summary](project_summary.txt) — architecture snapshot for contributors/AI

## Main routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing |
| `/login` | Google sign-in |
| `/auth/verificar-email` | Post-login email verification (4-digit code) |
| `/onboarding` | Clinic/doctor profile setup |
| `/dashboard` | Home after onboarding |
| `/agenda` | Calendar (Google Calendar integration) |
| `/clientes` | Patients (Google Drive + optional Google Contacts) |
| `/financeiro` | Financial records |
| `/backup` | Backup utilities |
| `/f/[token]` | Public patient form link |

## Security notes

- Do not commit `.env.local`, service role keys, or WhatsApp tokens.
- Rotate any secret that was shared in chat or logs.
- Use the Supabase **service_role** key only on the server (`SUPABASE_SERVICE_ROLE_KEY`).

## License

Private — all rights reserved unless otherwise stated by the repository owner.
