# Funcionalidades

## Autenticação

- Login **somente Google** (`/login`).
- Após o Google, **OTP por e-mail** (Resend) em `/auth/verificar-email` — TTL 15 min, envio manual pelo usuário.
- Onboarding em `/onboarding` até perfil completo.
- Revalidação de e-mail após 30 dias de inatividade.

## Dashboard e navegação

| Rota | Função |
|------|--------|
| `/dashboard` | Início, lembretes WhatsApp (manual wa.me) |
| `/agenda` | Agenda FullCalendar + Google Calendar |
| `/clientes` | Pacientes, prontuário, formulários |
| `/financeiro` | Repasses (titular da clínica) |
| `/backup` | Export CSV / sync Google Drive |
| `/dashboard/perfil` | Dados, médicos da clínica, portfólio |
| `/dashboard/configuracoes` | Mensagens, horários, links públicos, pagamento, **ajuda** |

## Público (sem login)

| Rota | Função |
|------|--------|
| `/agendar/[slug]` | Agendamento online |
| `/f/[token]` | Formulário / anamnese do paciente |
| `/pro/[ownerSlug]/[medicoSlug]` | Portfólio profissional (fotos WebP, história) |
| `/r/[token]` | Redirect curto |
| `/privacidade`, `/termos` | Legal LGPD |

## Clínica — médicos da equipe

Em **Perfil → Médicos da clínica**:

- Cadastro CRM, comissão, WhatsApp.
- Convite agenda Google.
- **Portfólio:** editar, **Ver portfólio**, copiar link, compartilhar WhatsApp.

## Comunicação WhatsApp

- **Semi-manual** via `wa.me` — sem API Meta ativa em produção por padrão.
- Templates em Configurações com variáveis bloqueadas (`MensagemTemplateEditor`).
- Lembretes 7 e 1 dia no dashboard.

## Google

- OAuth no login; tokens incrementais (Calendar, Drive, Contatos) em cookies httpOnly após autorização.
- Sync manual em Agenda, Backup e Clientes.

## Assinaturas

- Planos e cobrança Asaas (`ASAAS_BILLING_ENFORCED` em produção).
- Middleware bloqueia rotas se assinatura inativa (com exceções documentadas em `lib/subscriptionPaths.ts`).

## Admin interno

- `/naomexaaquiseucorno` — allowlist `ADMIN_EMAILS`, sem link público no app.
