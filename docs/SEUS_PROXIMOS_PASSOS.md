# Seus próximos passos (WhatsApp + produção)

Checklist do que **você** ainda precisa fazer no painel Meta e Vercel. O código, Supabase e deploy já foram atualizados.

## Já feito automaticamente

- SQL no Supabase (`consultas_agenda`, lembretes, conversas)
- Push `master` + deploy Vercel
- Domínios `www.medsupapp.com.br` e `medsupapp.com.br` apontando para o deploy novo
- Variáveis base na Vercel: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `CRON_SECRET`

## 1. Renovar token Meta (urgente se expirou)

O token temporário da Meta **expira**. Sintoma: mensagens não saem, fila com erro na API.

1. [developers.facebook.com](https://developers.facebook.com/) → seu app → **WhatsApp** → **API Setup**
2. Gere um **novo access token**
3. Vercel → **Settings** → **Environment Variables** → **Production** → atualize `WHATSAPP_TOKEN`
4. **Redeploy** (Deployments → ⋯ → Redeploy)

## 2. Templates aprovados (obrigatório para lembretes)

Sem template, o cartão em Perfil mostra “falta template” e a fila vai para `erro`.

1. **WhatsApp Manager** → **Message templates** → criar em **pt_BR**, categoria **Utility**
2. Nome sugerido: `lembrete_consulta`
3. Corpo (5 variáveis):

   ```
   Olá {{1}}, lembrete: consulta em {{2}} às {{3}} — {{4}}. Local: {{5}}
   ```

4. Aguarde status **Approved**
5. Na Vercel, adicione (nome **exato** do template):

   - `WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA` = `lembrete_consulta` (ou o nome que você criou)
   - Opcional: `WHATSAPP_TEMPLATE_FORMULARIO_LINK` para envio automático de formulário

6. Redeploy

Listar templates da sua conta (com token válido no `.env.local`):

```bash
node scripts/list-meta-whatsapp-templates.mjs
```

## 3. Webhook Meta

1. App → **WhatsApp** → **Configuration** → **Webhook**
2. **Callback URL:** `https://www.medsupapp.com.br/api/whatsapp/webhook`
3. **Verify token:** mesmo valor de `WHATSAPP_VERIFY_TOKEN` na Vercel
4. **Verify and save**
5. Assine o campo **`messages`** (Confirmar/Cancelar)

Testar verificação (token no `.env.local`):

```bash
node scripts/check-whatsapp-production.mjs
```

## 4. Teste ponta a ponta

1. **Perfil** → cartão WhatsApp deve ficar **Ativo** (verde)
2. **Agenda** → consulta daqui a **7 dias** ou **1 dia**, WhatsApp do paciente, checkbox de lembretes marcado
3. Supabase → `consultas_agenda` com a linha nova
4. Disparo manual do cron (use o `CRON_SECRET` da Vercel):

   ```bash
   curl -H "Authorization: Bearer SEU_CRON_SECRET" "https://www.medsupapp.com.br/api/whatsapp/lembrete-agendado"
   ```

5. Celular de teste (sandbox: número cadastrado na Meta) → receber template + botões **Confirmar** / **Cancelar**
6. Supabase → `consultas_agenda.status` atualizado; reabrir **Agenda** no app

## 5. LGPD

- Avise pacientes sobre lembretes no WhatsApp
- Use telefone correto e só com a opção de lembretes marcada

## Scripts úteis

| Comando | Função |
|---------|--------|
| `npm run db:verify-whatsapp` | Confere tabelas no Supabase |
| `node scripts/check-whatsapp-production.mjs` | Status + webhook + cron em produção |
| `node scripts/list-meta-whatsapp-templates.mjs` | Lista templates na Meta |

Detalhes: [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md), [DEPLOYMENT.md](./DEPLOYMENT.md).
