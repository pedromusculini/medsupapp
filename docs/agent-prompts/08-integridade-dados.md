# Prompt: Integridade de dados (Supabase)

Verifique integridade de dados e schemas Supabase do MedSupAPP.

## Escopo

- Scripts `npm run db:*` em `package.json` vs arquivos SQL locais (`sql/`)
- Tabelas críticas: `google_account_access`, `verification_codes`, `profissional_portfolio`, `rate_limits`, `clinica_medicos`, `assinaturas`
- Consistência `owner_email` / `clinica_email`
- RLS — `npm run db:security` (script local)

## Scripts úteis (máquina local)

```bash
npm run audit:email-verification [email]
npm run reset:email-verification <email>
npm run db:portfolio
npm run db:rate-limits
```

## Entregável

Checklist de schemas aplicados em produção
Lista de queries de auditoria (sem expor PII em logs)
Atualizar `docs/ARCHITECTURE.md` se necessário

## Restrições

Não rodar DELETE/UPDATE em produção sem confirmação explícita do usuário
