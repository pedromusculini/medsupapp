# Deployment

MedSupAPP is deployed on [Vercel](https://vercel.com) (region `sfo1`, see `vercel.json`).

## Prerequisites

- GitHub repository connected to Vercel
- Supabase project with schemas applied (`npm run db:operacional`, `npm run db:google-access`)
- Google OAuth client with authorized redirect URIs for production domains
- Resend domain verified for transactional email
- Meta WhatsApp webhook pointing to `https://<your-domain>/api/whatsapp/webhook`

## Steps

1. Push `main` (or your production branch) to GitHub.
2. In Vercel → **Settings → Environments → Production**, set all variables from [ENVIRONMENT.md](./ENVIRONMENT.md).
3. Set `AUTH_URL` and `NEXTAUTH_URL` to `https://www.medsupapp.com.br` (canonical domain).
4. Redeploy after changing environment variables.
5. In Meta, verify the webhook (requires a successful deploy with `WHATSAPP_VERIFY_TOKEN` set).

## Custom domain (canonical: www)

1. Vercel → **Domains** → add `www.medsupapp.com.br` (primary) and `medsupapp.com.br` (redirects to www via `vercel.json`).
2. Cloudflare DNS:
   - **CNAME** `www` → `cname.vercel-dns.com` (DNS only / grey cloud first)
   - **A** `@` → `76.76.21.21` (optional; apex redirects to www)
3. Set `AUTH_URL` and `NEXTAUTH_URL` to `https://www.medsupapp.com.br`.
4. Google OAuth redirect URI: `https://www.medsupapp.com.br/api/auth/callback/google`.

## Cron

`vercel.json` schedules WhatsApp queue processing every 5 minutes. Ensure `CRON_SECRET` is set in production; Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/whatsapp/process`.
