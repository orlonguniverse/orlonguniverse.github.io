-- ============================================================
-- ORLONG STAGE 8D.1B — DISCOVERY CLUES FOR SEALED CARD SLOTS
-- Reveals rarity and chapter of origin only. Card identity,
-- artwork, number, name and description remain private until owned.
-- ============================================================
drop function if exists public.get_my_card_progress();

create function public.get_my_card_progress()
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
  chapter_number integer,
  copy_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with owned_cards as (
    select copies.card_id, count(*)::bigint as copy_count
    from public.reader_card_copies copies
    where auth.uid() is not null and copies.owner_user_id = auth.uid()
    group by copies.card_id
  ),
  active_slots as (
    select c.category_id, c.category_number,
      count(*) over (partition by c.category_id)::integer as category_total,
      c.card_id, c.card_number, c.name, c.rarity,
      c.spoiler_safe_description, c.artwork_url, c.chapter_number,
      coalesce(owned.copy_count, 0)::bigint as copy_count
    from public.card_catalogue c
    join public.card_categories cat on cat.category_id = c.category_id and cat.is_active = true
    left join owned_cards owned on owned.card_id = c.card_id
    where c.is_active = true
  )
  select cat.category_id, cat.label, cat.category_code, cat.sort_order,
    slots.category_number, slots.category_total, (slots.copy_count > 0),
    case when slots.copy_count > 0 then slots.card_id end,
    case when slots.copy_count > 0 then slots.card_number end,
    case when slots.copy_count > 0 then slots.name end,
    slots.rarity,
    case when slots.copy_count > 0 then slots.spoiler_safe_description end,
    case when slots.copy_count > 0 then slots.artwork_url end,
    slots.chapter_number,
    case when slots.copy_count > 0 then slots.copy_count else 0::bigint end
  from active_slots slots
  join public.card_categories cat on cat.category_id = slots.category_id
  order by cat.sort_order, slots.category_number;
$$;

revoke all on function public.get_my_card_progress() from public, anon;
grant execute on function public.get_my_card_progress() to authenticated;

comment on function public.get_my_card_progress() is
  'Returns category totals and numbered opaque slots. Unowned slots reveal only rarity and chapter number; all card identity, artwork and description fields remain NULL.';
