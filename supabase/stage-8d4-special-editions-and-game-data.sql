-- ORLONG STAGE 8D.4 — SPECIAL EDITIONS, RELEASE WINDOWS & FUTURE GAME DATA
-- Run after the Stage 8D.3 migration.
-- This is additive: existing card ownership, Xanth transactions and trading records remain intact.

create table if not exists public.eden_card_release_metadata (
 card_id text primary key references public.card_catalogue(card_id) on delete cascade,
 release_type text not null default 'standard'
  check (release_type in ('standard','special_edition','event','achievement','promotion','limited','early_access')),
 release_label text,
 available_from timestamptz,
 available_until timestamptz,
 limited_quantity integer,
 acquisition_source text,
 game_attributes jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint eden_card_release_dates_valid check (available_from is null or available_until is null or available_until>available_from),
 constraint eden_card_limited_quantity_valid check (limited_quantity is null or limited_quantity>0),
 constraint eden_card_game_attributes_object check (jsonb_typeof(game_attributes)='object')
);

create index if not exists eden_card_release_type_idx on public.eden_card_release_metadata(release_type);
create index if not exists eden_card_release_window_idx on public.eden_card_release_metadata(available_from,available_until);

alter table public.eden_card_release_metadata enable row level security;
revoke all on public.eden_card_release_metadata from anon,authenticated;

-- Existing early-access special cards are labelled accurately without changing their chapter settings.
insert into public.eden_card_release_metadata(card_id,release_type,release_label)
select c.card_id,'early_access','Early Access'
from public.card_catalogue c
where c.set_id='early-access-special-edition' or c.card_id like 'special-%'
on conflict(card_id) do nothing;

create or replace function public.get_moderator_card_release_metadata()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'card_id',m.card_id,'release_type',m.release_type,'release_label',m.release_label,
   'available_from',m.available_from,'available_until',m.available_until,
   'limited_quantity',m.limited_quantity,'acquisition_source',m.acquisition_source,
   'game_attributes',m.game_attributes
  ) order by m.card_id)
  from public.eden_card_release_metadata m
 ),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_card_release_metadata(
 p_card_id text,
 p_release_type text default 'standard',
 p_release_label text default null,
 p_available_from timestamptz default null,
 p_available_until timestamptz default null,
 p_limited_quantity integer default null,
 p_acquisition_source text default null,
 p_game_attributes jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_chapter_id text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_card_id is null or not exists(select 1 from public.card_catalogue where card_id=p_card_id) then
  raise exception 'Choose a card that exists in the card catalogue';
 end if;
 if p_release_type not in ('standard','special_edition','event','achievement','promotion','limited','early_access') then
  raise exception 'Choose a valid card release type';
 end if;
 if p_release_type='standard' then
  select unlock_chapter_id into v_chapter_id from public.card_catalogue where card_id=p_card_id;
  if v_chapter_id is null then raise exception 'Standard cards need a chapter association. Choose a special release type to release independently of a chapter.'; end if;
 end if;
 if p_available_from is not null and p_available_until is not null and p_available_until<=p_available_from then
  raise exception 'The release end must be later than the release start';
 end if;
 if p_limited_quantity is not null and p_limited_quantity<=0 then raise exception 'Limited quantity must be greater than zero'; end if;
 if p_game_attributes is null or jsonb_typeof(p_game_attributes)<>'object' then raise exception 'Game attributes must be a JSON object'; end if;
 if (select count(*) from jsonb_object_keys(p_game_attributes))>30 then raise exception 'Use no more than 30 top-level game attributes'; end if;
 insert into public.eden_card_release_metadata(
  card_id,release_type,release_label,available_from,available_until,
  limited_quantity,acquisition_source,game_attributes,updated_at
 ) values(
  p_card_id,p_release_type,nullif(trim(p_release_label),''),p_available_from,p_available_until,
  p_limited_quantity,nullif(trim(p_acquisition_source),''),p_game_attributes,now()
 )
 on conflict(card_id) do update set
  release_type=excluded.release_type,release_label=excluded.release_label,
  available_from=excluded.available_from,available_until=excluded.available_until,
  limited_quantity=excluded.limited_quantity,acquisition_source=excluded.acquisition_source,
  game_attributes=excluded.game_attributes,updated_at=now();
 return jsonb_build_object('success',true,'card_id',p_card_id,'release_type',p_release_type);
end;
$$;

-- Read-only game-data endpoint for the upcoming card-game and Trials-simulator systems.
-- It exposes only structured gameplay/release metadata, not card descriptions or locked story content.
create or replace function public.get_public_card_game_data(p_card_ids text[] default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'card_id',c.card_id,
  'release_type',coalesce(m.release_type,'standard'),
  'release_label',m.release_label,
  'available_from',m.available_from,
  'available_until',m.available_until,
  'limited_quantity',m.limited_quantity,
  'acquisition_source',m.acquisition_source,
  'game_attributes',coalesce(m.game_attributes,'{}'::jsonb)
 ) order by c.card_id),'[]'::jsonb)
 from public.card_catalogue c
 left join public.eden_card_release_metadata m on m.card_id=c.card_id
 where c.is_active=true and (p_card_ids is null or c.card_id=any(p_card_ids));
$$;

-- reader_card_copies stores one row per physical card (copy_id), not a
-- quantity column. Count rows so purchases, rewards and trades all respect
-- the global print-run limit.
create or replace function public.enforce_eden_card_limited_quantity()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_limit integer; v_existing bigint; v_type text;
begin
 select limited_quantity,release_type
 into v_limit,v_type
 from public.eden_card_release_metadata
 where card_id=new.card_id;

 if v_type is distinct from 'limited' or v_limit is null then
  return new;
 end if;

 select count(*) into v_existing
 from public.reader_card_copies existing_copy
 where existing_copy.card_id=new.card_id
   and (tg_op='INSERT' or existing_copy.copy_id<>new.copy_id);

 if v_existing+1>v_limit then
  raise exception 'This limited edition has reached its total release quantity (% copies)',v_limit;
 end if;
 return new;
end;
$$;

drop trigger if exists enforce_eden_card_limited_quantity on public.reader_card_copies;
create trigger enforce_eden_card_limited_quantity
before insert or update of card_id on public.reader_card_copies
for each row execute function public.enforce_eden_card_limited_quantity();

revoke all on function public.get_moderator_card_release_metadata() from public,anon;
revoke all on function public.save_moderator_card_release_metadata(text,text,text,timestamptz,timestamptz,integer,text,jsonb) from public,anon;
revoke all on function public.get_public_card_game_data(text[]) from public,anon;
grant execute on function public.get_moderator_card_release_metadata() to authenticated;
grant execute on function public.save_moderator_card_release_metadata(text,text,text,timestamptz,timestamptz,integer,text,jsonb) to authenticated;
grant execute on function public.get_public_card_game_data(text[]) to authenticated;

select release_type,count(*) as card_count,
 count(*) filter(where limited_quantity is not null) as quantity_limited
from public.eden_card_release_metadata group by release_type order by release_type;


-- Reader-facing release labels for cards already returned by the public catalogue.
create or replace function public.get_public_card_release_metadata()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'card_id',c.card_id,
  'release_type',coalesce(m.release_type,'standard'),
  'release_label',m.release_label,
  'available_from',m.available_from,
  'available_until',m.available_until
 ) order by c.card_id),'[]'::jsonb)
 from public.card_catalogue c
 left join public.eden_card_release_metadata m on m.card_id=c.card_id
 where c.is_active=true;
$$;
revoke all on function public.get_public_card_release_metadata() from public;
grant execute on function public.get_public_card_release_metadata() to anon,authenticated;
