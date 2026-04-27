## Objetivo

Executar o recálculo de pontuação de todos os operadores do tenant para o mês vigente (Abril/2026) com base nas novas regras de pontuação que você acabou de salvar, e auditar o resultado para garantir que os novos pesos foram aplicados corretamente.

## Como funciona o recálculo (já implementado)

A RPC `recalculate_tenant_gamification_snapshot(year, month)` já existe e:
1. Valida se o usuário é admin do tenant.
2. Itera sobre todos os participantes habilitados em `gamification_participants` (fallback: todos os perfis do tenant).
3. Para cada operador, chama `recalculate_operator_gamification_snapshot`, que:
   - Lê as regras vigentes em `gamification_scoring_rules` (já com seus novos pesos).
   - Recalcula `payments_count`, `total_received`, `breaks_count`, `achievements_count` e verifica `goal_reached` no período do mês.
   - Aplica os pesos das regras e regrava o snapshot em `operator_points`.

Ou seja: nenhuma migração nova é necessária. Basta acionar a RPC e validar a saída.

## Etapas

1. **Snapshot ANTES do recálculo**
   Consultar `operator_points` (Abril/2026) e `gamification_scoring_rules` para registrar o estado atual dos pontos por operador e os pesos vigentes.

2. **Executar o recálculo do tenant**
   Chamar `recalculate_tenant_gamification_snapshot(2026, 4)` via SQL com o seu usuário/tenant. Isso reaplica as novas regras a todos os operadores ativos.

3. **Snapshot DEPOIS + verificação aritmética**
   - Reconsultar `operator_points` para o mesmo período.
   - Para cada operador, verificar manualmente que:
     `points = (payments_count × peso_payment_count)
            + floor(total_received / unit_size_total_received) × peso_total_received
            + (breaks_count × peso_agreement_break)
            + (achievements_count × peso_achievement_unlocked)
            + (goal_reached ? peso_goal_reached : 0)`
   - Sinalizar qualquer divergência entre o valor calculado e o gravado.

4. **Relatório de auditoria**
   Apresentar uma tabela comparativa (operador → pontos antes → pontos depois → delta) e uma confirmação explícita de quantos snapshots foram regravados, com a lista de regras aplicadas para você conferir contra o que configurou na tela.

5. **Atualização do Ranking**
   O Ranking (aba "Ranking" em `/gamificacao`) lê diretamente de `operator_points`, então após o recálculo já reflete os novos valores — basta abrir/atualizar a aba para conferir visualmente.

## Entrega

- Tabela de auditoria (antes/depois/delta) por operador no chat.
- Confirmação dos pesos vigentes utilizados.
- Lista de divergências (idealmente vazia) entre o cálculo esperado e o gravado.
- Caso encontre alguma anomalia na RPC, registro o ponto e proponho correção em migração separada (não incluída neste plano).

## Observação

Esta operação só altera a tabela `operator_points` (snapshot do mês). Não mexe em acordos, pagamentos, conquistas ou Rivo Coins — Rivo Coins só são creditados na virada do mês conforme a nova lógica aprovada anteriormente.