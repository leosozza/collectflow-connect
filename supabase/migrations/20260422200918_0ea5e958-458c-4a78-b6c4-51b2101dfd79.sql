
WITH single_owner AS (
  SELECT instance_id, (array_agg(profile_id))[1] AS profile_id
  FROM public.operator_instances
  GROUP BY instance_id
  HAVING COUNT(*) = 1
)
UPDATE public.conversations c
SET assigned_to = so.profile_id
FROM single_owner so
WHERE c.assigned_to IS NULL
  AND COALESCE(c.endpoint_id, c.instance_id) = so.instance_id
  AND (
    c.client_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.clients cl
      WHERE cl.id = c.client_id
        AND cl.operator_id IS NOT NULL
        AND cl.operator_id <> so.profile_id
    )
  );
