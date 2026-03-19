

# Plano: Modal de Atendimento ao receber chamada 3CPlus

## Objetivo
Quando uma chamada do 3CPlus e atendida, ao inves de navegar para `/atendimento/:clientId`, abrir um Dialog/modal fullscreen com o `AtendimentoPage` embutido. Isso mantém o operador na pagina atual e e mais rapido (sem troca de rota).

## Mudancas

### 1. Criar contexto global `AtendimentoModalContext`
**Novo arquivo**: `src/hooks/useAtendimentoModal.tsx`

- Context com `openAtendimento(clientId, agentId?, callId?)` e `closeAtendimento()`
- State: `isOpen`, `clientId`, `agentId`, `callId`
- Provider renderiza um `Dialog` fullscreen (max-w-7xl, max-h-[95vh]) contendo `AtendimentoPage` com `embedded={true}`
- O dialog usa `overflow-y-auto` para scroll interno

### 2. Atualizar `TelefoniaAtendimentoWrapper` em `TelefoniaDashboard.tsx`
- Importar `useAtendimentoModal`
- Substituir `navigate(\`/atendimento/${resolvedId}\`)` por `openAtendimento(resolvedId, agentId, callId)`
- Remover `useNavigate` e `hasNavigated` ref (substituir por ref que evita abrir duplicado)

### 3. Registrar o Provider no `App.tsx`
- Envolver as rotas com `AtendimentoModalProvider` (dentro de `AuthProvider` e `TenantProvider`)
- O modal fica disponivel globalmente em qualquer rota

## Detalhes tecnicos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | Novo — context + provider com Dialog fullscreen renderizando AtendimentoPage embedded |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Trocar `navigate()` por `openAtendimento()` no wrapper |
| `src/App.tsx` | Adicionar `AtendimentoModalProvider` envolvendo rotas |

## Notas
- `AtendimentoPage` ja suporta `embedded={true}` que oculta breadcrumb/navegacao — perfeito para modal
- O Dialog sera renderizado via portal, entao funciona em qualquer pagina sem conflito de layout
- Abertura instantanea pois nao ha troca de rota, apenas mount do componente

