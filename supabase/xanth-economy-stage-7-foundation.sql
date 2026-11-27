-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7A: XANTH WALLET + DAILY SHOP
-- Run after the existing card catalogue, moderator and card-reward
-- migrations. All monetary values are stored as integer cents.
--
-- Xantheon Xanth (XTH): 1 Xanth = 100 cents; 100 XTH = AUD $1.
-- The shop rotates in Australia/Brisbane local time.
-- Only active cards currently eligible for the public archive are
-- included. Future unreleased cards remain hidden until released.
-- ============================================================

create table if not exists public.reader_xanth_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_xanth_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  transaction_type text not null,
  description text not null,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reader_xanth_transactions_reader_date
  on public.reader_xanth_transactions(user_id, created_at desc);

create table if not exists public.xanth_shop_days (
  shop_date date primary key,
  generated_at timestamptz not null default now()
);

create table if not exists public.xanth_shop_slots (
  shop_date date not null references public.xanth_shop_days(shop_date) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 3),
  card_id text not null references public.card_catalogue(card_id),
  price_cents bigint not null check (price_cents > 0),
  selection_mode text not null default 'automatic'
    check (selection_mode in ('automatic','manual')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(shop_date,slot_number),
  unique(shop_date,card_id)
);

alter table public.reader_xanth_accounts enable row level security;
alter table public.reader_xanth_transactions enable row level security;
alter table public.xanth_shop_days enable row level security;
alter table public.xanth_shop_slots enable row level security;

revoke all on public.reader_xanth_accounts from anon, authenticated;
revoke all on public.reader_xanth_transactions from anon, authenticated;
revoke all on public.xanth_shop_days from anon, authenticated;
revoke all on public.xanth_shop_slots from anon, authenticated;

-- Ensure a wallet exists without allowing a browser to set its balance.
create or replace function public.get_my_xanth_wallet()
returns table(balance_cents bigint, balance_xanth numeric, currency_code text, currency_symbol text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  insert into public.reader_xanth_accounts(user_id)
  values(reader_id) on conflict(user_id) do nothing;

  return query
  select a.balance_cents,
         (a.balance_cents::numeric / 100)::numeric(18,2),
         'XTH'::text,
         'XƵ'::text
  from public.reader_xanth_accounts a
  where a.user_id=reader_id;
end;
$$;

create or replace function public.get_my_xanth_transactions(p_limit integer default 30)
returns table(
  transaction_id uuid,
  amount_cents bigint,
  balance_after_cents bigint,
  transaction_type text,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  return query
  select t.transaction_id,t.amount_cents,t.balance_after_cents,
         t.transaction_type,t.description,t.created_at
  from public.reader_xanth_transactions t
  where t.user_id=reader_id
  order by t.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100));
end;
$$;

-- Shop prices are stored in cents of Xanth (100 cents = XƵ1).
-- Baseline prices can be overridden per featured slot by a moderator.
create or replace function public.xanth_default_card_price(p_rarity text)
returns bigint
language sql
immutable
as $$
  select case lower(coalesce(p_rarity,'common'))
    when 'common' then 1000::bigint
    when 'uncommon' then 2500::bigint
    when 'rare' then 5000::bigint
    when 'epic' then 10000::bigint
    when 'legendary' then 25000::bigint
    else 1000::bigint
  end;
$$;

-- Create the day's three automatic featured cards once. Subsequent
-- visits reuse the same slots; manual replacements are never rotated
-- away during that shop day.
create or replace function public.ensure_xanth_daily_shop(p_shop_date date default null)
returns date
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_date date := coalesce(p_shop_date,(now() at time zone 'Australia/Brisbane')::date);
  slot_count integer;
begin
  if auth.uid() is null or not public.is_reader_moderator() and p_shop_date is not null
     and p_shop_date <> (now() at time zone 'Australia/Brisbane')::date then
    raise exception 'Shop date access denied';
  end if;

  insert into public.xanth_shop_days(shop_date)
  values(target_date) on conflict(shop_date) do nothing;

  select count(*) into slot_count
  from public.xanth_shop_slots where shop_date=target_date;

  if slot_count < 3 then
    with eligible as (
      select c.card_id,c.rarity,
             row_number() over(order by random()) as rn
      from public.card_catalogue c
      where c.is_active=true
        and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
        and not exists(
          select 1 from public.xanth_shop_slots s
          where s.shop_date=target_date and s.card_id=c.card_id
        )
    ),
    needed as (
      select e.card_id,e.rarity,
             (select coalesce(max(s.slot_number),0)
                from public.xanth_shop_slots s
               where s.shop_date=target_date)
             + row_number() over(order by e.rn) as slot_no
      from eligible e
      where e.rn <= 3-slot_count
    )
    insert into public.xanth_shop_slots(shop_date,slot_number,card_id,price_cents)
    select target_date,n.slot_no,n.card_id,
           public.xanth_default_card_price(n.rarity)
    from needed n
    on conflict do nothing;
  end if;

  return target_date;
end;
$$;

create or replace function public.get_xanth_daily_shop()
returns table(
  shop_date date,
  slot_number integer,
  card_id text,
  card_number text,
  card_name text,
  rarity text,
  category_id text,
  category_label text,
  chapter_number integer,
  artwork_url text,
  description text,
  price_cents bigint,
  price_xanth numeric,
  selection_mode text
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_date date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  target_date := public.ensure_xanth_daily_shop(null);

  return query
  select s.shop_date,s.slot_number,c.card_id,c.card_number,c.name,c.rarity,
         c.category_id,cat.label,c.chapter_number,c.artwork_url,
         c.spoiler_safe_description,s.price_cents,
         (s.price_cents::numeric/100)::numeric(18,2),
         s.selection_mode
  from public.xanth_shop_slots s
  join public.card_catalogue c on c.card_id=s.card_id
  join public.card_categories cat on cat.category_id=c.category_id
  where s.shop_date=target_date
  order by s.slot_number;
end;
$$;

-- Moderator dashboard data: current slots plus the complete currently
-- released card list for the manual replacement selector.
create or replace function public.moderator_get_xanth_shop(p_shop_date date default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_date date := coalesce(p_shop_date,(now() at time zone 'Australia/Brisbane')::date);
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  perform public.ensure_xanth_daily_shop(target_date);

  return jsonb_build_object(
    'shop_date',target_date,
    'slots',(select coalesce(jsonb_agg(jsonb_build_object(
      'slot_number',s.slot_number,'card_id',s.card_id,'card_number',c.card_number,
      'name',c.name,'rarity',c.rarity,'price_cents',s.price_cents,
      'price_xanth',(s.price_cents::numeric/100),'selection_mode',s.selection_mode
    ) order by s.slot_number),'[]'::jsonb)
    from public.xanth_shop_slots s join public.card_catalogue c on c.card_id=s.card_id
    where s.shop_date=target_date),
    'eligible_cards',(select coalesce(jsonb_agg(jsonb_build_object(
      'card_id',c.card_id,'card_number',c.card_number,'name',c.name,
      'rarity',c.rarity,'category_id',c.category_id,'artwork_url',c.artwork_url
    ) order by cat.sort_order,c.category_number),'[]'::jsonb)
    from public.card_catalogue c
    join public.card_categories cat on cat.category_id=c.category_id
    where c.is_active=true
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01'))
  );
end;
$$;

create or replace function public.moderator_set_xanth_shop_slot(
  p_shop_date date,
  p_slot_number integer,
  p_card_id text,
  p_price_cents bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_date date := coalesce(p_shop_date,(now() at time zone 'Australia/Brisbane')::date);
  target_rarity text;
  existing_price bigint;
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  if p_slot_number not between 1 and 3 then raise exception 'Choose a valid shop slot'; end if;
  if target_date < (now() at time zone 'Australia/Brisbane')::date
     or target_date > (now() at time zone 'Australia/Brisbane')::date + 30 then
    raise exception 'Shop overrides can only be made for today or the next 30 days';
  end if;

  select c.rarity into target_rarity
  from public.card_catalogue c
  where c.card_id=p_card_id
    and c.is_active=true
    and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01');
  if target_rarity is null then raise exception 'That card is not currently eligible for the shop'; end if;

  perform public.ensure_xanth_daily_shop(target_date);

  select s.price_cents into existing_price
  from public.xanth_shop_slots s
  where s.shop_date=target_date and s.slot_number=p_slot_number;

  if exists(select 1 from public.xanth_shop_slots
            where shop_date=target_date and card_id=p_card_id
              and slot_number<>p_slot_number) then
    raise exception 'That card is already in another slot for this day';
  end if;

  insert into public.xanth_shop_slots
    (shop_date,slot_number,card_id,price_cents,selection_mode,updated_by,updated_at)
  values(target_date,p_slot_number,p_card_id,
         coalesce(p_price_cents,existing_price,public.xanth_default_card_price(target_rarity)),
         'manual',auth.uid(),now())
  on conflict(shop_date,slot_number) do update set
    card_id=excluded.card_id,
    price_cents=excluded.price_cents,
    selection_mode='manual',
    updated_by=auth.uid(),
    updated_at=now();

  return jsonb_build_object('shop_date',target_date,'slot_number',p_slot_number,
                            'card_id',p_card_id,'selection_mode','manual');
end;
$$;

revoke all on function public.get_my_xanth_wallet() from public,anon;
revoke all on function public.get_my_xanth_transactions(integer) from public,anon;
revoke all on function public.xanth_default_card_price(text) from public,anon,authenticated;
revoke all on function public.ensure_xanth_daily_shop(date) from public,anon,authenticated;
revoke all on function public.get_xanth_daily_shop() from public,anon;
revoke all on function public.moderator_get_xanth_shop(date) from public,anon;
revoke all on function public.moderator_set_xanth_shop_slot(date,integer,text,bigint) from public,anon;

grant execute on function public.get_my_xanth_wallet() to authenticated;
grant execute on function public.get_my_xanth_transactions(integer) to authenticated;
grant execute on function public.get_xanth_daily_shop() to authenticated;
grant execute on function public.moderator_get_xanth_shop(date) to authenticated;
grant execute on function public.moderator_set_xanth_shop_slot(date,integer,text,bigint) to authenticated;

-- Verification: account/ledger tables are private; only scoped RPCs
-- expose the signed-in reader's own wallet and the released daily shop.
select
  (select relrowsecurity from pg_class where oid='public.reader_xanth_accounts'::regclass) as wallet_rls_enabled,
  (select relrowsecurity from pg_class where oid='public.reader_xanth_transactions'::regclass) as ledger_rls_enabled,
  (select count(*) from public.card_catalogue
    where is_active and (unlock_chapter_id is null or unlock_chapter_id='chapter-01')) as currently_shop_eligible_cards;
