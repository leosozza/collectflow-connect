-- 1) Reset orphan recipients (processing > 5min) for any sending campaign
WITH stale_campaigns AS (
  SELECT id
  FROM whatsapp_campaigns
  WHERE status = 'sending'
)
UPDATE whatsapp_campaign_recipients wcr
SET status = 'pending', updated_at = now()
FROM stale_campaigns sc
WHERE wcr.campaign_id = sc.id
  AND wcr.status = 'processing'
  AND wcr.updated_at < now() - interval '5 minutes';

-- 2) Clear stale processing locks (> 10min) on sending campaigns
UPDATE whatsapp_campaigns
SET processing_locked_at = NULL,
    processing_locked_by = NULL
WHERE status = 'sending'
  AND processing_locked_at IS NOT NULL
  AND processing_locked_at < now() - interval '10 minutes';