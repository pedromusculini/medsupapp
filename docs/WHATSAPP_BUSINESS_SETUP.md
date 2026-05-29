# WhatsApp Business (Meta Cloud API)

MedSupAPP can send patient messages through the official WhatsApp Business Platform. Without these variables, the app still opens manual `wa.me` links and queues rows in Supabase for later processing.

## Environment variables

Set in `.env.local` and Vercel **Production** (see [ENVIRONMENT.md](./ENVIRONMENT.md)).

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_TOKEN` | Yes | WhatsApp access token from Meta (API Setup), not the app secret |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Phone number ID from WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Secret string you choose for webhook verification |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | No | WABA ID (template management) |
| `WHATSAPP_API_VERSION` | No | Default: `v21.0` |
| `CRON_SECRET` | Yes (prod) | Bearer token for `GET /api/whatsapp/process` (Vercel Cron) |
| `WHATSAPP_TEMPLATE_FORMULARIO_LINK` | Yes* | Approved template name |
| `WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA` | Yes* | Approved template name |
| `WHATSAPP_TEMPLATE_FORMULARIO_RECEBIDO` | No | Post-form confirmation |
| `WHATSAPP_TEMPLATE_CONFIRMACAO_PAGAMENTO` | No | Payment confirmation |

\* Without approved templates, queue rows end in `status: erro` with a clear message.

## Meta setup

1. [Meta for Developers](https://developers.facebook.com/) → create a **Business** app.
2. Add **WhatsApp** → copy **Phone number ID** and access token.
3. **WhatsApp → Configuration** → webhook:
   - **Callback URL:** `https://your-domain/api/whatsapp/webhook`  
     `https://www.medsupapp.com.br/api/whatsapp/webhook`
   - **Verify token:** same as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to `messages` (and optionally `message_template_status_update`).
4. Create **Message Templates** (`pt_BR`, category **Utility**), for example:

**`formulario_paciente`**

```
Olá {{1}}, {{2}} pediu que você preencha seus dados: {{3}}
```

Parameters: patient name, clinic name, form URL.

**`lembrete_consulta`**

```
Olá {{1}}, lembrete: consulta em {{2}} às {{3}} — {{4}}. Local: {{5}}
```

Parameters: patient, date, time, service, location.

5. After approval, set exact template names in `WHATSAPP_TEMPLATE_*`.
6. For production, use a verified business number (not only the sandbox test number).

## Queue and delivery

- Messages are inserted into `whatsapp_fila` with `status: pendente`.
- Vercel Cron calls `GET /api/whatsapp/process` every 5 minutes (`vercel.json`).
- Logged-in users can trigger `POST /api/whatsapp/process`.
- The webhook route updates delivery status from Meta events.

## Local test

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/whatsapp/process
```

## Privacy (LGPD)

Obtain patient consent for WhatsApp messages. Only send reminders when a valid phone number is on file.
