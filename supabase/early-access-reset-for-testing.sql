-- ============================================================
-- ORLONG EARLY ACCESS — TEMPORARY TEST RESET
-- Run once in Supabase SQL Editor before testing Stage 2.
--
-- Removes the early_access permission from EVERY account while
-- preserving access-code campaigns and redemption history.
--
-- Existing readers can redeem the same code again: the redemption
-- RPC will recognise their prior redemption and restore the grant.
-- Other access permissions are not changed.
-- ============================================================

begin;

delete from public.reader_access_grants
where access_key = 'early_access';

commit;

-- This should return 0 until a reader redeems the code again.
select count(*) as remaining_early_access_grants
from public.reader_access_grants
where access_key = 'early_access';

-- Redemption records are intentionally preserved.
select count(*) as preserved_early_access_redemptions
from public.access_code_redemptions r
join public.access_code_campaigns c on c.campaign_id = r.campaign_id
where 'early_access' = any(c.access_keys);
