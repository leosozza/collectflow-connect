
# Ajustes Visão 360 + cancelamento manual

## 1. Colchão — manter cancelados dentro do mês corrente

A regra do colchão hoje exclui qualquer acordo `cancelled` ou `rejected`. Como o usuário quer que cancelamentos feitos **dentro do mês corrente** continuem no colchão (só somem na virada do mês), ajustar a RPC `public.get_dashboard_stats`:

- **Mês corrente** (`_is_current_month = true`): incluir acordo se `status NOT IN ('cancelled','rejected') OR updated_at::date >= _month_start`. Ou seja, o cancelamento do mês não tira do colchão.
- **Meses passados/futuros**: manter `status NOT IN ('cancelled','rejected')` (foto definitiva já consolidada).

Aplicar nos 2 ramos do bloco do colchão (entrada + parcelas mensais). Demais métricas ficam como estão.

## 2. Renomear "Quebra" → "Cancelados"

Apenas troca de label visual (variáveis SQL/props ficam como `quebra` para não cascatear refactor):

- `src/components/dashboard/Visao360Card.tsx` linha 65: `label: "Quebra"` → `label: "Cancelados"`.
- `src/components/dashboard/CustomizeDashboardDialog.tsx` linha 43: trocar texto "...e Quebra..." por "...e Cancelados...".
- `src/pages/ClientDetailPage.tsx` linha 52: badge label `cancelled: "Quebra de Acordo"` → `"Cancelado"`.
- `src/pages/AcordosPage.tsx` linha 148: toast "Acordo cancelado. Parcelas marcadas como quebra." → "Acordo cancelado."

## 3. Operador não cancela mais — só Admin/Sistema. Operador ganha "Editar"

Em `src/pages/ClientDetailPage.tsx`:

- Importar `useTenant` e usar `isTenantAdmin`.
- Linha 719: condicionar o botão "Cancelar Acordo" para `cancellableStatuses.includes(...) && isTenantAdmin`.
- Garantir o botão "Editar" disponível para todos os perfis (operador inclusive) usando o handler de edição já existente. Verificar se `editableStatuses` já está em uso e expor o botão também para operador (hoje já não tem trava de role, então só confirmar).
- Em `src/pages/AcordosPage.tsx`: a função `handleCancel` está definida mas não há botão na UI. Não mexer (dead code, sem risco).

Cancelamento automático pelo sistema (`auto_expired`) continua funcionando normalmente — não muda nada no backend de cancelamento.

## Riscos / efeitos

- Colchão do mês corrente pode subir um pouco (cancelados do mês voltam).
- Operador perde a ação destrutiva no detalhe do cliente; admin segue com acesso total.
- Mudança de label não afeta cálculos.
