
CREATE OR REPLACE FUNCTION public.recompute_campaign_counters(_campaign_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_campaigns c SET
    sent_count      = (SELECT COUNT(*) FROM public.whatsapp_campaign_recipients WHERE campaign_id = c.id AND status IN ('sent','delivered','read')),
    delivered_count = (SELECT COUNT(*) FROM public.whatsapp_campaign_recipients WHERE campaign_id = c.id AND status IN ('delivered','read')),
    read_count      = (SELECT COUNT(*) FROM public.whatsapp_campaign_recipients WHERE campaign_id = c.id AND status = 'read'),
    failed_count    = (SELECT COUNT(*) FROM public.whatsapp_campaign_recipients WHERE campaign_id = c.id AND status = 'failed'),
    updated_at      = now()
  WHERE c.id = _campaign_id;
$$;

-- Backfill all existing campaigns
DO $$
DECLARE
  cid uuid;
BEGIN
  FOR cid IN SELECT id FROM public.whatsapp_campaigns LOOP
    PERFORM public.recompute_campaign_counters(cid);
  END LOOP;
END $$;
