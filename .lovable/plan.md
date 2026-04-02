

# Plano: Atualizar ficha do cliente quando nova ligação chega em /atendimento

## Causa Raiz

Quando o operador já está em `/atendimento/clienteA` e uma nova ligação entra pela 3CPlus:

1. O `TelefoniaDashboard` (que resolve o cliente e navega) está em `/contact-center` — **não está montado**
2. O `useThreeCPlusStatus` polling detecta que o agente voltou ao status 2, mas **não extrai dados da chamada** (telefone, CPF, mailing) — só retorna `status` e `isOnline`
3. Não existe nenhuma lógica em `AtendimentoPage` para detectar "nova ligação com outro cliente" e navegar

Resultado: a ficha anterior permanece aberta indefinidamente.

## Solução

### 1. `useThreeCPlusStatus.ts` — Expor dados da chamada ativa

Adicionar um segundo request ao polling: `company_calls` (igual ao TelefoniaDashboard faz). Do resultado, extrair a chamada ativa do agente e expor no estado:

```typescript
export interface ThreeCPlusAgentState {
  status: number | undefined;
  callId: string | number | null;
  isOnline: boolean;
  lastPoll: Date | null;
  // NOVOS campos:
  activeCallPhone: string | null;
  activeCallCpf: string | null;
  activeCallClientDbId: string | null;
}
```

No poll, após obter `myAgent` do `agents_status`, também invocar `company_calls`, filtrar pela chamada ativa do agente (mesma lógica do TelefoniaDashboard), e extrair `phone`, `identifier/mailing_identifier` (CPF) e `Extra3/mailing_extra3` (client DB id).

### 2. `AtendimentoPage.tsx` — Detectar nova chamada e navegar

Adicionar um `useEffect` que observa `liveAgentState`. Quando detectar:
- `status === 2` (em ligação)
- `activeCallClientDbId` ou `activeCallCpf` ou `activeCallPhone` presentes
- O cliente resolvido é **diferente** do `id` atual

→ Navegar para `/atendimento/:novoClientId` com os params corretos (`callId`, `channel=call`).

Para resolver o cliente a partir de CPF/phone, usar uma query simples ao banco (mesma lógica do `TelefoniaAtendimentoWrapper`).

### 3. Limpeza de estado na troca de cliente

Ao detectar navegação para novo cliente, limpar:
- `callHungUp`
- `hungUpCallIdRef`
- `activeSessionId`
- `sessionStorage` flags (`3cp_call_hung_up`, `3cp_qualified_from_disposition`)

## Fluxo Novo

```text
Operador em /atendimento/clienteA
   ↓
3CPlus envia nova ligação (status → 2)
   ↓
useThreeCPlusStatus detecta status=2 + phone/CPF do novo cliente
   ↓
AtendimentoPage detecta clienteB ≠ clienteA
   ↓
Navega para /atendimento/clienteB?callId=X&channel=call
   ↓
Ficha atualiza automaticamente
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useThreeCPlusStatus.ts` | Polling de `company_calls` + expor phone/CPF/clientDbId |
| `src/pages/AtendimentoPage.tsx` | Effect para detectar nova chamada e navegar ao novo cliente |

Nenhuma alteração em banco, serviços ou fluxos operacionais. O TelefoniaDashboard continua funcionando igual quando montado.

