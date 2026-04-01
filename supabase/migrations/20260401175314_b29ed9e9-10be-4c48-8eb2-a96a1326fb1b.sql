-- Delete Vitor's tenant_users record (if any)
DELETE FROM public.tenant_users WHERE user_id = 'ddfcb452-c709-4ccd-a004-12bb384e7b2b';

-- Delete Vitor's profile
DELETE FROM public.profiles WHERE user_id = 'ddfcb452-c709-4ccd-a004-12bb384e7b2b';

-- Reset any invite_links that Vitor used so they can be reused
UPDATE public.invite_links 
SET used_by = NULL, used_at = NULL 
WHERE used_by = 'ddfcb452-c709-4ccd-a004-12bb384e7b2b';