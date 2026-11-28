-- ORLONG STAGE 8D.3E — MANAGED PAGES
-- Creates reader-facing pages from safe, structured content blocks.
create table if not exists public.orlong_managed_pages (
 page_id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null,
 description text not null default '',
 content jsonb not null default '{"blocks":[]}'::jsonb,
 is_published boolean not null default false,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.orlong_managed_pages enable row level security;
revoke all on public.orlong_managed_pages from anon,authenticated;

create or replace function public.get_public_orlong_managed_page(p_slug text)
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select jsonb_build_object('slug',slug,'title',title,'description',description,'content',content)
 from public.orlong_managed_pages
 where slug=p_slug and is_published=true
 limit 1;
$$;

create or replace function public.get_moderator_orlong_managed_pages()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',page_id,'slug',slug,'title',title,'description',description,
  'content',content,'published',is_published,'sortOrder',sort_order,
  'updatedAt',updated_at
 ) order by sort_order,title) from public.orlong_managed_pages),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_managed_page(
 p_page_id uuid,
 p_slug text,
 p_title text,
 p_description text,
 p_content jsonb,
 p_is_published boolean default false,
 p_sort_order integer default 0
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
 v_block jsonb;
 v_type text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 p_slug:=lower(trim(coalesce(p_slug,'')));
 if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug)>70 then raise exception 'Use a short page address with lowercase letters, numbers and hyphens only'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 140 then raise exception 'Enter a page title'; end if;
 if length(coalesce(p_description,''))>500 then raise exception 'The page description is too long'; end if;
 if p_content is null or jsonb_typeof(p_content) is distinct from 'object' or jsonb_typeof(p_content->'blocks') is distinct from 'array' then raise exception 'Page content must contain a list of content blocks'; end if;
 if jsonb_array_length(p_content->'blocks')>100 or length(p_content::text)>150000 then raise exception 'This page contains too much content'; end if;
 for v_block in select value from jsonb_array_elements(p_content->'blocks') loop
  v_type:=v_block->>'type';
  if v_type not in ('heading','text','callout','accordion','image','button','divider') then raise exception 'This page contains an unsupported content block'; end if;
  if length(coalesce(v_block->>'text',''))>12000 or length(coalesce(v_block->>'title',''))>500 or length(coalesce(v_block->>'caption',''))>1000 then raise exception 'A content block is too long'; end if;
  if v_type in ('image','button') and coalesce(v_block->>'url','') !~ '^(https://|http://|/|#)' then raise exception 'Images and buttons need a safe web or relative address'; end if;
  if v_type='accordion' and (jsonb_typeof(v_block->'items') is distinct from 'array' or jsonb_array_length(v_block->'items')>20) then raise exception 'A collapsible section needs a valid list of up to 20 items'; end if;
 end loop;
 if p_page_id is null then
  insert into public.orlong_managed_pages(slug,title,description,content,is_published,sort_order,created_by,updated_by)
  values(p_slug,trim(p_title),coalesce(p_description,''),p_content,coalesce(p_is_published,false),coalesce(p_sort_order,0),auth.uid(),auth.uid())
  returning page_id into p_page_id;
 else
  update public.orlong_managed_pages set slug=p_slug,title=trim(p_title),description=coalesce(p_description,''),
   content=p_content,is_published=coalesce(p_is_published,false),sort_order=coalesce(p_sort_order,0),
   updated_by=auth.uid(),updated_at=now()
  where page_id=p_page_id;
  if not found then raise exception 'The page could not be found'; end if;
 end if;
 return jsonb_build_object('success',true,'page_id',p_page_id,'slug',p_slug);
end;
$$;

create or replace function public.delete_moderator_orlong_managed_page(p_page_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 delete from public.orlong_managed_pages where page_id=p_page_id;
 if not found then raise exception 'The page could not be found'; end if;
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_managed_page(text) from public;
revoke all on function public.get_moderator_orlong_managed_pages() from public,anon;
revoke all on function public.save_moderator_orlong_managed_page(uuid,text,text,text,jsonb,boolean,integer) from public,anon;
revoke all on function public.delete_moderator_orlong_managed_page(uuid) from public,anon;
grant execute on function public.get_public_orlong_managed_page(text) to anon,authenticated;
grant execute on function public.get_moderator_orlong_managed_pages() to authenticated;
grant execute on function public.save_moderator_orlong_managed_page(uuid,text,text,text,jsonb,boolean,integer) to authenticated;
grant execute on function public.delete_moderator_orlong_managed_page(uuid) to authenticated;
