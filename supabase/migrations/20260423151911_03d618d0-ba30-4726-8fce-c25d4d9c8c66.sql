-- Revert overly aggressive phone_has_whatsapp flagging from previous campaign run.
-- The previous logic marked numbers as "no WhatsApp" even when Evolution stripped
-- the 9th digit (false negatives) or when the instance had a transient HTTP 500.
-- Reset all profiles flagged in the last 7 days to true so the refined logic can
-- re-evaluate them on the next attempt.
UPDATE public.client_profiles
SET phone_has_whatsapp = true,
    updated_at = now()
WHERE phone_has_whatsapp = false
  AND updated_at > now() - interval '7 days';