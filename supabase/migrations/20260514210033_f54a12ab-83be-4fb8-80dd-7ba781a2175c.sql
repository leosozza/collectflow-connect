
CREATE OR REPLACE FUNCTION public.get_dashboard_vencimentos_v2(
  _tenant_id uuid DEFAULT NULL::uuid,
  _target_date date DEFAULT CURRENT_DATE,
  _user_id uuid DEFAULT NULL::uuid,
  _user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  numero_parcela integer,
  total_parcelas integer,
  valor_parcela numeric,
  agreement_status text,
  effective_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant uuid;
  v_no_op_filter boolean;
BEGIN
  -- Resolve tenant: usa _tenant_id se passado e autorizado, senão deriva do auth.uid()
  IF _tenant_id IS NOT NULL AND public.can_access_tenant(_tenant_id) THEN
    v_tenant := _tenant_id;
  ELSE
    SELECT tenant_id INTO v_tenant
    FROM public.tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  v_no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids, 1) IS NULL));

  RETURN QUERY
  SELECT
    a.id AS agreement_id,
    a.client_cpf,
    a.client_name,
    a.credor,
    -- Número de exibição: entrada = 1; parcelas mensais = (entradas + canon)
    (CASE
       WHEN ai.is_entrada THEN 1
       ELSE COALESCE(
         (SELECT count(*)::int FROM public.agreement_installments e
            WHERE e.agreement_id = a.id AND e.is_entrada AND NOT e.cancelled),
         0
       ) + COALESCE(NULLIF(ai.installment_key, '')::int, ai.seq)
     END)::int AS numero_parcela,
    (SELECT count(*)::int FROM public.agreement_installments t
       WHERE t.agreement_id = a.id AND NOT t.cancelled) AS total_parcelas,
    ai.amount AS valor_parcela,
    a.status AS agreement_status,
    CASE
      WHEN ai.paid THEN 'paid'
      WHEN ai.pending_confirmation THEN 'pending'
      WHEN ai.due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END AS effective_status
  FROM public.agreement_installments ai
  JOIN public.agreements a ON a.id = ai.agreement_id
  WHERE ai.tenant_id = v_tenant
    AND a.tenant_id = v_tenant
    AND ai.due_date = _target_date
    AND NOT ai.cancelled
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (
      v_no_op_filter
      OR a.created_by = _user_id
      OR a.created_by = ANY(COALESCE(_user_ids, '{}'::uuid[]))
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_vencimentos_v2(uuid, date, uuid, uuid[]) TO authenticated;
