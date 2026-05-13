-- Fase 5.1: get_dashboard_stats_v2 - substitui APENAS _recebido por SSOT
-- Demais cálculos idênticos a get_dashboard_stats (preserva regras legadas validadas)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(
  _user_id uuid DEFAULT NULL,
  _year integer DEFAULT NULL,
  _month integer DEFAULT NULL,
  _user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  total_projetado numeric, total_negociado numeric, total_negociado_mes numeric,
  total_recebido numeric, total_quebra numeric, total_pendente numeric,
  acordos_dia bigint, acordos_mes bigint, acionados_ontem bigint,
  acordos_dia_anterior bigint, acordos_mes_anterior bigint,
  total_negociado_mes_anterior numeric, total_recebido_mes_anterior numeric,
  total_quebra_mes_anterior numeric, total_pendente_mes_anterior numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _today date := CURRENT_DATE;
  _target_year int := COALESCE(_year, EXTRACT(YEAR FROM _today)::int);
  _target_month int := COALESCE(_month, EXTRACT(MONTH FROM _today)::int);
  _month_start date;
  _month_end date;
  _prev_month_start date;
  _prev_month_last date;
  _prev_month_end date;
  _is_current_month boolean;
  _day_cutoff int;
  _no_op_filter boolean;
  _recebido_ssot numeric := 0;
  _recebido_ant_ssot numeric := 0;
  legacy record;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.tenant_users WHERE user_id = auth.uid() LIMIT 1;
  IF _tenant IS NULL THEN
    RETURN QUERY SELECT 0::numeric,0::numeric,0::numeric,0::numeric,0::numeric,0::numeric,
                        0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
                        0::numeric,0::numeric,0::numeric,0::numeric;
    RETURN;
  END IF;

  _no_op_filter := (_user_id IS NULL AND (_user_ids IS NULL OR array_length(_user_ids,1) IS NULL));
  _month_start := make_date(_target_year, _target_month, 1);
  _month_end := (_month_start + interval '1 month' - interval '1 day')::date;
  _prev_month_start := (_month_start - interval '1 month')::date;
  _prev_month_last := (_month_start - interval '1 day')::date;
  _is_current_month := (_target_year = EXTRACT(YEAR FROM _today)::int
                        AND _target_month = EXTRACT(MONTH FROM _today)::int);
  IF _is_current_month THEN
    _day_cutoff := EXTRACT(DAY FROM _today)::int;
    _prev_month_end := LEAST(
      (_prev_month_start + ((_day_cutoff - 1) || ' days')::interval)::date,
      _prev_month_last
    );
  ELSE
    _prev_month_end := _prev_month_last;
  END IF;

  -- Recebido via SSOT (agreement_installments). Considera fuso de São Paulo na data de pagamento.
  SELECT COALESCE(SUM(COALESCE(ai.paid_amount, ai.amount, 0)), 0)
  INTO _recebido_ssot
  FROM public.agreement_installments ai
  JOIN public.agreements a ON a.id = ai.agreement_id
  WHERE ai.tenant_id = _tenant
    AND ai.paid = true
    AND ai.cancelled = false
    AND ai.paid_at IS NOT NULL
    AND (ai.paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _month_start AND _month_end
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  SELECT COALESCE(SUM(COALESCE(ai.paid_amount, ai.amount, 0)), 0)
  INTO _recebido_ant_ssot
  FROM public.agreement_installments ai
  JOIN public.agreements a ON a.id = ai.agreement_id
  WHERE ai.tenant_id = _tenant
    AND ai.paid = true
    AND ai.cancelled = false
    AND ai.paid_at IS NOT NULL
    AND (ai.paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN _prev_month_start AND _prev_month_end
    AND (_no_op_filter OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])));

  -- Reaproveita os demais cálculos da função legada
  SELECT * INTO legacy FROM public.get_dashboard_stats(_user_id, _year, _month, _user_ids);

  RETURN QUERY SELECT
    legacy.total_projetado,
    legacy.total_negociado,
    legacy.total_negociado_mes,
    _recebido_ssot,
    legacy.total_quebra,
    legacy.total_pendente,
    legacy.acordos_dia,
    legacy.acordos_mes,
    legacy.acionados_ontem,
    legacy.acordos_dia_anterior,
    legacy.acordos_mes_anterior,
    legacy.total_negociado_mes_anterior,
    _recebido_ant_ssot,
    legacy.total_quebra_mes_anterior,
    legacy.total_pendente_mes_anterior;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_v2(uuid, integer, integer, uuid[]) TO authenticated;