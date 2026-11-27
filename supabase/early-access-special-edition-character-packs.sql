-- ORLONG EARLY ACCESS: SPECIAL EDITION CHARACTER PACKS
-- Replaces the eight retired concept-card rewards with one shared random
-- pool of ten Special Edition character cards. Adds two missions.
-- Existing mission completions are preserved and backfilled with one random
-- character card. Rerunning this migration does not issue duplicate rewards.

-- Create the Special Edition set and its ten permanent character identities.
insert into public.card_sets
 (set_id,title,description,universe_id,series_id,book_id,unlock_chapter_id,sort_order,is_active)
values
 ('early-access-special-edition','Founding Reader Special Edition',
  'Ten exclusive character cards awarded randomly for completing Early Access missions.',
  'orlong','eden','trials-of-eden',null,91,true)
on conflict (set_id) do update set
 title=excluded.title,description=excluded.description,is_active=true;

insert into public.card_catalogue
 (card_id,category_id,category_number,card_number,name,rarity,set_id,universe_id,series_id,book_id,spoiler_safe_description,artwork_url,sort_order,is_active)
values
 ('special-maya-garcia','characters',101,'CHR-101','Maya Garcia','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,101,true),
 ('special-leo-lee','characters',102,'CHR-102','Leo Lee','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,102,true),
 ('special-kiera-patel','characters',103,'CHR-103','Kiera Patel','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,103,true),
 ('special-al-jones','characters',104,'CHR-104','Al Jones','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,104,true),
 ('special-marcus-roberts','characters',105,'CHR-105','Marcus Roberts','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,105,true),
 ('special-charlee-neil','characters',106,'CHR-106','Charlee Neil','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,106,true),
 ('special-emily-kim','characters',107,'CHR-107','Emily Kim','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,107,true),
 ('special-alek-petrov','characters',108,'CHR-108','Alek Petrov','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,108,true),
 ('special-ethan-lawson','characters',109,'CHR-109','Ethan Lawson','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,109,true),
 ('special-colin-thornsberg','characters',110,'CHR-110','Colin Thornsberg','rare','early-access-special-edition','orlong','eden','trials-of-eden',null,null,110,true)
on conflict (card_id) do update set
 category_id=excluded.category_id,category_number=excluded.category_number,
 card_number=excluded.card_number,name=excluded.name,rarity=excluded.rarity,
 set_id=excluded.set_id,spoiler_safe_description=excluded.spoiler_safe_description,
 artwork_url=excluded.artwork_url,sort_order=excluded.sort_order,is_active=true;

-- Add two further testing missions, taking the journey from eight to ten.
insert into public.early_access_missions
 (mission_key,title,category,description,instructions,action_label,action_url,sort_order,is_active)
values
 ('explore-eden','Explore Eden','COLLECTIBLES',
  'Explore the new collectible archive and check how your collection is presented.',
  'Open Explore Eden. Look through My Collection, the Card Catalogue and the Trading Post. Check that missing-card silhouettes and owned cards are easy to understand.',
  'OPEN EXPLORE EDEN','/explore-eden/',9,true),
 ('founding-readers','Visit the Founding Readers page','COMMUNITY',
  'Review the Founding Readers page and its public acknowledgement settings.',
  'Open the Founding Readers page. Check that the total count and public roster are clear, and that readers control whether their names are displayed.',
  'OPEN FOUNDING READERS','/founding-readers/',10,true)
on conflict (mission_key) do update set
 title=excluded.title,category=excluded.category,description=excluded.description,
 instructions=excluded.instructions,action_label=excluded.action_label,
 action_url=excluded.action_url,sort_order=excluded.sort_order,is_active=true;

-- Remove all copies, claims, pool links and catalogue rows for the eight
-- retired Early Access concept cards. Keep mission completion records.
delete from public.reader_card_copies
where card_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
);

delete from public.card_reward_claims
where card_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
);

delete from public.card_reward_pool_cards
where pool_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
) or card_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
);

delete from public.card_reward_pools
where pool_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
);

delete from public.card_catalogue
where card_id in (
 'ea-mission-account-profile','ea-mission-reading-room',
 'ea-mission-chapter-challenge','ea-mission-collectible-binder',
 'ea-mission-trading-post','ea-mission-achievements',
 'ea-mission-community','ea-mission-final-review'
);

delete from public.card_sets where set_id='early-access-founders';

-- One shared pool is used for every mission. Each mission gets a distinct
-- chapter_id in its claim so the same reader can receive duplicates.
insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
values('early-access-special-edition','chapter_completion','early-access-special-edition',
       'Early Access Special Edition Character Pack',true)
on conflict (pool_id) do update set
 activity_type=excluded.activity_type,chapter_id=excluded.chapter_id,
 title=excluded.title,is_active=true;

delete from public.card_reward_pool_cards where pool_id='early-access-special-edition';
insert into public.card_reward_pool_cards(pool_id,card_id)
values
 ('early-access-special-edition','special-maya-garcia'),
 ('early-access-special-edition','special-leo-lee'),
 ('early-access-special-edition','special-kiera-patel'),
 ('early-access-special-edition','special-al-jones'),
 ('early-access-special-edition','special-marcus-roberts'),
 ('early-access-special-edition','special-charlee-neil'),
 ('early-access-special-edition','special-emily-kim'),
 ('early-access-special-edition','special-alek-petrov'),
 ('early-access-special-edition','special-ethan-lawson'),
 ('early-access-special-edition','special-colin-thornsberg');

-- Record page visits for the original page-based missions plus the two new ones.
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
   ('account-profile','reading-room','collectible-binder','trading-post',
    'achievements','explore-eden','founding-readers') then
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

-- Return the character actually awarded for each completed mission.
drop function if exists public.get_my_early_access_missions();
create function public.get_my_early_access_missions()
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
    when 'explore-eden' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
    when 'founding-readers' then exists(select 1 from public.early_access_mission_visits v where v.user_id=reader_id and v.mission_key=m.mission_key)
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
   on claim.user_id=reader_id
  and claim.pool_id='early-access-special-edition'
  and claim.chapter_id='ea-mission-'||m.mission_key
 left join public.card_catalogue card on card.card_id=claim.card_id
 where m.is_active=true
 order by m.sort_order,m.title;
end;
$$;

-- Verify completion evidence, then award one uniformly random card from
-- the ten-card pool. Unique mission completion prevents rerolling.
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
 selected_card_id text;
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

 if target_mission_key in
   ('account-profile','reading-room','collectible-binder','trading-post',
    'achievements','explore-eden','founding-readers')
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
   select pc.card_id into selected_card_id
   from public.card_reward_pool_cards pc
   join public.card_catalogue cc on cc.card_id=pc.card_id and cc.is_active=true
   where pc.pool_id='early-access-special-edition'
   order by random() limit 1;

   if selected_card_id is null then
     raise exception 'The Special Edition character pool is not ready yet';
   end if;

   insert into public.card_reward_claims(user_id,activity_type,chapter_id,pool_id,card_id)
   values(reader_id,'chapter_completion','ea-mission-'||target_mission_key,
          'early-access-special-edition',selected_card_id)
   on conflict(user_id,activity_type,chapter_id) do nothing
   returning claim_id into reward_claim;

   if reward_claim is not null then
     insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
     values(reader_id,selected_card_id,reward_claim);
   end if;
 end if;

 select c.completed_at into completion_time
 from public.early_access_mission_completions c
 where c.user_id=reader_id and c.mission_key=target_mission_key;
 return completion_time;
end;
$$;

-- Backfill already completed missions with one random character card.
-- This preserves their progress and does not create repeat claims.
do $backfill$
declare row_record record; selected_card_id text; reward_claim uuid;
begin
 for row_record in
   select c.user_id,c.mission_key,c.completed_at
   from public.early_access_mission_completions c
   where not exists(
     select 1 from public.card_reward_claims claim
     where claim.user_id=c.user_id
       and claim.pool_id='early-access-special-edition'
       and claim.chapter_id='ea-mission-'||c.mission_key
   )
 loop
   select pc.card_id into selected_card_id
   from public.card_reward_pool_cards pc
   join public.card_catalogue cc on cc.card_id=pc.card_id and cc.is_active=true
   where pc.pool_id='early-access-special-edition'
   order by random() limit 1;

   if selected_card_id is not null then
     insert into public.card_reward_claims(user_id,activity_type,chapter_id,pool_id,card_id,claimed_at)
     values(row_record.user_id,'chapter_completion','ea-mission-'||row_record.mission_key,
            'early-access-special-edition',selected_card_id,row_record.completed_at)
     on conflict(user_id,activity_type,chapter_id) do nothing
     returning claim_id into reward_claim;
     if reward_claim is not null then
       insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id,acquired_at)
       values(row_record.user_id,selected_card_id,reward_claim,row_record.completed_at);
     end if;
   end if;
 end loop;
end;
$backfill$;

revoke all on function public.record_early_access_mission_visit(text) from public,anon;
revoke all on function public.get_my_early_access_missions() from public,anon;
revoke all on function public.complete_early_access_mission(text) from public,anon;
grant execute on function public.record_early_access_mission_visit(text) to authenticated;
grant execute on function public.get_my_early_access_missions() to authenticated;
grant execute on function public.complete_early_access_mission(text) to authenticated;

-- Expected: ten active missions, ten catalogue cards, ten pool options.
select mission_key,title,sort_order
from public.early_access_missions where is_active=true order by sort_order;
select card_number,name,rarity
from public.card_catalogue where set_id='early-access-special-edition' order by category_number;
select p.pool_id,count(pc.card_id) as eligible_cards
from public.card_reward_pools p
left join public.card_reward_pool_cards pc on pc.pool_id=p.pool_id
where p.pool_id='early-access-special-edition' group by p.pool_id;
