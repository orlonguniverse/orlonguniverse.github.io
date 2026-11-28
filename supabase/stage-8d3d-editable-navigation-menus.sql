-- ORLONG STAGE 8D.3D — EDITABLE DROPDOWN MENUS AND MAIN MENU
-- Safe to run after stage-8d3c-website-map.sql. Preserves existing pages and links.

update public.orlong_site_map_config
set config = config || jsonb_build_object(
  'menus', coalesce(config->'menus', '[
    {"id":"book","label":"THE BOOK","enabled":true,"order":0},
    {"id":"discover","label":"DISCOVER","enabled":true,"order":1}
  ]'::jsonb),
  'mainMenu', ('{
    "label":"MAIN MENU",
    "enabled":true,
    "showGuide":true,
    "showTheme":true,
    "showBookOnly":true,
    "showStatistics":true,
    "showSoundtrack":true,
    "links":[]
  }'::jsonb || coalesce(config->'mainMenu', '{}'::jsonb) || jsonb_build_object('links', coalesce(config->'mainMenu'->'links','[]'::jsonb)))
),
updated_at=now()
where config_id=true;

create or replace function public.save_moderator_orlong_site_map(p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_item record;
  v_path text;
  v_href text;
  v_menu_count integer;
begin
  if not public.is_reader_moderator() then
    raise exception 'Moderator access required';
  end if;
  if p_config is null or jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'Website map data is invalid';
  end if;
  if jsonb_typeof(p_config->'pages') is distinct from 'array'
     or jsonb_typeof(p_config->'links') is distinct from 'array' then
    raise exception 'Website pages and navigation links must both be lists';
  end if;
  if jsonb_typeof(p_config->'menus') is distinct from 'array' then
    raise exception 'Dropdown menu settings are missing';
  end if;
  if jsonb_typeof(p_config->'mainMenu') is distinct from 'object' then
    raise exception 'Main Menu settings are missing';
  end if;
  if jsonb_array_length(p_config->'pages')>100
     or jsonb_array_length(p_config->'links')>100
     or jsonb_array_length(p_config->'menus')>10 then
    raise exception 'The website map supports up to 100 pages, 100 links and 10 dropdowns';
  end if;
  if length(p_config::text)>100000 then
    raise exception 'Website map configuration is too large';
  end if;

  for v_item in select value from jsonb_array_elements(p_config->'pages') loop
    v_path:=coalesce(v_item.value->>'path','');
    if v_path !~ '^/[A-Za-z0-9_./-]*$' or length(v_path)>240 or v_path like '%..%' then
      raise exception 'A page has an invalid website path';
    end if;
    if length(coalesce(v_item.value->>'label','')) not between 1 and 100 then
      raise exception 'Every page needs a name';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_config->'menus') loop
    if coalesce(v_item.value->>'id','') not in ('book','discover') then
      raise exception 'Only the existing Book and Discover dropdowns can be configured here';
    end if;
    if length(coalesce(v_item.value->>'label','')) not between 1 and 40 then
      raise exception 'Every dropdown needs a short name';
    end if;
    if jsonb_typeof(v_item.value->'enabled') is distinct from 'boolean' then
      raise exception 'Choose whether each dropdown is shown';
    end if;
  end loop;

  select count(*) into v_menu_count
  from jsonb_array_elements(p_config->'menus') as x(value)
  where x.value->>'id'='book';
  if v_menu_count>1 then raise exception 'The Book dropdown can only appear once'; end if;
  select count(*) into v_menu_count
  from jsonb_array_elements(p_config->'menus') as x(value)
  where x.value->>'id'='discover';
  if v_menu_count>1 then raise exception 'The Discover dropdown can only appear once'; end if;

  if length(coalesce(p_config->'mainMenu'->>'label','')) not between 1 and 40 then
    raise exception 'The Main Menu needs a short name';
  end if;
  if jsonb_typeof(p_config->'mainMenu'->'links') is distinct from 'array'
     or jsonb_array_length(p_config->'mainMenu'->'links')>30 then
    raise exception 'The Main Menu can contain up to 30 custom links';
  end if;
  for v_item in select value from jsonb_array_elements(p_config->'mainMenu'->'links') loop
    v_href:=coalesce(v_item.value->>'href','');
    if v_href !~ '^(https://|http://|/[A-Za-z0-9_./?#=&%-]*)

  for v_item in select value from jsonb_array_elements(p_config->'links') loop
    v_href:=coalesce(v_item.value->>'href','');
    if v_href !~ '^(https://|http://|/[A-Za-z0-9_./?#=&%-]*)$' or length(v_href)>500 then
      raise exception 'A navigation link has an invalid destination';
    end if;
    if length(coalesce(v_item.value->>'label','')) not between 1 and 80 then
      raise exception 'Every navigation link needs a label';
    end if;
    if coalesce(v_item.value->>'group','') not in ('primary','book','discover') then
      raise exception 'Choose a valid navigation menu group';
    end if;
  end loop;

  insert into public.orlong_site_map_config(config_id,config,updated_by,updated_at)
  values(true,p_config,auth.uid(),now())
  on conflict(config_id) do update
    set config=excluded.config,updated_by=auth.uid(),updated_at=now();
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.save_moderator_orlong_site_map(jsonb) from public,anon;
grant execute on function public.save_moderator_orlong_site_map(jsonb) to authenticated;
 or length(v_href)>500 then
      raise exception 'A Main Menu link has an invalid destination';
    end if;
    if length(coalesce(v_item.value->>'label','')) not between 1 and 80 then
      raise exception 'Every Main Menu link needs a label';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_config->'links') loop
    v_href:=coalesce(v_item.value->>'href','');
    if v_href !~ '^(https://|http://|/[A-Za-z0-9_./?#=&%-]*)$' or length(v_href)>500 then
      raise exception 'A navigation link has an invalid destination';
    end if;
    if length(coalesce(v_item.value->>'label','')) not between 1 and 80 then
      raise exception 'Every navigation link needs a label';
    end if;
    if coalesce(v_item.value->>'group','') not in ('primary','book','discover') then
      raise exception 'Choose a valid navigation menu group';
    end if;
  end loop;

  insert into public.orlong_site_map_config(config_id,config,updated_by,updated_at)
  values(true,p_config,auth.uid(),now())
  on conflict(config_id) do update
    set config=excluded.config,updated_by=auth.uid(),updated_at=now();
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.save_moderator_orlong_site_map(jsonb) from public,anon;
grant execute on function public.save_moderator_orlong_site_map(jsonb) to authenticated;
