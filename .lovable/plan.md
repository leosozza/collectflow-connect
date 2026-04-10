

# Diagnóstico: Por que a atualização não funciona

## Problemas encontrados

### 1. CRÍTICO — Coluna `meio_pagamento_id` não existe
A Edge Function inclui o campo `meio_pagamento_id` no payload de INSERT/UPDATE, mas **essa coluna não existe na tabela `clients`**. Isso causa o erro:
```
Could not find the 'meio_pagamento_id' column of 'clients' in the schema cache
```
**Consequência: TODAS as operações de escrita falham.** Por isso o resultado mostra "0 inseridos, 0 atualizados" — os dados são processados corretamente mas nunca salvos.

### 2. `CheckReturnDateQuery` está `null` para a Leidiane
Os logs confirmam que a API MaxSystem retorna `CheckReturnDateQuery: null` para todas as 36 parcelas da Leidiane (CPF 974.951.151-49). Isso pode significar que:
- O filtro OData atual não inclui a condição que traz dados de devolução
- A devolução da Leidiane é de outra "agência" ou registro diferente

O exemplo que você mostrou (com data de devolução preenchida) é de outro CPF (989.940.181-15).

## Alterações necessárias

### 1. Migration: Criar coluna `meio_pagamento_id`
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS meio_pagamento_id UUID REFERENCES meios_pagamento(id);
```
(Ou, se a tabela `meios_pagamento` não existir, apenas `UUID` sem foreign key.)

**Alternativa**: Se `meio_pagamento_id` não é necessário, remover o campo do mapeamento na Edge Function — opção mais segura.

### 2. Edge Function: Remover `meio_pagamento_id` do payload se a coluna não existir
Na Edge Function, antes de inserir/atualizar, remover campos que não existem no schema:
```typescript
// Antes de insert/update, remover campos inexistentes
delete rec.meio_pagamento_id;
```

### 3. Investigar filtro OData para cheque devolvido
Adicionar log do filtro usado e verificar se precisa adicionar condição `CheckReturnDateQuery` no filtro para trazer esses dados.

## Recomendação

A solução mais rápida é **remover `meio_pagamento_id` do mapped object** na Edge Function (linhas 262-295), já que essa coluna não existe. Isso desbloqueará todas as operações de escrita imediatamente.

Quanto à Leidiane especificamente, os dados de devolução precisam vir da API — se a API não retorna `CheckReturnDateQuery` para ela, o sistema não tem como preencher. Pode ser necessário ajustar o filtro OData ou verificar na interface do MaxSystem se essa informação existe para o contrato 766696.

