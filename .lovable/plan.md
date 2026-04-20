
Vou testar end-to-end o fluxo de "Abrir conversa nova por instância" no preview, simulando o caminho da Maria Eduarda até a Renata Cibin.

### Roteiro de teste no navegador

1. **Navegar até o perfil da Renata Cibin** (CPF `06338297907`, credor TESS MODELS) via Carteira ou busca global.
2. **Abrir o `StartWhatsAppConversationDialog`** clicando no botão WhatsApp do `ClientDetailHeader`.
3. **Validar o seletor de telefone**: confirmar que aparecem `5541998824444` (principal) e `554133364843`, deduplicados e formatados.
4. **Validar o seletor de instância**: confirmar que só aparecem instâncias permitidas ao usuário logado (via `operator_instances`); se for admin, todas ativas.
5. **Selecionar telefone + instância diferente** da que já tem conversa (Acordos Vitor Santana) → clicar "Abrir conversa".
6. **Validar o `AlertDialog` de conflito** em `WhatsAppChatLayout` informando que já existe conversa em outra instância.
7. **Testar "Abrir a existente"** → cair na conversa `470ad94a` (Acordos Vitor Santana) com cliente vinculado.
8. **Testar "Criar nova"** → confirmar `INSERT` em `conversations` com `instance_id` da escolhida + `client_id` da Renata resolvido via RPC.
9. **Capturar screenshots** em cada etapa-chave (diálogo, conflito, conversa final) e checar console por warnings/erros.

### Pré-validação no banco
- Confirmar via `supabase--read_query` quais usuários estão como admin / quais instâncias a Maria Eduarda tem em `operator_instances`, e o estado atual de `conversations` para a Renata (para comparar antes/depois).

### O que vou reportar
- Screenshots do diálogo, do alerta de conflito e da conversa criada/selecionada.
- Confirmação SQL de que a nova conversa foi inserida na instância correta com `client_id` populado.
- Qualquer erro de console (incl. o warning existente sobre `ScheduledCallbacksDialog` que NÃO faz parte deste fluxo — apenas reportarei).
- Se algo falhar (ex: constraint UNIQUE bloqueando o INSERT), paro, reporto o erro com detalhes e proponho correção (ex: relaxar constraint via migração).

### Observação
O teste é não-destrutivo do ponto de vista de negócio — só cria uma conversa nova vinculada à mesma cliente, sem enviar mensagem real. Caso queira que eu evite criar a nova conversa e pare apenas no momento do alerta de conflito, me avise antes de aprovar.
