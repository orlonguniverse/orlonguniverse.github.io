-- ============================================================
-- ORLONG COLLECTIBLE CARDS — STAGE 6: TRADING POST FOUNDATION
-- Run in the Supabase SQL Editor after Stage 5.
--
-- Adds opt-in public binders and secure reader-to-reader trades.
-- Collections are PRIVATE by default. Readers cannot directly
-- edit ownership or trade records; all changes go through RPCs.
-- No currency or automatic duplicate conversion is introduced.
-- ============================================================

create table if not exists public.reader_card_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  collection_is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.card_trade_offers (
  offer_id uuid primary key default gen_random_uuid(),
  proposer_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  offered_copy_id uuid not null references public.reader_card_copies(copy_id),
  requested_card_id text not null references public.card_catalogue(card_id),
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  constraint card_trade_not_self check (proposer_user_id <> recipient_user_id)
);

create index if not exists card_trade_recipient_status
  on public.card_trade_offers(recipient_user_id, status, created_at desc);
create index if not exists card_trade_proposer_status
  on public.card_trade_offers(proposer_user_id, status, created_at desc);

-- A physical card copy can be committed to only one pending offer.
create unique index if not exists card_trade_one_pending_offer_per_copy
  on public.card_trade_offers(offered_copy_id)
  where status = 'pending';

alter table public.reader_card_settings enable row level security;
alter table public.card_trade_offers enable row level security;
revoke all on public.reader_card_settings from anon, authenticated;
revoke all on public.card_trade_offers from anon, authenticated;

-- Readers explicitly opt in or out. New settings are private by default.
create or replace function public.set_my_card_collection_visibility(make_public boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reader_id uuid := auth.uid();
begin
  if reader_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.reader_card_settings(user_id, collection_is_public, updated_at)
  values (reader_id, coalesce(make_public, false), now())
  on conflict (user_id) do update
    set collection_is_public = excluded.collection_is_public,
        updated_at = now();

  return coalesce(make_public, false);
end;
$$;

create or replace function public.get_my_card_collection_visibility()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select s.collection_is_public
    from public.reader_card_settings s
    where s.user_id = auth.uid()
  ), false)
$$;

-- Public directory contains only readers who have opted in.
-- It reveals collection counts, not reading activity or account statistics.
create or replace function public.get_public_card_collections()
returns table (
  reader_id uuid,
  display_name text,
  avatar_url text,
  unique_cards bigint,
  total_copies bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.user_id,
         p.display_name,
         p.avatar_url,
         count(distinct c.card_id)::bigint,
         count(c.copy_id)::bigint
  from public.reader_card_settings s
  join public.reader_profiles p on p.user_id = s.user_id
  left join public.reader_card_copies c on c.owner_user_id = p.user_id
  left join public.card_catalogue cat
    on cat.card_id = c.card_id and cat.is_active = true
  where s.collection_is_public = true
    and p.user_id <> auth.uid()
  group by p.user_id, p.display_name, p.avatar_url
  order by p.display_name;
$$;

-- A public binder exposes card identities and copy counts only.
-- Physical copy IDs and private activity are never exposed.
create or replace function public.get_public_card_collection(target_reader_id uuid)
returns table (
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  category_label text,
  artwork_url text,
  copy_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cat.card_id, cat.card_number, cat.name, cat.rarity,
         categories.label, cat.artwork_url, count(c.copy_id)::bigint
  from public.reader_card_settings s
  join public.reader_card_copies c on c.owner_user_id = s.user_id
  join public.card_catalogue cat on cat.card_id = c.card_id and cat.is_active = true
  join public.card_categories categories on categories.category_id = cat.category_id
  where s.user_id = target_reader_id
    and s.collection_is_public = true
  group by cat.card_id, cat.card_number, cat.name, cat.rarity,
           categories.label, cat.artwork_url, categories.sort_order, cat.category_number
  order by categories.sort_order, cat.category_number;
$$;

-- Offer one of the proposer's own physical copies for one card
-- currently owned by the recipient. The recipient must be public.
create or replace function public.create_card_trade_offer(
  target_recipient_id uuid,
  offered_copy uuid,
  requested_card text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  new_offer_id uuid;
begin
  if reader_id is null then
    raise exception 'Authentication required';
  end if;
  if target_recipient_id is null or target_recipient_id = reader_id then
    raise exception 'Choose another reader for this trade';
  end if;
  if not exists (
    select 1 from public.reader_card_settings s
    where s.user_id = target_recipient_id and s.collection_is_public = true
  ) then
    raise exception 'That reader does not have a public collection';
  end if;
  if not exists (
    select 1 from public.reader_card_copies c
    where c.copy_id = offered_copy and c.owner_user_id = reader_id
  ) then
    raise exception 'You no longer own the card you selected';
  end if;
  if not exists (
    select 1 from public.reader_card_copies c
    where c.owner_user_id = target_recipient_id and c.card_id = requested_card
  ) then
    raise exception 'That reader no longer owns the requested card';
  end if;

  insert into public.card_trade_offers
    (proposer_user_id, recipient_user_id, offered_copy_id, requested_card_id)
  values
    (reader_id, target_recipient_id, offered_copy, requested_card)
  returning offer_id into new_offer_id;

  return new_offer_id;
exception
  when unique_violation then
    raise exception 'That card copy is already committed to another pending trade';
end;
$$;

-- Accept or decline an incoming offer. Acceptance transfers both
-- physical copies in one database transaction or transfers neither.
create or replace function public.respond_to_card_trade(
  target_offer_id uuid,
  accept_offer boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  offer_row public.card_trade_offers%rowtype;
  offered_owner uuid;
  requested_copy_id uuid;
begin
  if reader_id is null then
    raise exception 'Authentication required';
  end if;

  select * into offer_row
  from public.card_trade_offers t
  where t.offer_id = target_offer_id
    and t.recipient_user_id = reader_id
  for update;

  if not found then
    raise exception 'Trade offer not found';
  end if;
  if offer_row.status <> 'pending' then
    raise exception 'This trade offer is no longer pending';
  end if;

  if not coalesce(accept_offer, false) then
    update public.card_trade_offers
    set status = 'declined', responded_at = now()
    where offer_id = target_offer_id;
    return 'declined';
  end if;

  select c.owner_user_id into offered_owner
  from public.reader_card_copies c
  where c.copy_id = offer_row.offered_copy_id
  for update;

  if offered_owner is distinct from offer_row.proposer_user_id then
    raise exception 'The offered card is no longer owned by the proposer';
  end if;

  select c.copy_id into requested_copy_id
  from public.reader_card_copies c
  where c.owner_user_id = reader_id
    and c.card_id = offer_row.requested_card_id
  order by c.acquired_at, c.copy_id
  for update skip locked
  limit 1;

  if requested_copy_id is null then
    raise exception 'You no longer have an available copy of the requested card';
  end if;

  update public.reader_card_copies
  set owner_user_id = offer_row.proposer_user_id
  where copy_id = offer_row.offered_copy_id;

  update public.reader_card_copies
  set owner_user_id = offer_row.proposer_user_id
  where copy_id = requested_copy_id;

  -- The proposer receives the requested card and the recipient
  -- receives the offered card. Correct the first transfer below.
  update public.reader_card_copies
  set owner_user_id = reader_id
  where copy_id = offer_row.offered_copy_id;

  update public.card_trade_offers
  set status = 'accepted', responded_at = now(), completed_at = now()
  where offer_id = target_offer_id;

  return 'accepted';
end;
$$;

create or replace function public.cancel_card_trade_offer(target_offer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  changed_count integer;
begin
  if reader_id is null then
    raise exception 'Authentication required';
  end if;

  update public.card_trade_offers
  set status = 'cancelled', responded_at = now()
  where offer_id = target_offer_id
    and proposer_user_id = reader_id
    and status = 'pending';

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

-- Returns only offers involving the signed-in reader, with public
-- display names and card details needed for the Trading Post UI.
create or replace function public.get_my_card_trades()
returns table (
  offer_id uuid,
  trade_role text,
  other_reader_id uuid,
  other_display_name text,
  offered_card_number text,
  offered_card_name text,
  offered_artwork_url text,
  requested_card_number text,
  requested_card_name text,
  requested_artwork_url text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.offer_id,
         case when t.proposer_user_id = auth.uid() then 'outgoing' else 'incoming' end,
         case when t.proposer_user_id = auth.uid() then t.recipient_user_id else t.proposer_user_id end,
         other_profile.display_name,
         offered.card_number,
         offered.name,
         offered.artwork_url,
         requested.card_number,
         requested.name,
         requested.artwork_url,
         t.status,
         t.created_at,
         t.responded_at
  from public.card_trade_offers t
  join public.reader_profiles other_profile
    on other_profile.user_id = case
      when t.proposer_user_id = auth.uid() then t.recipient_user_id
      else t.proposer_user_id
    end
  join public.reader_card_copies offered_copy
    on offered_copy.copy_id = t.offered_copy_id
  join public.card_catalogue offered on offered.card_id = offered_copy.card_id
  join public.card_catalogue requested on requested.card_id = t.requested_card_id
  where auth.uid() in (t.proposer_user_id, t.recipient_user_id)
  order by t.created_at desc;
$$;

revoke all on function public.set_my_card_collection_visibility(boolean) from public, anon;
revoke all on function public.get_my_card_collection_visibility() from public, anon;
revoke all on function public.get_public_card_collections() from public, anon;
revoke all on function public.get_public_card_collection(uuid) from public, anon;
revoke all on function public.create_card_trade_offer(uuid, uuid, text) from public, anon;
revoke all on function public.respond_to_card_trade(uuid, boolean) from public, anon;
revoke all on function public.cancel_card_trade_offer(uuid) from public, anon;
revoke all on function public.get_my_card_trades() from public, anon;

grant execute on function public.set_my_card_collection_visibility(boolean) to authenticated;
grant execute on function public.get_my_card_collection_visibility() to authenticated;
grant execute on function public.get_public_card_collections() to authenticated;
grant execute on function public.get_public_card_collection(uuid) to authenticated;
grant execute on function public.create_card_trade_offer(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_card_trade(uuid, boolean) to authenticated;
grant execute on function public.cancel_card_trade_offer(uuid) to authenticated;
grant execute on function public.get_my_card_trades() to authenticated;

-- Verification: tables and RPC signatures are installed.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('reader_card_settings','card_trade_offers')
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'set_my_card_collection_visibility',
    'get_my_card_collection_visibility',
    'get_public_card_collections',
    'get_public_card_collection',
    'create_card_trade_offer',
    'respond_to_card_trade',
    'cancel_card_trade_offer',
    'get_my_card_trades'
  )
order by routine_name;
