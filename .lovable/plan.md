## Regra nova: "Quem negocia, vira dono"

Quando o operador marcar **"Em Negociação"** ou **formalizar um Acordo**, o sistema atribui automaticamente o cliente **e** a conversa de WhatsApp àquele operador — **sobrescrevendo** o dono anterior (regra "último que negociou").

### Estado atual

| Gatilho | `clients.operator_id` | `conversations.assigned_to` |
|---|---|---|
| Marcar "Em Negociação" | ❌ não atualiza | ❌ não atualiza |
| Formalizar Acordo | ✅ já atualiza (`agreementService.createAgreement`) | ❌ não atualiza |

Ou seja: o Acordo já cobre metade do que queremos. Falta cobrir **Em Negociação** e **a conversa** nos dois casos.

### O que vou implementar

#### 1. Função utilitária `reassignClientToOperator(cpf, credor, tenantId, operatorId)`

Centraliza a regra em um único lugar (`src/services/clientService.ts` ou novo `src/services/operatorAssignmentService.ts`):
- `UPDATE clients SET operator_id=:op WHERE tenant_id=:t AND cpf=:cpf AND credor=:credor` (todas as parcelas).
- `UPDATE conversations SET assigned_to=:op WHERE tenant_id=:t AND client_id IN (clients do CPF+credor)`.
- Registra `client_events` (`type='operator_reassigned'`, source da regra) para timeline.
- Registra `audit_logs` (`action='auto_reassign_negotiation'`).

#### 2. Hook em `createDisposition` (dispositionService.ts ~linha 360)

Logo após inserir a disposição com sucesso, se `disposition_type === 'wa_em_negociacao'` (ou matching pela `key`):
- Buscar `cpf` + `credor` do `client_id`.
- Chamar `reassignClientToOperator(...)` em fire-and-forget (não bloqueia o salvamento da disposição).

#### 3. Hook em `createAgreement` (agreementService.ts ~linha 273)

Já atualiza `clients.operator_id`. Adicionar **na mesma transação lógica** o update de `conversations.assigned_to` para todas as conversas vinculadas a clientes daquele CPF+credor.

### Comportamento exato (caso "último negocia"):

- Cliente sem dono → vira dono.
- Cliente da Maria, Sabrina marca "Em Negociação" → vira da Sabrina.
- Conversa atribuída à Sabrina, Maria marca "Em Negociação" → vira da Maria.
- Toast no atendimento: "Cliente atribuído(a) a você" (feedback visual).

### Fora de escopo

- Não vou criar regra para outras disposições (CPC genérico, Promessa) — só os 2 gatilhos aprovados.
- Não vou corrigir retroativamente os 953 + 34 casos existentes — só novas marcações.
- Não vou alterar a RPC `get_visible_conversations`.

### Detalhes técnicos

- Arquivos:
  - **Novo:** `src/services/operatorAssignmentService.ts` — função `reassignClientToOperator`.
  - **Editar:** `src/services/dispositionService.ts` (~L360) — chamar reassign após disposição "Em Negociação".
  - **Editar:** `src/services/agreementService.ts` (~L287) — adicionar update em `conversations`.
- Sem migração de schema.
- RLS já cobre — operador autenticado tem permissão de UPDATE nessas tabelas dentro do tenant.
- Performance: updates são por CPF+credor (índices existentes), fire-and-forget no caso da disposição.

### Resposta direta

**Hoje, marcar "Em Negociação" não faz nada com a atribuição.** Foi por isso que a Maria continuou invisível mesmo sendo a única a falar com a Flaviane. Esta regra resolve definitivamente esse cenário.
