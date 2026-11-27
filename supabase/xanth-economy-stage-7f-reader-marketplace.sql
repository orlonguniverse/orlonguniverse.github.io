-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7F: READER MARKETPLACE
-- Run after Stages 7A–7E.1 and the Stage 6 Trading Post migration.
-- Supports fixed-price listings, Xanth/card offers, multi-card
-- exchanges, counter-offers, atomic settlement and trade history.
-- ============================================================

create table if not exists public.reader_card_market_listings (
  listing_id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  copy_id uuid not null unique references public.reader_card_copies(copy_id) on delete restrict,
  card_id text not null references public.card_catalogue(card_id),
  price_cents bigint not null check(price_cents > 0),
  status text not null default 'active' check(status in ('active','sold','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_to uuid references auth.users(id),
  sold_at timestamptz
);
create index if not exists reader_market_active_idx on public.reader_card_market_listings(status,created_at desc);

create table if not exists public.reader_card_market_offers (
  offer_id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.reader_card_market_listings(listing_id),
  proposer_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  proposer_pays_cents bigint not null default 0 check(proposer_pays_cents >= 0),
  recipient_pays_cents bigint not null default 0 check(recipient_pays_cents >= 0),
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','superseded')),
  current_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint market_offer_not_self check(proposer_user_id <> recipient_user_id)
);
create index if not exists reader_market_offers_incoming on public.reader_card_market_offers(recipient_user_id,status,updated_at desc);
create index if not exists reader_market_offers_outgoing on public.reader_card_market_offers(proposer_user_id,status,updated_at desc);

create table if not exists public.reader_card_market_offer_items (
  item_id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.reader_card_market_offers(offer_id) on delete cascade,
  owner_side text not null check(owner_side in ('proposer','recipient')),
  copy_id uuid not null references public.reader_card_copies(copy_id) on delete restrict,
  card_id text not null references public.card_catalogue(card_id),
  unique(offer_id,copy_id)
);
create index if not exists reader_market_offer_items_copy on public.reader_card_market_offer_items(copy_id);

create table if not exists public.reader_card_market_offer_history (
  history_id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.reader_card_market_offers(offer_id) on delete cascade,
  revision integer not null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  proposer_pays_cents bigint not null,
  recipient_pays_cents bigint not null,
  proposer_cards jsonb not null default '[]'::jsonb,
  recipient_cards jsonb not null default '[]'::jsonb,
  message text,
  created_at timestamptz not null default now(),
  unique(offer_id,revision)
);
alter table public.reader_card_market_listings enable row level security;
alter table public.reader_card_market_offers enable row level security;
alter table public.reader_card_market_offer_items enable row level security;
alter table public.reader_card_market_offer_history enable row level security;
revoke all on public.reader_card_market_listings,public.reader_card_market_offers,public.reader_card_market_offer_items,public.reader_card_market_offer_history from public,anon,authenticated;

-- Every card offered in a live negotiation is reserved. Cards already
-- committed to legacy Stage 6 trades or active sale listings are excluded.
create or replace function public.get_my_market_tradeable_copies()
returns table(copy_id uuid,card_id text,card_number text,card_name text,rarity text,artwork_url text,copy_count bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.copy_id,c.card_id,cat.card_number,cat.name,cat.rarity,cat.artwork_url,
        count(*) over(partition by c.card_id)::bigint
 from public.reader_card_copies c
 join public.card_catalogue cat on cat.card_id=c.card_id and cat.is_active
 where c.owner_user_id=auth.uid()
 and not exists(select 1 from public.card_trade_offers t where t.offered_copy_id=c.copy_id and t.status='pending')
 and not exists(select 1 from public.reader_card_market_listings l where l.copy_id=c.copy_id and l.status='active')
 and not exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=c.copy_id and o.status='pending')
 order by cat.card_number,c.acquired_at;
$$;

create or replace function public.create_market_card_listing(p_copy_id uuid,p_price_cents bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); cid text; lid uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_price_cents is null or p_price_cents<1 or p_price_cents>100000000 then raise exception 'Enter a valid Xanth price'; end if;
 select c.card_id into cid from public.reader_card_copies c
 where c.copy_id=p_copy_id and c.owner_user_id=uid for update;
 if cid is null then raise exception 'You no longer own that physical card copy'; end if;
 if exists(select 1 from public.card_trade_offers t where t.offered_copy_id=p_copy_id and t.status='pending')
 or exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=p_copy_id and o.status='pending')
 then raise exception 'That card is reserved by a pending offer'; end if;
 insert into public.reader_card_market_listings(seller_user_id,copy_id,card_id,price_cents)
 values(uid,p_copy_id,cid,p_price_cents) returning listing_id into lid;
 return lid;
exception when unique_violation then raise exception 'That card is already listed for sale';
end $$;

create or replace function public.cancel_market_card_listing(p_listing_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); n integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 update public.reader_card_market_listings set status='cancelled',updated_at=now()
 where listing_id=p_listing_id and seller_user_id=uid and status='active';
 get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.get_reader_card_market()
returns table(listing_id uuid,seller_user_id uuid,seller_name text,seller_avatar text,copy_id uuid,card_id text,card_number text,card_name text,rarity text,artwork_url text,price_cents bigint,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select l.listing_id,l.seller_user_id,p.display_name,p.avatar_url,l.copy_id,l.card_id,
        c.card_number,c.name,c.rarity,c.artwork_url,l.price_cents,l.created_at
 from public.reader_card_market_listings l
 join public.reader_profiles p on p.user_id=l.seller_user_id
 join public.card_catalogue c on c.card_id=l.card_id and c.is_active
 join public.reader_card_settings s on s.user_id=l.seller_user_id and s.collection_is_public
 join public.reader_card_copies cp on cp.copy_id=l.copy_id and cp.owner_user_id=l.seller_user_id
 where l.status='active' and l.seller_user_id<>auth.uid()
 order by l.created_at desc;
$$;

create or replace function public.buy_market_card_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); l public.reader_card_market_listings%rowtype; seller_balance bigint; buyer_balance bigint; card_name text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into l from public.reader_card_market_listings where listing_id=p_listing_id and status='active' for update;
 if not found then raise exception 'This listing is no longer available'; end if;
 if l.seller_user_id=uid then raise exception 'You cannot buy your own listing'; end if;
 if not exists(select 1 from public.reader_card_settings s where s.user_id=l.seller_user_id and s.collection_is_public) then raise exception 'Seller collection is no longer public'; end if;
 insert into public.reader_xanth_accounts(user_id) values(uid),(l.seller_user_id) on conflict(user_id) do nothing;
 perform 1 from public.reader_xanth_accounts where user_id in (uid,l.seller_user_id) order by user_id for update;
 select balance_cents into buyer_balance from public.reader_xanth_accounts where user_id=uid;
 if buyer_balance<l.price_cents then raise exception 'Not enough Xanth'; end if;
 if not exists(select 1 from public.reader_card_copies where copy_id=l.copy_id and owner_user_id=l.seller_user_id for update) then raise exception 'Seller no longer owns this card'; end if;
 update public.reader_xanth_accounts set balance_cents=balance_cents-l.price_cents,updated_at=now() where user_id=uid returning balance_cents into buyer_balance;
 update public.reader_xanth_accounts set balance_cents=balance_cents+l.price_cents,updated_at=now() where user_id=l.seller_user_id returning balance_cents into seller_balance;
 update public.reader_card_copies set owner_user_id=uid where copy_id=l.copy_id;
 update public.reader_card_market_listings set status='sold',sold_to=uid,sold_at=now(),updated_at=now() where listing_id=p_listing_id;
 select name into card_name from public.card_catalogue where card_id=l.card_id;
 insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
 values(uid,-l.price_cents,buyer_balance,'market_purchase','Bought '||card_name||' from another reader',p_listing_id::text,jsonb_build_object('listing_id',p_listing_id,'card_id',l.card_id,'seller_id',l.seller_user_id)),
 (l.seller_user_id,l.price_cents,seller_balance,'market_sale','Sold '||card_name||' to another reader',p_listing_id::text,jsonb_build_object('listing_id',p_listing_id,'card_id',l.card_id,'buyer_id',uid));
 return jsonb_build_object('success',true,'card_id',l.card_id,'card_name',card_name,'price_cents',l.price_cents,'balance_cents',buyer_balance);
end $$;

create or replace function public.create_reader_market_offer(
 p_recipient_id uuid,p_listing_id uuid,p_proposer_copy_ids uuid[],p_recipient_copy_ids uuid[],
 p_proposer_pays_cents bigint default 0,p_recipient_pays_cents bigint default 0,p_message text default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); lid public.reader_card_market_listings%rowtype; oid uuid; c record; pc jsonb:='[]'::jsonb; rc jsonb:='[]'::jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_recipient_id is null or p_recipient_id=uid then raise exception 'Choose another reader'; end if;
 if coalesce(p_proposer_pays_cents,0)<0 or coalesce(p_recipient_pays_cents,0)<0 then raise exception 'Xanth amounts cannot be negative'; end if;
 if coalesce(array_length(p_proposer_copy_ids,1),0)+coalesce(array_length(p_recipient_copy_ids,1),0)=0 and coalesce(p_proposer_pays_cents,0)+coalesce(p_recipient_pays_cents,0)=0 then raise exception 'An offer must include cards or Xanth'; end if;
 if p_listing_id is not null then
  select * into lid from public.reader_card_market_listings where listing_id=p_listing_id and status='active' and seller_user_id=p_recipient_id for update;
  if not found then raise exception 'This listing is no longer available'; end if;
  if not (lid.copy_id=any(coalesce(p_recipient_copy_ids,'{}'::uuid[]))) then
   p_recipient_copy_ids:=array_append(coalesce(p_recipient_copy_ids,'{}'::uuid[]),lid.copy_id);
  end if;
 end if;
 if not exists(select 1 from public.reader_card_settings s where s.user_id=p_recipient_id and s.collection_is_public) then raise exception 'That reader does not have a public collection'; end if;
 insert into public.reader_card_market_offers(listing_id,proposer_user_id,recipient_user_id,proposer_pays_cents,recipient_pays_cents)
 values(p_listing_id,uid,p_recipient_id,coalesce(p_proposer_pays_cents,0),coalesce(p_recipient_pays_cents,0)) returning offer_id into oid;
 foreach c.copy_id in array coalesce(p_proposer_copy_ids,'{}'::uuid[]) loop
  if not exists(select 1 from public.reader_card_copies where copy_id=c.copy_id and owner_user_id=uid) then raise exception 'One of your offered cards is no longer yours'; end if;
  insert into public.reader_card_market_offer_items(offer_id,owner_side,copy_id,card_id) select oid,'proposer',x.copy_id,x.card_id from public.reader_card_copies x where x.copy_id=c.copy_id;
  select coalesce(jsonb_agg(jsonb_build_object('card_id',cat.card_id,'name',cat.name,'card_number',cat.card_number,'rarity',cat.rarity)), '[]'::jsonb) into pc from public.reader_card_market_offer_items i join public.card_catalogue cat on cat.card_id=i.card_id where i.offer_id=oid and i.owner_side='proposer';
 end loop;
 foreach c.copy_id in array coalesce(p_recipient_copy_ids,'{}'::uuid[]) loop
  if not exists(select 1 from public.reader_card_copies where copy_id=c.copy_id and owner_user_id=p_recipient_id) then raise exception 'One of the requested cards is no longer owned by that reader'; end if;
  insert into public.reader_card_market_offer_items(offer_id,owner_side,copy_id,card_id) select oid,'recipient',x.copy_id,x.card_id from public.reader_card_copies x where x.copy_id=c.copy_id;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('card_id',cat.card_id,'name',cat.name,'card_number',cat.card_number,'rarity',cat.rarity)), '[]'::jsonb) into rc from public.reader_card_market_offer_items i join public.card_catalogue cat on cat.card_id=i.card_id where i.offer_id=oid and i.owner_side='recipient';
 if p_listing_id is not null and not (lid.copy_id=any(coalesce(p_recipient_copy_ids,'{}'::uuid[]))) then raise exception 'Listing card missing from offer'; end if;
 insert into public.reader_card_market_offer_history(offer_id,revision,sender_user_id,proposer_pays_cents,recipient_pays_cents,proposer_cards,recipient_cards,message)
 values(oid,1,uid,coalesce(p_proposer_pays_cents,0),coalesce(p_recipient_pays_cents,0),pc,rc,left(p_message,500));
 return oid;
exception when unique_violation then raise exception 'One of those card copies is already reserved by a listing or another pending offer';
end $$;

create or replace function public.counter_reader_market_offer(
 p_offer_id uuid,p_proposer_copy_ids uuid[],p_recipient_copy_ids uuid[],
 p_proposer_pays_cents bigint,p_recipient_pays_cents bigint,p_message text default null
)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); o public.reader_card_market_offers%rowtype; rev integer; c uuid; pc jsonb; rc jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into o from public.reader_card_market_offers where offer_id=p_offer_id and status='pending' for update;
 if not found or uid not in(o.proposer_user_id,o.recipient_user_id) then raise exception 'Offer not found or no longer open'; end if;
 if p_proposer_pays_cents<0 or p_recipient_pays_cents<0 then raise exception 'Xanth amounts cannot be negative'; end if;
 if uid=o.proposer_user_id and o.current_revision%2=1 then raise exception 'Wait for the other reader to respond'; end if;
 if uid=o.recipient_user_id and o.current_revision%2=0 then raise exception 'Wait for the other reader to respond'; end if;
 delete from public.reader_card_market_offer_items where offer_id=p_offer_id;
 foreach c in array coalesce(p_proposer_copy_ids,'{}'::uuid[]) loop
  if not exists(select 1 from public.reader_card_copies where copy_id=c and owner_user_id=o.proposer_user_id) then raise exception 'A proposed card is no longer owned by its reader'; end if;
  insert into public.reader_card_market_offer_items(offer_id,owner_side,copy_id,card_id) select p_offer_id,'proposer',copy_id,card_id from public.reader_card_copies where copy_id=c;
 end loop;
 foreach c in array coalesce(p_recipient_copy_ids,'{}'::uuid[]) loop
  if not exists(select 1 from public.reader_card_copies where copy_id=c and owner_user_id=o.recipient_user_id) then raise exception 'A requested card is no longer owned by its reader'; end if;
  insert into public.reader_card_market_offer_items(offer_id,owner_side,copy_id,card_id) select p_offer_id,'recipient',copy_id,card_id from public.reader_card_copies where copy_id=c;
 end loop;
 if not exists(select 1 from public.reader_card_market_offer_items where offer_id=p_offer_id) and p_proposer_pays_cents+p_recipient_pays_cents=0 then raise exception 'A counter-offer must include cards or Xanth'; end if;
 rev:=o.current_revision+1;
 select coalesce(jsonb_agg(jsonb_build_object('card_id',cat.card_id,'name',cat.name,'card_number',cat.card_number,'rarity',cat.rarity)), '[]'::jsonb) into pc from public.reader_card_market_offer_items i join public.card_catalogue cat on cat.card_id=i.card_id where i.offer_id=p_offer_id and i.owner_side='proposer';
 select coalesce(jsonb_agg(jsonb_build_object('card_id',cat.card_id,'name',cat.name,'card_number',cat.card_number,'rarity',cat.rarity)), '[]'::jsonb) into rc from public.reader_card_market_offer_items i join public.card_catalogue cat on cat.card_id=i.card_id where i.offer_id=p_offer_id and i.owner_side='recipient';
 update public.reader_card_market_offers set proposer_pays_cents=p_proposer_pays_cents,recipient_pays_cents=p_recipient_pays_cents,current_revision=rev,updated_at=now() where offer_id=p_offer_id;
 insert into public.reader_card_market_offer_history(offer_id,revision,sender_user_id,proposer_pays_cents,recipient_pays_cents,proposer_cards,recipient_cards,message)
 values(p_offer_id,rev,uid,p_proposer_pays_cents,p_recipient_pays_cents,pc,rc,left(p_message,500));
 return rev;
exception when unique_violation then raise exception 'A card in this counter-offer is already reserved elsewhere';
end $$;

create or replace function public.respond_to_reader_market_offer(p_offer_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); o public.reader_card_market_offers%rowtype; it record; buyer_balance bigint; seller_balance bigint; net bigint; buyer uuid; seller uuid; l public.reader_card_market_listings%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into o from public.reader_card_market_offers where offer_id=p_offer_id and status='pending' for update;
 if not found or uid not in(o.proposer_user_id,o.recipient_user_id) then raise exception 'Offer not found or no longer open'; end if;
 if (o.current_revision%2=1 and uid<>o.recipient_user_id) or (o.current_revision%2=0 and uid<>o.proposer_user_id) then raise exception 'It is the other reader’s turn to respond'; end if;
 if not p_accept then update public.reader_card_market_offers set status='declined',updated_at=now() where offer_id=p_offer_id; return 'declined'; end if;
 for it in select i.*,c.owner_user_id from public.reader_card_market_offer_items i join public.reader_card_copies c on c.copy_id=i.copy_id where i.offer_id=p_offer_id for update of c loop
  if (it.owner_side='proposer' and it.owner_user_id<>o.proposer_user_id) or (it.owner_side='recipient' and it.owner_user_id<>o.recipient_user_id) then raise exception 'A card in this offer is no longer owned by its reader'; end if;
 end loop;
 if not exists(select 1 from public.reader_card_market_offer_items where offer_id=p_offer_id) and o.proposer_pays_cents+o.recipient_pays_cents=0 then raise exception 'This offer has no value to transfer'; end if;
 insert into public.reader_xanth_accounts(user_id) values(o.proposer_user_id),(o.recipient_user_id) on conflict(user_id) do nothing;
 perform 1 from public.reader_xanth_accounts where user_id in(o.proposer_user_id,o.recipient_user_id) order by user_id for update;
 net:=o.proposer_pays_cents-o.recipient_pays_cents;
 buyer:=case when net>=0 then o.proposer_user_id else o.recipient_user_id end;
 seller:=case when net>=0 then o.recipient_user_id else o.proposer_user_id end;
 if abs(net)>0 then
  select balance_cents into buyer_balance from public.reader_xanth_accounts where user_id=buyer;
  if buyer_balance<abs(net) then raise exception 'The paying reader no longer has enough Xanth'; end if;
  update public.reader_xanth_accounts set balance_cents=balance_cents-abs(net),updated_at=now() where user_id=buyer returning balance_cents into buyer_balance;
  update public.reader_xanth_accounts set balance_cents=balance_cents+abs(net),updated_at=now() where user_id=seller returning balance_cents into seller_balance;
  insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values(buyer,-abs(net),buyer_balance,'market_trade','Xanth paid in reader-to-reader offer',p_offer_id::text,jsonb_build_object('offer_id',p_offer_id,'other_reader',seller)),
  (seller,abs(net),seller_balance,'market_trade','Xanth received in reader-to-reader offer',p_offer_id::text,jsonb_build_object('offer_id',p_offer_id,'other_reader',buyer));
 end if;
 update public.reader_card_copies c set owner_user_id=case when i.owner_side='proposer' then o.recipient_user_id else o.proposer_user_id end
 from public.reader_card_market_offer_items i where i.offer_id=p_offer_id and i.copy_id=c.copy_id;
 update public.reader_card_market_offers set status='accepted',completed_at=now(),updated_at=now() where offer_id=p_offer_id;
 if o.listing_id is not null then update public.reader_card_market_listings set status='sold',sold_to=case when exists(select 1 from public.reader_card_market_offer_items where offer_id=p_offer_id and copy_id=(select copy_id from public.reader_card_market_listings where listing_id=o.listing_id)) then o.proposer_user_id else o.recipient_user_id end,sold_at=now(),updated_at=now() where listing_id=o.listing_id and status='active'; end if;
 -- Re-touch newly received copies after offer closure so auto-sell can
 -- apply the recipient's preference without touching reserved copies.
 update public.reader_card_copies c set owner_user_id=c.owner_user_id
 from public.reader_card_market_offer_items i
 where i.offer_id=p_offer_id and i.copy_id=c.copy_id;
 return 'accepted';
end $$;

create or replace function public.cancel_reader_market_offer(p_offer_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); n integer;
begin
 update public.reader_card_market_offers set status='cancelled',updated_at=now()
 where offer_id=p_offer_id and proposer_user_id=uid and status='pending';
 get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.get_my_reader_market_offers()
returns table(offer_id uuid,listing_id uuid,trade_role text,other_reader_id uuid,other_reader_name text,status text,current_revision integer,proposer_pays_cents bigint,recipient_pays_cents bigint,items jsonb,history jsonb,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select o.offer_id,o.listing_id,case when o.proposer_user_id=auth.uid() then 'proposer' else 'recipient' end,
        case when o.proposer_user_id=auth.uid() then o.recipient_user_id else o.proposer_user_id end,
        p.display_name,o.status,o.current_revision,o.proposer_pays_cents,o.recipient_pays_cents,
        coalesce((select jsonb_agg(jsonb_build_object('owner_side',i.owner_side,'card_id',i.card_id,'card_number',c.card_number,'card_name',c.name,'rarity',c.rarity,'artwork_url',c.artwork_url)) from public.reader_card_market_offer_items i join public.card_catalogue c on c.card_id=i.card_id where i.offer_id=o.offer_id),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('revision',h.revision,'sender_user_id',h.sender_user_id,'proposer_pays_cents',h.proposer_pays_cents,'recipient_pays_cents',h.recipient_pays_cents,'proposer_cards',h.proposer_cards,'recipient_cards',h.recipient_cards,'message',h.message,'created_at',h.created_at) order by h.revision) from public.reader_card_market_offer_history h where h.offer_id=o.offer_id),'[]'::jsonb),
        o.created_at
 from public.reader_card_market_offers o
 join public.reader_profiles p on p.user_id=case when o.proposer_user_id=auth.uid() then o.recipient_user_id else o.proposer_user_id end
 where auth.uid() in(o.proposer_user_id,o.recipient_user_id)
 order by o.updated_at desc;
$$;

-- Replace duplicate-sale logic so market listings and every live offer
-- protect the exact physical copies from manual/automatic selling.
create or replace function public.sell_my_duplicate_cards(p_card_id text,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); cr public.card_catalogue%rowtype; owned integer; sold integer; unit bigint; total bigint; bal bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100 then raise exception 'Choose a sale quantity from 1 to 100'; end if;
 select * into cr from public.card_catalogue where card_id=p_card_id and is_active;
 if not found then raise exception 'Card unavailable'; end if;
 insert into public.reader_xanth_accounts(user_id) values(uid) on conflict(user_id) do nothing;
 perform 1 from public.reader_xanth_accounts where user_id=uid for update;
 select count(*) into owned from public.reader_card_copies where owner_user_id=uid and card_id=p_card_id;
 if owned<=1 then raise exception 'You must keep at least one copy'; end if;
 unit:=greatest(1,floor(public.xanth_rarity_price(cr.rarity)::numeric*0.5)::bigint);
 with candidates as (
  select c.copy_id from public.reader_card_copies c where c.owner_user_id=uid and c.card_id=p_card_id
  and not exists(select 1 from public.card_trade_offers t where t.offered_copy_id=c.copy_id and t.status='pending')
  and not exists(select 1 from public.reader_card_market_listings l where l.copy_id=c.copy_id and l.status='active')
  and not exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=c.copy_id and o.status='pending')
  order by c.acquired_at desc,c.copy_id desc limit least(p_quantity,owned-1) for update skip locked
 ), gone as (delete from public.reader_card_copies c using candidates x where c.copy_id=x.copy_id returning c.copy_id)
 select count(*)::integer into sold from gone;
 if sold=0 then raise exception 'No unreserved duplicate copies are available to sell'; end if;
 total:=unit*sold;
 update public.reader_xanth_accounts set balance_cents=balance_cents+total,updated_at=now() where user_id=uid returning balance_cents into bal;
 insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
 values(uid,total,bal,'duplicate_sale','Sold '||sold||' duplicate '||cr.name||' card(s)',gen_random_uuid()::text,jsonb_build_object('card_id',p_card_id,'copies_sold',sold,'unit_value_cents',unit,'automatic',false));
 return jsonb_build_object('success',true,'copies_sold',sold,'total_value_cents',total,'balance_cents',bal);
end $$;

create or replace function public.auto_sell_excess_card_copies()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.reader_card_sale_settings%rowtype; cr public.card_catalogue%rowtype; cnt integer; excess integer; sold integer:=0; unit bigint; total bigint; bal bigint; x record;
begin
 select * into s from public.reader_card_sale_settings where user_id=new.owner_user_id;
 if not found or not s.auto_sell_duplicates then return new; end if;
 select * into cr from public.card_catalogue where card_id=new.card_id and is_active;
 if not found then return new; end if;
 select count(*) into cnt from public.reader_card_copies where owner_user_id=new.owner_user_id and card_id=new.card_id;
 excess:=cnt-s.keep_copies; if excess<=0 then return new; end if;
 insert into public.reader_xanth_accounts(user_id) values(new.owner_user_id) on conflict(user_id) do nothing;
 perform 1 from public.reader_xanth_accounts where user_id=new.owner_user_id for update;
 unit:=greatest(1,floor(public.xanth_rarity_price(cr.rarity)::numeric*0.5)::bigint);
 for x in select c.copy_id from public.reader_card_copies c
 where c.owner_user_id=new.owner_user_id and c.card_id=new.card_id and c.copy_id<>new.copy_id
 and not exists(select 1 from public.card_trade_offers t where t.offered_copy_id=c.copy_id and t.status='pending')
 and not exists(select 1 from public.reader_card_market_listings l where l.copy_id=c.copy_id and l.status='active')
 and not exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=c.copy_id and o.status='pending')
 order by c.acquired_at asc,c.copy_id asc limit excess for update skip locked loop
  delete from public.reader_card_copies where copy_id=x.copy_id; if found then sold:=sold+1; end if;
 end loop;
 if sold=0 then return new; end if;
 total:=unit*sold;
 update public.reader_xanth_accounts set balance_cents=balance_cents+total,updated_at=now() where user_id=new.owner_user_id returning balance_cents into bal;
 insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
 values(new.owner_user_id,total,bal,'duplicate_sale_auto','Automatically sold '||sold||' excess '||cr.name||' card(s)',gen_random_uuid()::text,jsonb_build_object('card_id',new.card_id,'copies_sold',sold,'unit_value_cents',unit,'automatic',true,'keep_copies',s.keep_copies));
 return new;
end $$;

-- Keep security-definer entry points private; all actions require sign-in.
revoke all on function public.get_my_market_tradeable_copies() from public,anon;
revoke all on function public.create_market_card_listing(uuid,bigint) from public,anon;
revoke all on function public.cancel_market_card_listing(uuid) from public,anon;
revoke all on function public.get_reader_card_market() from public,anon;
revoke all on function public.buy_market_card_listing(uuid) from public,anon;
revoke all on function public.create_reader_market_offer(uuid,uuid,uuid[],uuid[],bigint,bigint,text) from public,anon;
revoke all on function public.counter_reader_market_offer(uuid,uuid[],uuid[],bigint,bigint,text) from public,anon;
revoke all on function public.respond_to_reader_market_offer(uuid,boolean) from public,anon;
revoke all on function public.cancel_reader_market_offer(uuid) from public,anon;
revoke all on function public.get_my_reader_market_offers() from public,anon;
revoke all on function public.sell_my_duplicate_cards(text,integer) from public,anon;
revoke all on function public.auto_sell_excess_card_copies() from public,anon,authenticated;
grant execute on function public.get_my_market_tradeable_copies(),public.get_reader_card_market(),public.get_my_reader_market_offers() to authenticated;
grant execute on function public.create_market_card_listing(uuid,bigint),public.cancel_market_card_listing(uuid),public.buy_market_card_listing(uuid) to authenticated;
grant execute on function public.create_reader_market_offer(uuid,uuid,uuid[],uuid[],bigint,bigint,text) to authenticated;
grant execute on function public.counter_reader_market_offer(uuid,uuid[],uuid[],bigint,bigint,text),public.respond_to_reader_market_offer(uuid,boolean),public.cancel_reader_market_offer(uuid) to authenticated;
grant execute on function public.sell_my_duplicate_cards(text,integer) to authenticated;

select table_name from information_schema.tables where table_schema='public' and table_name in
('reader_card_market_listings','reader_card_market_offers','reader_card_market_offer_items','reader_card_market_offer_history') order by table_name;
select routine_name from information_schema.routines where routine_schema='public' and routine_name in
('get_my_market_tradeable_copies','create_market_card_listing','cancel_market_card_listing','get_reader_card_market','buy_market_card_listing','create_reader_market_offer','counter_reader_market_offer','respond_to_reader_market_offer','cancel_reader_market_offer','get_my_reader_market_offers') order by routine_name;
