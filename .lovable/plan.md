

## Plano: Remover model_name e aplicar mapeamento de campos personalizados

### Problema 1: `model_name` ainda aparece no perfil do cliente
O campo "Nome do Modelo" continua sendo exibido em dois lugares no `ClientDetailHeader.tsx`:
- Linha 191-195: No cabeçalho ao lado do CPF
- Linha 221: Na seção colapsável "Mais informações"

**Correção**: Remover ambas as referências.

### Problema 2: Mapeamento de campos personalizados não é aplicado
O `MaxListMappingDialog` permite mapear campos de origem para campos personalizados (ex: `DADOS_ADICIONAIS` → `custom:nome_do_modelo`), mas o código de upsert em `handleMappingConfirmed` **ignora completamente o mapeamento recebido** (`_mapping`). Os registros são montados diretamente dos campos fixos do `MappedRecord`, sem processar campos `custom:*`.

**Correção**: No `handleMappingConfirmed`, após montar os records, iterar o `_mapping` para identificar campos mapeados para `custom:*`, extrair os valores do registro de origem e incluí-los no `custom_data` JSONB do upsert.

```text
Para cada registro:
  1. Verificar quais chaves do mapping começam com "custom:"
  2. Para cada uma, pegar o valor do campo de origem no MappedRecord
  3. Montar o objeto custom_data com { field_key: valor }
  4. Incluir custom_data no row de upsert
```

### Arquivos a editar

| Arquivo | Alteração |
|---|---|
| `src/components/client-detail/ClientDetailHeader.tsx` | Remover linhas 191-195 (model_name no header) e linha 221 (model_name na seção colapsável) |
| `src/pages/MaxListPage.tsx` | Usar `_mapping` para popular `custom_data` no upsert com campos `custom:*` |

