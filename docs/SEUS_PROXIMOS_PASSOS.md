# Seus próximos passos (produção)

Checklist para usar o MedSupAPP em **https://www.medsupapp.com.br** com o fluxo atual (WhatsApp semi-manual + agendamento online).

## Já configurado no projeto

- Supabase: perfis, `consultas_agenda`, agendamento público, mensagens WhatsApp
- Deploy Vercel na branch `master`
- Domínios `www` e apex (atualizar alias após push: `npm run deploy:promote`)

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

## 6. SQL no Supabase (se ainda não rodou)

```bash
npm run db:operacional
npm run db:google-access
npm run db:consultas-whatsapp
npm run db:agendamento
npm run db:security
```

## WhatsApp API Meta (legado, opcional)

O app **não depende** da API Business. Crons e rotas `/api/whatsapp/*` foram removidos. Documentação antiga: [WHATSAPP_BUSINESS_SETUP.md](./WHATSAPP_BUSINESS_SETUP.md) (referência apenas).

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [COMMIT_AND_DEPLOY.md](./COMMIT_AND_DEPLOY.md) | Padrão commit + push + alias |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel, domínio, troubleshooting |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Variáveis de ambiente |
| [FUNCIONALIDADES.md](./FUNCIONALIDADES.md) | Módulos do sistema |
