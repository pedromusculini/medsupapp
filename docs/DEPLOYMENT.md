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
3. Set `AUTH_URL` and `NEXTAUTH_URL` to your production URL (e.g. `https://medsupapp.vercel.app` or custom domain).
4. Redeploy after changing environment variables.
5. In Meta, verify the webhook (requires a successful deploy with `WHATSAPP_VERIFY_TOKEN` set).

## Custom domain

Point DNS to Vercel, add the domain in the Vercel project, and update Google OAuth redirect URIs and `AUTH_URL` / `NEXTAUTH_URL`.

## Cron

`vercel.json` schedules WhatsApp queue processing every 5 minutes. Ensure `CRON_SECRET` is set in production; Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/whatsapp/process`.
