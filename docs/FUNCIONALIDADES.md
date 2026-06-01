# Funcionalidades do MedSupAPP

Visão geral dos módulos em produção (2026).

## Autenticação e perfil

- Login **somente Google** (Calendar + Drive no OAuth inicial)
- Verificação de e-mail (código) e trial
- **Perfil** (`/dashboard/perfil`): dados médico/clínica, endereço, médicos da clínica
- **Configurações** (`/dashboard/configuracoes`): mensagens WhatsApp, horários (médico/clínica), link de agendamento

## Dashboard (`/dashboard`)

- **Google — conectar e sincronizar**: Drive, Calendar, Contatos + importações
- **Lembretes WhatsApp**: envio manual D-7 / D-1 via wa.me
- Link de autocadastro de pacientes
- Atalhos para agenda, clientes, financeiro

## Agenda (`/agenda`)

- Consultas locais + opcional **Google Calendar**
- Nova consulta: **seletor de cliente com busca** (lista do Drive)
- Checkbox de lembretes WhatsApp (lista no Dashboard)
- Sem envio automático pela API Meta

## Clientes (`/clientes`)

- Dados no **Google Drive** (`clientes.json`)
- **Agendar consulta** (lista ou ficha) → abre Agenda com cliente pré-selecionado
- **Últimos 5 atendimentos** com observações na aba Resumo
- Formulário por paciente, link de **agendamento pessoal**
- Sync formulários, agendamentos online, contatos Google

## Agendamento público

- **`/agendar/{slug}`**: paciente identifica por telefone ou link `?p=token`
- Grava `consultas_agenda` + fila sync Drive
- **Não** cria evento Google automaticamente no servidor

## Calendário do paciente

- **`/calendario/adicionar/{token}`**: Google Calendar + arquivo `.ics`
- Link `{{link_calendario}}` nas mensagens configuráveis

## Minha conta e cobrança (`/dashboard/conta`)

- Plano contratado, status da assinatura, período pago até
- Botão **Abrir pagamento no Asaas** (PIX, cartão, boleto) — sempre visível; pagamento antecipado soma +30 dias
- Bloqueio de rotas quando `expired` (middleware + `ASAAS_BILLING_ENFORCED`)
- Detalhes: [ASAAS_BILLING.md](./ASAAS_BILLING.md)

## Financeiro e backup

- **Financeiro**: transações (Drive)
- **Backup**: export CSV e arquivos no Drive

## Mensagens WhatsApp (semi-manual)

Templates em Comunicação com variáveis **bloqueadas** na UI:

| Variável | Uso |
|----------|-----|
| Nome do paciente | Obrigatório em todos |
| Data / Horário | Lembretes e confirmação |
| Link de agendamento | Convite |
| Link adicionar à agenda | Lembretes e confirmação |
| Médico, local, clínica | Opcionais no texto |

Substituição na hora do envio; persistência em `mensagens_whatsapp_config` (Supabase).

## APIs públicas

- `/f/[token]` — formulário paciente
- `/agendar/*` — agendamento
- `/api/calendario/adicionar/[token]` — dados do evento / ICS

## Banco (Supabase)

Operacional: perfis, consultas, filas legadas, agendamento, mensagens, índice telefone→paciente, **assinaturas** (Asaas).  
Dados clínicos detalhados: **Google Drive** do usuário (LGPD).
