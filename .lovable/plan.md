

## Fix: Inserting Missing Profile Records

### Root Cause
The `handle_new_user` trigger should create a profile row when a user signs up, but it failed for these two users. They exist in `auth.users` and `tenant_users` but have no row in `profiles`. Since the Users page queries `profiles`, they don't appear.

### Solution
Run a database migration to insert the missing profile records for both users using data from `auth.users` and `tenant_users`.

### Steps

1. **Database migration** -- Insert two rows into `profiles`:

```sql
INSERT INTO public.profiles (user_id, full_name, tenant_id, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  tu.tenant_id,
  'operador'::app_role
FROM auth.users au
JOIN public.tenant_users tu ON tu.user_id = au.id
WHERE au.id IN (
  '2fbda0e8-5f80-4c5d-80f3-39ddc7307a1a',
  'fbdc8c39-f14f-4775-8b88-6b50c6721096'
)
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
);
```

No code changes needed -- after the migration, both users will appear on the Users page immediately.

### Technical Details

| User | auth.users ID | tenant_users | profiles |
|---|---|---|---|
| abadegustavo54@gmail.com | `2fbda0e8-...` | exists (operador) | **missing** |
| sabrinagoncalvesprofissional@gmail.com | `fbdc8c39-...` | exists (operador) | **missing** |

