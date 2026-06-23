# Prompt: Correções MedSupAPP (portar do Turquesa Agenda)

Use este prompt no repositório **MedSupAPP** (`medsupapp.com.br`) para aplicar as correções e features já validadas no Turquesa Agenda. Manter terminologia médica (paciente, médico, consulta, clínica) e domínio `medsupapp.com.br`.

---

## Contexto

O Turquesa Agenda é um clone vertical do MedSupAPP (salão de beleza). Várias correções foram feitas no Turquesa e precisam ser portadas de volta ao MedSup com adaptação de copy/terminologia, mantendo a lógica técnica idêntica.

**Repositório origem:** Turquesa Agenda  
**Repositório destino:** MedSupAPP — `medsupapp.com.br`  
**Idioma:** PT-BR  
**Não alterar:** webhook Asaas, fluxo Google OAuth + OTP e-mail, middleware de admin 404.

---

## 1. Agenda mobile — eventos visíveis + scroll aceitável

**Commit final Turquesa:** `7975247` (revert parcial pós-`4e62218`)

### Lição aprendida (NÃO fazer no MedSup)
- **Não remover** `contentHeight` no mobile — eventos somem no `timeGridDay`
- **Não usar** `overflow: visible` no `.fc-scroller` / `.fc-scroller-harness` — quebra posicionamento absoluto dos eventos
- **Não usar** `contentHeight={1024}` + `expandRows` — também quebrou em produção

### Config que funciona (pré-4e62218 restaurada)
- **`components/AgendaCalendar.tsx`**
  - Mobile: `initialView="timeGridDay"`, `height="auto"`, **`contentHeight={520}`**
  - Desktop: `timeGridWeek`, `height={640}`
  - Wrapper: `overflow-x-auto` + **`touch-action: manipulation`** (não `touch-pan-x` — bloqueava scroll da página)
  - Hint mobile: *"Role dentro da grade para ver todos os horários"*
  - `useMediaQuery` com init síncrono no 1º paint (evita montar week no celular)

- **`app/globals.css`** (mobile)
  - Semana: `.fc-timeGridWeek-view .fc-scrollgrid { min-width: 560px }`
  - `-webkit-overflow-scrolling: touch` no wrapper
  - **Sem** hacks de `overflow: visible`, `min-height` no timegrid-body, etc.

### Tradeoff de scroll
No celular: role **dentro** da grade (520px) para ver horários; depois role a **página** para "Nova consulta" / cards abaixo. Eventos visíveis > scroll da página perfeito.

### Copy MedSup
- "Toque em um horário vazio para agendar consulta"
- "no celular use a vista Dia"
- Badge: "X na grade" (consultas/agendamentos)

### Arquivos
- `components/AgendaCalendar.tsx`
- `components/AgendaPageClient.tsx` (sem lógica mobile extra — só passa `events`)
- `app/globals.css`

---

## 2. Middleware — convite de agenda público

**Commit Turquesa:** `0674200`

### Problema
Profissional/médico recebe link de convite para conectar Google Calendar sem ter conta MedSup. O middleware redirecionava para login/onboarding.

### Correção
- **`middleware.ts`**
  - Função `isConvitePath(pathname)`: retorna true para `/convite/*` e `/api/convite/*`
  - Incluir `/convite/` em `isPublicPath`
  - Incluir `/api/convite/` em `isUnverifiedApiPath`
  - Antes do fluxo de onboarding/Google sub: se `isConvitePath(pathname)`, retornar `NextResponse.next()` — OAuth Google apenas, sem conta MedSup

### Copy MedSup
- Página `/convite/agenda/[token]`: médico conecta agenda Google da clínica

### Arquivos
- `middleware.ts`
- `app/convite/agenda/[token]/page.tsx` (já existe no `40e5700`)
- `app/api/convite/agenda/[token]/route.ts`

---

## 3. OAuth Google por profissional/médico

**Commit Turquesa:** `40e5700`

### Feature
Cada médico da clínica pode autorizar seu próprio Google Calendar via link de convite WhatsApp, sem login MedSup. Tokens criptografados por profissional; sync unificado na agenda da clínica.

### Implementação
- **Rotas OAuth dedicadas**
  - `app/api/auth/profissional-google-authorize/route.ts` — inicia OAuth com state assinado (token do convite)
  - `app/api/auth/profissional-google-callback/route.ts` — persiste tokens criptografados em `profissional_google_calendar`
  - `app/api/auth/oauth-uris/route.ts` — incluir redirect URIs do fluxo profissional

- **API Google Calendar** (`app/api/google-calendar/route.ts`)
  - Suporte a `profissionalId` em POST/DELETE
  - Query `?allConnected=true` para sync de todas as agendas conectadas da clínica
  - Campo `_profissionalId` nos eventos retornados

- **Convite**
  - `app/api/perfil/medicos/invite-agenda/route.ts` — gera link + mensagem WhatsApp
  - `app/api/convite/agenda/[token]/route.ts` — valida token
  - `app/convite/agenda/[token]/page.tsx` — UI mínima: nome do médico, botão "Conectar Google Calendar"

- **Libs**
  - `lib/profissionalGoogleCalendar.ts` — CRUD tokens, status `connected`/`pending`/`error`
  - `lib/profissionalOAuthState.ts` — state HMAC para OAuth
  - `lib/tokenEncryption.ts` — AES-256-GCM para refresh tokens
  - `lib/loadMedicosOptions.ts` — `profissionalHasAgendaConnected`, `profissionalIdByNome`
  - `lib/whatsapp.ts` — `buildPedidoAcessoAgendaWhatsAppMessage` + `buildWhatsAppUrls` (ver §7)

- **UI clínica**
  - `components/CatalogoProfissionaisClient.tsx` — card "Agenda Google" por médico, botão convite WhatsApp
  - `components/AgendaPageClient.tsx` — sync `allConnected=true` quando clínica tem médicos conectados; resolver `profissionalId` ao criar evento

- **SQL:** `npm run db:profissional-google-calendar` (tabela `profissional_google_calendar`)

### Copy MedSup (`buildPedidoAcessoAgendaWhatsAppMessage`)
- "Olá, {nome}! {clínica} usa o MedSupAPP para organizar as consultas..."
- "Convidar médico para conectar agenda"
- "Equipe conectada" quando há médicos com agenda Google
- Status: conectado / pendente / erro
- Convite WhatsApp: `openWhatsAppUrl` com as 3 URLs (§7)

---

## 4. Vincular paciente ao editar consulta

**Commit Turquesa:** `ad87fb4`

### Problema
Ao editar consulta existente no modal da agenda, não era possível vincular/revincular o paciente ao cadastro (Drive/clientes). Campo de busca só aparecia em criação.

### Correção
- **`components/AgendaConsultaModal.tsx`**
  - Ao abrir edição: `setPacienteSel(selFromDriveId(editingEvent.clienteDriveId))`
  - Validação unificada: exige `pacienteSel` OU nome ≥ 2 chars (criação e edição)
  - `ensurePacienteCliente` também na edição, passando `cliente_id: driveId ?? editingEvent?.clienteDriveId`
  - Substituir input fixo de nome na edição por `PacienteSearchField` com label "Vincular ao cadastro"
  - Aviso âmbar se consulta sem `clienteDriveId`: "Esta consulta ainda não está vinculada ao cadastro..."

- **`components/AgendaPageClient.tsx`**
  - Passar `clienteDriveId` no payload de confirmação/sync

- **`lib/consultations.ts`** — campo `clienteDriveId` no record
- **`lib/syncConsultasClient.ts`** — incluir `cliente_drive_id` no sync
- **`app/api/consultas/sync/route.ts`** — persistir `cliente_drive_id`

### Copy MedSup
- "Vincular ao cadastro" (paciente)
- "Selecione o paciente na lista ou confirme o nome"

---

## 5. Botão WhatsApp de confirmação no modal da agenda

**Commits Turquesa:** `8d80b85` (feature) + deep link mobile (ver §7)

### Feature
No modal de criar/editar consulta, botão para enviar confirmação ou lembrete WhatsApp imediatamente (sem passar pelo Dashboard).

### Implementação
- **`app/api/consultas/mensagem-whatsapp/route.ts`** (novo)
  - POST: `{ tipo, nome, data, hora, telefone, medico, local, consultaId }`
  - Monta mensagem via templates (`confirmacao_apos_agendar`, `lembrete_1_dia`) com `renderMensagemForOwner` (inclui links curtos — ver §8)
  - Retorna `{ mensagem, whatsapp_url, whatsapp_app_url, whatsapp_android_url }` via `buildWhatsAppUrls()` (não só `wa.me`)

- **`components/AgendaConsultaModal.tsx`**
  - Seção "Mensagem WhatsApp" com botão verde
  - Picker de template (confirmação / lembrete 1 dia)
  - Habilitado quando: nome ≥ 2, data, hora, WhatsApp ≥ 10 dígitos
  - Ao editar: preencher telefone do paciente vinculado se evento não tiver `telefone` (inclui enriquecimento Google Contatos — ver §9)
  - Preview da mensagem após gerar
  - **Mobile:** `preOpened = null`; após fetch chama `openWhatsAppUrl()` (§7) — **não** usar `<a href>` nem `window.open` após await
  - **Desktop:** `preOpenExternalTab()` na gestura do clique; depois `openWhatsAppUrl(..., { preOpened })`

### Copy MedSup
- "Envie confirmação ou lembrete agora, sem esperar o Dashboard"
- Templates: confirmação pós-agendamento, lembrete 1 dia antes
- Fallback clínica: `sua clínica` (não "seu salão")

---

## 6. Safari / iOS — safe-area, viewport e modais

**Commit Turquesa:** `97cb395` (evoluído com `openWhatsAppUrl` em §7)

### Problemas Safari iOS
- `window.open` após `await` bloqueado (WhatsApp não abre)
- Popup em branco no mobile ao pré-abrir aba antes do fetch
- Modais cortados pela barra inferior (home indicator)
- Viewport sem `viewport-fit=cover` (notch/safe area)
- Página convite com chrome completo desnecessário

### Correção

#### `lib/openExternalUrl.ts` (novo / expandir)
```typescript
export function isMobileDevice(): boolean
export function preOpenExternalTab(): Window | null  // só desktop
export function navigatePreOpened(preOpened: Window | null, url: string): void
export function openWhatsAppUrl(webUrl, options?: { appUrl?, androidUrl?, preOpened? }): void
```
- **Mobile:** `openWhatsAppUrl` usa `window.location.assign` na mesma aba (sem popup)
- **Desktop:** pré-abre aba na gestura (`preOpenExternalTab`) e navega com `api.whatsapp.com`
- Ver §7 para matriz Android / iOS / desktop

#### `app/layout.tsx`
```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
```

#### `app/globals.css`
```css
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.agenda-calendar-scroll {
  -webkit-overflow-scrolling: touch;
}
```

#### Modais mobile — `max-h-[92dvh]` + safe-area
- `components/AgendaConsultaModal.tsx`
- `components/FinalizarConsultaModal.tsx`
- `components/FinalizarAtendimentoModal.tsx`
- Classes: `max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]`

#### Convite — chrome mínimo
- `components/AppShell.tsx` — adicionar `'/convite/'` em `MINIMAL_CHROME_PREFIXES` (sem nav lateral/header do app)

#### Outros usos de link externo (todos com `openWhatsAppUrl`, não `<a target="_blank">`)
- `components/CatalogoProfissionaisClient.tsx` — convite agenda médico
- `components/LembretesWhatsAppCard.tsx` — lembretes pendentes (botão, não link)

### Copy MedSup
- Sem alteração de texto; apenas comportamento Safari

---

## 7. WhatsApp — deep link mobile (Android / iOS / desktop)

**O que funcionou no Turquesa** (commits deep link mobile)

### Problema
- Links `wa.me` ou `api.whatsapp.com` no mobile Android abriam landing de download em vez do app
- `window.open` após `fetch` gerava popup em branco no Safari/Chrome mobile
- `<a href="..." target="_blank">` nos lembretes tinha o mesmo problema

### Solução — `lib/whatsapp.ts`

Expandir além de `buildWhatsAppUrl` (HTTPS):

```typescript
export type WhatsAppUrls = { web: string; app: string; android: string };

export function buildWhatsAppUrl(phone, message)      // https://api.whatsapp.com/send?...
export function buildWhatsAppAppUrl(phone, message)    // whatsapp://send?...
export function buildWhatsAppAndroidIntentUrl(...)      // intent:// com package com.whatsapp.w4b
export function buildWhatsAppUrls(phone, message)       // retorna { web, app, android }
```

**Matriz de abertura** (`openWhatsAppUrl` em `lib/openExternalUrl.ts`):

| Plataforma | URL usada | Mecanismo |
|------------|-----------|-----------|
| Android | `android` (intent `com.whatsapp.w4b`) → fallback `whatsapp://` | `window.location.assign` |
| iOS | `app` (`whatsapp://send?phone=...&text=...`) | `window.location.assign` |
| Desktop | `web` (`api.whatsapp.com`) | `preOpened` ou `window.open` nova aba |

**Android intent** — formato validado:
```
intent://send?phone=...&text=...#Intent;
  scheme=whatsapp;package=com.whatsapp.w4b;
  S.browser_fallback_url=<whatsapp:// encodeURIComponent>;
end
```
- **Não** usar `api.whatsapp.com` como destino primário no mobile — cai na página de download
- Package `com.whatsapp.w4b` = WhatsApp Business (comum em clínicas); fallback `whatsapp://` cobre app regular

### APIs que devem retornar as 3 URLs

Todas usam `buildWhatsAppUrls(telefone, mensagem)`:

- `app/api/consultas/mensagem-whatsapp/route.ts`
- `app/api/lembretes/pendentes/route.ts`
- `app/api/perfil/medicos/invite-agenda/route.ts`

Resposta JSON padrão:
```json
{
  "mensagem": "...",
  "whatsapp_url": "https://api.whatsapp.com/send?...",
  "whatsapp_app_url": "whatsapp://send?...",
  "whatsapp_android_url": "intent://send?..."
}
```

### Componentes que consomem

| Arquivo | Padrão |
|---------|--------|
| `AgendaConsultaModal.tsx` | `openWhatsAppUrl(url, { appUrl, androidUrl, preOpened })` |
| `LembretesWhatsAppCard.tsx` | `<button onClick>` + `openWhatsAppUrl` — **não** `<a href>` |
| `CatalogoProfissionaisClient.tsx` | idem convite médico |

### Testes MedSup
- [ ] Android Chrome: botão WhatsApp no modal abre app direto (sem página download)
- [ ] iPhone Safari: confirmação e lembretes abrem WhatsApp com mensagem pré-preenchida
- [ ] Desktop: abre `api.whatsapp.com` em nova aba
- [ ] Nenhum popup em branco no mobile após clicar "Enviar WhatsApp"

---

## 8. WhatsApp — formatação de mensagens e links curtos

**O que funcionou no Turquesa** (commits formatação + short links)

### Problemas resolvidos
- Mensagens longas com URLs gigantes (Maps, calendário) ilegíveis no WhatsApp
- Emoji 🗺️ (com variation selector U+FE0F) renderizava como ◇ no WhatsApp — usar **🗺** sem VS16
- Templates antigos sem `{{link_maps_curto}}` — backward compat via `enrichMensagemVarsWithShortLinks()`
- Linhas vazias quando endereço incompleto (placeholder sem valor)

### Links curtos assinados — `lib/shortLink.ts` (novo)

- Gera URLs `https://medsupapp.com.br/r/{body}.{sig}` com HMAC-SHA256 (`AUTH_SECRET` ou `NEXTAUTH_SECRET`)
- Tipos de body: `m{base64url}` (Maps), `c{token}` (calendário), `u{base64url}` (genérico)
- Maps resolve para `https://maps.google.com/?q=` (mais curto que `google.com/maps/search`)
- **`app/r/[token]/route.ts`** — GET público, redirect 302 para destino ou `/` se assinatura inválida

### Templates — `lib/mensagensWhatsapp.ts`

- Novos placeholders: `{{link_maps_curto}}`, `{{link_calendario_curto}}`
- `DEFAULT_MENSAGENS` com quebras de linha e emojis (🗺 sem variation selector):

```
Olá, {{nome}}!

Amanhã você tem consulta:
📅 {{data}} às {{hora}}
👤 com {{medico}}

📍 {{local}}
🗺 Como chegar: {{link_maps_curto}}

Adicionar à sua agenda:
{{link_calendario_curto}}

Até lá!
```

- `enrichMensagemVarsWithShortLinks(vars)` — gera curtos a partir de `link_maps` / `link_calendario` completos
- `renderMensagem()` — remove linhas com placeholders opcionais vazios; append Maps se template não tiver placeholder

### Maps URL de perfil — `lib/agendamento.ts`

```typescript
// Preferir formato curto na origem:
return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
// Não: google.com/maps/search/...
```

### UI Comunicação — `components/ComunicacaoClient.tsx` + `lib/mensagemTemplate.ts`

- Documentar variáveis `{{link_maps_curto}}` e `{{link_calendario_curto}}` na ajuda
- Botão **Restaurar padrão** aplica templates novos (com links curtos e formatação)
- `PLACEHOLDER_LABELS`: `{{clinica}}` = "Nome da clínica" (não salão); `{{nome}}` = "Nome do paciente"

### Copy MedSup (templates padrão)
- "consulta" / "atendimento" — **não** "sessão"
- "com {{medico}}" — médico da clínica
- Fallback clínica: `sua clínica`

### Arquivos
- `lib/shortLink.ts` (novo)
- `app/r/[token]/route.ts` (novo)
- `lib/mensagensWhatsapp.ts`
- `lib/mensagemTemplate.ts`
- `lib/agendamento.ts` (`googleMapsUrlFromProfile`)
- `components/ComunicacaoClient.tsx`
- `app/api/consultas/mensagem-whatsapp/route.ts`
- `app/api/lembretes/pendentes/route.ts`

### Testes MedSup
- [ ] Mensagem de confirmação exibe links curtos `/r/m...` e `/r/c...`
- [ ] Clicar link curto no WhatsApp redireciona para Maps / adicionar ao calendário
- [ ] Emoji 🗺 aparece corretamente (não ◇)
- [ ] Clínica sem endereço completo: linha Maps omitida (sem linha vazia)
- [ ] Restaurar padrão em Comunicação aplica templates com links curtos

---

## 9. Google Contatos — busca de pacientes e auto-fill WhatsApp

**O que funcionou no Turquesa** (commits Google Contacts cache + enrich)

### Problema
- People API quota 429 ao buscar pacientes em cada mount do campo de busca
- Paciente no Drive sem telefone: WhatsApp vazio mesmo existindo no Google Contatos
- Contatos Google não apareciam na busca de pacientes da agenda

### Solução

#### Cache server — `lib/googleContactsCache.ts` (novo)
- TTL **10 min** em memória por `ownerEmail`
- Backoff **60 s** após erro 429 (retorna cache stale + aviso)
- `getGoogleContactsCached(email, accessToken, { force? })`
- `invalidateGoogleContactsCache(email)` — chamado em sync manual

#### Cache client — `lib/pacientesOpcoesClient.ts` (novo)
- TTL **5 min** no browser para `/api/clientes/pacientes-opcoes`
- `fetchPacientesOpcoes({ force? })` — deduplica requests inflight
- `invalidatePacientesOpcoesClientCache()` — após sync Contatos

#### API — `app/api/clientes/pacientes-opcoes/route.ts`
- Mescla Drive + Google Contatos na mesma lista
- IDs Google com prefixo `g:` (`googleOpcaoIdFromContact`)
- `Cache-Control: private, max-age=600` (alinha com TTL server)
- Aviso amigável se quota excedida: *"Contatos Google temporariamente indisponíveis — tente em 1 minuto"*

#### Enriquecimento — `lib/pacienteOpcoesUi.ts`
- `enrichOpcoesComGoogle()` — preenche telefone de paciente Drive a partir de Contato Google com nome compatível (`nomesMatch`)
- `findTelefoneGooglePorNome()` — usado no modal da agenda quando paciente sem WhatsApp
- `telefoneFromOpcao()`, `parsePacienteSel()` (`d:` = Drive, `g:` = Google)

#### Sync — `app/api/clientes/sync-google-contacts/route.ts`
- Invalida cache server + client antes de refetch forçado

### Fluxo na agenda
1. Busca paciente mostra entradas Drive (`d:...`) e Google (`g:...`)
2. Ao selecionar paciente Drive sem telefone, sistema busca match no Google Contatos
3. Campo WhatsApp preenchido automaticamente quando encontrado

### Copy MedSup
- "paciente" (não cliente) na busca e avisos
- Aviso Drive desconectado: *"Conecte o Google Drive no Dashboard para ver pacientes cadastrados"*

### Arquivos
- `lib/googleContactsCache.ts` (novo)
- `lib/pacientesOpcoesClient.ts` (novo)
- `lib/pacienteOpcoesUi.ts`
- `app/api/clientes/pacientes-opcoes/route.ts`
- `app/api/clientes/sync-google-contacts/route.ts`
- `components/PacienteSearchField.tsx` — usar `fetchPacientesOpcoes`
- `components/AgendaConsultaModal.tsx` — auto-fill WhatsApp via `findTelefoneGooglePorNome`

### Testes MedSup
- [ ] Busca paciente lista contatos Google (prefixo `g:`) junto com Drive
- [ ] Paciente Drive sem telefone recebe WhatsApp do Google Contatos (mesmo nome)
- [ ] Segunda abertura do modal não dispara nova chamada People API (< 5 min)
- [ ] Após quota 429, lista ainda funciona com cache + aviso

---

## Ordem sugerida de aplicação no MedSup

1. **Middleware convite** — desbloqueia fluxo OAuth médico
2. **OAuth profissional** — feature completa + SQL
3. **Links curtos + templates** (§8) — `lib/shortLink.ts` + `app/r/[token]` antes das APIs de mensagem
4. **WhatsApp deep link** (§7) — `lib/whatsapp.ts` + `openWhatsAppUrl` em todos os pontos de envio
5. **Google Contatos cache** (§9) — busca paciente + auto-fill WhatsApp
6. **Vincular paciente edit** — modal edição consulta
7. **WhatsApp confirmação modal** (§5) — depende de §7 e §8
8. **Safari / safe-area** (§6) — viewport, modais, `openWhatsAppUrl`
9. **Agenda mobile** — `contentHeight={520}` + `touch-action: manipulation`; **nunca** `overflow: visible` no scroller

---

## Checklist de validação (MedSup)

### Agenda e OAuth
- [ ] `/convite/agenda/[token]` abre sem login; médico conecta Google Calendar
- [ ] Clínica vê eventos de todos os médicos conectados na agenda
- [ ] Editar consulta permite vincular paciente existente
- [ ] Agenda mobile: vista Dia mostra consultas na grade; scroll da página funciona
- [ ] Contador "X na grade" coincide com blocos visíveis no calendário

### WhatsApp
- [ ] Botão WhatsApp no modal abre app no Android (sem landing download)
- [ ] Botão WhatsApp no modal abre app no Safari iOS (mensagem pré-preenchida)
- [ ] Desktop abre `api.whatsapp.com` em nova aba
- [ ] Lembretes pendentes usam botão (não `<a>`) e abrem WhatsApp corretamente
- [ ] Convite agenda médico abre WhatsApp no mobile
- [ ] Mensagens exibem links curtos `/r/...`; redirect funciona
- [ ] Emoji 🗺 correto nas mensagens (não ◇)

### Pacientes / Contatos
- [ ] Busca paciente inclui Google Contatos (`g:`)
- [ ] Paciente Drive sem telefone recebe WhatsApp do Google Contatos

### Safari / UI
- [ ] Modais não ficam atrás da home bar no iPhone
- [ ] Nenhum popup em branco ao enviar WhatsApp no mobile

---

## Deploy MedSup

Após aplicar e `npm run build`:

```bash
git add -A
git commit -m "fix: correções portadas do Turquesa (WhatsApp deep link, links curtos, Contatos, agenda mobile)"
npm run release
```

SQL novo (OAuth profissional): `npm run db:profissional-google-calendar`

**Env:** `AUTH_SECRET` ou `NEXTAUTH_SECRET` obrigatório para assinar links curtos (`/r/...`).

---

*Gerado a partir das correções validadas no Turquesa Agenda — jun/2026.*
