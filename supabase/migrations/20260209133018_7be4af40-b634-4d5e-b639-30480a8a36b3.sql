
-- Commission grades table
CREATE TABLE public.commission_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission grades"
ON public.commission_grades
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view commission grades"
ON public.commission_grades
FOR SELECT
TO authenticated
USING (true);

-- Add commission_grade_id to profiles
ALTER TABLE public.profiles ADD COLUMN commission_grade_id UUID REFERENCES public.commission_grades(id) ON DELETE SET NULL;

-- Insert default grade based on user's specification
INSERT INTO public.commission_grades (name, tiers) VALUES (
  'Padrão',
  '[{"min": 0, "max": 5000, "rate": 0}, {"min": 5000.01, "max": 12000, "rate": 3}, {"min": 12000.01, "max": 22000, "rate": 4}, {"min": 22000.01, "max": null, "rate": 5}]'::jsonb
);

-- Add trigger for updated_at
CREATE TRIGGER update_commission_grades_updated_at
BEFORE UPDATE ON public.commission_grades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow admins to delete profiles (for removing duplicate users)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
