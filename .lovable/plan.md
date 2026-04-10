

# Atualizar `status_cobranca_id` na reconciliação de cheque devolvido

## Problema
A Edge Function `maxlist-import` define `status: "vencido"` para cheques devolvidos, mas não atualiza o `status_cobranca_id`. Como esse campo está em `PROTECTED_FIELDS`, ele nunca é sincronizado, e a interface continua mostrando "Quitado".

## Alterações em `supabase/functions/maxlist-import/index.ts`

### 1. Buscar ID do status "Vencido" no início (após linha ~87)
```typescript
const { data: statusVencido } = await supabase
  .from("tipos_status")
  .select("id")
  .eq("tenant_id", tenant_id)
  .ilike("nome", "vencido")
  .maybeSingle();
const vencidoStatusId = statusVencido?.id || null;
```

### 2. No mapeamento (~linha 274), quando `derivedStatus === "vencido"`, definir o `status_cobranca_id`
Substituir a linha 274 por lógica condicional:
```typescript
status_cobranca_id: derivedStatus === "vencido" && vencidoStatusId
  ? vencidoStatusId
  : (status_cobranca_id === "__auto__" ? null : (status_cobranca_id || null)),
```

### 3. Adicionar `status_cobranca_id` ao `SYNC_FIELDS` (linha 37-41)
Para que a comparação de campos o detecte durante reconciliação.

### 4. Criar exceção em `PROTECTED_FIELDS` (linhas 419-423)
No bloco que monta o `updatePayload`, permitir `status_cobranca_id` quando o status derivado é "vencido":
```typescript
for (const field of Object.keys(changes)) {
  if (PROTECTED_FIELDS.has(field)) {
    // Exceção: permitir status_cobranca_id quando status é vencido
    if (field === "status_cobranca_id" && rec.status === "vencido") {
      updatePayload[field] = rec[field];
    }
    continue;
  }
  updatePayload[field] = rec[field];
}
```

### 5. Incluir `status_cobranca_id` no SELECT do update mode (linhas 322-323)
Adicionar o campo na query de registros existentes para permitir comparação.

### 6. Deploy da Edge Function

## Resultado
Parcelas de cheque devolvido terão tanto `status = "vencido"` quanto `status_cobranca_id` apontando para o registro correto em `tipos_status`, fazendo a interface refletir o status real.

