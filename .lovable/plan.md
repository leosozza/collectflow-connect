

# Tornar nomes de clientes em links `<a>` nativos

## Problema
Atualmente os nomes dos clientes usam `<span>` ou `<button>` com `onClick` + `navigate()`. Isso impede ctrl+click para abrir em nova aba e right-click → "Abrir em nova guia".

## Solução
Substituir por `<Link>` do React Router (que renderiza `<a href="...">`) em todos os pontos onde o nome do cliente é clicável. O `<Link>` mantém a navegação SPA no clique normal, mas permite ctrl+click e right-click nativamente.

## Arquivos a alterar

1. **`src/components/acordos/AgreementsList.tsx`** — `<span onClick>` → `<Link to={...}>`
2. **`src/pages/CarteiraPage.tsx`** (linha ~803) — `<button onClick>` → `<Link to={...}>`
3. **`src/pages/DashboardPage.tsx`** (linha ~302) — `<button onClick>` → `<Link to={...}>`
4. **`src/components/acordos/PaymentConfirmationTab.tsx`** (linha ~162) — `<span onClick>` → `<Link to={...}>`
5. **`src/components/dashboard/ScheduledCallbacksDialog.tsx`** — manter navigate (é um dialog que fecha antes de navegar, `<a>` não se aplica aqui)
6. **`src/components/carteira/CarteiraKanban.tsx`** — card inteiro é clicável, wrapping com `<a>` no nome

Todas as ocorrências usarão:
```tsx
<Link
  to={`/carteira/${cpf}?tab=acordo`}
  className="font-medium text-primary hover:underline"
>
  {nome}
</Link>
```

Sem mudança de comportamento visual — apenas melhoria de acessibilidade e usabilidade do browser.

