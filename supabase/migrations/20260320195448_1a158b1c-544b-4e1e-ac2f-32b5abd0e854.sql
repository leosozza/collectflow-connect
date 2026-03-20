
-- 1. Create gamification_participants table
CREATE TABLE public.gamification_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);

ALTER TABLE public.gamification_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage gamification participants"
ON public.gamification_participants
FOR ALL
TO authenticated
USING (tenant_id = public.get_my_tenant_id())
WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "Users can view own tenant participants"
ON public.gamification_participants
FOR SELECT
TO authenticated
USING (tenant_id = public.get_my_tenant_id());

-- 2. Fix get_dashboard_stats: use COALESCE for entrada_date
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_user_id uuid DEFAULT NULL::uuid, _year integer DEFAULT NULL::integer, _month integer DEFAULT NULL::integer)
 RETURNS TABLE(total_projetado numeric, total_negociado numeric, total_negociado_mes numeric, total_recebido numeric, total_quebra numeric, total_pendente numeric, acordos_dia bigint, acordos_mes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _now timestamp with time zone := now();
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM _now)::int);
  _target_month int := COALESCE(_month, EXTRACT(MONTH FROM _now)::int);
  _month_start date;
  _month_end date;
  _today date := CURRENT_DATE;
  _projetado numeric := 0;
  _negociado numeric := 0;
  _negociado_mes numeric := 0;
  _recebido numeric := 0;
  _quebra numeric := 0;
  _pendente numeric := 0;
  _dia bigint := 0;
  _mes bigint := 0;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;

  -- Colchão de Acordos: parcelas com vencimento no mês de acordos criados ANTES do mês
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _projetado
  FROM (
    SELECT a.entrada_value AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT a.new_installment_value AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved')
      AND a.created_at::date < _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- Total Primeira Parcela
  SELECT COALESCE(SUM(
    CASE WHEN a.entrada_value > 0 THEN a.entrada_value ELSE a.new_installment_value END
  ), 0) INTO _negociado
  FROM agreements a
  WHERE a.tenant_id = _tenant
    AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
    AND a.status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR a.created_by = _user_id);

  -- Total Negociado no Mês
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _negociado_mes
  FROM (
    SELECT a.entrada_value AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND a.entrada_value > 0
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT a.new_installment_value AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status NOT IN ('cancelled', 'rejected')
      AND a.created_at::date >= _month_start AND a.created_at::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- Total Recebido
  SELECT COALESCE(SUM(c.valor_pago), 0) INTO _recebido
  FROM clients c
  WHERE c.tenant_id = _tenant
    AND c.data_quitacao IS NOT NULL
    AND c.data_quitacao::date >= _month_start
    AND c.data_quitacao::date <= _month_end
    AND EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.tenant_id = _tenant
        AND REPLACE(REPLACE(a.client_cpf, '.', ''), '-', '') = REPLACE(REPLACE(c.cpf, '.', ''), '-', '')
        AND (_user_id IS NULL OR a.created_by = _user_id)
    );

  -- Total Quebra
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _quebra
  FROM (
    SELECT a.entrada_value AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT a.new_installment_value AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status = 'cancelled'
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- Pendentes
  SELECT COALESCE(SUM(parcela_valor), 0) INTO _pendente
  FROM (
    SELECT a.entrada_value AS parcela_valor
    FROM agreements a
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND a.entrada_value > 0
      AND COALESCE(a.entrada_date, a.first_due_date) >= _month_start
      AND COALESCE(a.entrada_date, a.first_due_date) <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
    UNION ALL
    SELECT a.new_installment_value AS parcela_valor
    FROM agreements a
    CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    WHERE a.tenant_id = _tenant
      AND a.status IN ('pending', 'approved', 'overdue')
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date >= _month_start
      AND (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date <= _month_end
      AND (_user_id IS NULL OR a.created_by = _user_id)
  ) sub;

  -- Acordos do dia
  SELECT COUNT(*) INTO _dia
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date = _today
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  -- Acordos do mês
  SELECT COUNT(*) INTO _mes
  FROM agreements
  WHERE tenant_id = _tenant
    AND created_at::date >= _month_start AND created_at::date <= _month_end
    AND status NOT IN ('cancelled', 'rejected')
    AND (_user_id IS NULL OR created_by = _user_id);

  RETURN QUERY SELECT _projetado, _negociado, _negociado_mes, _recebido, _quebra, _pendente, _dia, _mes;
END;
$function$;
