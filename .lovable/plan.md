## Bug — DatePickerField em "Sincronizar por período" (MaxListPage)

**Causa raiz** em `src/pages/MaxListPage.tsx` (linhas 33–60, componente `DatePickerField`):

1. O handler valida só `day 1–31` e `month 1–12`, então aceita datas inexistentes (ex: `31/02/2026`, `31/04/2026`).
2. Chama `onChange("2026-02-31")` → estado pai vira ISO inválido.
3. O `useEffect` faz `format(parseISO(value), "dd/MM/yyyy")` sem proteção. `parseISO` devolve `Invalid Date` e `format` lança `RangeError` → React quebra a árvore → tela branca.

### Correção

Em `DatePickerField`:

1. **Validar a data real** antes de propagar: construir `new Date(year, month-1, day)` e confirmar `getDate()===day && getMonth()===month-1 && getFullYear()===year`. Se inválida:
   - Não chamar `onChange` (mantém valor anterior).
   - Marcar erro local (`hasError = true`) e exibir borda vermelha + helper "Data inválida".
   - Permitir o usuário continuar editando/apagando normalmente (não bloquear digitação).

2. **Blindar o useEffect** com `isValid` (de `date-fns`) e try/catch — se `value` vier inválido por qualquer motivo, manter `inputValue` atual em vez de quebrar.

3. Quando o input é totalmente apagado, limpar `hasError` e chamar `onChange("")` (já feito).

### Resultado

- Digitar `31/02/2026` mostra aviso "Data inválida" e não quebra a tela.
- Usuário pode apagar e corrigir.
- Calendário e fluxo de sincronização permanecem inalterados.

Sem mudanças de backend/edge function.
