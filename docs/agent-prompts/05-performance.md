# Prompt: Performance

Audite performance e fluidez do MedSupAPP.

## Análise

1. `npm run build` — tamanho de rotas, client bundles
2. Componentes pesados sem `dynamic()` import
3. APIs com payloads grandes (clientes, sync agenda)
4. Imagens portfólio — lazy, formatos
5. Re-renders desnecessários em listas grandes

## Entregável

- Atualizar `docs/PERFORMANCE.md` com top 10 melhorias (impacto/esforço)
- Implementar só **quick wins P0** (ex.: um `dynamic()` óbvio)
- Sugerir Lighthouse em produção para `/dashboard`, `/agenda`, `/pro/...`

## Restrições

Sem mudanças de infra sem pedido do usuário
