# Prompt: Segurança

Execute security review do MedSupAPP.

## Foco

- `middleware.ts` — rotas públicas, bypass?
- `requireVerifiedOwner` em todas APIs sensíveis
- `lib/rateLimit.ts` — rotas sem proteção
- Cookies Google: httpOnly, secure, sameSite (`google-callback`)
- `SUPABASE_SERVICE_ROLE_KEY` só server-side
- Upload portfólio: validação tipo/tamanho
- Webhook Asaas token
- `/naomexaaquiseucorno` — allowlist `ADMIN_EMAILS`
- Open redirect em OAuth (`safeAppRedirectPath`)

## Método

Preferir subagent **Security Review** (`readonly: true`) no diff atual ou branch.

## Entregável

Relatório: crítico / alto / médio / baixo + fixes P0 se triviais

Atualizar `docs/SECURITY.md` se encontrar gaps novos
