-- ORLONG STAGE 8D.8 — BOOK COLLECTION, HOMEPAGE FEATURES AND FLEXIBLE PARTS
begin;
alter table public.orlong_books add column if not exists show_on_homepage boolean not null default false;
update public.orlong_books set show_on_homepage=true where book_key='trials-of-eden';
create or replace function public.get_public_orlong_books()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',book_key,'series',series_key,'title',title,'seriesName',series_name,
  'house',house_name,'bookLabel',book_label,'description',description,'theme',theme,
  'readerUrl',case when book_key='trials-of-eden' then reader_url else '/reading-room/?book='||book_key end,
  'contentsUrl',case when book_key='trials-of-eden' then contents_url else '/reading-room/contents.html?book='||book_key end,
  'order',sort_order,'showInReaderSwitcher',show_in_reader_switcher,'showOnHomepage',show_on_homepage
 ) order by sort_order,title),'[]'::jsonb)
 from public.orlong_books where is_published=true;
$$;
create or replace function public.get_moderator_orlong_homepage_books()
returns table(book_key text,show_on_homepage boolean)
language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return query select b.book_key,b.show_on_homepage from public.orlong_books b;
end;
$$;
create or replace function public.set_moderator_orlong_homepage_feature(p_book_key text,p_show_on_homepage boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 update public.orlong_books set show_on_homepage=coalesce(p_show_on_homepage,false) where book_key=p_book_key;
 if not found then raise exception 'Book not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;
create or replace function public.delete_moderator_orlong_book_part(p_book_key text,p_part_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if exists(select 1 from public.orlong_book_chapters where book_key=p_book_key and part_id=p_part_id) then
  raise exception 'This Part still contains chapters. Move those chapters to another Part before removing it.';
 end if;
 delete from public.orlong_book_parts where book_key=p_book_key and part_id=p_part_id;
 if not found then raise exception 'Part not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;
revoke all on function public.get_moderator_orlong_homepage_books() from public,anon;
revoke all on function public.set_moderator_orlong_homepage_feature(text,boolean) from public,anon;
revoke all on function public.delete_moderator_orlong_book_part(text,text) from public,anon;
grant execute on function public.get_public_orlong_books() to anon,authenticated;
grant execute on function public.get_moderator_orlong_homepage_books() to authenticated;
grant execute on function public.set_moderator_orlong_homepage_feature(text,boolean) to authenticated;
grant execute on function public.delete_moderator_orlong_book_part(text,text) to authenticated;
commit;
