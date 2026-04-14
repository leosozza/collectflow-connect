

# Score Operacional não está sendo atualizado — Diagnóstico e Correção

## Diagnóstico

**Dados encontrados:**
- **419.737 clientes** no sistema — **ZERO** com score calculado
- **2.700+ eventos** registrados em `client_events` para **355 CPFs** (WhatsApp, acordos, ligações, pagamentos)
- Os triggers SQL que populam `client_events` estão funcionando corretamente
- A Edge Function `calculate-propensity` existe e a lógica de cálculo está correta

**Causa raiz:** O cálculo do score **só é disparado manualmente** — existe um botão na CarteiraPage que chama `calculate-propensity`, mas nunca há chamada automática. Nenhum fluxo do sistema (pagamento, acordo, ligação, WhatsApp) recalcula o score do cliente afetado.

## Solução

### 1. Criar um Database Trigger para recalcular score automaticamente

Criar uma função SQL + trigger em `client_events` que, ao inserir um novo evento, chama a Edge Function `calculate-propensity` via `pg_net` (HTTP assíncrono) apenas para o CPF do cliente afetado.

Isso garante que **qualquer evento** (ligação, WhatsApp, acordo, pagamento) dispare o recálculo automaticamente, sem depender do frontend.

```text
client_events INSERT
      ↓
pg_net.http_post → calculate-propensity({ cpf: client_cpf })
      ↓
clients.propensity_score atualizado
```

### 2. Alternativa mais leve: Trigger no frontend após eventos-chave

Nos hooks/serviços que já existem, adicionar chamada ao `calculate-propensity` com o CPF específico após:
- Criar/aprovar/cancelar acordo
- Registrar pagamento
- Receber mensagem WhatsApp (já via webhook)

Isso é complementar ao trigger SQL.

### 3. Rodar backfill inicial para os 355 CPFs com eventos

Chamar `calculate-propensity` sem filtro de CPF (como o botão da CarteiraPage já faz) para calcular o score de todos os clientes que já têm eventos. Isso preenche os scores existentes imediatamente.

## Plano de implementação

### Arquivo 1: Migration SQL — Trigger automático via `pg_net`

- Habilitar extensão `pg_net` (se não estiver ativa)
- Criar função `trigger_score_recalc()` que faz `SELECT net.http_post(...)` para a Edge Function com o CPF do evento
- Criar trigger `trg_recalc_score_on_event` em `client_events` AFTER INSERT
- Usar debounce: só disparar se não houver `score_updated_at` recente (< 5 min) para o mesmo CPF

### Arquivo 2: `src/hooks/useScoreRecalc.ts` — Hook para recálculo pontual no frontend

- Exportar função `recalcScoreForCpf(cpf: string)` que chama `supabase.functions.invoke("calculate-propensity", { body: { cpf } })`
- Usar nos fluxos de acordo e pagamento como complemento

### Arquivo 3: Integração nos fluxos existentes

- Após criar/aprovar acordo: chamar `recalcScoreForCpf`
- Após registrar pagamento: chamar `recalcScoreForCpf`

## Resultado esperado

- Scores calculados automaticamente para qualquer cliente com atividade
- Backfill imediato dos 355 CPFs que já têm eventos
- Score visível na Carteira sem necessidade de clicar botão manual

