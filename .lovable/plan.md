

## Variaveis Dinamicas em Respostas Rapidas + Mensagens Pre-configuradas

### Conceito

As respostas rapidas passarao a suportar **variaveis dinamicas** que sao substituidas automaticamente pelos dados reais do cliente vinculado a conversa no momento do envio. O admin vera os atalhos de variaveis no formulario de criacao, e o operador vera a mensagem ja preenchida ao selecionar.

### Variaveis Disponiveis

| Variavel | Descricao | Fonte |
|---|---|---|
| `{{nome_cliente}}` | Nome completo do devedor | `clients.nome_completo` |
| `{{nome_operador}}` | Nome do operador logado | `profiles.full_name` |
| `{{valor_parcela}}` | Valor da parcela (R$) | `clients.valor_parcela` |
| `{{parcelas_abertas}}` | Qtd parcelas em aberto | `clients.total_parcelas - clients.numero_parcela + 1` |
| `{{total_parcelas}}` | Total de parcelas | `clients.total_parcelas` |
| `{{credor}}` | Nome do credor | `clients.credor` |
| `{{cpf}}` | CPF do cliente | `clients.cpf` |
| `{{vencimento}}` | Data de vencimento | `clients.data_vencimento` |

### Mensagens Pre-configuradas (seed via migracao)

Serrao inseridas automaticamente para cada tenant (ou como templates padrao):

1. `/saudacao` - "Ola, {{nome_cliente}}! Aqui e {{nome_operador}}. Como posso ajuda-lo hoje?"
2. `/debito` - "{{nome_cliente}}, seu debito atual com {{credor}} e de {{valor_parcela}} por parcela, com {{parcelas_abertas}} parcela(s) em aberto."
3. `/vencimento` - "Sua proxima parcela vence em {{vencimento}}, no valor de {{valor_parcela}}."
4. `/negociacao` - "{{nome_cliente}}, temos condicoes especiais para regularizar sua situacao com {{credor}}. Posso apresentar uma proposta?"
5. `/encerramento` - "Obrigado pelo contato, {{nome_cliente}}! Qualquer duvida, estamos a disposicao. Um abraco, {{nome_operador}}."

---

### Detalhes Tecnicos

**1. QuickRepliesTab.tsx - Atalhos de variaveis no formulario**

Adicionar abaixo do Textarea de conteudo uma barra com botoes/chips clicaveis para cada variavel. Ao clicar, a variavel e inserida na posicao do cursor no textarea. Exemplo visual: chips como `{nome_cliente}`, `{valor_parcela}`, etc.

**2. WhatsAppChatLayout.tsx - Passar dados do cliente para ChatInput**

Atualmente `clientInfo={null}` esta hardcoded. Precisamos:
- Carregar o cliente vinculado a conversa (via `selectedConv.client_id`)
- Passar `clientInfo` real para o ChatPanel/ChatInput

**3. ChatInput.tsx - Resolver variaveis ao selecionar quick reply**

Na funcao `selectQuickReply`, antes de setar o texto, substituir todas as variaveis `{{...}}` pelos dados reais do cliente e do operador. Se o cliente nao estiver vinculado, manter a variavel como texto literal (ou mostrar aviso).

**4. Migracao SQL - Inserir respostas rapidas padrao**

Criar funcao SQL ou usar a migracao para inserir as 5 respostas padrao. Como sao por tenant, sera necessario inserir para todos os tenants existentes. Usar `INSERT ... ON CONFLICT DO NOTHING` baseado em tenant_id + shortcut para nao duplicar.

**Arquivos a modificar:**
- `src/components/contact-center/whatsapp/QuickRepliesTab.tsx` - adicionar barra de variaveis clicaveis
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` - carregar clientInfo real e passar ao ChatPanel
- `src/components/contact-center/whatsapp/ChatInput.tsx` - receber clientInfo + profile, resolver variaveis na selecao
- `src/components/contact-center/whatsapp/ChatPanel.tsx` - repassar clientInfo ao ChatInput
- Nova migracao SQL para inserir respostas rapidas padrao

