

# Correções na Página de Perfil do Cliente

## Problemas Identificados

### 1. Re-renders contínuos (ainda ocorrendo)
A correção anterior estabilizou `user`, mas `profile` e o próprio objeto `value` do Context continuam instáveis:
- `fetchProfile` é chamado 2x no mount (via `getSession` + `onAuthStateChange`), cada vez criando um novo objeto `profile` → o `AuthContext.Provider` value muda → todos os consumers re-renderizam
- O objeto `value={{ user, session, profile, ... }}` do Provider é recriado a cada render, propagando re-renders desnecessários

**Correção**: Estabilizar `setProfile` (comparar `id`) e usar `useMemo` no `value` de ambos os Providers.

### 2. Erros de centavos nos cálculos de desconto
- `totals.descontoVal` não é arredondado: `totalBruto * (descontoPercent / 100)` resulta em floating point como `99.9666...`
- `installmentValue` também não é arredondado: `remainingAfterEntrada / numParcelas` pode dar `332.8866...`
- Resultado: valores com centavos quebrados na simulação e divergência entre "Valor Atualizado" e soma das parcelas

**Correção**: Aplicar `Math.round(... * 100) / 100` nos cálculos de `descontoVal`, `totalAtualizado` e `installmentValue`.

### 3. UX ruim nos campos de desconto (% e R$)
Os campos `descontoPercent` e `descontoReais` usam `Number(e.target.value) || 0`, que impede o usuário de apagar o valor (volta para 0 imediatamente ao limpar). O campo de entrada já usa o padrão correto com `number | ""`.

**Correção**: Mudar os states para `number | ""`, usar `e.target.value === "" ? "" : Number(e.target.value)` no onChange, e converter para 0 apenas nos cálculos.

## Arquivos a alterar

### `src/hooks/useAuth.tsx`
- Adicionar `setProfileStable` que só atualiza se `profile.id` mudou
- Memoizar o `value` do `AuthContext.Provider` com `useMemo`

### `src/hooks/useTenant.tsx`
- Memoizar o `value` do `TenantContext.Provider` com `useMemo`

### `src/components/client-detail/AgreementCalculator.tsx`
- Mudar `descontoPercent` e `descontoReais` para tipo `number | ""`
- Atualizar os onChange para permitir campo vazio
- Arredondar `descontoVal` e `totalAtualizado` no `useMemo` de totals
- Arredondar `installmentValue` na linha 180

## Sem migrations necessárias

