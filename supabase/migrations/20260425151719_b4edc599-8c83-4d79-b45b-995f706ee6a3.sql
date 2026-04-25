-- Drop sobrecargas antigas que causam PGRST203 (ambiguidade no PostgREST)
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_dashboard_vencimentos(date, uuid);
DROP FUNCTION IF EXISTS public.get_acionados_hoje(uuid, uuid);