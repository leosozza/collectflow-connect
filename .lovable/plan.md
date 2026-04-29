Plano para corrigir a Gamificação

Problemas identificados

1. Acordos no Ranking aparecem 0 porque a tela está comparando IDs diferentes:
   - `agreements.created_by` guarda o ID do usuário autenticado.
   - `operator_points.operator_id` e `campaign_participants.operator_id` usam o ID do perfil do operador.
   - A consulta atual procura acordos usando o ID do perfil, então não encontra nada.

2. A campanha mensal com métrica de valor recebido está ficando zerada porque a rotina de campanha depende de uma função que resolve o tenant pelo usuário logado. Em alguns cenários de recálculo automático/admin/cron, isso retorna 0, embora o ranking mensal já tenha valores recebidos.

3. A tela de campanhas mostra os participantes, mas não garante um recálculo confiável dos scores da campanha mensal ao abrir a aba.

Implementação proposta

1. Corrigir a contagem de acordos no Ranking
   - Atualizar `src/services/gamificationService.ts`.
   - Ao buscar os perfis dos operadores, também buscar `user_id`.
   - Montar um mapa:

```text
profile.id -> profile.user_id
profile.user_id -> profile.id
```

   - Consultar `agreements.created_by` usando os `user_id` reais dos operadores.
   - Somar o resultado de volta no card do operador usando o ID do perfil.
   - Manter a regra já solicitada: se o operador criou o acordo e ele mesmo cancelou, não entra na contagem.
   - Ajustar a leitura de `audit_logs.entity_id`, que é texto, para comparar corretamente com o UUID do acordo.

2. Corrigir a função de cálculo de campanhas no backend
   - Criar uma migração no Lovable Cloud com uma função interna tenant-aware para calcular valor recebido por operador sem depender de `auth.uid()` para descobrir o tenant.
   - Atualizar a rotina consolidada de gamificação para usar essa função em campanhas de:
     - `maior_valor_recebido`
     - `negociado_e_recebido`, quando aplicável
   - Criar/atualizar uma RPC segura para recalcular todos os participantes de uma campanha por `campaign_id`, validando que o usuário pertence ao tenant da campanha.

3. Trocar o recálculo client-side de campanhas por recálculo server-side
   - Atualizar `src/services/campaignService.ts`.
   - Fazer `recalculateCampaignScores(campaignId)` chamar a nova função do backend, em vez de recalcular tudo no navegador com queries separadas.
   - Isso deixa mensal, semanal e demais campanhas usando a mesma lógica canônica.

4. Recalcular campanhas ativas automaticamente ao abrir a aba
   - Atualizar `CampaignsTab.tsx` e/ou `CampaignCard.tsx`.
   - Quando a aba de campanhas carregar, disparar recálculo das campanhas ativas uma vez e invalidar `campaign-participants` para atualizar os cards.
   - Evitar loop infinito usando controle por campanha já recalculada na sessão da tela.

5. Corrigir detalhe visual/técnico do card
   - Ajustar `CampaignCard` para aceitar `ref` corretamente com `React.forwardRef`, eliminando o warning atual no console.

6. Melhorar atualização em tempo real do Ranking
   - Além de invalidar por alterações em `operator_points`, também invalidar o ranking quando acordos do tenant forem criados/cancelados/alterados.
   - Assim a quantidade de acordos atualiza sem depender apenas do snapshot de pontos.

Validação após implementar

- Confirmar que o Ranking mostra a quantidade real de acordos por operador no mês atual.
- Confirmar que acordos auto-cancelados pelo próprio operador não entram nessa contagem.
- Confirmar que a campanha mensal deixa de mostrar 0 quando existem valores recebidos no período.
- Confirmar que campanhas semanais/mensais continuam respeitando credores vinculados, período da campanha e participantes.
- Confirmar que o warning de `CampaignCard` com ref desaparece do console.