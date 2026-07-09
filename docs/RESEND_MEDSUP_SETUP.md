# Resend — conta MedSupAPP

**Conta:** `pedromusculini@gmail.com` · Turquesa Agenda usa conta **separada** (`marrissamartins@gmail.com`).

Plano free Resend = **1 domínio por conta**. Não adicione `turquesaagenda.com.br` nesta conta.

## Estado atual (jul/2026)

| Item | Valor |
|------|--------|
| Domínio verificado | `medsupapp.com.br` |
| Remetente OTP | `MedSupAPP <naoresponda@medsupapp.com.br>` |
| Vercel (`medsupapp`) | `RESEND_API_KEY` desta conta |

## Variáveis (Vercel Production)

| Variável | Valor |
|----------|--------|
| `RESEND_API_KEY` | Chave da conta **MedSup** (domain-scoped para `medsupapp.com.br`) |
| `RESEND_FROM` | `MedSupAPP <naoresponda@medsupapp.com.br>` |

Redeploy após alterar env.

## DNS (Cloudflare)

Registros típicos do painel Resend → Domains → `medsupapp.com.br`:

| Tipo | Nome | Observação |
|------|------|------------|
| TXT | `send` | SPF Resend |
| MX | `send` | Return-path |
| TXT/CNAME | `resend._domainkey` | DKIM |

**DNS only** (nuvem cinza). Não altere A/CNAME da Vercel.

DMARC recomendado em homologação: `p=none` (evite `p=reject` sem DKIM/SPF alinhados).

## Teste

1. Login Google → `/auth/verificar-email`
2. Gmail → **Mostrar original** → `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`

## Isolamento MedSup × Turquesa

| | MedSupAPP | Turquesa Agenda |
|---|-----------|-----------------|
| Conta Resend | `pedromusculini@gmail.com` | `marrissamartins@gmail.com` |
| Domínio | `medsupapp.com.br` | `turquesaagenda.com.br` |
| Repo setup | Este arquivo | `docs/RESEND_TURQUESA_SETUP.md` (Turquesa) |

Ver também [EMAIL_DELIVERABILITY.md](./EMAIL_DELIVERABILITY.md) e [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md).
