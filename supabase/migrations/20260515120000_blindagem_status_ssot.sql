-- Migração: Blindagem de Status SSOT (7 Status Oficiais)
-- Objetivo: Unificar a lógica de status para Dívida Original vs Acordo Rivo

-- 1. Garantir que os tipos de status existam com os nomes e cores oficiais
-- Esta parte será dinâmica via função para todos os tenants
CREATE OR REPLACE FUNCTION public.sync_tenant_official_statuses(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Inserir ou atualizar os 7 status oficiais
  INSERT INTO public.tipos_status (tenant_id, nome, cor, regras)
  VALUES 
    (_tenant_id, 'Quitado', '#2497fd', '{"papel_sistema": "quitado"}'::jsonb),
    (_tenant_id, 'Em Dia', '#8ebd00', '{"papel_sistema": "em_dia"}'::jsonb),
    (_tenant_id, 'Inadimplente', '#de2128', '{"papel_sistema": "inadimplente"}'::jsonb),
    (_tenant_id, 'Acordo Vigente', '#1abcad', '{"papel_sistema": "acordo_vigente"}'::jsonb),
    (_tenant_id, 'Acordo em Atraso', '#f17f0e', '{"papel_sistema": "acordo_atrasado"}'::jsonb),
    (_tenant_id, 'Acordo Cancelado', '#111111', '{"papel_sistema": "acordo_cancelado"}'::jsonb),
    (_tenant_id, 'Acordo Quitado', '#28cc39', '{"papel_sistema": "acordo_quitado"}'::jsonb)
  ON CONFLICT (tenant_id, nome) DO UPDATE 
  SET cor = EXCLUDED.cor, regras = EXCLUDED.regras;

  -- Marcar status antigos (Risco de Processo, Em Negociação) como inativos ou remover (opcional)
  -- Aqui apenas removemos da lógica principal de SSOT
END;
$$;

-- Executar para todos os tenants existentes
DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    PERFORM public.sync_tenant_official_statuses(t_id);
  END LOOP;
END $$;

-- 2. Atualizar a lógica do Cofre de Status (get_client_consolidated_status)
CREATE OR REPLACE FUNCTION public.get_client_consolidated_status(
  _tenant_id uuid,
  _cpf text,
  _credor text,
  _atraso_quebra_dias int DEFAULT NULL -- Usará o do credor se null
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf_norm text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _prazo_credor int;
  _worst_state text := NULL;
  _has_open_debt bool := false;
  _has_overdue_debt bool := false;
BEGIN
  -- Buscar prazo do credor
  SELECT COALESCE(_atraso_quebra_dias, prazo_dias_acordo, 10)
  INTO _prazo_credor
  FROM credores
  WHERE tenant_id = _tenant_id 
    AND (razao_social = _credor OR nome_fantasia = _credor)
  LIMIT 1;

  -- 1. Verificar ACORDOS (Prioridade Máxima)
  -- Buscamos o estado do acordo mais "relevante" (Vigente > Atrasado > Cancelado)
  WITH ag_data AS (
    SELECT 
      a.id, a.status,
      COUNT(*) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS overdue_count,
      MAX(_today - ai.due_date) FILTER (WHERE NOT ai.cancelled AND NOT ai.paid AND ai.due_date < _today) AS max_days
    FROM agreements a
    LEFT JOIN agreement_installments ai ON ai.agreement_id = a.id
    WHERE a.tenant_id = _tenant_id
      AND regexp_replace(a.client_cpf, '\D', '', 'g') = _cpf_norm
      AND a.credor = _credor
      AND a.status IN ('pending', 'approved', 'completed', 'cancelled')
    GROUP BY a.id, a.status
  ),
  classified AS (
    SELECT 
      CASE 
        WHEN status = 'completed' THEN 'acordo_quitado'
        WHEN status = 'cancelled' THEN 'acordo_cancelado'
        WHEN overdue_count > 0 AND max_days > _prazo_credor THEN 'acordo_cancelado'
        WHEN overdue_count > 0 THEN 'acordo_atrasado'
        ELSE 'acordo_vigente'
      END AS state
    FROM ag_data
  )
  SELECT state INTO _worst_state
  FROM classified
  ORDER BY 
    CASE state
      WHEN 'acordo_atrasado' THEN 1
      WHEN 'acordo_vigente' THEN 2
      WHEN 'acordo_cancelado' THEN 3
      WHEN 'acordo_quitado' THEN 4
      ELSE 5
    END
  LIMIT 1;

  -- Se existe um acordo ativo ou relevante, ele domina o status
  IF _worst_state IS NOT NULL AND _worst_state NOT IN ('acordo_cancelado', 'acordo_quitado') THEN
    RETURN _worst_state;
  END IF;

  -- 2. Verificar DÍVIDA ORIGINAL (Se não há acordo ou se ele acabou/cancelou)
  SELECT
    bool_or(c.status NOT IN ('pago')),
    bool_or(c.status NOT IN ('pago') AND c.data_vencimento < _today)
  INTO _has_open_debt, _has_overdue_debt
  FROM clients c
  WHERE c.tenant_id = _tenant_id
    AND regexp_replace(c.cpf, '\D', '', 'g') = _cpf_norm
    AND c.credor = _credor;

  -- Caso: Tudo Pago
  IF NOT COALESCE(_has_open_debt, false) THEN
    -- Se teve um acordo quitado, mantém acordo_quitado, senão quitado (dívida original)
    RETURN COALESCE(_worst_state, 'quitado');
  END IF;

  -- Caso: Inadimplente (Dívida original ou acordo cancelado)
  IF _has_overdue_debt OR _worst_state = 'acordo_cancelado' THEN
    -- Se o acordo cancelou, prevalece o status de cancelamento/quebra se ainda houver dívida
    RETURN COALESCE(NULLIF(_worst_state, 'acordo_quitado'), 'inadimplente');
  END IF;

  -- Caso: Em Dia
  RETURN 'em_dia';
END;
$$;

-- 3. Atualizar o mapeamento para nomes em Português (Ouro do Sistema)
-- Mapeamento exato solicitado pelo Lovable para consistência de UI
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
    ELSE 'Em Dia'
  END;
$$;
