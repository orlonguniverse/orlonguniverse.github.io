-- ORLONG UNIVERSE — STAGE 4: PERMANENT FOUNDING READER REGISTER
-- Run in Supabase SQL Editor. Safe to rerun.
-- Qualifies early_access grants received by 31 Dec 2026, Australia/Brisbane time.
-- Public acknowledgement is opt-in and reversible; access and status are permanent.

create table if not exists public.founding_readers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 qualified_at timestamptz not null,
 public_listing boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.founding_readers enable row level security;
revoke all on public.founding_readers from anon, authenticated;

create or replace function public.capture_founding_reader()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.access_key='early_access'
 and new.granted_at < ('2027-01-01 00:00:00'::timestamp at time zone 'Australia/Brisbane') then
  insert into public.founding_readers(user_id,qualified_at) values(new.user_id,new.granted_at) on conflict(user_id) do nothing;
 end if;
 return new;
end; $$;
drop trigger if exists capture_founding_reader_grant on public.reader_access_grants;
create trigger capture_founding_reader_grant after insert on public.reader_access_grants
for each row execute function public.capture_founding_reader();

insert into public.founding_readers(user_id,qualified_at)
select g.user_id,min(g.granted_at) from public.reader_access_grants g
where g.access_key='early_access'
and g.granted_at < ('2027-01-01 00:00:00'::timestamp at time zone 'Australia/Brisbane')
group by g.user_id on conflict(user_id) do nothing;

create or replace function public.get_my_founding_reader_status()
returns table(is_eligible boolean,is_public boolean)
language sql stable security definer set search_path=public,pg_temp as $$
 select true,f.public_listing from public.founding_readers f where f.user_id=auth.uid()
 union all
 select false,false where auth.uid() is not null
 and not exists(select 1 from public.founding_readers f where f.user_id=auth.uid())
 limit 1;
$$;

create or replace function public.set_my_founding_reader_public_listing(show_publicly boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare reader_id uuid:=auth.uid();
begin
 if reader_id is null then raise exception 'Please sign in first'; end if;
 if show_publicly is null then raise exception 'Choose whether your name should be public'; end if;
 update public.founding_readers set public_listing=show_publicly where user_id=reader_id;
 if not found then raise exception 'Your account does not have Founding Reader status'; end if;
 return show_publicly;
end; $$;

create or replace function public.get_public_founding_readers()
returns table(display_name text,qualified_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(nullif(trim(p.display_name),''),'Reader'),f.qualified_at
 from public.founding_readers f join public.reader_profiles p on p.user_id=f.user_id
 where f.public_listing=true order by f.qualified_at asc,p.display_name asc;
$$;
create or replace function public.get_founding_reader_count()
returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select count(*) from public.founding_readers;
$$;

revoke all on function public.capture_founding_reader() from public,anon,authenticated;
revoke all on function public.get_my_founding_reader_status() from public,anon;
revoke all on function public.set_my_founding_reader_public_listing(boolean) from public,anon;
revoke all on function public.get_public_founding_readers() from public;
revoke all on function public.get_founding_reader_count() from public;
grant execute on function public.get_my_founding_reader_status() to authenticated;
grant execute on function public.set_my_founding_reader_public_listing(boolean) to authenticated;
grant execute on function public.get_public_founding_readers() to anon,authenticated;
grant execute on function public.get_founding_reader_count() to anon,authenticated;

select count(*) as founding_reader_total from public.founding_readers;
