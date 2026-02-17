

## Correcao do Botao "Formalizar Acordo" e Novas Abas no Contact Center WhatsApp

### Diagnostico: Botao "Formalizar Acordo"

**O botao JA existe no codigo** tanto no WhatsApp quanto no Discador. Porem:

1. **WhatsApp**: O botao so aparece quando um cliente esta **vinculado** a conversa (dentro do card "Cliente Vinculado" na sidebar direita). Se nenhum cliente foi vinculado, o card nao aparece e o botao tambem nao. O comportamento esta correto, mas pode confundir. A correcao sera tornar o botao mais visivel.

2. **Discador (Atendimento)**: O botao existe no `ClientHeader.tsx` mas pode estar sendo cortado pelo layout em telas menores. Vou garantir que ele esteja mais proeminente.

**Acoes de correcao:**
- No WhatsApp, alem do botao na sidebar (que so aparece com cliente vinculado), adicionar uma indicacao visual mais clara de que e preciso vincular um cliente primeiro
- No Discador, verificar e ajustar o posicionamento do botao no ClientHeader

---

### Novas Abas no Contact Center - WhatsApp

Atualmente, ao acessar `/contact-center/whatsapp`, o sistema carrega diretamente o `WhatsAppChatLayout`. A proposta e adicionar **sub-abas** na pagina do WhatsApp:

1. **Conversas** (aba atual - WhatsAppChatLayout)
2. **Agente Inteligente** (admin apenas)
3. **Etiquetas** (admin apenas - CRUD de etiquetas)
4. **Respostas Rapidas** (admin apenas - CRUD de respostas rapidas)

Operadores verao apenas a aba "Conversas".

---

### Aba: Agente Inteligente (Admin)

Pagina para criar/editar perfis de agentes de IA que podem ser vinculados a instancias de WhatsApp para automatizar cobrancas.

**Card 1 - Identificador do Agente**
- Nome interno/identificador unico do agente

**Card 2 - Personalidade**
- Nome do agente (nome publico)
- Genero: Masculino ou Feminino
- Personalidade: multi-select com opcoes (Amigavel, Profissional, Educado, Engracado, Prestativo, Empatico, Direto ao ponto, Formal, Perspicaz)

**Card 3 - Contexto e Conhecimento**
- Textarea grande com instrucoes e informacoes do credor
- Mensagem explicativa: "O seu assistente sabera responder sobre tudo que esta aqui..."

**Logica adicional:**
- 1 agente padrao pre-configurado para vincular a credores
- O agente criado aparecera como usuario do sistema (na tabela `profiles`) com role especial
- O agente podera ser vinculado a uma instancia de WhatsApp (via `operator_instances`)

---

### Aba: Etiquetas (Admin)

CRUD completo de etiquetas de conversa. Reutiliza a logica existente do `TagManager`, mas em formato de lista administrativa com:
- Nome da etiqueta
- Cor
- Acoes: editar, excluir

---

### Aba: Respostas Rapidas (Admin)

CRUD de respostas rapidas (tabela `quick_replies` ja existe):
- Atalho (ex: /saudacao)
- Categoria
- Conteudo da mensagem
- Acoes: editar, excluir

---

### Detalhes Tecnicos

**Nova tabela no banco: `ai_agents`**
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL)
- `identifier` (text) -- identificador interno
- `name` (text) -- nome publico
- `gender` (text) -- masculino/feminino
- `personality` (jsonb) -- array de traits selecionados
- `context` (text) -- conhecimento/contexto do chatbot
- `is_default` (boolean, default false)
- `is_active` (boolean, default true)
- `profile_id` (uuid, nullable) -- FK para profiles (usuario do sistema)
- `credor_id` (uuid, nullable) -- FK para credores
- `created_at` (timestamp)
- `updated_at` (timestamp)
- RLS: admin manage, tenant view

**Arquivos a criar:**
- `src/components/contact-center/whatsapp/AIAgentTab.tsx` -- CRUD de agentes inteligentes com os 3 cards
- `src/components/contact-center/whatsapp/TagsManagementTab.tsx` -- CRUD administrativo de etiquetas
- `src/components/contact-center/whatsapp/QuickRepliesTab.tsx` -- CRUD de respostas rapidas

**Arquivos a modificar:**
- `src/pages/ContactCenterPage.tsx` -- adicionar sub-abas (Conversas, Agente Inteligente, Etiquetas, Respostas Rapidas) quando channel="whatsapp", visibilidade condicional por role
- `src/components/contact-center/whatsapp/ContactSidebar.tsx` -- melhorar visibilidade do botao "Formalizar Acordo" e mensagem quando nao ha cliente vinculado
- `src/components/atendimento/ClientHeader.tsx` -- garantir visibilidade do botao de acordo

**Migracao de banco:**
- Criar tabela `ai_agents` com RLS adequado

