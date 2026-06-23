# Variáveis de ambiente

Copie `.env.example` → `.env.local`. **Nunca commitar secrets.**

## Obrigatórias (produção)

| Variável | Descrição |
|----------|-----------|
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Assinatura sessão JWT |
| `AUTH_URL` | URL canônica (`https://www.medsupapp.com.br`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `NEXT_PUBLIC_SUPABASE_URL` | Projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only |
| `RESEND_API_KEY` | Envio OTP |
| `RESEND_FROM` | Remetente verificado (ex. `MedSupAPP <naoresponda@medsupapp.com.br>`) |

## Produção recomendadas

| Variável | Descrição |
|----------|-----------|
| `ASAAS_API_KEY` / `ASAAS_API_URL` | Cobrança |
| `ASAAS_WEBHOOK_TOKEN` | Validação webhook |
| `ASAAS_BILLING_ENFORCED` | `true` em Production |
| `ADMIN_EMAILS` | Painel interno |
| `CRON_SECRET` | Jobs agendados |

## Opcionais / integrações

| Variável | Descrição |
|----------|-----------|
| `WHATSAPP_*` | Meta Cloud API (desativado no fluxo principal wa.me) |
| `JWT_SECRET` | Assinatura cookies prontuário (fallback AUTH_SECRET) |
| `AUTH_SECRET_VERSION` | Rotação invalidação cookies |
| `PRONTUARIO_TOKEN_ENABLED` | Rotas token prontuário |

## Verificação local

```bash
npm run build   # roda verify-auth-env.mjs
```

Produção: `GET /api/health/auth-config` (sem expor valores).

## Vercel

Sincronizar env com `npm run supabase:sync-vercel` (script local). Após alterar env em Production, **redeploy** necessário.

## Isolamento vs Turquesa Agenda

MedSupAPP e Turquesa compartilham o template de código, mas **não** compartilham banco nem integrações em produção. Cada Vercel project tem seu `NEXT_PUBLIC_SUPABASE_URL`, `GOOGLE_*`, `ASAAS_*`, `RESEND_FROM` e `INTERNAL_PRODUCT_ID=medsupapp`.

OTP (`verification_codes`) e contas (`google_account_access`) ficam no Supabase **deste** deploy — códigos do Turquesa não validam aqui.

Ver [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md).
