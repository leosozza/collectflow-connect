-- Backfill propensity scores for all CPFs with events in last 90 days
-- This is a one-time operation; the trigger handles future updates

WITH event_stats AS (
  SELECT 
    regexp_replace(ce.client_cpf, '\D', '', 'g') as clean_cpf,
    ce.tenant_id,
    count(*) as total_events,
    count(*) FILTER (WHERE ce.event_type = 'whatsapp_inbound') as whatsapp_inbound,
    count(*) FILTER (WHERE ce.event_channel = 'whatsapp') as whatsapp_events,
    count(*) FILTER (WHERE ce.event_channel = 'call') as call_events,
    count(*) FILTER (WHERE ce.event_type IN ('whatsapp_outbound','message_sent','disposition','call')) as total_outreach,
    count(*) FILTER (WHERE ce.event_type = 'agreement_created') as agreements_created,
    count(*) FILTER (WHERE ce.event_type IN ('agreement_signed','agreement_approved')) as agreements_signed,
    count(*) FILTER (WHERE ce.event_type IN ('agreement_cancelled','agreement_overdue')) as agreements_cancelled,
    count(*) FILTER (WHERE ce.event_type = 'agreement_overdue') as overdue_events,
    count(*) FILTER (WHERE ce.event_type IN ('payment_confirmed','manual_payment_confirmed')) as payment_confirmed_count,
    EXTRACT(DAY FROM (now() - max(ce.created_at) FILTER (
      WHERE ce.event_type = 'whatsapp_inbound' 
        OR (ce.event_type = 'disposition' AND ce.event_value IN ('cpc','answered','completed','connected'))
        OR (ce.event_type = 'call' AND ce.event_value IN ('answered','completed','connected'))
    )))::int as last_contact_days
  FROM client_events ce
  WHERE ce.created_at >= (now() - interval '90 days')
    AND ce.client_cpf IS NOT NULL AND ce.client_cpf != ''
  GROUP BY regexp_replace(ce.client_cpf, '\D', '', 'g'), ce.tenant_id
),
scored AS (
  SELECT 
    es.clean_cpf,
    es.tenant_id,
    es.total_events,
    -- DIM 1: Contact (0-30)
    CASE 
      WHEN es.last_contact_days IS NULL THEN 0
      WHEN es.last_contact_days <= 7 THEN 30
      WHEN es.last_contact_days <= 30 THEN 20
      ELSE 10
    END as contact_score,
    -- DIM 2: Engagement (0-30)
    LEAST(30,
      LEAST(es.whatsapp_inbound * 5, 10)
      + CASE WHEN es.last_contact_days IS NOT NULL THEN 5 ELSE 0 END
      + CASE WHEN es.agreements_created > 0 THEN 5 ELSE 0 END
      + CASE WHEN es.agreements_signed > 0 THEN 5 ELSE 0 END
      + CASE WHEN es.payment_confirmed_count > 0 THEN 10 ELSE 0 END
    ) as engagement_score,
    -- DIM 3: Payment history (-20 to +25)
    CASE
      WHEN es.payment_confirmed_count > 0 AND es.agreements_cancelled = 0 THEN 25
      WHEN es.payment_confirmed_count > 0 AND es.agreements_cancelled > 0 THEN 5
      WHEN es.agreements_cancelled > 0 AND es.payment_confirmed_count = 0 THEN -20
      WHEN es.agreements_created > 0 AND es.agreements_signed = 0 AND es.payment_confirmed_count = 0 THEN -5
      ELSE 0
    END as payment_score,
    -- Preferred channel
    CASE
      WHEN es.call_events > 0 AND es.whatsapp_events > 0 THEN
        CASE 
          WHEN es.call_events > es.whatsapp_events * 1.5 THEN 'call'
          WHEN es.whatsapp_events > es.call_events * 1.5 THEN 'whatsapp'
          ELSE 'mixed'
        END
      WHEN es.call_events > 0 THEN 'call'
      WHEN es.whatsapp_events > 0 THEN 'whatsapp'
      ELSE 'unknown'
    END as preferred_channel,
    -- Score confidence
    CASE 
      WHEN es.total_events >= 10 THEN 'high'
      WHEN es.total_events >= 4 THEN 'medium'
      ELSE 'low'
    END as score_confidence,
    es.whatsapp_inbound,
    es.payment_confirmed_count,
    es.agreements_cancelled,
    es.agreements_signed,
    es.overdue_events,
    es.last_contact_days
  FROM event_stats es
),
final_scores AS (
  SELECT 
    s.clean_cpf,
    s.tenant_id,
    GREATEST(0, LEAST(100, s.contact_score + s.engagement_score + s.payment_score)) as score,
    s.preferred_channel,
    s.score_confidence,
    s.total_events,
    -- Suggested queue
    CASE
      WHEN s.total_events < 3 THEN 'low_history'
      WHEN (s.contact_score + s.engagement_score + s.payment_score) >= 75 THEN 'priority_high'
      WHEN (s.contact_score + s.engagement_score + s.payment_score) >= 50 THEN 'priority_medium'
      ELSE 'priority_low'
    END as suggested_queue,
    -- Score reason
    ARRAY_TO_STRING(ARRAY_REMOVE(ARRAY[
      CASE WHEN s.total_events < 3 THEN 'Histórico limitado' END,
      CASE WHEN s.contact_score >= 20 THEN 'Contato recente' END,
      CASE WHEN s.engagement_score >= 20 THEN 'Bom engajamento' END,
      CASE WHEN s.whatsapp_inbound > 0 AND s.engagement_score < 20 THEN 'Respondeu no WhatsApp' END,
      CASE WHEN s.payment_score >= 25 THEN 'Pagamentos em dia' END,
      CASE WHEN s.payment_score <= -20 THEN 'Quebra de acordo' END,
      CASE WHEN s.payment_score = -5 THEN 'Acordo criado sem formalização' END
    ], NULL), '; ') as score_reason
  FROM scored s
)
UPDATE clients c
SET 
  propensity_score = fs.score,
  preferred_channel = fs.preferred_channel,
  suggested_queue = fs.suggested_queue,
  score_reason = CASE WHEN fs.score_reason = '' THEN 'Score calculado com base no histórico' ELSE fs.score_reason END,
  score_confidence = fs.score_confidence,
  score_updated_at = now()
FROM final_scores fs
WHERE c.tenant_id = fs.tenant_id
  AND regexp_replace(c.cpf, '\D', '', 'g') = fs.clean_cpf;