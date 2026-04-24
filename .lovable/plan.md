## Problema

Quando você clica no botão do WhatsApp no perfil da Silvana, o diálogo `StartWhatsAppConversationDialog` faz uma busca por **conversas existentes** considerando os **últimos 8 dígitos de TODOS os telefones cadastrados** do cliente (phone, phone2, phone3). Como o número antigo (errado) `5511940237026` está cadastrado e já tem uma conversa anterior associada, o diálogo:

1. Detecta a conversa antiga e oculta o formulário de seleção.
2. Mostra apenas o botão **"Abrir conversa existente"**, apontando para a conversa do número errado.
3. Não pergunta a instância nem o telefone, porque o caminho "nova conversa" só aparece para admins (botão "Iniciar nova mesmo assim").

Resumo: marcar o número certo como HOT não influencia, porque a busca de conversas existentes não filtra por HOT — usa qualquer telefone do cadastro.

## Solução

Ajustar `StartWhatsAppConversationDialog.tsx` com três mudanças:

### 1. Filtrar conversas existentes apenas pelo telefone selecionado (HOT por padrão)
- Mudar `phoneSuffixes` para usar **somente** o `selectedPhone` (que já é inicializado com o número HOT/principal).
- Assim, se a conversa antiga é do número errado, ela só será detectada se o usuário escolher aquele número.

### 2. Sempre exibir o formulário de seleção (telefone + instância)
- Mostrar o seletor de telefone e instância **mesmo quando há conversa existente**.
- Mover o card "Conversa existente" para um aviso informativo acima do formulário (não bloqueante).
- Botões finais: `Abrir conversa existente` (se houver match com o telefone selecionado) **e** `Abrir nova conversa` lado a lado — disponível para todos os operadores, não só admins.

### 3. Liberar "iniciar nova conversa" para operadores
- Remover a restrição `isAdmin` no botão de forçar nova conversa.
- Justificativa: o operador precisa conseguir abrir conversa com o número HOT correto, mesmo que exista histórico em outro número.

## Comportamento esperado após a correção

Cenário Silvana (operadora Maria Eduarda):
1. Operadora promove `5511XXXXXXXX` (correto) como HOT.
2. Clica no ícone WhatsApp no header do cliente.
3. Diálogo abre com:
   - Telefone selecionado = HOT (correto).
   - Instância = padrão da operadora (perguntando se houver mais de uma).
4. Como **não existe** conversa para o número HOT, mostra apenas "Abrir conversa".
5. Clica → vai para `/contact-center/whatsapp?phone=...&instanceId=...&forceNew=1` e abre nova conversa.

Se a operadora trocar para o número antigo no select, o aviso de "conversa existente" reaparece e ela pode abrir a antiga.

## Arquivos alterados
- `src/components/client-detail/StartWhatsAppConversationDialog.tsx` (refatorar lógica do `phoneSuffixes`, exibir sempre o formulário, liberar "nova conversa" para todos)

Sem mudanças de banco. Sem mudanças em outros componentes.

**Posso aplicar?**