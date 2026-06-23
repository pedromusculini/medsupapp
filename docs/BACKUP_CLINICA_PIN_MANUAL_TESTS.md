# Testes manuais — backup clínica + PIN (PR)

## Pré-requisitos

- Conta titular com `user_type = clinica` no Supabase (`onboarding_profiles`).
- Google Drive conectado (para upload).
- DevTools → Network aberto.

## 1. Clínica sem PIN configurado

1. Em **Meu Perfil**, garantir que **não** há PIN do prontuário definido.
2. Abrir `/backup`.
3. **Esperado (UI):** tela “Configure o PIN do prontuário” com link para `/dashboard/perfil` — sem botões de exportar.
4. Via API (sessão da clínica):

```bash
curl -s -X POST http://localhost:3000/api/backup/dados \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"sections":["consultas_agenda"]}'
```

**Esperado:** `403` + `code: PRONTUARIO_PIN_NOT_CONFIGURED`.

5. Tentar upload Drive (`action: backup-csv`) no `/api/google-drive` com o mesmo cookie.

**Esperado:** `403` + `PRONTUARIO_PIN_NOT_CONFIGURED`.

## 2. Clínica com PIN, sem desbloquear

1. Configurar PIN em Perfil.
2. Abrir `/backup` (sem informar PIN na sessão).
3. **Esperado (UI):** tela pedindo PIN; export bloqueado.
4. `POST /api/backup/dados` com seção **não sensível** (ex.: `financeiro_transacoes`).

**Esperado:** `403` + `code: PRONTUARIO_LOCKED` (clínica exige PIN para **qualquer** seção).

## 3. Clínica com PIN desbloqueado

1. Informar PIN na tela de backup (ou em Clientes).
2. Exportar CSV local só com `consultas_agenda`.
3. **Esperado:** download OK.
4. `POST /api/backup/dados` com `financeiro_transacoes` → `200`.
5. Enviar backup ao Google Drive → `200`.

## 4. Modo recepção

1. Ativar modo recepção em Perfil.
2. Abrir `/backup`.
3. **Esperado (UI):** mensagem “Backup indisponível”.
4. `POST /api/backup/dados` → `403` + `MODO_RECEPCAO`.

## 5. Conta médico (não clínica)

1. Login como `user_type = medico`.
2. Exportar seções **não sensíveis** sem PIN → **OK** (comportamento anterior).
3. Incluir seção sensível (`prontuario_entradas`) sem PIN → `403` `PRONTUARIO_LOCKED`.

## 6. GET catálogo autenticado

```bash
curl -s http://localhost:3000/api/backup/dados
```

Sem cookie → `401`. Com cookie titular → `200` + lista de seções.
