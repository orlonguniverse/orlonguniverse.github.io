-- ============================================================
-- ORLONG COLLECTOR ECONOMY — STAGE 7F.1
-- NOTIFICATION CENTRE + WANTED BOARD
-- Run AFTER xanth-economy-stage-7f-reader-marketplace.sql.
--
-- Adds private reader notifications and reverse card requests.
-- Wanted Board posts reserve the exact cards and Xanth offered.
-- Fulfilment transfers every item atomically.
-- ============================================================

-- ------------------------------------------------------------
-- PRIVATE NOTIFICATION CENTRE
-- ------------------------------------------------------------
create table if not exists public.reader_notifications (
 notification_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 notification_key text not null,
 notification_type text not null check(notification_type in ('trade','achievement','event','card','community')),
 title text not null,
 body text not null default '',
 target_url text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,notification_key)
);
create index if not exists reader_notifications_inbox_idx
 on public.reader_notifications(user_id,created_at desc);
alter table public.reader_notifications enable row level security;
revoke all on public.reader_notifications from public,anon,authenticated;

create or replace function public.push_reader_notification(
 p_user_id uuid,p_key text,p_type text,p_title text,p_body text default '',
 p_target_url text default null,p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_user_id is null or nullif(trim(p_key),'') is null then return; end if;
 insert into public.reader_notifications(user_id,notification_key,notification_type,title,body,target_url,metadata)
 values(p_user_id,p_key,p_type,p_title,coalesce(p_body,''),p_target_url,coalesce(p_metadata,'{}'::jsonb))
 on conflict(user_id,notification_key) do nothing;
end $$;

create or replace function public.get_my_notifications(p_limit integer default 30)
returns table(notification_id uuid,notification_type text,title text,body text,target_url text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select n.notification_id,n.notification_type,n.title,n.body,n.target_url,n.created_at,n.read_at
 from public.reader_notifications n
 where n.user_id=auth.uid()
 order by n.created_at desc,n.notification_id desc
 limit greatest(1,least(coalesce(p_limit,30),100));
$$;

create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.reader_notifications set read_at=coalesce(read_at,now())
 where notification_id=p_notification_id and user_id=auth.uid();
 get diagnostics n=row_count; return n=1;
end $$;

create or replace function public.mark_all_my_notifications_read()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.reader_notifications set read_at=now()
 where user_id=auth.uid() and read_at is null;
 get diagnostics n=row_count; return n;
end $$;

-- New offers, counter-offers and completed/declined/cancelled negotiations.
create or replace function public.notify_reader_market_offer_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare sender uuid; recipient uuid; actor_name text;
begin
 if tg_op='INSERT' then
  perform public.push_reader_notification(new.recipient_user_id,
   'market-offer:'||new.offer_id::text||':revision:'||new.current_revision::text,
   'trade','New card offer','A reader has sent you a card and/or Xanth offer.',
   '/explore-eden/?tab=trading',jsonb_build_object('offer_id',new.offer_id));
  return new;
 end if;

 if new.current_revision>old.current_revision then
  sender:=auth.uid();
  if sender is null then sender:=new.proposer_user_id; end if;
  recipient:=case when sender=new.proposer_user_id then new.recipient_user_id else new.proposer_user_id end;
  perform public.push_reader_notification(recipient,
   'market-offer:'||new.offer_id::text||':revision:'||new.current_revision::text,
   'trade','A trade offer was updated','A reader has sent a counter-offer. Review the new terms.',
   '/explore-eden/?tab=trading',jsonb_build_object('offer_id',new.offer_id,'revision',new.current_revision));
 end if;

 if old.status='pending' and new.status<>'pending' then
  perform public.push_reader_notification(new.proposer_user_id,
   'market-offer:'||new.offer_id::text||':status:'||new.status,
   'trade',case new.status when 'accepted' then 'Trade completed' when 'declined' then 'Offer declined' else 'Offer cancelled' end,
   case new.status when 'accepted' then 'Your card exchange has been completed.' when 'declined' then 'The other reader declined your offer.' else 'The pending offer has been closed.' end,
   '/explore-eden/?tab=trading',jsonb_build_object('offer_id',new.offer_id,'status',new.status));
  perform public.push_reader_notification(new.recipient_user_id,
   'market-offer:'||new.offer_id::text||':status:'||new.status,
   'trade',case new.status when 'accepted' then 'Trade completed' when 'declined' then 'Offer declined' else 'Offer cancelled' end,
   case new.status when 'accepted' then 'Your card exchange has been completed.' when 'declined' then 'The other reader declined the offer.' else 'The pending offer has been closed.' end,
   '/explore-eden/?tab=trading',jsonb_build_object('offer_id',new.offer_id,'status',new.status));
 end if;
 return new;
end $$;

drop trigger if exists reader_market_offer_notifications on public.reader_card_market_offers;
create trigger reader_market_offer_notifications
after insert or update of status,current_revision on public.reader_card_market_offers
for each row execute function public.notify_reader_market_offer_change();

-- Achievement unlocks are notified once, at the moment they are first recorded.
create or replace function public.notify_reader_achievement_unlock()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.card_achievement_catalogue%rowtype;
begin
 select * into a from public.card_achievement_catalogue where achievement_id=new.achievement_id;
 if found then
  perform public.push_reader_notification(new.user_id,'achievement:'||new.achievement_id,
   'achievement','Achievement unlocked: '||a.title,a.description,
   '/books/trials-of-eden/account.html#dashboard',jsonb_build_object('achievement_id',new.achievement_id));
 end if;
 return new;
end $$;
drop trigger if exists reader_achievement_notifications on public.reader_achievement_unlocks;
create trigger reader_achievement_notifications
after insert on public.reader_achievement_unlocks
for each row execute function public.notify_reader_achievement_unlock();

-- Card rewards and card transfers also appear in the inbox.
create or replace function public.notify_reader_card_copy_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare card_name text;
begin
 select c.name into card_name from public.card_catalogue c where c.card_id=new.card_id;
 if tg_op='INSERT' then
  perform public.push_reader_notification(new.owner_user_id,'card-earned:'||new.copy_id::text,
   'card','A new card has joined your collection',coalesce(card_name,'A collectible card')||' is ready to discover.',
   '/explore-eden/',jsonb_build_object('card_id',new.card_id,'copy_id',new.copy_id));
 elsif old.owner_user_id is distinct from new.owner_user_id then
  perform public.push_reader_notification(new.owner_user_id,'card-received:'||new.copy_id::text,
   'card','You received a card',coalesce(card_name,'A collectible card')||' has been added to your binder.',
   '/explore-eden/',jsonb_build_object('card_id',new.card_id,'copy_id',new.copy_id));
  perform public.push_reader_notification(old.owner_user_id,'card-transferred:'||new.copy_id::text,
   'card','A card left your collection',coalesce(card_name,'A collectible card')||' was transferred to another reader.',
   '/explore-eden/',jsonb_build_object('card_id',new.card_id,'copy_id',new.copy_id));
 end if;
 return new;
end $$;
drop trigger if exists reader_card_copy_notifications on public.reader_card_copies;
create trigger reader_card_copy_notifications
after insert or update of owner_user_id on public.reader_card_copies
for each row execute function public.notify_reader_card_copy_change();

-- The event list is authored in events-config.js. Syncing it creates one
-- persistent notification per reader/event, including upcoming events.
create or replace function public.sync_my_event_notifications(p_events jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb; before_count integer; after_count integer; event_id text; event_title text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(coalesce(p_events,'[]'::jsonb))<>'array' then raise exception 'Events must be supplied as a list'; end if;
 select count(*) into before_count from public.reader_notifications
 where user_id=auth.uid() and notification_type='event';
 for e in select value from jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) loop
  event_id:=nullif(trim(e->>'id'),'');
  event_title:=nullif(trim(e->>'title'),'');
  if event_id is null or event_title is null or coalesce((e->>'published')::boolean,false)=false then continue; end if;
  if nullif(e->>'endDate','') is not null and (e->>'endDate')::date<current_date then continue; end if;
  perform public.push_reader_notification(auth.uid(),'event:'||event_id,'event',
   'New event: '||event_title,
   left(coalesce(nullif(e->>'summary',''),nullif(e->>'eyebrow',''),'A new Orlong community event is available.'),500),
   '/events.html',jsonb_build_object('event_id',event_id));
 end loop;
 select count(*) into after_count from public.reader_notifications
 where user_id=auth.uid() and notification_type='event';
 return greatest(0,after_count-before_count);
end $$;

-- ------------------------------------------------------------
-- WANTED BOARD — REVERSE CARD OFFERS
-- ------------------------------------------------------------
create table if not exists public.reader_card_wanted_posts (
 post_id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 wanted_card_id text not null references public.card_catalogue(card_id),
 offered_xanth_cents bigint not null default 0 check(offered_xanth_cents>=0),
 escrow_cents bigint not null default 0 check(escrow_cents>=0),
 message text,
 status text not null default 'open' check(status in ('open','fulfilled','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 fulfilled_by uuid references auth.users(id),
 fulfilled_copy_id uuid references public.reader_card_copies(copy_id),
 fulfilled_at timestamptz
);
create index if not exists reader_card_wanted_open_idx
 on public.reader_card_wanted_posts(status,created_at desc);

create table if not exists public.reader_card_wanted_post_items (
 post_id uuid not null references public.reader_card_wanted_posts(post_id) on delete cascade,
 copy_id uuid not null unique references public.reader_card_copies(copy_id) on delete restrict,
 card_id text not null references public.card_catalogue(card_id),
 primary key(post_id,copy_id)
);
alter table public.reader_card_wanted_posts enable row level security;
alter table public.reader_card_wanted_post_items enable row level security;
revoke all on public.reader_card_wanted_posts,public.reader_card_wanted_post_items from public,anon,authenticated;

-- Reserved wanted-board cards cannot be sold, transferred, listed or used in
-- another negotiation. Returning NULL from a BEFORE trigger safely skips a
-- duplicate-sale deletion rather than aborting the card reward that caused it.
create or replace function public.guard_reader_wanted_copy_reservation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(
  select 1 from public.reader_card_wanted_post_items i
  join public.reader_card_wanted_posts p on p.post_id=i.post_id
  where i.copy_id=old.copy_id and p.status='open'
 ) then
  if tg_op='DELETE' then return null; end if;
  if tg_op='UPDATE' and old.owner_user_id is distinct from new.owner_user_id then return null; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists guard_wanted_reserved_card_copy on public.reader_card_copies;
create trigger guard_wanted_reserved_card_copy
before delete or update on public.reader_card_copies
for each row execute function public.guard_reader_wanted_copy_reservation();

create or replace function public.guard_wanted_copy_market_listing()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.reader_card_wanted_post_items i
  join public.reader_card_wanted_posts p on p.post_id=i.post_id
  where i.copy_id=new.copy_id and p.status='open') then
  raise exception 'That card copy is reserved in an active Wanted Board post';
 end if;
 return new;
end $$;
drop trigger if exists guard_wanted_copy_market_listing on public.reader_card_market_listings;
create trigger guard_wanted_copy_market_listing
before insert on public.reader_card_market_listings
for each row execute function public.guard_wanted_copy_market_listing();

create or replace function public.guard_wanted_copy_market_offer()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.reader_card_wanted_post_items i
  join public.reader_card_wanted_posts p on p.post_id=i.post_id
  where i.copy_id=new.copy_id and p.status='open') then
  raise exception 'That card copy is reserved in an active Wanted Board post';
 end if;
 return new;
end $$;
drop trigger if exists guard_wanted_copy_market_offer on public.reader_card_market_offer_items;
create trigger guard_wanted_copy_market_offer
before insert on public.reader_card_market_offer_items
for each row execute function public.guard_wanted_copy_market_offer();

-- Keep reserved copies out of the normal offer builders.
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
 and not exists(select 1 from public.reader_card_wanted_post_items wi join public.reader_card_wanted_posts wp on wp.post_id=wi.post_id where wi.copy_id=c.copy_id and wp.status='open')
 order by cat.card_number,c.acquired_at;
$$;

create or replace function public.get_public_market_tradeable_copies(p_reader_id uuid)
returns table(copy_id uuid,card_id text,card_number text,card_name text,rarity text,artwork_url text)
language sql stable security definer set search_path=public,pg_temp as $$
 select c.copy_id,c.card_id,cat.card_number,cat.name,cat.rarity,cat.artwork_url
 from public.reader_card_copies c join public.card_catalogue cat on cat.card_id=c.card_id and cat.is_active
 join public.reader_card_settings s on s.user_id=c.owner_user_id and s.collection_is_public
 where c.owner_user_id=p_reader_id and p_reader_id<>auth.uid()
 and not exists(select 1 from public.card_trade_offers t where t.offered_copy_id=c.copy_id and t.status='pending')
 and not exists(select 1 from public.reader_card_market_listings l where l.copy_id=c.copy_id and l.status='active')
 and not exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=c.copy_id and o.status='pending')
 and not exists(select 1 from public.reader_card_wanted_post_items wi join public.reader_card_wanted_posts wp on wp.post_id=wi.post_id where wi.copy_id=c.copy_id and wp.status='open')
 order by cat.card_number,c.acquired_at;
$$;

create or replace function public.get_reader_wanted_board()
returns table(post_id uuid,owner_user_id uuid,owner_name text,owner_avatar text,wanted_card_id text,wanted_card_number text,wanted_card_name text,wanted_rarity text,wanted_artwork_url text,offered_xanth_cents bigint,offered_cards jsonb,message text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.post_id,p.owner_user_id,r.display_name,r.avatar_url,p.wanted_card_id,c.card_number,c.name,c.rarity,c.artwork_url,
  p.offered_xanth_cents,
  coalesce((select jsonb_agg(jsonb_build_object('copy_id',i.copy_id,'card_id',i.card_id,'card_number',oc.card_number,'card_name',oc.name,'rarity',oc.rarity,'artwork_url',oc.artwork_url) order by oc.card_number)
   from public.reader_card_wanted_post_items i join public.card_catalogue oc on oc.card_id=i.card_id where i.post_id=p.post_id),'[]'::jsonb),
  p.message,p.created_at
 from public.reader_card_wanted_posts p
 join public.reader_profiles r on r.user_id=p.owner_user_id
 join public.card_catalogue c on c.card_id=p.wanted_card_id
 where p.status='open' and p.owner_user_id<>auth.uid()
 order by p.created_at desc;
$$;

create or replace function public.get_my_reader_wanted_posts()
returns table(post_id uuid,wanted_card_id text,wanted_card_number text,wanted_card_name text,wanted_rarity text,wanted_artwork_url text,offered_xanth_cents bigint,escrow_cents bigint,status text,message text,offered_cards jsonb,created_at timestamptz,fulfilled_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select p.post_id,p.wanted_card_id,c.card_number,c.name,c.rarity,c.artwork_url,p.offered_xanth_cents,p.escrow_cents,p.status,p.message,
  coalesce((select jsonb_agg(jsonb_build_object('copy_id',i.copy_id,'card_id',i.card_id,'card_number',oc.card_number,'card_name',oc.name,'rarity',oc.rarity) order by oc.card_number)
   from public.reader_card_wanted_post_items i join public.card_catalogue oc on oc.card_id=i.card_id where i.post_id=p.post_id),'[]'::jsonb),
  p.created_at,p.fulfilled_at
 from public.reader_card_wanted_posts p join public.card_catalogue c on c.card_id=p.wanted_card_id
 where p.owner_user_id=auth.uid()
 order by p.created_at desc;
$$;

create or replace function public.create_reader_wanted_post(
 p_wanted_card_id text,p_offer_copy_ids uuid[],p_offer_xanth_cents bigint default 0,p_message text default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); post uuid; v_copy uuid; card_row public.card_catalogue%rowtype; bal bigint; item_count integer:=0;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into card_row from public.card_catalogue where card_id=p_wanted_card_id and is_active
  and (unlock_chapter_id is null or unlock_chapter_id='chapter-01');
 if not found then raise exception 'That card is not currently released and available to request'; end if;
 if coalesce(p_offer_xanth_cents,0)<0 or coalesce(p_offer_xanth_cents,0)>100000000 then raise exception 'Enter a valid Xanth offer'; end if;
 if coalesce(array_length(p_offer_copy_ids,1),0)=0 and coalesce(p_offer_xanth_cents,0)=0 then raise exception 'Offer at least one of your cards or some Xanth'; end if;

 insert into public.reader_card_wanted_posts(owner_user_id,wanted_card_id,offered_xanth_cents,escrow_cents,message)
 values(uid,p_wanted_card_id,coalesce(p_offer_xanth_cents,0),coalesce(p_offer_xanth_cents,0),left(p_message,500))
 returning post_id into post;

 foreach v_copy in array coalesce(p_offer_copy_ids,'{}'::uuid[]) loop
  perform 1 from public.reader_card_copies c where c.copy_id=v_copy and c.owner_user_id=uid for update;
  if not found then raise exception 'One of the offered cards is no longer in your collection'; end if;
  if exists(select 1 from public.card_trade_offers t where t.offered_copy_id=v_copy and t.status='pending')
   or exists(select 1 from public.reader_card_market_listings l where l.copy_id=v_copy and l.status='active')
   or exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=v_copy and o.status='pending')
   or exists(select 1 from public.reader_card_wanted_post_items wi join public.reader_card_wanted_posts wp on wp.post_id=wi.post_id where wi.copy_id=v_copy and wp.status='open')
  then raise exception 'One of those cards is already reserved by another trade or wanted post'; end if;
  insert into public.reader_card_wanted_post_items(post_id,copy_id,card_id)
  select post,c.copy_id,c.card_id from public.reader_card_copies c where c.copy_id=v_copy;
  item_count:=item_count+1;
 end loop;

 if coalesce(p_offer_xanth_cents,0)>0 then
  insert into public.reader_xanth_accounts(user_id) values(uid) on conflict(user_id) do nothing;
  perform 1 from public.reader_xanth_accounts where user_id=uid for update;
  select balance_cents into bal from public.reader_xanth_accounts where user_id=uid;
  if bal<p_offer_xanth_cents then raise exception 'Not enough Xanth to reserve this Wanted Board offer'; end if;
  update public.reader_xanth_accounts set balance_cents=balance_cents-p_offer_xanth_cents,updated_at=now() where user_id=uid returning balance_cents into bal;
  insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values(uid,-p_offer_xanth_cents,bal,'wanted_board_escrow','Reserved Xanth for a Wanted Board request',post::text,jsonb_build_object('post_id',post,'wanted_card_id',p_wanted_card_id));
 end if;
 perform public.push_reader_notification(uid,'wanted-post:'||post::text,'community','Wanted Board post created',
  'Your request for '||card_row.name||' is now visible to other readers. Your offered cards and Xanth are reserved.',
  '/explore-eden/?tab=trading',jsonb_build_object('post_id',post));
 return post;
end $$;

create or replace function public.cancel_reader_wanted_post(p_post_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); p public.reader_card_wanted_posts%rowtype; bal bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.reader_card_wanted_posts where post_id=p_post_id and owner_user_id=uid and status='open' for update;
 if not found then return false; end if;
 update public.reader_card_wanted_posts set status='cancelled',updated_at=now(),escrow_cents=0 where post_id=p_post_id;
 if p.escrow_cents>0 then
  update public.reader_xanth_accounts set balance_cents=balance_cents+p.escrow_cents,updated_at=now()
  where user_id=uid returning balance_cents into bal;
  insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values(uid,p.escrow_cents,bal,'wanted_board_refund','Returned Xanth from a cancelled Wanted Board request',p_post_id::text,jsonb_build_object('post_id',p_post_id));
 end if;
 return true;
end $$;

create or replace function public.accept_reader_wanted_post(p_post_id uuid,p_wanted_copy_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); p public.reader_card_wanted_posts%rowtype; target_copy public.reader_card_copies%rowtype;
 item record; bal bigint; wanted_name text; offered_count integer:=0;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into p from public.reader_card_wanted_posts where post_id=p_post_id and status='open' for update;
 if not found then raise exception 'This Wanted Board request is no longer available'; end if;
 if p.owner_user_id=uid then raise exception 'You cannot fulfil your own request'; end if;
 select * into target_copy from public.reader_card_copies
 where copy_id=p_wanted_copy_id and owner_user_id=uid and card_id=p.wanted_card_id for update;
 if not found then raise exception 'You no longer own that requested card copy'; end if;
 if exists(select 1 from public.card_trade_offers t where t.offered_copy_id=p_wanted_copy_id and t.status='pending')
  or exists(select 1 from public.reader_card_market_listings l where l.copy_id=p_wanted_copy_id and l.status='active')
  or exists(select 1 from public.reader_card_market_offer_items i join public.reader_card_market_offers o on o.offer_id=i.offer_id where i.copy_id=p_wanted_copy_id and o.status='pending')
  or exists(select 1 from public.reader_card_wanted_post_items wi join public.reader_card_wanted_posts wp on wp.post_id=wi.post_id where wi.copy_id=p_wanted_copy_id and wp.status='open')
 then raise exception 'That card copy is already reserved elsewhere'; end if;

 for item in
  select wi.copy_id,wi.card_id,c.owner_user_id
  from public.reader_card_wanted_post_items wi
  join public.reader_card_copies c on c.copy_id=wi.copy_id
  where wi.post_id=p_post_id order by wi.copy_id for update of c
 loop
  if item.owner_user_id<>p.owner_user_id then raise exception 'The reader no longer owns every card in this offer'; end if;
  offered_count:=offered_count+1;
 end loop;
 if offered_count=0 and p.escrow_cents=0 then raise exception 'This Wanted Board offer no longer contains anything to exchange'; end if;

 insert into public.reader_xanth_accounts(user_id) values(uid),(p.owner_user_id) on conflict(user_id) do nothing;
 perform 1 from public.reader_xanth_accounts where user_id in(uid,p.owner_user_id) order by user_id for update;

 -- Close the post first so its own reserved cards can be transferred safely.
 update public.reader_card_wanted_posts
 set status='fulfilled',fulfilled_by=uid,fulfilled_copy_id=p_wanted_copy_id,fulfilled_at=now(),updated_at=now(),escrow_cents=0
 where post_id=p_post_id;
 update public.reader_card_copies set owner_user_id=p.owner_user_id where copy_id=p_wanted_copy_id;
 update public.reader_card_copies set owner_user_id=uid
 where copy_id in(select copy_id from public.reader_card_wanted_post_items where post_id=p_post_id);

 if p.escrow_cents>0 then
  update public.reader_xanth_accounts set balance_cents=balance_cents+p.escrow_cents,updated_at=now()
  where user_id=uid returning balance_cents into bal;
  insert into public.reader_xanth_transactions(user_id,amount_cents,balance_after_cents,transaction_type,description,reference_id,metadata)
  values(uid,p.escrow_cents,bal,'wanted_board_reward','Received Xanth for fulfilling a Wanted Board request',p_post_id::text,jsonb_build_object('post_id',p_post_id,'from_reader',p.owner_user_id));
 end if;
 select name into wanted_name from public.card_catalogue where card_id=p.wanted_card_id;
 perform public.push_reader_notification(p.owner_user_id,'wanted-fulfilled:'||p_post_id::text,'trade','Your Wanted Board request was fulfilled',
  'Another reader supplied '||coalesce(wanted_name,'your requested card')||'. Your offered cards and Xanth have been transferred.',
  '/explore-eden/?tab=trading',jsonb_build_object('post_id',p_post_id,'fulfilled_by',uid));
 perform public.push_reader_notification(uid,'wanted-fulfilment:'||p_post_id::text,'trade','Wanted Board exchange completed',
  'You supplied '||coalesce(wanted_name,'the requested card')||' and received the offered cards and Xanth.',
  '/explore-eden/?tab=trading',jsonb_build_object('post_id',p_post_id,'requester',p.owner_user_id));
 return jsonb_build_object('success',true,'wanted_card_id',p.wanted_card_id,'offered_cards_received',offered_count,'xanth_received_cents',p.escrow_cents);
end $$;

-- All wanted-board operations are authenticated RPCs; tables remain private.
revoke all on function public.push_reader_notification(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.notify_reader_market_offer_change() from public,anon,authenticated;
revoke all on function public.notify_reader_achievement_unlock() from public,anon,authenticated;
revoke all on function public.notify_reader_card_copy_change() from public,anon,authenticated;
revoke all on function public.guard_reader_wanted_copy_reservation() from public,anon,authenticated;
revoke all on function public.guard_wanted_copy_market_listing() from public,anon,authenticated;
revoke all on function public.guard_wanted_copy_market_offer() from public,anon,authenticated;
revoke all on function public.get_my_notifications(integer) from public,anon;
revoke all on function public.mark_my_notification_read(uuid) from public,anon;
revoke all on function public.mark_all_my_notifications_read() from public,anon;
revoke all on function public.sync_my_event_notifications(jsonb) from public,anon;
revoke all on function public.get_reader_wanted_board() from public,anon;
revoke all on function public.get_my_reader_wanted_posts() from public,anon;
revoke all on function public.create_reader_wanted_post(text,uuid[],bigint,text) from public,anon;
revoke all on function public.cancel_reader_wanted_post(uuid) from public,anon;
revoke all on function public.accept_reader_wanted_post(uuid,uuid) from public,anon;
revoke all on function public.get_my_market_tradeable_copies() from public,anon;
revoke all on function public.get_public_market_tradeable_copies(uuid) from public,anon;

grant execute on function public.get_my_notifications(integer),public.mark_my_notification_read(uuid),public.mark_all_my_notifications_read(),public.sync_my_event_notifications(jsonb) to authenticated;
grant execute on function public.get_reader_wanted_board(),public.get_my_reader_wanted_posts() to authenticated;
grant execute on function public.create_reader_wanted_post(text,uuid[],bigint,text),public.cancel_reader_wanted_post(uuid),public.accept_reader_wanted_post(uuid,uuid) to authenticated;
grant execute on function public.get_my_market_tradeable_copies(),public.get_public_market_tradeable_copies(uuid) to authenticated;

select 'reader_notifications' as installed_feature
where to_regclass('public.reader_notifications') is not null
union all
select 'reader_card_wanted_posts'
where to_regclass('public.reader_card_wanted_posts') is not null;
