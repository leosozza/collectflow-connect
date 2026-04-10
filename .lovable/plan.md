

# Corrigir reconciliação de cheque devolvido — status_cobranca_id nunca atualizado

## Diagnóstico

Investigação completa revelou:

1. **`vencidoStatusId: null`** — A Edge Function busca `ilike("nome", "vencido")` na tabela `tipos_status`, mas esse tenant não tem status "Vencido". O status correto é **"Inadimplente"** (id `35679541-...`). Resultado: `status_cobranca_id` do registro mapeado fica `null`, e como o existente no banco é "Quitado" (`ee5a1d2e-...`), a mudança é detectada MAS o valor aplicado é `null` em vez do ID de "Inadimplente".

2. **Query fallback incompleta** — Linhas 363-366: o SELECT do fallback não inclui `status_cobranca_id` nem `data_devolucao`, impedindo comparação precisa para esses campos.

3. **Banco atual da Leidiane**: Todas as 36 parcelas com `status = "pago"`, `status_cobranca_id = Quitado`, `data_devolucao = null`. Zero mudanças aplicadas.

## Alterações na Edge Function `maxlist-import/index.ts`

### 1. Buscar "Inadimplente" como fallback (linhas 89-96)

Alterar a query para buscar primeiro "Vencido", e se não encontrar, buscar "Inadimplente":

```typescript
// Fetch status ID: try "Vencido" first, fallback to "Inadimplente"
let vencidoStatusId: string | null = null;
const { data: statusVencido } = await supabase
  .from("tipos_status").select("id")
  .eq("tenant_id", tenant_id).ilike("nome", "vencido").maybeSingle();
if (statusVencido?.id) {
  vencidoStatusId = statusVencido.id;
} else {
  const { data: statusInadimplente } = await supabase
    .from("tipos_status").select("id")
    .eq("tenant_id", tenant_id).ilike("nome", "inadimplente").maybeSingle();
  vencidoStatusId = statusInadimplente?.id || null;
}
```

### 2. Adicionar campos na query fallback (linha 365)

Adicionar `status_cobranca_id, data_devolucao` no SELECT da query de fallback para comparação precisa.

### 3. Log adicional para debug

Adicionar log do `CheckReturnDateQuery` para cada parcela processada (não só o sample), para confirmar quais parcelas têm data de devolução preenchida.

### 4. Deploy da Edge Function

## Resultado Esperado

- `vencidoStatusId` será `35679541-8088-40b1-8aa9-c75a7dd055e7` (Inadimplente)
- Parcelas com `CheckReturnDateQuery` preenchido terão: `status = "vencido"`, `status_cobranca_id = Inadimplente`, `data_devolucao` preenchido
- O `auto-status-sync` então recalculará o status geral do cliente de "Quitado" para "Inadimplente"
- Na interface, o badge mostrará "Cheque Devolvido" em vermelho

