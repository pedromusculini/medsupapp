# Deploy e troubleshooting

## Hospedagem

- **Vercel** — projeto `medsupapp`
- **Domínio:** `www.medsupapp.com.br` (apex redireciona no middleware)

## Promote manual

Se `git push` não disparar build:

```bash
npx vercel deploy --prod --yes
npm run deploy:promote:wait
```

## Problemas comuns

### Build falha — AUTH_SECRET

`verify-auth-env.mjs` exige segredos em produção. Configure `AUTH_SECRET` na Vercel.

### OTP / e-mail 502

- `RESEND_FROM` deve usar domínio **verificado** no Resend (`naoresponda@medsupapp.com.br`).
- Código ignora placeholders `yourdomain.com` (`lib/email.ts`).
- Redeploy após alterar env.

### Domínio aponta para deploy antigo

Rodar `npm run deploy:promote:wait` — alias manual para último deploy Ready.

### Supabase — tabela ausente

Erro `MISSING_TABLE` → rodar script `npm run db:*` correspondente.

### Rate limit em memória

Se `rate_limits` não existir no Supabase, fallback in-memory (não compartilhado entre instâncias). Rodar `npm run db:rate-limits`.

## Logs

- Vercel → Functions → filtrar por rota (`/api/auth/google-access/send-code`, etc.)
- Resend dashboard — `resend_id` nos logs `[email] Enviado`

## Health check

`GET https://www.medsupapp.com.br/api/health/auth-config`
