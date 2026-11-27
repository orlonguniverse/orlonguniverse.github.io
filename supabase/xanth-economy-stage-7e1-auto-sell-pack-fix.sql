-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7E.1: AUTO-SELL + PACK FIX
-- Run once after Stage 7E duplicate sales.
--
-- Fixes:
-- 1. Saving an automatic-selling limit immediately reconciles
--    existing copies down to that limit where copies are available.
-- 2. The insert trigger never deletes the newly acquired copy.
--    This preserves card-reveal queue creation for Mystery Packs,
--    Daily Shop purchases and other card rewards.
-- 3. Pending trade copies remain protected.
-- ============================================================

create or replace function public.apply_my_duplicate_sale_limit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  settings_row public.reader_card_sale_settings%rowtype;
  card_row record;
  owned_count integer;
  excess_count integer;
  sold_count integer;
  unit_value bigint;
  total_value bigint;
  wallet_balance bigint;
  total_sold integer := 0;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'You can only manage your own duplicate collection';
  end if;

  select * into settings_row
  from public.reader_card_sale_settings
  where user_id=p_user_id;

  if not found or not settings_row.auto_sell_duplicates then
    return 0;
  end if;

  insert into public.reader_xanth_accounts(user_id)
  values(p_user_id) on conflict(user_id) do nothing;

  perform 1 from public.reader_xanth_accounts
  where user_id=p_user_id
  for update;

  for card_row in
    select c.card_id,cat.name,cat.rarity
    from public.reader_card_copies c
    join public.card_catalogue cat on cat.card_id=c.card_id
    where c.owner_user_id=p_user_id
    group by c.card_id,cat.name,cat.rarity
  loop
    select count(*)::integer into owned_count
    from public.reader_card_copies
    where owner_user_id=p_user_id and card_id=card_row.card_id;

    excess_count := owned_count-settings_row.keep_copies;
    if excess_count<=0 then continue; end if;

    with candidates as (
      select c.copy_id
      from public.reader_card_copies c
      where c.owner_user_id=p_user_id
        and c.card_id=card_row.card_id
        and not exists (
          select 1 from public.card_trade_offers t
          where t.offered_copy_id=c.copy_id and t.status='pending'
        )
      order by c.acquired_at asc,c.copy_id asc
      limit excess_count
      for update skip locked
    )
    delete from public.reader_card_copies c
    using candidates x
    where c.copy_id=x.copy_id;

    get diagnostics sold_count=row_count;
    if sold_count<=0 then continue; end if;

    unit_value := greatest(1,floor(public.xanth_rarity_price(card_row.rarity)::numeric*0.5)::bigint);
    total_value := unit_value*sold_count;

    update public.reader_xanth_accounts
    set balance_cents=balance_cents+total_value,updated_at=now()
    where user_id=p_user_id
    returning balance_cents into wallet_balance;

    insert into public.reader_xanth_transactions
      (user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
    values
      (p_user_id,total_value,wallet_balance,'duplicate_sale_auto',
       'Automatically sold '||sold_count||' excess '||card_row.name||' card'||case when sold_count=1 then '' else 's' end,
       gen_random_uuid()::text,
       jsonb_build_object('card_id',card_row.card_id,'copies_sold',sold_count,
                          'unit_value_cents',unit_value,'automatic',true,
                          'keep_copies',settings_row.keep_copies,
                          'reconciled_existing_copies',true));

    total_sold := total_sold+sold_count;
  end loop;

  return total_sold;
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
  reconciled_count integer := 0;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if p_keep_copies is null or p_keep_copies<1 or p_keep_copies>100 then
    raise exception 'Choose a keep limit between 1 and 100 copies';
  end if;

  insert into public.reader_card_sale_settings(user_id,auto_sell_duplicates,keep_copies,updated_at)
  values(reader_id,coalesce(p_auto_sell,false),p_keep_copies,now())
  on conflict(user_id) do update set
    auto_sell_duplicates=excluded.auto_sell_duplicates,
    keep_copies=excluded.keep_copies,
    updated_at=now()
  returning * into result_row;

  if result_row.auto_sell_duplicates then
    reconciled_count := public.apply_my_duplicate_sale_limit(reader_id);
  end if;

  return jsonb_build_object(
    'auto_sell_duplicates',result_row.auto_sell_duplicates,
    'keep_copies',result_row.keep_copies,
    'sale_value_percent',50,
    'existing_copies_sold',reconciled_count
  );
end;
$$;

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
  if excess_count<=0 then return new; end if;

  insert into public.reader_xanth_accounts(user_id)
  values(new.owner_user_id) on conflict(user_id) do nothing;

  select balance_cents into wallet_balance
  from public.reader_xanth_accounts
  where user_id=new.owner_user_id
  for update;

  unit_value := greatest(1,floor(public.xanth_rarity_price(card_row.rarity)::numeric*0.5)::bigint);

  -- Crucially exclude NEW: the reveal-queue trigger must still be able
  -- to create a notification for this newly acquired physical copy.
  -- Sell the oldest available existing copies first; never sell pending
  -- trade copies.
  for sale_copy in
    select c.copy_id
    from public.reader_card_copies c
    where c.owner_user_id=new.owner_user_id
      and c.card_id=new.card_id
      and c.copy_id<>new.copy_id
      and not exists (
        select 1 from public.card_trade_offers t
        where t.offered_copy_id=c.copy_id and t.status='pending'
      )
    order by c.acquired_at asc,c.copy_id asc
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
     'Automatically sold '||sold_count||' excess '||card_row.name||' card'||case when sold_count=1 then '' else 's' end,
     gen_random_uuid()::text,
     jsonb_build_object('card_id',new.card_id,'copies_sold',sold_count,
                        'unit_value_cents',unit_value,'automatic',true,
                        'keep_copies',settings_row.keep_copies));

  return new;
end;
$$;

revoke all on function public.apply_my_duplicate_sale_limit(uuid) from public,anon,authenticated;
revoke all on function public.set_my_duplicate_sale_settings(boolean,integer) from public,anon;
revoke all on function public.auto_sell_excess_card_copies() from public,anon,authenticated;
grant execute on function public.set_my_duplicate_sale_settings(boolean,integer) to authenticated;

-- Reinstall the trigger with the corrected function body.
drop trigger if exists reader_card_auto_sell_duplicates on public.reader_card_copies;
create trigger reader_card_auto_sell_duplicates
after insert or update of owner_user_id on public.reader_card_copies
for each row execute function public.auto_sell_excess_card_copies();

-- Verification: helper, settings RPC, trigger function and trigger.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'apply_my_duplicate_sale_limit','set_my_duplicate_sale_settings',
     'auto_sell_excess_card_copies'
   )) as corrected_functions,
  (select count(*) from pg_trigger
   where tgname='reader_card_auto_sell_duplicates' and not tgisinternal) as auto_sell_trigger_installed;
