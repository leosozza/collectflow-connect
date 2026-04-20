

## Abrir conversa nova por instância (com aviso de duplicidade)

Hoje, ao clicar no botão WhatsApp dentro do perfil do devedor, o sistema **reusa a primeira conversa existente** com o mesmo final de telefone — por isso a Maria Eduarda cai na conversa da instância "Acordos Vitor Santana" e não consegue iniciar uma nova pela instância dela. Vamos trocar esse comportamento por um fluxo guiado de seleção de telefone + instância.

### Comportamento novo

**Origem (`ClientDetailHeader.tsx`)** — botão WhatsApp:
1. Buscar telefones do cliente em `client_phones` (já carregados via `allClientPhones`) + fallback `client.phone/phone2/phone3`, deduplicados por E.164.
2. Buscar as instâncias WhatsApp permitidas ao operador (via `operator_instances` + role admin = todas) ativas no tenant.
3. Abrir um diálogo `StartWhatsAppConversationDialog` com:
   - **Seleção de telefone** (se houver mais de 1) — mostra o número formatado e marca o "principal".
   - **Seleção de instância** (se houver mais de 1 elegível) — mostra nome e provider; pré-seleciona a única do operador quando houver só uma.
   - Após escolher, navega para `/contact-center/whatsapp?phone=<E.164>&instanceId=<id>&forceNew=1`.

**Destino (`WhatsAppChatLayout.tsx`)** — efeito que processa `?phone=`:
1. Ler também `instanceId` e `forceNew` da query.
2. Procurar conversa existente com mesmo último-8 dígitos **na mesma instância** (`instance_id === instanceId`):
   - Se existir → seleciona ela (comportamento atual, sem aviso).
3. Se NÃO existir naquela instância, mas existir conversa em **outra instância** com o mesmo telefone:
   - Mostrar `AlertDialog` "Já existe uma conversa aberta com este número na instância **X** (operador Y, status Z). Deseja mesmo abrir uma nova conversa pela instância **W**?"
   - **Confirmar** → cria nova conversa na instância selecionada (mantém a chamada atual a `resolve_client_by_phone` para popular `client_id`/`remote_name`).
   - **Cancelar** → seleciona a conversa existente (comportamento atual).
4. Se não existir em nenhuma → cria direto na instância selecionada (sem aviso).
5. Quando `instanceId` estiver ausente (ex.: link antigo), manter o fallback atual (`instances[0]`).

### Constraint a verificar / contornar

A tabela `conversations` provavelmente tem UNIQUE em `(tenant_id, instance_id, remote_phone)`. Como a nova conversa será em **outra** `instance_id`, o INSERT é válido — não exige migração. Se houver UNIQUE apenas em `(tenant_id, remote_phone)`, capturar o erro `23505` e exibir toast "já existe conversa com este número neste tenant" (mantendo seleção da existente como fallback). Vou validar antes de mexer; se precisar relaxar a constraint, abro migração separada.

### Arquivos impactados

- **Novo**: `src/components/client-detail/StartWhatsAppConversationDialog.tsx` — diálogo de seleção de telefone + instância.
- **Editar**: `src/components/client-detail/ClientDetailHeader.tsx` — `openWhatsApp()` passa a abrir o diálogo (e só navega depois da escolha). Carrega instâncias permitidas via `operator_instances` (fallback admin = todas as ativas).
- **Editar**: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — efeito do `?phone=`:
  - Considerar `instanceId` na busca de conversa existente.
  - Quando há conflito em outra instância, exibir `AlertDialog` de confirmação antes de criar a nova.
  - Usar `instanceId` da URL no INSERT.

### Sem impacto

- RLS, schema, edge functions e RPC `resolve_client_by_phone` permanecem como estão.
- Conversas já existentes (como a órfã `470ad94a` que já foi vinculada) seguem acessíveis normalmente.

### Validação

1. Como Maria Eduarda, abrir perfil da Renata Cibin → clicar WhatsApp.
2. Diálogo aparece pedindo telefone (2 opções) e instância (apenas as dela).
3. Escolher número + instância "Maria Eduarda Acordo" → aparece aviso "já existe conversa em Acordos Vitor Santana, deseja confirmar?".
4. Confirmar → nova conversa é criada e selecionada na instância correta, com cliente vinculado.
5. Cancelar → cai na conversa existente (Acordos Vitor Santana), comportamento legado preservado.
6. Repetir com cliente que tem só 1 telefone e operador com só 1 instância → diálogo abre direto pré-selecionado (1 clique para confirmar) ou pular o diálogo se ambos forem únicos (decisão: manter sempre o diálogo para consistência, mas com botão "Abrir" em foco).

