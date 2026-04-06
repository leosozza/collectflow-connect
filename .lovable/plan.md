

# Plano: Busca multi-termo na Carteira + Iniciar conversa WhatsApp por telefone

## Problema 1: Busca na Carteira não encontra cliente

A função `get_carteira_grouped` busca com `ILIKE '%texto_inteiro%'`. Ao pesquisar "Cesiane Amancio Antonio dos Santos", exige correspondência exata da string completa. Se o nome no banco tiver qualquer diferença (espaço extra, acento, abreviação), a busca falha.

**Correção**: Alterar a função SQL para dividir o texto de busca em palavras e exigir que TODAS as palavras estejam presentes no nome (AND de ILIKEs). Exemplo: "Cesiane Santos" encontraria "Cesiane Amancio Antonio dos Santos".

**Arquivo**: Migration SQL alterando `get_carteira_grouped`

Trecho relevante — substituir:
```sql
c.nome_completo ILIKE '%' || _search || '%'
```
Por lógica que divide `_search` em palavras (split por espaço) e verifica cada uma com `ILIKE` em AND. Mantém busca por CPF, telefone e email como está (sem split).

---

## Problema 2: Botão WhatsApp não abre/cria conversa

Ao clicar no botão WhatsApp na Carteira ou Atendimento, o sistema navega para `/contact-center/whatsapp?phone=5511...` mas o `WhatsAppChatLayout` ignora completamente o parâmetro `?phone=`. O operador vê a lista de conversas sem nenhuma selecionada e sem como iniciar uma nova.

**Correção em 2 partes**:

### 2a. Auto-selecionar conversa existente pelo phone
No `WhatsAppChatLayout`, após carregar as conversas, ler o `?phone=` da URL. Se encontrar uma conversa com `remote_phone` correspondente (suffix match dos últimos 8 dígitos), selecioná-la automaticamente.

### 2b. Criar conversa se não existir
Se nenhuma conversa for encontrada para aquele telefone:
- Inserir uma nova conversa na tabela `conversations` com status `open`, vinculando à instância default do tenant
- Selecionar automaticamente a conversa criada
- O operador pode então digitar e enviar a primeira mensagem

**Arquivo**: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- Adicionar `useSearchParams` para ler `?phone=`
- Após `loadConversations`, executar lógica de match ou criação
- Limpar o param da URL após processar para evitar re-execução

---

## Resumo de alterações

| Arquivo | Tipo |
|---|---|
| Migration SQL (`get_carteira_grouped`) | Alterado — busca multi-termo |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Alterado — auto-select/create por phone |

Nenhuma alteração em: campanhas, webhook, chat_messages, permissions, Contact Center admin, automação.

