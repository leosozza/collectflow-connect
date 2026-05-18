---
name: Dashboard Value Prioritization
description: Fórmula canônica do "Provisionado no Mês" — entrada (custom_installment_values->>'entrada' || entrada_value) com fallback para 1ª parcela (custom_installment_values->>'1' || new_installment_value), por agreements.created_at. Aplicada no Dashboard (get_dashboard_stats._negociado) E no gráfico Analytics "Projeção por Mês" (get_bi_projected_by_day). Manter os dois sincronizados — qualquer mudança aqui exige update em ambos.
type: feature
---

## Regra (SSOT do "Provisionado")

Para cada `agreements` criado no período (`created_at::date`), somar UMA parcela:

```sql
CASE WHEN a.entrada_value > 0
  THEN COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value)
  ELSE COALESCE((a.custom_installment_values->>'1')::numeric, a.new_installment_value)
END
```

Filtros padrão: `tenant_id`, `status <> 'cancelled'`, opcionalmente `credor`/`created_by`.

## Onde é usada

- `get_dashboard_stats` / `get_dashboard_stats_v2` → bloco `_negociado` → card "Provisionado no Mês" (Visao360Card).
- `get_bi_projected_by_day` → série diária acumulada → gráfico "Projeção por Mês" (RevenueTab).

## Validação

Soma de todos os pontos diários do mês corrente no gráfico de Projeção (linha azul até hoje) DEVE bater com o valor de "Provisionado no Mês" do Dashboard, com filtros equivalentes.

## Anti-regressão

NÃO usar `agreement_installments.is_entrada` isoladamente nessa métrica — isso exclui acordos sem entrada (parcelamento puro) e quebra a paridade.
