# Plano: Estrutura inicial de Skills do RIVO CONNECT

Criar o diretório `.workspace/skills/` com um conjunto inicial de skills derivadas das regras críticas do projeto. Cada skill tem `SKILL.md` (frontmatter `name` + `description` + corpo com instruções).

## Skills a criar

### 1. `criar-migration-rls`
**Quando ativa:** pedidos para criar/alterar tabelas, policies, triggers.
**Conteúdo:** uso obrigatório de `get_my_tenant_id()`, padrão `tenant_id NOT NULL`, sempre habilitar RLS, nunca CHECK constraints com `now()` (usar trigger), nunca mexer em `auth/storage/realtime/supabase_functions/vault`, usar tool de migration.

### 2. `criar-edge-function`
**Quando ativa:** criar nova edge function.
**Conteúdo:** template com CORS headers, dual-mode auth (JWT do usuário OU `service_role_key` + `tenant_id` explícito + `x-cron-secret` quando aplicável), uso de `LOVABLE_API_KEY` para IA, registro em `supabase/config.toml`, logs em `audit_logs`.

### 3. `acordos-installment-key`
**Quando ativa:** mexer em acordos, parcelas, pagamentos, baixas.
**Conteúdo:** convenção `installment_key` (entrada + 1..N), SSOT em `agreement_installments`, "Recebido em R$" SEMPRE pela UNION (`manual_payments` + `portal_payments` + `negociarie_cobrancas`), NUNCA `SUM(paid_amount)`, regras de quebra/cancelamento de boleto Negociarie.

### 4. `status-hierarchy`
**Quando ativa:** mudanças de status de cliente/CPF.
**Conteúdo:** hierarquia (QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA > INADIMPLENTE > EM DIA), trigger de proteção (override via `SET LOCAL app.force_status_override`), CPF-cêntrico por credor.

### 5. `whatsapp-multichannel`
**Quando ativa:** integrações WhatsApp, campanhas, instâncias.
**Conteúdo:** arquitetura de 3 camadas (engine → adapter → provider), `instance-proxy` unificado para Evolution/Gupshup/Wuzapi, Anti-Ban delays 8-15s, normalização E.164 (55+DDD+9), templates oficiais vs flexíveis.

### 6. `paginacao-supabase`
**Quando ativa:** queries que listam muitos registros.
**Conteúdo:** NUNCA `fetchAllRows`, sempre `.range()` server-side, limite de 1000 itens em seleções em massa, RPCs agrupados (`get_carteira_grouped`) em vez de joins client-side.

## Estrutura final

```
.workspace/skills/
├── criar-migration-rls/SKILL.md
├── criar-edge-function/SKILL.md
├── acordos-installment-key/SKILL.md
├── status-hierarchy/SKILL.md
├── whatsapp-multichannel/SKILL.md
└── paginacao-supabase/SKILL.md
```

Cada SKILL.md tem ~30-60 linhas: frontmatter com `name` e `description` específica (para matching automático) + corpo com regras, exemplos de código e armadilhas conhecidas.

## Observações

- Skills são descobertas no **início da sessão** — após criar, recarregue o chat para ativá-las.
- Não toco em código de produto neste plano, só crio arquivos em `.workspace/skills/`.
- Você mencionou que vai mandar outras skills — depois que aprovar este plano, eu crio essas 6, e a gente itera adicionando as suas conforme você descreve.
