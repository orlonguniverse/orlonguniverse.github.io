-- ============================================================
-- ORLONG STAGE 8C.4 — CARD ACCESS PERMISSIONS
-- Connects card:<card-id> access-code grants to catalogue visibility.
-- Run after card-foundation.sql, moderator-card-studio.sql and
-- the existing access-code foundation.
-- ============================================================

alter table public.card_catalogue
 add column if not exists required_access_key text;

alter table public.card_catalogue
 drop constraint if exists card_catalogue_required_access_key_format;
alter table public.card_catalogue
 add constraint card_catalogue_required_access_key_format
 check (required_access_key is null or required_access_key ~ '^[a-z0-9][a-z0-9:_-]{0,79}$');

create or replace function public.set_moderator_card_access_key(
 p_card_id text,
 p_required_access_key text default null
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_required_access_key is not null and p_required_access_key !~ '^[a-z0-9][a-z0-9:_-]{0,79}$' then
  raise exception 'Access permission key is invalid';
 end if;
 update public.card_catalogue
 set required_access_key=nullif(trim(p_required_access_key),''),updated_at=now()
 where card_id=p_card_id;
 if not found then raise exception 'Card not found'; end if;
 return jsonb_build_object('success',true,'card_id',p_card_id);
end;
$$;

create or replace function public.get_moderator_card_studio()
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return jsonb_build_object(
  'categories',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',category_id,'label',label,'code',category_code
  ) order by sort_order),'[]'::jsonb) from public.card_categories where is_active),
  'sets',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',set_id,'title',title
  ) order by sort_order,title),'[]'::jsonb) from public.card_sets where is_active),
  'cards',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.card_id,'number',c.card_number,'category_id',c.category_id,
    'category_number',c.category_number,'name',c.name,'rarity',c.rarity,
    'chapter_number',c.chapter_number,'set_id',c.set_id,
    'unlock_chapter_id',c.unlock_chapter_id,'required_access_key',c.required_access_key,
    'description',c.spoiler_safe_description,'artwork_url',c.artwork_url,
    'active',c.is_active
  ) order by cat.sort_order,c.category_number),'[]'::jsonb)
   from public.card_catalogue c join public.card_categories cat on cat.category_id=c.category_id)
 );
end;
$$;

drop function if exists public.get_public_card_catalogue();
create function public.get_public_card_catalogue()
returns table (
 card_id text,card_number text,name text,rarity text,category_id text,chapter_number integer,
 category_label text,category_code text,set_id text,unlock_chapter_id text,
 spoiler_safe_description text,artwork_url text
)
language sql stable security definer
set search_path=public,pg_temp
as $$
 select c.card_id,c.card_number,c.name,c.rarity,c.category_id,c.chapter_number,
        cat.label,cat.category_code,c.set_id,c.unlock_chapter_id,
        c.spoiler_safe_description,c.artwork_url
 from public.card_catalogue c
 join public.card_categories cat on cat.category_id=c.category_id
 where c.is_active=true
   and (c.unlock_chapter_id is null or c.unlock_chapter_id='chapter-01')
   and (c.required_access_key is null or exists(
     select 1 from public.reader_access_grants g
     where g.user_id=auth.uid() and g.access_key=c.required_access_key
   ))
 order by cat.sort_order,c.category_number;
$$;

revoke all on function public.set_moderator_card_access_key(text,text) from public,anon;
grant execute on function public.set_moderator_card_access_key(text,text) to authenticated;
revoke all on function public.get_public_card_catalogue() from public;
grant execute on function public.get_public_card_catalogue() to anon,authenticated;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='card_catalogue'
 and column_name='required_access_key';
