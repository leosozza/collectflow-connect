## Objetivo

Três ajustes em Gamificação → Campanhas:

1. **Bug**: na aba **Gerenciar → Campanhas**, campanhas ativas aparecem em "Campanhas encerradas" sem terem sido arquivadas.
2. **UX**: mostrar o **período (de–até) da campanha** de forma discreta no card, sem aumentar o tamanho.
3. **Nova métrica**: **"Maior valor de Primeira parcela"** — para cada acordo, soma apenas o **primeiro valor a receber**: se houver entrada, conta a entrada; se não houver entrada, conta a primeira parcela. Conta valor **negociado** (não recebido).

---

## 1. Bug: campanhas movidas indevidamente para "encerradas" no Gerenciar

**Causa**: `CampaignsManagementTab.tsx` separa ativas/encerradas usando `isCampaignActive`, que considera "ativa" apenas quando `status='ativa'` **e** `end_date` ainda no futuro. Campanhas com data fim passada mas ainda não arquivadas pelo admin caem em "encerradas".

Na aba pública (`CampaignsTab`) já existe o helper correto: `isCampaignVisibleInActive` (inclui as "expiradas aguardando arquivamento").

**Correção**: em `src/components/gamificacao/CampaignsManagementTab.tsx`:
- Trocar o filtro de `activeCampaigns` para `isCampaignVisibleInActive`.
- Trocar `otherCampaigns` para o complemento (`!isCampaignVisibleInActive`).
- Passar a prop `expired={isCampaignExpiredButNotArchived(c)}` no `CampaignCard` da seção ativas, para o admin ver o banner vermelho + botão "Mover para encerradas" (mesmo comportamento da aba pública).

Resultado: só vão para o bloco "Campanhas encerradas" as que o admin arquivou manualmente (`status='encerrada'`).

---

## 2. Mostrar período discreto no card

Em `src/components/gamificacao/CampaignCard.tsx`, dentro do `CardHeader`, abaixo da linha de badges `metricLabel`/`periodLabel` (linha ~139), adicionar uma linha de texto pequeno:

```
DD/MM/AAAA → DD/MM/AAAA
```

Detalhes visuais:
- `text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1`
- Ícone `Calendar` (lucide) `w-3 h-3` à esquerda
- Formato `pt-BR` reutilizando o helper `formatBR` que já existe no arquivo
- Sem fundo, sem badge, sem padding extra — não muda a altura do card

Renderiza só quando `datesValid` for verdadeiro.

---

## 3. Nova métrica: "Maior valor de Primeira parcela"

### Regra de cálculo

Para cada acordo do operador no período (mesma janela e filtros das outras métricas de "negociado": status `pending`/`approved`, filtro por credores da campanha):

- Se `entrada_value > 0` → soma `entrada_value`
- Caso contrário → soma o valor da primeira parcela:
  - Preferência: `custom_installment_values[0]` (regra já adotada no projeto — ver memória `Value Priorities`)
  - Fallback: `new_installment_value`

Score do operador = soma desse "primeiro valor" em todos os acordos dele na janela.

### Implementação

**Frontend** — `src/services/campaignService.ts`:
- Adicionar opção em `METRIC_OPTIONS`:
  ```ts
  { value: "maior_valor_primeira_parcela", label: "Maior valor de primeira parcela" }
  ```
- Estender `computeCampaignScoreFallback` com bloco para a nova métrica, lendo `entrada_value`, `custom_installment_values`, `new_installment_value` dos acordos do operador, mesmos filtros de `maior_valor_promessas`.

**Backend** — migration SQL atualizando o RPC `recalculate_campaign_scores` (e o usado por `close_campaign_and_award_points`, se aplicar a mesma lógica) com um novo branch `ELSIF _campaign.metric = 'maior_valor_primeira_parcela' THEN`:

```sql
SELECT COALESCE(SUM(
  CASE
    WHEN COALESCE(a.entrada_value, 0) > 0 THEN a.entrada_value
    WHEN jsonb_typeof(a.custom_installment_values) = 'array'
         AND jsonb_array_length(a.custom_installment_values) > 0
      THEN COALESCE((a.custom_installment_values->>0)::numeric, a.new_installment_value, 0)
    ELSE COALESCE(a.new_installment_value, 0)
  END
), 0) INTO _score
FROM public.agreements a
WHERE a.tenant_id = _campaign.tenant_id
  AND a.created_by = _auth_uid
  AND a.status IN ('pending','approved')
  AND a.created_at >= _campaign.start_date::timestamptz
  AND a.created_at < (_campaign.end_date + 1)::timestamptz
  AND (_credor_names IS NULL OR a.credor = ANY(_credor_names));
```

Sem mudanças no schema; o RPC continua `SECURITY DEFINER` com o mesmo guard `can_access_tenant`.

### Form e card

O `CampaignForm` já popula o select de métrica a partir de `METRIC_OPTIONS`, então a nova opção aparece automaticamente. O `CampaignCard` também já resolve o label via `METRIC_OPTIONS.find(...)`. Nenhuma mudança extra nesses componentes.

---

## Fora do escopo

- Retroagir scores de campanhas já criadas (admin pode clicar em editar/salvar para forçar recálculo se quiser).
- Mudar layout/estrutura geral do card além da linha de período.
- Alterar comportamento de `close_campaign_and_award_points` para premiação (apenas adiciono o branch da nova métrica se ele também calcular o score; caso contrário só `recalculate_campaign_scores` é tocado).
