

## Ajustes no WhatsApp - Filtro por Operador + Correção de Texto Cortado

### Problema identificado (pelo print)

A lista de conversas mostra o texto de tempo relativo ("cerca de...") sendo cortado na lateral direita. Isso acontece porque o `formatDistanceToNow` em português gera textos longos como "cerca de 2 horas" que competem por espaço com o nome do contato.

### Mudanças planejadas

**1. Filtro por Operador (Admin) - `ConversationList.tsx`**

- Adicionar nova prop `operators` (lista de `{ id, name }`) e `isAdmin` (boolean)
- Quando `isAdmin === true`, exibir um `Select` de operador no header, ao lado do título "Conversas" (canto direito)
- Opções: "Todos operadores" + lista de operadores do tenant
- Filtrar conversas pelo campo `assigned_to` que já existe na tabela `conversations`
- Adicionar novo state `operatorFilter` e aplicar no filtro

**2. Carregar operadores - `WhatsAppChatLayout.tsx`**

- Fazer query em `profiles` filtrando por `tenant_id` para obter lista de operadores (id=user_id, nome=full_name)
- Passar como prop `operators` para o `ConversationList`
- Usar `usePermissions` para determinar se é admin e passar `isAdmin`

**3. Correção do texto cortado - `ConversationList.tsx`**

Pelo print, o problema é o tempo relativo ("cerca de X") sendo truncado. A solução:
- Remover o texto de tempo relativo da primeira linha (ao lado do nome)
- Mover o indicador de tempo para a segunda linha, com formato compacto (ex: "2h", "3d", "5min") em vez do `formatDistanceToNow` verboso
- Isso libera espaço para o nome do contato e o telefone aparecerem sem corte

Alternativamente, mais simples: trocar o `formatDistanceToNow` por uma função compacta que retorne "2h", "3d", "1sem" em vez de "cerca de 2 horas".

**4. Status pills (Aberta/Aguardando/Fechada)**

Já estão implementados no header. Vou reorganizar o layout para:
- Linha 1: "Conversas" (esquerda) + Select de Operador (direita, só admin)
- Linha 2: Campo de pesquisa
- Linha 3: Pills de status (Aberta / Aguardando / Fechada)
- Linha 4: Filtros de etiqueta e instância

### Detalhes técnicos

**ConversationList.tsx - novas props e layout:**

```text
interface ConversationListProps {
  // ... existentes
  operators?: { id: string; name: string }[];
  isAdmin?: boolean;
}
```

Header reorganizado:
- Título "Conversas" com Select de operador à direita (visível só para admin)
- Função `formatCompactTime` para substituir `formatDistanceToNow`:
  - < 1min → "agora"
  - < 60min → "Xmin"  
  - < 24h → "Xh"
  - < 7d → "Xd"
  - >= 7d → "Xsem"

**WhatsAppChatLayout.tsx:**

- Query: `SELECT user_id, full_name FROM profiles WHERE tenant_id = X`
- Passar `operators` e `isAdmin` (baseado em `permissions.canManageContactCenterAdmin`)

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Filtro por operador (admin), tempo compacto, layout reorganizado |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Carregar operadores, passar isAdmin |

