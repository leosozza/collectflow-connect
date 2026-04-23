

## Pontuação configurável por tenant (admin)

Hoje a fórmula de pontos está fixa no SQL (`recalculate_operator_gamification_snapshot`):
```
+10 por pagamento, +5 a cada R$100, -3 por quebra, +50 por conquista, +100 meta
```
O admin não consegue alterar. A proposta é permitir que cada tenant configure suas próprias regras via UI.

### 1) Banco — nova tabela `gamification_scoring_rules`

| coluna | tipo | descrição |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid | isolamento multi-tenant |
| `metric` | text | uma das métricas suportadas (lista fixa abaixo) |
| `points` | numeric | pontos por unidade da métrica (pode ser negativo) |
| `unit_size` | numeric | tamanho da unidade (ex.: 100 → "a cada R$100"). Default 1 |
| `enabled` | boolean | liga/desliga a regra |
| `label` | text | rótulo customizável exibido na UI |
| `created_at`, `updated_at` | timestamps | |

**Métricas suportadas (enum lógico, validado por trigger):**
- `payment_count` — pagamento confirmado
- `total_received` — valor recebido (usa `unit_size`)
- `agreement_created` — acordo formalizado
- `agreement_paid` — acordo totalmente quitado (todas parcelas pagas)
- `agreement_break` — quebra de acordo
- `achievement_unlocked` — conquista desbloqueada
- `goal_reached` — meta do mês atingida (bônus único)

**RLS:** SELECT para qualquer membro do tenant; INSERT/UPDATE/DELETE apenas admins (`is_tenant_admin`).

**Seed:** ao criar o primeiro acesso ao módulo (ou via migration), inserir as 7 regras default com os mesmos valores atuais para não quebrar nada.

### 2) Backend — refatorar `recalculate_operator_gamification_snapshot`

A RPC continua igual em assinatura, mas agora:
1. Calcula as métricas brutas (já faz hoje) + duas novas:
   - `agreements_paid_count` — acordos do operador 100% quitados no mês
2. Lê `gamification_scoring_rules` do tenant.
3. Para cada regra `enabled`, soma `(metric_value / unit_size) * points`.
4. `points = GREATEST(0, soma)`.

Adiciona colunas no retorno JSON com o detalhamento por métrica para a UI mostrar "como cheguei nesta pontuação".

Sem mudança em `operator_points` (continua persistindo `points`, `payments_count`, `breaks_count`, `total_received`).

### 3) UI — nova aba "Regras de Pontuação" em Gamificação

**Arquivo novo:** `src/components/gamificacao/ScoringRulesTab.tsx`
**Arquivo novo:** `src/services/scoringRulesService.ts`

**Página:** `src/pages/GamificacaoPage.tsx` — adicionar aba "Pontuação" visível **somente para admin**.

**Layout:** tabela editável com uma linha por métrica:

| Ativa | Métrica | Rótulo | Pontos | Por unidade | |
|---|---|---|---|---|---|
| ☑ | Pagamento confirmado | "Pagamento" | 10 | 1 | Salvar |
| ☑ | Valor recebido | "Cada R$100" | 5 | 100 | |
| ☑ | Acordo formalizado | "Novo acordo" | 0 | 1 | |
| ☑ | Acordo totalmente quitado | "Acordo pago" | 30 | 1 | |
| ☑ | Quebra de acordo | "Quebra" | -3 | 1 | |
| ☑ | Conquista desbloqueada | "Conquista" | 50 | 1 | |
| ☑ | Meta do mês atingida | "Meta atingida" | 100 | 1 | |

- Botão "Restaurar padrões" volta aos valores originais.
- Botão "Recalcular mês atual" chama `recalculate_tenant_gamification_snapshot` para aplicar imediatamente.
- Aviso visual: "As alterações afetam apenas cálculos futuros até você clicar em Recalcular."

### 4) Tooltip explicativo no card de pontos do operador

`MetaGaugeCard` / aba Ranking ganham um ícone "?" que abre um popover listando as regras ativas do tenant — assim o operador entende como ganha pontos.

### Arquivos alterados/criados

- nova migration SQL: tabela `gamification_scoring_rules` + RLS + seed por tenant existente + refatoração da RPC
- novo `src/services/scoringRulesService.ts`
- novo `src/components/gamificacao/ScoringRulesTab.tsx`
- `src/pages/GamificacaoPage.tsx` — adicionar aba (apenas admin)
- `src/components/gamificacao/RankingTab.tsx` (ou equivalente) — tooltip explicativo

### Não incluído

- Não permite criar métricas totalmente novas (só ativar/desativar e ajustar pesos das 7 existentes). Métricas livres exigiriam definir como calcular — fora do escopo deste passo.
- Sem histórico versionado das regras (só estado atual). Caso queira auditoria, fica como próximo passo.

