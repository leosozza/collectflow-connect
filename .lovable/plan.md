

## Problema: Cliente com acordo ativo ainda aparece na Carteira

### Causa raiz

O filtro da Carteira (linha 208 de `CarteiraPage.tsx`) apenas exclui registros individuais com `status === "em_acordo"`:

```typescript
let filtered = clients.filter(c => (c as any).status !== "em_acordo");
```

Alexandre dos Santos tem 2 registros:
- 1 com status `pago` (não é `em_acordo` → **passa pelo filtro**)
- 1 com status `em_acordo` (filtrado corretamente)

O registro `pago` com `status_cobranca_id` = "Aguardando acionamento" permanece visível na Carteira, mesmo o cliente tendo um acordo ativo.

### Solução

Alterar a lógica de filtragem para **também excluir todos os registros de CPFs que possuem acordos ativos** (usando o `agreementCpfs` set que já é carregado na linha 137-146):

**Arquivo: `src/pages/CarteiraPage.tsx` — linha 208**

De:
```typescript
let filtered = clients.filter(c => (c as any).status !== "em_acordo");
```

Para:
```typescript
let filtered = clients.filter(c => {
  if ((c as any).status === "em_acordo") return false;
  // Also exclude all records for CPFs with active agreements
  if (agreementCpfs.has(c.cpf.replace(/\D/g, ""))) return false;
  return true;
});
```

Isso garante que **todo o grupo CPF** seja removido da Carteira quando existe um acordo ativo, alinhando com a regra de negócio documentada.

### Arquivo a modificar
- `src/pages/CarteiraPage.tsx` — linha 208, expandir filtro para excluir CPFs com acordos ativos

