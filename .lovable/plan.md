## Reverter as 3 campanhas da semana passada para status `ativa`

Identifiquei 3 campanhas que terminaram na sexta-feira passada (08/05/2026) e foram auto-encerradas pelo cron (`status='encerrada'`, `auto_closed_at` preenchido). Elas pertencem ao tenant `39a450f8…7a40`:

| ID | Título | Fim |
|----|--------|-----|
| `2a3fe169…` | PROMESSA - Semana 1 | 2026-05-08 16:50 |
| `832a4cd9…` | NEGOCIADO/RECEBIDO - Semana 1 | 2026-05-08 16:50 |
| `0dbc94e7…` | ACORDOS - Semana 1 | 2026-05-08 16:50 |

Como agora o status `'encerrada'` joga a campanha direto para o colapsável "Campanhas encerradas", elas não aparecem mais junto das ativas com o banner vermelho + botão "Mover para encerradas".

### Ação

Atualizar essas 3 campanhas no banco:

- `status` → `'ativa'`
- `auto_closed_at` → `NULL`

Com isso, a lógica de UI `isCampaignExpiredButNotArchived` (status=ativa e end_date < hoje) volta a reconhecê-las e elas aparecerão na seção **Campanhas Ativas** com:
- Banner **"CAMPANHA ENCERRADA"** vermelho pulsante
- Bloco dourado com o vencedor (1º colocado)
- Botão **"Mover para encerradas"** visível apenas para admin

### Observação sobre re-fechamento automático

Existe um cron de auto-encerramento de campanhas vencidas. Para evitar que ele feche essas 3 novamente nos próximos minutos, vou **manter os participantes e scores intactos** (não vou regravar pontos). A premiação via `close_campaign_and_award_points` já foi feita uma vez em 08/05 — não rodaremos de novo.

Se o cron rodar e fechar de novo automaticamente, o admin perde a janela de arquivamento manual. Por isso recomendo uma das duas opções abaixo — preciso da sua confirmação:

**Opção A (recomendada):** Apenas reverter o status agora. Se o cron fechar novamente, repetimos. Ajuste do cron fica para depois.

**Opção B:** Reverter status + ajustar o cron `gamification-recalc-tick` (ou equivalente) para **não** auto-encerrar enquanto a campanha já tiver sido fechada uma vez (`auto_closed_at` preserva o histórico). Isso exige mexer em edge function.

### Arquivos afetados

Apenas mudança de dados via SQL UPDATE. Nenhum arquivo do projeto é editado.

```sql
UPDATE public.gamification_campaigns
SET status = 'ativa', auto_closed_at = NULL, updated_at = now()
WHERE id IN (
  '2a3fe169-45ba-44dc-9d04-c2f6977ef21d',
  '832a4cd9-b3cb-4b23-be8a-4ac67ae1c3fe',
  '0dbc94e7-47f4-4543-b117-05deac0677d6'
);
```

Confirme se quer **Opção A** (mais simples, rápido) ou **B** (mais robusto, mexe no cron) para eu executar.
