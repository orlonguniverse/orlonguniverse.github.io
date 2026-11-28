-- ORLONG STAGE 8D.12 — INDEPENDENT HOMEPAGE FEATURED-BOOK FEED
-- A featured title may be shown as a coming-soon teaser without publishing its Reading Room.
begin;

alter table public.orlong_books
  add column if not exists show_on_homepage boolean not null default false;

-- Keep Eden featured and allow The Promise of Arcanet to be teased on the homepage.
-- This deliberately does NOT change is_published for either title.
update public.orlong_books
set show_on_homepage = true
where book_key = 'trials-of-eden';

update public.orlong_books
set show_on_homepage = true
where lower(title) = lower('The Promise of Arcanet');

create or replace function public.get_public_orlong_homepage_books()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.book_key,
        'series', b.series_key,
        'title', b.title,
        'seriesName', b.series_name,
        'house', b.house_name,
        'bookLabel', b.book_label,
        'description', b.description,
        'theme', b.theme,
        'readerUrl', case
          when b.book_key = 'trials-of-eden' then b.reader_url
          else '/reading-room/?book=' || b.book_key
        end,
        'contentsUrl', case
          when b.book_key = 'trials-of-eden' then b.contents_url
          else '/reading-room/contents.html?book=' || b.book_key
        end,
        'order', b.sort_order,
        'showOnHomepage', b.show_on_homepage,
        'isPublished', b.is_published
      )
      order by b.sort_order, b.title
    ),
    '[]'::jsonb
  )
  from public.orlong_books b
  where b.show_on_homepage = true;
$$;

revoke all on function public.get_public_orlong_homepage_books() from public;
grant execute on function public.get_public_orlong_homepage_books() to anon, authenticated;

commit;
