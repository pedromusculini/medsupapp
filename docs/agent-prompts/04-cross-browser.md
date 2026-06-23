# Prompt: Cross-browser

Expanda QA cross-browser do MedSupAPP.

## Navegadores

Chrome, Edge, Brave, Opera (Chromium), Firefox, Safari (WebKit desktop + mobile).

## Fluxos críticos

- Landing `/`
- `/privacidade` + cookie banner
- `/auth/verificar-email` (mock ou staging)
- `/agendar/[slug]` (slug de teste)
- `/pro/...` (se existir slug público)
- `/test-ui/touch-select` (fixture existente)

## Tarefas

1. Atualizar `playwright.config.ts` — projects: chromium, firefox, webkit, mobile-chrome, mobile-safari
2. Adicionar specs em `e2e/` para smoke público
3. Documentar diferenças em `docs/QA_BROWSER_MATRIX.md`

## Comandos

```bash
npm run test:e2e
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e  # com dev rodando
```
