# Google OAuth — publicar em produção (verificação)

Guia para colocar o consent screen em **Production** e passar na **verificação do Google**, para qualquer usuário com conta Google poder fazer login no MedSupAPP.

**URL canônica:** `https://www.medsupapp.com.br`

---

## Resumo

| Modo Google | Quem entra | Verificação |
|-------------|------------|-------------|
| **Testing** | Só e-mails em *Test users* (máx. 100) | Não obrigatória |
| **Production** (sem verificação) | Qualquer Google, com aviso “app não verificado” | Limite ~100 usuários |
| **Production** + **Verified** | Qualquer Google, sem aviso bloqueante | Obrigatória para escopos sensíveis/restritos |

O MedSupAPP usa **escopos sensíveis e restritos** (Calendar, Drive, Contatos). Para SaaS com clientes pagantes, o alvo é **Production + Verification aprovada**.

---

## Escopos usados no código

| Escopo | Onde | Classificação Google |
|--------|------|----------------------|
| `openid`, `email`, `profile` | Login (`auth.ts`) | Não sensível |
| `.../auth/calendar.events` | Login + agenda | Sensível |
| `.../auth/calendar.readonly` | Conectar Calendar (incremental) | Sensível |
| `.../auth/drive.file` | Login + clientes/backup | **Restrito** (só arquivos do app) |
| `.../auth/contacts.readonly` | Conectar Contatos (opcional) | Sensível |

`drive.file` é o escopo **mínimo** de Drive — o app não pede acesso ao Drive inteiro.

---

## Passo 1 — Google Cloud Console

Projeto: o mesmo do `GOOGLE_CLIENT_ID` em produção.

### 1.1 Ativar APIs

[APIs & Services → Library](https://console.cloud.google.com/apis/library):

- **Google Calendar API**
- **Google Drive API**
- **People API** (contatos)

### 1.2 Tela de consentimento OAuth

[APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

| Campo | Valor recomendado |
|-------|-------------------|
| User type | **External** (clientes fora da sua org) |
| App name | `MedSupAPP` |
| User support email | e-mail de suporte real |
| App logo | logo do produto (pode exigir verificação — normal) |
| App domain → Homepage | `https://www.medsupapp.com.br` |
| Privacy policy | `https://www.medsupapp.com.br/privacidade` |
| Terms of service | `https://www.medsupapp.com.br/termos` |
| Authorized domains | `medsupapp.com.br` (sem `https://`) |
| Developer contact | e-mail(s) que recebem avisos do Google |

**Application home page** e política devem estar **públicas** (sem login).

### 1.3 Escopos na tela de consentimento

Em **Data access** / **Scopes**, adicione (alinhado ao código):

```
.../auth/userinfo.email
.../auth/userinfo.profile
openid
.../auth/calendar.events
.../auth/calendar.readonly
.../auth/drive.file
.../auth/contacts.readonly
```

### 1.4 Credenciais OAuth 2.0

[Credentials → OAuth 2.0 Client IDs](https://console.cloud.google.com/apis/credentials) → tipo **Web application**.

**Authorized JavaScript origins** (produção):

```
https://www.medsupapp.com.br
```

**Authorized redirect URIs** (as **duas** são obrigatórias):

```
https://www.medsupapp.com.br/api/auth/callback/google
https://www.medsupapp.com.br/api/auth/google-callback
```

| URI | Uso |
|-----|-----|
| `/api/auth/callback/google` | Login com Google (NextAuth) |
| `/api/auth/google-callback` | Conectar Drive / Calendar / Contatos no Dashboard |

Desenvolvimento local (opcional):

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/google-callback
```

Confira no servidor:

```bash
curl -sS https://www.medsupapp.com.br/api/health/auth-config
```

O JSON deve listar `googleRedirectUris` com as duas URLs acima.

### 1.5 Verificação de domínio (se o Google pedir)

1. [Google Search Console](https://search.google.com/search-console) → propriedade `https://www.medsupapp.com.br` ou domínio `medsupapp.com.br`
2. Verificar via DNS (TXT no Cloudflare/registrador) ou arquivo HTML na Vercel
3. No OAuth consent screen, associar domínio verificado

---

## Passo 2 — Vercel (produção)

| Variável | Valor |
|----------|--------|
| `AUTH_URL` | `https://www.medsupapp.com.br` |
| `NEXTAUTH_URL` | `https://www.medsupapp.com.br` |
| `GOOGLE_CLIENT_ID` | Client ID do passo 1.4 |
| `GOOGLE_CLIENT_SECRET` | Secret do mesmo client |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | segredo forte |

No Google Console, redirect de **produção** do client deve ser o **mesmo** client ID configurado na Vercel.

Após alterar env: **Redeploy** + `npm run deploy:promote`.

---

## Passo 3 — Testar antes de “Push to production”

### Modo Testing (recomendado até verificação aprovar)

1. Consent screen → **Publishing status: Testing**
2. **Test users** → adicione cada e-mail que vai testar (máx. 100)
3. Teste em aba anônima:
   - `/login` → Google
   - Dashboard → Conectar Drive, Calendar, Contatos
4. Se `redirect_uri_mismatch` → falta uma das duas URIs no passo 1.4

### Smoke checklist

- [ ] Login Google conclui e redireciona para verificação de e-mail ou dashboard
- [ ] Conectar Drive importa/salva clientes
- [ ] Conectar Calendar na agenda
- [ ] (Opcional) Conectar Contatos
- [ ] `/privacidade` e `/termos` abrem sem login

---

## Passo 4 — Enviar verificação (Verification)

Quando for abrir para **qualquer** médico/clínica:

1. Consent screen → **Prepare for verification** / **Submit for verification**
2. Preencha o formulário com os textos abaixo (ajuste se necessário)
3. **Push to production** só depois de revisar o rascunho — ou em paralelo, sabendo que usuários veem “não verificado” até aprovar

Prazo típico: **alguns dias a várias semanas** (Drive restrito pode pedir mais detalhes).

### Texto sugerido — finalidade do app (PT)

> O MedSupAPP é um SaaS de gestão para médicos e pequenas clínicas no Brasil. O profissional faz login com a própria conta Google. Usamos o Google Calendar para exibir e criar consultas na agenda do usuário. Usamos o escopo drive.file para criar e ler apenas arquivos que o aplicativo criou no Google Drive do usuário (cadastro de pacientes e backups), sem acesso ao Drive completo. O escopo contacts.readonly é opcional, apenas se o usuário clicar em importar contatos. Dados clínicos permanecem na conta Google do profissional; metadados operacionais ficam em nosso banco (Supabase). Política de privacidade: https://www.medsupapp.com.br/privacidade

### Texto sugerido — por escopo (EN, formulário Google)

**calendar.events / calendar.readonly**

> Read and create calendar events on the user's primary calendar so they can manage appointments inside MedSupAPP and sync with Google Calendar.

**drive.file**

> Create and access only files that MedSupAPP creates or opens in the user's Google Drive (patient JSON exports, backups). We do not request full Drive access.

**contacts.readonly**

> Optional: if the user explicitly taps "Connect Contacts", import phone numbers to pre-fill patient records. Read-only; never used without user action.

### Vídeo de demonstração (se pedirem)

Grave 2–5 min mostrando:

1. Login em `https://www.medsupapp.com.br/login`
2. Tela de consentimento Google (escopos visíveis)
3. Dashboard → Conectar Drive → arquivo no Drive do usuário
4. Agenda → Conectar Calendar → evento
5. Link para `/privacidade`

---

## Passo 5 — Push to production

Quando o checklist estiver ok:

1. OAuth consent screen → **Publish app** / **Push to production**
2. Confirme o aviso sobre escopos sensíveis (esperado)
3. Se ainda **não** verificado: usuários veem “Google hasn't verified this app” — limite de usuários até aprovação
4. Após **Verified**: aviso some para escopos aprovados

---

## Erros comuns

| Erro | Causa | Correção |
|------|--------|----------|
| `redirect_uri_mismatch` | URI errada ou só uma das duas cadastradas | Cadastrar **ambas** URIs (1.4) |
| `access_denied` / app em testing | E-mail não está em Test users | Adicionar e-mail ou publicar |
| `403 accessNotConfigured` People API | People API desativada | Ativar People API (1.1) |
| Login ok, Drive falha | Escopo não concedido ou token antigo | Reconectar no Dashboard; revogar app em [myaccount.google.com/permissions](https://myaccount.google.com/permissions) e login de novo |
| `invalid_client` na Vercel | Client ID/secret de outro projeto | Mesmo client em Google e Vercel |

---

## Referências no repositório

| Arquivo | Conteúdo |
|---------|----------|
| `auth.ts` | Escopos no login |
| `app/api/auth/google-authorize/route.ts` | Escopos incrementais |
| `lib/appUrl.ts` | `getGoogleOAuthRedirectUris()` |
| `app/privacidade/page.tsx` | Texto LGPD + Google |
| [SECURITY-LGPD.md](./SECURITY-LGPD.md) | Tratamento de dados |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deploy Vercel |

---

## Ordem recomendada (checklist final)

- [ ] APIs Calendar, Drive, People ativadas
- [ ] Consent screen preenchido (homepage, privacidade, termos, domínio)
- [ ] Escopos declarados = escopos do código
- [ ] **Duas** redirect URIs de produção cadastradas
- [ ] Vercel: `AUTH_URL`, Google client ID/secret corretos
- [ ] Test users OK em **Testing**
- [ ] Formulário de **Verification** enviado (textos acima + vídeo se pedido)
- [ ] **Push to production** após testes
- [ ] Aguardar e-mail “verified” do Google
