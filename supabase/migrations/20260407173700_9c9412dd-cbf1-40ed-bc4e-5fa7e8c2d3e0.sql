
CREATE OR REPLACE FUNCTION public.normalize_phone_br(_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  digits text;
  ddd text;
  num text;
BEGIN
  digits := regexp_replace(_phone, '\D', '', 'g');
  IF length(digits) < 10 THEN RETURN NULL; END IF;
  IF length(digits) = 13 AND digits LIKE '55%' THEN RETURN digits; END IF;
  IF length(digits) = 12 AND digits LIKE '55%' THEN
    ddd := substring(digits FROM 3 FOR 2);
    num := substring(digits FROM 5);
    RETURN '55' || ddd || '9' || num;
  END IF;
  IF length(digits) = 11 THEN RETURN '55' || digits; END IF;
  IF length(digits) = 10 THEN
    ddd := substring(digits FROM 1 FOR 2);
    num := substring(digits FROM 3);
    RETURN '55' || ddd || '9' || num;
  END IF;
  IF digits NOT LIKE '55%' THEN RETURN '55' || digits; END IF;
  RETURN digits;
END;
$$;
