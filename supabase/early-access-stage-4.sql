-- ============================================================
-- ORLONG EARLY ACCESS — STAGE 4
-- Verified missions, tester feedback and exclusive mission cards.
-- Run after early-access-stage-3.sql and the card reward/binder stages.
-- Safe to re-run.
-- ============================================================

-- Reset Stage 3 self-attested completion flags exactly once. This migration
-- can then be safely re-run without wiping newly verified progress.
create table if not exists public.early_access_migration_flags (
  flag_key text primary key,
  applied_at timestamptz not null default now()
);
alter table public.early_access_migration_flags enable row level security;
revoke all on public.early_access_migration_flags from anon, authenticated;
do $
begin
  insert into public.early_access_migration_flags(flag_key)
  values ('verified-missions-v1') on conflict do nothing;
  if found then
    delete from public.early_access_mission_completions;
  end if;
end;
$;

create table if not exists public.early_access_mission_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_key text not null references public.early_access_missions(mission_key) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (user_id, mission_key)
);

create table if not exists public.early_access_mission_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback text not null check (char_length(trim(feedback)) between 20 and 3000),
  created_at timestamptz not null default now()
);

alter table public.early_access_mission_visits enable row level security;
alter table public.early_access_mission_feedback enable row level security;
revoke all on public.early_access_mission_visits from anon, authenticated;
revoke all on public.early_access_mission_feedback from anon, authenticated;

-- Eight one-of-a-kind cards, all in a clearly labelled Early Access set.
insert into public.card_sets
 (set_id,title,description,universe_id,series_id,book_id,unlock_chapter_id,sort_order,is_active)
values
 ('early-access-founders','Founding Reader Collection',
  'Eight exclusive cards awarded only for completing the verified Founding Reader missions.',
  'orlong','eden','trials-of-eden',null,90,true)
on conflict (set_id) do update set
 title=excluded.title, description=excluded.description, is_active=true;

insert into public.card_catalogue
 (card_id,category_id,category_number,card_number,name,rarity,set_id,universe_id,series_id,book_id,spoiler_safe_description,artwork_url,sort_order,is_active)
values
 ('ea-mission-account-profile','concepts',101,'CON-101','The First Impression','rare','early-access-founders','orlong','eden','trials-of-eden','A Founding Reader begins their journey.','/explore-eden/cards/early-access/CON-101-first-impression.svg',101,true),
 ('ea-mission-reading-room','concepts',102,'CON-102','The Open Pages','rare','early-access-founders','orlong','eden','trials-of-eden','A reader discovers the world between the pages.','/explore-eden/cards/early-access/CON-102-open-pages.svg',102,true),
 ('ea-mission-chapter-challenge','concepts',103,'CON-103','The Test of Memory','epic','early-access-founders','orlong','eden','trials-of-eden','Attention to detail is its own kind of power.','/explore-eden/cards/early-access/CON-103-test-of-memory.svg',103,true),
 ('ea-mission-collectible-binder','concepts',104,'CON-104','The Curator','rare','early-access-founders','orlong','eden','trials-of-eden','Every discovery deserves a place in the collection.','/explore-eden/cards/early-access/CON-104-curator.svg',104,true),
 ('ea-mission-trading-post','concepts',105,'CON-105','The Exchange','epic','early-access-founders','orlong','eden','trials-of-eden','Trust and strategy bring collectors together.','/explore-eden/cards/early-access/CON-105-exchange.svg',105,true),
 ('ea-mission-achievements','concepts',106,'CON-106','The Laurels','rare','early-access-founders','orlong','eden','trials-of-eden','Progress is built one milestone at a time.','/explore-eden/cards/early-access/CON-106-laurels.svg',106,true),
 ('ea-mission-community','concepts',107,'CON-107','The Signal','epic','early-access-founders','orlong','eden','trials-of-eden','A single voice becomes part of something larger.','/explore-eden/cards/early-access/CON-107-signal.svg',107,true),
 ('ea-mission-final-review','concepts',108,'CON-108','The First Council','legendary','early-access-founders','orlong','eden','trials-of-eden','The Founding Reader helps shape what comes next.','/explore-eden/cards/early-access/CON-108-first-council.svg',108,true)
on conflict (card_id) do update set
 category_id=excluded.category_id,category_number=excluded.category_number,
 card_number=excluded.card_number,name=excluded.name,rarity=excluded.rarity,
 set_id=excluded.set_id,spoiler_safe_description=excluded.spoiler_safe_description,
 artwork_url=excluded.artwork_url,sort_order=excluded.sort_order,is_active=true;

-- One dedicated reward pool per mission. The award routine below writes
-- one claim/copy directly, so each pool intentionally contains one card.
insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
select 'ea-mission-'||m.mission_key,'chapter_completion',
       'ea-mission-'||m.mission_key,'Early Access: '||m.title,true
from public.early_access_missions m
on conflict (pool_id) do update set
 activity_type=excluded.activity_type,chapter_id=excluded.chapter_id,
 title=excluded.title,is_active=true;

insert into public.card_reward_pool_cards(pool_id,card_id)
select 'ea-mission-'||m.mission_key,'ea-mission-'||m.mission_key
from public.early_access_missions m
where m.mission_key in (
 'account-profile','reading-room','chapter-challenge','collectible-binder',
 'trading-post','achievements','community','final-review'
)
on conflict (pool_id,card_id) do nothing;

-- Only these page areas can register a visit. The caller must be signed in
-- and hold the Early Access grant; duplicate visits are harmless.
create or replace function public.record_early_access_mission_visit(target_mission_key text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
 visit_time timestamptz;
begin
 if reader_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.reader_access_grants g
   where g.user_id=reader_id and g.access_key='early_access') then
   raise exception 'Early Access permission required';
 end if;
 if target_mission_key not in
   ('account-profile','reading-room','collectible-binder','trading-post','achievements') then
   raise exception 'This mission is verified through an activity, not a page visit';
 end if;
 insert into public.early_access_mission_visits(user_id,mission_key)
 values(reader_id,target_mission_key)
 on conflict(user_id,mission_key) do update set visited_at=now();
 select visited_at into visit_time from public.early_access_mission_visits
 where user_id=reader_id and mission_key=target_mission_key;
 return visit_time;
end;
$$;

create or replace function public.submit_early_access_feedback(feedback_text text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
 submitted_at timestamptz;
begin
 if reader_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.reader_access_grants g
   where g.user_id=reader_id and g.access_key='early_access') then
   raise exception 'Early Access permission required';
 end if;
 if feedback_text is null or char_length(trim(feedback_text)) < 20
   or char_length(trim(feedback_text)) > 3000 then
   raise exception 'Please enter at least 20 characters (maximum 3000)';
 end if;
 insert into public.early_access_mission_feedback(user_id,feedback)
 values(reader_id,trim(feedback_text))
 returning created_at into submitted_at;
 return submitted_at;
end;
$$;

create or replace function public.get_my_early_access_missions()
returns table (
 mission_key text,title text,category text,description text,instructions text,
 action_label text,action_url text,sort_order integer,is_completed boolean,
 completed_at timestamptz,reward_card_id text,reward_card_number text,
 reward_card_name text,reward_card_rarity text,reward_card_artwork text,
 is_verified boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare reader_id uuid := auth.uid();
begin
 if reader_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.reader_access_grants g
   where g.user_id=reader_id and g.access_key='early_access') then
   raise exception 'Early Access permission required';
 end if;
 return query
 select m.mission_key,m.title,m.category,m.description,m.instructions,
   m.action_label,m.action_url,m.sort_order,
   (c.mission_key is not null),c.completed_at,
   card.card_id,card.card_number,card.name,card.rarity,card.artwork_url,
   case m.mission_key
    when 'account-profile' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'reading-room' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'collectible-binder' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'trading-post' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'achievements' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'chapter-challenge' then exists(select 1 from public.chapter_quiz_attempts q where q.user_id=reader_id)
    when 'community' then (
      exists(select 1 from public.chapter_reactions r where r.user_id=reader_id)
      or exists(select 1 from public.chapter_comments cm where cm.user_id=reader_id)
    )
    when 'final-review' then exists(select 1 from public.early_access_mission_feedback f where f.user_id=reader_id)
    else false
   end
 from public.early_access_missions m
 left join public.early_access_mission_completions c
   on c.mission_key=m.mission_key and c.user_id=reader_id
 left join public.card_reward_claims claim
   on claim.user_id=reader_id and claim.pool_id='ea-mission-'||m.mission_key
 left join public.card_catalogue card on card.card_id=claim.card_id
 where m.is_active=true
 order by m.sort_order,m.title;
end;
$$;

create or replace function public.complete_early_access_mission(target_mission_key text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
 completion_time timestamptz;
 inserted_mission text;
 reward_card text;
 reward_claim uuid;
begin
 if reader_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.reader_access_grants g
   where g.user_id=reader_id and g.access_key='early_access') then
   raise exception 'Early Access permission required';
 end if;
 if target_mission_key is null or not exists(
   select 1 from public.early_access_missions m
   where m.mission_key=target_mission_key and m.is_active=true
 ) then raise exception 'Mission not found or no longer active'; end if;

 -- Verify real server-side evidence before accepting completion.
 if target_mission_key in ('account-profile','reading-room','collectible-binder','trading-post','achievements')
   and not exists(select 1 from public.early_access_mission_visits v
     where v.user_id=reader_id and v.mission_key=target_mission_key) then
   raise exception 'Visit the relevant area first, then return here to complete this mission';
 end if;
 if target_mission_key='chapter-challenge'
   and not exists(select 1 from public.chapter_quiz_attempts q where q.user_id=reader_id) then
   raise exception 'Submit a Chapter Challenge first';
 end if;
 if target_mission_key='community'
   and not (exists(select 1 from public.chapter_reactions r where r.user_id=reader_id)
     or exists(select 1 from public.chapter_comments cm where cm.user_id=reader_id)) then
   raise exception 'Leave a chapter reaction or submit a comment first';
 end if;
 if target_mission_key='final-review'
   and not exists(select 1 from public.early_access_mission_feedback f where f.user_id=reader_id) then
   raise exception 'Submit your tester feedback first';
 end if;

 insert into public.early_access_mission_completions(user_id,mission_key)
 values(reader_id,target_mission_key)
 on conflict(user_id,mission_key) do nothing
 returning mission_key into inserted_mission;

 if inserted_mission is not null then
   reward_card:='ea-mission-'||target_mission_key;
   insert into public.card_reward_claims(user_id,activity_type,chapter_id,pool_id,card_id)
   values(reader_id,'chapter_completion',reward_card,reward_card,reward_card)
   on conflict(user_id,activity_type,chapter_id) do nothing
   returning claim_id into reward_claim;
   if reward_claim is not null then
     insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
     values(reader_id,reward_card,reward_claim);
   end if;
 end if;

 select c.completed_at into completion_time
 from public.early_access_mission_completions c
 where c.user_id=reader_id and c.mission_key=target_mission_key;
 return completion_time;
end;
$$;

revoke all on function public.record_early_access_mission_visit(text) from public,anon;
revoke all on function public.submit_early_access_feedback(text) from public,anon;
revoke all on function public.get_my_early_access_missions() from public,anon;
revoke all on function public.complete_early_access_mission(text) from public,anon;
grant execute on function public.record_early_access_mission_visit(text) to authenticated;
grant execute on function public.submit_early_access_feedback(text) to authenticated;
grant execute on function public.get_my_early_access_missions() to authenticated;
grant execute on function public.complete_early_access_mission(text) to authenticated;

update public.early_access_missions set description='Share a little about your testing experience and help guide the next improvements.', instructions='Submit your tester feedback in the form on this page. Once it is saved, you can claim your final exclusive card.', action_label='OPEN FEEDBACK FORM', action_url='/early-access/#testerFeedback' where mission_key='final-review';

-- Verification: eight mission cards and eight mission reward pools.
select m.mission_key,c.card_number,c.name,c.rarity,p.is_active
from public.early_access_missions m
join public.card_catalogue c on c.card_id='ea-mission-'||m.mission_key
join public.card_reward_pools p on p.pool_id='ea-mission-'||m.mission_key
order by m.sort_order;
