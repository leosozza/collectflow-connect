
-- Create client_attachments table
CREATE TABLE public.client_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_cpf TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view attachments"
ON public.client_attachments FOR SELECT
USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can insert attachments"
ON public.client_attachments FOR INSERT
WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can delete attachments"
ON public.client_attachments FOR DELETE
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('client-attachments', 'client-attachments', true);

-- Storage policies
CREATE POLICY "Tenant users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'client-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-attachments');

CREATE POLICY "Authenticated users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'client-attachments' AND auth.role() = 'authenticated');
