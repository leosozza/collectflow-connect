## Objetivo

Adicionar uma nova métrica de campanha: **"Negociado e Recebido na janela"** (`negociado_e_recebido`).

Diferente de `maior_valor_recebido` (que conta qualquer pagamento na semana, mesmo de acordos antigos), essa nova métrica só pontua o operador quando o **acordo foi criado E quitado dentro da janela da campanha**, e credita quem **fechou o acordo** (`agreements.created_by`), não o dono da carteira.

## Como funciona

Para cada operador participante:
1. Buscar `agreements` com `created_by = operador`, `created_at` dentro da janela `[start_date, end_date+1)` da campanha, filtro opcional por credor.
2. Para cada acordo, somar pagamentos efetivamente recebidos (`agreement_installments.status = 'paid'` com `paid_at` também dentro da mesma janela).
3. Score = soma dos valores pagos.

Resultado: só conta dinheiro de acordos **negociados na semana E pagos na semana** pelo mesmo operador.

## Mudanças

### 1. UI — adicionar opção no seletor de métrica
`src/services/campaignService.ts` → `METRIC_OPTIONS`:
- Adicionar `{ value: "negociado_e_recebido", label: "Negociado e recebido na janela" }`

### 2. Cálculo de score (2 lugares — mesma lógica)
`src/services/campaignService.ts` → função `computeCampaignScore` (usada no botão "Recalcular Ranking")
`src/hooks/useGamificationTrigger.ts` → função `calculateCampaignScore` (usada em tempo real após confirmação de pagamento)

Adicionar novo `case "negociado_e_recebido"`:
```ts
// 1. Acordos criados pelo operador na janela
let aq = supabase
  .from("agreements")
  .select("id")
  .eq("tenant_id", tenantId)
  .eq("created_by", authUid)
  .neq("status", "rejected")
  .neq("status", "cancelled")
  .gte("created_at", startDate)
  .lt("created_at", endExclusiveStr);
if (credorNames) aq = aq.in("credor", credorNames);
const { data: ags } = await aq;
if (!ags?.length) return 0;

// 2. Parcelas pagas desses acordos dentro da mesma janela
const ids = ags.map(a => a.id);
const { data: paid } = await supabase
  .from("agreement_installments")
  .select("amount, paid_at")
  .in("agreement_id", ids)
  .eq("status", "paid")
  .gte("paid_at", startDate)
  .lt("paid_at", endExclusiveStr);

return (paid || []).reduce((s, i) => s + Number(i.amount || 0), 0);
```

(Se a coluna for `paid_amount` em vez de `amount`, ajustar — verificar no momento da implementação.)

## Notas

- Métrica complementa `maior_valor_recebido` (esta continua existindo, sem mudança).
- Credita o **operador que fechou o acordo** (`agreements.created_by`), conforme a regra que você descreveu.
- Filtro de credor já é respeitado via `credorNames`.
- Botão "Recalcular Ranking" já existente funcionará automaticamente com a nova métrica.
- Nenhuma migração de banco é necessária — `metric` é coluna texto livre.
