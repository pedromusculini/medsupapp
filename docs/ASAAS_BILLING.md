# Cobrança Asaas — especificação e plano de implementação

> **Status (2026):** fase 1–5 implementada (SQL, webhook, middleware, `/dashboard/conta`). Cron/e-mail e checkout Asaas direto na UI = próximo passo.  
> Homologação sandbox: [ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md) · webhooks: [ASAAS_WEBHOOK_PASSO_A_PASSO.md](./ASAAS_WEBHOOK_PASSO_A_PASSO.md).

## Contexto do produto

- App **Next.js**; login **Google**; dados clínicos no **Google Drive do cliente** (`clientes.json` via `lib/clientesDrive.ts`).
- E-mail dono: `onboarding_profiles.email` + sessão (`requireVerifiedOwner` em `lib/api-auth.ts`).
- Planos no app: `medico-pix`, `clinica-5-pix`, `clinica-10-pix` (`lib/constants.ts`, troca em `/dashboard/perfil`).
- **Não** implementar importação CSV genérica no produto (migração = serviço manual cobrado à parte).

## Provedor

- **Asaas** — PIX, cartão, boleto, assinatura (cliente escolhe no fluxo Asaas).
- Landing: preço **mensal recorrente** (PIX ~30 dias ou cartão recorrente).
- Descontos anuais, boleto mais caro, campanhas: configurar **somente no painel Asaas** — o app **não** duplica regras nem textos promocionais.

## Trial e quando usar Asaas

| Período | Acesso | Asaas |
|---------|--------|-------|
| Dias **0–29** | Completo | **Não** — status `trial` |
| **Dia 30** | Bloqueado até pagamento | Obrigatório cadastro/cobrança Asaas |

Antes de implementar no código:

1. Sandbox Asaas: criar assinatura com **primeira cobrança** no fim dos 30 dias (`nextDueDate` ou equivalente da API v3).
2. Confirmar webhook `PAYMENT_CONFIRMED` no ambiente de teste.
3. Alinhar `externalReference` = `owner_email` (ou UUID estável do perfil).

### Estado atual no código (pré-Asaas)

| Onde | O quê |
|------|--------|
| `google_account_access` | `trial_consumed`, `trial_started_at` |
| `onboarding_profiles` | `trial_started`, `plan`, `user_type` |
| Onboarding | `trialStarted` em `/onboarding` + `markTrialConsumed` |
| **Ainda não existe** | `assinaturas`, middleware por status, webhooks |

Na implementação, **`assinaturas` passa a ser a fonte da verdade de acesso**; campos de trial no Google access podem permanecer só como histórico de “já usou trial na conta Google”.

## Regras de acesso

- **0 dias de tolerância** após vencimento.
- Reativar **somente** após webhook Asaas confirmar pagamento (não confiar em “cliquei em pagar”).
- Estados: `trial` | `active` | `expired` (inadimplência no **mesmo dia** do vencimento → `expired`).
- Fonte da verdade: **webhook** + tabela `assinaturas` (ver SQL).

## Bloqueio quando `expired`

- **Não** apagar nem alterar arquivos no Google Drive do cliente.
- **Permitir:** login, **exportar backup (CSV)** — `components/BackupPageClient.tsx` / `lib/csv-export.ts`, e **pagar** (checkout/link Asaas).
- **Bloquear:** dashboard operacional, agenda, clientes, APIs autenticadas normais → **402** ou redirect `/dashboard/conta` (ou `/conta`).

### Rotas sugeridas — sempre liberadas (mesmo `expired`)

Páginas:

- `/login`, `/auth/verificar-email`
- `/dashboard/conta` (nova) — status, link Asaas, backup se expirado
- `/backup` (export)
- `/privacidade`, `/termos`
- Públicas já existentes: `/`, `/planos`, `/f/*`, `/agendar/*`, `/calendario/adicionar/*`

APIs:

- `/api/auth/*`, `/api/auth/google-access/*`
- `/api/webhooks/asaas` (sem sessão; validar token/assinatura Asaas)
- `/api/backup/*` ou endpoints de export já usados pelo backup
- Rotas públicas atuais: `/api/formulario/*`, `/api/agendar/*`, `/api/calendario/adicionar/*`

Tudo o resto (incl. `/api/clientes`, `/api/consultas`, `/api/perfil` exceto conta): bloquear.

## Webhooks Asaas (mínimo)

Endpoint: `POST /api/webhooks/asaas`

| Evento (ex.) | Ação |
|--------------|------|
| `PAYMENT_CONFIRMED` / recebido | `status = active`, `last_payment_at`, `current_period_end` |
| `PAYMENT_OVERDUE` / sem pagamento no vencimento | `status = expired` |
| Cancelamento de assinatura | `status = expired` |

- **Idempotência:** chave por `payment.id` ou evento + `externalReference` (e-mail do `owner_email`).
- Validar header/token de webhook conforme documentação Asaas (nunca processar body sem validação em produção).
- Logar falhas; não alterar Drive.

## Lembretes

| Quando | Canal |
|--------|--------|
| **D-3 e D-1** antes do dia 30 do trial | E-mail Resend + banner no dashboard |
| Após trial, antes do vencimento da mensalidade | Banner + e-mail |
| No vencimento (0 tolerância) | Bloqueio + tela conta/backup/pagar |

WhatsApp: opcional, manual no painel (sem prometer automação Meta nesta fase).

Cron Vercel (produção): `CRON_SECRET` + jobs em `vercel.json` — ver [ENVIRONMENT.md](./ENVIRONMENT.md).

## PIX + assinatura

- Assinatura recorrente no Asaas para plano mensal.
- **PIX avulso** (2ª via) na página de conta para reativação após `expired`.

## Middleware / auth

Estender `middleware.ts` (após checagem `accessVerified`):

1. Carregar `assinaturas` por `owner_email` (cache curto ou join leve).
2. Se `trial` e `now < trial_ends_at` → seguir.
3. Se `active` e `now < current_period_end` → seguir.
4. Se `expired` → só rotas da allowlist acima; senão redirect `/dashboard/conta` ou 402 em API.

Alternativa: helper `requireActiveSubscription()` em `lib/api-auth.ts` para rotas API.

Ordem de checagens sugerida: sessão → e-mail verificado → **assinatura** → handler.

## Página de conta

Rota sugerida: `/dashboard/conta`

- Plano atual (`onboarding_profiles.plan` + `assinaturas.plano`)
- Status: trial (dias restantes), active, expired
- Botão “Gerenciar pagamento” → checkout/link Asaas
- Se `expired`: destaque para **Exportar backup** e texto claro (Drive intacto)

## Variáveis de ambiente (futuro)

Ver `.env.example` e [ENVIRONMENT.md](./ENVIRONMENT.md#asaas-futuro).

## O que NÃO fazer

- Importação CSV genérica no código.
- Deletar dados do Drive ao cancelar ou expirar.
- Prometer “qualquer CSV importa automaticamente”.
- Tolerância de dias após vencimento sem pagamento confirmado por webhook.
- Duplicar preços/descontos que já estão no painel Asaas.

## Ordem de implementação (quando sair da fase de testes)

1. `npm run db:assinaturas` — tabela + índices (`sql/assinaturas_schema.sql`)
2. `lib/assinatura.ts` — leitura de status, cálculo `trial_ends_at`, helpers
3. `POST /api/webhooks/asaas` — validação + idempotência + update Supabase
4. Criação de cliente/assinatura Asaas (server) no dia 30 ou ao escolher pagar — integração API Asaas
5. `middleware.ts` + `requireActiveSubscription` nas APIs
6. `/dashboard/conta` — UI status + links + backup
7. Cron Vercel: e-mails D-3/D-1 trial e lembrete de vencimento
8. Landing `/planos`: texto “30 dias grátis → cobrança Asaas no dia 30”
9. Painel interno (`INTERNAL_OPS`): opcional KPI `expired` / billing (Fase 5)

## Checklist sandbox (antes do passo 1 em produção)

Guia detalhado com comandos curl e homologação: **[ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md)**.

- [ ] Conta sandbox Asaas + API key (`$aact_hmlg_...`)
- [ ] Assinatura com `nextDueDate` = hoje + 30
- [ ] Webhook (webhook.site ou ngrok) recebendo eventos
- [ ] `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` após confirm no sandbox
- [ ] `PAYMENT_OVERDUE` após `POST .../sandbox/payment/{id}/overdue`
- [ ] PIX avulso (2ª via) testado manualmente

## Stack existente

| Arquivo | Uso na cobrança |
|---------|------------------|
| `middleware.ts` | Estender allowlist + bloqueio |
| `auth.ts` / `lib/api-auth.ts` | Sessão + `requireVerifiedOwner` |
| `onboarding_profiles` | `plan`, e-mail dono |
| `lib/clientesDrive.ts` | Intocado em cancelamento |
| `components/BackupPageClient.tsx` | Export se `expired` |
| `lib/csv-export.ts` | CSV backup |
| Resend | Lembretes por e-mail |

## Documentos relacionados

- [FUNCIONALIDADES.md](./FUNCIONALIDADES.md)
- [INTERNAL_OPS.md](./INTERNAL_OPS.md) — backlog billing no painel interno
- [SECURITY-LGPD.md](./SECURITY-LGPD.md)
