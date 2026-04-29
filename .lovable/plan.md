## Edição de mensagem no estilo WhatsApp + janela de tempo correta

### Problemas atuais
1. O item **"Editar mensagem"** aparece no menu mesmo depois de expirar a janela de 15 min — fica visível, mas desabilitado e com tooltip de explicação. O usuário quer que **simplesmente não apareça**.
2. A edição abre um **Dialog modal genérico** (caixa centralizada com título "Editar mensagem", descrição, textarea grande). Isso quebra a identidade do WhatsApp, que faz a edição **inline**, no próprio fluxo do chat: aparece um balão preview "Você" com a mensagem original e logo abaixo um input com botão **X** (cancelar) à esquerda e **✓** (confirmar) à direita.
3. O `canEdit` é calculado apenas no render — se a janela expirar enquanto o usuário está com o dialog aberto/menu aberto, o estado não atualiza. Precisa de um "tick" para forçar re-render quando a mensagem se aproxima dos 15 min.

### Mudanças

**Arquivo: `src/components/contact-center/whatsapp/ChatMessage.tsx`**

1. **Esconder em vez de desabilitar** (linhas 331-342)
   - O item `<DropdownMenuItem>` "Editar mensagem" só renderiza quando `canEdit && !isOfficialApi && message.message_type === "text"`. Sem mais `disabled` + `title`.
   - Mantemos a remoção de `editDisabledReason` (não é mais necessário).

2. **Re-render quando expira a janela** (depois do `ageMs`)
   - Adicionar `useEffect` que, se `isOutbound && !isInternal && !isDeleted && message.message_type === "text"` e a mensagem ainda está dentro de 15 min, agenda um `setTimeout` para o momento exato em que vai expirar (`15min - ageMs`). No callback, força re-render via `setNow(Date.now())`. Isso garante que o item suma do menu **e** que o input inline se feche automaticamente quando o tempo acaba.

3. **Substituir Dialog por edição inline** (linhas 437-462)
   - Remover o `<Dialog>` inteiro.
   - Quando `editOpen === true`: dentro do balão da mensagem, em vez de mostrar o conteúdo normal (`renderContent()`), renderizamos um bloco de edição:
     - Pequena tag "Você" (em laranja primary) — opcional, dispensável já que o balão já tem orientação.
     - O texto original cinza acima como referência (line-clamp-2, opcional)
     - Um input/textarea limpo com fundo branco (no escuro, fundo do balão), sem bordas pesadas
     - Linha com botão **X** (ghost circular cinza, à esquerda) e botão **✓** (verde `#25d366`, à direita), seguindo cor de envio/check do WhatsApp
     - Atalho: **Enter** confirma, **Esc** cancela, **Shift+Enter** quebra linha
   - O input usa auto-resize (mesma técnica do `ChatInput`) para crescer com o texto.
   - Durante `busy=true`: ✓ vira spinner, X desabilitado.
   - O resto do balão (footer com hora, status, etc.) continua aparecendo normalmente abaixo.

4. **Visual fiel à referência (imagem 2)**
   - Container: o próprio balão verde da mensagem ganha um leve outline para indicar modo edição.
   - Input: `bg-white dark:bg-[#2a3942]`, sem borda, padding 8px 12px, rounded-full.
   - Botão X: 32×32, círculo cinza claro, ícone `X` muted.
   - Botão ✓: 32×32, círculo verde `#25d366`, ícone `Check` branco.
   - Tipografia idêntica ao balão (mesma `font-size`, `line-height`).

### Arquivos afetados
- `src/components/contact-center/whatsapp/ChatMessage.tsx` (única alteração)

### Não vamos mexer
- A lógica de `editChatMessage` no service — segue igual.
- O comportamento de "editada" no rodapé do balão (continua mostrando o tooltip com texto original).
- A tela de exclusão (`AlertDialog`) — esta permanece como modal pois é uma ação destrutiva mais formal.

Aplico?