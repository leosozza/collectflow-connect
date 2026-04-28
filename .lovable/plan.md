# Rotas dedicadas para abas de Configurações

Hoje `/configuracoes` usa apenas o query param `?tab=` para alternar entre Integração, Auditoria, API REST e MaxList. Vamos criar rotas reais para cada aba, mantendo o layout/abas compartilhado.

## Estrutura de rotas (nova)

```text
/configuracoes                  → redireciona para /configuracoes/integracao
/configuracoes/integracao       → IntegracaoPage
/configuracoes/auditoria        → AuditoriaPage  (gated por permissão)
/configuracoes/api              → ApiDocsPage    (gated por isTenantAdmin)
/configuracoes/maxlist          → MaxListPage    (gated por isMaxList)
```

## Mudanças

### 1. `src/App.tsx`
- Substituir a rota única `<Route path="configuracoes" element={<ConfiguracoesPage />} />` por uma rota pai com filhos:
  ```tsx
  <Route path="configuracoes" element={<ConfiguracoesPage />}>
    <Route index element={<Navigate to="integracao" replace />} />
    <Route path="integracao" element={<IntegracaoPage />} />
    <Route path="auditoria" element={<AuditoriaPage />} />
    <Route path="api" element={<ApiDocsPage />} />
    <Route path="maxlist" element={<MaxListPage />} />
  </Route>
  ```

### 2. `src/pages/ConfiguracoesPage.tsx`
- Remover `useUrlState("tab", ...)` e o sistema de `visited`/`display:none`.
- Cada item da nav vira um `NavLink` (ou `<Link>` controlado por `useLocation`) apontando para `/configuracoes/<key>`.
- Renderizar `<Outlet />` no lugar do bloco de conteúdo condicional.
- Manter a lógica de gating (permissões, `isTenantAdmin`, `isMaxList`) só para mostrar/ocultar as abas na nav.

### 3. `src/components/AppLayout.tsx`
- Atualizar o mapa de títulos para incluir os novos paths (`/configuracoes/integracao`, `/configuracoes/auditoria`, `/configuracoes/api`, `/configuracoes/maxlist`) — todos exibem "Configurações".
- Ajustar o estado "ativo" do item Configurações na sidebar para considerar `location.pathname.startsWith("/configuracoes")`.
- O link da sidebar continua apontando para `/configuracoes` (que redireciona para `integracao`).

### 4. Compatibilidade retroativa
- Adicionar dentro de `ConfiguracoesPage` um efeito que, se a URL ainda vier no formato antigo `/configuracoes?tab=api_docs`, faz `navigate("/configuracoes/api", { replace: true })`. Mapas:
  - `tab=integracao` → `/configuracoes/integracao`
  - `tab=auditoria` → `/configuracoes/auditoria`
  - `tab=api_docs` → `/configuracoes/api`
  - `tab=maxlist` → `/configuracoes/maxlist`

## Observações
- As páginas filhas (`IntegracaoPage`, `AuditoriaPage`, `ApiDocsPage`, `MaxListPage`) não precisam de alteração.
- Não mexe em `/admin/configuracoes` (Super Admin), que já é uma rota separada.
- Após aprovar, links externos/copiar-colar para uma aba específica passam a funcionar (ex.: `/configuracoes/api`).
