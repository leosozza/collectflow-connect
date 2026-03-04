

## Plano: Corrigir filtro "Vigentes" e status de parcela vencida

### Problema 1 — Flavia aparece em "Pagos" e "Vigentes"
O filtro "Vigentes" inclui `pending` **e** `approved`. Como `approved` = "Pago", clientes pagos aparecem nos dois filtros. Correcao: "Vigentes" deve filtrar apenas `pending`.

### Problema 2 — Parcela vencida mostra "Quebrado" em vez de "Vencida"
O enum `client_status` no banco possui apenas: `pendente`, `pago`, `quebrado`. Nao existe `vencido`. Precisamos adicionar o valor `vencido` ao enum e derivar o status na UI para parcelas com vencimento ultrapassado.

### Alteracoes

#### 1. `src/pages/AcordosPage.tsx` — Filtro "Vigentes"
- Mudar filtro "vigentes" de `pending || approved` para apenas `pending`
- Assim "Pagos" mostra apenas `approved` e "Vigentes" mostra apenas `pending`

#### 2. Migration — Adicionar `vencido` ao enum `client_status`
```sql
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'vencido';
```

#### 3. `supabase/functions/auto-expire-agreements/index.ts` — Marcar parcelas vencidas
- Alem de expirar acordos, atualizar parcelas (clients) com `status = 'pendente'` e `data_vencimento < hoje` para `status = 'vencido'`

#### 4. `src/components/acordos/AgreementsList.tsx` e UI geral
- Onde exibir status do cliente, tratar `vencido` com label "Vencida" e cor amber

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/AcordosPage.tsx` | Filtro vigentes = apenas `pending` |
| Migration SQL | Adicionar `vencido` ao enum client_status |
| `supabase/functions/auto-expire-agreements/index.ts` | Marcar clientes pendentes vencidos como `vencido` |

