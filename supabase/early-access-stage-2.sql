-- ============================================================
-- ORLONG EARLY ACCESS — STAGE 2: SERVER-SIDE ACCESS CHECK
-- Run in Supabase SQL Editor after Stage 1.
--
-- The website uses this function to confirm that the signed-in
-- reader has a permanent early_access grant. The function does
-- not expose the grants table or another reader's information.
-- ============================================================

create or replace function public.has_reader_access(required_access_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and required_access_key is not null
    and required_access_key ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'
    and exists (
      select 1
      from public.reader_access_grants g
      where g.user_id = auth.uid()
        and g.access_key = required_access_key
    );
$$;

revoke all on function public.has_reader_access(text) from public, anon;
grant execute on function public.has_reader_access(text) to authenticated;

-- Verification: the function should exist and be executable by signed-in readers.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'has_reader_access';
