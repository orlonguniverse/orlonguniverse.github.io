-- ORLONG STAGE 8D.7 — UNIVERSAL MULTI-BOOK READING SYSTEM
-- Additive migration. Keeps the existing Eden chapter tables, bucket,
-- reader progress, and engagement data intact.
begin;

create table if not exists public.orlong_book_parts (
  book_key text not null references public.orlong_books(book_key) on update cascade on delete cascade,
  part_id text not null check (part_id ~ '^[a-z0-9-]{1,40}$'),
  title text not null check (char_length(trim(title)) between 1 and 100),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(book_key,part_id)
);

create table if not exists public.orlong_book_chapters (
  book_key text not null,
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  chapter_number text not null check (char_length(trim(chapter_number)) between 1 and 40),
  title text not null check (char_length(trim(title)) between 1 and 160),
  part_id text not null,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  released_at timestamptz,
  companion_terms jsonb not null default '[]'::jsonb check (jsonb_typeof(companion_terms)='array'),
  required_access_key text check (required_access_key is null or required_access_key ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  updated_at timestamptz not null default now(),
  primary key(book_key,chapter_id),
  constraint orlong_book_chapter_part_fk foreign key(book_key,part_id)
    references public.orlong_book_parts(book_key,part_id) on update cascade on delete cascade
);
create index if not exists orlong_book_chapters_order_idx
  on public.orlong_book_chapters(book_key,part_id,sort_order);
alter table public.orlong_book_parts enable row level security;
alter table public.orlong_book_chapters enable row level security;
revoke all on public.orlong_book_parts from anon,authenticated;
revoke all on public.orlong_book_chapters from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('orlong-book-chapters','orlong-book-chapters',false,15728640,array['text/html','text/plain'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['text/html','text/plain'];

do $$
declare p record;
begin
 for p in select policyname from pg_policies
  where schemaname='storage' and tablename='objects'
   and (coalesce(qual,'') ilike '%orlong-book-chapters%' or coalesce(with_check,'') ilike '%orlong-book-chapters%')
 loop execute format('drop policy if exists %I on storage.objects',p.policyname); end loop;
end $$;

create or replace function public.can_read_orlong_book_chapter(p_object_name text)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select public.is_reader_moderator() or exists(
  select 1 from public.orlong_book_chapters c
  join public.orlong_book_parts p on p.book_key=c.book_key and p.part_id=c.part_id
  join public.orlong_books b on b.book_key=c.book_key
  where p_object_name=c.book_key||'/'||c.chapter_id||'.html'
   and b.is_published=true and c.is_published=true and p.is_published=true
   and c.released_at is not null and c.released_at<=now()
   and (c.required_access_key is null or exists(
    select 1 from public.reader_access_grants g
    where g.user_id=auth.uid() and g.access_key=c.required_access_key
   ))
 );
$$;
revoke all on function public.can_read_orlong_book_chapter(text) from public,anon;
grant execute on function public.can_read_orlong_book_chapter(text) to authenticated;

create policy "Orlong moderators upload universal book chapters"
on storage.objects for insert to authenticated
with check(bucket_id='orlong-book-chapters' and public.is_reader_moderator());
create policy "Orlong moderators replace universal book chapters"
on storage.objects for update to authenticated
using(bucket_id='orlong-book-chapters' and public.is_reader_moderator())
with check(bucket_id='orlong-book-chapters' and public.is_reader_moderator());
create policy "Orlong moderators remove universal book chapters"
on storage.objects for delete to authenticated
using(bucket_id='orlong-book-chapters' and public.is_reader_moderator());
create policy "Readers download released universal book chapters"
on storage.objects for select to authenticated
using(bucket_id='orlong-book-chapters' and public.can_read_orlong_book_chapter(storage.objects.name));

-- Canonical shared pages are used for every book except the original Eden reader.
create or replace function public.get_public_orlong_books()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',book_key,'series',series_key,'title',title,'seriesName',series_name,
  'house',house_name,'bookLabel',book_label,'description',description,'theme',theme,
  'readerUrl',case when book_key='trials-of-eden' then reader_url else '/reading-room/?book='||book_key end,
  'contentsUrl',case when book_key='trials-of-eden' then contents_url else '/reading-room/contents.html?book='||book_key end,
  'order',sort_order,'showInReaderSwitcher',show_in_reader_switcher
 ) order by sort_order,title),'[]'::jsonb)
 from public.orlong_books where is_published=true;
$$;

create or replace function public.get_public_orlong_book_structure(p_book_key text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
declare v_book jsonb;
begin
 select jsonb_build_object(
  'id',b.book_key,'title',b.title,'series',b.series_key,'seriesName',b.series_name,
  'house',b.house_name,'bookLabel',b.book_label,'description',b.description,'theme',b.theme,
  'readerUrl','/reading-room/?book='||b.book_key,
  'contentsUrl','/reading-room/contents.html?book='||b.book_key,
  'showInReaderSwitcher',b.show_in_reader_switcher
 ) into v_book from public.orlong_books b
 where b.book_key=p_book_key and b.is_published=true and b.book_key<>'trials-of-eden';
 if v_book is null then raise exception 'This Reading Room is not available'; end if;
 return v_book || jsonb_build_object(
  'parts',coalesce((select jsonb_agg(jsonb_build_object('id',p.part_id,'title',p.title) order by p.sort_order)
   from public.orlong_book_parts p where p.book_key=p_book_key and p.is_published=true),'[]'::jsonb),
  'chapters',coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.chapter_id,'number',c.chapter_number,'title',c.title,'partId',c.part_id,
   'available',(c.released_at is not null and c.released_at<=now()
    and (c.required_access_key is null or exists(select 1 from public.reader_access_grants g where g.user_id=auth.uid() and g.access_key=c.required_access_key))),
   'accessLocked',(c.released_at is not null and c.released_at<=now() and c.required_access_key is not null
    and not exists(select 1 from public.reader_access_grants g where g.user_id=auth.uid() and g.access_key=c.required_access_key)),
   'companionTerms',case when c.released_at is not null and c.released_at<=now()
    and (c.required_access_key is null or exists(select 1 from public.reader_access_grants g where g.user_id=auth.uid() and g.access_key=c.required_access_key))
    then c.companion_terms else '[]'::jsonb end
  ) order by p.sort_order,c.sort_order)
  from public.orlong_book_chapters c join public.orlong_book_parts p on p.book_key=c.book_key and p.part_id=c.part_id
  where c.book_key=p_book_key and c.is_published=true and p.is_published=true),'[]'::jsonb)
 );
end;
$$;

create or replace function public.get_moderator_orlong_book_structure(p_book_key text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if not exists(select 1 from public.orlong_books where book_key=p_book_key and book_key<>'trials-of-eden') then raise exception 'Choose a non-Eden book'; end if;
 return jsonb_build_object(
  'parts',(select coalesce(jsonb_agg(jsonb_build_object('id',p.part_id,'title',p.title,'sortOrder',p.sort_order,'published',p.is_published) order by p.sort_order),'[]'::jsonb) from public.orlong_book_parts p where p.book_key=p_book_key),
  'chapters',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',c.chapter_id,'number',c.chapter_number,'title',c.title,'partId',c.part_id,'sortOrder',c.sort_order,
   'published',c.is_published,'releasedAt',c.released_at,'companionTerms',c.companion_terms,
   'requiredAccessKey',c.required_access_key,
   'hasFile',exists(select 1 from storage.objects o where o.bucket_id='orlong-book-chapters' and o.name=c.book_key||'/'||c.chapter_id||'.html')
  ) order by p.sort_order,c.sort_order),'[]'::jsonb)
  from public.orlong_book_chapters c join public.orlong_book_parts p on p.book_key=c.book_key and p.part_id=c.part_id where c.book_key=p_book_key)
 );
end;
$$;

create or replace function public.save_moderator_orlong_book_part(
 p_book_key text,p_part_id text,p_title text,p_sort_order integer default 0,p_published boolean default true
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if not exists(select 1 from public.orlong_books where book_key=p_book_key and book_key<>'trials-of-eden') then raise exception 'Choose a non-Eden book'; end if;
 if p_part_id is null or p_part_id !~ '^[a-z0-9-]{1,40}$' then raise exception 'Part ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>100 then raise exception 'Enter a Part title of 1–100 characters'; end if;
 insert into public.orlong_book_parts(book_key,part_id,title,sort_order,is_published,updated_at)
 values(p_book_key,p_part_id,trim(p_title),coalesce(p_sort_order,0),coalesce(p_published,true),now())
 on conflict(book_key,part_id) do update set title=excluded.title,sort_order=excluded.sort_order,is_published=excluded.is_published,updated_at=now();
 return jsonb_build_object('success',true);
end;
$$;

create or replace function public.save_moderator_orlong_book_chapter(
 p_book_key text,p_chapter_id text,p_chapter_number text,p_title text,p_part_id text,
 p_sort_order integer default 0,p_is_published boolean default true,p_released_at timestamptz default null,
 p_companion_terms jsonb default '[]'::jsonb,p_required_access_key text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_exists boolean;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if not exists(select 1 from public.orlong_books where book_key=p_book_key and book_key<>'trials-of-eden') then raise exception 'Choose a non-Eden book'; end if;
 if p_chapter_id is null or p_chapter_id !~ '^[a-z0-9-]{1,80}$' then raise exception 'Chapter ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_chapter_number),'') is null or char_length(trim(p_chapter_number))>40 then raise exception 'Enter a valid chapter number'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>160 then raise exception 'Enter a chapter title of 1–160 characters'; end if;
 if not exists(select 1 from public.orlong_book_parts where book_key=p_book_key and part_id=p_part_id) then raise exception 'Choose a valid Part'; end if;
 if p_companion_terms is null or jsonb_typeof(p_companion_terms)<>'array' then raise exception 'Companion references must be a JSON array'; end if;
 if p_required_access_key is not null and p_required_access_key !~ '^[a-z0-9][a-z0-9:_-]{0,79}$' then raise exception 'Access permission key is invalid'; end if;
 if p_released_at is not null then
  select exists(select 1 from storage.objects where bucket_id='orlong-book-chapters' and name=p_book_key||'/'||p_chapter_id||'.html') into v_exists;
  if not v_exists then raise exception 'Upload the chapter HTML file before setting a release date'; end if;
 end if;
 insert into public.orlong_book_chapters(book_key,chapter_id,chapter_number,title,part_id,sort_order,is_published,released_at,companion_terms,required_access_key,updated_at)
 values(p_book_key,p_chapter_id,trim(p_chapter_number),trim(p_title),p_part_id,coalesce(p_sort_order,0),coalesce(p_is_published,true),p_released_at,p_companion_terms,nullif(trim(p_required_access_key),''),now())
 on conflict(book_key,chapter_id) do update set chapter_number=excluded.chapter_number,title=excluded.title,part_id=excluded.part_id,
  sort_order=excluded.sort_order,is_published=excluded.is_published,released_at=excluded.released_at,
  companion_terms=excluded.companion_terms,required_access_key=excluded.required_access_key,updated_at=now();
 return jsonb_build_object('success',true);
end;
$$;

create or replace function public.archive_moderator_orlong_book_chapter(p_book_key text,p_chapter_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 update public.orlong_book_chapters set is_published=false,updated_at=now()
 where book_key=p_book_key and chapter_id=p_chapter_id;
 if not found then raise exception 'Chapter not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_book_structure(text) from public;
revoke all on function public.get_moderator_orlong_book_structure(text) from public,anon;
revoke all on function public.save_moderator_orlong_book_part(text,text,text,integer,boolean) from public,anon;
revoke all on function public.save_moderator_orlong_book_chapter(text,text,text,text,text,integer,boolean,timestamptz,jsonb,text) from public,anon;
revoke all on function public.archive_moderator_orlong_book_chapter(text,text) from public,anon;
grant execute on function public.get_public_orlong_book_structure(text) to anon,authenticated;
grant execute on function public.get_moderator_orlong_book_structure(text) to authenticated;
grant execute on function public.save_moderator_orlong_book_part(text,text,text,integer,boolean) to authenticated;
grant execute on function public.save_moderator_orlong_book_chapter(text,text,text,text,text,integer,boolean,timestamptz,jsonb,text) to authenticated;
grant execute on function public.archive_moderator_orlong_book_chapter(text,text) to authenticated;


-- Give every newly created non-Eden book a ready-to-use ten-Part structure.
create or replace function public.seed_default_orlong_book_parts()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $
begin
 if new.book_key<>'trials-of-eden' then
  insert into public.orlong_book_parts(book_key,part_id,title,sort_order,is_published)
  select new.book_key,'part-'||lpad(n::text,2,'0'),'Part '||
   (case n when 1 then 'One' when 2 then 'Two' when 3 then 'Three' when 4 then 'Four' when 5 then 'Five' when 6 then 'Six' when 7 then 'Seven' when 8 then 'Eight' when 9 then 'Nine' else 'Ten' end),n,true
  from generate_series(1,10) n
  on conflict(book_key,part_id) do nothing;
 end if;
 return new;
end;
$;
drop trigger if exists seed_default_orlong_book_parts_trigger on public.orlong_books;
create trigger seed_default_orlong_book_parts_trigger
after insert on public.orlong_books
for each row execute function public.seed_default_orlong_book_parts();

-- Backfill books that were created before this migration, without changing Eden.
insert into public.orlong_book_parts(book_key,part_id,title,sort_order,is_published)
select b.book_key,'part-'||lpad(n::text,2,'0'),'Part '||
 (case n when 1 then 'One' when 2 then 'Two' when 3 then 'Three' when 4 then 'Four' when 5 then 'Five' when 6 then 'Six' when 7 then 'Seven' when 8 then 'Eight' when 9 then 'Nine' else 'Ten' end),n,true
from public.orlong_books b cross join generate_series(1,10) n
where b.book_key<>'trials-of-eden'
on conflict(book_key,part_id) do nothing;

commit;
