## Objetivo

Criar 13 skills em `.workspace/skills/` espelhando o setup do Antigravity, cada uma como uma `SKILL.md` com frontmatter (`name` + `description`) e corpo com regras, exemplos e armadilhas conhecidas — tudo ancorado no que já está no `mem://index.md` (RLS, SSOT, hierarquia de status, `installment_key`, paginação, multichannel, etc.).

As 6 skills já criadas anteriormente (`criar-migration-rls`, `criar-edge-function`, `acordos-installment-key`, `status-hierarchy`, `whatsapp-multichannel`, `paginacao-supabase`) serão **mantidas** e referenciadas/consolidadas pelas novas onde fizer sentido (sem duplicar conteúdo — as novas linkam para elas).

## Skills a criar (13)

### Estruturais (SaaS & Performance)
1. **`saas-performance-scaling`** — Index strategy, RPCs agregadas (`get_carteira_grouped`, dashboards), `.range()`, SQL chunking para UPDATEs em massa, evitar joins client-side. Linka `paginacao-supabase`.
2. **`saas-security-rls`** — `get_my_tenant_id()` obrigatório, `can_access_tenant()` em RPCs, `SECURITY DEFINER` + `search_path = public`, secrets no Vault/`secrets` do Edge, nunca `profiles.role='super_admin'`. Linka `criar-migration-rls`.
3. **`saas-audit-trail`** — `audit_logs` com metadata obrigatória (actor, entity, before/after), `client_events` como SSOT da timeline, `operational_logs` para fluxos críticos, idempotency keys.
4. **`saas-onboarding-growth`** — Tenant provisioning (CNPJ + 50 tokens cortesia), service catalog, GoLive checklist, setup banner/progress.

### Domínio (Finanças & Cobrança)
5. **`guardiao-logica-financeira`** — `clients` vs `agreements`, `installment_key` canônico, "Recebido em R$" via UNION (`manual_payments` + `portal_payments` + `negociarie_cobrancas`) — **nunca** `SUM(paid_amount)`, `get_client_real_balance`, hierarquia de status com trigger de proteção, ciclo de vida não-regressivo. Consolida e linka `acordos-installment-key` + `status-hierarchy`.
6. **`debtor-scoring`** — Propensity score 5D, 4 perfis fixos (Ocasional/Recorrente/Resistente/Insatisfeito), regras de auto-classificação, gatilhos de recálculo.
7. **`bi-financial-recovery`** — Aging bands, prestação de contas (exclusões), métricas de acordo (inicial vs ongoing), reconciliação manual, dashboards via RPC SQL.

### Operação & Automação
8. **`especialista-automacao-whatsapp`** — Arquitetura 3 camadas, `instance-proxy`, Anti-Ban 8-15s, E.164, virtual Gupshup routing, templates oficiais vs flexíveis, transcrição Gemini. Linka `whatsapp-multichannel`.
9. **`external-integrations`** — Asaas (gateway switch + webhook proxies), Negociarie (cron 12h, `id_parcela`, cobrança lookup anti-leak, trigger cancel boletos no break), Serasa/CENPROT (auto-removal), 3CPlus (account isolation, polling adaptativo), Maxlist (avoid-overwrite + reconciliation alerts).
10. **`auditor-tecnico-rivo`** — Checklist SSOT antes de qualquer alteração crítica: (1) tenant filter no JS + RLS, (2) `installment_key` consistente, (3) sem `fetchAllRows`, (4) sem `SUM(paid_amount)` pra recebimento, (5) status via hierarquia, (6) Edge com dual-mode auth, (7) `audit_logs` em mutações sensíveis, (8) E.164 em telefones. Modo "double-check" — invoque antes de PRs grandes.

### Motor & UX
11. **`motor-consistencia-ui-ux`** — Shadcn + Tailwind semantic tokens (nunca `bg-white`/`text-black`), HSL em `index.css`/`tailwind.config.ts`, primary laranja RIVO, dark mode, glassmorphism, variantes via `cva`, sem cores hardcoded.
12. **`synapse-compression-engine`** — Execução cirúrgica: parallel tool calls, search-replace > rewrite, ler arquivos em batch, evitar passos triviais. Regras de eficiência meta-operacional.
13. **`super-agent-orchestrator`** — Quando dividir trabalho em sub-tarefas, usar `task_tracking`, quando pedir aprovação via plan mode, quando rodar checks paralelos (linter + edge logs + read_query).

## Estrutura de cada arquivo

```
.workspace/skills/{nome}/SKILL.md
```

Frontmatter:
```yaml
---
name: {nome}
description: {1 linha para auto-discovery — específica o suficiente para matching}
---
```

Corpo (~40-80 linhas):
- **Quando aplicar** (3-5 bullets)
- **Regras absolutas** (com links `mem://` quando aplicável)
- **Exemplos de código** (✅ certo / ❌ errado)
- **Armadilhas conhecidas** (regressões reais do projeto)
- **Links para skills relacionadas**

## Frase de ativação (conforme dica do usuário)

Cada SKILL.md inclui no topo do corpo:

> "Você agora possui as diretrizes de **{Nome}**. Nunca realize alterações que violem os princípios de segurança e integridade financeira estabelecidos no Cofre do RIVO."

## Detalhes técnicos

- Total de arquivos novos: **13** (cada um sua pasta + `SKILL.md`)
- Não modifica nenhum arquivo existente do projeto (apenas `.workspace/skills/`)
- Não toca em código, migrations, edge functions ou memória
- Skills antigas (6) **permanecem** — as novas não duplicam, apenas linkam
- Após criar, **reload do chat** ativa as 13 novas + as 6 anteriores = 19 skills totais

## Ordem de criação

Em batch paralelo (1 mensagem, 13 `code--write`), pois são arquivos independentes.

## O que NÃO faz

- Não altera regras de negócio existentes
- Não cria migrations, RPCs ou edge functions
- Não modifica `mem://index.md` (skills referenciam memórias, não as substituem)
- Não toca em `.lovable/plan.md` nem código de produção