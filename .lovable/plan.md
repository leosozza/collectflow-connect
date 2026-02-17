
## Correcoes e Melhorias: Auto-vinculacao de Clientes e Verificacao das Abas

### Diagnostico

**1. Abas (Agente Inteligente, Etiquetas, Respostas Rapidas):**
As abas JA estao funcionando no codigo atual. Ao verificar diretamente no navegador, todas as 4 abas aparecem corretamente para o usuario admin. Pode ter sido um problema de cache do navegador. Recomendo forcar um reload (Ctrl+Shift+R) para confirmar.

**2. Vinculacao automatica de clientes:**
O webhook `whatsapp-webhook` cria conversas novas sem tentar vincular o cliente. A tabela `clients` tem o campo `phone` que deveria ser usado para fazer o match automaticamente. Quando uma mensagem chega de um numero que ja existe na base de clientes, o sistema deveria vincular automaticamente.

---

### Plano de Implementacao

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Na criacao de uma nova conversa (linhas 194-216), adicionar logica de auto-vinculacao:

1. Antes de criar a conversa, buscar na tabela `clients` um registro com `phone` igual ao `remotePhone` (ou variantes com/sem prefixo 55)
2. Se encontrar, incluir o `client_id` no insert da conversa
3. Se nao encontrar, manter `client_id` como `null` (comportamento atual)

Logica de matching de telefone:
- Buscar por match exato no campo `phone`
- Tambem tentar variantes: remover o "55" do inicio, adicionar "55", buscar com formatos diferentes
- Filtrar por `tenant_id` para respeitar a separacao multi-tenant

**Tambem aplicar auto-vinculacao para conversas ja existentes sem client_id:**
Quando uma conversa existente nao tem `client_id` vinculado, tentar o match novamente (caso o cliente tenha sido importado depois da conversa ser criada).

---

### Detalhes Tecnicos

**Modificacao no webhook (`supabase/functions/whatsapp-webhook/index.ts`):**

```text
Adicionar funcao auxiliar:

async function findClientByPhone(supabase, tenantId, phone):
  - Normalizar o telefone (remover caracteres nao-numericos)
  - Buscar em clients WHERE tenant_id = tenantId AND phone contém o numero
  - Tentar match com variantes: phone completo, sem DDI, com DDI
  - Retornar client_id se encontrado, null caso contrario

Na criacao de nova conversa:
  - Chamar findClientByPhone antes do insert
  - Incluir client_id no objeto de insert

Na atualizacao de conversa existente:
  - Se existingConv nao tem client_id (verificar com select adicional)
  - Chamar findClientByPhone e atualizar se encontrar match
```

**Nenhuma migracao de banco necessaria** - o campo `client_id` ja existe na tabela `conversations`.

**Arquivo a modificar:**
- `supabase/functions/whatsapp-webhook/index.ts` - adicionar auto-vinculacao por telefone
