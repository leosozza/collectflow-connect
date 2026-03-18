

# Plano: Vinculação de Cliente por IA + Múltiplos Números por CPF

## Contexto

Atualmente, a vinculação de cliente a conversas WhatsApp é feita apenas por telefone (`findClientByPhone`). Se o número não bater, a conversa fica sem cliente. Além disso, o webhook só busca nos campos `phone`, mas a tabela já tem `phone2` e `phone3`.

## Alterações

### 1. Webhook: Buscar em phone, phone2 e phone3

**`supabase/functions/whatsapp-webhook/index.ts`** — Alterar `findClientByPhone` para buscar com `or` nos 3 campos de telefone, aumentando a chance de match automático.

```sql
.or(`phone.like.%suffix%,phone2.like.%suffix%,phone3.like.%suffix%`)
```

### 2. Botão "Vincular por IA" no ContactSidebar

**`src/components/contact-center/whatsapp/ContactSidebar.tsx`** — Quando não há cliente vinculado e a conversa tem mensagens, adicionar um botão "Vincular por IA" que:
- Envia as últimas mensagens da conversa para a edge function `chat-ai-suggest`
- Usa uma nova action `extract_cpf` que pede à IA para extrair CPFs mencionados na conversa
- Com o CPF extraído, busca o cliente na tabela `clients` e oferece para vincular

### 3. Nova action `extract_cpf` na edge function

**`supabase/functions/chat-ai-suggest/index.ts`** — Adicionar case `extract_cpf`:
- System prompt instrui a IA a procurar CPFs (11 dígitos, com ou sem formatação) e nomes completos nas mensagens
- Usa tool calling para retornar: `{ cpfs: string[], names: string[] }`
- Frontend usa os CPFs/nomes para buscar candidatos na tabela `clients` e exibir opções

### 4. Fluxo no ContactSidebar

Quando o operador clica "Vincular por IA":
1. Chama `chat-ai-suggest` com `action: "extract_cpf"` e as mensagens
2. Recebe CPFs e nomes extraídos
3. Busca na tabela `clients` por CPF (exato) ou nome (ilike)
4. Exibe lista de candidatos encontrados para o operador confirmar a vinculação
5. Operador clica no cliente correto → vincula via `linkClientToConversation`

### 5. Busca manual ampliada

A busca manual existente no ContactSidebar já busca por `phone` — adicionar `phone2` e `phone3` ao filtro `or`.

## Resumo de arquivos alterados

| Arquivo | Mudança |
|---|---|
| `whatsapp-webhook/index.ts` | Buscar phone + phone2 + phone3 |
| `chat-ai-suggest/index.ts` | Nova action `extract_cpf` com tool calling |
| `ContactSidebar.tsx` | Botão "Vincular por IA", fluxo de extração + confirmação |

