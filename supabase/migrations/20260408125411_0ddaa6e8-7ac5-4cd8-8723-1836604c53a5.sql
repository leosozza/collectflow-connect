
-- Enable pg_trgm for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for fast name search on clients
CREATE INDEX IF NOT EXISTS idx_clients_nome_completo_trgm ON public.clients USING gin (nome_completo gin_trgm_ops);

-- Ensure phone_last8 index exists
CREATE INDEX IF NOT EXISTS idx_client_phones_tenant_last8 ON public.client_phones (tenant_id, phone_last8);

-- Create ingest_channel_event_v2: resolves instance by name internally
CREATE OR REPLACE FUNCTION public.ingest_channel_event_v2(
  _instance_name text DEFAULT NULL,
  _channel_type text DEFAULT 'whatsapp',
  _provider text DEFAULT NULL,
  _remote_phone text DEFAULT NULL,
  _remote_name text DEFAULT NULL,
  _direction text DEFAULT 'inbound',
  _message_type text DEFAULT 'text',
  _content text DEFAULT NULL,
  _media_url text DEFAULT NULL,
  _media_mime_type text DEFAULT NULL,
  _external_id text DEFAULT NULL,
  _provider_message_id text DEFAULT NULL,
  _actor_type text DEFAULT 'human',
  _status text DEFAULT 'sent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _endpoint_id uuid;
  _inst_provider text;
BEGIN
  -- Resolve instance by name
  IF _instance_name IS NOT NULL AND _instance_name <> '' THEN
    SELECT id, tenant_id, provider
    INTO _endpoint_id, _tenant_id, _inst_provider
    FROM public.whatsapp_instances
    WHERE instance_name = _instance_name
    LIMIT 1;
    
    IF _endpoint_id IS NULL THEN
      RETURN jsonb_build_object('error', 'instance not found: ' || _instance_name);
    END IF;
    
    -- Use instance provider if not explicitly passed
    IF _provider IS NULL OR _provider = '' THEN
      _provider := _inst_provider;
    END IF;
  ELSE
    RETURN jsonb_build_object('error', 'instance_name is required');
  END IF;

  -- Delegate to existing v1 RPC
  RETURN public.ingest_channel_event(
    _tenant_id := _tenant_id,
    _endpoint_id := _endpoint_id,
    _channel_type := _channel_type,
    _provider := _provider,
    _remote_phone := _remote_phone,
    _remote_name := _remote_name,
    _direction := _direction,
    _message_type := _message_type,
    _content := _content,
    _media_url := _media_url,
    _media_mime_type := _media_mime_type,
    _external_id := _external_id,
    _provider_message_id := _provider_message_id,
    _actor_type := _actor_type,
    _status := _status
  );
END;
$$;

-- Add progress_metadata column to whatsapp_campaigns for checkpoint/resume
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'whatsapp_campaigns' AND column_name = 'progress_metadata'
  ) THEN
    ALTER TABLE public.whatsapp_campaigns ADD COLUMN progress_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
