

## Diferenciar régua: Títulos Originais (Carteira) vs. Acordos Gerados

### Conceito

Hoje a régua trata tudo como "lembrete genérico". Vamos separar em **dois tipos de régua**, cada um com seu universo de elegibilidade, templates próprios e gestão independente:

| Tipo | Fonte de dados | Quando dispara | Exemplo |
|---|---|---|---|
| **Carteira** (título original) | `clients.data_vencimento` | Cliente sem acordo ativo, título vencendo/vencido | "Olá {{nome}}, identificamos um débito em aberto..." |
| **Acordo** (parcela de acordo) | Parcelas de `agreements` ativos | Parcela do acordo vencendo/vencida | "Sua parcela {{n_parcela}}/{{total_parcelas}} vence em {{vencimento_parcela}}..." |

### 1) Schema (`collection_rules`)

Adicionar coluna `rule_type` (enum: `wallet` | `agreement`), default `wallet` para regras existentes. Validação por trigger: regra `agreement` exige `credor_id` (idem `wallet`).

### 2) Motor de elegibilidade (`send-notifications/index.ts` + RPC)

Criar **RPC `get_rule_eligible_targets(rule_id, target_date)`** que ramifica por `rule_type`:

- **`wallet`**: `clients` do credor com `data_vencimento = target_date`, `status in ('pendente','vencido')`, **e que NÃO têm acordo ativo** (`NOT EXISTS` em `agreements` com status in `pending|approved`). Retorna `source='wallet'`.
- **`agreement`**: expande parcelas de `agreements` ativos do credor (entrada + parcelas via `custom_installment_dates`/`first_due_date`/`new_installments`), filtra `due_date = target_date`, exclui parcelas com `manual_payments` confirmados ou `cobrancas` pagas. Retorna `source='agreement'`, `agreement_id`, `installment_key`, `installment_number`, `total_installments`, `installment_value`.

Edge function passa a chamar a RPC e logar `metadata.source` + `metadata.agreement_id`/`installment_key` em `message_logs`.

### 3) Templates: variáveis específicas por tipo

Atualizar `_shared/template-resolver.ts`:

- **Comuns** (ambos): `{{nome}}`, `{{cpf}}`, `{{credor}}`
- **Wallet**: `{{valor}}`, `{{data_vencimento}}` (do título original)
- **Agreement**: `{{valor_parcela}}`, `{{vencimento_parcela}}`, `{{n_parcela}}`, `{{total_parcelas}}`, `{{linha_digitavel}}` (se boleto disponível)

Variáveis irrelevantes ao tipo retornam string vazia (não quebram template antigo).

### 4) UI (`CredorReguaTab.tsx`)

No Dialog de criar/editar regra, **primeiro campo** passa a ser:

```text
Tipo de régua:  ( ) Título da Carteira  ( ) Parcela de Acordo
```

- Ao selecionar, o painel "Variáveis disponíveis" abaixo do textarea do template **muda dinamicamente** mostrando só as variáveis válidas para o tipo.
- Lista de regras existentes ganha **badge** ("Carteira" laranja / "Acordo" azul) pra leitura rápida.
- Filtro no topo da aba: "Todas | Carteira | Acordo".

### 5) Migração de dados existentes

Regras atuais ficam como `wallet` (mantém comportamento). Usuário cria as `agreement` novas conforme necessidade. Sem perda de dados.

### 6) Validação

1. Aplicar migration + RPC.
2. Criar 1 regra `wallet` (D-3) e 1 regra `agreement` (D0) para TESS MODELS.
3. Rodar RPC para cada → comparar listas, garantir que cliente com acordo ativo **não** aparece na régua wallet.
4. Invocar `send-notifications` → `message_logs.metadata.source` reflete `wallet` ou `agreement` corretamente.
5. Conferir templates renderizados com variáveis específicas de cada tipo.

### Arquivos alterados

- `supabase/migrations/<nova>.sql` — coluna `rule_type` + RPC `get_rule_eligible_targets`.
- `supabase/functions/send-notifications/index.ts` — usar RPC, logar source.
- `supabase/functions/_shared/template-resolver.ts` — variáveis condicionais por tipo.
- `src/services/automacaoService.ts` — tipo `CollectionRule.rule_type`.
- `src/components/cadastros/CredorReguaTab.tsx` — seletor de tipo, badge, filtro, painel de variáveis dinâmico.

### Fora de escopo

- Regras híbridas (uma regra que cobre ambos) — mantemos separação estrita.
- Boleto/linha digitável real puxada do gateway (placeholder; integração com Asaas/Negociarie fica para próximo passo).
- Janela de horário e throttle (seguem no backlog acordado anteriormente).
- Automação/workflows.

