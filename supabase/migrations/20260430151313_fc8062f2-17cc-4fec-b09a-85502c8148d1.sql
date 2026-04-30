-- Drop old overloads of ingestion functions that lack _reply_to_external_id.
-- Their existence causes PGRST203 (could not choose best candidate) and breaks WhatsApp inbound ingestion.
DROP FUNCTION IF EXISTS public.ingest_channel_event_v2(
  text, text, text, text, text, text, text, text,
  text, text, text, text, text, text
);

DROP FUNCTION IF EXISTS public.ingest_channel_event(
  uuid, uuid, text, text, text, text, text, text,
  text, text, text, text, text, text, text
);