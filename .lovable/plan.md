## Diagnóstico

A campanha "Recebidos" tem **dois problemas** combinados:

### 1. Data de término inválida (`end_date = "42026-02-24"`)
Foi salva com 5 dígitos no ano (provável digitação acidental no input de data). Isso quebra o frontend:
```ts
const daysLeft = differenceInDays(parseISO("42026-02-24"), new Date());
// → daysLeft = NaN → isActive = false → badge "Encerrada"
```

### 2. Cálculo do score ignora o período da campanha
Em `src/hooks/useGamificationTrigger.ts` (`updateCampaignScores`), a janela usada é sempre o **mês corrente** (`monthStart`/`nextMonth`), não a janela da campanha (`start_date` → `end_date`). Pior: o trigger só roda quando o operador logado faz alguma ação no front. Se um pagamento entrou via webhook (Negociarie/portal) e ninguém abriu o app depois, o score nunca é atualizado.

Por isso os 4 operadores aparecem com 0.

---

## O que vou implementar

### A) Corrigir a data da campanha "Recebidos"
Como não há ferramenta de migration disponível agora, vou resolver isso pela própria UI: depois dos fixes abaixo, você abre a campanha em **Editar** e troca a data para `26/04/2026` (domingo). O form passará a validar e bloquear datas absurdas.

### B) Validar a data no `CampaignForm.tsx`
- Adicionar `min` (hoje) e `max` (hoje + 5 anos) no `<input type="date">` de início e fim.
- Validação JS no submit: se `Date.parse()` for NaN ou ano > 2100, abortar com toast "Data inválida".
- Garantir que `end_date >= start_date`.

### C) Corrigir cálculo do score para respeitar a janela da campanha
Em `src/hooks/useGamificationTrigger.ts`, dentro de `updateCampaignScores`:
- Buscar `start_date` e `end_date` da campanha junto com `metric` e `status`.
- Passar essa janela para `calculateCampaignScore` no lugar de `monthStart`/`nextMonth`.
- Validar a janela; se inválida, pular a campanha (sem quebrar).

### D) Botão "Recalcular Ranking" no `CampaignCard.tsx`
- Visível para usuários com permissão de admin (mesma usada no `CampaignsManagementTab`).
- Ao clicar, chama nova função `recalculateCampaignScores(campaignId)` em `campaignService.ts` que:
  1. Lê a campanha (metric + janela + tenant).
  2. Lê credores vinculados.
  3. Para cada participante, calcula o score usando a janela `[start_date, end_date]` da campanha.
  4. Faz `UPDATE` em `campaign_participants`.
  5. Retorna quantos foram atualizados; toast de sucesso.
- Após executar, invalida a query `["campaign-participants", campaignId]` para recarregar.

### E) Detecção defensiva de data inválida no `CampaignCard.tsx`
- Antes de chamar `differenceInDays`, validar que `end_date` é parseável.
- Se não for, mostrar badge "Configuração inválida" (vermelho) em vez de "Encerrada", e logar um aviso visível para o admin "Edite a campanha para corrigir as datas".

---

## Fluxo final que você terá

1. Abre **Gamificação → Campanhas → Editar "Recebidos"**.
2. Corrige a data de fim para **26/04/2026**. Salva. (Validação impede datas absurdas no futuro.)
3. Badge volta para **"Ativa"**.
4. Clica em **"Recalcular Ranking"** no card. Os valores reais da semana entram no ranking.
5. Próximas campanhas calculam corretamente em tempo real, respeitando o `period`.

---

## Arquivos a editar

- `src/services/campaignService.ts` — adicionar `recalculateCampaignScores(campaignId)`.
- `src/hooks/useGamificationTrigger.ts` — usar janela da campanha em `updateCampaignScores`.
- `src/components/gamificacao/CampaignForm.tsx` — validação de data + `min`/`max`.
- `src/components/gamificacao/CampaignCard.tsx` — botão "Recalcular Ranking" + badge defensivo.

Confirma para implementar?