## Análise: Por que a reabertura está lenta

Não é o computador do operador — é a forma como o frontend executa a operação. Hoje, quando o operador clica em **"Reabrir parcela(s)"** ou **"Reabrir acordo"**, a interface só libera o botão depois de uma cadeia de chamadas sequenciais ao servidor que ele nem precisa esperar.

### Gargalos identificados

**1. Reabrir parcelas (`ClientDetailPage.handleReopenParcelas`)**

Hoje o fluxo é estritamente sequencial e bloqueante:

```text
para cada parcela selecionada:
  await supabase.update(clients)        ← 1 round-trip por parcela
await recalcScoreForCpf(cpf)             ← invoca edge function (calculate-propensity)
await supabase.functions.invoke("auto-status-sync")  ← edge function pesada
await logAction(...)
await refetch()
```

- Se o operador seleciona 10 parcelas, são **10 UPDATEs em série** (cada um ~150–400ms = 1,5–4s só aí).
- Em seguida, **duas edge functions** (`calculate-propensity` e `auto-status-sync`) rodam **dentro do `await`** — o botão fica em "Reabrindo..." até elas terminarem (cold start + execução = facilmente 2–6s extras).
- Total: **5–10 segundos** com a UI travada, dependendo da quantidade.

**2. Reabrir acordo (`agreementService.reopenAgreement`)**

O service em si é razoável (UPDATE + UPDATE em massa + insert no timeline) e o `generate-agreement-boletos` já é fire-and-forget. Mas em `ClientDetailPage.handleReopenAgreement` o `await reopenAgreement(...)` é seguido de `await refetch()` e re-renderizações pesadas da página de detalhes. Não há feedback imediato — o usuário só vê o resultado quando tudo termina.

**3. Edge function `auto-status-sync`**

Roda recálculo de status de TODOS os clientes do tenant. Chamá-la com `await` no clique do operador é desnecessário: ela existe justamente para sincronizar em background.

## O que vou mudar

### 1. Paralelizar updates das parcelas
Trocar o `for ... await` por `Promise.all` dos UPDATEs (ou um único UPDATE com `.in("id", ids)` separado por status). Reduz de N round-trips sequenciais para 1–2 chamadas em paralelo.

### 2. Tornar pós-processamento fire-and-forget
- `recalcScoreForCpf` → sem `await` (já é resiliente, falha silenciosa).
- `auto-status-sync` → sem `await` (é sincronização global, não é pré-requisito para o sucesso da operação).
- `logAction` → sem `await`.
- Fechar o dialog e mostrar `toast.success` **imediatamente** após os UPDATEs principais.

### 3. Otimistic update no React Query
Antes do `refetch`, atualizar o cache local do `["client-detail", cpf, credorFilter]` marcando as parcelas como `pendente`/`vencido` localmente. O operador vê a mudança instantaneamente; o `refetch` continua rodando em background para garantir consistência.

### 4. Reabertura de acordo com feedback imediato
- Mostrar `toast.success` assim que o UPDATE do `agreements` retorna (não esperar o UPDATE em massa de `clients` nem o insert no timeline — esses já têm try/catch, podem ir em paralelo).
- `refetch` em background (sem `await` bloqueando o toast).

### 5. Telemetria leve
Adicionar `console.time/timeEnd` em `handleReopenParcelas` e `handleReopenAgreement` para que a gente consiga medir o impacto em produção via console se voltar a reclamação.

## Resultado esperado

- **Reabrir 1 parcela**: de ~3–5s → ~400–800ms percebidos.
- **Reabrir 10 parcelas**: de ~8–12s → ~1–2s percebidos.
- **Reabrir acordo**: de ~3–6s → ~600ms–1,2s percebidos.

A consistência final continua garantida — `auto-status-sync`, recálculo de score e refetch continuam executando, só não bloqueiam mais a UI.

## Arquivos a alterar

- `src/pages/ClientDetailPage.tsx` — refatorar `handleReopenParcelas` (paralelizar + fire-and-forget + otimistic update) e `handleReopenAgreement` (refetch em background).
- (Opcional) `src/services/agreementService.ts` — pequenos ajustes para que `reopenAgreement` retorne assim que o UPDATE principal sai, deixando o resto em background com tratamento de erro silencioso.

Sem mudanças de schema, RLS ou edge functions.
