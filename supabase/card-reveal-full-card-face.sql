-- ORLONG CARD REVEAL: FULL CARD-FACE METADATA
-- Run after card-reveal-notifications.sql and moderator-card-studio.sql.
-- Replaces the claim RPC with the full set of fields used by Explore Eden cards.

drop function if exists public.claim_my_card_reveals(integer);

create function public.claim_my_card_reveals(p_limit integer default 10)
returns table (
  queue_id uuid,
  copy_id uuid,
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  category_label text,
  category_id text,
  chapter_number integer,
  set_id text,
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
         category.label,cat.category_id,cat.chapter_number,cat.set_id,
         cat.artwork_url,cat.spoiler_safe_description,cat.series_id,cat.book_id,
         cp.acquired_at
  from claimed cl
  join public.reader_card_copies cp on cp.copy_id=cl.copy_id
  join public.card_catalogue cat on cat.card_id=cp.card_id
  join public.card_categories category on category.category_id=cat.category_id
  order by cp.acquired_at,cl.queue_id;
end;
$$;

revoke all on function public.claim_my_card_reveals(integer) from public,anon;
grant execute on function public.claim_my_card_reveals(integer) to authenticated;

-- Confirm the released Chapter One card records have their public artwork paths.
select card_id,card_number,name,artwork_url
from public.card_catalogue
where unlock_chapter_id='chapter-01'
order by category_number;
