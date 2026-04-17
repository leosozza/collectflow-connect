

## Plano — Padronizar nomenclatura "Acordo Atrasado"

### Problema
- Em `/carteira/:cpf?tab=acordo` (perfil do cliente): badge vermelho **"Acordo Atrasado"**.
- Em `/acordos` aba Vigentes, coluna "Status do Acordo": badge **"Vencido"**.
- Mesma entidade (`agreement.status === "overdue"`), nomes diferentes. Confunde.

### Investigação rápida necessária
Confirmar nos arquivos:
- `src/components/acordos/AgreementsList.tsx` — `statusLabels.overdue = "Vencido"` (visto). Trocar para `"Acordo Atrasado"`.
- Localizar o componente do perfil do cliente que renderiza "Acordo Atrasado" para confirmar que é o mesmo `status === "overdue"` (e não derivado de outra lógica como parcela vencida).

### Mudança
Em `AgreementsList.tsx`:
```ts
statusLabels.overdue = "Acordo Atrasado"  // era "Vencido"
```
Cor (`bg-amber-100 text-amber-800`) — manter ou trocar para vermelho (`bg-red-100 text-red-800`) pra bater com o perfil? Vou confirmar a cor usada no perfil antes de decidir.

### Cuidado
Não confundir com a coluna **"Status da Parcela"** (essa sim mostra "Vencida" referindo-se à parcela individual do mês — nomenclatura correta lá, é parcela, não acordo).

### Arquivo
- `src/components/acordos/AgreementsList.tsx` — 1 linha no `statusLabels`, possivelmente 1 no `statusColors`.

### Sem alteração
Schema, RLS, services, classifier, perfil do cliente.

