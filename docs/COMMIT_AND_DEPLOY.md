# Commit e deploy (padrão do projeto)

Fluxo obrigatório após alterações que devem ir para **https://www.medsupapp.com.br**.

## 1. Commit

```bash
git add <arquivos relevantes>
git commit -m "tipo(escopo): resumo em português" -m "Corpo opcional: porquê e impacto."
```

**Não incluir** no commit: `.aider.*`, arquivos locais de ferramentas, `.env.local`, segredos.

**Tipos sugeridos:** `feat`, `fix`, `chore`, `docs`, `refactor`

## 2. Push

```bash
git push origin master
```

Branch de produção: **`master`** (Vercel Production Branch).

## 3. Aguardar build na Vercel

Painel → **Deployments** → status **Ready** (1–3 min), ou:

```bash
npx vercel ls medsupapp
```

## 4. Promover domínio (sempre após push importante)

A Vercel pode buildar o commit novo, mas **`www.medsupapp.com.br` continuar no deployment antigo**. Por isso, após cada push para produção:

```bash
npm run deploy:promote
```

Equivalente manual:

```bash
npx vercel ls medsupapp
# Copie a URL Ready mais recente (medsupapp-xxxxx-....vercel.app)
npx vercel alias set medsupapp-XXXX-pedro-henrique-musculini-s-projects.vercel.app www.medsupapp.com.br
npx vercel alias set medsupapp-XXXX-pedro-henrique-musculini-s-projects.vercel.app medsupapp.com.br
```

## 5. Smoke test

| URL | Esperado |
|-----|----------|
| `/dashboard` | Card Google + lembretes |
| `/dashboard/comunicacao` | Mensagens e link de agendamento |
| `/login` | Login Google |

Teste em **aba anônima** ou Ctrl+Shift+R.

## Checklist para agentes / CI

- [ ] `npm run build` passou localmente (se mudou código)
- [ ] SQL novo aplicado no Supabase (`npm run db:*`) se houver schema
- [ ] `git push origin master`
- [ ] `npm run deploy:promote` após Ready
- [ ] Domínio servindo versão nova

Detalhes e troubleshooting: [DEPLOYMENT.md](./DEPLOYMENT.md).
