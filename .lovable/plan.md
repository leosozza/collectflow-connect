

# Mover Tokens para dentro do catálogo de Serviços

## Situação atual
Tokens é uma aba separada no nível superior (ao lado de Financeiro, Contrato, Serviços, Cancelamento). O usuário quer que Tokens seja uma aba **dentro** do catálogo de serviços, ao lado de AI Agent, Contact Center, etc.

## Alterações

### 1. `src/pages/TenantSettingsPage.tsx`
- Remover a `TabsTrigger` e `TabsContent` de `"tokens"` do nível superior
- Passar props de tokens (`tokens`, `transactions`, `loadingData`, `onPurchase`) para o `ServiceCatalogGrid`

### 2. `src/components/services/ServiceCatalogGrid.tsx`
- Receber novas props: `tokens`, `transactions`, `loadingTokens`, `onPurchase`
- Adicionar aba fixa `"tokens"` na `TabsList` (após as categorias dinâmicas do catálogo)
- No `TabsContent` de tokens, renderizar `TokenBalance` + `TokenHistoryTable`

### 3. `src/types/tokens.ts`
- Garantir que `"tokens"` está no `CATEGORY_LABELS` (já deve estar)

Resultado: a aba Tokens aparecerá dentro do grid de serviços, ao lado de AI Agent.

