# Commit e deploy

## Fluxo padrão

1. **`npm run build`** — se alterou código TypeScript/React.
2. **Commit** em português: `feat:`, `fix:`, `docs:`, `chore:`.
3. **`npm run release`** — `git push` + promote domínio com `--wait`.

Alternativa: `git push origin master` — hook `post-push` em `master` pode rodar promote (ver `.githooks/` local).

## SQL novo

Aplicar na ordem conforme `package.json`:

```bash
npm run db:portfolio      # exemplo
npm run db:rate-limits
```

Scripts em `scripts/` (local) + arquivos em `sql/` (local).

## Mensagem de commit

- 1–2 frases no imperativo, foco no **porquê**.
- Não incluir `.env.local`, credenciais JSON, fixtures locais.

## Antes de produção

- [ ] Build local OK
- [ ] Env Vercel atualizada (se mudou integração)
- [ ] SQL aplicado no Supabase (se mudou schema)
- [ ] Testar em aba anônima `www.medsupapp.com.br`

## Rollback

Promover deploy anterior no painel Vercel ou:

```bash
npm run deploy:promote:wait
```

(após identificar URL do deployment estável)
