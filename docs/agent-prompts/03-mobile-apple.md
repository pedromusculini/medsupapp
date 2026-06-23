# Prompt: Mobile e Apple (iOS Safari)

Audite compatibilidade mobile e ambiente Apple no MedSupAPP.

## Verificar

- `safe-area-inset` — modais, cookie banner, `/pro/`, header mobile (`Header.tsx`, `AppShell.tsx`)
- `100dvh` vs `100vh`, `overscroll-contain`, teclado em OTP (`/auth/verificar-email`) e formulários públicos
- `lib/openExternalUrl.ts` — WhatsApp, `target=_blank` no iOS
- Touch targets ≥ 44px; `-webkit-tap-highlight-color: transparent` onde aplicável
- `viewportFit: cover` em layouts (`app/layout.tsx`, `app/pro/layout.tsx`)

## Entregável

- Checklist por página em `docs/QA_BROWSER_MATRIX.md`
- Patches mínimos com `npm run build`
- Opcional: projeto `mobile-safari` no Playwright

## Referência

`app/globals.css` — regras Safari existentes
