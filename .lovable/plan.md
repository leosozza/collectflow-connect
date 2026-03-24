

# Plano: Eliminar mapeamento manual + zerar tabulacoes do tenant Y.BRASIL

## Parte 1 — Zerar tabulacoes existentes do tenant Y.BRASIL

O tenant Y.BRASIL (`39a450f8-7a40-46e5-8bc7-708da5043ec7`) possui 12 tabulacoes, sendo 5 defaults originais (voicemail, interrupted, no_answer, cpc, wrong_contact) e 7 customizadas. A maioria nao tem `threecplus_qualification_id` — apenas 3 foram sincronizadas.

**Acao**: Deletar todas as 12 tabulacoes do tenant via operacao de dados (DELETE), permitindo que o usuario crie as novas do zero com a nomenclatura correta e o sync automatico funcione limpo.

```sql
DELETE FROM call_disposition_types WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7';
```

Tambem limpar o `threecplus_disposition_map` do settings do tenant (se existir), ja que o novo fluxo nao usa mais esse campo.

## Parte 2 — Eliminar mapeamento manual (plano ja aprovado)

### 1. ThreeCPlusTab.tsx — Remover dropdowns de mapeamento

Substituir a secao de mapeamento manual por uma tabela readonly de status de sync:

| Tabulacao RIVO | ID 3CPlus | Status |
|---|---|---|
| CPC | 12345 | Sincronizado |
| Nova Tab | — | Pendente sync |

### 2. dispositionService.ts — Remover `threecplus_disposition_map` do settings

No `syncDispositionsTo3CPlus`, parar de salvar `threecplus_disposition_map` no JSON do tenant. Manter apenas a persistencia em `call_disposition_types.threecplus_qualification_id`.

### 3. DispositionPanel.tsx — Confirmar fonte unica

Garantir que `qualifyOn3CPlus` busca `threecplus_qualification_id` direto da tabela DB, sem fallback para o settings map.

## Arquivos e acoes

| Tipo | Alvo | Mudanca |
|---|---|---|
| **Dados** | Tabela `call_disposition_types` | DELETE todas as rows do tenant Y.BRASIL |
| **Dados** | Tabela `tenants` (settings) | Remover `threecplus_disposition_map` e `threecplus_qualification_list_id` do JSON settings |
| **Codigo** | `src/components/integracao/ThreeCPlusTab.tsx` | Remover secao de mapeamento manual; substituir por tabela readonly de status de sync |
| **Codigo** | `src/services/dispositionService.ts` | Remover persistencia de `threecplus_disposition_map` no settings |
| **Codigo** | `src/components/atendimento/DispositionPanel.tsx` | Confirmar que usa `threecplus_qualification_id` da tabela |

## Resultado

1. Tenant Y.BRASIL comeca do zero — cria tabulacoes novas no RIVO, sincroniza com 1 clique
2. Sem mapeamento manual — o sync ja persiste o ID automaticamente
3. Uma unica fonte de verdade: coluna `threecplus_qualification_id` na tabela DB

