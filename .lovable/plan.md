

## Problema

A seção "Vencimentos" e a tabela "Meus Clientes" no Dashboard mostram **todos** os clientes importados na carteira, sem filtrar por acordos. Os stat cards (Total Recebido, Quebra, Pendentes, Total Projetado) já filtram corretamente por `agreementCpfs`, mas a strip de vencimentos e a tabela abaixo não aplicam esse filtro.

Resultado: ao importar uma carteira, os dados aparecem imediatamente no Dashboard (na strip e tabela), mesmo sem acordo formalizado.

## Correção

**Arquivo: `src/pages/DashboardPage.tsx`**

1. Filtrar `browseClients` (linha 164-166) para incluir apenas clientes cujo CPF consta em `agreementCpfs`
2. Isso faz com que:
   - A strip "Vencimentos" mostre contagem e valor apenas de clientes com acordo ativo
   - A tabela "Meus Clientes" liste apenas clientes com acordo
   - Clientes importados sem acordo não aparecem no Dashboard

**Alteração específica:**
```typescript
// ANTES (linha 164-166):
const browseClients = useMemo(() => {
  return clients.filter((c) => c.data_vencimento === browseDateStr);
}, [clients, browseDateStr]);

// DEPOIS:
const browseClients = useMemo(() => {
  return clients.filter((c) => 
    c.data_vencimento === browseDateStr && 
    agreementCpfs.has(c.cpf.replace(/\D/g, ""))
  );
}, [clients, browseDateStr, agreementCpfs]);
```

Nenhuma outra alteração necessária — os stat cards já estão corretos.

