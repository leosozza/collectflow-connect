

# Correção do Módulo de Gamificação — Métricas, Filtros por Credor e Persistência

## Problemas Identificados

1. **`maior_valor_promessas`** usa `totalReceived` em vez da soma de `proposed_total` de acordos ativos
2. **`menor_valor_quebra`** usa contagem de quebras em vez do valor monetário real
3. **`menor_taxa_quebra`** retorna score 0 para operadores sem acordos (deveria ser 100)
4. **Sem filtro por credor** — campanhas com credores vinculados ignoram esse filtro
5. **`upsertOperatorPoints` nunca é chamado** — o ranking global não é atualizado
6. **Gamificação depende de entrada na página** — não há trigger automático em pagamentos/acordos

## Dados Relevantes

- `agreements.credor` e `clients.credor` são **strings** (razao_social), não FKs
- `campaign_credores` referencia `credores.id` (UUID)
- Para filtrar por credor da campanha, preciso buscar `razao_social` dos credores vinculados e filtrar por string

## Solução

### 1. Arquivo: `src/hooks/useGamificationTrigger.ts`

**a) Corrigir `updateCampaignScores` — buscar dados reais por métrica e filtrar por credor**

Refatorar `updateCampaignScores` para:
- Buscar os credores vinculados à campanha (`campaign_credores` → `credores.razao_social`)
- Quando houver credores, filtrar queries de `agreements` e `clients` por `.in("credor", credorNames)`
- Para cada métrica, buscar dados reais:
  - **`maior_valor_promessas`**: `SUM(proposed_total)` de agreements com status `pending` ou `approved`
  - **`menor_valor_quebra`**: `SUM(proposed_total)` de agreements com status `cancelled`
  - **`menor_taxa_quebra`**: Se não há acordos, score = 100 (performance perfeita inicial)
  - **`maior_valor_recebido`** e **`maior_qtd_acordos`**: filtrar por credores quando aplicável

**b) Chamar `upsertOperatorPoints` ao final de `triggerGamificationUpdate`**

Após calcular todas as métricas e achievements, chamar:
```typescript
await upsertOperatorPoints({
  tenant_id, operator_id: profileId,
  year, month, points: calculatedPoints,
  payments_count, breaks_count, total_received
});
```

### 2. Trigger automático em pagamentos e acordos

Nos locais onde já existe `triggerGamificationUpdate()`:
- `AgreementForm.tsx` (ao fechar acordo) — ✅ já existe
- `ClientsPage.tsx` (ao registrar pagamento) — ✅ já existe

Esses triggers já estão implementados. O problema real era que `upsertOperatorPoints` não era chamado, então os pontos nunca persistiam. Corrigir isso resolve a questão.

### 3. Arquivo: `src/components/gamificacao/CampaignForm.tsx`

O formulário já salva credores corretamente via `saveCampaignCredores` no `CampaignsManagementTab.tsx`. Nenhuma alteração necessária aqui.

## Arquivos alterados
- `src/hooks/useGamificationTrigger.ts` — refatoração principal (métricas reais, filtro por credor, persistência de pontos)

## Resultado
- Rankings refletem valores financeiros reais
- Campanhas com credores vinculados filtram apenas registros desses credores
- Pontos são persistidos no `operator_points` a cada trigger
- Operadores sem acordos começam com 100% de performance

