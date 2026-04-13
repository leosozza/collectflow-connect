

# Corrigir exclusão de anexos de clientes

## Problema
A política RLS de DELETE na tabela `client_attachments` permite exclusão **apenas para admins** (`is_tenant_admin OR is_super_admin`). Usuários comuns do tenant não conseguem excluir, mesmo sendo quem fez o upload.

Além disso, o código atual deleta o arquivo do storage **antes** do registro da tabela. Se a exclusão do registro falhar (por RLS), o arquivo some do storage mas o registro permanece — estado inconsistente.

## Solução

### 1. Migration SQL
Atualizar a política de DELETE na tabela `client_attachments` para permitir que qualquer usuário do tenant possa excluir anexos do mesmo tenant:

```sql
DROP POLICY "Tenant admins can delete attachments" ON client_attachments;
CREATE POLICY "Tenant users can delete attachments" ON client_attachments
  FOR DELETE TO authenticated
  USING (tenant_id = get_my_tenant_id());
```

### 2. Corrigir ordem de exclusão no código
No `ClientAttachments.tsx`, inverter a ordem: primeiro deletar o registro da tabela, depois o arquivo do storage. Assim, se o RLS bloquear, o arquivo não é perdido.

```ts
// 1. Delete metadata first (may fail due to RLS)
const { error } = await supabase.from("client_attachments").delete().eq("id", attachment.id);
if (error) throw error;
// 2. Then delete from storage (best-effort)
await supabase.storage.from("client-attachments").remove([attachment.file_path]);
```

## Arquivos alterados
- Nova migration SQL (política RLS)
- `src/components/clients/ClientAttachments.tsx` (ordem de exclusão)

