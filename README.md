# MedSupAPP

SaaS para médicos e clínicas: agenda, agendamento público, financeiro, formulários, Google Calendar/Drive, portfólio profissional e lembretes WhatsApp (wa.me).

**Produção:** https://www.medsupapp.com.br

## Stack

Next.js 16 · React 19 · TypeScript · Auth.js (Google) · Supabase · Vercel · Resend (OTP)

## Rodar localmente

```bash
npm install
cp .env.example .env.local
# Preencha .env.local (Google OAuth, Supabase, Resend, etc.)
npm run dev
```

Build de produção (igual à Vercel):

```bash
npm run build
npm start
```

## Documentação

Toda a documentação versionada está em **[docs/](./docs/README.md)**:

- [Funcionalidades](./docs/FUNCIONALIDADES.md) · [Arquitetura](./docs/ARCHITECTURE.md) · [Ambiente](./docs/ENVIRONMENT.md)
- [Deploy](./docs/COMMIT_AND_DEPLOY.md) · [Cookies](./docs/COOKIES.md) · [QA navegadores](./docs/QA_BROWSER_MATRIX.md)
- [Prompts para agentes](./docs/agent-prompts/README.md)

Scripts SQL e `scripts/*` de deploy/DB ficam na máquina local (ver `package.json`).

## Variáveis principais

Ver [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md) e `.env.example`.

## Rotas principais

| Path | Descrição |
|------|-----------|
| `/login` | Entrada com Google |
| `/auth/verificar-email` | OTP por e-mail (15 min) |
| `/onboarding` | Cadastro inicial |
| `/dashboard` | Início |
| `/agenda` | Agenda |
| `/clientes` | Pacientes |
| `/financeiro` | Financeiro (titular) |
| `/dashboard/perfil` | Perfil, médicos, portfólio |
| `/dashboard/configuracoes` | Mensagens, horários, links, ajuda |
| `/agendar/[slug]` | Agendamento público |
| `/pro/[owner]/[medico]` | Portfólio público |
| `/f/[token]` | Formulário público |

## Testes

```bash
npm run test:e2e       # Playwright — chromium, firefox, webkit, mobile
npm run test:e2e:ui
```

## Segurança

Não commitar `.env.local` nem chaves de serviço. Checklist: [docs/SECURITY.md](./docs/SECURITY.md). Legal: `/privacidade`, `/termos`.
