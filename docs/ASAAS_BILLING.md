# Cobrança Asaas — especificação e implementação

> Homologação: [ASAAS_SANDBOX_VALIDACAO.md](./ASAAS_SANDBOX_VALIDACAO.md) · webhooks: [ASAAS_WEBHOOK_PASSO_A_PASSO.md](./ASAAS_WEBHOOK_PASSO_A_PASSO.md)

## Regra de negócio (produto)

**Único benefício:** 30 dias de uso gratuito no primeiro acesso. Não há outros descontos, tolerâncias extras ou “cortesias” no app.

| Fase | Acesso | Pagamento |
|------|--------|-----------|
| Dias **1–28** do trial | Completo | Não |
| **Dia 29** em diante (até fim do trial) | Completo, com aviso | Usuário **deve** abrir o Asaas, cadastrar dados e forma de pagamento |
| Após **30 dias** (`trial_ends_at`) | **Bloqueado** até webhook confirmar pagamento | Obrigatório |
| Mensalidade ativa | Completo enquanto período pago / tolerância boleto | Asaas recorrente |

### Primeiro pagamento (fim do trial)

- No **painel Asaas**, a assinatura/cobrança **não pode ter prazo de tolerância** — cobrança imediata.
- O usuário preenche dados e meio de pagamento **somente no Asaas** (dia 29+).
- **PIX / cartão:** libera no `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED`.
- **Boleto (1ª cobrança):** **só** libera em `PAYMENT_RECEIVED` (compensação). `PAYMENT_CONFIRMED` é **ignorado** para não abrir brecha.

### Mensalidades seguintes

| Meio | Liberação |
|------|-----------|
| PIX / cartão | Webhook `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` |
| **Boleto** | Até **3 dias após o vencimento** (`boleto_grace_until`); depois bloqueia até `PAYMENT_RECEIVED` |
| Inadimplência | `PAYMENT_OVERDUE` → `expired` (exceto boleto ainda dentro dos 3 dias) |

### O que nunca libera acesso

- Clique em “pagar” sem webhook.
- `PAYMENT_CREATED` (cobrança gerada).
- Boleto 1º pagamento só com `CONFIRMED` (sem compensação).
- Trial expirado sem pagamento confirmado.
- Erro ao consultar assinatura no middleware (**503** / redirect conta).

## Implementação no código

| Arquivo | Função |
|---------|--------|
| `lib/asaasBillingPolicy.ts` | Regras (trial 30d, boleto, grace 3d) |
| `lib/assinatura.ts` | `evaluateAccess`, `activateFromPayment`, trial |
| `lib/asaasWebhookHandler.ts` | Eventos Asaas + idempotência |
| `middleware.ts` | Bloqueio se `ASAAS_BILLING_ENFORCED` ≠ `false` |
| `app/api/webhooks/asaas/route.ts` | POST webhook (fora do matcher de auth) |
| `components/ContaPageClient.tsx` | Avisos boleto / dia 29 |

### Webhooks que alteram status

| Evento | Ação |
|--------|------|
| `PAYMENT_RECEIVED` | `active` (sempre que política permitir) |
| `PAYMENT_CONFIRMED` | `active` (exceto boleto 1º pagamento) |
| `PAYMENT_OVERDUE` | `expired` (respeita grace boleto) |
| `PAYMENT_REFUNDED` / `CHARGEBACK` / `DELETED` | `expired` |
| `SUBSCRIPTION_*` cancelamento | `expired` |

`externalReference` = e-mail do dono (`owner_email`).

## Banco (Supabase)

```bash
npm run db:assinaturas
npm run db:assinaturas-policy   # se tabela já existia sem colunas novas
```

Colunas extras: `first_payment_at`, `last_billing_type`, `boleto_grace_until`.

## Variáveis Vercel

| Variável | Uso |
|----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | service_role JWT |
| `ASAAS_WEBHOOK_TOKEN` | Header `asaas-access-token` |
| `ASAAS_BILLING_ENFORCED` | `true` em produção após homologar (`false` só em teste) |

Webhook produção: `https://www.medsupapp.com.br/api/webhooks/asaas`

## Configuração Asaas (painel)

1. Assinatura com **primeira cobrança** na data = fim do trial (`nextDueDate`).
2. **Sem multa/juros/tolerância** na primeira cobrança.
3. Webhook **sequencial**, eventos: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`.
4. Renovações boleto: tolerância de 3 dias é aplicada **no app** (`boleto_grace_until`), não no painel.

## Testes locais

```bash
npm run test:billing
npm run test:webhook
npm run asaas:test -- --confirm-subscription sub_xxx
```

## Rotas liberadas com `expired`

`/login`, `/dashboard/conta`, `/backup`, `/api/conta`, `/api/webhooks/asaas`, auth público, formulários/agendar públicos.

## Minha conta — pagar no Asaas

- `GET /api/conta/pagamento` — busca fatura em aberto ou cria assinatura no Asaas se ainda não existir.
- Botão **Pagar no Asaas** em `/dashboard/conta` (trial dia 29+ ou assinatura inativa).
- Requer na Vercel **Production**: `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN` + redeploy + `npm run deploy:promote`.

## Período pago

Cada `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` (conforme política de boleto) adiciona **30 dias** a partir do fim do período atual (ou de hoje).

## Ativar bloqueio no app (Vercel)

1. Webhook testado (`npm run test:webhook:prod` → POST 200).
2. Vercel → Settings → Environment Variables → **Production**:
   - `ASAAS_BILLING_ENFORCED` = `true`
3. Deployments → Redeploy → aguarde **Ready**.
4. No PC: `npm run deploy:promote` (atualiza www).
5. Usuários `expired` só acessam login, `/dashboard/conta`, `/backup` e APIs de conta.

## Próximos passos

- Cron e-mails D-3 / D-1 (dia 28–29 do trial)
