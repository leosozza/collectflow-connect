

# Higienização pela Carteira — Seleção de Clientes

## Conceito

Sim, é totalmente possível. A Carteira já tem toda a infraestrutura necessária: filtros avançados (credor, status, tipo devedor, etc.), agrupamento por CPF e seleção com checkboxes (`selectedIds`). Já existem ações em lote como WhatsApp, Discador e Atribuir que aparecem quando clientes são selecionados.

A higienização será mais uma **ação em lote** no mesmo padrão.

## Fluxo do Usuário

1. Operador/Admin abre **Carteira**
2. Filtra por credor, status, período, etc.
3. Seleciona clientes via checkboxes (individual ou "selecionar todos")
4. Clica no botão **"Higienizar" (N)** que aparece na barra de ações
5. Dialog de confirmação mostra: quantidade de CPFs únicos, custo em tokens, saldo atual
6. Confirma → sistema envia CPFs para Edge Function → atualiza cadastros → consome tokens

## Implementação

### 1. Banco de Dados (Migration)

- Criar tabelas `enrichment_jobs` e `enrichment_logs` para rastrear jobs
- Adicionar campos `phone2`, `phone3`, `enrichment_data` (JSONB) na tabela `clients`
- Inserir serviço "Higienização" no `service_catalog` com `unit_price = 0.15`

### 2. Edge Function `targetdata-enrich`

- Recebe `{ tenant_id, cpfs[], job_id }`
- Valida saldo de tokens
- Chama Target Data API (`POST /v1/search/pf`) em lotes de 10 CPFs
- Atualiza `clients`: telefones, email, endereço, cidade, UF, CEP
- Consome tokens via RPC `consume_tokens` apenas por CPF com retorno
- Registra resultados em `enrichment_logs`

### 3. Frontend — Botão na Carteira (`CarteiraPage.tsx`)

Adicionar na barra de ações (junto com WhatsApp, Discador, Atribuir):

```text
[WhatsApp (5)] [Discador (5)] [Atribuir (5)] [🔍 Higienizar (5)]
```

O botão abre um `EnrichmentConfirmDialog` que mostra:
- N CPFs únicos selecionados
- Custo: N × R$ 0,15 = R$ X,XX
- Saldo atual: Y tokens
- Botão confirmar (desabilitado se saldo insuficiente)

### 4. Dialog de Confirmação (`EnrichmentConfirmDialog.tsx`)

- Calcula CPFs únicos dos `selectedIds`
- Consulta saldo via `check_token_balance`
- Ao confirmar: cria `enrichment_job`, invoca edge function, mostra progresso
- Toast de sucesso com resumo (X atualizados, Y não encontrados)

### 5. Super Admin — Preço por Tenant

Usar infraestrutura existente de `tenant_services` + `service_catalog`. O serviço "Higienização" aparece automaticamente na gestão de serviços com `unit_price_override` editável por tenant.

### 6. Secrets Necessários

- `TARGETDATA_API_KEY` — chave da conta matrix RIVO
- `TARGETDATA_API_SECRET` — secret da conta matrix

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `enrichment_jobs`, `enrichment_logs`, alterar `clients`, inserir serviço no catálogo |
| `supabase/functions/targetdata-enrich/index.ts` | Edge function de higienização |
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Dialog de confirmação com custo/saldo |
| `src/pages/CarteiraPage.tsx` | Adicionar botão "Higienizar" na barra de ações |
| `src/pages/IntegracaoPage.tsx` | Aba "Higienização" para histórico/config (opcional, fase 2) |

