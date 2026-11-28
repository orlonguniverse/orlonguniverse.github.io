-- ORLONG STAGE 8D.6 — BOOK CATALOGUE AND READING ROOM REGISTRY
-- Run once in the Supabase SQL Editor. Existing Eden content is registered below.
create table if not exists public.orlong_books (
  book_id uuid primary key default gen_random_uuid(),
  book_key text not null unique,
  series_key text not null,
  title text not null,
  series_name text not null default '',
  house_name text not null default '',
  book_label text not null default '',
  description text not null default '',
  theme text not null default 'blue' check (theme in ('blue','red','orange','purple','yellow','black')),
  reader_url text not null,
  contents_url text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  show_in_reader_switcher boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (book_key ~ '^[a-z0-9-]{2,80}$'),
  check (series_key ~ '^[a-z0-9-]{2,80}$'),
  check (length(trim(title)) between 1 and 160),
  check (length(trim(reader_url)) between 1 and 300),
  check (reader_url ~ '^/[A-Za-z0-9_./-]*$' and reader_url not like '%..%'),
  check (contents_url = '' or (contents_url ~ '^/[A-Za-z0-9_./-]*$' and contents_url not like '%..%'))
);
create index if not exists orlong_books_public_order_idx on public.orlong_books(is_published,sort_order,created_at);
alter table public.orlong_books enable row level security;
revoke all on public.orlong_books from public,anon,authenticated;

insert into public.orlong_books(book_key,series_key,title,series_name,house_name,book_label,description,theme,reader_url,contents_url,sort_order,is_published,show_in_reader_switcher)
values('trials-of-eden','eden','The Trials of Eden','Eden Trilogy','House Blue Eel','EDEN TRILOGY · BOOK ONE','Twenty contestants enter a competition built to test the limits of human potential.','blue','/books/trials-of-eden/','/books/trials-of-eden/contents.html',0,true,false)
on conflict(book_key) do update set
 title=excluded.title,series_key=excluded.series_key,series_name=excluded.series_name,house_name=excluded.house_name,
 book_label=excluded.book_label,description=excluded.description,theme=excluded.theme,
 reader_url=excluded.reader_url,contents_url=excluded.contents_url,sort_order=excluded.sort_order,
 is_published=true,updated_at=now();

create or replace function public.get_public_orlong_books()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',book_key,'series',series_key,'title',title,'seriesName',series_name,
  'house',house_name,'bookLabel',book_label,'description',description,'theme',theme,
  'readerUrl',reader_url,'contentsUrl',contents_url,'order',sort_order,
  'showInReaderSwitcher',show_in_reader_switcher
 ) order by sort_order,title),'[]'::jsonb)
 from public.orlong_books where is_published=true;
$$;

create or replace function public.get_moderator_orlong_books()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',book_id,'key',book_key,'series',series_key,'title',title,'seriesName',series_name,
  'house',house_name,'bookLabel',book_label,'description',description,'theme',theme,
  'readerUrl',reader_url,'contentsUrl',contents_url,'order',sort_order,
  'published',is_published,'showInReaderSwitcher',show_in_reader_switcher
 ) order by sort_order,title) from public.orlong_books),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_book(
 p_id uuid,p_key text,p_series text,p_title text,p_series_name text,p_house text,
 p_book_label text,p_description text,p_theme text,p_reader_url text,p_contents_url text,
 p_order integer,p_published boolean,p_show_in_reader_switcher boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid:=p_id;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if coalesce(p_key,'') !~ '^[a-z0-9-]{2,80}$' then raise exception 'Use a lowercase book ID with letters, numbers and hyphens'; end if;
 if coalesce(p_series,'') !~ '^[a-z0-9-]{2,80}$' then raise exception 'Use a lowercase series ID with letters, numbers and hyphens'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 160 then raise exception 'Enter a book title'; end if;
 if p_theme not in ('blue','red','orange','purple','yellow','black') then raise exception 'Choose a valid Orlong theme'; end if;
 if coalesce(p_reader_url,'') !~ '^/[A-Za-z0-9_./-]*$' or p_reader_url like '%..%' then raise exception 'The Reading Room URL must be a safe internal website path'; end if;
 if coalesce(p_contents_url,'')<>'' and (p_contents_url !~ '^/[A-Za-z0-9_./-]*$' or p_contents_url like '%..%') then raise exception 'The contents URL must be a safe internal website path'; end if;
 if length(coalesce(p_description,''))>1200 or length(coalesce(p_house,''))>100 or length(coalesce(p_series_name,''))>100 or length(coalesce(p_book_label,''))>120 then raise exception 'One of the book details is too long'; end if;
 if v_id is null then
  insert into public.orlong_books(book_key,series_key,title,series_name,house_name,book_label,description,theme,reader_url,contents_url,sort_order,is_published,show_in_reader_switcher)
  values(p_key,p_series,trim(p_title),coalesce(p_series_name,''),coalesce(p_house,''),coalesce(p_book_label,''),coalesce(p_description,''),p_theme,p_reader_url,coalesce(p_contents_url,''),coalesce(p_order,0),coalesce(p_published,false),coalesce(p_show_in_reader_switcher,false))
  returning book_id into v_id;
 else
  update public.orlong_books set book_key=p_key,series_key=p_series,title=trim(p_title),series_name=coalesce(p_series_name,''),
   house_name=coalesce(p_house,''),book_label=coalesce(p_book_label,''),description=coalesce(p_description,''),
   theme=p_theme,reader_url=p_reader_url,contents_url=coalesce(p_contents_url,''),sort_order=coalesce(p_order,0),
   is_published=coalesce(p_published,false),show_in_reader_switcher=coalesce(p_show_in_reader_switcher,false),updated_at=now()
  where book_id=v_id;
  if not found then raise exception 'Book not found'; end if;
 end if;
 return jsonb_build_object('success',true,'id',v_id);
end;
$$;

create or replace function public.delete_moderator_orlong_book(p_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if exists(select 1 from public.orlong_books where book_id=p_id and book_key='trials-of-eden') then
  raise exception 'The live Trials of Eden entry is protected. Hide it instead of deleting it.';
 end if;
 delete from public.orlong_books where book_id=p_id;
 if not found then raise exception 'Book not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_books() from public;
grant execute on function public.get_public_orlong_books() to anon,authenticated;
revoke all on function public.get_moderator_orlong_books() from public,anon;
grant execute on function public.get_moderator_orlong_books() to authenticated;
revoke all on function public.save_moderator_orlong_book(uuid,text,text,text,text,text,text,text,text,text,text,integer,boolean,boolean) from public,anon;
grant execute on function public.save_moderator_orlong_book(uuid,text,text,text,text,text,text,text,text,text,text,integer,boolean,boolean) to authenticated;
revoke all on function public.delete_moderator_orlong_book(uuid) from public,anon;
grant execute on function public.delete_moderator_orlong_book(uuid) to authenticated;
