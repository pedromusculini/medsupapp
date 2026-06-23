# Repositório Git vs arquivos locais

O GitHub contém o app Next.js para build na Vercel **e** a pasta `docs/` (playbook operacional). Scripts de deploy/SQL e notas de IA ficam fora do Git.

**Última revisão:** 2026-06-23

## Versionado (GitHub)

| Área | Conteúdo |
|------|----------|
| `app/` | Páginas e rotas API do Next.js |
| `components/` | UI React |
| `lib/` | Lógica de negócio e integrações |
| `public/` | Assets estáticos |
| `types/` | Tipos TypeScript |
| `e2e/` | Playwright (smoke, touch) |
| `docs/` | Documentação — índice em `docs/README.md` |
| Raiz | `auth.ts`, `middleware.ts`, `package.json`, configs, `.env.example`, `README.md` |

## Somente local (`.gitignore`)

| Pasta/arquivo | Uso |
|---------------|-----|
| `scripts/` (maioria) | Deploy, SQL, testes Asaas/webhook |
| `sql/` | Schemas Supabase |
| `supabase/` | Migrações exportadas |
| `project_summary.txt` | Snapshot para IA / referência rápida |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Regras para assistentes |
| `client_secret*.json`, `.env.local` | Segredos |
| `fixtures/` | CSV de simulação / dados de teste |
| `bfg-*.jar`, `git-filter-repo`, `*.msi` | Ferramentas |

## Integridade

```bash
npm run build          # deve passar
npm run test:e2e       # smoke público + touch (opcional)
```

Após alterações que movem rotas ou APIs, atualizar `docs/FUNCIONALIDADES.md` e `docs/INTERNAL_OPS.md`.
