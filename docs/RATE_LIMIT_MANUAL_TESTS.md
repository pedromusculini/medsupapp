# Testes manuais — rate limit (Supabase)

Migração obrigatória em cada ambiente:

```bash
npm run db:rate-limits
```

Tabela `rate_limits` + RPCs `check_rate_limit` / `reset_rate_limit`.

## 1. Verificar migração

```bash
curl -s https://www.medsupapp.com.br/api/health/auth-config | jq '.checks'
```

Confirme que `rateLimitsHint` aparece (documentação) e que não há erros 500 nas rotas abaixo.

No Supabase SQL Editor:

```sql
SELECT * FROM rate_limits ORDER BY updated_at DESC LIMIT 10;
```

## 2. `POST /api/auth/google-access/send-code`

1. Login Google (e-mail ainda não verificado).
2. Disparar **6×** “Enviar código” em menos de 15 min.
3. **Esperado:** 6ª requisição → `429` com mensagem “Aguarde …s”.
4. Em `rate_limits`, bucket `send-code:{email}` com `count >= 5`.

## 3. `POST /api/prontuario-acesso/verificar-pin`

1. Clínica com PIN configurado → Clientes → abrir prontuário (pede PIN).
2. Errar o PIN **8×** seguidas.
3. **Esperado:** 8ª tentativa → `429`.
4. Acertar o PIN → `200` e bucket `prontuario-pin:{email}` removido (`reset_rate_limit`).

## 3b. `PUT /api/prontuario-acesso/recuperar-pin` (reset PIN)

1. Solicitar código de recuperação **6×** em 15 min.
2. **Esperado:** 6ª → `429`, bucket `prontuario-reset-email:{email}`.

## 4. `/api/prontuario/[token]/*` (se `PRONTUARIO_TOKEN_ENABLED=true`)

Com flag ligada (só dev):

```bash
TOKEN="<uuid do medico_prontuario_acesso>"
for i in $(seq 1 125); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3000/api/prontuario/$TOKEN/pacientes?q=ab"
done
```

**Esperado:** após ~120 req/min por IP → `429` com `code: RATE_LIMITED`.

Com flag desligada (prod padrão): respostas `410` após rate limit (bucket ainda incrementa).

## 5. Réplicas compartilhadas

1. Aplicar migração em staging/prod.
2. Disparar send-code de **duas** abas/dispositivos no mesmo e-mail alternando.
3. **Esperado:** limite global 5/15 min (não 5 por instância serverless).

## 6. Fallback in-memory (só sem migração)

1. Ambiente local **sem** `npm run db:rate-limits`.
2. Send-code ainda funciona (warning no log: `store indisponível`).
3. Após migrar, mesmo teste deve persistir contador no Supabase entre restarts.

## Limpeza após testes

```sql
DELETE FROM rate_limits WHERE bucket_key LIKE 'send-code:%';
DELETE FROM rate_limits WHERE bucket_key LIKE 'prontuario-pin:%';
```
