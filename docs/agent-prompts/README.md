# Prompts para agentes (Cursor)

Copie o conteúdo de cada arquivo para uma conversa em **Agent mode**, ou referencie com `@docs/agent-prompts/NN-nome.md`.

| # | Arquivo | Modelo sugerido | Foco |
|---|---------|-----------------|------|
| 01 | [01-clean-code.md](./01-clean-code.md) | GPT-5.3 Codex / Sonnet | Refator, `any`, splits |
| 02 | [02-documentacao.md](./02-documentacao.md) | Sonnet / GPT-5.5 | Docs PT-BR |
| 03 | [03-mobile-apple.md](./03-mobile-apple.md) | Sonnet | iOS Safari, safe-area |
| 04 | [04-cross-browser.md](./04-cross-browser.md) | General + Playwright | Firefox, WebKit |
| 05 | [05-performance.md](./05-performance.md) | Codex | Bundle, LCP |
| 06 | [06-seguranca.md](./06-seguranca.md) | Security Review subagent | Auth, APIs |
| 07 | [07-cookies-lgpd.md](./07-cookies-lgpd.md) | Sonnet | Cookies vs privacidade |
| 08 | [08-integridade-dados.md](./08-integridade-dados.md) | General | Supabase, schemas |

**Regra:** sempre `npm run build` após mudanças de código. Deploy só se o usuário pedir (`npm run release`).
