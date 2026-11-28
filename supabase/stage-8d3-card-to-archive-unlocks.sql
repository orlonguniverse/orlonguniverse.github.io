-- ORLONG STAGE 8D.3 — CARD-TO-ARCHIVE UNLOCK RULES
-- Run after stage-8d2c-archive-performance-and-relationships.sql.

alter table public.eden_archive_entries
 add column if not exists card_match_mode text not null default 'all'
 check (card_match_mode in ('all','any'));

create or replace function public.reader_can_access_eden_archive_entry(p_entry_id text)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select auth.uid() is not null and exists(
  select 1 from public.eden_archive_entries e
  where e.entry_id=p_entry_id and e.is_published=true
   and exists(select 1 from public.eden_archive_entry_cards ec where ec.entry_id=e.entry_id)
   and (
    (e.card_match_mode='all' and not exists(
      select 1 from public.eden_archive_entry_cards ec
      where ec.entry_id=e.entry_id and not exists(
       select 1 from public.reader_card_copies owned
       where owned.owner_user_id=auth.uid() and owned.card_id=ec.card_id)))
    or
    (e.card_match_mode='any' and exists(
      select 1 from public.eden_archive_entry_cards ec
      join public.reader_card_copies owned on owned.owner_user_id=auth.uid() and owned.card_id=ec.card_id
      where ec.entry_id=e.entry_id))
   )
   and (e.unlock_chapter_id is null or exists(
    select 1 from public.eden_book_chapters ch join public.eden_book_parts part on part.part_id=ch.part_id
    where ch.chapter_id=e.unlock_chapter_id and ch.is_published=true and part.is_published=true
     and ch.released_at is not null and ch.released_at<=now()
     and (ch.required_access_key is null or exists(
      select 1 from public.reader_access_grants g where g.user_id=auth.uid() and g.access_key=ch.required_access_key))
   ))
 );
$$;

create or replace function public.reader_can_access_eden_archive_block(p_block jsonb)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select case
  when p_block is null then false
  when not (p_block ? 'requiredCardIds') then true
  when jsonb_typeof(p_block->'requiredCardIds')<>'array' then false
  when jsonb_array_length(p_block->'requiredCardIds')=0 then true
  when coalesce(p_block->>'requiredCardMode','all') not in ('all','any') then false
  when p_block->>'requiredCardMode'='any' then exists(
   select 1 from jsonb_array_elements_text(p_block->'requiredCardIds') req(card_id)
   join public.reader_card_copies owned on owned.owner_user_id=auth.uid() and owned.card_id=req.card_id)
  else (select count(distinct owned.card_id)
   from jsonb_array_elements_text(p_block->'requiredCardIds') req(card_id)
   join public.reader_card_copies owned on owned.owner_user_id=auth.uid() and owned.card_id=req.card_id)
   =jsonb_array_length(p_block->'requiredCardIds')
 end;
$$;

create or replace function public.get_moderator_eden_archive_entries()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',e.entry_id,'title',e.title,'category',e.category,'summary',e.summary,'content',e.content,
  'unlockChapterId',e.unlock_chapter_id,'sortOrder',e.sort_order,'published',e.is_published,
  'cardMatchMode',e.card_match_mode,
  'requiredCardIds',(select coalesce(jsonb_agg(ec.card_id order by c.card_number),'[]'::jsonb)
   from public.eden_archive_entry_cards ec join public.card_catalogue c on c.card_id=ec.card_id
   where ec.entry_id=e.entry_id),
  'contentBlocks',e.content_blocks,'updatedAt',e.updated_at
 ) order by e.sort_order,e.title) from public.eden_archive_entries e),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_eden_archive_entry_v3(
 p_entry_id text,p_title text,p_category text,p_summary text,p_content text,
 p_content_blocks jsonb default '[]'::jsonb,p_unlock_chapter_id text default null,
 p_required_card_ids text[] default array[]::text[],p_card_match_mode text default 'all',
 p_sort_order integer default 0,p_is_published boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_result jsonb; v_block jsonb;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_card_match_mode not in ('all','any') then raise exception 'Choose ALL cards or ANY one card'; end if;
 for v_block in select value from jsonb_array_elements(coalesce(p_content_blocks,'[]'::jsonb)) loop
  if v_block ? 'requiredCardMode' and v_block->>'requiredCardMode' not in ('all','any') then
   raise exception 'Choose ALL cards or ANY one card for every content block';
  end if;
 end loop;
 v_result:=public.save_moderator_eden_archive_entry_v2(
  p_entry_id,p_title,p_category,p_summary,p_content,p_content_blocks,
  p_unlock_chapter_id,p_required_card_ids,p_sort_order,p_is_published);
 update public.eden_archive_entries set card_match_mode=p_card_match_mode,updated_at=now()
 where entry_id=p_entry_id;
 return v_result||jsonb_build_object('card_match_mode',p_card_match_mode);
end;
$$;

revoke all on function public.reader_can_access_eden_archive_entry(text) from public,anon,authenticated;
revoke all on function public.reader_can_access_eden_archive_block(jsonb) from public,anon,authenticated;
revoke all on function public.get_moderator_eden_archive_entries() from public,anon;
revoke all on function public.save_moderator_eden_archive_entry_v3(text,text,text,text,text,jsonb,text,text[],text,integer,boolean) from public,anon;
grant execute on function public.reader_can_access_eden_archive_entry(text) to authenticated;
grant execute on function public.reader_can_access_eden_archive_block(jsonb) to authenticated;
grant execute on function public.get_moderator_eden_archive_entries() to authenticated;
grant execute on function public.save_moderator_eden_archive_entry_v3(text,text,text,text,text,jsonb,text,text[],text,integer,boolean) to authenticated;

select entry_id,title,card_match_mode,
 (select count(*) from public.eden_archive_entry_cards ec where ec.entry_id=e.entry_id) as linked_cards
from public.eden_archive_entries e order by sort_order,title;
