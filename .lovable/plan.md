## Diagnóstico

Investiguei o banco e descobri o motivo real: o cron `gamification-campaign-closer` está re-fechando as campanhas alguns segundos depois de eu setá-las como `ativa`.

Estado atual no banco (tenant `39a450f8-…-7a40`):

| Campanha | end_date | status atual | auto_closed_at |
|---|---|---|---|
| ACORDOS – Semana 1 | 2026-05-08 16:50 | **encerrada** | 2026-05-11 13:00:07 |
| PROMESSA – Semana 1 | 2026-05-08 16:50 | **encerrada** | 2026-05-11 13:00:07 |
| NEGOCIADO/RECEBIDO – Semana 1 | 2026-05-08 16:50 | ativa | 2026-05-11 13:00:06 |

O closer roda com filtro `status='ativa' AND auto_closed_at IS NULL`. Como o UPDATE anterior limpou `auto_closed_at = NULL`, o cron pegou as campanhas e fechou de novo (apenas a NEGOCIADO/RECEBIDO sobreviveu por coincidência de timing).

## Plano (somente dados — sem alteração de schema/código)

Reabrir as 3 campanhas mantendo `auto_closed_at` preenchido. Assim o cron NÃO vai reprocessá-las (o filtro `auto_closed_at IS NULL` exclui), mas a UI as exibe na seção "Campanhas Ativas" com o banner "CAMPANHA ENCERRADA" e o botão admin "Mover para encerradas" (já implementados anteriormente), porque a regra `isCampaignExpiredButNotArchived` só checa `status='ativa' && end_date<hoje`.

```sql
UPDATE public.gamification_campaigns
SET status = 'ativa',
    updated_at = now()
WHERE id IN (
  '0dbc94e7-47f4-4543-b117-05deac0677d6', -- ACORDOS - Semana 1
  '2a3fe169-45ba-44dc-9d04-c2f6977ef21d', -- PROMESSA - Semana 1
  '832a4cd9-b3cb-4b23-be8a-4ac67ae1c3fe'  -- NEGOCIADO/RECEBIDO - Semana 1 (idempotente)
)
AND tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7';
```

Diferença para a tentativa anterior: **não** zero o `auto_closed_at`. É essa coluna que serve de "memória" para o cron não tocar mais nessas campanhas.

## Resultado esperado

- As 3 campanhas voltam para "Campanhas Ativas" com banner vermelho/laranja "CAMPANHA ENCERRADA", bloco dourado de Vencedor e botão admin "Mover para encerradas".
- O cron `gamification-campaign-closer` (que roda a cada poucos minutos) as ignora — não vão "voltar para encerradas" sozinhas.
- Quando o admin clicar em "Mover para encerradas", `updateCampaign` seta `status='encerrada'` e elas migram para a seção colapsada.

## Opcional (não incluído nesta etapa)

Adicionar uma proteção extra em `gamification-campaign-closer` para tratar `auto_closed_at IS NOT NULL` como "não tocar mais" de forma explícita, mesmo que `status='ativa'`. Hoje já funciona pelo filtro, mas posso reforçar com um comentário no edge function caso prefira. Me avise se quiser.