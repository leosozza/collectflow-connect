-- Recálculo retroativo Abr/2026 com a fonte canônica corrigida
DO $$
DECLARE
  _tid uuid := '39a450f8-7a40-46e5-8bc7-708da5043ec7';
  _ms date := '2026-04-01';
  _me date := '2026-05-01';
  _y int := 2026;
  _m int := 4;
  _w_payment int; _u_total int; _w_total int;
  _w_created int; _w_paid int; _w_break int; _w_ach int; _w_goal int;
  _op record;
  _manual_count int; _manual_total numeric;
  _neg_count int; _neg_total numeric;
  _payments_count int; _total_received numeric;
  _created_count int; _paid_count int; _break_count int; _ach_count int;
  _goal numeric; _goal_reached boolean; _points int;
BEGIN
  SELECT
    COALESCE(MAX(CASE WHEN metric='payment_count'        AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='total_received'       AND enabled THEN unit_size END),100),
    COALESCE(MAX(CASE WHEN metric='total_received'       AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='agreement_created'    AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='agreement_paid'       AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='agreement_break'      AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='achievement_unlocked' AND enabled THEN points END),0),
    COALESCE(MAX(CASE WHEN metric='goal_reached'         AND enabled THEN points END),0)
  INTO _w_payment,_u_total,_w_total,_w_created,_w_paid,_w_break,_w_ach,_w_goal
  FROM public.gamification_scoring_rules WHERE tenant_id=_tid;
  IF _u_total IS NULL OR _u_total<=0 THEN _u_total:=100; END IF;

  FOR _op IN
    SELECT id AS profile_id, user_id FROM public.profiles
    WHERE tenant_id=_tid
      AND id IN ('030fd18d-a40b-4ff8-ad27-7778d8331720',
                 '7873f5e6-5786-4b26-8820-1cd77f4490bc',
                 'c176575c-7860-4640-a776-446414bd553e',
                 'c734c47b-a45b-407f-b490-df6138cb5b6f')
  LOOP
    SELECT COUNT(*), COALESCE(SUM(mp.amount_paid),0)
      INTO _manual_count, _manual_total
    FROM public.manual_payments mp JOIN public.agreements a ON a.id=mp.agreement_id
    WHERE mp.tenant_id=_tid AND mp.status='confirmed' AND a.created_by=_op.user_id
      AND mp.payment_date>=_ms AND mp.payment_date<_me;

    SELECT COUNT(*), COALESCE(SUM(nc.valor_pago),0)
      INTO _neg_count, _neg_total
    FROM public.negociarie_cobrancas nc JOIN public.agreements a ON a.id=nc.agreement_id
    WHERE a.tenant_id=_tid AND nc.status='pago' AND a.created_by=_op.user_id
      AND nc.data_pagamento>=_ms AND nc.data_pagamento<_me;

    _payments_count := _manual_count + _neg_count;
    _total_received := _manual_total + _neg_total;

    SELECT COUNT(*) INTO _created_count FROM public.agreements
      WHERE tenant_id=_tid AND created_by=_op.user_id
        AND status NOT IN ('cancelled','rejected')
        AND created_at>=_ms AND created_at<_me;
    SELECT COUNT(*) INTO _paid_count FROM public.agreements
      WHERE tenant_id=_tid AND created_by=_op.user_id
        AND status='completed' AND updated_at>=_ms AND updated_at<_me;
    SELECT COUNT(*) INTO _break_count FROM public.agreements
      WHERE tenant_id=_tid AND created_by=_op.user_id
        AND status='cancelled' AND updated_at>=_ms AND updated_at<_me;
    SELECT COUNT(*) INTO _ach_count FROM public.achievements
      WHERE profile_id=_op.profile_id AND tenant_id=_tid;
    SELECT COALESCE(SUM(target_amount),0) INTO _goal FROM public.operator_goals
      WHERE tenant_id=_tid AND operator_id=_op.profile_id AND year=_y AND month=_m;

    _goal_reached := (_goal>0 AND _total_received>=_goal);

    _points := GREATEST(0,
        _payments_count * _w_payment
      + FLOOR(_total_received/_u_total)::int * _w_total
      + _created_count * _w_created
      + _paid_count    * _w_paid
      + _break_count   * _w_break
      + _ach_count     * _w_ach
      + (CASE WHEN _goal_reached THEN _w_goal ELSE 0 END));

    INSERT INTO public.operator_points
      (tenant_id, operator_id, year, month, points, payments_count, breaks_count, total_received, updated_at)
    VALUES (_tid, _op.profile_id, _y, _m, _points, _payments_count, _break_count, _total_received, now())
    ON CONFLICT (tenant_id, operator_id, year, month) DO UPDATE
      SET points=EXCLUDED.points,
          payments_count=EXCLUDED.payments_count,
          breaks_count=EXCLUDED.breaks_count,
          total_received=EXCLUDED.total_received,
          updated_at=now();
  END LOOP;
END $$;