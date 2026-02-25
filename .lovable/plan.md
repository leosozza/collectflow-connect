

## Plano: Redesign do Botao Flutuante de Suporte — Estilo Chat (Kodee)

### Objetivo

Transformar o botao flutuante de suporte de um painel lateral com abas (Guias, Chat, Agendar) para um **widget de chat flutuante** no estilo do Kodee (imagem de referencia), onde o usuario interage diretamente em uma janela de conversa fixa no canto inferior direito.

### Mudancas Principais

1. **Remover o painel Sheet/abas** — O SupportPanel com Sheet sera substituido por um popup/card flutuante ancorado no canto inferior direito, acima do botao
2. **Chat direto** — Ao clicar no FAB, abre uma janela de chat (card com sombra, ~400px de altura) onde o usuario digita e o sistema responde
3. **Manter funcionalidade de tickets** — Por baixo, o chat continua criando tickets e mensagens no banco (support_tickets/support_messages), mas a UX e simplificada: o usuario so ve um chat

### Layout do Widget

```text
+------------------------------------+
| RIVO Suporte    [_] [✏] [▼ fechar] |
+------------------------------------+
|                                    |
|                                    |
|        (area de mensagens)         |
|                                    |
|          "quanto custa..."  [user] |
|                                    |
| ✨ RIVO Suporte                    |
| Resposta do sistema aqui...        |
|                                    |
|   👍 👎                            |
+------------------------------------+
| Pergunte algo ao RIVO...       [↑] |
+------------------------------------+
| O RIVO pode cometer erros.         |
+------------------------------------+
```

### Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/components/support/SupportFloatingButton.tsx` | Reescrever: FAB + popup card de chat inline (sem Sheet) |
| `src/components/support/SupportPanel.tsx` | Remover (substituido pelo chat inline no FloatingButton) |

### Arquivos Mantidos (sem alteracao)

| Arquivo | Motivo |
|---------|--------|
| `src/components/support/SupportChatTab.tsx` | Logica de tickets/mensagens reutilizada |
| `src/components/support/SupportGuidesTab.tsx` | Mantido para uso na pagina admin |
| `src/components/support/SupportScheduleTab.tsx` | Mantido para uso na pagina admin |
| `src/pages/SupportAdminPage.tsx` | Pagina admin inalterada |
| `src/components/AppLayout.tsx` | Ja renderiza SupportFloatingButton, sem mudanca |

### Detalhes Tecnicos

**SupportFloatingButton.tsx — Novo Design:**

- Estado `open` controla visibilidade do card de chat
- Card posicionado `fixed bottom-24 right-6` (acima do FAB)
- Dimensoes: `w-[380px] h-[500px]` (responsivo: em mobile `w-[calc(100vw-2rem)]`)
- Header: titulo "RIVO Suporte", botao de fechar (ChevronDown)
- Body: lista de mensagens scrollavel (mesmo layout do SupportChatTab atual mas embutido)
- Footer: input de texto + botao enviar + disclaimer "O RIVO pode cometer erros"
- Ao abrir pela primeira vez: cria ou reutiliza o ultimo ticket aberto do usuario
- Mensagens do staff aparecem a esquerda com icone/nome "RIVO Suporte"
- Mensagens do usuario aparecem a direita com fundo primario
- Animacao framer-motion: scale + fade ao abrir/fechar
- O FAB muda de icone quando aberto (LifeBuoy → X)

**Fluxo simplificado:**

1. Usuario clica no FAB
2. Widget de chat abre com animacao
3. Se ha ticket aberto, carrega mensagens dele
4. Se nao ha ticket, cria um automaticamente ("Chat de Suporte") ao enviar a primeira mensagem
5. Staff responde via SupportAdminPage (sem mudanca)
6. Respostas aparecem em tempo real via realtime (ja implementado)

**Sem mudanca no banco de dados** — reutiliza as mesmas tabelas support_tickets e support_messages.

