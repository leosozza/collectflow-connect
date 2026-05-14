## Objetivo

Corrigir a classificação `Quitado` indevida no `auto-status-sync` e reclassificar os 9 clientes já afetados — sem alterar a hierarquia de status nem a SSOT.

## Causa

Em `supabase/functions/auto-status-sync/index.ts` o stream de `clients` é ordenado apenas por `(cpf, credor)` (linhas 179-180). PostgREST não garante ordem estável entre páginas para empates → o agrupamento contíguo no JS pode receber **subconjuntos** de um grupo. O check `clients.every(c => c.status === 'pago')` (linha 122) então acerta `true` sobre 5 das 12 linhas pagas e marca `quitado`, deixando as parcelas vencidas em aberto escondidas. O cliente fica bloqueado de receber novo acordo porque o papel `quitado` tem `somente_leitura: true`.

## Mudanças

### 1. `supabase/functions/auto-status-sync/index.ts`
- **Tiebreaker determinístico**: na query do passo 4 (linhas 174-181), adicionar `.order("id", { ascending: true })` como terceira chave, garantindo que todas as linhas de uma `(cpf, credor)` apareçam contíguas e na mesma ordem em runs sucessivos.
- **Defesa em profundidade contra fragmentação**: antes do `flushUpdates` periódico (linha 209) **NÃO** processar grupos que sejam apenas o `carry` na primeira página seguinte. O fluxo já cobre: o `carry` só é processado quando aparece um `cpf/credor` diferente — adequado se a ordenação for estável. Com o tiebreaker por `id` adicionado, isso passa a ser garantido.
- **Guard explícito no `processGroup`**: trocar `const allPago = clients.every(c => c.status === "pago")` por:
  ```ts
  const allPago = clients.length > 0 && clients.every(
    (c: any) => c.status === "pago"
  );
  const hasOpenOverdue = clients.some(
    (c: any) => c.data_vencimento < today && c.status !== "pago" && c.status !== "cancelado_maxlist"
  );
  if (allPago && !hasOpenOverdue && quitadoId) { ... }
  ```
  Mesmo que um grupo chegue fragmentado por algum motivo futuro, qualquer linha vencida em aberto vista no subconjunto impede o `quitado`.

### 2. Reclassificação dos 9 clientes já afetados (uma vez)
- Após o deploy, disparar `auto-status-sync` em modo single-tenant para `39a450f8-7a40-46e5-8bc7-708da5043ec7` via `supabase--curl_edge_functions` (admin já autenticado).
- Validar com a mesma query do diagnóstico: o resultado esperado é **0 clientes** com `(vencidas em aberto > 0) AND (papel = quitado)`.

### 3. Verificação cruzada
- Spot-check dos 9 CPFs listados: confirmar que voltam para `Inadimplente` e que o botão "Formalizar Acordo" passa a aparecer para o operador.
- Conferir o caso do Wanderson em específico (era o reportado).

## Fora de escopo

- Não vamos mexer na regra `somente_leitura` do papel `quitado` — está correta.
- Não vamos remover as 12 linhas duplicadas do Wanderson — são contratos distintos legítimos do MaxSystem (IdRecords distintos), conforme o modelo já documentado.
- Não vamos alterar a hierarquia de status. A correção é apenas no algoritmo de detecção.
- Acordo "que o Vitor disse ter feito" não existe — não há nada para recuperar; após o fix ele consegue criar normalmente.
