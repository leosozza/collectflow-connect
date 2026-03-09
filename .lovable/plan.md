

## Correção: Status "Aguardando Acionamento" na Carteira

### Problema
A Edge Function `auto-status-sync` atualmente só processa clientes com `status = 'pendente'`. Clientes com status `em_acordo` ou `vencido` não são considerados, resultando em:
- Clientes que já possuem acordo aparecendo como "Aguardando Acionamento" em vez de "Acordo Vigente"
- Clientes com parcelas vencidas (status `vencido`) não sendo classificados

### Correção

**Arquivo:** `supabase/functions/auto-status-sync/index.ts`

1. **Buscar o ID do status "Acordo Vigente"** junto com os outros status
2. **Excluir clientes `em_acordo`** — marcar como "Acordo Vigente" automaticamente
3. **Incluir clientes `vencido`** como candidatos a "Aguardando Acionamento" (parcela vencida, sem acordo, pronto para formalização)
4. **Garantir que "Aguardando Acionamento"** = parcelas em aberto (pendente ou vencido) com vencimento ultrapassado e SEM acordo vigente

### Lógica atualizada

```text
Status "Aguardando Acionamento":
  - status IN ('pendente','vencido') 
  - data_vencimento < hoje
  - NÃO tem acordo vigente (status != 'em_acordo')

Status "Em dia":
  - status = 'pendente'
  - data_vencimento >= hoje
  - NÃO tem acordo vigente

Status "Acordo Vigente":
  - status = 'em_acordo'
  - Forçar status_cobranca_id para "Acordo Vigente"
```

### Mudanças

- **`supabase/functions/auto-status-sync/index.ts`**: Adicionar lógica para buscar `acordoVigenteId`, atualizar clientes `em_acordo` para "Acordo Vigente", e incluir filtro `.in("status", ["pendente","vencido"])` nas queries de "Aguardando Acionamento"

