

# Unificar tela de atendimento telefônico com AtendimentoPage

## Contexto

Hoje existem dois componentes separados que fazem a mesma coisa:
- **`TelefoniaAtendimento`** — renderizado inline dentro do `TelefoniaDashboard` quando uma chamada conecta (busca cliente por telefone)
- **`AtendimentoPage`** — página standalone acessada via `/atendimento?clientId=...` (busca cliente por ID)

Ambos usam os mesmos sub-componentes (`ClientHeader`, `DispositionPanel`, `NegotiationPanel`, `ClientTimeline`) e têm lógica duplicada.

## Proposta

Quando o operador estiver em chamada no discador, ao invés de renderizar o `TelefoniaAtendimento` inline, o sistema vai:

1. **Buscar o cliente pelo telefone** (lógica já existente no TelefoniaAtendimento)
2. **Se encontrar**, renderizar o `AtendimentoPage` inline dentro do dashboard, passando o `clientId` encontrado + contexto de chamada (agentId, callId)
3. **Se não encontrar**, mostrar o card "Cliente não encontrado" atual

Isso garante uma única tela de atendimento, sem perder fluidez — o operador continua dentro do dashboard de telefonia, mas vendo a mesma tela unificada.

## Alterações técnicas

### 1. `src/pages/AtendimentoPage.tsx` — Tornar reutilizável
- Aceitar props opcionais: `clientId`, `agentId`, `callId`, `embedded` (boolean)
- Quando `embedded=true`, esconder o botão "Voltar" e o header "Atendimento"
- Quando `agentId` + `callId` estiverem presentes, passar para `qualifyOn3CPlus` nas tabulações (hoje só funciona via query param, sem contexto 3CPlus)
- Se `clientId` vier via prop, usar ele; senão, ler do `searchParams` (mantém compatibilidade)

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — Substituir TelefoniaAtendimento
- Na seção "State 3: On call", trocar `<TelefoniaAtendimento>` por um wrapper que:
  1. Faz a busca do cliente por telefone (reusar a query existente do TelefoniaAtendimento)
  2. Se encontrou → renderiza `<AtendimentoPage clientId={client.id} agentId={...} callId={...} embedded />`
  3. Se não encontrou → mostra card "Cliente não encontrado"
- Extrair a busca por telefone num hook simples `useClientByPhone(phone)` para manter o dashboard limpo

### 3. Criar `src/hooks/useClientByPhone.ts` (novo)
- Hook pequeno que encapsula a query de busca de cliente por sufixo de telefone
- Retorna `{ client, isLoading }`

### 4. `src/components/contact-center/threecplus/TelefoniaAtendimento.tsx` — Remover
- Arquivo deletado após migração, já que toda a lógica estará no AtendimentoPage unificado

## Fluidez preservada

- O operador **não sai da aba de telefonia** — o AtendimentoPage renderiza embedded dentro do dashboard
- A barra de status de chamada (timer, animação pulse) continua no topo, exatamente como hoje
- A transição entre "aguardando chamada" → "em atendimento" continua automática
- Tabulação continua qualificando automaticamente no 3CPlus

## Resultado

Uma única tela de atendimento (`AtendimentoPage`) usada em dois contextos:
- Standalone via `/atendimento?clientId=...` (acesso manual)
- Embedded no dashboard de telefonia (acesso automático durante chamada)

