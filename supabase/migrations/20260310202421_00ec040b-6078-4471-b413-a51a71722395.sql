
-- Table: admin_staff (Rivo Connect internal team)
CREATE TABLE public.admin_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role_title text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage admin_staff"
  ON public.admin_staff FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Table: admin_meetings (meetings/trainings managed by Super Admin)
CREATE TABLE public.admin_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  meeting_type text NOT NULL DEFAULT 'Reunião',
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  meeting_url text,
  status text NOT NULL DEFAULT 'agendada',
  participants_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage admin_meetings"
  ON public.admin_meetings FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
