

## Problema

A linha 210 de `CarteiraPage.tsx` remove **todos** os registros de CPFs com acordos ativos. O usuário quer que esses clientes continuem visíveis na Carteira, mas com o status de cobrança correto ("Acordo Vigente").

## Solução

### `src/pages/CarteiraPage.tsx`

1. **Remover o filtro que exclui CPFs com acordos** (linha 210): tirar `if (agreementCpfs.has(...)) return false`

2. **Na etapa de agrupamento** (linhas 283-303): quando o CPF pertence ao `agreementCpfs`, buscar o `status_cobranca_id` correspondente ao "Acordo Vigente" no `statusMap` e forçá-lo como `status_cobranca_id` do grupo representativo — sobrescrevendo qualquer status anterior.

3. **Manter o filtro `semAcordo`** (linha 223-225) intacto — ele serve para quando o operador quer filtrar apenas clientes SEM acordo.

### Lógica concreta

```typescript
// Linha 208-212: remover a exclusão por agreementCpfs
let filtered = clients.filter(c => {
  if ((c as any).status === "em_acordo") return false;
  return true;
});

// Linhas 290-296: na montagem do grupo, se CPF tem acordo ativo, forçar status "Acordo Vigente"
const acordoVigenteId = [...statusMap.entries()]
  .find(([_, v]) => v.nome === "Acordo Vigente")?.[0] || null;

const representativeStatusCobranca = agreementCpfs.has(cpfClean)
  ? acordoVigenteId
  : (pendingRecord?.status_cobranca_id || earliest.status_cobranca_id);
```

### Arquivo
- `src/pages/CarteiraPage.tsx` — 2 alterações pontuais

