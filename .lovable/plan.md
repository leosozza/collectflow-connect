## Ajuste filtros — /financeiro/baixas

Em `src/pages/financeiro/BaixasRealizadasPage.tsx` (linhas 278–331):

1. **Renomear placeholders e itens "Todos…"**:
   - "Todos credores" → "Credores" (placeholder do trigger também)
   - "Todos operadores" → "Operadores"
   - "Todos locais" → "Recebedor" (label e placeholder)
   - "Todos meios" → "Meios de pagamento"

2. **Aumentar largura dos `SelectTrigger`** para que o texto não fique cortado:
   - Credor: `w-40` → `w-44`
   - Operador: `w-40` → `w-44`
   - Local/Recebedor: `w-32` → `w-40`
   - Meio: `w-36` → `w-52`

   Adicionar `whitespace-nowrap` no SelectValue se necessário.

Sem mudanças de lógica — apenas labels e larguras.
