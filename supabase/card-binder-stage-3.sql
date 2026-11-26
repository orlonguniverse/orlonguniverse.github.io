-- ============================================================
-- ORLONG COLLECTIBLE CARDS — STAGE 3: PERSONAL BINDER
-- Run in Supabase SQL Editor after Stage 2.
--
-- Makes the three starter card fronts available in the catalogue,
-- keeps only the Chapter One completion pool active for now, and
-- exposes a private, read-only binder RPC for signed-in readers.
-- ============================================================

-- The starter card art is public website artwork.
update public.card_catalogue
set artwork_url = case card_id
  when 'maya-garcia' then '/explore-eden/cards/CHR-001-maya-garcia.png'
  when 'elena-strix' then '/explore-eden/cards/CHR-002-elena-strix.png'
  when 'mrs-finch' then '/explore-eden/cards/CHR-003-mrs-finch.png'
  else artwork_url
end,
updated_at = now()
where card_id in ('maya-garcia','elena-strix','mrs-finch');

-- The initial Stage 2 migration used the starter character trio in
-- every pool. That was only a temporary bootstrap configuration.
-- Remove those incorrect non-completion awards and disable the pools
-- until their own three-card options have been added.
delete from public.card_reward_claims
where activity_type in ('chapter_reaction','chapter_challenge','approved_comment')
  and chapter_id = 'chapter-01'
  and pool_id in (
    'chapter-01-reaction',
    'chapter-01-challenge',
    'chapter-01-comment'
  );

update public.card_reward_pools
set is_active = false
where pool_id in (
  'chapter-01-reaction',
  'chapter-01-challenge',
  'chapter-01-comment'
);

-- Private collection reader. Returns only cards the signed-in reader
-- owns, grouped by card identity with a count of physical copies.
create or replace function public.get_my_card_collection()
returns table (
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  category_label text,
  category_code text,
  spoiler_safe_description text,
  artwork_url text,
  copy_count bigint,
  first_acquired_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.card_id,
    c.card_number,
    c.name as card_name,
    c.rarity,
    cat.label as category_label,
    cat.category_code,
    c.spoiler_safe_description,
    c.artwork_url,
    count(copy.copy_id) as copy_count,
    min(copy.acquired_at) as first_acquired_at
  from public.reader_card_copies copy
  join public.card_catalogue c on c.card_id = copy.card_id
  join public.card_categories cat on cat.category_id = c.category_id
  where auth.uid() is not null
    and copy.owner_user_id = auth.uid()
    and c.is_active = true
  group by
    c.card_id, c.card_number, c.name, c.rarity,
    cat.label, cat.category_code,
    c.spoiler_safe_description, c.artwork_url
  order by cat.sort_order, c.category_number;
$$;

revoke all on function public.get_my_card_collection() from public, anon;
grant execute on function public.get_my_card_collection() to authenticated;

-- Verification: completion pool active; the other three pools inactive.
select pool_id, activity_type, is_active
from public.card_reward_pools
where chapter_id = 'chapter-01'
order by activity_type;

-- Verification: the three starter catalogue entries now have artwork paths.
select card_number, name, artwork_url
from public.card_catalogue
where card_id in ('maya-garcia','elena-strix','mrs-finch')
order by category_number;
