

# Plano: Desabilitar refetch automático ao voltar para a aba do navegador

## Problema

O React Query tem `refetchOnWindowFocus: true` por padrão. Quando o usuário sai da aba do navegador e volta, todas as queries ativas são re-executadas, causando loading states e a sensação de que a página "atualizou sozinha".

## Correção

**Arquivo**: `src/App.tsx`, linha 80

Adicionar `defaultOptions` ao `QueryClient` desabilitando `refetchOnWindowFocus`:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
```

Uma única linha de configuração. Nenhum outro arquivo precisa ser alterado. As queries continuam funcionando normalmente — só param de re-executar automaticamente ao focar a janela.

