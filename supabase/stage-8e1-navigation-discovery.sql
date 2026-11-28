-- ORLONG STAGE 8E.1 — NAVIGATION & DISCOVERY REORGANISATION
-- Removes duplicate reading shortcuts from the global menu, places Explore Eden
-- inside Discover, and adds reader-friendly subsection labels.

update public.orlong_site_map_config
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{links}',
        coalesce((
          select jsonb_agg(
            case
              when value->>'id'='explore-eden' then
                jsonb_set(
                  jsonb_set(
                    jsonb_set(value,'{group}','"discover"'::jsonb),
                    '{section}','"EXPLORE"'::jsonb
                  ),
                  '{order}','0'::jsonb
                )
              when value->>'id'='eden-archive' then
                jsonb_set(
                  jsonb_set(value,'{section}','"EXPLORE"'::jsonb),
                  '{order}','1'::jsonb
                )
              when value->>'id'='events' then
                jsonb_set(
                  jsonb_set(value,'{section}','"COMMUNITY"'::jsonb),
                  '{order}','2'::jsonb
                )
              when value->>'id'='founding-readers' then
                jsonb_set(
                  jsonb_set(value,'{section}','"COMMUNITY"'::jsonb),
                  '{order}','3'::jsonb
                )
              when value->>'id'='early-access' then
                jsonb_set(
                  jsonb_set(value,'{section}','"ACCESS"'::jsonb),
                  '{order}','4'::jsonb
                )
              else value
            end
            order by case value->>'id'
              when 'explore-eden' then 0
              when 'eden-archive' then 1
              when 'events' then 2
              when 'founding-readers' then 3
              when 'early-access' then 4
              else 100 + coalesce((value->>'order')::integer,0)
            end
          )
          from jsonb_array_elements(coalesce(config->'links','[]'::jsonb))
          where value->>'id' not in ('start-reading','reading-room','chapter-contents')
        ),'[]'::jsonb)
      ),
      '{menus}',
      coalesce((
        select jsonb_agg(value order by coalesce((value->>'order')::integer,0))
        from jsonb_array_elements(coalesce(config->'menus','[]'::jsonb))
        where value->>'id'<>'book'
      ),'[{"id":"discover","label":"DISCOVER","enabled":true,"order":0}]'::jsonb)
    ),
    '{navigationOrder}',
    coalesce((
      select jsonb_agg(value order by ordinality)
      from jsonb_array_elements_text(coalesce(config->'navigationOrder','[]'::jsonb))
        with ordinality as order_item(value,ordinality)
      where value not in ('menu:book','link:start-reading','link:explore-eden')
    ),'["main-menu","book-collection","menu:discover"]'::jsonb)
  ),
  '{mainMenu}',
  coalesce(config->'mainMenu','{"label":"MAIN MENU","enabled":true,"showGuide":true,"showTheme":true,"showBookOnly":true,"showStatistics":true,"showSoundtrack":true,"links":[]}'::jsonb),
  true
),
updated_at=now()
where config_id=true;

update public.orlong_site_map_config
set config=jsonb_set(
  config,
  '{menus}',
  case
    when exists (
      select 1 from jsonb_array_elements(coalesce(config->'menus','[]'::jsonb)) menu
      where menu->>'id'='discover'
    ) then config->'menus'
    else '[{"id":"discover","label":"DISCOVER","enabled":true,"order":0}]'::jsonb
  end
),
updated_at=now()
where config_id=true;
