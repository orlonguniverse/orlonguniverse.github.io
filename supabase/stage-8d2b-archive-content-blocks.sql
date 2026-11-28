-- ============================================================
-- ORLONG STAGE 8D.2B — THE ARCHIVE EXPERIENCE & BLOCK EDITOR
-- Adds structured, interactive archive content while preserving
-- existing entries and the original card-unlock security model.
-- ============================================================

alter table public.eden_archive_entries
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='eden_archive_content_blocks_array'
      and conrelid='public.eden_archive_entries'::regclass
  ) then
    alter table public.eden_archive_entries
      add constraint eden_archive_content_blocks_array
      check (jsonb_typeof(content_blocks)='array');
  end if;
end $$;

create or replace function public.get_my_eden_archive_entries()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select case when auth.uid() is null then '[]'::jsonb else coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',e.entry_id,'title',e.title,'category',e.category,'summary',e.summary,
   'content',e.content,'contentBlocks',e.content_blocks,'updatedAt',e.updated_at,
   'requiredCards',(select coalesce(jsonb_agg(jsonb_build_object('id',c.card_id,'number',c.card_number,'name',c.name,'artworkUrl',c.artwork_url) order by c.card_number),'[]'::jsonb)
     from public.eden_archive_entry_cards ec join public.card_catalogue c on c.card_id=ec.card_id
     where ec.entry_id=e.entry_id and exists(select 1 from public.reader_card_copies owned where owned.owner_user_id=auth.uid() and owned.card_id=c.card_id))
  ) order by e.sort_order,e.title)
  from public.eden_archive_entries e
  where e.is_published=true
   and exists(select 1 from public.eden_archive_entry_cards ec where ec.entry_id=e.entry_id)
   and not exists(select 1 from public.eden_archive_entry_cards ec where ec.entry_id=e.entry_id
    and not exists(select 1 from public.reader_card_copies owned where owned.owner_user_id=auth.uid() and owned.card_id=ec.card_id))
   and (e.unlock_chapter_id is null or exists(
    select 1 from public.eden_book_chapters ch join public.eden_book_parts part on part.part_id=ch.part_id
    where ch.chapter_id=e.unlock_chapter_id and ch.is_published=true and part.is_published=true
     and ch.released_at is not null and ch.released_at<=now()
     and (ch.required_access_key is null or exists(select 1 from public.reader_access_grants g where g.user_id=auth.uid() and g.access_key=ch.required_access_key))
   ))
 ),'[]'::jsonb) end;
$$;

create or replace function public.get_moderator_eden_archive_entries()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',e.entry_id,'title',e.title,'category',e.category,'summary',e.summary,'content',e.content,
  'contentBlocks',e.content_blocks,'unlockChapterId',e.unlock_chapter_id,'sortOrder',e.sort_order,'published',e.is_published,
  'requiredCardIds',(select coalesce(jsonb_agg(ec.card_id order by c.card_number),'[]'::jsonb) from public.eden_archive_entry_cards ec join public.card_catalogue c on c.card_id=ec.card_id where ec.entry_id=e.entry_id),
  'updatedAt',e.updated_at
 ) order by e.sort_order,e.title) from public.eden_archive_entries e),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_eden_archive_entry_v2(
 p_entry_id text,p_title text,p_category text,p_summary text,p_content text,
 p_content_blocks jsonb default '[]'::jsonb,
 p_unlock_chapter_id text default null,p_required_card_ids text[] default array[]::text[],
 p_sort_order integer default 0,p_is_published boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_entry_id text; v_card_count integer; v_blocks jsonb;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_entry_id is null or p_entry_id !~ '^[a-z0-9-]{1,100}$' then raise exception 'Entry ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>160 then raise exception 'Enter an entry title of 1–160 characters'; end if;
 if p_category not in ('characters','locations','creatures','organisations','history','technology','events','other') then raise exception 'Choose a valid archive category'; end if;
 if char_length(coalesce(p_summary,''))>500 then raise exception 'Summary must be 500 characters or fewer'; end if;
 if nullif(trim(coalesce(p_content,'')),'') is null and nullif(trim(coalesce(p_summary,'')),'') is null then raise exception 'Add a summary or a content block'; end if;
 if p_unlock_chapter_id is not null and not exists(select 1 from public.eden_book_chapters where chapter_id=p_unlock_chapter_id) then raise exception 'Choose a valid chapter release gate'; end if;
 if p_required_card_ids is null or cardinality(p_required_card_ids)<1 then raise exception 'Connect at least one required card to this entry'; end if;
 v_blocks:=coalesce(p_content_blocks,'[]'::jsonb);
 if jsonb_typeof(v_blocks)<>'array' then raise exception 'Archive content blocks must be an array'; end if;
 if octet_length(v_blocks::text)>180000 then raise exception 'Archive blocks are too large. Reduce the amount of text or imagery.'; end if;
 if exists(
   select 1 from jsonb_array_elements(v_blocks) b
   where jsonb_typeof(b)<>'object'
      or coalesce(b->>'type','') not in ('text','quote','image','callout','divider','timeline','reveal','facts','gallery')
 ) then raise exception 'One or more archive blocks use an unsupported format'; end if;
 select count(distinct requested.card_id) into v_card_count
 from unnest(p_required_card_ids) requested(card_id)
 join public.card_catalogue c on c.card_id=requested.card_id where c.is_active=true;
 if v_card_count<>cardinality(p_required_card_ids) then raise exception 'One or more selected cards are invalid, inactive or duplicated'; end if;

 insert into public.eden_archive_entries(entry_id,title,category,summary,content,content_blocks,unlock_chapter_id,sort_order,is_published,updated_at)
 values(p_entry_id,trim(p_title),p_category,coalesce(nullif(trim(p_summary),''),trim(p_content)),coalesce(nullif(trim(p_content),''),trim(p_summary)),v_blocks,
  nullif(trim(p_unlock_chapter_id),''),coalesce(p_sort_order,0),coalesce(p_is_published,false),now())
 on conflict(entry_id) do update set title=excluded.title,category=excluded.category,summary=excluded.summary,
  content=excluded.content,content_blocks=excluded.content_blocks,unlock_chapter_id=excluded.unlock_chapter_id,
  sort_order=excluded.sort_order,is_published=excluded.is_published,updated_at=now()
 returning entry_id into v_entry_id;
 delete from public.eden_archive_entry_cards where entry_id=v_entry_id;
 insert into public.eden_archive_entry_cards(entry_id,card_id)
 select v_entry_id,requested.card_id from unnest(p_required_card_ids) requested(card_id);
 return jsonb_build_object('success',true,'entry_id',v_entry_id,'required_cards',v_card_count,'blocks',jsonb_array_length(v_blocks));
end;
$$;

revoke all on function public.save_moderator_eden_archive_entry_v2(text,text,text,text,text,jsonb,text,text[],integer,boolean) from public,anon;
grant execute on function public.save_moderator_eden_archive_entry_v2(text,text,text,text,text,jsonb,text,text[],integer,boolean) to authenticated;

select entry_id,title,category,is_published,jsonb_array_length(content_blocks) as content_blocks
from public.eden_archive_entries order by sort_order,title;
