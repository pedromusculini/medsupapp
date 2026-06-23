# Performance e fluidez

## Build

```bash
npm run build
```

Analisar saída: rotas estáticas vs dinâmicas (`ƒ` = server).

## Já implementado

- `dynamic()` — `AgendaCalendar`, `FinanceiroGraficos`
- Imagens portfólio — WebP via `sharp` no upload
- Lazy load fotos galeria (`loading="lazy"`)
- Rate limit evita abuso em APIs públicas

## Oportunidades (prioridade)

| P | Item | Impacto |
|---|------|---------|
| P0 | Dividir `ClientesPageClient` / `AgendaPageClient` | Menor JS inicial, HMR mais rápido |
| P1 | `dynamic()` em modais pesados se bundle crescer | TTI agenda/clientes |
| P1 | Revisar sync agenda — debounce focus/visibility | Menos API calls |
| P2 | `next/image` em portfólio público (domínio Supabase) | LCP |
| P2 | Bundle analyzer (`@next/bundle-analyzer`) one-off | Visibilidade |

## Fluidez UX

- Modais: `max-h-[92dvh]`, `overscroll-contain`
- Touch: `touch-action: manipulation` em `globals.css`
- Evitar layout shift — reservar altura em loading states

## Medição

**Produção (Chrome DevTools → Lighthouse mobile):**

- `/dashboard`
- `/agenda`
- `/pro/...`

**Local:**

```bash
npm run dev
# Network throttling Fast 3G para fluxos públicos
```

## Metas orientativas

- LCP &lt; 2.5s (páginas públicas)
- INP &lt; 200ms (botões agenda/clientes)
- Sem main thread blocked &gt; 300ms em interação comum
