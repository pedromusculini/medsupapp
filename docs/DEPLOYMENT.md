# Deployment

MedSupAPP is deployed on [Vercel](https://vercel.com) (region `sfo1`, see `vercel.json`).

## Prerequisites

- GitHub repository connected to Vercel
- Supabase project with schemas applied (`sql/operacional_schema.sql`, `sql/consultas_whatsapp_schema.sql`, `sql/security_hardening.sql`)
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

1. Vercel → **Domains** → add `www.medsupapp.com.br` and **`medsupapp.com.br`** (apex).
2. Cloudflare DNS (**both required**):

   | Type | Name | Content | Proxy |
   |------|------|---------|-------|
   | **CNAME** | `www` | Value shown in Vercel (e.g. `….vercel-dns-….com`) | DNS only (grey) |
   | **A** | `@` | `76.76.21.21` | DNS only (grey) |

   Without the **A** record on `@`, `https://medsupapp.com.br` (no www) will not resolve. The app redirects apex → www via `vercel.json` once traffic reaches Vercel.

3. Set `AUTH_URL` and `NEXTAUTH_URL` to `https://www.medsupapp.com.br`.
4. Google OAuth redirect URI: `https://www.medsupapp.com.br/api/auth/callback/google`.

## Cron

`vercel.json` schedules two daily jobs (Hobby plan). Set `CRON_SECRET` in production; Vercel sends `Authorization: Bearer <CRON_SECRET>`:

| UTC | Route | Purpose |
|-----|-------|---------|
| 11:00 | `/api/whatsapp/lembrete-agendado` | Lembretes D-7 / D-1 + processa fila |
| 23:00 | `/api/whatsapp/process` | Processa fila pendente |

See [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md).

## Commit no GitHub, mas o site não atualiza (www)

**Sintoma:** você fez `git push`, o deploy na Vercel aparece como **Ready**, mas [https://www.medsupapp.com.br](https://www.medsupapp.com.br) continua com a versão antiga (páginas novas dão 404, textos antigos, etc.).

**Causa:** o domínio customizado (`www.medsupapp.com.br` / `medsupapp.com.br`) pode continuar apontando para um **deployment antigo**, enquanto o commit mais recente ficou só na URL `medsupapp-xxxxx.vercel.app`. Isso é comum quando o alias do domínio não foi atualizado após um deploy manual ou falha na promoção automática.

### 1. Confirmar o problema

```bash
npx vercel ls medsupapp --prod
```

Anote a URL do deploy **mais recente** (primeira linha, status Ready), por exemplo:

`https://medsupapp-gfaez561w-pedro-henrique-musculini-s-projects.vercel.app`

```bash
npx vercel alias ls
```

Se `www.medsupapp.com.br` apontar para outro hash (`medsupapp-OUTRO...`), o domínio está desatualizado.

Abra a URL do deploy novo no navegador. Se lá a versão estiver correta, o código está publicado — só falta religar o domínio.

### 2. Corrigir via CLI (recomendado após cada push importante)

Na raiz do projeto, com [Vercel CLI](https://vercel.com/docs/cli) logado (`npx vercel login`):

```bash
# Gera deploy de produção a partir do código local (ou do último push, conforme link do projeto)
npx vercel --prod --yes

# Liste o deploy mais recente e copie a URL completa (medsupapp-xxxxx-....vercel.app)
npx vercel ls medsupapp --prod

# Aponte os domínios para esse deployment (substitua pela URL do passo anterior)
npx vercel alias set medsupapp-SEU-HASH-aqui-pedro-henrique-musculini-s-projects.vercel.app www.medsupapp.com.br
npx vercel alias set medsupapp-SEU-HASH-aqui-pedro-henrique-musculini-s-projects.vercel.app medsupapp.com.br
```

**Windows (PowerShell):** use a URL explícita; evite encadear `awk` para extrair o hash — pode falhar e gerar erro `Failed to find ID or URL`.

### 3. Corrigir pelo painel Vercel

1. **Project → Deployments** → abra o deployment **Ready** do commit desejado (confira o SHA do Git no detalhe).
2. Menu **⋯ → Promote to Production** (se ainda não for o de produção).
3. **Settings → Domains** → confira se `www.medsupapp.com.br` e `medsupapp.com.br` estão vinculados ao projeto e sem aviso de SSL/DNS.
4. Teste em aba anônima ou **Ctrl+F5** (favicon e HTML ficam em cache).

### 4. Conferir integração Git

1. **Settings → Git** → repositório `pedromusculini/medsupapp` (ou o correto), branch de produção = `master` / `main`.
2. **Production Branch** deve ser a mesma em que você dá push.
3. Se o deploy automático estiver desligado, só o `vercel --prod` manual publica — lembre de rodar o passo 2 dos aliases.

### 5. Checklist rápido pós-push

| Passo | Comando / ação |
|--------|----------------|
| Push | `git push origin master` |
| Deploy listado | `npx vercel ls medsupapp --prod` → Ready, poucos minutos atrás |
| Domínio certo | `npx vercel alias ls` → `www` e apex → **mesmo** hash do deploy novo |
| Smoke test | `/privacidade`, login Google, dashboard |

### Variáveis de ambiente

Se após atualizar o domínio o **login** quebrar (“server configuration”), confira em **Settings → Environment → Production**: `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL` = `https://www.medsupapp.com.br`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (chave **service_role**, não anon). **Redeploy** depois de alterar env.
