

# Plano: Corrigir sidebar cortando + Mostrar tabulação nas conversas + Auto "Em Dia"

## Resumo

Três mudanças: (1) corrigir sidebar cortando conteúdo, (2) mostrar a tabulação ativa do cliente na lista de conversas (substituindo o badge "Não vinculado" pelo badge da tabulação), (3) para clientes vinculados com status de cobrança "Em Dia", auto-atribuir a tabulação correspondente.

---

## 1. Corrigir sidebar cortando informações

**Arquivo**: `src/components/contact-center/whatsapp/ContactSidebar.tsx`

- Aumentar largura do sidebar de `w-[320px]` para `w-[340px]`
- Garantir que o `ScrollArea` não corte conteúdo com `overflow-x-hidden`
- Ajustar cards internos para respeitar a largura disponível (usar `break-words` nos textos longos)

---

## 2. Mostrar tabulação ativa na lista de conversas

**Arquivo**: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- Carregar `conversation_disposition_assignments` + `call_disposition_types` (channel=whatsapp) uma vez
- Passar os dados como props para `ConversationList`

**Arquivo**: `src/components/contact-center/whatsapp/ConversationList.tsx`
- Receber nova prop `dispositionAssignments` e `dispositionTypes`
- Na linha de cada conversa, onde hoje aparece o badge "Não vinculado":
  - Se o cliente **não está vinculado**: manter o badge amarelo "Não vinculado" sobre o avatar
  - Abaixo do nome, mostrar os badges das tabulações ativas da conversa (usando a cor da disposition)
- As tabulações ficam visíveis para o operador identificar rapidamente o status do contato

---

## 3. Auto-atribuir "Em Dia" para clientes com status de cobrança correspondente

**Arquivo**: `src/components/contact-center/whatsapp/ContactSidebar.tsx`

- Quando o cliente é vinculado (`linkedClient` carregado) e tem `status_cobranca_id`:
  - Buscar o `tipos_status.nome` do status de cobrança
  - Se o nome contiver "em dia" (case insensitive), buscar a disposition type com `key='em_dia'` e `channel='whatsapp'`
  - Verificar se já existe assignment; se não, inserir automaticamente em `conversation_disposition_assignments`
  - Fazer o mesmo para "Quitado" → `key='quitado'`

Isso garante que quando a carteira é importada com status "Em Dia", a tabulação já aparece automaticamente na conversa do WhatsApp.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `ContactSidebar.tsx` | Corrigir largura, auto-assign "Em Dia"/"Quitado" |
| `WhatsAppChatLayout.tsx` | Carregar disposition assignments e passar para ConversationList |
| `ConversationList.tsx` | Exibir badges de tabulação nas conversas |

## O que NÃO muda
- `DispositionSelector.tsx` (já funciona)
- Banco de dados (sem migrações)
- `CallDispositionTypesTab.tsx`

