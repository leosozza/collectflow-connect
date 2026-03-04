

## Plano: Corrigir métricas do Dashboard — títulos `em_acordo` e `quebrado` ainda contabilizados

### Diagnóstico

Dados da Flavia Josefa Gomes (CPF 07410345497):
- **Acordo aprovado**: 6x R$172,43 — primeiro vencimento 06/04/2026
- **Títulos originais**: 12 parcelas de R$118,10 + 1 de R$119,00 + 1 de R$500,00

**Problema 1**: O título de 01/03/2026 (R$119,00) ficou com status `quebrado`, não foi convertido para `em_acordo` pela migration anterior (que só atualizou `pendente`/`vencido`).

**Problema 2**: O `filteredClients` no Dashboard inclui TODOS os títulos cujo CPF tenha acordo — inclusive os com status `em_acordo` e `quebrado`. O `totalProjetado` (linha 202) soma tudo isso, gerando os R$1.800.

**Problema 3**: O `browseClients` (visão por dia) também mostra títulos `em_acordo`/`quebrado` que já foram substituídos pelo acordo.

### Correções

#### 1. Migration — Atualizar título quebrado da Flavia para `em_acordo`
```sql
UPDATE clients SET status = 'em_acordo' 
WHERE cpf = '07410345497' AND credor = 'YBRASIL' AND status = 'quebrado';
```
Também atualizar a lógica do `createAgreement` para incluir `quebrado` na lista de status convertidos.

#### 2. `src/services/agreementService.ts` — Incluir `quebrado` na conversão
Ao criar acordo, converter também títulos `quebrado` (não só `pendente`/`vencido`):
```typescript
.in("status", ["pendente", "vencido", "quebrado"])
```

#### 3. `src/pages/DashboardPage.tsx` — Excluir `em_acordo` dos cálculos
- `filteredClients`: filtrar fora títulos com status `em_acordo` (já representados pelo acordo)
- `browseClients`: idem
- `totalProjetado`: já corrige automaticamente ao excluir `em_acordo` de `filteredClients`

### Arquivos

| Arquivo | Alteração |
|---|---|
| Migration SQL | Corrigir título quebrado → em_acordo |
| `src/services/agreementService.ts` | Incluir `quebrado` nos status convertidos |
| `src/pages/DashboardPage.tsx` | Excluir `em_acordo` de filteredClients e browseClients |

