# Compatibilidade de navegadores (Safari / macOS / iOS)

## Navegadores suportados

| Navegador | Versão |
|-----------|--------|
| Safari (macOS / iOS) | Últimas 2 versões principais |
| Chrome / Edge | Últimas 2 versões |
| Firefox | Últimas 2 versões |

## Problemas conhecidos corrigidos no código

### 1. Landing — animação do título

A animação **Medical Super Application → MedSupAPP** usa elementos `position: absolute` que, no Safari, podiam **cobrir os botões** do hero sem ser visíveis.

**Correção:** `pointer-events: none` e `overflow: hidden` em `.brand-title-animation`.

### 2. Botões com `disabled` (login / verificar e-mail)

No Safari, botões `disabled` parecem “mortos” — o usuário clica e nada acontece (sem mensagem).

**Correção:** classe `.btn-action` — botão permanece clicável; validação mostra texto de ajuda (código incompleto, aceite legal, etc.).

### 3. Dashboard — menu lateral fixo

`aside` com `transform: translateX(-100%)` ainda interceptava cliques na área esquerda em alguns WebKit.

**Correção:** `pointer-events-none` quando o menu está fechado (mobile).

### 4. Checkbox + links (Política / Termos)

`Link` dentro de `<label>` no Safari pode alternar o checkbox em vez de abrir o link.

**Correção:** `id` / `htmlFor` no checkbox e `stopPropagation` nos links.

### 5. Inputs no iOS

Fonte mínima **16px** em inputs mobile (evita zoom ao focar) — ver `globals.css` `@media (max-width: 767px)`.

## Checklist para Luyddy (Mac)

1. **Safari** — atualizar macOS/Safari; testar também em Chrome.
2. **Verificar e-mail** — marcar **Política + Termos**; código com **6 dígitos**; botão mostra dica se faltar algo.
3. **Login** — mesmo aceite legal; se clicar sem marcar, aparece aviso amarelo.
4. Limpar cache: Safari → Configurações → Privacidade → Gerenciar dados do site → `medsupapp.com.br`.

## Teste rápido

- `/` — botões “Começar com Google” e “Ver preços” clicáveis
- `/login` — perfis Médico/Clínica respondem ao clique (com ou sem checkbox)
- `/auth/verificar-email` — Confirmar e Reenviar respondem
