

# Remover aba WhatsApp e adicionar botão WhatsApp + edição de telefone

## Alterações

### 1. `src/components/atendimento/ClientTimeline.tsx`
- Remover a aba "Conversa WhatsApp" e o import do `WhatsAppChat`
- Manter apenas o conteúdo de "Histórico" sem tabs (ou manter como card simples)

### 2. `src/components/atendimento/ClientHeader.tsx`
- Adicionar botão com ícone WhatsApp (verde) ao lado do botão "Formalizar Acordo" no canto superior direito
- Ao clicar, navega para `/contact-center/whatsapp?phone={phone1}` (usa o primeiro telefone do cliente)
- Adicionar um botão de lápis (Pencil icon) ao lado dos telefones na Row 3
- Ao clicar no lápis, abre um Dialog/Sheet inline para editar os telefones do cliente (phone, phone2, phone3)
- Salvar diretamente na tabela `clients` via supabase update
- Receber `clientId` como prop para poder fazer o update

### 3. `src/pages/AtendimentoPage.tsx`
- Passar `client.id` para o `ClientHeader` para permitir edição de telefones
- Remover prop `messages` do `ClientTimeline` (não mais necessário)
- Opcionalmente remover a query de `messageLogs` se não for usada em outro lugar

### Detalhes do Dialog de edição de telefone
- Campos: Telefone 1, Telefone 2, Telefone 3
- Botão salvar que faz `supabase.from("clients").update({ phone, phone2, phone3 }).eq("id", clientId)`
- Após salvar, invalida a query do cliente para atualizar a tela

