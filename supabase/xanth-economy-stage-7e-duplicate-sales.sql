-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7E: DUPLICATE SALES
-- Run after Stage 7A, 7B, 7C and 7D migrations.
--
-- Readers may sell surplus physical copies for 50% of the
-- rarity-based Xanth value. Auto-sell can be enabled per reader
-- and configured to retain a chosen number of each card.
-- Copies committed to pending trades are never sold; completed trade history is preserved. One copy is always retained
-- by manual sales; automatic settings may retain 1–100 copies.
-- ============================================================

create table if not exists public.reader_card_sale_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_sell_duplicates boolean not null default false,
  keep_copies integer not null default 1 check (keep_copies between 1 and 100),
  updated_at timestamptz not null default now()
);

alter table public.reader_card_sale_settings enable row level security;
revoke all on public.reader_card_sale_settings from public, anon, authenticated;

-- Preserve the card identity on trade records so a physical copy can be
-- sold after an offer is finished without erasing the reader's trade history.
alter table public.card_trade_offers
  add column if not exists offered_card_id text;
update public.card_trade_offers t
set offered_card_id=c.card_id
from public.reader_card_copies c
where c.copy_id=t.offered_copy_id and t.offered_card_id is null;
alter table public.card_trade_offers
  alter column offered_card_id set not null;
alter table public.card_trade_offers
  drop constraint if exists card_trade_offers_offered_card_id_fkey;
alter table public.card_trade_offers
  add constraint card_trade_offers_offered_card_id_fkey
  foreign key (offered_card_id)
  references public.card_catalogue(card_id);
alter table public.card_trade_offers
  alter column offered_copy_id drop not null;
alter table public.card_trade_offers
  drop constraint if exists card_trade_offers_offered_copy_id_fkey;
alter table public.card_trade_offers
  add constraint card_trade_offers_offered_copy_id_fkey
  foreign key (offered_copy_id)
  references public.reader_card_copies(copy_id)
  on delete set null;

-- New offers store the offered card identity as a durable snapshot.
create or replace function public.create_card_trade_offer(
  target_recipient_id uuid,
  offered_copy uuid,
  requested_card text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  offered_card text;
  new_offer_id uuid;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if target_recipient_id is null or target_recipient_id=reader_id then
    raise exception 'Choose another reader for this trade';
  end if;
  if not exists (
    select 1 from public.reader_card_settings s
    where s.user_id=target_recipient_id and s.collection_is_public=true
  ) then raise exception 'That reader does not have a public collection'; end if;

  select c.card_id into offered_card
  from public.reader_card_copies c
  where c.copy_id=offered_copy and c.owner_user_id=reader_id
  for update;
  if offered_card is null then raise exception 'You no longer own the card you selected'; end if;
  if not exists (
    select 1 from public.reader_card_copies c
    where c.owner_user_id=target_recipient_id and c.card_id=requested_card
  ) then raise exception 'That reader no longer owns the requested card'; end if;

  insert into public.card_trade_offers
    (proposer_user_id,recipient_user_id,offered_copy_id,offered_card_id,requested_card_id)
  values(reader_id,target_recipient_id,offered_copy,offered_card,requested_card)
  returning offer_id into new_offer_id;
  return new_offer_id;
exception when unique_violation then
  raise exception 'That card copy is already committed to another pending trade';
end;
$$;

-- Trade history now reads the durable card snapshot rather than relying on
-- the physical offered copy still existing in the collection.
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
set search_path=public,pg_temp
as $$
  select t.offer_id,
         case when t.proposer_user_id=auth.uid() then 'outgoing' else 'incoming' end,
         case when t.proposer_user_id=auth.uid() then t.recipient_user_id else t.proposer_user_id end,
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
    on other_profile.user_id=case
      when t.proposer_user_id=auth.uid() then t.recipient_user_id
      else t.proposer_user_id
    end
  join public.card_catalogue offered on offered.card_id=t.offered_card_id
  join public.card_catalogue requested on requested.card_id=t.requested_card_id
  where auth.uid() in (t.proposer_user_id,t.recipient_user_id)
  order by t.created_at desc;
$$;

revoke all on function public.create_card_trade_offer(uuid,uuid,text) from public,anon;
revoke all on function public.get_my_card_trades() from public,anon;
grant execute on function public.create_card_trade_offer(uuid,uuid,text) to authenticated;
grant execute on function public.get_my_card_trades() to authenticated;

create or replace function public.get_my_duplicate_sale_settings()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  settings_row public.reader_card_sale_settings%rowtype;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  insert into public.reader_card_sale_settings(user_id)
  values(reader_id) on conflict(user_id) do nothing;
  select * into settings_row
  from public.reader_card_sale_settings
  where user_id=reader_id;
  return jsonb_build_object(
    'auto_sell_duplicates',settings_row.auto_sell_duplicates,
    'keep_copies',settings_row.keep_copies,
    'sale_value_percent',50
  );
end;
$$;

create or replace function public.set_my_duplicate_sale_settings(
  p_auto_sell boolean,
  p_keep_copies integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  result_row public.reader_card_sale_settings%rowtype;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if p_keep_copies is null or p_keep_copies < 1 or p_keep_copies > 100 then
    raise exception 'Choose a keep limit between 1 and 100 copies';
  end if;
  insert into public.reader_card_sale_settings(user_id,auto_sell_duplicates,keep_copies,updated_at)
  values(reader_id,coalesce(p_auto_sell,false),p_keep_copies,now())
  on conflict(user_id) do update set
    auto_sell_duplicates=excluded.auto_sell_duplicates,
    keep_copies=excluded.keep_copies,
    updated_at=now()
  returning * into result_row;
  return jsonb_build_object(
    'auto_sell_duplicates',result_row.auto_sell_duplicates,
    'keep_copies',result_row.keep_copies,
    'sale_value_percent',50
  );
end;
$$;

-- Sell a chosen number of copies of one card. A reader can never sell
-- their final copy, and copies committed to pending trades are excluded.
create or replace function public.sell_my_duplicate_cards(
  p_card_id text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  card_row public.card_catalogue%rowtype;
  total_owned integer;
  sold_count integer;
  unit_value bigint;
  total_value bigint;
  balance_after bigint;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if p_card_id is null or p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'Choose a valid card and sale quantity';
  end if;

  select * into card_row
  from public.card_catalogue
  where card_id=p_card_id and is_active=true;
  if not found then raise exception 'That card is no longer available'; end if;

  insert into public.reader_xanth_accounts(user_id)
  values(reader_id) on conflict(user_id) do nothing;
  perform 1 from public.reader_xanth_accounts
  where user_id=reader_id for update;

  select count(*) into total_owned
  from public.reader_card_copies
  where owner_user_id=reader_id and card_id=p_card_id;
  if total_owned <= 1 then raise exception 'You must keep at least one copy of every card'; end if;

  unit_value := greatest(1,floor(public.xanth_rarity_price(card_row.rarity)::numeric*0.5)::bigint);

  with candidates as (
    select c.copy_id
    from public.reader_card_copies c
    where c.owner_user_id=reader_id and c.card_id=p_card_id
      and not exists (
        select 1 from public.card_trade_offers t
        where t.offered_copy_id=c.copy_id and t.status='pending'
      )
    order by c.acquired_at desc,c.copy_id desc
    limit least(p_quantity,total_owned-1)
    for update skip locked
  ), deleted as (
    delete from public.reader_card_copies c
    using candidates x
    where c.copy_id=x.copy_id
    returning c.copy_id
  )
  select count(*)::integer into sold_count from deleted;

  if sold_count=0 then
    raise exception 'No duplicate copies are available to sell. A copy may be reserved by a trade offer';
  end if;

  total_value := unit_value*sold_count;
  update public.reader_xanth_accounts
  set balance_cents=balance_cents+total_value,updated_at=now()
  where user_id=reader_id
  returning balance_cents into balance_after;

  insert into public.reader_xanth_transactions
    (user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values
    (reader_id,total_value,balance_after,'duplicate_sale',
     'Sold '||sold_count||' duplicate '||card_row.name||' card'||case when sold_count=1 then '' else 's' end,
     gen_random_uuid()::text,
     jsonb_build_object('card_id',p_card_id,'copies_sold',sold_count,
                        'unit_value_cents',unit_value,'automatic',false));

  return jsonb_build_object(
    'success',true,'card_id',p_card_id,'card_name',card_row.name,
    'copies_sold',sold_count,'unit_value_cents',unit_value,
    'total_value_cents',total_value,'balance_cents',balance_after
  );
end;
$$;

-- Automatically sells newly inserted copies above the reader's configured keep
-- limit. The oldest copies are retained; pending trade copies are protected.
-- Incoming reader-to-reader trades are also checked after the offer is marked
-- accepted; the durable card snapshot preserves the trade record if sold.
create or replace function public.auto_sell_excess_card_copies()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  settings_row public.reader_card_sale_settings%rowtype;
  card_row public.card_catalogue%rowtype;
  wallet_balance bigint;
  owned_count integer;
  excess_count integer;
  sold_count integer := 0;
  unit_value bigint;
  total_value bigint;
  sale_copy record;
begin
  select * into settings_row
  from public.reader_card_sale_settings
  where user_id=new.owner_user_id;

  if not found or settings_row.auto_sell_duplicates=false then
    return new;
  end if;

  select * into card_row
  from public.card_catalogue
  where card_id=new.card_id and is_active=true;
  if not found then return new; end if;

  select count(*) into owned_count
  from public.reader_card_copies
  where owner_user_id=new.owner_user_id and card_id=new.card_id;

  excess_count := owned_count-settings_row.keep_copies;
  if excess_count <= 0 then return new; end if;

  insert into public.reader_xanth_accounts(user_id)
  values(new.owner_user_id) on conflict(user_id) do nothing;
  select balance_cents into wallet_balance
  from public.reader_xanth_accounts
  where user_id=new.owner_user_id
  for update;

  unit_value := greatest(1,floor(public.xanth_rarity_price(card_row.rarity)::numeric*0.5)::bigint);

  for sale_copy in
    select c.copy_id
    from public.reader_card_copies c
    where c.owner_user_id=new.owner_user_id and c.card_id=new.card_id
      and not exists (
        select 1 from public.card_trade_offers t
        where t.offered_copy_id=c.copy_id and t.status='pending'
      )
    order by c.acquired_at desc,c.copy_id desc
    limit excess_count
    for update skip locked
  loop
    delete from public.reader_card_copies
    where copy_id=sale_copy.copy_id;
    if found then sold_count:=sold_count+1; end if;
  end loop;

  if sold_count=0 then return new; end if;

  total_value := unit_value*sold_count;
  update public.reader_xanth_accounts
  set balance_cents=balance_cents+total_value,updated_at=now()
  where user_id=new.owner_user_id
  returning balance_cents into wallet_balance;

  insert into public.reader_xanth_transactions
    (user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values
    (new.owner_user_id,total_value,wallet_balance,'duplicate_sale_auto',
     'Automatically sold '||sold_count||' duplicate '||card_row.name||' card'||case when sold_count=1 then '' else 's' end,
     gen_random_uuid()::text,
     jsonb_build_object('card_id',new.card_id,'copies_sold',sold_count,
                        'unit_value_cents',unit_value,'automatic',true,
                        'keep_copies',settings_row.keep_copies));

  return new;
end;
$$;

drop trigger if exists reader_card_auto_sell_duplicates on public.reader_card_copies;
create trigger reader_card_auto_sell_duplicates
after insert or update of owner_user_id on public.reader_card_copies
for each row execute function public.auto_sell_excess_card_copies();

-- Extend trade acceptance so the received card is checked for auto-sale
-- after the offer is marked accepted (pending offers remain protected).
create or replace function public.respond_to_card_trade(
  target_offer_id uuid,
  accept_offer boolean
)
returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $trade$
declare
  reader_id uuid := auth.uid();
  offer_row public.card_trade_offers%rowtype;
  offered_owner uuid;
  requested_copy_id uuid;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;

  select * into offer_row
  from public.card_trade_offers t
  where t.offer_id=target_offer_id
    and t.recipient_user_id=reader_id
  for update;
  if not found then raise exception 'Trade offer not found'; end if;
  if offer_row.status<>'pending' then raise exception 'This trade offer is no longer pending'; end if;

  if not coalesce(accept_offer,false) then
    update public.card_trade_offers
    set status='declined',responded_at=now()
    where offer_id=target_offer_id;
    return 'declined';
  end if;

  select c.owner_user_id into offered_owner
  from public.reader_card_copies c
  where c.copy_id=offer_row.offered_copy_id
  for update;
  if offered_owner is distinct from offer_row.proposer_user_id then
    raise exception 'The offered card is no longer owned by the proposer';
  end if;

  select c.copy_id into requested_copy_id
  from public.reader_card_copies c
  where c.owner_user_id=reader_id
    and c.card_id=offer_row.requested_card_id
    and not exists (
      select 1 from public.card_trade_offers pending_trade
      where pending_trade.offered_copy_id=c.copy_id
        and pending_trade.status='pending'
    )
  order by c.acquired_at,c.copy_id
  limit 1
  for update skip locked;
  if requested_copy_id is null then
    raise exception 'You no longer have an available copy of the requested card';
  end if;

  update public.reader_card_copies
  set owner_user_id=offer_row.proposer_user_id
  where copy_id=requested_copy_id;

  update public.reader_card_copies
  set owner_user_id=reader_id
  where copy_id=offer_row.offered_copy_id;

  update public.card_trade_offers
  set status='accepted',responded_at=now(),completed_at=now()
  where offer_id=target_offer_id;

  -- Re-touch the received copy after the offer is no longer pending.
  -- This lets auto-sell process it without ever selling an open offer.
  update public.reader_card_copies
  set owner_user_id=reader_id
  where copy_id=offer_row.offered_copy_id;

  return 'accepted';
end;
$trade$;

revoke all on function public.respond_to_card_trade(uuid,boolean) from public,anon;
grant execute on function public.respond_to_card_trade(uuid,boolean) to authenticated;

revoke all on function public.get_my_duplicate_sale_settings() from public,anon;
revoke all on function public.set_my_duplicate_sale_settings(boolean,integer) from public,anon;
revoke all on function public.sell_my_duplicate_cards(text,integer) from public,anon;
revoke all on function public.auto_sell_excess_card_copies() from public,anon,authenticated;

grant execute on function public.get_my_duplicate_sale_settings() to authenticated;
grant execute on function public.set_my_duplicate_sale_settings(boolean,integer) to authenticated;
grant execute on function public.sell_my_duplicate_cards(text,integer) to authenticated;

-- Verification
select
  (select relrowsecurity from pg_class where oid='public.reader_card_sale_settings'::regclass) as settings_rls_enabled,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'get_my_duplicate_sale_settings','set_my_duplicate_sale_settings',
     'sell_my_duplicate_cards','auto_sell_excess_card_copies'
   )) as stage_7e_functions,
  (select count(*) from pg_trigger
   where tgname='reader_card_auto_sell_duplicates' and not tgisinternal) as auto_sell_trigger_installed;
