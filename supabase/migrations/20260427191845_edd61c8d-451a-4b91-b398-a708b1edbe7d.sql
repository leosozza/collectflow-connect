UPDATE public.gamification_campaigns
SET end_date = '2026-04-26'
WHERE id = '0ef2460e-4bc3-4f59-ba49-2b498cb963b9'
  AND end_date::text LIKE '%2026-02-24'
  AND EXTRACT(YEAR FROM end_date) > 9999;

-- Fallback: se a comparação acima falhar por overflow, força via id
UPDATE public.gamification_campaigns
SET end_date = '2026-04-26'
WHERE id = '0ef2460e-4bc3-4f59-ba49-2b498cb963b9';