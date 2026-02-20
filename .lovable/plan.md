
## Root Cause

The error is **not** from the Evolution API — it is a PostgreSQL foreign key constraint violation. The `conversations` table has a column `instance_id` with a foreign key referencing `whatsapp_instances(id)`, defined without `ON DELETE CASCADE`. When attempting to delete a `whatsapp_instances` row that still has associated conversations, Postgres blocks the operation.

```
update or delete on table "whatsapp_instances" violates foreign key constraint
"conversations_instance_id_fkey" on table "conversations"
```

The UI already shows a conversation count badge (💬 N ativas), confirming conversations are linked. The `handleDelete` function in `BaylersInstancesList.tsx` tries to call `deleteWhatsAppInstance(deleteTarget.id)` directly, which hits this constraint.

## Solution

Two complementary fixes:

### 1. Database Migration — Alter foreign key to ON DELETE SET NULL

The safest approach for a messaging system is to use `ON DELETE SET NULL` on `conversations.instance_id`. This allows deleting an instance while preserving conversation history (messages remain visible but the instance reference becomes null). Using `ON DELETE CASCADE` would delete ALL conversations and messages when an instance is deleted, which is destructive and irreversible.

Migration SQL:
```sql
-- Drop old constraint
ALTER TABLE public.conversations
  DROP CONSTRAINT conversations_instance_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES public.whatsapp_instances(id)
  ON DELETE SET NULL;
```

`instance_id` in `conversations` is already `NOT NULL` based on the schema — it needs to also become nullable for `SET NULL` to work. So the migration must also:
```sql
ALTER TABLE public.conversations
  ALTER COLUMN instance_id DROP NOT NULL;
```

### 2. UI Improvement — Warn user about linked conversations in the delete dialog

Update `BaylersInstancesList.tsx` to show a stronger warning in the `AlertDialogDescription` when the instance has active conversations, informing the user that conversations will be preserved but unlinked from the instance.

The current alert dialog description is generic. It should display something like:
> "Esta instância possui 3 conversa(s) ativa(s). As conversas serão preservadas mas desvinculadas da instância."

This uses the existing `conversationCounts[deleteTarget.id]` data already loaded by the component.

## Files to Modify

| File | Change |
|---|---|
| `supabase/migrations/[new].sql` | Drop and recreate FK as `ON DELETE SET NULL`; make `instance_id` nullable |
| `src/components/integracao/BaylersInstancesList.tsx` | Improve delete dialog warning to show conversation count |

## Why SET NULL instead of CASCADE?

- `ON DELETE CASCADE` would **permanently destroy** all conversations and messages when an instance is removed — unacceptable for a CRM/collections platform where message history is critical evidence.
- `ON DELETE SET NULL` preserves all history; conversations without an instance simply show no instance attribution, which is a graceful degradation.
- The `instance_id` column in `conversations` must become nullable (currently `NOT NULL`) to support `SET NULL`.
