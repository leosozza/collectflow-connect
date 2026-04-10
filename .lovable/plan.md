

# Adicionar campo `data_devolucao` e garantir reconciliação completa

## Resumo

Adicionar a coluna `data_devolucao` na tabela `clients`, capturar o campo `CheckReturnDateQuery` da API MaxList, e usar a presença dessa data como regra definitiva para forçar status "vencido" + `status_cobranca_id` correto.

## Alterações

### 1. Migration SQL
Adicionar coluna `data_devolucao` (tipo DATE, nullable) na tabela `clients`:
```sql
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_devolucao date;
CREATE INDEX IF NOT EXISTS idx_clients_data_devolucao ON public.clients(tenant_id, data_devolucao) WHERE data_devolucao IS NOT NULL;
```

### 2. Edge Function `maxlist-import/index.ts`

- **SYNC_FIELDS**: adicionar `"data_devolucao"` à lista (linha 38)
- **Mapeamento** (após linha 282): adicionar ao objeto `mapped`:
  ```typescript
  data_devolucao: rawReturnDate ? String(rawReturnDate).split("T")[0] : null,
  ```
- **Regra de status** (linhas 243-253): simplificar — se `rawReturnDate` existir (independente do tipo de pagamento cheque), forçar `derivedStatus = "vencido"`. Manter a lógica de cheque como está se preferir manter restrita a tipos 2/6.
- **SELECT no update mode** (linha 334): adicionar `data_devolucao` à query de registros existentes
- **PROTECTED_FIELDS exceção** (linhas 432-437): adicionar exceção análoga para `data_devolucao` quando status é "vencido" (ou simplesmente não incluir `data_devolucao` em PROTECTED_FIELDS — ele já não está lá, então basta estar em SYNC_FIELDS)

### 3. Interface — `ClientDetailHeader.tsx`

Na seção "Datas" (linha 468-471), adicionar:
```tsx
<InfoItem 
  label="Data Devolução" 
  value={client.data_devolucao ? formatDate(client.data_devolucao) : null} 
/>
```

### 4. Deploy da Edge Function

## Resultado

- `data_devolucao` será preenchido automaticamente na importação/reconciliação
- Cheques devolvidos terão `status = "vencido"`, `status_cobranca_id` correto, e `data_devolucao` visível
- Parcelas sem devolução continuam com a lógica normal (pago/pendente)

