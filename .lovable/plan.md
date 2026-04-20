

## Substituir Select de status por botão contextual

No `ChatPanel.tsx` (linhas 299-308), trocar o `<Select>` de 3 opções por um único botão dependente do status atual.

### Comportamento

- **`status === "open"`** → botão **"Fechar conversa"** (variant `outline`, ícone `CheckCircle`) → `handleStatusChange("closed")`.
- **`status === "closed"`** → botão **"Abrir conversa"** (variant `outline`, ícone `RotateCcw`) → `handleStatusChange("open")`.
- **`status === "waiting"`** → **nada renderizado** (operador usa o fluxo de aceite via lock já existente nas linhas 315+).

### Arquivo impactado

**`src/components/contact-center/whatsapp/ChatPanel.tsx`** (somente bloco linhas 299-308):
- Remover o `<Select>` de status e seus `SelectItem`s.
- Inserir bloco condicional `{conversation.status === "open" && ...}` / `{conversation.status === "closed" && ...}`.
- Reaproveitar `handleStatusChange` existente (que já trata o caso especial de `closed` abrindo o `CloseConversationDialog` para forçar tabulação).
- Adicionar `CheckCircle` e `RotateCcw` aos imports do `lucide-react`.
- Manter `h-8 gap-1.5 text-xs` para consistência com "Atendimento" e "Transferir".

### Sem impacto

- Banner/lock de aceite (linhas 315+) permanece igual.
- `ConversationList` continua com ContextMenu de 3 opções para contextos avançados.
- `CloseConversationDialog` continua sendo acionado automaticamente ao fechar (tabulação obrigatória).
- Imports `Select*` podem ser removidos se não forem usados em mais lugar — vou verificar antes; se forem, apenas removo o uso e mantenho o import.
- Nenhuma mudança em RLS, RPC, edge functions ou schema.

### Validação

1. Conversa `open` → ver apenas "Fechar conversa" → clicar → abre `CloseConversationDialog` (tabulação) → confirmar → status vira `closed`.
2. Conversa `closed` → ver apenas "Abrir conversa" → clicar → status volta para `open` direto (sem dialog).
3. Conversa `waiting` → nenhum botão de status na barra; fluxo de aceite via lock segue funcionando.

