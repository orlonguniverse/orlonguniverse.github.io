-- ============================================================
-- ORLONG STAGE 8C.1 — ADMINISTRABLE EDEN CHAPTER LIBRARY
-- Run once in the Supabase SQL Editor.
--
-- Moves chapter/part metadata into Supabase and gives moderators
-- secure management of the existing private eden-chapters bucket.
-- Manuscript HTML remains in private Storage, never GitHub.
-- ============================================================

create table if not exists public.eden_book_parts (
  part_id text primary key check (part_id ~ '^[a-z0-9-]{1,40}$'),
  title text not null check (char_length(trim(title)) between 1 and 100),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.eden_book_chapters (
  chapter_id text primary key check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  chapter_number text not null check (char_length(trim(chapter_number)) between 1 and 40),
  title text not null check (char_length(trim(title)) between 1 and 160),
  part_id text not null references public.eden_book_parts(part_id) on update cascade on delete restrict,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  released_at timestamptz,
  companion_terms jsonb not null default '[]'::jsonb check (jsonb_typeof(companion_terms) = 'array'),
  updated_at timestamptz not null default now()
);

create index if not exists eden_book_chapters_part_order
  on public.eden_book_chapters(part_id, sort_order);

alter table public.eden_book_parts enable row level security;
alter table public.eden_book_chapters enable row level security;
revoke all on public.eden_book_parts from anon, authenticated;
revoke all on public.eden_book_chapters from anon, authenticated;

-- Preserve the ten-part structure already used by the Reading Room.
insert into public.eden_book_parts(part_id,title,sort_order,is_published)
values
 ('part-01','Part One',1,true),
 ('part-02','Part Two',2,true),
 ('part-03','Part Three',3,true),
 ('part-04','Part Four',4,true),
 ('part-05','Part Five',5,true),
 ('part-06','Part Six',6,true),
 ('part-07','Part Seven',7,true),
 ('part-08','Part Eight',8,true),
 ('part-09','Part Nine',9,true),
 ('part-10','Part Ten',10,true)
on conflict(part_id) do update set
 title=excluded.title, sort_order=excluded.sort_order, is_published=true;

-- Import the existing public directory metadata. The manuscript itself
-- remains in the existing private Storage object chapter-01.html.
insert into public.eden_book_chapters
 (chapter_id,chapter_number,title,part_id,sort_order,is_published,released_at,companion_terms)
values
 ('chapter-01','Chapter 01','The Show','part-01',1,true,now(),
  '[{"id":"maya-garcia","term":"Maya Garcia","triggers":["Maya","Maya Garcia"],"category":"CHARACTER","description":"The protagonist of the story."},{"id":"xantheon","term":"Xantheon","triggers":["Xantheon"],"category":"SECTION","description":"The section in which Eden is located."}]'::jsonb),
 ('chapter-02','Chapter 02','Chapter title to be added','part-01',2,true,null,'[]'::jsonb),
 ('chapter-03','Chapter 03','Chapter title to be added','part-01',3,true,null,'[]'::jsonb),
 ('chapter-04','Chapter 04','Chapter title to be added','part-01',4,true,null,'[]'::jsonb),
 ('chapter-05','Chapter 05','Chapter title to be added','part-01',5,true,null,'[]'::jsonb),
 ('chapter-06','Chapter 06','Chapter title to be added','part-01',6,true,null,'[]'::jsonb),
 ('chapter-07','Chapter 07','Chapter title to be added','part-01',7,true,null,'[]'::jsonb)
on conflict(chapter_id) do nothing;

-- Ensure the manuscript bucket is private. The bucket already exists in
-- the project; this does not delete or replace its stored chapter files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('eden-chapters','eden-chapters',false,15728640,array['text/html','text/plain'])
on conflict(id) do update set
 public=false,
 file_size_limit=15728640,
 allowed_mime_types=array['text/html','text/plain'];

-- Replace any existing policies specifically targeting this bucket so an
-- older broad authenticated-read policy cannot expose unreleased manuscripts.
do $$
declare policy_row record;
begin
 for policy_row in
  select policyname
  from pg_policies
  where schemaname='storage' and tablename='objects'
    and (
      coalesce(qual,'') ilike '%eden-chapters%'
      or coalesce(with_check,'') ilike '%eden-chapters%'
    )
 loop
  execute format('drop policy if exists %I on storage.objects',policy_row.policyname);
 end loop;
end $$;

create policy "Moderators upload Eden chapter files"
on storage.objects for insert to authenticated
with check(bucket_id='eden-chapters' and public.is_reader_moderator());

create policy "Moderators replace Eden chapter files"
on storage.objects for update to authenticated
using(bucket_id='eden-chapters' and public.is_reader_moderator())
with check(bucket_id='eden-chapters' and public.is_reader_moderator());

create policy "Moderators remove Eden chapter files"
on storage.objects for delete to authenticated
using(bucket_id='eden-chapters' and public.is_reader_moderator());

create or replace function public.can_read_eden_chapter_storage_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $
 select public.is_reader_moderator()
   or exists(
    select 1 from public.eden_book_chapters c
    where c.chapter_id || '.html'=p_object_name
      and c.is_published=true
      and c.released_at is not null
      and c.released_at<=now()
   );
$;
revoke all on function public.can_read_eden_chapter_storage_object(text) from public,anon;
grant execute on function public.can_read_eden_chapter_storage_object(text) to authenticated;

create policy "Readers download released Eden chapters"
on storage.objects for select to authenticated
using(bucket_id='eden-chapters' and public.can_read_eden_chapter_storage_object(storage.objects.name));

-- Public directory metadata only. Manuscript text and unreleased Companion
-- references are never returned by this function.
create or replace function public.get_public_eden_book_structure()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
 select jsonb_build_object(
  'parts',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',p.part_id,'title',p.title
   ) order by p.sort_order)
   from public.eden_book_parts p
   where p.is_published=true
  ),'[]'::jsonb),
  'chapters',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',c.chapter_id,
    'number',c.chapter_number,
    'title',c.title,
    'partId',c.part_id,
    'available',(c.released_at is not null and c.released_at <= now()),
    'companionTerms',case
      when c.released_at is not null and c.released_at <= now()
      then c.companion_terms else '[]'::jsonb end
   ) order by p.sort_order,c.sort_order)
   from public.eden_book_chapters c
   join public.eden_book_parts p on p.part_id=c.part_id
   where c.is_published=true and p.is_published=true
  ),'[]'::jsonb)
 );
$$;

create or replace function public.get_moderator_eden_book_structure()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return jsonb_build_object(
  'parts',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.part_id,'title',p.title,'sortOrder',p.sort_order,'published',p.is_published
   ) order by p.sort_order),'[]'::jsonb) from public.eden_book_parts p),
  'chapters',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.chapter_id,'number',c.chapter_number,'title',c.title,'partId',c.part_id,
    'sortOrder',c.sort_order,'published',c.is_published,'releasedAt',c.released_at,
    'companionTerms',c.companion_terms,
    'hasFile',exists(select 1 from storage.objects o
      where o.bucket_id='eden-chapters' and o.name=c.chapter_id||'.html')
   ) order by p.sort_order,c.sort_order),'[]'::jsonb)
   from public.eden_book_chapters c
   join public.eden_book_parts p on p.part_id=c.part_id)
 );
end;
$$;

create or replace function public.save_moderator_eden_part(
 p_part_id text,
 p_title text,
 p_sort_order integer default 0,
 p_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_part_id is null or p_part_id !~ '^[a-z0-9-]{1,40}$' then raise exception 'Part ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>100 then raise exception 'Enter a Part title of 1–100 characters'; end if;
 insert into public.eden_book_parts(part_id,title,sort_order,is_published,updated_at)
 values(p_part_id,trim(p_title),coalesce(p_sort_order,0),coalesce(p_published,true),now())
 on conflict(part_id) do update set
  title=excluded.title,sort_order=excluded.sort_order,
  is_published=excluded.is_published,updated_at=now();
 return jsonb_build_object('success',true,'part_id',p_part_id);
end;
$$;

create or replace function public.save_moderator_eden_chapter(
 p_chapter_id text,
 p_chapter_number text,
 p_title text,
 p_part_id text,
 p_sort_order integer default 0,
 p_is_published boolean default true,
 p_released_at timestamptz default null,
 p_companion_terms jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_exists boolean;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_chapter_id is null or p_chapter_id !~ '^[a-z0-9-]{1,80}$' then raise exception 'Chapter ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_chapter_number),'') is null or char_length(trim(p_chapter_number))>40 then raise exception 'Enter a valid chapter number'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>160 then raise exception 'Enter a chapter title of 1–160 characters'; end if;
 if not exists(select 1 from public.eden_book_parts where part_id=p_part_id) then raise exception 'Choose a valid Part'; end if;
 if p_companion_terms is null or jsonb_typeof(p_companion_terms)<>'array' then raise exception 'Companion references must be a JSON array'; end if;
 if p_released_at is not null then
  select exists(select 1 from storage.objects where bucket_id='eden-chapters' and name=p_chapter_id||'.html') into v_exists;
  if not v_exists then raise exception 'Upload the chapter HTML file before setting a release date'; end if;
 end if;
 insert into public.eden_book_chapters
  (chapter_id,chapter_number,title,part_id,sort_order,is_published,released_at,companion_terms,updated_at)
 values
  (p_chapter_id,trim(p_chapter_number),trim(p_title),p_part_id,coalesce(p_sort_order,0),
   coalesce(p_is_published,true),p_released_at,p_companion_terms,now())
 on conflict(chapter_id) do update set
  chapter_number=excluded.chapter_number,title=excluded.title,part_id=excluded.part_id,
  sort_order=excluded.sort_order,is_published=excluded.is_published,
  released_at=excluded.released_at,companion_terms=excluded.companion_terms,updated_at=now();
 return jsonb_build_object('success',true,'chapter_id',p_chapter_id);
end;
$$;

create or replace function public.archive_moderator_eden_chapter(p_chapter_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 update public.eden_book_chapters
 set is_published=false,updated_at=now()
 where chapter_id=p_chapter_id;
 if not found then raise exception 'Chapter not found'; end if;
 return jsonb_build_object('success',true,'chapter_id',p_chapter_id);
end;
$$;

revoke all on function public.get_public_eden_book_structure() from public;
revoke all on function public.get_moderator_eden_book_structure() from public,anon;
revoke all on function public.save_moderator_eden_part(text,text,integer,boolean) from public,anon;
revoke all on function public.save_moderator_eden_chapter(text,text,text,text,integer,boolean,timestamptz,jsonb) from public,anon;
revoke all on function public.archive_moderator_eden_chapter(text) from public,anon;

grant execute on function public.get_public_eden_book_structure() to anon,authenticated;
grant execute on function public.get_moderator_eden_book_structure() to authenticated;
grant execute on function public.save_moderator_eden_part(text,text,integer,boolean) to authenticated;
grant execute on function public.save_moderator_eden_chapter(text,text,text,text,integer,boolean,timestamptz,jsonb) to authenticated;
grant execute on function public.archive_moderator_eden_chapter(text) to authenticated;

-- Verification: these should all be enabled by row-level security.
select tablename,rowsecurity
from pg_tables
where schemaname='public'
 and tablename in ('eden_book_parts','eden_book_chapters')
order by tablename;
