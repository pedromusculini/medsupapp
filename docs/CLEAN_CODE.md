# Clean code — convenções e dívidas

## Padrões do projeto

- TypeScript estrito; evitar `any` (usar tipos de API ou `unknown` + guard)
- APIs: `requireVerifiedOwner` → `isAuthError` early return
- Erros Supabase: `supabaseErrorMessage`
- Client components: `'use client'` só quando necessário
- Commits em português, diff mínimo

## Arquivos grandes (candidatos a split)

| Arquivo | ~linhas | Sugestão |
|---------|---------|----------|
| `components/ClientesPageClient.tsx` | 1600+ | Extrair abas/modais |
| `components/AgendaPageClient.tsx` | 1480+ | Extrair handlers sync |
| `app/dashboard/perfil/page.tsx` | 1300+ | `GestaoMedicos` em componente próprio |
| `components/FinanceiroPageClient.tsx` | 1200+ | Tabelas vs gráficos |
| `components/BackupPageClient.tsx` | 1400+ | Por tipo de backup |

**Regra:** extrair só quando reduz complexidade real; não criar abstrações de uma linha.

## Dívidas conhecidas

- `eslint-disable react-hooks/exhaustive-deps` em alguns `useEffect` — revisar deps
- `any` em `FinanceiroPageClient`, `BackupPageClient`, `google-drive/route.ts`
- `middleware` deprecated → migrar para `proxy` (Next 16) quando estável
- Playwright cobre poucos fluxos — expandir conforme `QA_BROWSER_MATRIX.md`

## Imports

- `@/` alias para `lib/` e `components/`
- Lucide icons tree-shake por import nomeado

## Comentários

Só para regra de negócio não óbvia (LGPD, Safari, billing). Código autoexplicativo preferido.

## Refactor seguro

1. Extrair componente sem mudar props públicas
2. `npm run build`
3. Smoke manual do fluxo tocado
4. PR pequeno (&lt; 400 linhas ideal)
