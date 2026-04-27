## Problema encontrado

A página não está abrindo por erros de build no frontend. Encontrei dois problemas objetivos:

1. `src/pages/financeiro/BaixasRealizadasPage.tsx` tem JSX duplicado após o `export default`, nas linhas finais. Isso gera erro de sintaxe:

```text
Expression expected
Unterminated regexp literal
File: src/pages/financeiro/BaixasRealizadasPage.tsx
```

2. `src/lib/formatters.ts` não exporta `formatCredorName`, mas essa função é importada por:

```text
src/components/acordos/AgreementsList.tsx
src/pages/ClientDetailPage.tsx
```

Isso gera o erro:

```text
The requested module '/src/lib/formatters.ts' does not provide an export named 'formatCredorName'
```

## Correção proposta

1. Remover o bloco duplicado no final de `BaixasRealizadasPage.tsx`, deixando apenas um fechamento correto do componente e um único:

```ts
export default BaixasRealizadasPage;
```

2. Adicionar em `src/lib/formatters.ts` a função exportada que já é esperada pelo restante do app:

```ts
export const formatCredorName = (name?: string | null): string => {
  if (!name) return "—";
  return String(name).trim() || "—";
};
```

3. Após isso, rodar uma verificação de build/TypeScript para confirmar se não há outro erro bloqueando a abertura.

## O que não será alterado

- Não vou alterar regras de negócio.
- Não vou alterar dados, banco, filtros, dashboard ou permissões.
- Não vou mexer no layout dos KPIs agora; primeiro vamos recuperar a abertura do sistema.

## Resultado esperado

O app volta a carregar normalmente. Depois de estabilizar a abertura da página, seguimos com o ajuste visual do Dashboard.