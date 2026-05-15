## Diagnóstico

Sua intuição está certa. A função `get_client_consolidated_status` está **ignorando totalmente acordos com `status='pending'`** — só considera `approved`, `completed` e `cancelled`. Resultado na Y.BRASIL:

| Status agreement | Qtd acordos | Parcelas | Vencidas |
|---|---|---|---|
| pending | **530** | 2.864 | 125 |
| approved | 4 | 10 | 1 |
| completed | 102 | 112 | 0 |
| cancelled | 106 | 434 | 117 |

Os 530 acordos `pending` (com 2.864 parcelas ativas) caem no fallback de `clients` → viram `inadimplente` ou `em_dia`. Por isso só 12 `acordo_vigente`.

E você confirmou a regra de **Inadimplente**: cliente com parcela original vencida que **nunca teve acordo no Rivo**. Hoje a função pode marcar inadimplente um cliente que TEM acordo pending — está errado.

## Correção proposta

### 1. Tratar `pending` como acordo ativo na função canônica

Em `get_client_consolidated_status`, expandir o filtro para incluir `pending` e classificar igual a `approved`:

```sql
-- antes
AND a.status IN ('approved', 'completed', 'cancelled')

-- depois
AND a.status IN ('pending', 'approved', 'completed', 'cancelled')

-- e na CASE:
WHEN agreement_status IN ('pending','approved') THEN 'acordo_vigente'
```

Mantém a hierarquia: `acordo_quitado` > `acordo_atrasado` > `acordo_cancelado` > `acordo_vigente`. Parcela vencida dentro do prazo → `acordo_atrasado`. Vencida além do prazo do credor → `acordo_cancelado`. Todas pagas → `acordo_quitado`.

### 2. Garantia anti-inadimplente para quem tem acordo

Como o bloco de fallback (`clients`) só roda quando `_ag_state IS NULL`, e agora todo acordo gera estado, fica garantido: **quem teve qualquer acordo no Rivo nunca cai em `inadimplente`**. Inadimplente = só dívida original sem acordo, como você definiu.

### 3. Reprocessar todos os 465.855 clients da Y.BRASIL

Reusar `sync_clients_status_loop` (já criada) com `force_status_override=true`, em chunks de ~3k linhas até zerar.

## Validação esperada após correção

Distribuição estimada (par CPF/Credor):

| Status | Esperado |
|---|---|
| Acordo Vigente | ~530 (pending sem atraso) + 4 approved |
| Acordo em Atraso | parcelas vencidas dentro do prazo do credor |
| Acordo Cancelado | 106 cancelled + pendings com atraso > prazo |
| Acordo Quitado | ~102 completed |
| Inadimplente | só clients com parcela original vencida e SEM nenhum acordo no Rivo |
| Em Dia | clients sem vencimento ou tudo em dia, sem acordo |
| Quitado | clients todos quitados, sem acordo no Rivo |

Spot check pós-execução: 30 grupos aleatórios comparando `clients.status_cobranca_id` vs `get_client_consolidated_status` ao vivo + listar 10 inadimplentes para confirmar que nenhum tem acordo no Rivo.

## Arquivos afetados

- **Migration nova**: `CREATE OR REPLACE FUNCTION public.get_client_consolidated_status` com `pending` incluído.
- **Reprocessamento**: chamadas `sync_clients_status_loop` (sem código novo).
- Edge `auto-status-sync`: nenhum ajuste — já delega 100% para a RPC.

Pronto para autorizar.