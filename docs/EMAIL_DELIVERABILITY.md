# Entregabilidade de e-mail (OTP / transacional)

E-mails de código de verificação saem pelo **Resend** (`lib/email.ts`), remetente padrão `MedSupAPP <naoresponda@medsupapp.com.br>`.

## Conta MedSup (jul/2026)

| Item | Estado |
|------|--------|
| Conta Resend | `pedromusculini@gmail.com` |
| Domínio | `medsupapp.com.br` (verificado) |
| Turquesa | Conta **separada** — ver repo Turquesa |

Setup e DNS: **[RESEND_MEDSUP_SETUP.md](./RESEND_MEDSUP_SETUP.md)**.

## Verificação

1. Login Google → `/auth/verificar-email`
2. Gmail → **Mostrar original** → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`

## Troubleshooting

- `RESEND_FROM` deve usar domínio **verificado** no Resend.
- Código ignora placeholders `yourdomain.com` (`lib/email.ts`).
- Redeploy Vercel após mudar `RESEND_API_KEY` ou `RESEND_FROM`.
- Não reutilize a chave Resend do Turquesa (contas distintas).

## O que o app faz

- HTML + text/plain, `Reply-To` configurável (`lib/email.ts`).
- Rate limit OTP: 5 envios / 15 min por e-mail.
