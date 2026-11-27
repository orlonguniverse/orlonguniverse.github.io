-- ============================================================
-- ORLONG STAGE 8D.2 — THE EDEN ARCHIVE
-- Secure card-gated lore entries, reader unlocks and moderator CMS.
-- Run after Stage 8C chapter management and card binder migrations.
-- Locked entry metadata is never returned by the reader RPC.
-- ============================================================
create table if not exists public.eden_archive_entries (
 entry_id text primary key check(entry_id ~ '^[a-z0-9-]{1,100}$'),
 title text not null check(char_length(trim(title)) between 1 and 160),
 category text not null check(category in ('characters','locations','creatures','organisations','history','technology','events','other')),
 summary text not null default '' check(char_length(summary)<=500),
 content text not null check(char_length(trim(content)) between 1 and 30000),
 unlock_chapter_id text references public.eden_book_chapters(chapter_id) on update cascade on delete set null,
 sort_order integer not null default 0,
 is_published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.eden_archive_entry_cards (
 entry_id text not null references public.eden_archive_entries(entry_id) on delete cascade,
 card_id text not null references public.card_catalogue(card_id) on update cascade on delete restrict,
 created_at timestamptz not null default now(),
 primary key(entry_id,card_id)
);
create index if not exists eden_archive_entries_category_order on public.eden_archive_entries(category,sort_order,title);
create index if not exists eden_archive_entries_chapter on public.eden_archive_entries(unlock_chapter_id);
create index if not exists eden_archive_entry_cards_card on public.eden_archive_entry_cards(card_id);
alter table public.eden_archive_entries enable row level security;
alter table public.eden_archive_entry_cards enable row level security;
revoke all on public.eden_archive_entries from anon,authenticated;
revoke all on public.eden_archive_entry_cards from anon,authenticated;

create or replace function public.get_my_eden_archive_entries()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select case when auth.uid() is null then '[]'::jsonb else coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',e.entry_id,'title',e.title,'category',e.category,'summary',e.summary,
   'content',e.content,'updatedAt',e.updated_at,
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
  'unlockChapterId',e.unlock_chapter_id,'sortOrder',e.sort_order,'published',e.is_published,
  'requiredCardIds',(select coalesce(jsonb_agg(ec.card_id order by c.card_number),'[]'::jsonb) from public.eden_archive_entry_cards ec join public.card_catalogue c on c.card_id=ec.card_id where ec.entry_id=e.entry_id),
  'updatedAt',e.updated_at
 ) order by e.sort_order,e.title) from public.eden_archive_entries e),'[]'::jsonb);
end;
$$;

create or replace function public.get_moderator_eden_archive_cards()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',c.card_id,'number',c.card_number,'name',c.name,'category',cat.label,'active',c.is_active) order by cat.sort_order,c.category_number)
  from public.card_catalogue c join public.card_categories cat on cat.category_id=c.category_id where c.is_active=true),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_eden_archive_entry(
 p_entry_id text,p_title text,p_category text,p_summary text,p_content text,
 p_unlock_chapter_id text default null,p_required_card_ids text[] default array[]::text[],
 p_sort_order integer default 0,p_is_published boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_entry_id text; v_card_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_entry_id is null or p_entry_id !~ '^[a-z0-9-]{1,100}$' then raise exception 'Entry ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>160 then raise exception 'Enter an entry title of 1–160 characters'; end if;
 if p_category not in ('characters','locations','creatures','organisations','history','technology','events','other') then raise exception 'Choose a valid archive category'; end if;
 if char_length(coalesce(p_summary,''))>500 then raise exception 'Summary must be 500 characters or fewer'; end if;
 if nullif(trim(p_content),'') is null or char_length(p_content)>30000 then raise exception 'Entry content is required and must be 30,000 characters or fewer'; end if;
 if p_unlock_chapter_id is not null and not exists(select 1 from public.eden_book_chapters where chapter_id=p_unlock_chapter_id) then raise exception 'Choose a valid chapter release gate'; end if;
 if coalesce(cardinality(p_required_card_ids),0)<1 then raise exception 'Connect at least one required card to this entry'; end if;
 select count(distinct requested.card_id) into v_card_count from unnest(p_required_card_ids) requested(card_id)
  join public.card_catalogue c on c.card_id=requested.card_id where c.is_active=true;
 if v_card_count<>cardinality(p_required_card_ids) then raise exception 'One or more selected cards are invalid, inactive or duplicated'; end if;
 insert into public.eden_archive_entries(entry_id,title,category,summary,content,unlock_chapter_id,sort_order,is_published,updated_at)
 values(p_entry_id,trim(p_title),p_category,coalesce(trim(p_summary),''),p_content,nullif(trim(p_unlock_chapter_id),''),coalesce(p_sort_order,0),coalesce(p_is_published,false),now())
 on conflict(entry_id) do update set title=excluded.title,category=excluded.category,summary=excluded.summary,content=excluded.content,
  unlock_chapter_id=excluded.unlock_chapter_id,sort_order=excluded.sort_order,is_published=excluded.is_published,updated_at=now()
 returning entry_id into v_entry_id;
 delete from public.eden_archive_entry_cards where entry_id=v_entry_id;
 insert into public.eden_archive_entry_cards(entry_id,card_id) select v_entry_id,requested.card_id from unnest(p_required_card_ids) requested(card_id);
 return jsonb_build_object('success',true,'entry_id',v_entry_id,'required_cards',v_card_count);
end;
$$;

create or replace function public.delete_moderator_eden_archive_entry(p_entry_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 delete from public.eden_archive_entries where entry_id=p_entry_id;
 if not found then raise exception 'Archive entry not found'; end if;
 return jsonb_build_object('success',true,'deleted',p_entry_id);
end;
$$;

revoke all on function public.get_my_eden_archive_entries() from public,anon;
revoke all on function public.get_moderator_eden_archive_entries() from public,anon;
revoke all on function public.get_moderator_eden_archive_cards() from public,anon;
revoke all on function public.save_moderator_eden_archive_entry(text,text,text,text,text,text,text[],integer,boolean) from public,anon;
revoke all on function public.delete_moderator_eden_archive_entry(text) from public,anon;
grant execute on function public.get_my_eden_archive_entries() to authenticated;
grant execute on function public.get_moderator_eden_archive_entries() to authenticated;
grant execute on function public.get_moderator_eden_archive_cards() to authenticated;
grant execute on function public.save_moderator_eden_archive_entry(text,text,text,text,text,text,text[],integer,boolean) to authenticated;
grant execute on function public.delete_moderator_eden_archive_entry(text) to authenticated;

select entry_id,title,category,is_published,unlock_chapter_id from public.eden_archive_entries order by sort_order,title;
