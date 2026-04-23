

## Revisão geral do módulo Gamificação — pós-atualização

### Status: Funcional e pronto para produção, com 3 ajustes finos recomendados

### O que está funcionando corretamente

| Item | Status | Observação |
|---|---|---|
| Tabela `gamification_scoring_rules` criada | ✅ | 7 regras seedadas para todos os tenants existentes |
| RLS isolando por tenant + admin-only para escrita | ✅ | Validado |
| Seed automático para novos tenants (trigger) | ✅ | |
| RPC `recalculate_operator_gamification_snapshot` lendo regras dinâmicas | ✅ | Inclui nova métrica `agreement_paid` |
| Aba "Pontuação" visível só para admin em /gamificacao?tab=manage | ✅ | |
| Cálculo de pagamentos via `client_events` + `agreements.created_by` | ✅ | Bate com Dashboard |
| Goals tab recalcula ao abrir | ✅ | |
| Recalcular mês atual após editar regra | ✅ | Botão funcionando |

**Validação no banco (tenant 39a450f8…, abr/2026):**
Vitor: 139 pagamentos × 10 + floor(38131/100) × 5 − 24 quebras × 3 = **3.223 pts** ✓ confere com `operator_points.points`.

### Ajustes recomendados (pequenos, não-bloqueantes)

**1. Corrigir warning de `forwardRef` no console**
`src/components/ui/badge.tsx` é um function component sem `React.forwardRef`. Quando a Tabela em `AchievementsManagementTab` é animada/wrappa, React reclama. Solução: converter `Badge` para `React.forwardRef<HTMLDivElement, BadgeProps>`. Componente reutilizado em todo o app, ganho global.

**2. Tooltip explicativo de pontuação no card de Pontos do operador**
Hoje o operador vê "Pontos totais: 3.223" sem entender de onde vem. Adicionar ícone "?" no card de Pontos (em `GamificacaoPage.tsx`) abrindo popover que lista as regras ativas do tenant (lendo `gamification_scoring_rules`). Encerra o gap pendente do plano anterior.

**3. Trigger de invalidação automática após salvar uma regra**
Hoje, ao salvar uma regra em "Pontuação", o snapshot só é recalculado se o admin clicar em "Recalcular mês atual". Como UX, oferecer um toast com ação "Aplicar agora" que chama o recálculo automaticamente — reduz risco do admin esquecer e usuários verem pontos defasados.

### Itens já cobertos pela última iteração (não precisam mexer)

- Aba "Metas" do operador agora bate com Dashboard ✓
- Aba "Metas" admin lista todos operadores com meta ✓
- Ranking, Conquistas, Loja, Carteira, Histórico — sem alterações nesta rodada, continuam estáveis
- Identificadores técnicos (`payment_count` etc.) já removidos da UI ✓

### Arquivos a alterar

- `src/components/ui/badge.tsx` — converter para `forwardRef` (1 linha de mudança)
- `src/pages/GamificacaoPage.tsx` — adicionar Popover "?" no card de Pontos com lista das regras ativas
- `src/components/gamificacao/ScoringRulesTab.tsx` — toast com ação "Aplicar agora" ao salvar regra

### Não incluído

- Sem alteração em SQL (RPC e tabela já estão corretas).
- Sem mudança em outras abas — todas validadas e funcionando.
- Histórico de versões das regras (auditoria) continua fora de escopo.

