

## Adicionar campo "ModelName" ao enriquecimento de endereco

### Problema
O endpoint `model-details` no proxy MaxSystem filtra os campos retornados e nao inclui o nome do modelo (`ModelName`). Esse campo precisa ser retornado e salvo junto com os dados de endereco do cliente.

### Mudancas

**1. Edge Function `supabase/functions/maxsystem-proxy/index.ts`**
- No endpoint `model-details` (linha 150), adicionar `ModelName: details.ModelName || null` ao JSON de resposta

**2. Servico `src/services/addressEnrichmentService.ts`**
- Adicionar `model_name: string | null` na interface `AddressData`
- Capturar `raw.ModelName` no retorno de `fetchAddressForContract`
- Incluir `model_name` no `emptyAddress()`
- No update do banco, incluir campo `observacoes` com o ModelName (ou um campo dedicado se existir na tabela `clients`)

**3. Verificar tabela `clients`**
- Checar se existe um campo para armazenar o nome do modelo
- Se nao existir, criar uma migration adicionando coluna ou usar o campo `observacoes` existente

### Detalhes tecnicos

| Arquivo | Acao |
|---|---|
| `supabase/functions/maxsystem-proxy/index.ts` | Adicionar `ModelName` no retorno do endpoint `model-details` |
| `src/services/addressEnrichmentService.ts` | Capturar e persistir `ModelName` junto ao endereco |
| Migration (se necessario) | Adicionar coluna na tabela `clients` para o campo modelo |
