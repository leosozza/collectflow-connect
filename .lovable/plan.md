

## Plano: Corrigir checkbox "Selecionar Todos" no MaxList

### Diagnóstico
O problema está na forma como o `onCheckedChange` é passado para o `Checkbox`. O Radix Checkbox espera `(checked: boolean | "indeterminate") => void`, mas `toggleAll` é passado diretamente sem wrapper. Além disso, com datasets grandes, a renderização de todas as linhas simultaneamente pode travar a UI.

### Correção em `src/pages/MaxListPage.tsx`

1. **Wrapper no `onCheckedChange`**: trocar `onCheckedChange={toggleAll}` por `onCheckedChange={() => toggleAll()}` para garantir a chamada correta

2. **Mesma correção no checkbox individual**: garantir consistência nos handlers de checkbox

Alteração mínima — apenas ajustar a linha do checkbox header (linha ~949).

