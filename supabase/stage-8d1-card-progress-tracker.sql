-- ============================================================
-- STAGE 8D.1 — SPOILER-SAFE CARD PROGRESS TRACKER
-- Run in Supabase SQL Editor after the existing card catalogue,
-- binder, and category-manager migrations.
--
-- Readers receive category totals and numbered slots. Identity,
-- artwork, rarity and descriptions are returned only for cards
-- that the signed-in reader actually owns.
-- ============================================================

create or replace function public.get_my_card_progress()
returns table (
  category_id text,
  category_label text,
  category_code text,
  category_sort_order integer,
  slot_number integer,
  category_total integer,
  is_owned boolean,
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  spoiler_safe_description text,
  artwork_url text,
  copy_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with owned_cards as (
    select
      copies.card_id,
      count(*)::bigint as copy_count
    from public.reader_card_copies copies
    where auth.uid() is not null
      and copies.owner_user_id = auth.uid()
    group by copies.card_id
  ),
  active_slots as (
    select
      c.category_id,
      c.category_number,
      count(*) over (partition by c.category_id)::integer as category_total,
      c.card_id,
      c.card_number,
      c.name,
      c.rarity,
      c.spoiler_safe_description,
      c.artwork_url,
      coalesce(owned.copy_count, 0)::bigint as copy_count
    from public.card_catalogue c
    join public.card_categories cat
      on cat.category_id = c.category_id
     and cat.is_active = true
    left join owned_cards owned on owned.card_id = c.card_id
    where c.is_active = true
  )
  select
    cat.category_id,
    cat.label as category_label,
    cat.category_code,
    cat.sort_order as category_sort_order,
    slots.category_number as slot_number,
    slots.category_total,
    (slots.copy_count > 0) as is_owned,
    case when slots.copy_count > 0 then slots.card_id end,
    case when slots.copy_count > 0 then slots.card_number end,
    case when slots.copy_count > 0 then slots.name end,
    case when slots.copy_count > 0 then slots.rarity end,
    case when slots.copy_count > 0 then slots.spoiler_safe_description end,
    case when slots.copy_count > 0 then slots.artwork_url end,
    case when slots.copy_count > 0 then slots.copy_count else 0::bigint end
  from active_slots slots
  join public.card_categories cat on cat.category_id = slots.category_id
  order by cat.sort_order, slots.category_number;
$$;

revoke all on function public.get_my_card_progress() from public, anon;
grant execute on function public.get_my_card_progress() to authenticated;

comment on function public.get_my_card_progress() is
  'Returns category totals and numbered opaque slots; card identity and metadata are visible only for cards owned by the authenticated reader.';

-- Verification: a signed-in reader should receive slots, while all
-- identity fields for unowned slots should be NULL.
select category_label, slot_number, category_total, is_owned,
       card_number, card_name, rarity, artwork_url
from public.get_my_card_progress()
order by category_sort_order, slot_number;
