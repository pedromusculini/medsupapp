<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy após mudanças (padrão)

Quando o usuário pedir commit/deploy ou teste em produção:

1. `npm run build` se alterou código
2. Commit em português (`feat`/`fix`/`docs`…)
3. `git push origin master`
4. Aguardar Vercel **Ready**, depois **`npm run deploy:promote`** (domínio www costuma ficar no deploy antigo sem isso)
5. SQL novo: `npm run db:*` conforme `package.json`

Fluxo completo: `docs/COMMIT_AND_DEPLOY.md`. Troubleshooting: `docs/DEPLOYMENT.md`.

## Produto (referência rápida)

- WhatsApp: semi-manual wa.me — **não** reativar `/api/whatsapp/*` sem pedido explícito
- Google: card no Dashboard (`GoogleIntegracaoCard`) — Drive/Calendar/Contacts + sync
- Comunicação: templates com variáveis bloqueadas (`MensagemTemplateEditor`)
- Docs de funcionalidades: `docs/FUNCIONALIDADES.md`
