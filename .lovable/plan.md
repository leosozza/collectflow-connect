## Por que isso aconteceu (e pode acontecer de novo)

O caso da Flaviane **não é isolado**. Levantamento agora no banco da Y.brasil:

- **953 conversas** têm `assigned_to` preenchido mas o cliente vinculado (`clients.operator_id`) está **NULL** — exatamente o cenário da Flaviane.
- **34 conversas** estão atribuídas a um operador **diferente** do que é dono da cliente na Carteira.

A causa é estrutural: hoje existem **dois "donos" separados** que ninguém mantém sincronizado:

| Local | Campo | Quem define |
|---|---|---|
| Carteira (cliente) | `clients.operator_id` | Importação / atribuição em massa na Carteira |
| Conversa (Inbox) | `conversations.assigned_to` | Primeira resposta humana, transferência, ou disparo em massa |

Quando uma conversa nasce de um **disparo em massa** (ex.: "Disparos Maria Eduarda 3"), o sistema **não** marca a Maria Eduarda como dona — a conversa fica sem assignee até alguém responder. Se outra operadora (Sabrina) responder primeiro, a conversa fica com ela, mesmo a cliente "sendo" da Maria Eduarda na cabeça do time. E como o `clients.operator_id` da Flaviane estava NULL, ninguém era oficialmente dono na Carteira tampouco.

## O que vou entregar

**Foco: UI para reatribuição manual** (sem mexer em regras globais de visibilidade nem em automações de disparo, conforme combinado).

### 1. Botão "Atribuir operador" no perfil do cliente

No `ClientDetailHeader`, ao lado dos botões existentes (WhatsApp, Ligar etc.), adicionar **"Atribuir operador"** (visível para admin; para operador, oculto ou somente leitura).

Ao clicar, abre um diálogo simples mostrando:
- **Dono atual na Carteira** (`clients.operator_id`) — com nome do operador ou "Sem dono".
- **Dono da conversa de WhatsApp** (`conversations.assigned_to` da conversa vinculada, se existir) — com nome ou "Sem conversa".
- Combo para escolher novo operador (lista de `profiles` do tenant).
- Checkbox "Aplicar também à conversa de WhatsApp" (marcado por padrão quando existir conversa).
- Botão **Salvar**.

Ao salvar:
- Atualiza `clients.operator_id` em **todas as parcelas daquele CPF + credor** (mesmo critério que já usamos para a Flaviane).
- Se o checkbox estiver marcado, atualiza `conversations.assigned_to` da(s) conversa(s) vinculada(s) do CPF.
- Registra em `audit_logs` (`action='client_reassigned'`) para rastreabilidade.

### 2. Reuso do diálogo de atribuição em massa (Carteira)

Já existe `AssignOperatorDialog` para atribuir vários clientes selecionados. Vou **não alterar funcionalidade existente**, só garantir que ele também:
- Atualize a **conversa vinculada** (`conversations.assigned_to`) opcionalmente, via mesmo checkbox.

### Fora de escopo (explicitamente)

- **Não** vou alterar a RPC `get_visible_conversations` nem regras de visibilidade.
- **Não** vou criar sincronização automática "disparo em massa → operator_id". Isso é uma decisão de produto separada (posso planejar depois se quiser).
- **Não** vou fazer correção em massa dos 953 + 34 casos agora. Posso entregar isso como passo seguinte, depois que validarmos o fluxo manual.

## Detalhes técnicos

- Componente novo: `src/components/client-detail/AssignClientOperatorDialog.tsx`.
- Botão no `ClientDetailHeader.tsx` (visível conforme permissão; usar `usePermissions`).
- Sem migração de schema — apenas UPDATE em `clients` e `conversations` via cliente Supabase (RLS já cobre tenant).
- Audit log inserido via `auditService` existente.

## Resposta direta às suas perguntas

1. **Pode acontecer com outros clientes?** Sim — já está acontecendo em ~987 casos no seu tenant. É um efeito colateral de disparos em massa + atribuição manual desacoplada na Carteira.
2. **Conseguimos atribuir manualmente a outro operador?** Sim — vou adicionar um botão "Atribuir operador" direto no perfil do cliente que cuida das duas tabelas de uma vez.
