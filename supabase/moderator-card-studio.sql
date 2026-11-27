-- ORLONG MODERATOR HEADQUARTERS + CARD STUDIO
-- Run once in Supabase SQL Editor after card-foundation.sql and schema.sql.
-- All catalogue writes and uploads are restricted to reader_moderators.

insert into public.card_categories (category_id,label,category_code,description,sort_order,is_active)
values ('special-edition','Special Edition','ERA','Limited and promotional card editions.',9,true)
on conflict (category_id) do update set label=excluded.label,category_code=excluded.category_code,
 description=excluded.description,sort_order=excluded.sort_order,is_active=true;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('orlong-card-artwork','orlong-card-artwork',true,12582912,
       array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=12582912,
 allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Moderators upload Orlong card artwork" on storage.objects;
create policy "Moderators upload Orlong card artwork"
on storage.objects for insert to authenticated
with check(bucket_id='orlong-card-artwork' and public.is_reader_moderator());

drop policy if exists "Moderators update Orlong card artwork" on storage.objects;
create policy "Moderators update Orlong card artwork"
on storage.objects for update to authenticated
using(bucket_id='orlong-card-artwork' and public.is_reader_moderator())
with check(bucket_id='orlong-card-artwork' and public.is_reader_moderator());

drop policy if exists "Moderators delete Orlong card artwork" on storage.objects;
create policy "Moderators delete Orlong card artwork"
on storage.objects for delete to authenticated
using(bucket_id='orlong-card-artwork' and public.is_reader_moderator());

drop policy if exists "Public can view Orlong card artwork" on storage.objects;
create policy "Public can view Orlong card artwork"
on storage.objects for select to anon,authenticated
using(bucket_id='orlong-card-artwork');

alter table public.card_catalogue add column if not exists chapter_number integer;
alter table public.card_catalogue drop constraint if exists card_catalogue_chapter_number_positive;
alter table public.card_catalogue add constraint card_catalogue_chapter_number_positive check (chapter_number is null or chapter_number between 1 and 999);

drop function if exists public.save_moderator_card(text,text,text,text,text,text,text,text,boolean);

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
    'category_number',c.category_number,'name',c.name,'rarity',c.rarity,'chapter_number',c.chapter_number,
    'set_id',c.set_id,'unlock_chapter_id',c.unlock_chapter_id,
    'description',c.spoiler_safe_description,'artwork_url',c.artwork_url,
    'active',c.is_active
  ) order by cat.sort_order,c.category_number),'[]'::jsonb)
   from public.card_catalogue c join public.card_categories cat on cat.category_id=c.category_id)
 );
end;
$$;

create or replace function public.save_moderator_card(
 p_card_id text,
 p_name text,
 p_category_id text,
 p_rarity text,
 p_set_id text,
 p_unlock_chapter_id text,
 p_chapter_number integer,
 p_description text,
 p_artwork_url text,
 p_active boolean default true
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
 v_id text;
 v_number integer;
 v_code text;
 v_card_number text;
 v_is_new boolean;
v_existing_category text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Card name is required'; end if;
 if p_rarity not in ('common','uncommon','rare','epic','legendary') then raise exception 'Invalid rarity'; end if;
 if not exists(select 1 from public.card_categories where category_id=p_category_id and is_active) then raise exception 'Choose a valid category'; end if;
 if p_set_id is not null and not exists(select 1 from public.card_sets where set_id=p_set_id and is_active) then raise exception 'Choose a valid card set'; end if;
 if p_unlock_chapter_id is not null and p_unlock_chapter_id !~ '^[a-z0-9-]{1,80}$' then raise exception 'Chapter ID must use lowercase letters, numbers and hyphens'; end if;
 if p_chapter_number is not null and p_chapter_number not between 1 and 999 then raise exception 'Chapter number must be between 1 and 999'; end if;
 if p_description is not null and char_length(p_description)>1200 then raise exception 'Description must be 1,200 characters or fewer'; end if;
 if p_artwork_url is not null and char_length(p_artwork_url)>2000 then raise exception 'Artwork URL is too long'; end if;

 v_is_new := p_card_id is null or trim(p_card_id)='';
 if v_is_new then
   v_id := trim(both '-' from regexp_replace(lower(trim(p_name)),'[^a-z0-9]+','-','g'));
   if v_id='' then raise exception 'Card name must contain letters or numbers'; end if;
   if exists(select 1 from public.card_catalogue where card_id=v_id) then
     v_id := v_id||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
   end if;
   select category_code into v_code from public.card_categories where category_id=p_category_id;
   select coalesce(max(category_number),0)+1 into v_number
   from public.card_catalogue
   where category_id=p_category_id;
   v_card_number := v_code||'-'||lpad(v_number::text,3,'0');
   insert into public.card_catalogue(
    card_id,category_id,category_number,card_number,name,rarity,set_id,
    universe_id,series_id,book_id,unlock_chapter_id,chapter_number,spoiler_safe_description,
    artwork_url,is_active,sort_order
   ) values (
    v_id,p_category_id,v_number,v_card_number,trim(p_name),p_rarity,p_set_id,
    'orlong','eden','trials-of-eden',nullif(trim(p_unlock_chapter_id),''),p_chapter_number,
    nullif(trim(p_description),''),nullif(trim(p_artwork_url),''),coalesce(p_active,true),v_number
   );
 else
   select category_number,card_number,category_id into v_number,v_card_number,v_existing_category
   from public.card_catalogue where card_id=p_card_id;
   if not found then raise exception 'Card not found'; end if;
   if v_existing_category is distinct from p_category_id then raise exception 'A card category cannot be changed after its permanent card number has been assigned'; end if;
   update public.card_catalogue set
    name=trim(p_name),category_id=p_category_id,rarity=p_rarity,set_id=p_set_id,
    unlock_chapter_id=nullif(trim(p_unlock_chapter_id),''),chapter_number=p_chapter_number,
    spoiler_safe_description=nullif(trim(p_description),''),
    artwork_url=nullif(trim(p_artwork_url),''),is_active=coalesce(p_active,true),
    updated_at=now()
   where card_id=p_card_id;
   v_id:=p_card_id;
 end if;
 return jsonb_build_object('card_id',v_id,'card_number',v_card_number,'category_number',v_number,'created',v_is_new);
end;
$$;

revoke all on function public.get_moderator_card_studio() from public,anon;
revoke all on function public.save_moderator_card(text,text,text,text,text,text,integer,text,text,boolean) from public,anon;
grant execute on function public.get_moderator_card_studio() to authenticated;
grant execute on function public.save_moderator_card(text,text,text,text,text,text,integer,text,text,boolean) to authenticated;


-- Permanently remove a card and all dependent collection/reward/trade records.
-- This is moderator-only and runs atomically in the database.
create or replace function public.delete_moderator_card(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 v_artwork_url text;
 v_card_number text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 select artwork_url,card_number into v_artwork_url,v_card_number
 from public.card_catalogue where card_id=p_card_id for update;
 if not found then raise exception 'Card not found'; end if;

 delete from public.card_trade_offers
 where requested_card_id=p_card_id
    or offered_copy_id in (select copy_id from public.reader_card_copies where card_id=p_card_id);

 delete from public.card_reward_pool_cards where card_id=p_card_id;
 delete from public.card_reward_claims where card_id=p_card_id;
 delete from public.reader_card_copies where card_id=p_card_id;
 delete from public.card_catalogue where card_id=p_card_id;

 return jsonb_build_object('card_id',p_card_id,'card_number',v_card_number,'artwork_url',v_artwork_url);
end;
$$;

revoke all on function public.delete_moderator_card(text) from public,anon;
grant execute on function public.delete_moderator_card(text) to authenticated;

-- Verification: these functions return data only to registered moderators.
select public.is_reader_moderator() as current_user_is_moderator;

-- Public archive feed. Unreleased chapter-linked cards remain hidden until
-- their unlock chapter is released and the moderator clears that chapter lock.
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
 order by cat.sort_order,c.category_number;
$$;
revoke all on function public.get_public_card_catalogue() from public;
grant execute on function public.get_public_card_catalogue() to anon,authenticated;
