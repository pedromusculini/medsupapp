# Matriz de QA — navegadores

## Navegadores alvo

| Navegador | Motor | Prioridade | Notas |
|-----------|-------|------------|-------|
| Chrome | Chromium | P0 | Referência dev |
| Edge | Chromium | P1 | Igual Chrome na maioria dos fluxos |
| Brave | Chromium | P1 | Verificar bloqueio trackers no OAuth |
| Opera | Chromium | P2 | Raro em uso clínico |
| Firefox | Gecko | P1 | Datas, clipboard, flex/grid |
| Safari macOS | WebKit | P1 | OAuth popup, cookies |
| Safari iOS | WebKit | P0 | wa.me, safe-area, teclado OTP |

## Fluxos críticos (checklist manual)

Marque ✅ após cada release maior.

### Autenticação
- [ ] Login Google (desktop)
- [ ] OTP `/auth/verificar-email` — envio manual, código 6 dígitos
- [ ] Redirect pós-verificação onboarding/dashboard

### App logado
- [ ] Agenda — criar/editar consulta, FullCalendar mobile
- [ ] Clientes — modais, touch select
- [ ] Financeiro — só titular
- [ ] Perfil — médicos clínica, botões portfólio

### Público
- [ ] `/agendar/[slug]` — escolha médico, slot, confirmação
- [ ] `/pro/...` — layout mobile, fotos
- [ ] Cookie banner + `/privacidade#cookies`

### Integrações
- [ ] Abrir WhatsApp (iOS `openExternalUrl`)
- [ ] Autorizar Google Calendar incremental

## Testes automatizados

```bash
npm run test:e2e          # Playwright
npm run test:e2e:ui       # modo interativo
```

Projetos configurados em `playwright.config.ts`:

- `chromium` (desktop)
- `firefox`
- `webkit` (Safari engine)
- `mobile-chrome` (Pixel 5)
- `mobile-safari` (iPhone 13)

## Diferenças conhecidas

| Issue | Browsers | Mitigação no código |
|-------|----------|---------------------|
| `window.open` bloqueado | Safari iOS | `lib/openExternalUrl.ts`, `preOpenExternalTab` |
| Botão disabled não dispara click | Safari | `.btn-action[data-muted]` — visual only |
| 100vh corta barra inferior | iOS | `100dvh`, `safe-area-inset-bottom` |
| Clipboard API | HTTP / permissões | fallback `document.execCommand` se necessário |

## Lighthouse (performance)

Rodar mobile em:

- `/dashboard`
- `/agenda`
- `/pro/{slug}/{medico}`

Metas orientativas: LCP &lt; 2.5s, INP &lt; 200ms (produção).
