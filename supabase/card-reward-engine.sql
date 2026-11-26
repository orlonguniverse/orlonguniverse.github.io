-- ============================================================
-- ORLONG COLLECTIBLE CARDS — STAGE 2: SECURE REWARD ENGINE
-- Run this file in the Supabase SQL Editor after Stage 1.
--
-- Awards one random card for each qualifying activity, once per
-- reader and chapter. All awards are made server-side by triggers.
-- No browser-supplied card ID or reward claim is trusted.
--
-- Chapter One currently uses the three starter cards for each
-- of its four reward activities. Additional chapters/pools can
-- be configured as the catalogue expands.
-- ============================================================

create table if not exists public.card_reward_pools (
  pool_id text primary key check (pool_id ~ '^[a-z0-9-]{1,100}$'),
  activity_type text not null
    check (activity_type in (
      'chapter_completion',
      'chapter_reaction',
      'chapter_challenge',
      'approved_comment'
    )),
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (activity_type, chapter_id)
);

create table if not exists public.card_reward_pool_cards (
  pool_id text not null references public.card_reward_pools(pool_id) on delete cascade,
  card_id text not null references public.card_catalogue(card_id),
  created_at timestamptz not null default now(),
  primary key (pool_id, card_id)
);

create table if not exists public.card_reward_claims (
  claim_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null
    check (activity_type in (
      'chapter_completion',
      'chapter_reaction',
      'chapter_challenge',
      'approved_comment'
    )),
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  pool_id text not null references public.card_reward_pools(pool_id),
  card_id text not null references public.card_catalogue(card_id),
  claimed_at timestamptz not null default now(),
  unique (user_id, activity_type, chapter_id)
);

-- Each copy has its own ID. This allows duplicates now and
-- individual-copy transfers/trades in a later stage.
create table if not exists public.reader_card_copies (
  copy_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null references public.card_catalogue(card_id),
  source_claim_id uuid not null unique
    references public.card_reward_claims(claim_id) on delete cascade,
  acquired_at timestamptz not null default now()
);

create index if not exists card_reward_claims_reader
  on public.card_reward_claims (user_id, claimed_at desc);
create index if not exists reader_card_copies_owner
  on public.reader_card_copies (owner_user_id, acquired_at desc);
create index if not exists card_reward_pool_cards_card
  on public.card_reward_pool_cards (card_id);

alter table public.card_reward_pools enable row level security;
alter table public.card_reward_pool_cards enable row level security;
alter table public.card_reward_claims enable row level security;
alter table public.reader_card_copies enable row level security;

-- No direct reader access. The reward engine is the only writer.
-- A later collection stage will add carefully scoped read functions.
revoke all on public.card_reward_pools from anon, authenticated;
revoke all on public.card_reward_pool_cards from anon, authenticated;
revoke all on public.card_reward_claims from anon, authenticated;
revoke all on public.reader_card_copies from anon, authenticated;

-- Internal award routine. A valid pool must contain exactly three
-- active cards. A unique claim key makes repeat attempts harmless.
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
       'chapter_completion',
       'chapter_reaction',
       'chapter_challenge',
       'approved_comment'
     )
     or target_chapter_id is null then
    return null;
  end if;

  select p.pool_id
    into selected_pool_id
  from public.card_reward_pools p
  where p.activity_type = target_activity_type
    and p.chapter_id = target_chapter_id
    and p.is_active = true;

  if selected_pool_id is null then
    return null;
  end if;

  select count(*)
    into eligible_count
  from public.card_reward_pool_cards pc
  join public.card_catalogue c on c.card_id = pc.card_id
  where pc.pool_id = selected_pool_id
    and c.is_active = true;

  -- Do not issue a reward from an incomplete or oversized pool.
  if eligible_count <> 3 then
    return null;
  end if;

  select pc.card_id
    into selected_card_id
  from public.card_reward_pool_cards pc
  join public.card_catalogue c on c.card_id = pc.card_id
  where pc.pool_id = selected_pool_id
    and c.is_active = true
  order by random()
  limit 1;

  insert into public.card_reward_claims
    (user_id, activity_type, chapter_id, pool_id, card_id)
  values
    (target_user_id, target_activity_type, target_chapter_id,
     selected_pool_id, selected_card_id)
  on conflict (user_id, activity_type, chapter_id) do nothing
  returning claim_id into new_claim_id;

  if new_claim_id is null then
    return null;
  end if;

  insert into public.reader_card_copies
    (owner_user_id, card_id, source_claim_id)
  values
    (target_user_id, selected_card_id, new_claim_id);

  return new_claim_id;
end;
$$;

revoke all on function public.award_reader_card(uuid, text, text) from public, anon, authenticated;

-- Chapter completion: deleting/unmarking never deletes the reward claim.
create or replace function public.reward_card_for_chapter_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.award_reader_card(new.user_id, 'chapter_completion', new.chapter_id);
  return new;
end;
$$;

drop trigger if exists card_reward_after_chapter_completion
  on public.chapter_completions;
create trigger card_reward_after_chapter_completion
after insert on public.chapter_completions
for each row execute function public.reward_card_for_chapter_completion();

-- Reaction: only INSERT awards. UPDATE (changing the reaction) and
-- DELETE (removing it) do not issue another reward.
create or replace function public.reward_card_for_chapter_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.award_reader_card(new.user_id, 'chapter_reaction', new.chapter_id);
  return new;
end;
$$;

drop trigger if exists card_reward_after_chapter_reaction
  on public.chapter_reactions;
create trigger card_reward_after_chapter_reaction
after insert on public.chapter_reactions
for each row execute function public.reward_card_for_chapter_reaction();

-- Challenge: the first saved attempt is the qualifying activity.
-- Retakes remain available but the unique claim prevents extra cards.
create or replace function public.reward_card_for_chapter_challenge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.award_reader_card(new.user_id, 'chapter_challenge', new.chapter_id);
  return new;
end;
$$;

drop trigger if exists card_reward_after_chapter_challenge
  on public.chapter_quiz_attempts;
create trigger card_reward_after_chapter_challenge
after insert on public.chapter_quiz_attempts
for each row execute function public.reward_card_for_chapter_challenge();

-- Discussion: only the first approved comment by a reader in a chapter
-- qualifies. Pending comments do not earn cards; edits/re-approvals do not
-- create extra claims. Replies count as comments too.
create or replace function public.reward_card_for_approved_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.moderation_status is distinct from 'approved'
     and new.moderation_status = 'approved' then
    perform public.award_reader_card(new.user_id, 'approved_comment', new.chapter_id);
  end if;
  return new;
end;
$$;

drop trigger if exists card_reward_after_comment_approval
  on public.chapter_comments;
create trigger card_reward_after_comment_approval
after update of moderation_status on public.chapter_comments
for each row execute function public.reward_card_for_approved_comment();

-- Seed the four Chapter One activity pools with the three starter cards.
-- Each activity independently selects one of the same three cards.
insert into public.card_reward_pools
  (pool_id, activity_type, chapter_id, title)
values
  ('chapter-01-completion', 'chapter_completion', 'chapter-01', 'Chapter One Completion'),
  ('chapter-01-reaction', 'chapter_reaction', 'chapter-01', 'Chapter One Reaction'),
  ('chapter-01-challenge', 'chapter_challenge', 'chapter-01', 'Chapter One Challenge'),
  ('chapter-01-comment', 'approved_comment', 'chapter-01', 'Chapter One Approved Discussion')
on conflict (pool_id) do update set
  activity_type = excluded.activity_type,
  chapter_id = excluded.chapter_id,
  title = excluded.title;

insert into public.card_reward_pool_cards (pool_id, card_id)
select pools.pool_id, cards.card_id
from (values
  ('chapter-01-completion'),
  ('chapter-01-reaction'),
  ('chapter-01-challenge'),
  ('chapter-01-comment')
) as pools(pool_id)
cross join (values
  ('maya-garcia'),
  ('elena-strix'),
  ('mrs-finch')
) as cards(card_id)
where exists (
  select 1 from public.card_reward_pools p
  where p.pool_id = pools.pool_id
)
and exists (
  select 1 from public.card_catalogue c
  where c.card_id = cards.card_id
)
on conflict (pool_id, card_id) do nothing;

-- Quick verification: each active Chapter One pool should show 3 cards.
select
  p.pool_id,
  p.activity_type,
  p.chapter_id,
  count(pc.card_id) as card_options
from public.card_reward_pools p
left join public.card_reward_pool_cards pc on pc.pool_id = p.pool_id
where p.chapter_id = 'chapter-01'
group by p.pool_id, p.activity_type, p.chapter_id
order by p.activity_type;
