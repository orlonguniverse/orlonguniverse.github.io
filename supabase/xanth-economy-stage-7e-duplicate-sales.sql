-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7E: DUPLICATE SALES
-- Run after Stage 7A, 7B, 7C and 7D migrations.
--
-- Readers may sell surplus physical copies for 50% of the
-- rarity-based Xanth value. Auto-sell can be enabled per reader
-- and configured to retain a chosen number of each card.
-- Pending trade copies are never sold. One copy is always retained
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

create or replace function public.get_my_duplicate_sale_settings()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $
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
    raise exception 'No duplicate copies are available to sell. A copy may be reserved in a pending trade';
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
-- Existing card-to-card transfers remain untouched so completed trade records
-- and their copy references are preserved.
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
after insert on public.reader_card_copies
for each row execute function public.auto_sell_excess_card_copies();

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
