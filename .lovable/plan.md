

## Plano: Adicionar filtro "Em dia" na Carteira

### Contexto
Clientes importados que ainda estão em dia com seus débitos (nenhuma parcela vencida) precisam ser identificáveis. Hoje eles recebem "Aguardando acionamento" mas deveriam ter um status visual "Em dia".

### Alterações

**1. `src/components/clients/ClientFilters.tsx` — Adicionar checkbox "Em dia"**
- Adicionar `emDia: boolean` à interface `Filters`
- Adicionar checkbox "Em dia" ao lado do checkbox "Sem contato" (linha ~222)

**2. `src/pages/CarteiraPage.tsx` — Estado do filtro + lógica de filtragem**
- Adicionar `emDia: false` ao estado inicial dos filtros (linha 56-72)
- No `displayClients` (useMemo, ~linha 183): quando `filters.emDia` estiver ativo, filtrar apenas clientes cujas **todas** as parcelas do grupo (mesmo CPF+credor) têm `data_vencimento >= hoje` e status !== "pago" e não possuem acordo vigente
- Na tabela, exibir badge "Em dia" na coluna de Status Cobrança quando o cliente atende a essa condição (todas as parcelas com vencimento futuro, sem acordo)

**3. Lógica "Em dia"**
```text
Um cliente está "Em dia" quando:
  - Todas as suas parcelas têm data_vencimento >= hoje
  - Nenhuma parcela tem status "pago" ou "quebrado"  
  - Não possui acordo vigente (CPF não está em agreementCpfs)
```

O filtro é client-side, sem necessidade de alteração no banco.

### Arquivos alterados
- `src/components/clients/ClientFilters.tsx`
- `src/pages/CarteiraPage.tsx`

