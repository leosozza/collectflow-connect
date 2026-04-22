-- 1) Coluna rule_type em collection_rules
ALTER TABLE public.collection_rules
ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'wallet'
CHECK (rule_type IN ('wallet', 'agreement'));

CREATE INDEX IF NOT EXISTS idx_collection_rules_type_active
ON public.collection_rules(tenant_id, rule_type, is_active);

COMMENT ON COLUMN public.collection_rules.rule_type IS
'wallet = lembrete sobre título original da carteira; agreement = lembrete sobre parcela de acordo gerado';

-- 2) RPC get_rule_eligible_targets
CREATE OR REPLACE FUNCTION public.get_rule_eligible_targets(
  p_rule_id uuid,
  p_target_date date
)
RETURNS TABLE(
  source text,
  client_id uuid,
  cpf text,
  nome_completo text,
  phone text,
  email text,
  credor text,
  valor numeric,
  data_vencimento date,
  agreement_id uuid,
  installment_key text,
  installment_number int,
  total_installments int,
  installment_value numeric,
  installment_due_date date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rule record;
  _credor_name text;
BEGIN
  SELECT cr.* INTO _rule
  FROM public.collection_rules cr
  WHERE cr.id = p_rule_id AND cr.is_active = true;

  IF _rule IS NULL THEN
    RETURN;
  END IF;

  -- Resolve credor name (regras são por credor_id, clients armazena pelo nome)
  IF _rule.credor_id IS NOT NULL THEN
    SELECT razao_social INTO _credor_name
    FROM public.credores
    WHERE id = _rule.credor_id;
  END IF;

  IF _rule.rule_type = 'wallet' THEN
    -- Universo A: títulos da carteira sem acordo ativo
    RETURN QUERY
    SELECT
      'wallet'::text AS source,
      c.id AS client_id,
      c.cpf,
      c.nome_completo,
      c.phone,
      c.email,
      c.credor,
      c.valor_parcela AS valor,
      c.data_vencimento,
      NULL::uuid AS agreement_id,
      NULL::text AS installment_key,
      NULL::int AS installment_number,
      NULL::int AS total_installments,
      NULL::numeric AS installment_value,
      NULL::date AS installment_due_date
    FROM public.clients c
    WHERE c.tenant_id = _rule.tenant_id
      AND (_credor_name IS NULL OR c.credor = _credor_name)
      AND c.data_vencimento = p_target_date
      AND c.status IN ('pendente', 'vencido')
      AND NOT EXISTS (
        SELECT 1 FROM public.agreements a
        WHERE a.tenant_id = _rule.tenant_id
          AND a.status IN ('pending', 'approved')
          AND regexp_replace(a.client_cpf, '\D', '', 'g') = regexp_replace(c.cpf, '\D', '', 'g')
          AND (_credor_name IS NULL OR a.credor = _credor_name)
      );

  ELSIF _rule.rule_type = 'agreement' THEN
    -- Universo B: parcelas de acordos ativos
    RETURN QUERY
    WITH active_agreements AS (
      SELECT a.*
      FROM public.agreements a
      WHERE a.tenant_id = _rule.tenant_id
        AND a.status IN ('pending', 'approved')
        AND (_credor_name IS NULL OR a.credor = _credor_name)
    ),
    expanded AS (
      -- Entrada
      SELECT
        a.id AS agreement_id,
        a.client_cpf,
        a.client_name,
        a.credor,
        'entrada'::text AS installment_key,
        0 AS installment_number,
        a.new_installments AS total_installments,
        COALESCE((a.custom_installment_values->>'entrada')::numeric, a.entrada_value) AS installment_value,
        COALESCE(a.entrada_date, a.first_due_date) AS due_date
      FROM active_agreements a
      WHERE a.entrada_value > 0

      UNION ALL

      -- Parcelas regulares
      SELECT
        a.id,
        a.client_cpf,
        a.client_name,
        a.credor,
        gs.i::text AS installment_key,
        gs.i::int AS installment_number,
        a.new_installments AS total_installments,
        COALESCE((a.custom_installment_values->>gs.i::text)::numeric, a.new_installment_value) AS installment_value,
        COALESCE(
          (a.custom_installment_dates->>gs.i::text)::date,
          (a.first_due_date + ((gs.i - 1) * interval '1 month'))::date
        ) AS due_date
      FROM active_agreements a
      CROSS JOIN LATERAL generate_series(1, a.new_installments) AS gs(i)
    ),
    eligible AS (
      SELECT e.*
      FROM expanded e
      WHERE e.due_date = p_target_date
        -- Exclui parcelas já pagas (manual_payments confirmados)
        AND NOT EXISTS (
          SELECT 1 FROM public.manual_payments mp
          WHERE mp.agreement_id = e.agreement_id
            AND mp.status = 'confirmed'
            AND COALESCE(mp.installment_key, mp.installment_number::text) = e.installment_key
        )
        -- Exclui parcelas já pagas via cobrancas
        AND NOT EXISTS (
          SELECT 1 FROM public.cobrancas cb
          WHERE cb.agreement_id = e.agreement_id
            AND cb.status IN ('pago', 'RECEIVED', 'CONFIRMED', 'paid')
            AND COALESCE(cb.installment_key, cb.installment_number::text) = e.installment_key
        )
    )
    SELECT
      'agreement'::text AS source,
      cl.id AS client_id,
      e.client_cpf AS cpf,
      COALESCE(cl.nome_completo, e.client_name) AS nome_completo,
      cl.phone,
      cl.email,
      e.credor,
      e.installment_value AS valor,
      e.due_date AS data_vencimento,
      e.agreement_id,
      e.installment_key,
      e.installment_number,
      e.total_installments,
      e.installment_value,
      e.due_date AS installment_due_date
    FROM eligible e
    LEFT JOIN LATERAL (
      SELECT id, nome_completo, phone, email
      FROM public.clients
      WHERE tenant_id = _rule.tenant_id
        AND regexp_replace(cpf, '\D', '', 'g') = regexp_replace(e.client_cpf, '\D', '', 'g')
        AND credor = e.credor
      ORDER BY data_vencimento ASC
      LIMIT 1
    ) cl ON true;
  END IF;
END;
$function$;