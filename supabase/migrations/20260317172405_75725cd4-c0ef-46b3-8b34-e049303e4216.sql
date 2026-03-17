ALTER TABLE public.call_dispositions
  ADD CONSTRAINT call_dispositions_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES public.profiles(id);