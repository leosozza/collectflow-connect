

# Plano: Rota `/atendimento/:clientId` para abertura direta de fichas

## Problema

A tela de atendimento usa `?clientId=` como query param, mas quando uma chamada cai no 3CPlus, o sistema depende do `useClientByPhone` para resolver o cliente pelo telefone. Se o telefone não bate, a ficha não abre. Precisamos de uma rota path-based (`/atendimento/:clientId`) para que o sistema possa navegar diretamente para o cliente correto por ID.

## Mudanças

### 1. `src/App.tsx` — Adicionar rota `/atendimento/:clientId`

Adicionar nova rota path-based que passa o `clientId` via params, além da rota existente `/atendimento` (query param):

```
<Route path="/atendimento/:clientId" element={<ProtectedRoute requireTenant><AppLayout><AtendimentoPage /></AppLayout></ProtectedRoute>} />
```

### 2. `src/pages/AtendimentoPage.tsx` — Aceitar `useParams`

Atualizar para ler o `clientId` de `useParams()` além do query param e da prop:

```typescript
const { clientId: paramClientId } = useParams();
const id = propClientId || paramClientId || searchParams.get("clientId");
```

### 3. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — Navegar por ID quando possível

No `TelefoniaAtendimentoWrapper`, após resolver o cliente via `useClientByPhone`, usar a rota `/atendimento/{clientId}` para navegação. Isso garante que a URL sempre identifique o cliente.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Nova rota `/atendimento/:clientId` |
| `src/pages/AtendimentoPage.tsx` | Ler `clientId` de `useParams` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Usar `/atendimento/{id}` na navegação |

