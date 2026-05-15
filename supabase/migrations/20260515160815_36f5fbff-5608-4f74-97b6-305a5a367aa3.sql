
-- PASSO 1
CREATE OR REPLACE FUNCTION public.map_canonical_to_legacy_status(_canonical text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _canonical
    WHEN 'quitado'          THEN 'Quitado'
    WHEN 'em_dia'           THEN 'Em Dia'
    WHEN 'inadimplente'     THEN 'Inadimplente'
    WHEN 'acordo_vigente'   THEN 'Acordo Vigente'
    WHEN 'acordo_atrasado'  THEN 'Acordo em Atraso'
    WHEN 'acordo_cancelado' THEN 'Acordo Cancelado'
    WHEN 'acordo_quitado'   THEN 'Acordo Quitado'
    ELSE NULL
  END;
$$;

-- PASSO 2
CREATE OR REPLACE FUNCTION public.get_client_consolidated_status(
  _tenant_id uuid,
  _cpf text,
  _credor text,
  _atraso_quebra_dias integer DEFAULT NULL
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _cpf_norm text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _prazo int;
  _ag_state text := NULL;
  _has_clients_rows bool := false;
  _has_open_debt bool := false;
  _has_overdue_debt bool := false;
BEGIN
  IF _atraso_quebra_dias IS NULL THEN
    SELECT COALESCE(c.prazo_dias_acordo, 10) INTO _prazo
    FROM credores c
    WHERE c.tenant_id = _tenant_id
      AND (c.razao_social = _credor OR c.nome_fantasia = _credor)
    LIMIT 1;
    _prazo := COALESCE(_prazo, 10);
  ELSE
    _prazo := _atraso_quebra_dias;
  END IF;

  WITH ag AS (
    SELECT a.id, a.status AS agreement_status
    FROM agreements a
    WHERE a.tenant_id = _tenant_id
      AND regexp_replace(a.client_cpf, '\D', '', 'g') = _cpf_norm
      AND a.credor = _credor
      AND a.status IN ('approved', 'completed', 'cancelled')
  ),
  per_ag AS (
    SELECT ag.id, ag.agreement_status,
      COUNT(*) FILTER (WHERE NOT ai.cancelled) AS total_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND ai.paid) AS paid_active,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS overdue_active,
      MAX(_today - ai.due_date) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS max_overdue_days
    FROM ag LEFT JOIN agreement_installments ai ON ai.agreement_id = ag.id
    GROUP BY ag.id, ag.agreement_status
  ),
  classified AS (
    SELECT CASE
      WHEN agreement_status = 'completed' THEN 'acordo_quitado'
      WHEN total_active > 0 AND paid_active = total_active THEN 'acordo_quitado'
      WHEN agreement_status = 'cancelled' THEN 'acordo_cancelado'
      WHEN overdue_active > 0 AND COALESCE(max_overdue_days, 0) > _prazo THEN 'acordo_cancelado'
      WHEN overdue_active > 0 THEN 'acordo_atrasado'
      WHEN agreement_status = 'approved' THEN 'acordo_vigente'
      ELSE NULL
    END AS state
    FROM per_ag
  )
  SELECT CASE
    WHEN bool_or(state = 'acordo_vigente')   THEN 'acordo_vigente'
    WHEN bool_or(state = 'acordo_atrasado')  THEN 'acordo_atrasado'
    WHEN bool_or(state = 'acordo_cancelado') THEN 'acordo_cancelado'
    WHEN bool_or(state = 'acordo_quitado')   THEN 'acordo_quitado'
    ELSE NULL END
  INTO _ag_state FROM classified;

  IF _ag_state IS NOT NULL THEN RETURN _ag_state; END IF;

  SELECT
    bool_or(true),
    bool_or(c.status NOT IN ('pago', 'cancelado_maxlist')),
    bool_or(c.status NOT IN ('pago', 'cancelado_maxlist') AND c.data_vencimento < _today)
  INTO _has_clients_rows, _has_open_debt, _has_overdue_debt
  FROM clients c
  WHERE c.tenant_id = _tenant_id
    AND regexp_replace(c.cpf, '\D', '', 'g') = _cpf_norm
    AND c.credor = _credor;

  IF NOT COALESCE(_has_clients_rows, false) THEN RETURN 'em_dia'; END IF;
  IF NOT COALESCE(_has_open_debt, false) THEN RETURN 'quitado'; END IF;
  IF _has_overdue_debt THEN RETURN 'inadimplente'; END IF;
  RETURN 'em_dia';
END;
$function$;

-- PASSO 3 — UNIQUE
DO $$
BEGIN
  DELETE FROM public.tipos_status a USING public.tipos_status b
   WHERE a.id < b.id AND a.tenant_id = b.tenant_id AND a.nome = b.nome;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_status_tenant_nome_key') THEN
    ALTER TABLE public.tipos_status ADD CONSTRAINT tipos_status_tenant_nome_key UNIQUE (tenant_id, nome);
  END IF;
END $$;

-- PASSO 4 — Limpar obsoletos
UPDATE public.clients SET status_cobranca_id = NULL
 WHERE status_cobranca_id IN (
   SELECT id FROM public.tipos_status
   WHERE nome IN ('Risco de Processo', 'Em negociação', 'Em Negociação')
 );
DELETE FROM public.tipos_status
 WHERE nome IN ('Risco de Processo', 'Em negociação', 'Em Negociação');

-- PASSO 5 — Mesclar e renomear legados
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT old.id AS old_id, new.id AS new_id
    FROM public.tipos_status old
    JOIN public.tipos_status new
      ON new.tenant_id = old.tenant_id
     AND new.nome = CASE old.nome
            WHEN 'Quebra de Acordo' THEN 'Acordo Cancelado'
            WHEN 'Acordo Atrasado'  THEN 'Acordo em Atraso'
            WHEN 'Em dia'           THEN 'Em Dia'
          END
    WHERE old.nome IN ('Quebra de Acordo', 'Acordo Atrasado', 'Em dia')
  LOOP
    UPDATE public.clients SET status_cobranca_id = r.new_id WHERE status_cobranca_id = r.old_id;
    DELETE FROM public.tipos_status WHERE id = r.old_id;
  END LOOP;
END $$;

UPDATE public.tipos_status
SET nome = CASE nome
  WHEN 'Quebra de Acordo' THEN 'Acordo Cancelado'
  WHEN 'Acordo Atrasado'  THEN 'Acordo em Atraso'
  WHEN 'Em dia'           THEN 'Em Dia'
END
WHERE nome IN ('Quebra de Acordo', 'Acordo Atrasado', 'Em dia');

-- PASSO 6 — UPSERT 7 oficiais
INSERT INTO public.tipos_status (tenant_id, nome, descricao, cor, regras)
SELECT t.id, s.nome, s.descricao, s.cor, s.regras::jsonb
FROM public.tenants t
CROSS JOIN (VALUES
  ('Quitado',          'Dívida original totalmente paga',                     '#0ea5e9', '{"papel_sistema":"quitado","somente_leitura":true}'),
  ('Em Dia',           'Cliente com parcelas a vencer, nenhuma vencida',      '#22c55e', '{"papel_sistema":"em_dia"}'),
  ('Inadimplente',     'Parcelas vencidas em aberto, sem acordo na história', '#6b7280', '{"papel_sistema":"inadimplente"}'),
  ('Acordo Vigente',   'Acordo aprovado em dia',                              '#3b82f6', '{"papel_sistema":"acordo_vigente","bloqueio":true,"apenas_responsavel":true}'),
  ('Acordo em Atraso', 'Parcela do acordo vencida dentro do prazo',           '#f97316', '{"papel_sistema":"acordo_atrasado"}'),
  ('Acordo Cancelado', 'Atraso > prazo OU cancelado manualmente (terminal)',  '#ef4444', '{"papel_sistema":"acordo_cancelado"}'),
  ('Acordo Quitado',   'Todas as parcelas do acordo foram pagas',             '#28cc39', '{"papel_sistema":"acordo_quitado"}')
) AS s(nome, descricao, cor, regras)
WHERE t.status = 'active'
ON CONFLICT (tenant_id, nome) DO UPDATE
  SET descricao = EXCLUDED.descricao, cor = EXCLUDED.cor, regras = EXCLUDED.regras;

-- PASSO 7 — defensivo
DELETE FROM public.tipos_status a USING public.tipos_status b
 WHERE a.id < b.id AND a.tenant_id = b.tenant_id AND a.nome = b.nome;
