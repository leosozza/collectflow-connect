

# Plano: Corrigir erro no cadastro de cliente + Status adequado para dívida externa

## Resultado do teste

- **CEP auto-fill**: Funcionando corretamente (preencheu Praça da Sé, Sé, São Paulo, SP)
- **Layout do formulário**: OK, com scroll funcionando
- **Erro ao salvar**: Persiste

## Causa raiz do erro de salvamento

A tabela `clients` tem uma política RLS de INSERT que exige `tenant_id = get_my_tenant_id()`. Porém:
1. O campo `tenant_id` **não tem valor default** no banco
2. Não existe trigger para auto-preenchê-lo
3. A função `createClient` **nunca inclui `tenant_id`** nos registros gerados por `generateInstallments`

Resultado: o insert envia `tenant_id = null`, a RLS rejeita, e o erro aparece como `[object Object]` porque o logger não sabe stringify erros do banco.

## Correções

### 1. `src/services/clientService.ts` — Incluir `tenant_id` no insert

Na função `createClient`, após gerar os registros via `generateInstallments`, adicionar o `tenant_id` do operador logado. Como o serviço não recebe o tenant_id, vou buscá-lo via `get_my_tenant_id()` ou passá-lo como parâmetro.

Abordagem mais simples: buscar o `tenant_id` do profile do operador antes do insert e adicioná-lo a cada record.

```typescript
// Buscar tenant_id do operador
const { data: profileData } = await supabase
  .from("profiles")
  .select("tenant_id")
  .eq("id", operatorId)
  .single();

const records = generateInstallments({...}).map(r => ({
  ...r,
  tenant_id: profileData?.tenant_id
}));
```

### 2. `src/lib/logger.ts` — Corrigir log de objetos não-Error

Linha 22: trocar `String(error)` por `JSON.stringify(error)` para objetos, evitando `[object Object]`.

### 3. `src/components/clients/ClientForm.tsx` — Status adequado para dívida externa

Remover as opções "Pago", "Pendente", "Quebrado" (que são de acordos). Para cadastro manual de dívida externa, o status deve ser simplesmente "pendente" (fixo/automático). Remover o campo Status do formulário e definir `status: "pendente"` fixo no `handleSubmit`.

### 4. `src/pages/CarteiraPage.tsx` — Melhorar mensagem de erro

No `onError` da mutation, mostrar detalhes do erro em vez de mensagem genérica.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/services/clientService.ts` | Incluir `tenant_id` nos records antes do insert |
| `src/lib/logger.ts` | Stringify objetos não-Error no log |
| `src/components/clients/ClientForm.tsx` | Remover campo Status (fixar como "pendente") |
| `src/pages/CarteiraPage.tsx` | Melhorar mensagem de erro no `onError` |

