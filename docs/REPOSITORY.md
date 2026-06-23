# Repositório Git vs arquivos locais

O GitHub contém **apenas** o necessário para build e deploy na Vercel (~230 arquivos).

## Versionado (GitHub)

| Área | Conteúdo |
|------|----------|
| `app/` | Páginas e rotas API do Next.js |
| `components/` | UI React |
| `lib/` | Lógica de negócio e integrações |
| `public/` | Assets estáticos |
| `types/` | Tipos TypeScript |
| Raiz | `auth.ts`, `middleware.ts`, `package.json`, configs, `.env.example`, `README.md` |

## Somente local (`.gitignore`)

| Pasta/arquivo | Uso |
|---------------|-----|
| `docs/` | Documentação operacional completa |
| `scripts/` | Deploy, SQL, testes Asaas/webhook |
| `sql/` | Schemas Supabase |
| `supabase/` | Migrações exportadas |
| `project_summary.txt` | Snapshot para IA / referência rápida |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Regras para assistentes |
| `client_secret*.json`, `.env.local` | Segredos |
| `bfg-*.jar`, `git-filter-repo`, `*.msi` | Ferramentas |

## Integridade

```bash
npm run build          # deve passar
git ls-files | wc -l   # ~229 no remoto
```

Após alterações que movem rotas ou APIs, atualizar `project_summary.txt` e `docs/INTERNAL_OPS.md` localmente.
