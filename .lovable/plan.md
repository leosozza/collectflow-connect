

# Fix: Organizar Bolhas de Mensagem no Chat

## Problema

As bolhas de mensagem não estão respeitando o alinhamento correto (esquerda para inbound, direita para outbound) porque há um wrapper intermediário (`div.flex.items-center.gap-1` na linha 105) que quebra a cadeia de largura. O `max-w-[65%]` da bolha calcula relativo a esse wrapper sem largura definida, não ao container do chat.

## Solução

No arquivo `ChatMessage.tsx`, reestruturar o layout do return principal (linhas 103-158):

1. **Remover o wrapper intermediário** (`div.flex.items-center.gap-1` na linha 105) que não tem largura definida
2. **Mover o botão de reply** para dentro da bolha ou como sibling direto no flex externo
3. **Adicionar `w-full`** ao container externo para garantir que `max-w-[65%]` funcione corretamente

### Estrutura corrigida:
```text
div.flex.w-full.[justify-end|justify-start]   ← container principal com largura total
  ├── (reply button - hover, apenas inbound)
  └── div.max-w-[65%].bubble                   ← bolha diretamente no flex
```

### Arquivo alterado
- `src/components/contact-center/whatsapp/ChatMessage.tsx` — apenas o bloco de return (linhas 103-158)

### Sem impacto em
- Notas internas (bloco separado)
- ChatPanel, ConversationList, ou qualquer outro componente

