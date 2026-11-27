-- ORLONG STAGE 8D.3 — UNIVERSAL WEBSITE CONTENT CONTROL
-- Allows moderators to visually edit safe text, links and image sources across every page.
create table if not exists public.orlong_site_content (
 content_id uuid primary key default gen_random_uuid(),
 page_path text not null check (page_path ~ '^/[A-Za-z0-9_./-]*$' and length(page_path)<=240),
 selector text not null check (length(trim(selector)) between 1 and 500),
 property text not null check (property in ('text','href','src','alt','title','placeholder')),
 content_value text not null check (length(content_value)<=12000),
 is_published boolean not null default true,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(page_path,selector,property)
);
create index if not exists orlong_site_content_page_idx on public.orlong_site_content(page_path,is_published);
alter table public.orlong_site_content enable row level security;
revoke all on public.orlong_site_content from anon,authenticated;

create or replace function public.get_public_orlong_site_content(p_page_path text)
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object('selector',selector,'property',property,'value',content_value)), '[]'::jsonb)
 from public.orlong_site_content
 where page_path=p_page_path and is_published=true;
$$;

create or replace function public.get_moderator_orlong_site_content()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',content_id,'pagePath',page_path,'selector',selector,'property',property,
  'value',content_value,'published',is_published,'updatedAt',updated_at
 ) order by page_path,selector,property) from public.orlong_site_content),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_site_content(
 p_page_path text,p_selector text,p_property text,p_content_value text,p_is_published boolean default true
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_value text:=coalesce(p_content_value,'');
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_page_path is null or p_page_path !~ '^/[A-Za-z0-9_./-]*$' or length(p_page_path)>240 then raise exception 'Invalid page path'; end if;
 if p_selector is null or length(trim(p_selector))<1 or length(p_selector)>500 then raise exception 'Enter a valid CSS selector'; end if;
 if p_property not in ('text','href','src','alt','title','placeholder') then raise exception 'Unsupported content property'; end if;
 if length(v_value)>12000 then raise exception 'Content is too long'; end if;
 if p_property in ('href','src') and v_value<>'' and v_value !~ '^(https://|http://|/|#|mailto:|tel:)' then
  raise exception 'Links and images must use a safe web, relative, anchor, email or telephone URL';
 end if;
 insert into public.orlong_site_content(page_path,selector,property,content_value,is_published,updated_by,updated_at)
 values(p_page_path,trim(p_selector),p_property,v_value,coalesce(p_is_published,true),auth.uid(),now())
 on conflict(page_path,selector,property) do update set
  content_value=excluded.content_value,is_published=excluded.is_published,updated_by=auth.uid(),updated_at=now();
 return jsonb_build_object('success',true);
end;
$$;

create or replace function public.delete_moderator_orlong_site_content(p_content_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 delete from public.orlong_site_content where content_id=p_content_id;
 if not found then raise exception 'Content override not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_site_content(text) from public;
revoke all on function public.get_moderator_orlong_site_content() from public,anon;
revoke all on function public.save_moderator_orlong_site_content(text,text,text,text,boolean) from public,anon;
revoke all on function public.delete_moderator_orlong_site_content(uuid) from public,anon;
grant execute on function public.get_public_orlong_site_content(text) to anon,authenticated;
grant execute on function public.get_moderator_orlong_site_content() to authenticated;
grant execute on function public.save_moderator_orlong_site_content(text,text,text,text,boolean) to authenticated;
grant execute on function public.delete_moderator_orlong_site_content(uuid) to authenticated;
