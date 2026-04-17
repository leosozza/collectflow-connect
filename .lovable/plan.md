
## Modelo B — Accept-to-Read com mensagens borradas

### Comportamento desejado
Quando a conversa estiver em status `waiting`, o operador pode clicar nela mas:
- Mensagens ficam **borradas** (efeito blur) — vê que existem, mas não consegue ler
- Sidebar de contato fica oculta/borrada
- Input já fica desabilitado (já está hoje)
- Banner central com botão "Aceitar Conversa" em destaque
- `markConversationRead` **não** é chamado automaticamente (preserva contador)

Admins (super_admin/admin) terão exceção: visualizam normalmente para auditoria.

### Mudanças

**1. `ChatPanel.tsx`** — overlay de bloqueio sobre as mensagens
- Detectar `isLocked = conversation.status === 'waiting' && !isAdmin`
- Aplicar `filter: blur(8px)` + `pointer-events: none` no container das mensagens
- Sobrepor card central com ícone de cadeado, texto "Aceite a conversa para visualizar o histórico" e botão grande "Aceitar Conversa"
- Esconder/borrar a `AISuggestion` no estado bloqueado

**2. `WhatsAppChatLayout.tsx`** — sidebar e leitura automática
- Em `handleSelectConv`: se `conv.status === 'waiting'` e usuário não-admin, **não chamar** `markConversationRead`
- Forçar `sidebarOpen = false` (ou renderizar sidebar borrada) quando `waiting + não-admin`

**3. Detecção de admin**
- Usar `profile.role` (já disponível via `useAuth`) — `super_admin` e `admin` ignoram o lock
- Operador comum (`agent`, `user`) vê o bloqueio

### Fluxo de aceitação
- Botão "Aceitar Conversa" no overlay → chama `onStatusChange('open')` (já existe)
- Após mudança para `open`, blur some, sidebar reaparece, input habilita, `markConversationRead` é disparado

### Detalhes técnicos
- Sem mudanças de schema/backend — puramente UI
- Banner amarelo atual de "Conversa aguardando" será substituído pelo overlay central (mais visível)
- Blur usando Tailwind `blur-md` + `select-none` para impedir cópia de texto
- Acessibilidade: `aria-hidden` no conteúdo borrado, foco automático no botão "Aceitar"
