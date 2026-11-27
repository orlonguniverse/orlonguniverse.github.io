-- ORLONG: CHAPTER-BASED DYNAMIC CARD REWARDS
-- Run after card-reward-engine.sql, moderator-card-studio.sql,
-- card-reveal-notifications.sql and chapter-one-interactive-rewards.sql.
--
-- Reading Room rewards are selected dynamically from every active card
-- whose Card Studio "Chapter" field (card_catalogue.chapter_number)
-- matches the chapter being read. No fixed three-card limit.
-- Artwork is deliberately NOT required for reward eligibility.
--
-- Future cards automatically join their chapter's reward pools when
-- saved with a Chapter number. Cards can be added before artwork exists.

-- Backfill the numeric Chapter prompt for older cards that only had
-- an unlock_chapter_id such as "chapter-01".
update public.card_catalogue
set chapter_number = substring(unlock_chapter_id from '^chapter-0*([0-9]+)$')::integer,
    updated_at = now()
where chapter_number is null
  and unlock_chapter_id ~ '^chapter-0*[0-9]+$';

-- Keep pool definitions for each existing chapter and each Reading Room
-- activity. Pool membership is synchronised from card_catalogue below.
create or replace function public.sync_chapter_card_reward_pools()
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  chapter_no integer;
  chapter_key text;
  activity record;
  pool_key text;
begin
  for chapter_no in
    select distinct c.chapter_number
    from public.card_catalogue c
    where c.chapter_number is not null
      and c.chapter_number between 1 and 999
  loop
    chapter_key := 'chapter-' || lpad(chapter_no::text,2,'0');

    for activity in
      select * from (values
        ('chapter_completion','completion','Chapter Completion'),
        ('chapter_reaction','reaction','Chapter Reaction'),
        ('chapter_challenge','challenge','Chapter Challenge'),
        ('approved_comment','comment','Approved Discussion')
      ) as a(activity_type,suffix,label)
    loop
      pool_key := chapter_key || '-' || activity.suffix;

      insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
      values(pool_key,activity.activity_type,chapter_key,
             'Chapter '||chapter_no||' '||activity.label,true)
      on conflict(pool_id) do update
      set activity_type=excluded.activity_type,
          chapter_id=excluded.chapter_id,
          title=excluded.title,
          is_active=true;

      delete from public.card_reward_pool_cards
      where pool_id=pool_key;

      insert into public.card_reward_pool_cards(pool_id,card_id)
      select pool_key,c.card_id
      from public.card_catalogue c
      where c.is_active=true
        and c.chapter_number=chapter_no
      on conflict(pool_id,card_id) do nothing;
    end loop;
  end loop;
end;
$$;

-- Keep pool tables as an accurate, inspectable mirror of the Chapter
-- prompt whenever a moderator creates/edits a card or changes its status.
create or replace function public.sync_chapter_pools_after_card_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.sync_chapter_card_reward_pools();
  return null;
end;
$;

drop trigger if exists card_catalogue_sync_chapter_reward_pools
  on public.card_catalogue;
create trigger card_catalogue_sync_chapter_reward_pools
after insert or update of chapter_number,is_active on public.card_catalogue
for each statement execute function public.sync_chapter_pools_after_card_change();

-- Populate all current chapter pools now, including every active Chapter 1
-- card. The function also runs automatically for future Card Studio edits.
select public.sync_chapter_card_reward_pools();

-- Replace the fixed-size award function. For Reading Room activities,
-- eligibility is derived directly from card_catalogue.chapter_number.
-- A card without artwork is still a valid collectible and can be revealed
-- with its complete text details and an artwork placeholder.
create or replace function public.award_reader_card(
  target_user_id uuid,
  target_activity_type text,
  target_chapter_id text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  selected_pool_id text;
  selected_card_id text;
  new_claim_id uuid;
  chapter_no integer;
  chapter_match text;
begin
  if target_user_id is null or target_chapter_id is null then
    return null;
  end if;

  if target_activity_type not in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock'
  ) then
    return null;
  end if;

  if target_activity_type='achievement_unlock' then
    -- Achievements retain their own configured reward pools. Their
    -- chapter_id is the achievement ID rather than a Reading Room chapter.
    select p.pool_id into selected_pool_id
    from public.card_reward_pools p
    where p.activity_type=target_activity_type
      and p.chapter_id=target_chapter_id
      and p.is_active=true;

    if selected_pool_id is null then return null; end if;

    select pc.card_id into selected_card_id
    from public.card_reward_pool_cards pc
    join public.card_catalogue c on c.card_id=pc.card_id
    where pc.pool_id=selected_pool_id
      and c.is_active=true
      and c.chapter_number=1
    order by random()
    limit 1;
  else
    chapter_match := substring(target_chapter_id from '^chapter-0*([0-9]+)$');
    if chapter_match is null then return null; end if;
    chapter_no := chapter_match::integer;

    if chapter_no < 1 or chapter_no > 999 then return null; end if;

    -- Ensure this chapter's pool exists and is current, then choose
    -- randomly from ALL active cards whose Chapter prompt matches.
    perform public.sync_chapter_card_reward_pools();

    selected_pool_id := target_chapter_id || '-' ||
      case target_activity_type
        when 'chapter_completion' then 'completion'
        when 'chapter_reaction' then 'reaction'
        when 'chapter_challenge' then 'challenge'
        when 'approved_comment' then 'comment'
      end;

    select c.card_id into selected_card_id
    from public.card_catalogue c
    where c.is_active=true
      and c.chapter_number=chapter_no
    order by random()
    limit 1;
  end if;

  if selected_card_id is null then return null; end if;

  insert into public.card_reward_claims
    (user_id,activity_type,chapter_id,pool_id,card_id)
  values
    (target_user_id,target_activity_type,target_chapter_id,
     selected_pool_id,selected_card_id)
  on conflict (user_id,activity_type,chapter_id) do nothing
  returning claim_id into new_claim_id;

  if new_claim_id is null then return null; end if;

  insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
  values(target_user_id,selected_card_id,new_claim_id);

  return new_claim_id;
end;
$$;

revoke all on function public.award_reader_card(uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.sync_chapter_card_reward_pools()
  from public,anon,authenticated;

-- Update achievement pools to include every active Chapter One card.
delete from public.card_reward_pool_cards pc
using public.card_reward_pools p
where pc.pool_id=p.pool_id
  and p.activity_type='achievement_unlock';

insert into public.card_reward_pool_cards(pool_id,card_id)
select p.pool_id,c.card_id
from public.card_reward_pools p
cross join public.card_catalogue c
where p.activity_type='achievement_unlock'
  and c.is_active=true
  and c.chapter_number=1
on conflict(pool_id,card_id) do nothing;

-- Verification 1: every Chapter One card with its Chapter prompt is eligible.
select c.card_id,c.card_number,c.name,c.chapter_number,c.is_active,
       c.artwork_url,
       count(pc.pool_id) as linked_reading_room_reward_pools
from public.card_catalogue c
left join public.card_reward_pool_cards pc on pc.card_id=c.card_id
left join public.card_reward_pools p on p.pool_id=pc.pool_id
  and p.activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge','approved_comment'
  )
where c.chapter_number=1
group by c.card_id,c.card_number,c.name,c.chapter_number,c.is_active,c.artwork_url
order by c.card_number;

-- Verification 2: per-chapter reward-pool sizes. Every active card in the
-- matching Chapter prompt should appear in each of the four activity pools.
select p.chapter_id,p.activity_type,p.is_active,
       count(pc.card_id) as eligible_cards
from public.card_reward_pools p
left join public.card_reward_pool_cards pc on pc.pool_id=p.pool_id
where p.activity_type in (
  'chapter_completion','chapter_reaction','chapter_challenge','approved_comment'
)
group by p.chapter_id,p.activity_type,p.is_active
order by p.chapter_id,p.activity_type;


-- CARD REVEAL SOURCE: tell readers why each new card was awarded.
alter table public.reader_card_reveal_queue
  add column if not exists source_label text,
  add column if not exists source_detail text;

create or replace function public.queue_reader_card_reveal()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  activity text;
  chapter_key text;
  achievement_title text;
  label text;
  detail text;
begin
  select rc.activity_type,rc.chapter_id
    into activity,chapter_key
  from public.card_reward_claims rc
  where rc.claim_id=new.source_claim_id;

  if activity='achievement_unlock' then
    select ac.title into achievement_title
    from public.card_achievement_catalogue ac
    where ac.achievement_id=chapter_key;
    label := 'Achievement unlocked';
    detail := coalesce(achievement_title,'A reader achievement');
  else
    label := case activity
      when 'chapter_completion' then 'Chapter completed'
      when 'chapter_reaction' then 'Chapter reaction'
      when 'chapter_challenge' then 'Chapter challenge'
      when 'approved_comment' then 'Discussion comment approved'
      else 'Collectible reward'
    end;
    detail := case
      when chapter_key ~ '^chapter-0*[0-9]+$'
        then 'Chapter '||substring(chapter_key from '[0-9]+')
      else 'Reading Room activity'
    end;
  end if;

  insert into public.reader_card_reveal_queue
    (owner_user_id,copy_id,source_label,source_detail)
  values(new.owner_user_id,new.copy_id,label,detail)
  on conflict(copy_id) do nothing;
  return new;
end;
$$;

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
  source_label text,
  source_detail text,
  acquired_at timestamptz
)
language plpgsql
security definer
set search_path=public,pg_temp
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
    returning q.queue_id,q.copy_id,q.source_label,q.source_detail
  )
  select cl.queue_id,cp.copy_id,cat.card_id,cat.card_number,cat.name,cat.rarity,
         category.label,cat.category_id,cat.chapter_number,cat.set_id,
         cat.artwork_url,cat.spoiler_safe_description,cat.series_id,cat.book_id,
         cl.source_label,cl.source_detail,cp.acquired_at
  from claimed cl
  join public.reader_card_copies cp on cp.copy_id=cl.copy_id
  join public.card_catalogue cat on cat.card_id=cp.card_id
  join public.card_categories category on category.category_id=cat.category_id
  order by cp.acquired_at,cl.queue_id;
end;
$$;
revoke all on function public.claim_my_card_reveals(integer) from public,anon;
grant execute on function public.claim_my_card_reveals(integer) to authenticated;
