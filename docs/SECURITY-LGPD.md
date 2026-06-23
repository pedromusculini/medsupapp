# Segurança e LGPD — MedSupAPP

## Ações implementadas no código

- **RLS Supabase:** políticas abertas removidas (`sql/security_hardening.sql`). Acesso direto com `anon` key bloqueado; APIs usam `SUPABASE_SERVICE_ROLE_KEY` no servidor.
- **Financeiro:** coluna `owner_email` + APIs filtram por conta autenticada.
- **Tokens Google:** não expostos em `useSession` nem em `GET /api/auth/tokens`.
- **OTP:** código de 6 dígitos + rate limit em envio/verificação.
- **Formulário:** respostas removidas do Supabase após sync para o Drive.
- **Legal:** `/privacidade`, `/termos`, consentimento no login, verificação de e-mail, onboarding e formulário público.
- **Cookies:** banner `CookieConsentBanner` (essenciais + `localStorage` de preferência); seção `#cookies` na política (versão `2026-06-03`); sem cookies de marketing.

## O que você deve fazer no Supabase / Vercel

1. Executar `sql/security_hardening.sql` no SQL Editor (idempotente; ignora tabelas que ainda não existem, ex. `clientes`).
2. Confirmar `SUPABASE_SERVICE_ROLE_KEY` na Vercel (chave **service_role**, não anon).
3. Revisar políticas antigas duplicadas no painel Supabase se o projeto já existia.

## Pendências recomendadas (não automatizadas)

- Parecer jurídico e ROPA formal.
- DPAs com Google, Supabase, Meta, Resend, Vercel.
- Pentest antes de escala comercial agressiva.
- Rate limit distribuído (ex. Upstash) se brute force persistir entre instâncias.
