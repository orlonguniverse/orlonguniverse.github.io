-- ORLONG CARD REVEAL NOTIFICATIONS
-- Run once in Supabase after the collectible reward engine.
-- Every newly inserted physical card copy enters a private reveal queue,
-- regardless of which secure reward function or workflow created it.

create table if not exists public.reader_card_reveal_queue (
  queue_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  copy_id uuid not null unique references public.reader_card_copies(copy_id) on delete cascade,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz,
  revealed_at timestamptz
);

create index if not exists reader_card_reveal_queue_pending
  on public.reader_card_reveal_queue(owner_user_id, queued_at)
  where revealed_at is null;

alter table public.reader_card_reveal_queue enable row level security;
revoke all on public.reader_card_reveal_queue from public, anon, authenticated;

create or replace function public.queue_reader_card_reveal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.reader_card_reveal_queue(owner_user_id,copy_id)
  values(new.owner_user_id,new.copy_id)
  on conflict(copy_id) do nothing;
  return new;
end;
$$;

drop trigger if exists reader_card_copy_queue_reveal on public.reader_card_copies;
create trigger reader_card_copy_queue_reveal
after insert on public.reader_card_copies
for each row execute function public.queue_reader_card_reveal();

create or replace function public.claim_my_card_reveals(p_limit integer default 10)
returns table (
  queue_id uuid,
  copy_id uuid,
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  artwork_url text,
  spoiler_safe_description text,
  series_id text,
  book_id text,
  acquired_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare reader_id uuid := auth.uid();
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  return query
  with candidates as (
    select q.queue_id
    from public.reader_card_reveal_queue q
    where q.owner_user_id=reader_id
      and q.revealed_at is null
      and (q.claimed_at is null or q.claimed_at < now()-interval '5 minutes')
    order by q.queued_at,q.queue_id
    limit greatest(1,least(coalesce(p_limit,10),25))
    for update skip locked
  ),
  claimed as (
    update public.reader_card_reveal_queue q
       set claimed_at=now()
      from candidates c
     where q.queue_id=c.queue_id
    returning q.queue_id,q.copy_id
  )
  select cl.queue_id,cp.copy_id,cat.card_id,cat.card_number,cat.name,cat.rarity,
         cat.artwork_url,cat.spoiler_safe_description,cat.series_id,cat.book_id,cp.acquired_at
  from claimed cl
  join public.reader_card_copies cp on cp.copy_id=cl.copy_id
  join public.card_catalogue cat on cat.card_id=cp.card_id
  order by cp.acquired_at,cl.queue_id;
end;
$$;

create or replace function public.acknowledge_my_card_reveals(p_queue_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.reader_card_reveal_queue
     set revealed_at=now(),claimed_at=null
   where owner_user_id=auth.uid()
     and queue_id=any(coalesce(p_queue_ids,'{}'::uuid[]))
     and revealed_at is null;
  get diagnostics changed=row_count;
  return changed;
end;
$$;

revoke all on function public.queue_reader_card_reveal() from public, anon, authenticated;
revoke all on function public.claim_my_card_reveals(integer) from public, anon;
revoke all on function public.acknowledge_my_card_reveals(uuid[]) from public, anon;
grant execute on function public.claim_my_card_reveals(integer) to authenticated;
grant execute on function public.acknowledge_my_card_reveals(uuid[]) to authenticated;

-- Existing card copies are intentionally not backfilled: only cards earned
-- after this notification feature is installed should trigger a new reveal.
select count(*) as pending_reveal_notifications
from public.reader_card_reveal_queue
where revealed_at is null;
