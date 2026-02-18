
## Problema: Campos de edição do cliente não são salvos

### Causa Raiz

Em `src/lib/validations.ts`, o `clientSchema` Zod não declara os campos opcionais de contato e endereço: `phone`, `email`, `external_id`, `endereco`, `cidade`, `uf`, `cep`, `observacoes`.

Em `src/services/clientService.ts`, a função `updateClient` faz:

```typescript
const partialSchema = clientSchema.partial();
const validated = partialSchema.parse(data);
// validated NÃO contém phone, email, endereco, etc.
// pois não estão definidos no schema
```

O Zod por padrão descarta campos desconhecidos (`strip` mode). Então quando o usuário edita nome, telefone, endereço e clica em Salvar, apenas os campos que constam no schema (`credor`, `cpf`, `valor_parcela`, etc.) chegam ao banco — os demais são silenciosamente ignorados.

### Solução

Adicionar os campos opcionais ausentes ao `clientSchema` em `src/lib/validations.ts`:

```typescript
phone: z.string().trim().max(20).optional().nullable(),
email: z.string().trim().email("Email inválido").max(255).optional().nullable(),
external_id: z.string().trim().max(100).optional().nullable(),
endereco: z.string().trim().max(300).optional().nullable(),
cidade: z.string().trim().max(100).optional().nullable(),
uf: z.string().trim().max(2).optional().nullable(),
cep: z.string().trim().max(10).optional().nullable(),
observacoes: z.string().trim().max(1000).optional().nullable(),
```

Isso garante que `clientSchema.partial().parse(data)` preserve todos os campos quando o usuário editar um cliente, e que eles sejam corretamente enviados ao banco de dados.

### Arquivo a modificar

| Arquivo | Mudança |
|---|---|
| `src/lib/validations.ts` | Adicionar 8 campos opcionais ao `clientSchema` |

Nenhuma mudança no banco de dados, nenhuma migration necessária — é uma correção pura de validação no frontend.
