-- Add scheduling and anti-ban fields to collection_rules
ALTER TABLE public.collection_rules
  ADD COLUMN IF NOT EXISTS send_time_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS send_time_end time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS daily_cap integer;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_collection_rule_scheduling()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.send_time_start >= NEW.send_time_end THEN
    RAISE EXCEPTION 'send_time_start (%) must be earlier than send_time_end (%)', NEW.send_time_start, NEW.send_time_end;
  END IF;
  IF NEW.min_delay_seconds < 3 THEN
    RAISE EXCEPTION 'min_delay_seconds must be >= 3 (got %)', NEW.min_delay_seconds;
  END IF;
  IF NEW.min_delay_seconds > NEW.max_delay_seconds THEN
    RAISE EXCEPTION 'min_delay_seconds (%) must be <= max_delay_seconds (%)', NEW.min_delay_seconds, NEW.max_delay_seconds;
  END IF;
  IF NEW.daily_cap IS NOT NULL AND NEW.daily_cap <= 0 THEN
    RAISE EXCEPTION 'daily_cap must be > 0 when set (got %)', NEW.daily_cap;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_collection_rule_scheduling_trigger ON public.collection_rules;
CREATE TRIGGER validate_collection_rule_scheduling_trigger
  BEFORE INSERT OR UPDATE ON public.collection_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_collection_rule_scheduling();