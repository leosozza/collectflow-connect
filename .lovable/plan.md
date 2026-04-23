
## Revisão completa do módulo de Gamificação para produção

### Problemas críticos identificados
1. **Metas sem valor recebido/progresso para operadores**
   - `GoalsTab.tsx` depende de `operator_points.total_received`.
   - Hoje `operator_points` é atualizado no cliente via `useGamificationTrigger` / `useGamification`, mas a tabela ficou **somente admin para escrita** após o hardening de segurança.
   - Resultado: operador comum não consegue persistir seus pontos; o erro fica silencioso no `catch`, e metas ficam zeradas.

2. **Cálculo de conquistas com inconsistências**
   - `achievementTemplateService.ts` usa critério `no_breaks`, mas `useGamification.ts` verifica `zero_breaks`.
   - `agreements_count` está sendo comparado com `paymentsThisMonth`, ou seja, métrica errada.
   - `useGamificationTrigger.ts` calcula `achievementsCount` com `select(..., { head: true })` e depois usa `.length`, o que sempre zera/regrava a pontuação incorretamente.

3. **Campanhas não atualizam score**
   - `CampaignsTab` / `CampaignForm` usam status `ativa`.
   - `useGamificationTrigger.ts` filtra campanhas com `.eq("status", "active")`.
   - Isso impede atualização dos placares das campanhas.

4. **Filtros defensivos multi-tenant incompletos**
   - Vários serviços do módulo não aplicam `.eq("tenant_id", tenantId)` no cliente, contrariando a regra do projeto.
   - Afeta `fetchRanking`, `fetchMyPoints`, `fetchMyAchievements`, produtos da loja, configs de ranking e outras leituras.

5. **Fluxos secundários com pendências de produção**
   - `PointsHistoryTab.tsx` existe, mas não está exposto na página.
   - `ShopTab.tsx` tenta inserir notificação direto em `notifications`, mas a política existente não permite esse insert do jeito atual.
   - `fetchProducts()` e `fetchRankingConfigs()` ignoram o `tenant_id` recebido.
   - Gestão de participantes mostra perfis além dos operadores elegíveis para gamificação.

---

## O que será ajustado

### 1) Tornar a atualização da gamificação segura e funcional
Criar uma camada backend para recalcular a fotografia do mês, sem reabrir escrita direta em `operator_points`.

#### Banco / backend
Criar migration com funções `SECURITY DEFINER`:
- `recalculate_my_gamification_snapshot(_year int, _month int)`
- `recalculate_operator_gamification_snapshot(_operator_profile_id uuid, _year int, _month int)` para uso admin
- opcionalmente `recalculate_tenant_gamification_snapshot(_year int, _month int)` para atualizar todos os participantes ao abrir telas admin

Essas funções vão:
- resolver `tenant_id` e `profile_id` do usuário autenticado com segurança
- calcular:
  - pagamentos do mês
  - valor recebido do mês
  - acordos do mês
  - quebras do mês
  - conquistas do operador
  - meta atingida
- fazer `upsert` em `operator_points` no backend

Isso mantém a política restritiva da tabela e elimina o bug atual dos operadores.

### 2) Corrigir a aba Metas
#### `src/components/gamificacao/GoalsTab.tsx`
- Operador:
  - antes de buscar dados, chamar a RPC de recálculo do mês
  - usar os dados atualizados de `operator_points`
- Admin:
  - recalcular os snapshots do período ao abrir a aba
  - montar a tabela com `meta`, `recebido` e `progresso` corretos por operador
- manter o gauge e a tabela com o mesmo visual atual

### 3) Corrigir a lógica de conquistas
#### `src/hooks/useGamification.ts`
- alinhar critérios:
  - trocar `zero_breaks` para `no_breaks` (ou padronizar ambos num único valor)
- adicionar `agreementsThisMonth` ao contexto e usar essa métrica corretamente
- impedir dupla gravação conflitante de pontos

#### `src/hooks/useGamificationTrigger.ts`
- remover cálculo duplicado local que sobrescreve pontuação correta
- substituir `upsertOperatorPoints(...)` direto por chamada da nova RPC
- corrigir contagem de conquistas
- corrigir atualização de campanhas para status `ativa`

### 4) Corrigir campanhas
#### Arquivos:
- `src/hooks/useGamificationTrigger.ts`
- `src/services/campaignService.ts`
- `src/components/gamificacao/CampaignsTab.tsx`
- `src/components/gamificacao/CampaignsManagementTab.tsx`

Ajustes:
- unificar status em português (`ativa`, `rascunho`, `encerrada`)
- recalcular score dos participantes quando o snapshot do operador for atualizado
- manter ranking da campanha coerente com a métrica escolhida

### 5) Revisão de consistência multi-tenant
Adicionar filtros explícitos por `tenant_id` nas leituras do módulo:
- `src/services/gamificationService.ts`
- `src/services/goalService.ts`
- `src/services/campaignService.ts`
- `src/services/rivocoinService.ts`
- `src/services/shopService.ts`
- `src/services/rankingConfigService.ts`

Objetivo:
- alinhar com a regra do projeto
- reduzir risco de leituras amplas
- deixar o comportamento previsível em produção

### 6) Fechar lacunas de UX e operação
#### `src/pages/GamificacaoPage.tsx`
- expor o `PointsHistoryTab` como aba visível
- revisar estados de carregamento/vazio/erro nas abas principais

#### `src/components/gamificacao/ParticipantsManagementTab.tsx`
- listar apenas perfis elegíveis para gamificação (operador/supervisor/gerente, conforme regra adotada)
- evitar admins no controle de participação, se essa for a regra de negócio

#### `src/components/gamificacao/ShopTab.tsx`
- trocar insert direto em `notifications` por RPC segura existente (`create_notification`) ou ajustar fluxo equivalente
- garantir feedback confiável na compra

#### `src/services/shopService.ts`
- filtrar produtos e pedidos por tenant explicitamente

---

## Arquivos que devem ser alterados
- `src/hooks/useGamification.ts`
- `src/hooks/useGamificationTrigger.ts`
- `src/services/gamificationService.ts`
- `src/services/goalService.ts`
- `src/services/campaignService.ts`
- `src/services/shopService.ts`
- `src/services/rankingConfigService.ts`
- `src/services/rivocoinService.ts`
- `src/components/gamificacao/GoalsTab.tsx`
- `src/components/gamificacao/CampaignsTab.tsx`
- `src/components/gamificacao/CampaignsManagementTab.tsx`
- `src/components/gamificacao/ParticipantsManagementTab.tsx`
- `src/components/gamificacao/ShopTab.tsx`
- `src/pages/GamificacaoPage.tsx`
- nova migration SQL para RPCs/funções seguras de recálculo

---

## Resultado esperado após a revisão
- operador volta a ver **valor recebido** e **progresso da meta** corretamente
- admin vê a tabela de metas com números confiáveis
- conquistas passam a ser liberadas com os critérios corretos
- campanhas voltam a atualizar score
- ranking e histórico ficam coerentes com os dados do mês
- loja, notificações e demais abas do módulo ficam prontas para produção com segurança e isolamento por empresa

## Detalhes técnicos
```text
Fonte de verdade sugerida para snapshot mensal:
- recebido: clients.valor_pago com data_quitacao no mês
- pagamentos: quantidade de registros quitados válidos no mês
- acordos: agreements criados pelo operador no mês
- quebras: agreements cancelados no mês
- meta: operator_goals.target_amount
- conquistas: achievements do profile
- snapshot persistido: operator_points (via RPC segura)
```
