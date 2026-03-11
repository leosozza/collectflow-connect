

# Diagnóstico: Lógica de Status dos Acordos

## Problema encontrado

A lógica de transição de status dos acordos tem **duas falhas críticas**:

### 1. A Edge Function `auto-expire-agreements` nunca é executada automaticamente

Não existe nenhum cron job configurado no `config.toml` para disparar esta função. Ela só rodaria se alguém a chamasse manualmente.

### 2. A lógica de "vencido" é incorreta

A função verifica apenas `first_due_date < ontem` para marcar como overdue. Isso tem dois problemas:

- **Ignora a entrada**: Se o acordo tem `entrada_date = 10/03` e `first_due_date = 10/04`, a função só vai considerar o vencimento a partir de 10/04, ignorando que a entrada de 10/03 já passou.
- **Compara apenas a primeira parcela**: Um acordo com 5 parcelas (10/04 a 10/08) seria marcado como "vencido" assim que a primeira parcela vence, mesmo que as outras estejam em dia.
- **Não verifica se a parcela foi paga**: Marca como vencido mesmo se o pagamento já foi feito.

### Caso do Alexandre dos Santos

O acordo dele tem `entrada_date = 10/03` e `first_due_date = 10/04`. Hoje é 11/03.

- A edge function não roda (sem cron)
- Mesmo se rodasse, checaria `first_due_date (10/04) < ontem (10/03)` → FALSE → não marcaria como overdue
- A entrada de 10/03 já passou, mas não é verificada

## Plano de correção

### 1. Corrigir a Edge Function `auto-expire-agreements`

A lógica correta para marcar um acordo como "vencido":
- Calcular a **última parcela** do acordo: `first_due_date + (new_installments - 1) meses`
- Considerar a `entrada_date` quando existir
- Verificar se a parcela vencida **não foi paga** (cruzar com `clients.valor_pago`)
- Um acordo é "overdue" quando **qualquer parcela não paga** tem data anterior a hoje

Nova lógica SQL na edge function:
```text
-- Acordo é overdue quando:
-- 1. Tem entrada não paga com entrada_date < hoje
-- 2. OU tem parcela regular não paga com vencimento < hoje
-- Parcela não paga = valor_pago acumulado dos títulos em_acordo < soma das parcelas até aquela data
```

Simplificação pragmática: marcar como overdue quando `MIN(data_vencimento_nao_paga) < hoje`, onde a data mínima não paga é calculada a partir da entrada e parcelas virtuais, cruzando com o `valor_pago` acumulado.

### 2. Adicionar cron job no config.toml

```toml
# Não é possível via config.toml — precisa ser via pg_cron no banco
```

Como o Lovable Cloud não suporta cron no config.toml, a alternativa é criar um **pg_cron** via migration SQL:

```sql
SELECT cron.schedule(
  'auto-expire-agreements',
  '0 6 * * *',  -- todo dia às 6h
  $$ SELECT net.http_post(
    url := '...',
    ...
  ) $$
);
```

Ou, como alternativa mais simples: **executar a verificação no frontend** ao carregar a página de acordos, chamando a edge function uma vez.

### 3. Verificação no frontend como fallback

No `AcordosPage.tsx`, ao carregar os acordos, fazer uma chamada à edge function `auto-expire-agreements` para garantir que os status estejam atualizados antes de exibir.

## Arquivos a editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/auto-expire-agreements/index.ts` | Corrigir lógica: considerar entrada + parcelas virtuais + pagamentos |
| Migration SQL | Agendar cron via pg_cron OU |
| `src/pages/AcordosPage.tsx` | Chamar edge function ao carregar como fallback |

## Resultado esperado
- Acordos com parcelas vencidas e não pagas são marcados como "Vencido"
- Acordos com todas as parcelas pagas permanecem como "Vigente" ou são marcados como "Pago"
- A verificação roda automaticamente (cron) e sob demanda (ao abrir a página)

