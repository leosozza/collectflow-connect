CREATE TABLE public.client_phone_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  credor text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('phone','phone2','phone3')),
  observacao text,
  is_inactive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, cpf, credor, slot)
);

CREATE INDEX idx_client_phone_metadata_lookup
  ON public.client_phone_metadata (tenant_id, cpf, credor);

ALTER TABLE public.client_phone_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_phone_metadata"
  ON public.client_phone_metadata FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "tenant_insert_phone_metadata"
  ON public.client_phone_metadata FOR INSERT
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "tenant_update_phone_metadata"
  ON public.client_phone_metadata FOR UPDATE
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "tenant_delete_phone_metadata"
  ON public.client_phone_metadata FOR DELETE
  USING (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER trg_client_phone_metadata_updated_at
  BEFORE UPDATE ON public.client_phone_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();