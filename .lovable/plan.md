## Resultado da execução

Disparei o `auto-status-sync` em modo cron (todos os tenants ativos). A base do **Y.BRASIL (465.855 clientes)** terminou de ser reprocessada usando os novos 7 status oficiais.

### Distribuição final em `clients.status_cobranca_id`

| Status | Qtd |
|---|---|
| Inadimplente | 186.585 |
| Quitado | 147.205 |
| Em Dia | 127.589 |
| Acordo Vigente | 4.124 |
| Acordo Cancelado | 277 |
| (sem status) | 75 |
| **Acordo em Atraso** | **0** ⚠️ |
| **Acordo Quitado** | **0** ⚠️ |

### `tipos_status` confirmado ✅

Os 7 oficiais existem em todos os tenants ativos com os `papel_sistema` corretos:
`quitado`, `em_dia`, `inadimplente`, `acordo_vigente`, `acordo_atrasado`, `acordo_cancelado`, `acordo_quitado`.

### Comparação SSOT vs auto-sync (amostra 500 grupos)

Rodando `get_client_consolidated_status(...)` direto na amostra:
- Quitado 401 · Inadimplente 95 · Em Dia 2 · **Acordo Quitado 2**

A SSOT (RPC) **gera** Acordo Quitado corretamente. Mas a base gravada não tem nenhum, porque o `auto-status-sync` tem lógica JS própria — duplicada e desatualizada — que **nunca** atribui `Acordo Quitado` nem `Acordo em Atraso`:

- `Acordo em Atraso` só dispara se `agreements.status='overdue'`, e a base usa `pending`/`approved`/`completed`/`cancelled` — não existe linha `overdue`.
- `Acordo Quitado` é resolvido como ID mas **nunca é setado** em ramo algum do código. Acordos `completed` caem para Quitado/Em Dia/Inadimplente conforme parcelas em `clients`.

Resultado: a primeira parte da migração (Cofre/SSOT) funciona, mas **o sincronizador não reflete o Cofre**. Há divergência entre a verdade calculada pela RPC e o que persistimos em `clients`.

---

## Plano de correção (parte 2)

Trocar a lógica JS do `auto-status-sync` pela invocação direta da SSOT, eliminando a duplicação.

### 1. Refatorar `supabase/functions/auto-status-sync/index.ts`

Substituir o bloco `processGroup(...)` por uma chamada à RPC canônica:

```ts
const { data: canonical } = await supabase.rpc('get_client_consolidated_status', {
  _tenant_id: tenant_id,
  _cpf: clients[0].cpf,
  _credor: clients[0].credor,
  _atraso_quebra_dias: null   // RPC busca prazo do credor sozinha
});
const legacy = await supabase.rpc('map_canonical_to_legacy_status', { _canonical: canonical });
const targetStatusId = statusByName.get(legacy);
```

Mantém a paginação por `(cpf, credor)` e o flush em lotes de 200, mas remove ~150 linhas de regras paralelas (hasOverdueAgreement, etc.).

### 2. Resolver os 75 clientes com status NULL

Após o refator, rodar uma vez novamente para varrer os 75 órfãos.

### 3. Validação pós-execução

Conferir que `Acordo em Atraso` e `Acordo Quitado` agora apresentam valores > 0 coerentes com `agreement_installments` vencidos / acordos com todas as parcelas pagas.

### 4. (Opcional, recomendado) Trigger de manutenção em tempo real

Criar trigger em `agreements` e `agreement_installments` que chama `get_client_consolidated_status` + atualiza `clients.status_cobranca_id` do grupo afetado, com `SET LOCAL app.force_status_override='true'` quando vier de QUITADO. Garante que o Cofre fica sempre em sincronia sem depender do cron noturno.

---

Posso prosseguir com os passos 1–3 (refator + reexecução + validação)? O passo 4 fica para outro round se você quiser.