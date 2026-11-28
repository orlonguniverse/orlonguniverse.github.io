-- ORLONG STAGE 8D.3C — WEBSITE MAP AND NAVIGATION MANAGER
create table if not exists public.orlong_site_map_config (
 config_id boolean primary key default true check (config_id=true),
 config jsonb not null,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.orlong_site_map_config enable row level security;
revoke all on public.orlong_site_map_config from anon,authenticated;

insert into public.orlong_site_map_config(config_id,config)
values(true,'{
 "pages":[
  {"id":"home","label":"Homepage","path":"/","kind":"main"},
  {"id":"reading","label":"Reading Room","path":"/books/trials-of-eden/","kind":"book"},
  {"id":"contents","label":"Chapter Contents","path":"/books/trials-of-eden/contents.html","kind":"book"},
  {"id":"account","label":"Reader Account","path":"/books/trials-of-eden/account.html","kind":"account"},
  {"id":"explore","label":"Explore Eden","path":"/explore-eden/","kind":"discover"},
  {"id":"events","label":"Events","path":"/events.html","kind":"discover"},
  {"id":"archive","label":"Eden Archive","path":"/eden-archive/","kind":"discover"},
  {"id":"early","label":"Early Access","path":"/early-access/","kind":"discover"},
  {"id":"founding","label":"Founding Readers","path":"/founding-readers/","kind":"discover"},
  {"id":"guide","label":"Reader Guide","path":"/getting-started.html","kind":"guide"},
  {"id":"moderator","label":"Moderator HQ","path":"/moderator/","kind":"admin"}
 ],
 "links":[
  {"id":"start-reading","label":"START READING","href":"/books/trials-of-eden/","group":"primary","order":0,"enabled":true},
  {"id":"reading-room","label":"READING ROOM","href":"/books/trials-of-eden/","group":"book","order":0,"enabled":true},
  {"id":"chapter-contents","label":"CHAPTER CONTENTS","href":"/books/trials-of-eden/contents.html","group":"book","order":1,"enabled":true},
  {"id":"explore-eden","label":"EXPLORE EDEN","href":"/explore-eden/","group":"primary","order":1,"enabled":true},
  {"id":"events","label":"EVENTS","href":"/events.html","group":"discover","order":0,"enabled":true},
  {"id":"eden-archive","label":"EDEN ARCHIVE","href":"/eden-archive/","group":"discover","order":1,"enabled":true},
  {"id":"early-access","label":"EARLY ACCESS","href":"/early-access/","group":"discover","order":2,"enabled":true},
  {"id":"founding-readers","label":"FOUNDING READERS","href":"/founding-readers/","group":"discover","order":3,"enabled":true}
 ]}'::jsonb)
on conflict(config_id) do nothing;

create or replace function public.get_public_orlong_navigation()
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select config from public.orlong_site_map_config where config_id=true;
$$;

create or replace function public.get_moderator_orlong_site_map()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return (select config from public.orlong_site_map_config where config_id=true);
end;
$$;

create or replace function public.save_moderator_orlong_site_map(p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_item record; v_path text; v_href text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_config is null or jsonb_typeof(p_config) is distinct from 'object' then raise exception 'Website map data is invalid'; end if;
 if jsonb_typeof(p_config->'pages') is distinct from 'array' or jsonb_typeof(p_config->'links') is distinct from 'array' then raise exception 'Website pages and navigation links must both be lists'; end if;
 if jsonb_array_length(p_config->'pages')>100 or jsonb_array_length(p_config->'links')>100 then raise exception 'The website map supports up to 100 pages and 100 navigation links'; end if;
 if length(p_config::text)>100000 then raise exception 'Website map configuration is too large'; end if;
 for v_item in select value from jsonb_array_elements(p_config->'pages') loop
  v_path:=coalesce(v_item.value->>'path','');
  if v_path !~ '^/[A-Za-z0-9_./-]*$' or length(v_path)>240 or v_path like '%..%' then raise exception 'A page has an invalid website path'; end if;
  if length(coalesce(v_item.value->>'label','')) not between 1 and 100 then raise exception 'Every page needs a name'; end if;
 end loop;
 for v_item in select value from jsonb_array_elements(p_config->'links') loop
  v_href:=coalesce(v_item.value->>'href','');
  if v_href !~ '^(https://|http://|/[A-Za-z0-9_./?#=&%-]*)$' or length(v_href)>500 then raise exception 'A navigation link has an invalid destination'; end if;
  if length(coalesce(v_item.value->>'label','')) not between 1 and 80 then raise exception 'Every navigation link needs a label'; end if;
  if coalesce(v_item.value->>'group','') not in ('primary','book','discover') then raise exception 'Choose a valid navigation menu group'; end if;
 end loop;
 insert into public.orlong_site_map_config(config_id,config,updated_by,updated_at)
 values(true,p_config,auth.uid(),now())
 on conflict(config_id) do update set config=excluded.config,updated_by=auth.uid(),updated_at=now();
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_navigation() from public;
revoke all on function public.get_moderator_orlong_site_map() from public,anon;
revoke all on function public.save_moderator_orlong_site_map(jsonb) from public,anon;
grant execute on function public.get_public_orlong_navigation() to anon,authenticated;
grant execute on function public.get_moderator_orlong_site_map() to authenticated;
grant execute on function public.save_moderator_orlong_site_map(jsonb) to authenticated;
