# Operações internas (backoffice) — guia completo

Documentação do painel restrito de **suporte e métricas** do MedSupAPP. Destinado à equipe autorizada; **não** é funcionalidade para usuários finais (médicos/clínicas).

> **Turquesa Agenda (produto irmão):** URL canônica `/painel-turque-agenda`, Supabase/Resend/Asaas próprios, OTP 5 min, plano único R$ 79,90. Comparativo: [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md).

## Objetivo

- Responder chamados de suporte sem abrir Supabase ou código a cada ticket.
- Acompanhar adoção do produto (contas ativas, trial, onboarding).
- Preparar evolução para billing (Asaas) e marketing (UTM), sem misturar com dados de pacientes.

## Papéis e LGPD

| Papel | Quem | Dados |
|-------|------|--------|
| **Controlador** | Médico/clínica contratante | Pacientes, prontuário (Drive), decisões clínicas |
| **Operador** | MedSupAPP (software) | Processa dados sob instrução do controlador |
| **Suporte interno** | Pessoas na allowlist `ADMIN_EMAILS` | Só metadados da **conta** do contratante |

Princípios: **minimização**, **finalidade** (suporte e operação do SaaS), **auditoria** de acessos internos. Detalhes legais: `/termos` e `/privacidade` (versões em `lib/legal.ts`).

## O que o painel mostra

- **Lista de contas:** união de `google_account_access` (quem entrou com Google) + `onboarding_profiles` (perfil salvo). Quem só fez login/OTP aparece com onboarding pendente — ex.: suporte antes de “Finalizar cadastro”.
- Perfil: `onboarding_profiles` (tipo, plano, trial, onboarding, nome clínica/médico, WhatsApp profissional, cidade/UF).
- Acesso: `google_account_access` (e-mail verificado, último login, trial).
- **Contagens agregadas** por `owner_email`:
  - clientes cadastrados (sem listar nomes);
  - consultas na agenda;
  - links de formulário.
- Flags: slug de agendamento público ativo; lembretes WhatsApp (ligado/desligado e dias).
- **Saúde técnica** por conta: sync pendente (agendamentos/formulários), conta “ativada” (uso mínimo), dias sem login.
- **Notas internas** (texto do operador, sem dados de paciente).
- **Auditoria** na ficha: últimas ações em `internal_audit_log` para aquela conta.
- KPIs globais na home interna (inclui contas ativadas e com sync pendente).

## O que o painel **não** mostra

- Nome, telefone, CPF ou prontuário de **pacientes**.
- Conteúdo de arquivos no Google Drive.
- Texto de mensagens WhatsApp com dados do paciente.
- Tokens OAuth, `service_role` ou segredos de ambiente.

## Arquitetura (código)

```
middleware.ts              → 404 se path /naomexaaquiseucorno ou /api/naomexaaquiseucorno e e-mail ∉ ADMIN_EMAILS
lib/internalAdmin.ts       → parseAdminEmails() — lista vazia se ADMIN_EMAILS ausente
lib/constants.ts           → ADMIN_PANEL_PATH=/naomexaaquiseucorno
lib/internalMetrics.ts     → queries só metadados + COUNT + health
lib/internalTenantHealth.ts → saúde técnica (sync, ativação, dias sem login)
lib/internalTenantNotes.ts  → notas internas por conta
lib/internalAuditLog.ts     → listagem de auditoria na ficha (filtra product_id)
lib/internalAudit.ts        → insert em internal_audit_log
app/naomexaaquiseucorno/    → UI (sem link no menu); subrota /planos
app/api/naomexaaquiseucorno/ → overview, tenants, notes, reset-access, plans, reset-prontuario
```

Respostas de API usam **404** para não administradores (não revelar existência do painel).

## Variáveis de ambiente

Configure **somente** em `.env.local` (desenvolvimento) e na **Vercel** (produção). Nunca commite e-mails reais no GitHub.

### Vercel (produção)

1. Dashboard → projeto **medsupapp**.
2. Menu lateral do projeto → **Environment Variables** (não confundir com Settings → *Environments*, que é outra coisa).
3. Adicionar:
   - `ADMIN_EMAILS` = seu e-mail Google de login (ex.: `pedromusculini@gmail.com` — vírgula ou ponto-e-vírgula entre vários).
   - **Obrigatório na Vercel Production** + redeploy + `npm run deploy:promote`. Sem isso, `/naomexaaquiseucorno` responde **404** (como rota inexistente).
   - `INTERNAL_PRODUCT_ID` = `medsupapp` (opcional; padrão no código).
4. Marcar **Production** → Save.
5. **Redeploy** do último deployment de Production (variáveis novas só entram em deploy novo).

Via CLI (alternativa):

```bash
npx vercel env add ADMIN_EMAILS production
npx vercel env add INTERNAL_PRODUCT_ID production
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ADMIN_EMAILS` | Sim (prod) | E-mails Google separados por vírgula ou ponto-e-vírgula. **Se vazio, ninguém é admin.** |
| `INTERNAL_PRODUCT_ID` | Não | Padrão `medsupapp`; identifica produto em logs (futuro SaaS irmão) |

Exemplo em `.env.example` (placeholder):

```env
ADMIN_EMAILS=your-admin@gmail.com
INTERNAL_PRODUCT_ID=medsupapp
```

## Banco de dados

```bash
npm run db:internal
npm run db:internal-notes
```

`internal_audit_log`:

- `admin_email`, `action`, `product_id`, `target_owner_email`, `metadata`, `created_at`
- Ações: `view_overview`, `list_tenants`, `view_tenant`, `reset_access`, `add_internal_note`

`internal_tenant_notes` (notas de suporte):

- `owner_email`, `admin_email`, `body`, `created_at`

## Uso do painel

1. Login normal no app (Google), com e-mail presente em `ADMIN_EMAILS`.
2. Acessar a rota interna manualmente (não há atalho no menu do produto).
3. Home: KPIs + tabela de contas (busca, **filtros de saúde**, coluna saúde).
4. Clique na linha → ficha da conta (saúde, notas, histórico de auditoria, reset de acesso).

### Filtros na lista (`filter`)

| Valor | Significado |
|-------|-------------|
| `all` | Todas (padrão) |
| `sync_pending` | Sync de agendamentos ou formulários pendente |
| `not_activated` | Sem uso mínimo (clientes/consultas/slug) |
| `inactive_30d` | Sem login há 30+ dias |
| `onboarding_incomplete` | Onboarding não concluído |

## APIs (referência)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/naomexaaquiseucorno/overview` | KPIs globais |
| GET | `/api/naomexaaquiseucorno/tenants?q=&filter=&limit=&offset=` | Lista paginada (`filter`: ver tabela acima) |
| GET | `/api/naomexaaquiseucorno/tenants/[email]` | Ficha + `notes` + `audit_log` + log `view_tenant` |
| GET/POST | `/api/naomexaaquiseucorno/tenants/[email]/notes` | Listar / criar nota interna |
| POST | `/api/naomexaaquiseucorno/tenants/[email]/reset-access` | Reset de acesso (`mode`: `reverify` ou `remove`) |
| GET/PATCH | `/api/naomexaaquiseucorno/plans` | Catálogo de planos comerciais (admin) |
| POST | `/api/naomexaaquiseucorno/tenants/[email]/reset-prontuario` | Reset PIN prontuário (suporte) |

Todas exigem sessão Google + `requireInternalAdmin()`.

### Resetar / excluir login (suporte)

**Onde:** [https://www.medsupapp.com.br/naomexaaquiseucorno](https://www.medsupapp.com.br/naomexaaquiseucorno) — **sem** link no app; acesso direto na URL (e-mail em `ADMIN_EMAILS`).

| Onde na UI | Ação |
|------------|------|
| Lista de contas — coluna **Ações** | **Reset** ou **Excluir login** na linha |
| Ficha `/naomexaaquiseucorno/tenant/email@...` | Bloco amarelo no topo (mesmos botões) |

1. **Resetar verificação de e-mail** (recomendado) — zera `email_verified_at`; invalida OTP. Usuário refaz `/auth/verificar-email`.
2. **Excluir login Google** — remove `google_account_access`; próximo login recomeça (como script `npm run tenant:reset-access -- email remove`).

Peça ao usuário abrir `https://www.medsupapp.com.br/api/auth/signout` e entrar de novo.

## Segurança

- **Allowlist** server-side (`ADMIN_EMAILS`); não usar `NEXT_PUBLIC_`.
- Middleware + checagem dupla nas rotas API.
- `robots.txt`: `Disallow` `/naomexaaquiseucorno` e `/api/naomexaaquiseucorno`.
- Layout interno: `robots: noindex`.
- Sem link público em landing, Header, Footer ou dashboard.

**Não** confiar em URL “secreta”: segurança é autenticação + allowlist.

## Fase 4 — Deploy (procedimento)

```bash
# 1) Schemas internos (idempotentes)
npm run db:internal
npm run db:internal-notes

# 2) Build local
npm run build

# 3) Produção + domínio www
npx vercel deploy --prod --yes
npm run deploy:promote
```

Variáveis na Vercel Production antes do deploy:

```env
ADMIN_EMAILS=<configure na Vercel — não commitar no Git>
INTERNAL_PRODUCT_ID=medsupapp
```

### Checklist pós-deploy (validação manual)

| # | Teste | Resultado esperado |
|---|--------|-------------------|
| 1 | Login com Google **fora** de `ADMIN_EMAILS` → abrir `/naomexaaquiseucorno` | **404** — mesma UX de página inexistente (sem mensagem sobre admin) |
| 2 | Login com e-mail **na** allowlist → `/naomexaaquiseucorno` | Painel com KPIs e tabela de contas |
| 3 | Mesmo usuário não-admin → `GET /api/naomexaaquiseucorno/overview` (aba Network, logado) | **404** JSON |
| 4 | Admin → `GET /api/naomexaaquiseucorno/tenants/[email]` (sua conta ou de teste) | JSON com `tenant.counts.*` numéricos; **sem** `paciente`, `telefone`, `nome` de paciente |
| 5 | Supabase → tabela `internal_audit_log` após abrir uma ficha | Linha `view_tenant` com `product_id` = `medsupapp` |
| 6 | Filtro **Sync pendente** na home interna | Só contas com `health.sync_*_pendentes` > 0 |
| 7 | Ficha → adicionar nota | Nota em `internal_tenant_notes` + audit `add_internal_note` |
| 8 | Ficha → bloco **Auditoria** | Entradas recentes sem PII de paciente |

**Revisão JSON (item 4):** campos permitidos são metadados da conta (`email`, `plan`, `display_name`, `counts`, `flags`, `health`, `notes`, `audit_log`, etc.). Qualquer campo de paciente na resposta é bug — reportar e corrigir.

## Fase 5 — Backlog (TODO; não implementado)

> O schema `internal_audit_log` e `INTERNAL_PRODUCT_ID` / `product_id` já estão prontos para multi-produto.

- [ ] **Marketing:** UTM (e cupom) no signup; funil por campanha no painel interno.
- [ ] **Billing Asaas:** status de assinatura (ativo / trial / inadimplente) no card do tenant — ver [ASAAS_BILLING.md](./ASAAS_BILLING.md).
- [ ] **Segundo produto:** `INTERNAL_PRODUCT_ID` para SaaS irmão (outro segmento); mesmo código base ou monorepo futuro; filtrar tenants/auditoria por `product_id` quando houver coluna no perfil.

## Documentação relacionada

- [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md) — isolamento MedSup vs Turquesa
- [ENVIRONMENT.md](./ENVIRONMENT.md) — variáveis
- [SECURITY-LGPD.md](./SECURITY-LGPD.md) — RLS, isolamento, LGPD geral
