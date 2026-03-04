

## Plano: Revisar logica de acordos, dashboard e novo status "Vencido"

### Problema principal
O "Total Projetado no Mes" no Dashboard inclui clientes com acordos cancelados — deveria mostrar apenas acordos vigentes (pending/approved). Acordos cancelados devem ir para "Total Quebrado".

### Alteracoes

#### 1. Novo status "overdue" (Vencido) na tabela `agreements`
- Nao precisa de migration de schema (status ja eh campo text livre)
- Criar edge function `auto-expire-agreements` que roda periodicamente:
  - Acordos com `status = 'pending'` ou `'approved'` e `first_due_date < hoje - 1 dia` → muda para `overdue`
  - Acordos com `status = 'overdue'` e `first_due_date < hoje - 6 dias` → muda para `cancelled`
- Tambem verificar no frontend ao carregar (fallback)

#### 2. `src/pages/DashboardPage.tsx` — Corrigir metricas
- `totalProjetado`: filtrar apenas acordos com status `pending` ou `approved` (excluir cancelled, rejected, overdue)
- `totalQuebra`: incluir clientes de acordos `cancelled` + `overdue` + clientes com status `quebrado`
- `agreementCpfs` para filtragem: manter apenas CPFs de acordos ativos (pending/approved)

#### 3. `src/pages/AcordosPage.tsx` — Redesenhar filtros e logica
- **Remover** o `<Select>` de status e substituir por botoes/badges clicaveis com cores:
  - Pagos (verde) | Pendente (laranja) | Cancelados (vermelho) | Aguardando Liberacao (azul) | Vencido (amarelo escuro)
- **Remover** "Aprovado" e "Rejeitado" dos filtros visiveis
- **Default**: mostrar apenas acordos vigentes (pending + approved) ao entrar na pagina
- Remover as tabs "Todos os Acordos" / "Aguardando Liberacao" e usar os badges como filtro unico

#### 4. `src/components/acordos/AgreementsList.tsx` — Adicionar status "overdue"
- Adicionar cor e label para `overdue`: "Vencido" com cor amarelo/amber
- Atualizar `activeStatuses` para incluir logica correta

#### 5. `src/services/agreementService.ts` — Sem mudancas de schema

#### 6. `supabase/functions/auto-expire-agreements/index.ts` — Nova edge function
- Busca acordos pendentes/aprovados com vencimento expirado
- Marca como `overdue` (1 dia apos vencimento)
- Marca como `cancelled` (5 dias apos vencimento = `overdue` por 5 dias)
- Cria notificacoes para admins e operadores

#### 7. Notificacoes de liberacao (melhoria)
- No `createAgreement`, ja existe notificacao para admins
- Adicionar popup/toast em tempo real no `useNotifications.ts` quando chegar notificacao com `reference_type = 'agreement'` e `type = 'warning'`

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/DashboardPage.tsx` | Excluir cancelled/overdue do totalProjetado; incluir no totalQuebra |
| `src/pages/AcordosPage.tsx` | Badges clicaveis coloridos no lugar do Select; default = vigentes |
| `src/components/acordos/AgreementsList.tsx` | Adicionar status overdue com cor amber |
| `src/hooks/useNotifications.ts` | Toast para notificacoes de liberacao de acordo |
| `supabase/functions/auto-expire-agreements/index.ts` | Auto-expirar acordos vencidos |

### Logica de status final dos acordos

```text
pending          → Acordo vigente, parcela em aberto antes do vencimento
pending_approval → Aguardando liberacao do admin
approved         → Acordo liberado/aprovado (vigente)  
overdue          → Vencido (1 dia apos vencimento, mantido por 5 dias)
cancelled        → Cancelado (manual ou auto apos 5 dias de vencido)
rejected         → Rejeitado pelo admin (so no historico)
```

### Metricas do Dashboard corrigidas

```text
Total Projetado = clientes com acordos (pending | approved) → soma valor_parcela
Total Negociado = todos acordos do mes (qualquer status exceto rejected)
Total Quebra    = clientes com status quebrado + clientes de acordos cancelled/overdue
Total Recebido  = clientes pagos com acordo ativo
```

