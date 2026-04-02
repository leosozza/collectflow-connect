

# Plano: Otimizar performance e robustez da integração 3CPlus no Atendimento

## 1. Correção de lentidão (Waterfall de Queries)

**Problema**: As queries de `clientRecords`, `agreements`, `callLogs` dependem de `client?.cpf` — só iniciam após o fetch do cliente completar. Isso cria um waterfall sequencial.

**Solução**: Criar uma única query combinada que busca o cliente por ID e, na mesma resposta, já retorna o CPF. Usar `initialData` ou prefetch para iniciar as queries dependentes mais cedo. Concretamente:

- Adicionar `placeholderData` nas queries dependentes para que o React Query não bloqueie a renderização
- Usar `queryClient.prefetchQuery` para as queries de agreements/callLogs assim que o CPF estiver disponível no cache (via `onSuccess` implícito do React Query v5)
- Agrupar `clientRecords` + `agreements` + `callLogs` em um único `useQueries` que roda em paralelo assim que `client?.cpf` existir (já é o comportamento atual do React Query — o problema real é que cada query espera `enabled: !!client?.cpf` individualmente, mas todas já rodam em paralelo quando habilitadas)

**Análise real**: As 3 queries (`clientRecords`, `agreements`, `callLogs`) já são independentes entre si e todas têm `enabled: !!client?.cpf`. O React Query as dispara **em paralelo** assim que `client?.cpf` fica disponível. O waterfall real é apenas: fetch client → fetch CPF-based queries. Para otimizar:

- Extrair o CPF do state/params da navegação (quando vindo da carteira/telefonia, o CPF geralmente está disponível)
- Passar `cpf` como query param na navegação para `/atendimento` e usá-lo como `initialCpf` para iniciar as queries antes do client fetch completar

**Arquivo**: `src/pages/AtendimentoPage.tsx`

## 2. Force Release do Agente (forceReleaseAgent)

**Problema**: Se `qualifyOn3CPlus` falha, o agente fica preso em TPA/ACW na 3CPlus.

**Solução**: Criar `forceReleaseAgent` em `dispositionService.ts` que chama `unpause_agent` no proxy. Integrar no `handleFinishDisposition` como fallback.

```typescript
export async function forceReleaseAgent(params: {
  tenantSettings: Record<string, any>;
  agentId: number;
}): Promise<boolean>
```

**Arquivo**: `src/services/dispositionService.ts`

## 3. Fallback automático na tabulação

**Problema**: Quando `qualifyOn3CPlus` retorna `false` ou erro, o operador vê um toast mas fica preso.

**Solução**: No `onSuccess` da `dispositionMutation`, após falha de qualify:
- Chamar `forceReleaseAgent` automaticamente como fallback
- Se o fallback também falhar, exibir botão "Tentar Novamente" persistente no banner de status
- Adicionar estado `qualifyFailed` que ativa o botão de retry no banner

**Arquivo**: `src/pages/AtendimentoPage.tsx`

## 4. Proteção contra sobrescrita do polling

**Problema**: Após hangup, o polling pode sobrescrever o estado local com dados da chamada anterior.

**Solução**: No `useThreeCPlusStatus`, comparar o `callId` detectado com o `hungUpCallIdRef`. Se for o mesmo, não atualizar o state. Adicionar guard no `AtendimentoPage` para ignorar transições de status que referenciem um callId já tabulado.

**Arquivo**: `src/hooks/useThreeCPlusStatus.ts`, `src/pages/AtendimentoPage.tsx`

## 5. Banner de feedback visual aprimorado

**Problema**: O banner não indica se a última tabulação sincronizou ou falhou.

**Solução**: Adicionar estado `syncStatus: 'idle' | 'synced' | 'failed'` e renderizar no banner:
- `synced` → badge verde "✓ Sincronizado com 3CPlus"
- `failed` → badge vermelho "✗ Falha na sincronização" + botão "Tentar Novamente" que chama `forceReleaseAgent`

**Arquivo**: `src/pages/AtendimentoPage.tsx`

## Resumo de arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/dispositionService.ts` | Adicionar `forceReleaseAgent` |
| `src/pages/AtendimentoPage.tsx` | CPF via params, fallback qualify, banner sync status, retry button |
| `src/hooks/useThreeCPlusStatus.ts` | Guard contra sobrescrita de chamada já tabulada |

Nenhuma alteração em banco, tabelas ou edge functions.

