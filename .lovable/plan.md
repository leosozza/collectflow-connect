

# Plano: Corrigir erro ao salvar dados do cliente

## Causa Raiz

O `updateClientMutation` atualiza **todos** os registros do mesmo CPF com os mesmos valores, incluindo `external_id` e `cod_contrato`. Existe uma constraint `UNIQUE (external_id, tenant_id)` no banco. Como cada registro tem seu próprio `external_id`, ao tentar definir o mesmo valor para todos, o segundo update falha com erro 409 (duplicate key).

## Solução

Separar os campos em duas categorias:
- **Campos compartilhados** (atualizar em todos os registros): `nome_completo`, `phone`, `phone2`, `phone3`, `email`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `observacoes`
- **Campos individuais** (atualizar apenas no registro principal `clients[0]`): `external_id`, `cod_contrato`

## Alteração

**Arquivo**: `src/components/client-detail/ClientDetailHeader.tsx` (linhas 144-171)

```typescript
// Campos compartilhados: atualizar em todos os registros
const sharedData = {
  nome_completo, phone, phone2, phone3, email,
  endereco, bairro, cidade, uf, cep, observacoes
};

for (const id of clientIds) {
  await supabase.from("clients").update(sharedData).eq("id", id);
}

// Campos individuais: atualizar apenas no primeiro registro
await supabase.from("clients").update({
  cod_contrato, external_id
}).eq("id", clientIds[0]);
```

Também melhorar a mensagem de `onError` para mostrar o erro real ao invés de genérico.

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/ClientDetailHeader.tsx` | Separar update de campos compartilhados vs individuais |

