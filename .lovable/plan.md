

# Plano: Corrigir erro `removeChild` no MaxListPage

## Problema
O erro `NotFoundError: Failed to execute 'removeChild'` ocorre ao desmontar o `MaxListPage` enquanto Popovers do Radix UI ainda possuem nós portalizados no DOM. Isso acontece porque:
1. O `ConfiguracoesPage` usa renderização condicional (`{active === "maxlist" && <MaxListPage />}`) que desmonta abruptamente o componente
2. O Radix Popover cria portais no `<body>` que entram em conflito com a desmontagem do React

## Alterações

### 1. `src/pages/ConfiguracoesPage.tsx`
Trocar a renderização condicional por CSS `display:none` para tabs inativas, evitando a desmontagem abrupta dos componentes com portais:

```tsx
{/* Em vez de: {active === "maxlist" && <MaxListPage />} */}
<div style={{ display: active === "integracao" ? "block" : "none" }}>
  <IntegracaoPage />
</div>
<div style={{ display: active === "maxlist" ? "block" : "none" }}>
  {isMaxList && <MaxListPage />}
</div>
{/* Similar para as outras tabs */}
```

Isso mantém os componentes montados (sem conflito de portais) mas ocultos visualmente.

### 2. Alternativa mais leve (se performance for preocupação)
Fechar popovers explicitamente antes da troca de aba. Porém, a abordagem de CSS `display:none` é mais robusta e simples.

## Detalhes técnicos
- O erro é cosmético — não causa crash visível, apenas polui o console
- A solução `display:none` evita re-montagem desnecessária mas mantém os componentes em memória
- Lazy-load com `useState` para só montar uma tab quando ela for visitada pela primeira vez (evita carregar todas as tabs no load inicial)

## Resultado
Elimina completamente o `removeChild` error e o warning de ref do Calendar.

