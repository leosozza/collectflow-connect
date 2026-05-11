## Objetivo

Garantir que o ranking das campanhas reflita a configuração atual, mesmo após edições e em campanhas encerradas.

---

## 1. Auto-recálculo ao editar campanha

Em `src/components/gamificacao/CampaignsManagementTab.tsx`, no `saveMut.mutationFn`:

- Após `updateCampaign(editing.id, data)` e antes de salvar credores/participantes, comparar campos sensíveis:
  - `metric`, `start_date`, `end_date`, `end_time`
- Também detectar mudança no conjunto de credores (`credorIds` vs. `editing.credores`).
- Se algum mudou, marcar `shouldRecalc = true`.
- Após `saveCampaignCredores` e `saveCampaignParticipants`, se `shouldRecalc`, chamar `await recalculateCampaignScores(campaignId)`.
- Toast diferenciado: "Campanha atualizada e ranking recalculado" vs. "Campanha atualizada".
- Invalidar também `["campaign-participants"]` (já feito).

Para criação nova, não precisa recalcular (não há participantes/score ainda).

---

## 2. Botão manual "Recalcular ranking" no card (admin)

Em `src/components/gamificacao/CampaignCard.tsx`:

- Importar `RefreshCw` do lucide e `recalculateCampaignScores` do service.
- Adicionar estado local `recalculating`.
- Adicionar handler `handleRecalculate` que chama `recalculateCampaignScores(campaign.id)`, invalida `["campaigns", tenant?.id]` e `["campaign-participants", campaign.id]`, com toast de sucesso/erro.
- Renderizar botão `outline` `size="sm"` discreto:
  - Visível apenas quando `isTenantAdmin`
  - Posicionado no `CardContent`, abaixo do ranking, antes do botão "Mover para encerradas" (ou ao lado dele em flex quando ambos existem)
  - Texto: "Recalcular ranking", ícone `RefreshCw` (spin enquanto `recalculating`)

Funciona em campanhas ativas, expiradas-aguardando-arquivamento e encerradas (o RPC já permite — não restringe por status, só por `can_access_tenant`).

---

## Fora do escopo

- Mudar comportamento do cron de backend.
- Recalcular automaticamente todas as encerradas históricas (admin pode usar o botão manual).
- Logs de auditoria do recálculo manual.
