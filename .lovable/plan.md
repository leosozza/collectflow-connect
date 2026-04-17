

## Plano — Corrigir 2 bugs visuais na lista de Acordos

### Bug 1: coluna "Parcela" mostrando "2/3" em vez de "2ª"
Investigar por que a coluna está renderizando o contador. Hipótese: `_installmentNumber` está vindo como o índice agregado em vez do número real da parcela, OU a coluna "Parcela" e "Parcelas Pagas" trocaram de lugar no header vs body. Vou ler `AgreementsList.tsx` e `AcordosPage.tsx` linha por linha pra confirmar.

### Bug 2: status `completed` aparecendo cru
Adicionar mapeamento em `AgreementsList.tsx`:
```ts
statusLabels.completed = "Quitado"
statusColors.completed = "bg-green-100 text-green-800"
```
(Hoje só `approved` está mapeado.)

### Investigação adicional (Kemilly)
Confirmar via banco:
- O acordo da Kemilly realmente tem 3 parcelas e só 2 pagas?
- Por que o status está `completed`?

Isso define se o bug é só visual (mapeamento) ou se há inconsistência de dados.

### Arquivos
- `src/components/acordos/AgreementsList.tsx` — adicionar `completed` no mapa + investigar render da coluna Parcela
- `src/pages/AcordosPage.tsx` — verificar se `_installmentNumber` está sendo populado corretamente

### Sem alteração
Schema, RLS, classifier, services.

