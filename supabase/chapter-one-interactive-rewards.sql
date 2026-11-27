-- ORLONG CHAPTER ONE INTERACTIVE CARD REWARDS
-- Run after card-reward-engine.sql, card-binder-stage-3.sql,
-- card-achievements-stage-5.sql and card-reveal-notifications.sql.
--
-- Every qualifying Chapter One interaction awards one random card
-- from the currently released Chapter One set (Maya, Elena, Mrs Finch).
-- Each activity is claimable once per reader. Duplicate copies remain valid.

alter table public.card_reward_pools
  drop constraint if exists card_reward_pools_activity_type_check;
alter table public.card_reward_pools
  add constraint card_reward_pools_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock'
  ));

alter table public.card_reward_claims
  drop constraint if exists card_reward_claims_activity_type_check;
alter table public.card_reward_claims
  add constraint card_reward_claims_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock'
  ));

create or replace function public.award_reader_card(
  target_user_id uuid,
  target_activity_type text,
  target_chapter_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_pool_id text;
  selected_card_id text;
  new_claim_id uuid;
  eligible_count integer;
begin
  if target_user_id is null
     or target_activity_type not in (
       'chapter_completion','chapter_reaction','chapter_challenge',
       'approved_comment','achievement_unlock'
     )
     or target_chapter_id is null then
    return null;
  end if;

  select p.pool_id into selected_pool_id
  from public.card_reward_pools p
  where p.activity_type=target_activity_type
    and p.chapter_id=target_chapter_id
    and p.is_active=true;

  if selected_pool_id is null then return null; end if;

  select count(*) into eligible_count
  from public.card_reward_pool_cards pc
  join public.card_catalogue c on c.card_id=pc.card_id
  where pc.pool_id=selected_pool_id and c.is_active=true
    and c.unlock_chapter_id='chapter-01';

  if eligible_count<>3 then return null; end if;

  select pc.card_id into selected_card_id
  from public.card_reward_pool_cards pc
  join public.card_catalogue c on c.card_id=pc.card_id
  where pc.pool_id=selected_pool_id and c.is_active=true
    and c.unlock_chapter_id='chapter-01'
  order by random()
  limit 1;

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

-- Activate the three meaningful Chapter One interaction pools.
update public.card_reward_pools
set is_active=true
where pool_id in (
  'chapter-01-reaction','chapter-01-challenge','chapter-01-comment'
);

-- Every pool uses the three cards that currently belong to The Show set.
-- This is deliberately tied to the Chapter One catalogue, not to a
-- browser-supplied card choice.
insert into public.card_reward_pool_cards(pool_id,card_id)
select p.pool_id,c.card_id
from public.card_reward_pools p
cross join (
  values ('maya-garcia'),('elena-strix'),('mrs-finch')
) as c(card_id)
where p.pool_id in (
  'chapter-01-completion','chapter-01-reaction',
  'chapter-01-challenge','chapter-01-comment'
)
and exists (
  select 1 from public.card_catalogue cat
  where cat.card_id=c.card_id
    and cat.is_active=true
    and cat.unlock_chapter_id='chapter-01'
)
on conflict(pool_id,card_id) do nothing;

-- Achievement unlocks each qualify once. The achievement ID is used as
-- the reward key so distinct achievements can each grant one card.
insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
select
  'achievement-'||a.achievement_id,
  'achievement_unlock',
  a.achievement_id,
  'Achievement: '||a.title,
  true
from public.card_achievement_catalogue a
where a.is_active=true
on conflict(pool_id) do update
set activity_type=excluded.activity_type,
    chapter_id=excluded.chapter_id,
    title=excluded.title,
    is_active=true;

insert into public.card_reward_pool_cards(pool_id,card_id)
select p.pool_id,c.card_id
from public.card_reward_pools p
cross join (
  values ('maya-garcia'),('elena-strix'),('mrs-finch')
) as c(card_id)
where p.activity_type='achievement_unlock'
and exists (
  select 1 from public.card_catalogue cat
  where cat.card_id=c.card_id
    and cat.is_active=true
    and cat.unlock_chapter_id='chapter-01'
)
on conflict(pool_id,card_id) do nothing;

create or replace function public.reward_card_for_achievement_unlock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.award_reader_card(
    new.user_id,'achievement_unlock',new.achievement_id
  );
  return new;
end;
$$;

drop trigger if exists card_reward_after_achievement_unlock
  on public.reader_achievement_unlocks;
create trigger card_reward_after_achievement_unlock
after insert on public.reader_achievement_unlocks
for each row execute function public.reward_card_for_achievement_unlock();

revoke all on function public.reward_card_for_achievement_unlock()
  from public,anon,authenticated;

-- Verify the four activity pools and achievement pools each contain
-- exactly three eligible Chapter One cards.
select p.pool_id,p.activity_type,p.is_active,count(pc.card_id) as card_options
from public.card_reward_pools p
left join public.card_reward_pool_cards pc on pc.pool_id=p.pool_id
where p.chapter_id='chapter-01' or p.activity_type='achievement_unlock'
group by p.pool_id,p.activity_type,p.is_active
order by p.activity_type,p.pool_id;
