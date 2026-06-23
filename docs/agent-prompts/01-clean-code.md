# Prompt: Clean code

Audite o MedSupAPP (Next.js 16, React 19, TypeScript) para deixar o código mais clean.

## Escopo

1. Identificar componentes >400 linhas (`ClientesPageClient`, `AgendaPageClient`, `dashboard/perfil/page.tsx`, `FinanceiroPageClient`, `BackupPageClient`) e propor extração **mínima** (sem over-engineering).
2. Remover `any` onde trivial: `FinanceiroPageClient`, `BackupPageClient`, `app/api/google-drive/route.ts`.
3. Padronizar tratamento de erro em APIs (`isAuthError`, `supabaseErrorMessage`).
4. Listar duplicação entre `ComunicacaoClient` e páginas de configuração.

## Entregável

- Plano em fases P0/P1/P2
- PRs pequenos (<400 linhas cada)
- `npm run build` após cada fase

## Restrições

- Não alterar comportamento de produto sem necessidade
- Seguir `docs/CLEAN_CODE.md`
- Commits em português só se o usuário pedir
