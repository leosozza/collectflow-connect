

# Substituir filtro Vinculados/Não vinculados por IA/Humano

## Análise de impacto

O filtro `linkFilter` (Vinculados/Não vinculados) filtra conversas por `client_id` (nulo ou não). Na prática, como você mencionou, ele não está sendo útil operacionalmente. Removê-lo **não tem impacto negativo** — a indicação visual de cliente não vinculado (anel amarelo + ícone) continuará existindo nas conversas.

## Lógica do novo filtro

A tabela `conversations` tem o campo `assigned_to`:
- **`assigned_to = null`** → conversa sem operador (gerenciada por IA/bot ou aguardando)
- **`assigned_to = UUID`** → conversa atribuída a um humano

O novo seletor terá 3 opções:
- **Todos** (padrão)
- **Com IA** — filtra `assigned_to IS NULL`
- **Com Humano** — filtra `assigned_to IS NOT NULL`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Renomear `linkFilter` → `handlerFilter`, trocar ícone para `Bot`, opções: Todos / Com IA / Com Humano |
| `src/services/conversationService.ts` | Substituir lógica de `linkFilter` por `handlerFilter` que filtra pelo campo `assigned_to` |

Nenhuma mudança no banco de dados necessária.

