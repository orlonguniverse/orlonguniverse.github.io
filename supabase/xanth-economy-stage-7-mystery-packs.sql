-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7C: THE MYSTERY VAULT
-- Run after Stage 7A (Xanth foundation) and Stage 7B (purchases).
-- All pack contents are selected and granted server-side.
-- ============================================================

alter table public.card_reward_pools
  drop constraint if exists card_reward_pools_activity_type_check;
alter table public.card_reward_pools
  add constraint card_reward_pools_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock','shop_purchase','mystery_pack'
  ));

alter table public.card_reward_claims
  drop constraint if exists card_reward_claims_activity_type_check;
alter table public.card_reward_claims
  add constraint card_reward_claims_activity_type_check
  check (activity_type in (
    'chapter_completion','chapter_reaction','chapter_challenge',
    'approved_comment','achievement_unlock','shop_purchase','mystery_pack'
  ));

insert into public.card_reward_pools(pool_id,activity_type,chapter_id,title,is_active)
values('xanth-mystery-packs','mystery_pack','xanth-vault','Xantheon Mystery Vault',true)
on conflict(pool_id) do update set
  activity_type=excluded.activity_type,
  chapter_id=excluded.chapter_id,
  title=excluded.title,
  is_active=true;

-- Every pack is generated from the live, released catalogue. New cards
-- automatically enter matching chapter/category/rarity packs.
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
      'A first glimpse into the Orlong archive. Three cards selected from across the released collection.'::text description,
      3::integer amount,7500::bigint price,'#63b7ff'::text colour
    union all
    select 'vault:grand','The Orlong Reliquary','vault','GRAND VAULT',
      'Five discoveries drawn from the entire released archive. A larger opening, with more chances to find something extraordinary.',
      5,15000,'#d9b76d'
    union all
    select 'chapter:'||lpad(e.chapter_number::text,2,'0'),
      'Chapter '||e.chapter_number||' Pack','chapter','CHAPTER '||e.chapter_number,
      'Two cards drawn only from cards assigned to Chapter '||e.chapter_number||'.',
      2,3000,'#5ca7ff'
    from (select distinct chapter_number from eligible where chapter_number between 1 and 999) e
    union all
    select 'category:'||e.category_id,
      e.category_label||' Pack','category',upper(e.category_label),
      'Two cards selected from the released '||e.category_label||' collection.',2,3500,'#bd91ed'
    from (select distinct category_id,category_label from eligible where category_id is not null) e
    union all
    select 'rarity:'||r.rarity,
      initcap(r.rarity)||' Cache','rarity',upper(r.rarity)||' RARITY',
      'Two cards guaranteed to come from the '||r.rarity||' rarity tier.',
      2,r.price,'#e2bd79'
    from (values
      ('common'::text,2500::bigint),('uncommon',3500),('rare',5000),
      ('epic',8000),('legendary',12000)
    ) r(rarity,price)
  )
  select p.id,p.name,p.kind,p.label,p.description,p.amount,p.price,
    (select count(*) from eligible e where
      (p.kind='vault')
      or (p.kind='chapter' and e.chapter_number::text=ltrim(split_part(p.id,':',2),'0'))
      or (p.kind='category' and e.category_id=split_part(p.id,':',2))
      or (p.kind='rarity' and lower(e.rarity)=split_part(p.id,':',2))
    ) as available,p.colour
  from packs p
  where (select count(*) from eligible e where
      (p.kind='vault')
      or (p.kind='chapter' and e.chapter_number::text=ltrim(split_part(p.id,':',2),'0'))
      or (p.kind='category' and e.category_id=split_part(p.id,':',2))
      or (p.kind='rarity' and lower(e.rarity)=split_part(p.id,':',2))
    ) >= p.amount
  order by case p.kind when 'vault' then 0 when 'chapter' then 1 when 'category' then 2 else 3 end,
           p.name;
$$;

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

  if wallet_balance < pack_row.price_cents then
    raise exception 'Not enough Xanth. Your balance is % cents and this pack costs % cents',
      wallet_balance,pack_row.price_cents;
  end if;

  balance_after := wallet_balance-pack_row.price_cents;

  for selected in
    select c.card_id,c.card_number,c.name,c.rarity,c.category_id,c.chapter_number,
           c.set_id,c.artwork_url,c.spoiler_safe_description,cat.label as category_label
    from public.card_catalogue c
    left join public.card_categories cat on cat.category_id=c.category_id
    where c.is_active=true
      and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
      and (
        split_part(p_pack_id,':',1)='vault'
        or (split_part(p_pack_id,':',1)='chapter'
            and c.chapter_number::text=ltrim(split_part(p_pack_id,':',2),'0'))
        or (split_part(p_pack_id,':',1)='category'
            and c.category_id=split_part(p_pack_id,':',2))
        or (split_part(p_pack_id,':',1)='rarity'
            and lower(c.rarity)=split_part(p_pack_id,':',2))
      )
    order by random()
    limit pack_row.card_count
  loop
    new_claim_id := gen_random_uuid();
    insert into public.card_reward_claims
      (claim_id,user_id,activity_type,chapter_id,pool_id,card_id)
    values
      (new_claim_id,reader_id,'mystery_pack',
       'xanth-pack-'||pack_purchase_id::text||'-'||(selected_count+1)::text,
       'xanth-mystery-packs',selected.card_id);

    insert into public.reader_card_copies(owner_user_id,card_id,source_claim_id)
    values(reader_id,selected.card_id,new_claim_id)
    returning copy_id into new_copy_id;

    selected_count := selected_count+1;
    card_ids := card_ids || jsonb_build_array(selected.card_id);
    cards_json := cards_json || jsonb_build_array(jsonb_build_object(
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

-- Make the reveal provenance clear in the existing cinematic queue.
create or replace function public.queue_reader_card_reveal()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  activity text;
  chapter_key text;
  achievement_title text;
  label text;
  detail text;
begin
  select rc.activity_type,rc.chapter_id
    into activity,chapter_key
  from public.card_reward_claims rc
  where rc.claim_id=new.source_claim_id;

  if activity='achievement_unlock' then
    select ac.title into achievement_title
    from public.card_achievement_catalogue ac
    where ac.achievement_id=chapter_key;
    label := 'Achievement unlocked';
    detail := coalesce(achievement_title,'A reader achievement');
  elsif activity='mystery_pack' then
    label := 'Mystery pack opened';
    detail := 'A new discovery from the Xantheon Mystery Vault';
  elsif activity='shop_purchase' then
    label := 'Daily Exchange purchase';
    detail := 'A featured card purchased with Xantheon Xanth';
  else
    label := case activity
      when 'chapter_completion' then 'Chapter completed'
      when 'chapter_reaction' then 'Chapter reaction'
      when 'chapter_challenge' then 'Chapter challenge'
      when 'approved_comment' then 'Discussion comment approved'
      else 'Collectible reward'
    end;
    detail := case
      when chapter_key ~ '^chapter-0*[0-9]+$'
        then 'Chapter '||substring(chapter_key from '[0-9]+')
      else 'Reading Room activity'
    end;
  end if;

  insert into public.reader_card_reveal_queue
    (owner_user_id,copy_id,source_label,source_detail)
  values(new.owner_user_id,new.copy_id,label,detail)
  on conflict(copy_id) do nothing;
  return new;
end;
$$;

revoke all on function public.get_xanth_mystery_packs() from public,anon;
revoke all on function public.purchase_xanth_mystery_pack(text) from public,anon;
grant execute on function public.get_xanth_mystery_packs() to authenticated;
grant execute on function public.purchase_xanth_mystery_pack(text) to authenticated;

-- Verification
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('get_xanth_mystery_packs','purchase_xanth_mystery_pack')) as mystery_pack_functions,
  (select count(*) from public.get_xanth_mystery_packs()) as currently_available_pack_types,
  (select relrowsecurity from pg_class where oid='public.reader_xanth_accounts'::regclass) as wallet_rls_enabled;
