-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7B: SECURE CARD PURCHASES
-- Run after xanth-economy-stage-7-foundation.sql and the existing
-- card reward / reveal migrations.
--
-- Purchases debit Xanth, create a genuine owned card copy, enqueue
-- the normal cinematic reveal, and append an immutable ledger row.
-- All validation and balance changes occur in one database transaction.
-- ============================================================

-- Extend the existing reward provenance types without changing earlier
-- chapter or achievement reward behaviour.
alter table public.card_reward_pools
  drop constraint if exists card_reward_pools_activity_type_check;
alter table public.card_reward_pools
  add constraint card_reward_pools_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock','shop_purchase'
  ));

alter table public.card_reward_claims
  drop constraint if exists card_reward_claims_activity_type_check;
alter table public.card_reward_claims
  add constraint card_reward_claims_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock','shop_purchase'
  ));

-- One provenance pool is shared by all exchange purchases. Each purchase
-- gets its own unique chapter_id, so repeat purchases and duplicates work.
insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
values('xanth-exchange-purchases','shop_purchase','xanth-exchange','Xantheon Exchange Purchases',true)
on conflict(pool_id) do update set
  activity_type=excluded.activity_type,
  chapter_id=excluded.chapter_id,
  title=excluded.title,
  is_active=true;

create or replace function public.purchase_xanth_shop_card(
  p_slot_number integer,
  p_shop_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  target_date date := coalesce(p_shop_date,(now() at time zone 'Australia/Brisbane')::date);
  wallet_balance bigint;
  slot_row public.xanth_shop_slots%rowtype;
  card_row public.card_catalogue%rowtype;
  new_claim_id uuid := gen_random_uuid();
  new_copy_id uuid;
  balance_after bigint;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if target_date <> (now() at time zone 'Australia/Brisbane')::date then
    raise exception 'Only cards in today’s exchange can be purchased';
  end if;
  if p_slot_number not between 1 and 3 then raise exception 'Choose a valid shop slot'; end if;

  insert into public.reader_xanth_accounts(user_id)
  values(reader_id) on conflict(user_id) do nothing;

  select a.balance_cents into wallet_balance
  from public.reader_xanth_accounts a
  where a.user_id=reader_id
  for update;

  perform public.ensure_xanth_daily_shop(target_date);

  select * into slot_row
  from public.xanth_shop_slots s
  where s.shop_date=target_date and s.slot_number=p_slot_number
  for update;

  if not found then raise exception 'That featured card is no longer available'; end if;

  select * into card_row
  from public.card_catalogue c
  where c.card_id=slot_row.card_id
    and c.is_active=true
    and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01');

  if not found then raise exception 'That card is no longer available for purchase'; end if;
  if wallet_balance < slot_row.price_cents then
    raise exception 'Not enough Xanth. Your balance is % cents and this card costs % cents',
      wallet_balance,slot_row.price_cents;
  end if;

  balance_after := wallet_balance-slot_row.price_cents;

  update public.reader_xanth_accounts
  set balance_cents=balance_after,updated_at=now()
  where user_id=reader_id;

  insert into public.card_reward_claims
    (claim_id,user_id,activity_type,chapter_id,pool_id,card_id)
  values
    (new_claim_id,reader_id,'shop_purchase','xanth-'||new_claim_id::text,
     'xanth-exchange-purchases',card_row.card_id);

  insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
  values(reader_id,card_row.card_id,new_claim_id)
  returning copy_id into new_copy_id;

  insert into public.reader_xanth_transactions
    (user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values
    (reader_id,-slot_row.price_cents,balance_after,'shop_purchase',
     'Daily Exchange purchase: '||card_row.card_number||' · '||card_row.name,
     new_claim_id::text,
     jsonb_build_object('shop_date',target_date,'slot_number',p_slot_number,
                        'card_id',card_row.card_id,'copy_id',new_copy_id));

  return jsonb_build_object(
    'success',true,'copy_id',new_copy_id,'claim_id',new_claim_id,
    'card_id',card_row.card_id,'card_number',card_row.card_number,
    'card_name',card_row.name,'price_cents',slot_row.price_cents,
    'balance_cents',balance_after
  );
end;
$$;

-- Moderator-only grants provide a controlled way to seed/test wallets and
-- award event prizes. The browser cannot choose its own user or balance.
create or replace function public.moderator_grant_xanth(
  p_reader_id uuid,
  p_amount_cents bigint,
  p_description text default 'Xanth grant'
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  balance_after bigint;
  clean_description text := left(coalesce(nullif(trim(p_description),''),'Xanth grant'),180);
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  if p_reader_id is null or not exists(select 1 from auth.users where id=p_reader_id) then
    raise exception 'Reader account not found';
  end if;
  if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>100000000 then
    raise exception 'Grant must be a positive amount of up to XƵ1,000,000';
  end if;

  insert into public.reader_xanth_accounts(user_id)
  values(p_reader_id) on conflict(user_id) do nothing;

  update public.reader_xanth_accounts
  set balance_cents=balance_cents+p_amount_cents,updated_at=now()
  where user_id=p_reader_id
  returning balance_cents into balance_after;

  insert into public.reader_xanth_transactions
    (user_id,amount_cents,balance_after_cents,transaction_type,description,metadata)
  values
    (p_reader_id,p_amount_cents,balance_after,'moderator_grant',clean_description,
     jsonb_build_object('granted_by',auth.uid()));

  return jsonb_build_object('success',true,'balance_cents',balance_after,
                            'granted_cents',p_amount_cents);
end;
$$;

revoke all on function public.purchase_xanth_shop_card(integer,date) from public,anon;
revoke all on function public.moderator_grant_xanth(uuid,bigint,text) from public,anon;
grant execute on function public.purchase_xanth_shop_card(integer,date) to authenticated;
grant execute on function public.moderator_grant_xanth(uuid,bigint,text) to authenticated;

-- Verification: the shop provenance type is enabled and the two secure
-- RPCs are present. No reader-facing direct table writes are granted.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('purchase_xanth_shop_card','moderator_grant_xanth')) as stage_7b_functions,
  (select count(*) from public.card_reward_pools
   where pool_id='xanth-exchange-purchases' and activity_type='shop_purchase') as purchase_provenance_pool,
  (select relrowsecurity from pg_class where oid='public.reader_xanth_accounts'::regclass) as wallet_rls_enabled,
  (select relrowsecurity from pg_class where oid='public.reader_xanth_transactions'::regclass) as ledger_rls_enabled;
