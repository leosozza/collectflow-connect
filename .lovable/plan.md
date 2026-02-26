

## Plano: Liberacao de Acordos Fora do Padrao + Agendados no Dashboard

### Parte 1: Acordo Fora do Padrao — Solicitar Liberacao

**Problema:** Operadores podem criar acordos com desconto/parcelas fora dos limites do credor sem nenhuma validacao ou aprovacao.

**Solucao:** Validar os parametros do acordo contra as regras do credor. Se estiver fora dos limites, exibir botao "Solicitar Liberacao" em vez de "Gerar Acordo". O acordo sera criado com status `pending_approval` e ficara visivel para Supervisor/Gerente/Admin aprovar.

#### Banco de Dados

Nova coluna na tabela `agreements`:
```sql
ALTER TABLE agreements ADD COLUMN requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE agreements ADD COLUMN approval_reason text;
```

#### Mudancas no Frontend

| Arquivo | Mudanca |
|---------|---------|
| `src/components/client-detail/AgreementCalculator.tsx` | Adicionar validacao contra `credorRules`: verificar se `discountPercent > desconto_maximo` ou `numParcelas > parcelas_max` ou entrada abaixo do minimo. Se fora do padrao, exibir alerta visual e mudar botao para "Solicitar Liberacao". Ao submeter, criar acordo com `status: 'pending_approval'` e `requires_approval: true` |
| `src/components/atendimento/NegotiationPanel.tsx` | Mesma logica de validacao (receber `credorRules` como prop) |
| `src/services/agreementService.ts` | Adicionar parametro `requiresApproval` em `createAgreement`. Novo status `pending_approval`. Nova funcao `approveSpecialAgreement` |
| `src/components/acordos/AgreementsList.tsx` | Adicionar status `pending_approval` com badge amarela "Aguardando Liberacao". Mostrar botoes aprovar/rejeitar para quem tem permissao |
| `src/pages/AcordosPage.tsx` | Adicionar filtro `pending_approval`. Notificacao ao operador quando aprovado/rejeitado |

#### Permissoes

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/usePermissions.ts` | Adicionar modulo `liberacoes` com acoes `["view", "approve"]`. Default: admin/gerente/supervisor tem `approve`, operador tem `view` |
| `src/components/cadastros/UserPermissionsTab.tsx` | Exibir novo modulo na interface de permissoes |

---

### Parte 2: Botao "Agendados" no Dashboard

**Problema:** Agendamentos de callback nao tem visibilidade. Operador nao recebe alerta quando chega a hora do retorno.

**Solucao:** Botao "Agendados" no header do Dashboard (ao lado de Analytics). Abre pagina/dialog com lista de callbacks agendados para o dia. Notificacao no sino + popup na tela quando chega a hora.

#### Banco de Dados

Nao precisa de nova tabela — usa `call_dispositions` existente filtrando por `disposition_type = 'callback'` e `scheduled_callback` no dia.

#### Mudancas no Frontend

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/DashboardPage.tsx` | Adicionar botao "Agendados" ao lado de "Analytics" no header. Badge com contagem de agendados do dia. Ao clicar, abre Dialog com lista |
| `src/components/dashboard/ScheduledCallbacksDialog.tsx` | NOVO — Dialog listando callbacks do dia. Admin ve todos (com nome do operador). Operador ve apenas os seus. Cada linha clicavel -> navega para ficha do cliente |
| `src/hooks/useScheduledCallbacks.ts` | NOVO — Hook que busca callbacks agendados do dia, com polling a cada 60s. Quando um callback atinge a hora agendada, dispara notificacao no sino e popup (toast) com link para ficha do cliente |
| `src/hooks/useNotifications.ts` | Integrar com o hook de callbacks para disparar popup |

#### Logica do Admin vs Operador

- **Operador**: ve apenas seus agendamentos do dia
- **Admin/Supervisor/Gerente**: ve todos os agendamentos do dia, com coluna "Operador"

#### Notificacao e Popup

- Polling a cada 60s verifica se algum `scheduled_callback` esta dentro dos proximos 5 minutos
- Ao detectar, cria notificacao local (toast) com titulo "Retorno agendado: {nome_cliente}" e botao para abrir ficha
- Tambem registra no sino (insere na tabela `notifications`)

#### Permissoes

| Mudanca |
|---------|
| Novo modulo `agendados` em `usePermissions.ts` com acoes `["view_own", "view_all"]`. Default: operador tem `view_own`, supervisor/gerente/admin tem `view_all` |

---

### Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | NOVO — colunas `requires_approval`, `approval_reason` em agreements |
| `src/services/agreementService.ts` | MODIFICAR — suporte a `pending_approval` |
| `src/components/client-detail/AgreementCalculator.tsx` | MODIFICAR — validacao + botao liberacao |
| `src/components/atendimento/NegotiationPanel.tsx` | MODIFICAR — validacao + botao liberacao |
| `src/components/acordos/AgreementsList.tsx` | MODIFICAR — novo status |
| `src/pages/AcordosPage.tsx` | MODIFICAR — filtro novo status |
| `src/pages/DashboardPage.tsx` | MODIFICAR — botao Agendados |
| `src/components/dashboard/ScheduledCallbacksDialog.tsx` | NOVO |
| `src/hooks/useScheduledCallbacks.ts` | NOVO |
| `src/hooks/usePermissions.ts` | MODIFICAR — modulos `liberacoes` e `agendados` |

