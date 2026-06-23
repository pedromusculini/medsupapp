# Cookies e armazenamento local

Inventário técnico alinhado a `/privacidade#cookies`. **Sem cookies de marketing.**

Versão do aviso: `COOKIE_CONSENT_VERSION` em `lib/cookieConsent.ts` — incrementar ao mudar uso de cookies ou texto material.

## Cookies HTTP (servidor)

| Nome | Tipo | Finalidade | httpOnly | secure (prod) | sameSite |
|------|------|------------|----------|---------------|----------|
| `authjs.*` / NextAuth session | Essencial | Sessão login Google | Sim | Sim | lax |
| `google_calendar_token` | Essencial | API Calendar (se autorizado) | Sim | Sim | lax |
| `google_drive_token` | Essencial | API Drive | Sim | Sim | lax |
| `google_contacts_token` | Essencial | API Contatos | Sim | Sim | lax |
| `google_*_token_refresh` | Essencial | Refresh OAuth incremental | Sim | Sim | lax |
| `prontuario_unlock` | Essencial | Desbloqueio prontuário (PIN) | Sim | Sim | lax |

Definição cookies Google: `app/api/auth/google-callback/route.ts`, `lib/googleIncrementalOAuth.ts`.

## localStorage (navegador)

| Chave | Finalidade | Consentimento |
|-------|------------|---------------|
| `medsupapp-cookie-consent` | Ciência do aviso de cookies | Banner “Entendi” |
| `medsup_product_tour` | Progresso tour guiado | Operacional / UX |
| `medsupapp-consultations` | Cache local consultas (legado/sync) | Essencial operação |
| `medsupapp-financeiro:*` | Cache filtros financeiro | Essencial operação |
| `medsup_chrome_ext_notice` | Dispensa aviso extensão Chrome | UX |

## O que não usamos

- Google Analytics, Meta Pixel, Hotjar
- Cookies de remarketing ou publicidade de terceiros

## Banner

- Componente: `components/CookieConsentBanner.tsx`
- Registro em `localStorage`, não bloqueia login
- Safe area iOS: `env(safe-area-inset-bottom)`

## Manutenção

Ao adicionar novo cookie ou storage:

1. Atualizar esta página e `app/privacidade/page.tsx` §8
2. Incrementar `COOKIE_CONSENT_VERSION`
3. Usuários verão o banner novamente

## Auditoria rápida (DevTools)

Application → Cookies + Local Storage em `www.medsupapp.com.br` após login e após autorizar Google Calendar.
