# Seus próximos passos (produção)

Checklist para usar o MedSupAPP em **https://www.medsupapp.com.br** com o fluxo atual (WhatsApp semi-manual + agendamento online).

## Já configurado no projeto

- Supabase: perfis, `consultas_agenda`, agendamento público, mensagens WhatsApp
- Deploy Vercel na branch `master`
- Domínios `www` e apex (atualizar alias após push: `npm run deploy:promote`)

## 0. Google OAuth em produção (antes de abrir para todos)

Siga **[GOOGLE_OAUTH_PRODUCAO.md](./GOOGLE_OAUTH_PRODUCAO.md)**:

1. Cadastre **as duas** redirect URIs no Google Cloud (login + `google-callback`).
2. Teste em modo **Testing** com e-mails em *Test users*.
3. Envie **Verification** (Calendar + `drive.file` + contatos opcional).
4. **Push to production** quando estiver pronto.

```bash
curl -sS https://www.medsupapp.com.br/api/health/auth-config
# → googleRedirectUris com as duas URLs
```

## 1. Primeiro uso no Dashboard

1. Faça login com Google e confirme o e-mail se pedido.
2. No **Dashboard**, card **Google — conectar e sincronizar**:
   - **Conectar Drive** (obrigatório para clientes e importações)
   - **Conectar Calendar** (agenda Google)
   - **Conectar Contatos** (opcional, importar telefones)
3. **Comunicação** (`/dashboard/comunicacao`):
   - Ajuste mensagens (variáveis em verde não podem ser apagadas)
   - Gere o **link público de agendamento**
   - Defina **horários disponíveis** (dias/horários)

## 2. Importar cadastros

- **Importar cadastros (formulário)** — respostas do link de autocadastro → Drive
- **Importar agendamentos online** — reservas feitas pelo link `/agendar/{slug}`
- **Importar contatos Google** — requer passo “Conectar Contatos”

Tudo no card Google do Dashboard; não é necessário ir em Backup só para conectar.

## 3. Lembretes WhatsApp (wa.me)

1. Marque **Enviar lembretes** ao criar consulta na Agenda (com telefone).
2. No **Dashboard**, card **Lembretes WhatsApp** — lista D-7 e D-1 do dia.
3. Toque **WhatsApp** → envie pelo seu celular (sem API Meta).

Mensagem inclui link **adicionar à agenda** para o paciente (`/calendario/adicionar/...`).

## 4. Paciente: link pessoal

Em **Clientes** → paciente → **Gerar link de agendamento** (copia URL com `?p=token`).

## 5. Deploy após mudanças no código

```bash
git push origin master
# Aguarde Ready na Vercel
npm run deploy:promote
```

Ver [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md).

## 6. Cobrança Asaas (produção)

1. **Minha conta** (`/dashboard/conta`) — plano, status, botão **Abrir pagamento no Asaas** (sempre disponível).
2. Cada pagamento confirmado pelo webhook libera **+30 dias** de acesso.
3. Variáveis na Vercel Production: ver [ENVIRONMENT.md](./ENVIRONMENT.md) e [ASAAS_BILLING.md](./ASAAS_BILLING.md).
4. Após alterar env ou código:

```bash
curl -sS https://www.medsupapp.com.br/api/health/auth-config
npm run test:webhook:prod
npm run deploy:promote
```

## 7. SQL no Supabase (se ainda não rodou)

```bash
npm run db:operacional
npm run db:google-access
npm run db:consultas-whatsapp
npm run db:agendamento
npm run db:assinaturas
npm run db:assinaturas-policy
npm run db:security
```

## WhatsApp API Meta (legado, opcional)

O app **não depende** da API Business. Crons e rotas `/api/whatsapp/*` foram removidos. Documentação antiga: [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md) (referência apenas).

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [README.md](./README.md) | Índice de toda a pasta `docs/` |
| [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | Padrão commit + push + alias + health/webhook |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel, domínio, troubleshooting |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis de ambiente |
| [ASAAS_BILLING.md](./ASAAS_BILLING.md) | Cobrança, bloqueio, webhooks |
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Módulos do sistema |
