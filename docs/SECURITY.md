# Segurança

Checklist para releases e auditorias. Para review automatizado: subagent **Security Review** no Cursor.

## Autenticação e sessão

- [ ] `AUTH_SECRET` forte (32+ bytes) só na Vercel/local
- [ ] APIs privadas usam `requireVerifiedOwner` ou equivalente
- [ ] OTP rate limit: 5/15min por e-mail (`send-code`)
- [ ] Middleware bloqueia cadastro e-mail legado

## Autorização

- [ ] Financeiro: `requireClinicaTitular`
- [ ] Médicos clínica: `clinica_email` = owner da sessão
- [ ] Admin: `isInternalAdminEmail` + sem link público
- [ ] Formulário profissional: token + regras em `clienteFichaAccess`

## Dados e Supabase

- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca em client bundle
- [ ] RLS aplicado (`npm run db:security` local)
- [ ] `GET /api/health/auth-config` em prod retorna só `{ ok }` (detalhes: admin ou `HEALTH_CONFIG_SECRET`)
- [ ] Upload portfólio: tipo imagem, max 8MB, path por owner

## Cookies e tokens

- [ ] Google tokens: httpOnly, secure em prod, sameSite lax
- [ ] Sem tokens em `localStorage` para sessão (removido — ver `useSession.ts`)
- [ ] `prontuario_unlock` assinado, TTL limitado

## APIs públicas

- [ ] Rate limit em agendar, formulário, portfolio public
- [ ] Webhook Asaas: validação `ASAAS_WEBHOOK_TOKEN`
- [ ] Sem listagem de tenants sem admin

## Headers e infra

- [ ] HTTPS only em produção
- [ ] Apex redirect 308 para www
- [ ] Secrets fora do Git (`.gitignore`)

## Git e secrets (dois produtos)

- [ ] **Nunca** commitar `.env.local`, `.env.vercel*`, `client_secret*.json`, chaves `re_*`, `service_role`, tokens Asaas/Google
- [ ] `.env.example` só com placeholders — sem e-mails reais de admin
- [ ] MedSup e Turquesa: refs distintos — MedSup `xbhqxhcryvumrzjiuswx`, Turquesa `xzujpefaifxrxyjmkrhw`
- [ ] Antes de `npm run db:*` local: confirme que `.env.local` aponta para o Supabase **deste** repo
- [ ] `RESEND_API_KEY` por conta — MedSup `pedromusculini@gmail.com`, Turquesa `marrissamartins@gmail.com`
- [ ] `client_secret*.json` no disco: gitignored; se exposto, rotacionar no Google Cloud Console

Ver [REPOSITORY.md](./REPOSITORY.md) e [INFRAESTRUTURA_DUPLO_SAAS.md](./INFRAESTRUTURA_DUPLO_SAAS.md).

## Resposta a incidentes

1. Rotacionar `AUTH_SECRET` + `AUTH_SECRET_VERSION`
2. Revogar tokens Google no painel Google Cloud
3. Reset acesso tenant: `npm run tenant:reset-access` (local)

## Ferramentas

```bash
npm run audit:email-verification   # local, script em scripts/
GET /api/health/auth-config
```
