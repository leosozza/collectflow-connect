UPDATE public.permission_profiles
SET permissions = jsonb_set(
  permissions,
  '{financeiro}',
  '["view","view_all","manage"]'::jsonb
)
WHERE base_role IN ('admin','gerente','supervisor')
  AND is_default = true
  AND NOT (COALESCE(permissions->'financeiro', '[]'::jsonb) ? 'view_all');