
## Organizar Logica do Cliente: Status, Formalizar Acordo e Etiquetas

### 1. Exibir Status de Cobranca no WhatsApp (ContactSidebar)

No card "Cliente Vinculado" da sidebar do WhatsApp, adicionar:
- Badge com o **Status de Cobranca** do cliente (ex: "Em negociacao", "Acordo Vigente")
- Buscar o status da tabela `tipos_status` pelo `status_cobranca_id` do cliente
- Botao **"Formalizar Acordo"** que navega para `/carteira/{cpf}` com query param para abrir a aba de acordo

**Arquivo:** `src/components/contact-center/whatsapp/ContactSidebar.tsx`
- Adicionar campo `status_cobranca_id` na query do cliente vinculado
- Fazer query em `tipos_status` para resolver o nome/cor do status
- Adicionar botao "Formalizar Acordo" abaixo dos dados do cliente vinculado, usando `useNavigate` para redirecionar a `/carteira/{cpf}?tab=acordo`

### 2. Exibir Status de Cobranca no Discador (AtendimentoPage / ClientHeader)

No header do atendimento (discador), adicionar:
- Badge com o **Status de Cobranca** do cliente
- Botao **"Formalizar Acordo"** que navega para `/carteira/{cpf}?tab=acordo`

**Arquivos:**
- `src/components/atendimento/ClientHeader.tsx` - Adicionar badge de status de cobranca e botao "Formalizar Acordo"
- `src/pages/AtendimentoPage.tsx` - Passar `status_cobranca_id` para o ClientHeader (ja vem do select `*`)

### 3. Suporte a `?tab=acordo` no ClientDetailPage

Ao abrir `/carteira/{cpf}?tab=acordo`, a pagina deve automaticamente abrir na aba "Acordos" e disparar o dialog de "Formalizar Acordo".

**Arquivo:** `src/pages/ClientDetailPage.tsx`
- Ler query param `tab` via `useSearchParams`
- Se `tab=acordo`, definir a aba ativa como "acordo" e abrir o `showAcordoDialog`

### 4. Etiquetas - Admin pode editar/criar, Operador so seleciona

**Arquivo:** `src/components/contact-center/whatsapp/TagManager.tsx`
- Receber prop `isAdmin` (booleano)
- Se `isAdmin === true`: mostra o formulario de criar nova etiqueta e permite criar
- Se `isAdmin === false`: mostra apenas a lista de etiquetas existentes para selecionar, sem opcao de criar novas

**Arquivo:** `src/components/contact-center/whatsapp/ContactSidebar.tsx`
- Passar `isAdmin` para o `TagManager`, usando `useTenant().isTenantAdmin`

**Arquivo:** `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`
- Nenhuma mudanca necessaria (a permissao e resolvida no componente filho)

### 5. Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/contact-center/whatsapp/ContactSidebar.tsx` - Status badge, botao Formalizar Acordo, prop isAdmin para TagManager
- `src/components/contact-center/whatsapp/TagManager.tsx` - Condicional de criacao baseada em isAdmin
- `src/components/atendimento/ClientHeader.tsx` - Badge de status cobranca, botao Formalizar Acordo
- `src/pages/ClientDetailPage.tsx` - Suporte a query param `tab=acordo`

**Nenhuma migracao de banco necessaria** - todos os campos e tabelas ja existem.
