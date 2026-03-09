

## Correção: Clientes "Pago" aparecendo em "Aguardando Acionamento"

### Causa Raiz

1. **A Edge Function `auto-status-sync` nunca é chamada automaticamente.** Nenhum lugar no frontend a invoca. Portanto, o `status_cobranca_id` dos clientes fica desatualizado — um cliente pode ser marcado como `pago` mas seu `status_cobranca_id` continua apontando para "Aguardando acionamento".

2. **O filtro de status de carteira no frontend** (linha 114 do `clientService.ts`) filtra por `status_cobranca_id` no banco, mas não considera o `status` real do registro. Resultado: clientes `pago` com `status_cobranca_id` desatualizado aparecem no filtro errado.

### Correção em 2 frentes

**1. Frontend — Derivação de status em tempo real (`CarteiraPage.tsx`)**

No `displayClients` (useMemo), após carregar os dados, aplicar a lógica de status de cobrança derivada antes do filtro:
- `status === 'pago'` → forçar `status_cobranca_id` para o ID de "Quitado"
- `status === 'em_acordo'` → forçar para "Acordo Vigente"
- `status === 'quebrado'` → forçar para "Quebra de Acordo"
- `status IN ('pendente','vencido')` com `data_vencimento < hoje` → "Aguardando acionamento"
- `status === 'pendente'` com `data_vencimento >= hoje` → "Em dia"

Isso garante que o filtro por `statusCobrancaId` funcione corretamente mesmo com dados desatualizados no banco.

**2. Frontend — Chamar `auto-status-sync` no carregamento da página (`CarteiraPage.tsx`)**

Adicionar chamada `supabase.functions.invoke("auto-status-sync")` uma vez ao entrar na página para sincronizar os dados no banco. Isso corrige os dados para todas as views (Kanban, exportações, etc.).

### Arquivos
- `src/pages/CarteiraPage.tsx` — derivação de status antes do filtro + chamada da edge function no mount

