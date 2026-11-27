-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7D: RARITY & VALUE SYSTEM
-- Run after Stage 7A (Xanth foundation), 7B (purchases) and
-- 7C (Mystery Vault). This is the only new Stage 7D SQL file.
--
-- Rarity odds apply to all Reading Room task rewards, achievement
-- rewards, mixed packs and the automatic daily shop.
-- A missing rarity tier is redistributed proportionally among the
-- rarity tiers that are actually available in that reward pool.
-- ============================================================

-- Rarity order and relative odds. When all tiers are present:
-- Common 70%, Uncommon 20%, Rare 7%, Epic 2.5%, Legendary 0.5%.
-- These are tier-level odds, not per-card odds: adding more cards
-- to one rarity does not make that rarity more likely to be drawn.
create or replace function public.xanth_rarity_weight(p_rarity text)
returns numeric
language sql
immutable
parallel safe
as $$
  select case lower(coalesce(p_rarity,'common'))
    when 'common' then 70::numeric
    when 'uncommon' then 20::numeric
    when 'rare' then 7::numeric
    when 'epic' then 2.5::numeric
    when 'legendary' then 0.5::numeric
    else 0::numeric
  end;
$$;

-- Base single-card values, stored as cents of Xanth.
-- Common XƵ10, Uncommon XƵ35, Rare XƵ125, Epic XƵ450,
-- Legendary XƵ1,800.
create or replace function public.xanth_rarity_price(p_rarity text)
returns bigint
language sql
immutable
parallel safe
as $$
  select case lower(coalesce(p_rarity,'common'))
    when 'common' then 1000::bigint
    when 'uncommon' then 3500::bigint
    when 'rare' then 12500::bigint
    when 'epic' then 45000::bigint
    when 'legendary' then 180000::bigint
    else 1000::bigint
  end;
$$;

create or replace function public.xanth_default_card_price(p_rarity text)
returns bigint
language sql
immutable
as $$
  select public.xanth_rarity_price(p_rarity);
$$;

-- Secure task/achievement reward selector. All four Reading Room task
-- types and achievement unlocks use this same rarity-weighted draw.
-- First choose a rarity tier by its configured weight, then choose one
-- card uniformly within that tier. This keeps odds stable as catalogues
-- grow and prevents a large Common set overwhelming a small Legendary set.
create or replace function public.award_reader_card(
  target_user_id uuid,
  target_activity_type text,
  target_chapter_id text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  selected_pool_id text;
  selected_card_id text;
  selected_rarity text;
  new_claim_id uuid;
  chapter_no integer;
  chapter_match text;
begin
  if target_user_id is null or target_chapter_id is null then
    return null;
  end if;

  if target_activity_type not in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock'
  ) then
    return null;
  end if;

  if target_activity_type='achievement_unlock' then
    select p.pool_id into selected_pool_id
    from public.card_reward_pools p
    where p.activity_type=target_activity_type
      and p.chapter_id=target_chapter_id
      and p.is_active=true;

    if selected_pool_id is null then return null; end if;

    -- Achievement rewards draw from the released Chapter One pool.
    select tier.rarity into selected_rarity
    from (
      select distinct c.rarity
      from public.card_catalogue c
      where c.is_active=true
        and c.chapter_number=1
        and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
    ) tier
    order by -ln(greatest(random(),0.000000001)) /
      public.xanth_rarity_weight(tier.rarity)::double precision
    limit 1;

    if selected_rarity is null then return null; end if;

    select c.card_id into selected_card_id
    from public.card_catalogue c
    where c.is_active=true
      and c.chapter_number=1
      and c.rarity=selected_rarity
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
    order by random()
    limit 1;
  else
    chapter_match := substring(target_chapter_id from '^chapter-0*([0-9]+)$');
    if chapter_match is null then return null; end if;
    chapter_no := chapter_match::integer;
    if chapter_no < 1 or chapter_no > 999 then return null; end if;

    perform public.sync_chapter_card_reward_pools();

    selected_pool_id := target_chapter_id || '-' ||
      case target_activity_type
        when 'chapter_completion' then 'completion'
        when 'chapter_reaction' then 'reaction'
        when 'chapter_challenge' then 'challenge'
        when 'approved_comment' then 'comment'
      end;

    select tier.rarity into selected_rarity
    from (
      select distinct c.rarity
      from public.card_catalogue c
      where c.is_active=true
        and c.chapter_number=chapter_no
        and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
    ) tier
    order by -ln(greatest(random(),0.000000001)) /
      public.xanth_rarity_weight(tier.rarity)::double precision
    limit 1;

    if selected_rarity is null then return null; end if;

    select c.card_id into selected_card_id
    from public.card_catalogue c
    where c.is_active=true
      and c.chapter_number=chapter_no
      and c.rarity=selected_rarity
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
    order by random()
    limit 1;
  end if;

  if selected_card_id is null then return null; end if;

  insert into public.card_reward_claims
    (user_id,activity_type,chapter_id,pool_id,card_id)
  values
    (target_user_id,target_activity_type,target_chapter_id,
     selected_pool_id,selected_card_id)
  on conflict (user_id,activity_type,chapter_id) do nothing
  returning claim_id into new_claim_id;

  if new_claim_id is null then return null; end if;

  insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
  values(target_user_id,selected_card_id,new_claim_id);

  return new_claim_id;
end;
$$;

-- The daily Exchange uses the same rarity odds. Each slot first rolls
-- a rarity, then selects a random card of that rarity without duplicating
-- a card already featured on that date.
create or replace function public.ensure_xanth_daily_shop(p_shop_date date default null)
returns date
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_date date := coalesce(p_shop_date,(now() at time zone 'Australia/Brisbane')::date);
  missing_slot record;
  selected_rarity text;
  selected_card_id text;
begin
  if auth.uid() is null or not public.is_reader_moderator() and p_shop_date is not null
     and p_shop_date <> (now() at time zone 'Australia/Brisbane')::date then
    raise exception 'Shop date access denied';
  end if;

  insert into public.xanth_shop_days(shop_date)
  values(target_date) on conflict(shop_date) do nothing;

  delete from public.xanth_shop_slots s
  using public.card_catalogue c
  where s.shop_date=target_date
    and c.card_id=s.card_id
    and (c.is_active=false or
         (c.unlock_chapter_id is not null and c.unlock_chapter_id<>'chapter-01'));

  for missing_slot in
    select gs.slot_no
    from generate_series(1,3) as gs(slot_no)
    where not exists(
      select 1 from public.xanth_shop_slots s
      where s.shop_date=target_date and s.slot_number=gs.slot_no
    )
    order by gs.slot_no
  loop
    select tier.rarity into selected_rarity
    from (
      select distinct c.rarity
      from public.card_catalogue c
      where c.is_active=true
        and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
        and not exists(
          select 1 from public.xanth_shop_slots s
          where s.shop_date=target_date and s.card_id=c.card_id
        )
    ) tier
    order by -ln(greatest(random(),0.000000001)) /
      public.xanth_rarity_weight(tier.rarity)::double precision
    limit 1;

    if selected_rarity is null then exit; end if;

    select c.card_id into selected_card_id
    from public.card_catalogue c
    where c.is_active=true
      and c.rarity=selected_rarity
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
      and not exists(
        select 1 from public.xanth_shop_slots s
        where s.shop_date=target_date and s.card_id=c.card_id
      )
    order by random()
    limit 1;

    if selected_card_id is not null then
      insert into public.xanth_shop_slots(shop_date,slot_number,card_id,price_cents)
      values(target_date,missing_slot.slot_no,selected_card_id,
             public.xanth_default_card_price(selected_rarity))
      on conflict do nothing;
    end if;
  end loop;

  return target_date;
end;
$$;

-- Reprice existing automatic shop slots from the new rarity ladder.
-- Moderator-set prices are deliberately preserved.
update public.xanth_shop_slots s
set price_cents=public.xanth_default_card_price(c.rarity),
    updated_at=now()
from public.card_catalogue c
where c.card_id=s.card_id
  and s.selection_mode='automatic'
  and s.shop_date >= (now() at time zone 'Australia/Brisbane')::date;

-- Dynamic Mystery Vault catalogue. Mixed packs use the weighted expected
-- value of the rarity tiers available in their eligible pool, with a 20%
-- pack discount. Guaranteed-rarity packs are priced from that tier's value.
create or replace function public.get_xanth_mystery_packs()
returns table(
  pack_id text,
  title text,
  theme_type text,
  theme_label text,
  description text,
  card_count integer,
  price_cents bigint,
  eligible_count bigint,
  accent text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with eligible as (
    select c.card_id,c.rarity,c.category_id,c.chapter_number,
           coalesce(cat.label,'Collectibles') as category_label
    from public.card_catalogue c
    left join public.card_categories cat on cat.category_id=c.category_id
    where c.is_active=true
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
  ),
  packs as (
    select 'vault:starter'::text id,'The First Spark'::text name,'vault'::text kind,
      'MIXED DISCOVERIES'::text label,
      'Three cards drawn across the released archive, using the standard rarity odds.'::text description,
      3::integer amount,'#63b7ff'::text colour
    union all
    select 'vault:grand','The Orlong Reliquary','vault','GRAND VAULT',
      'Five discoveries from the released archive, with a better chance to uncover something extraordinary.',
      5,'#d9b76d'
    union all
    select 'vault:collectors-choice','The Collector’s Choice','vault','CURATED MIX',
      'Three cards from across the archive. A balanced way to grow a collection.',
      3,'#79cdbb'
    union all
    select 'chapter:'||lpad(e.chapter_number::text,2,'0'),
      'Chapter '||e.chapter_number||' Pack','chapter','CHAPTER '||e.chapter_number,
      'Two cards drawn only from Chapter '||e.chapter_number::text||', using the standard rarity odds.',
      2,'#5ca7ff'
    from (select distinct chapter_number from eligible where chapter_number between 1 and 999) e
    union all
    select 'chapter-rarity:'||lpad(e.chapter_number::text,2,'0')||':'||e.rarity,
      'Chapter '||e.chapter_number||' · '||initcap(e.rarity),'targeted','CHAPTER + '||upper(e.rarity),
      'Two cards guaranteed from Chapter '||e.chapter_number||' and the '||e.rarity||' rarity tier.',
      2,'#75d4bd'
    from (select chapter_number,lower(rarity) rarity from eligible
          where chapter_number between 1 and 999 and rarity is not null
          group by chapter_number,lower(rarity) having count(*)>=2) e
    union all
    select 'category:'||e.category_id,
      e.category_label||' Pack','category',upper(e.category_label),
      'Two cards selected from the released '||e.category_label||' collection, using standard rarity odds.',
      2,'#bd91ed'
    from (select distinct category_id,category_label from eligible where category_id is not null) e
    union all
    select 'category-rarity:'||e.category_id||':'||e.rarity,
      e.category_label||' · '||initcap(e.rarity),'targeted','CATEGORY + '||upper(e.rarity),
      'Two cards guaranteed from the '||e.category_label||' category and the '||e.rarity||' rarity tier.',
      2,'#75d4bd'
    from (select category_id,category_label,lower(rarity) rarity from eligible
          where category_id is not null and rarity is not null
          group by category_id,category_label,lower(rarity) having count(*)>=2) e
    union all
    select 'rarity:'||r.rarity,
      initcap(r.rarity)||' Cache','rarity',upper(r.rarity)||' RARITY',
      'Two cards guaranteed to come from the '||r.rarity||' rarity tier.',
      2,'#e2bd79'
    from (values
      ('common'::text),('uncommon'),('rare'),('epic'),('legendary')
    ) r(rarity)
  ),
  pack_eligible as (
    select p.id as pack_id,e.card_id,e.rarity
    from packs p
    join eligible e on
      (p.kind='vault')
      or (p.kind='chapter' and e.chapter_number::text=ltrim(split_part(p.id,':',2),'0'))
      or (p.kind='category' and e.category_id=split_part(p.id,':',2))
      or (p.kind='rarity' and lower(e.rarity)=split_part(p.id,':',2))
      or (p.kind='targeted' and split_part(p.id,':',1)='chapter-rarity'
          and e.chapter_number::text=ltrim(split_part(p.id,':',2),'0')
          and lower(e.rarity)=split_part(p.id,':',3))
      or (p.kind='targeted' and split_part(p.id,':',1)='category-rarity'
          and e.category_id=split_part(p.id,':',2)
          and lower(e.rarity)=split_part(p.id,':',3))
  ),
  pack_stats as (
    select p.id,
      count(pe.card_id)::bigint as eligible_count,
      (
        select sum(public.xanth_rarity_weight(t.rarity)*public.xanth_rarity_price(t.rarity)) /
               nullif(sum(public.xanth_rarity_weight(t.rarity)),0)
        from (select distinct pe2.rarity
              from pack_eligible pe2 where pe2.pack_id=p.id) t
      ) as expected_card_price
    from packs p
    left join pack_eligible pe on pe.pack_id=p.id
    group by p.id
  )
  select p.id,p.name,p.kind,p.label,p.description,p.amount,
         ceil(s.expected_card_price*p.amount*0.80)::bigint,
         s.eligible_count,p.colour
  from packs p
  join pack_stats s on s.id=p.id
  where s.eligible_count>=p.amount
  order by case p.kind when 'vault' then 0 when 'chapter' then 1
                       when 'category' then 2 when 'rarity' then 3 else 4 end,
           p.name;
$$;

-- Purchase each card by selecting a weighted rarity tier first, then a
-- random card inside that tier. No duplicate card ID appears twice in one
-- pack, but repeat purchases can still grant duplicate copies as normal.
create or replace function public.purchase_xanth_mystery_pack(p_pack_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  pack_row record;
  wallet_balance bigint;
  balance_after bigint;
  selected record;
  selected_rarity text;
  pack_purchase_id uuid := gen_random_uuid();
  new_claim_id uuid;
  new_copy_id uuid;
  cards_json jsonb := '[]'::jsonb;
  card_ids jsonb := '[]'::jsonb;
  selected_count integer := 0;
begin
  if reader_id is null then raise exception 'Authentication required'; end if;
  if p_pack_id is null or length(p_pack_id)>180 then raise exception 'Choose a valid mystery pack'; end if;

  select * into pack_row
  from public.get_xanth_mystery_packs() p
  where p.pack_id=p_pack_id;

  if not found then raise exception 'This mystery pack is no longer available'; end if;

  insert into public.reader_xanth_accounts(user_id)
  values(reader_id) on conflict(user_id) do nothing;

  select a.balance_cents into wallet_balance
  from public.reader_xanth_accounts a
  where a.user_id=reader_id
  for update;

  if wallet_balance<pack_row.price_cents then
    raise exception 'Not enough Xanth. Your balance is % cents and this pack costs % cents',
      wallet_balance,pack_row.price_cents;
  end if;

  balance_after:=wallet_balance-pack_row.price_cents;

  while selected_count<pack_row.card_count loop
    select tier.rarity into selected_rarity
    from (
      select distinct c.rarity
      from public.card_catalogue c
      where c.is_active=true
        and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
        and not exists(
          select 1 from jsonb_array_elements_text(card_ids) existing(card_id)
          where existing.card_id=c.card_id
        )
        and (
          split_part(p_pack_id,':',1)='vault'
          or (split_part(p_pack_id,':',1)='chapter'
              and c.chapter_number::text=ltrim(split_part(p_pack_id,':',2),'0'))
          or (split_part(p_pack_id,':',1)='category'
              and c.category_id=split_part(p_pack_id,':',2))
          or (split_part(p_pack_id,':',1)='rarity'
              and lower(c.rarity)=split_part(p_pack_id,':',2))
          or (split_part(p_pack_id,':',1)='chapter-rarity'
              and c.chapter_number::text=ltrim(split_part(p_pack_id,':',2),'0')
              and lower(c.rarity)=split_part(p_pack_id,':',3))
          or (split_part(p_pack_id,':',1)='category-rarity'
              and c.category_id=split_part(p_pack_id,':',2)
              and lower(c.rarity)=split_part(p_pack_id,':',3))
        )
    ) tier
    order by -ln(greatest(random(),0.000000001)) /
      public.xanth_rarity_weight(tier.rarity)::double precision
    limit 1;

    if selected_rarity is null then exit; end if;

    select c.card_id,c.card_number,c.name,c.rarity,c.category_id,c.chapter_number,
           c.set_id,c.artwork_url,c.spoiler_safe_description,cat.label as category_label
    into selected
    from public.card_catalogue c
    left join public.card_categories cat on cat.category_id=c.category_id
    where c.is_active=true
      and c.rarity=selected_rarity
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
      and not exists(
        select 1 from jsonb_array_elements_text(card_ids) existing(card_id)
        where existing.card_id=c.card_id
      )
      and (
        split_part(p_pack_id,':',1)='vault'
        or (split_part(p_pack_id,':',1)='chapter'
            and c.chapter_number::text=ltrim(split_part(p_pack_id,':',2),'0'))
        or (split_part(p_pack_id,':',1)='category'
            and c.category_id=split_part(p_pack_id,':',2))
        or (split_part(p_pack_id,':',1)='rarity'
            and lower(c.rarity)=split_part(p_pack_id,':',2))
        or (split_part(p_pack_id,':',1)='chapter-rarity'
            and c.chapter_number::text=ltrim(split_part(p_pack_id,':',2),'0')
            and lower(c.rarity)=split_part(p_pack_id,':',3))
        or (split_part(p_pack_id,':',1)='category-rarity'
            and c.category_id=split_part(p_pack_id,':',2)
            and lower(c.rarity)=split_part(p_pack_id,':',3))
      )
    order by random()
    limit 1;

    if selected.card_id is null then exit; end if;

    new_claim_id:=gen_random_uuid();
    insert into public.card_reward_claims
      (claim_id,user_id,activity_type,chapter_id,pool_id,card_id)
    values
      (new_claim_id,reader_id,'mystery_pack',
       'xanth-pack-'||pack_purchase_id::text||'-'||(selected_count+1)::text,
       'xanth-mystery-packs',selected.card_id);

    insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
    values(reader_id,selected.card_id,new_claim_id)
    returning copy_id into new_copy_id;

    selected_count:=selected_count+1;
    card_ids:=card_ids||jsonb_build_array(selected.card_id);
    cards_json:=cards_json||jsonb_build_array(jsonb_build_object(
      'copy_id',new_copy_id,'card_id',selected.card_id,
      'card_number',selected.card_number,'name',selected.name,
      'rarity',selected.rarity,'category_label',selected.category_label,
      'chapter_number',selected.chapter_number
    ));
  end loop;

  if selected_count<>pack_row.card_count then
    raise exception 'The pack contents changed. No Xanth has been charged; please try again.';
  end if;

  update public.reader_xanth_accounts
  set balance_cents=balance_after,updated_at=now()
  where user_id=reader_id;

  insert into public.reader_xanth_transactions
    (user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values
    (reader_id,-pack_row.price_cents,balance_after,'mystery_pack',
     'Mystery Vault: '||pack_row.title,pack_purchase_id::text,
     jsonb_build_object('pack_id',p_pack_id,'card_ids',card_ids,
                        'card_count',selected_count));

  return jsonb_build_object(
    'success',true,'pack_purchase_id',pack_purchase_id,
    'pack_id',p_pack_id,'pack_title',pack_row.title,
    'card_count',selected_count,'price_cents',pack_row.price_cents,
    'balance_cents',balance_after,'cards',cards_json
  );
end;
$$;

-- Restore the existing scoped RPC grants and keep internal selectors private.
revoke all on function public.xanth_rarity_weight(text) from public,anon,authenticated;
revoke all on function public.xanth_rarity_price(text) from public,anon,authenticated;
revoke all on function public.xanth_default_card_price(text) from public,anon,authenticated;
revoke all on function public.award_reader_card(uuid,text,text) from public,anon,authenticated;
revoke all on function public.ensure_xanth_daily_shop(date) from public,anon,authenticated;
revoke all on function public.get_xanth_mystery_packs() from public,anon;
revoke all on function public.purchase_xanth_mystery_pack(text) from public,anon;

grant execute on function public.get_xanth_mystery_packs() to authenticated;
grant execute on function public.purchase_xanth_mystery_pack(text) to authenticated;

-- Verification 1: the configured rarity order, odds and card values.
select r.rarity,w.weight,
       round(
         w.weight /
         (select sum(public.xanth_rarity_weight(rr.rarity))
          from unnest(array['common','uncommon','rare','epic','legendary']::text[]) as rr(rarity))
         * 100,2
       ) as standard_draw_percent,
       public.xanth_rarity_price(r.rarity)/100.0 as base_value_xanth
from unnest(array['common','uncommon','rare','epic','legendary']::text[]) as r(rarity)
cross join lateral (
  select public.xanth_rarity_weight(r.rarity) as weight
) w
order by array_position(array['common','uncommon','rare','epic','legendary']::text[],r.rarity);

-- Verification 2: currently released card counts by rarity.
select c.rarity,count(*) as released_cards
from public.card_catalogue c
where c.is_active=true
  and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
group by c.rarity
order by array_position(array['common','uncommon','rare','epic','legendary'],c.rarity);

-- Verification 3: live Mystery Vault prices and pack sizes.
select pack_id,title,card_count,price_cents/100.0 as price_xanth,eligible_count
from public.get_xanth_mystery_packs()
order by theme_type,title;
