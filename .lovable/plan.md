

# Fix: Rota `/gamificacao` retornando 404

## Problema
A rota `/gamificacao` nao esta registrada no `App.tsx`. O componente `GamificacaoPage` esta importado mas nunca adicionado ao `<Routes>`.

## Solucao
Adicionar a rota `/gamificacao` no `App.tsx` com o mesmo padrao das demais rotas protegidas (ProtectedRoute + requireTenant + AppLayout).

## Arquivo a editar

| Arquivo | Acao |
|---|---|
| `src/App.tsx` | Adicionar `<Route path="/gamificacao">` antes do wildcard `*` |

## Codigo

Adicionar entre a rota `/perfil` e a rota do Super Admin:

```text
<Route
  path="/gamificacao"
  element={
    <ProtectedRoute requireTenant>
      <AppLayout>
        <GamificacaoPage />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

Tambem verificar se existem outras paginas importadas mas sem rota (FinanceiroPage, AnalyticsPage, etc.) — essas tambem estao faltando no router e devem ser adicionadas.

