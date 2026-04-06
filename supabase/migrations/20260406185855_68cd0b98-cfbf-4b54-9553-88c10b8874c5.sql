
CREATE OR REPLACE FUNCTION public.get_carteira_grouped(
  _tenant_id uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50,
  _search text DEFAULT NULL,
  _credor text DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _status_cobranca_ids uuid[] DEFAULT NULL,
  _tipo_devedor_ids uuid[] DEFAULT NULL,
  _tipo_divida_ids uuid[] DEFAULT NULL,
  _score_min integer DEFAULT NULL,
  _score_max integer DEFAULT NULL,
  _debtor_profiles text[] DEFAULT NULL,
  _sort_field text DEFAULT 'created_at',
  _sort_dir text DEFAULT 'desc',
  _operator_id uuid DEFAULT NULL,
  _sem_acordo boolean DEFAULT false,
  _cadastro_de date DEFAULT NULL,
  _cadastro_ate date DEFAULT NULL,
  _sem_whatsapp boolean DEFAULT false
)
RETURNS TABLE(
  representative_id uuid, cpf text, nome_completo text, credor text,
  phone text, email text, data_vencimento date, valor_total numeric,
  valor_pago_total numeric, parcelas_count bigint, propensity_score integer,
  status_cobranca_id uuid, status text, debtor_profile text, operator_id uuid,
  external_id text, all_ids uuid[], total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _offset int;
  _search_words text[];
BEGIN
  _offset := (_page - 1) * _page_size;

  IF _search IS NOT NULL AND _search <> '' THEN
    _search_words := string_to_array(trim(_search), ' ');
    _search_words := array_remove(_search_words, '');
    IF array_length(_search_words, 1) IS NULL THEN
      _search_words := NULL;
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT c.*
    FROM clients c
    WHERE c.tenant_id = _tenant_id
      AND (_search IS NULL OR _search = '' OR _search_words IS NULL OR
           (c.nome_completo ILIKE ALL (SELECT '%' || unnest(_search_words) || '%')) OR
           c.cpf ILIKE '%' || replace(_search, '.', '') || '%' OR
           c.phone ILIKE '%' || _search || '%' OR
           c.phone2 ILIKE '%' || _search || '%' OR
           c.phone3 ILIKE '%' || _search || '%' OR
           c.email ILIKE '%' || _search || '%')
      AND (_credor IS NULL OR _credor = '' OR _credor = 'todos' OR c.credor = _credor)
      AND (_date_from IS NULL OR c.data_vencimento >= _date_from)
      AND (_date_to IS NULL OR c.data_vencimento <= _date_to)
      AND (_status_cobranca_ids IS NULL OR c.status_cobranca_id = ANY(_status_cobranca_ids))
      AND (_tipo_devedor_ids IS NULL OR c.tipo_devedor_id = ANY(_tipo_devedor_ids))
      AND (_tipo_divida_ids IS NULL OR c.tipo_divida_id = ANY(_tipo_divida_ids))
      AND (_debtor_profiles IS NULL OR c.debtor_profile::text = ANY(_debtor_profiles))
      AND (_operator_id IS NULL OR c.operator_id = _operator_id)
      AND (_cadastro_de IS NULL OR c.created_at::date >= _cadastro_de)
      AND (_cadastro_ate IS NULL OR c.created_at::date <= _cadastro_ate)
      AND (_score_min IS NULL OR COALESCE(c.propensity_score, 0) >= _score_min)
      AND (_score_max IS NULL OR COALESCE(c.propensity_score, 0) <= _score_max)
  ),
  grouped AS (
    SELECT
      (array_agg(f.id ORDER BY f.data_vencimento ASC))[1] AS representative_id,
      f.cpf,
      (array_agg(f.nome_completo ORDER BY f.data_vencimento ASC))[1] AS nome_completo,
      f.credor,
      (array_agg(f.phone ORDER BY f.data_vencimento ASC))[1] AS phone,
      (array_agg(f.email ORDER BY f.data_vencimento ASC))[1] AS email,
      MIN(f.data_vencimento)::date AS data_vencimento,
      SUM(COALESCE(f.valor_parcela, 0))::numeric AS valor_total,
      SUM(COALESCE(f.valor_pago, 0))::numeric AS valor_pago_total,
      COUNT(*)::bigint AS parcelas_count,
      MAX(COALESCE(f.propensity_score, 0))::int AS propensity_score,
      (array_agg(f.status_cobranca_id ORDER BY
        CASE f.status
          WHEN 'vencido' THEN 1
          WHEN 'em_acordo' THEN 2
          WHEN 'pendente' THEN 3
          WHEN 'quebrado' THEN 4
          WHEN 'pago' THEN 5
          ELSE 6
        END, f.data_vencimento ASC
      ) FILTER (WHERE f.status_cobranca_id IS NOT NULL))[1] AS status_cobranca_id,
      CASE
        WHEN bool_or(f.status = 'vencido') THEN 'vencido'
        WHEN bool_or(f.status = 'em_acordo') THEN 'em_acordo'
        WHEN bool_or(f.status = 'pendente') THEN 'pendente'
        WHEN bool_or(f.status = 'quebrado') THEN 'quebrado'
        ELSE 'pago'
      END AS status,
      (array_agg(f.debtor_profile ORDER BY f.data_vencimento ASC) FILTER (WHERE f.debtor_profile IS NOT NULL))[1]::text AS debtor_profile,
      (array_agg(f.operator_id ORDER BY f.data_vencimento ASC) FILTER (WHERE f.operator_id IS NOT NULL))[1] AS operator_id,
      (array_agg(f.external_id ORDER BY f.data_vencimento ASC) FILTER (WHERE f.external_id IS NOT NULL))[1] AS external_id,
      array_agg(f.id) AS all_ids,
      MIN(f.created_at) AS first_created_at
    FROM filtered f
    GROUP BY f.cpf, f.credor
  ),
  sem_acordo_filter AS (
    SELECT g.*
    FROM grouped g
    WHERE NOT _sem_acordo OR NOT EXISTS (
      SELECT 1 FROM agreements a
      WHERE a.tenant_id = _tenant_id
        AND a.status IN ('pending', 'approved')
        AND replace(replace(a.client_cpf, '.', ''), '-', '') = replace(replace(g.cpf, '.', ''), '-', '')
        AND a.credor = g.credor
    )
  ),
  sem_whatsapp_filter AS (
    SELECT s.*
    FROM sem_acordo_filter s
    WHERE NOT _sem_whatsapp OR NOT EXISTS (
      SELECT 1 FROM whatsapp_campaign_recipients r
      JOIN clients cl ON cl.id = r.representative_client_id
      WHERE cl.tenant_id = _tenant_id
        AND replace(replace(cl.cpf, '.', ''), '-', '') = replace(replace(s.cpf, '.', ''), '-', '')
        AND cl.credor = s.credor
    )
  ),
  counted AS (
    SELECT *, COUNT(*) OVER() AS total_count
    FROM sem_whatsapp_filter
  )
  SELECT
    c.representative_id, c.cpf, c.nome_completo, c.credor,
    c.phone, c.email, c.data_vencimento, c.valor_total,
    c.valor_pago_total, c.parcelas_count, c.propensity_score,
    c.status_cobranca_id, c.status, c.debtor_profile,
    c.operator_id, c.external_id, c.all_ids, c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN _sort_field = 'created_at' AND _sort_dir = 'desc' THEN c.first_created_at END DESC,
    CASE WHEN _sort_field = 'created_at' AND _sort_dir = 'asc' THEN c.first_created_at END ASC,
    CASE WHEN _sort_field = 'data_vencimento' AND _sort_dir = 'desc' THEN c.data_vencimento END DESC,
    CASE WHEN _sort_field = 'data_vencimento' AND _sort_dir = 'asc' THEN c.data_vencimento END ASC,
    CASE WHEN _sort_field = 'nome_completo' AND _sort_dir = 'asc' THEN c.nome_completo END ASC,
    CASE WHEN _sort_field = 'nome_completo' AND _sort_dir = 'desc' THEN c.nome_completo END DESC,
    c.first_created_at DESC
  OFFSET _offset
  LIMIT _page_size;
END;
$function$;
