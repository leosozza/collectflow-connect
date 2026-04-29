-- Migration: realign custom_installment_dates / values keys to canonical scheme
-- Old UI saved first non-entrada parcela under key "2" (when entrada existed).
-- Canonical (matching boleto generator) uses "1". Decrement numeric keys by 1
-- ONLY for agreements that have entrada AND no "1" key but have "2" or higher.

DO $$
DECLARE
  rec RECORD;
  new_dates jsonb;
  new_values jsonb;
  k text;
  v jsonb;
  num int;
BEGIN
  FOR rec IN
    SELECT id, custom_installment_dates, custom_installment_values
    FROM public.agreements
    WHERE entrada_value IS NOT NULL
      AND custom_installment_dates IS NOT NULL
      AND NOT (custom_installment_dates ? '1')
      AND (
        custom_installment_dates ? '2'
        OR custom_installment_dates ? '3'
        OR custom_installment_dates ? '4'
        OR custom_installment_dates ? '5'
        OR custom_installment_dates ? '6'
        OR custom_installment_dates ? '7'
        OR custom_installment_dates ? '8'
        OR custom_installment_dates ? '9'
        OR custom_installment_dates ? '10'
        OR custom_installment_dates ? '11'
        OR custom_installment_dates ? '12'
        OR custom_installment_dates ? '13'
      )
  LOOP
    -- Rebuild custom_installment_dates: decrement purely-numeric keys >= 2
    new_dates := '{}'::jsonb;
    FOR k, v IN SELECT key, value FROM jsonb_each(rec.custom_installment_dates) LOOP
      IF k ~ '^[0-9]+$' THEN
        num := k::int;
        IF num >= 2 THEN
          new_dates := new_dates || jsonb_build_object((num - 1)::text, v);
        ELSE
          new_dates := new_dates || jsonb_build_object(k, v);
        END IF;
      ELSE
        new_dates := new_dates || jsonb_build_object(k, v);
      END IF;
    END LOOP;

    -- Rebuild custom_installment_values: same logic, but PRESERVE *_method keys verbatim
    -- (they were already canonical: "1_method", "2_method", etc.).
    new_values := '{}'::jsonb;
    IF rec.custom_installment_values IS NOT NULL THEN
      FOR k, v IN SELECT key, value FROM jsonb_each(rec.custom_installment_values) LOOP
        IF k ~ '^[0-9]+$' THEN
          num := k::int;
          IF num >= 2 THEN
            new_values := new_values || jsonb_build_object((num - 1)::text, v);
          ELSE
            new_values := new_values || jsonb_build_object(k, v);
          END IF;
        ELSE
          -- entrada, entrada_2, entrada_method, 1_method, 2_method, etc. — keep as-is
          new_values := new_values || jsonb_build_object(k, v);
        END IF;
      END LOOP;
    ELSE
      new_values := NULL;
    END IF;

    UPDATE public.agreements
    SET custom_installment_dates = new_dates,
        custom_installment_values = new_values
    WHERE id = rec.id;
  END LOOP;
END $$;