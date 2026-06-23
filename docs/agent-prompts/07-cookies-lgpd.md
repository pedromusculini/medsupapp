# Prompt: Cookies e LGPD

Audite cookies e consentimento no MedSupAPP.

## Arquivos

- `lib/cookieConsent.ts`
- `components/CookieConsentBanner.tsx`
- `app/privacidade/page.tsx` §8
- `app/api/auth/google-callback/route.ts`
- `app/api/prontuario-acesso/verificar-pin/route.ts`
- `lib/productTour.ts`, `lib/consultations.ts`, `lib/financeiroCache.ts` (localStorage)

## Tarefas

1. Inventariar cookies + localStorage (atualizar `docs/COOKIES.md`)
2. Comparar com texto legal — inconsistências?
3. `COOKIE_CONSENT_VERSION` — precisa bump?
4. Banner: safe-area mobile, a11y (role=dialog, foco)
5. **Não** adicionar cookies de marketing

## Entregável

Doc sincronizada + patches mínimos de UX (safe-area, a11y)
