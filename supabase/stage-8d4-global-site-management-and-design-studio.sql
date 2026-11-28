-- ORLONG STAGE 8D.4 — GLOBAL WEBSITE MANAGEMENT AND FRONT PAGE DESIGN VERSIONS
-- Run after Stage 8D.3 (universal content manager) and Stage 8D.3B (visual page builder).

-- Align the saved-content property constraint with the visual editor controls.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid='public.orlong_site_content'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%property%'
  loop
    execute format('alter table public.orlong_site_content drop constraint %I',v_constraint.conname);
  end loop;
end $$;

alter table public.orlong_site_content
  add constraint orlong_site_content_property_check
  check (property in (
    'text','href','src','alt','title','placeholder','value','hidden','aria-label',
    'style:background-color','style:color','style:padding','style:max-width',
    'style:border-radius','style:text-align','style:font-size'
  ));

create or replace function public.save_moderator_orlong_site_content(
  p_page_path text,
  p_selector text,
  p_property text,
  p_content_value text,
  p_is_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_value text:=coalesce(p_content_value,'');
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  if p_page_path is null or p_page_path !~ '^/[A-Za-z0-9_./-]*$' or length(p_page_path)>240 then
    raise exception 'Invalid page path';
  end if;
  if p_selector is null or length(trim(p_selector))<1 or length(p_selector)>500 then
    raise exception 'Enter a valid page element';
  end if;
  if p_property not in (
    'text','href','src','alt','title','placeholder','value','hidden','aria-label',
    'style:background-color','style:color','style:padding','style:max-width',
    'style:border-radius','style:text-align','style:font-size'
  ) then
    raise exception 'Unsupported content property';
  end if;
  if length(v_value)>12000 then raise exception 'Content is too long'; end if;
  if p_property in ('href','src') and v_value<>'' and v_value !~ '^(https://|http://|/|#|mailto:|tel:)' then
    raise exception 'Links and images must use a safe web, relative, anchor, email or telephone URL';
  end if;
  if p_property='hidden' and v_value not in ('true','false') then
    raise exception 'Visibility must be true or false';
  end if;
  if p_property in ('style:background-color','style:color') and v_value !~ '^#[0-9A-Fa-f]{3,8}$' then
    raise exception 'Enter a hexadecimal colour such as #183553';
  end if;
  if p_property in ('style:padding','style:max-width','style:border-radius','style:font-size')
     and v_value !~ '^(0|[0-9]{1,4}(px|rem|%))$' then
    raise exception 'Use a simple size such as 24px, 1.5rem or 80 percent';
  end if;
  if p_property='style:text-align' and v_value not in ('left','center','right') then
    raise exception 'Choose left, center or right alignment';
  end if;

  insert into public.orlong_site_content(
    page_path,selector,property,content_value,is_published,updated_by,updated_at
  )
  values(
    p_page_path,trim(p_selector),p_property,v_value,coalesce(p_is_published,true),auth.uid(),now()
  )
  on conflict(page_path,selector,property) do update set
    content_value=excluded.content_value,
    is_published=excluded.is_published,
    updated_by=auth.uid(),
    updated_at=now();

  return jsonb_build_object('success',true);
end;
$$;

create table if not exists public.orlong_homepage_versions (
  version_id uuid primary key default gen_random_uuid(),
  version_name text not null,
  theme text not null default 'blue'
    check (theme in ('blue','red','orange','purple','yellow','black')),
  design jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','scheduled','published','archived')),
  publish_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(version_name)) between 1 and 120),
  check (jsonb_typeof(design)='object')
);

create index if not exists orlong_homepage_versions_public_idx
  on public.orlong_homepage_versions(status,publish_at,updated_at desc);

alter table public.orlong_homepage_versions enable row level security;
revoke all on public.orlong_homepage_versions from anon,authenticated;

create table if not exists public.orlong_homepage_version_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.orlong_homepage_versions(version_id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  revision_note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(version_id,revision_number)
);

alter table public.orlong_homepage_version_revisions enable row level security;
revoke all on public.orlong_homepage_version_revisions from anon,authenticated;

-- Readers only receive the most recent eligible published design.
-- A scheduled version becomes eligible automatically after its publish_at time.
create or replace function public.get_public_orlong_homepage_design()
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'versionId',version_id,
    'name',version_name,
    'theme',theme,
    'design',design,
    'publishedAt',coalesce(publish_at,updated_at),
    'nextPublishAt',(
      select min(next_version.publish_at)
      from public.orlong_homepage_versions next_version
      where next_version.status='scheduled'
        and next_version.publish_at>now()
    )
  )
  from public.orlong_homepage_versions
  where status='published'
     or (status='scheduled' and publish_at is not null and publish_at<=now())
  order by coalesce(publish_at,updated_at) desc,updated_at desc,created_at desc
  limit 1;
$$;

create or replace function public.get_moderator_orlong_homepage_versions()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',v.version_id,
        'name',v.version_name,
        'theme',v.theme,
        'design',v.design,
        'status',v.status,
        'publishAt',v.publish_at,
        'createdAt',v.created_at,
        'updatedAt',v.updated_at,
        'revisionCount',(
          select count(*)
          from public.orlong_homepage_version_revisions r
          where r.version_id=v.version_id
        )
      )
      order by
        case v.status when 'published' then 0 when 'scheduled' then 1 when 'draft' then 2 else 3 end,
        coalesce(v.publish_at,v.updated_at) desc,
        v.updated_at desc
    )
    from public.orlong_homepage_versions v
  ),'[]'::jsonb);
end;
$$;

create or replace function public.get_moderator_orlong_homepage_revisions(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  if not exists(
    select 1 from public.orlong_homepage_versions where version_id=p_version_id
  ) then
    raise exception 'Homepage version not found';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',revision_id,
        'number',revision_number,
        'snapshot',snapshot,
        'note',revision_note,
        'createdAt',created_at
      )
      order by revision_number desc
    )
    from public.orlong_homepage_version_revisions
    where version_id=p_version_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_homepage_version(
  p_version_id uuid,
  p_version_name text,
  p_theme text,
  p_design jsonb,
  p_status text default 'draft',
  p_publish_at timestamptz default null,
  p_revision_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid:=p_version_id;
  v_next integer;
  v_color record;
  v_snapshot jsonb;
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  if length(trim(coalesce(p_version_name,''))) not between 1 and 120 then
    raise exception 'Give this homepage version a name';
  end if;
  if p_theme not in ('blue','red','orange','purple','yellow','black') then
    raise exception 'Choose one of the six Orlong series themes';
  end if;
  if p_status not in ('draft','scheduled','published','archived') then
    raise exception 'Choose a valid publication status';
  end if;
  if p_status='scheduled' and (p_publish_at is null or p_publish_at<=now()) then
    raise exception 'Choose a future publication date and time for a scheduled design';
  end if;
  if p_design is null or jsonb_typeof(p_design) is distinct from 'object'
     or length(p_design::text)>50000 then
    raise exception 'The homepage design is invalid or too large';
  end if;

  if length(coalesce(p_design->>'heroTitle',''))>180
     or length(coalesce(p_design->>'heroKicker',''))>180
     or length(coalesce(p_design->>'heroSubtitle',''))>240
     or length(coalesce(p_design->>'heroCopy',''))>2000
     or length(coalesce(p_design->>'primaryLabel',''))>80
     or length(coalesce(p_design->>'secondaryLabel',''))>80
     or length(coalesce(p_design->>'focusLabel',''))>80 then
    raise exception 'One of the homepage text fields is too long';
  end if;

  if coalesce(p_design->>'primaryHref','') !~ '^(https://|http://|/|#)'
     or coalesce(p_design->>'secondaryHref','') !~ '^(https://|http://|/|#)' then
    raise exception 'Homepage buttons need safe website or web addresses';
  end if;

  if p_design ? 'colors' then
    if jsonb_typeof(p_design->'colors') is distinct from 'object' then
      raise exception 'Homepage colours must be a colour settings object';
    end if;
    for v_color in select key,value from jsonb_each_text(p_design->'colors') loop
      if v_color.key not in ('accent','highlight','background','surface','text')
         or v_color.value !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Use six-digit hexadecimal values for the five homepage colours';
      end if;
    end loop;
  end if;

  if v_id is null then
    insert into public.orlong_homepage_versions(
      version_name,theme,design,status,publish_at,created_by,updated_by
    )
    values(
      trim(p_version_name),p_theme,p_design,p_status,
      case when p_status='published' then now() when p_status='scheduled' then p_publish_at else null end,
      auth.uid(),auth.uid()
    )
    returning version_id into v_id;
    v_next:=1;
  else
    if not exists(
      select 1 from public.orlong_homepage_versions where version_id=v_id
    ) then
      raise exception 'Homepage version not found';
    end if;
    select coalesce(max(revision_number),0)+1
      into v_next
      from public.orlong_homepage_version_revisions
      where version_id=v_id;

    update public.orlong_homepage_versions
    set version_name=trim(p_version_name),
        theme=p_theme,
        design=p_design,
        status=p_status,
        publish_at=case
          when p_status='published' then now()
          when p_status='scheduled' then p_publish_at
          else null
        end,
        updated_by=auth.uid(),
        updated_at=now()
    where version_id=v_id;
  end if;

  select jsonb_build_object(
    'name',version_name,
    'theme',theme,
    'design',design,
    'status',status,
    'publishAt',publish_at
  )
  into v_snapshot
  from public.orlong_homepage_versions
  where version_id=v_id;

  insert into public.orlong_homepage_version_revisions(
    version_id,revision_number,snapshot,revision_note,created_by
  )
  values(
    v_id,v_next,v_snapshot,coalesce(p_revision_note,'Saved version'),auth.uid()
  );

  return jsonb_build_object(
    'success',true,
    'version_id',v_id,
    'revision_number',v_next
  );
end;
$$;

create or replace function public.delete_moderator_orlong_homepage_version(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  delete from public.orlong_homepage_versions
  where version_id=p_version_id and status<>'published';
  if not found then
    raise exception 'Only draft or scheduled versions can be deleted. Archive a live version instead.';
  end if;
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_homepage_design() from public;
revoke all on function public.get_moderator_orlong_homepage_versions() from public,anon;
revoke all on function public.get_moderator_orlong_homepage_revisions(uuid) from public,anon;
revoke all on function public.save_moderator_orlong_homepage_version(uuid,text,text,jsonb,text,timestamptz,text) from public,anon;
revoke all on function public.delete_moderator_orlong_homepage_version(uuid) from public,anon;

grant execute on function public.get_public_orlong_homepage_design() to anon,authenticated;
grant execute on function public.get_moderator_orlong_homepage_versions() to authenticated;
grant execute on function public.get_moderator_orlong_homepage_revisions(uuid) to authenticated;
grant execute on function public.save_moderator_orlong_homepage_version(uuid,text,text,jsonb,text,timestamptz,text) to authenticated;
grant execute on function public.delete_moderator_orlong_homepage_version(uuid) to authenticated;

-- Seed the current live homepage once so the version library starts with the existing Eden design.
insert into public.orlong_homepage_versions(version_name,theme,design,status,publish_at)
select
  'Current homepage — Eden Blue',
  'blue',
  jsonb_build_object(
    'colors',jsonb_build_object(
      'accent','#398cff','highlight','#a8ceff','background','#12233b','surface','#101a29','text','#f1f5fb'
    ),
    'heroKicker','A new world. A new beginning. A new nightmare.',
    'heroTitle','THE TRIALS' || chr(10) || 'OF EDEN',
    'heroSubtitle','EDEN TRILOGY · BOOK ONE',
    'heroCopy','Twenty contestants enter a competition built to test the limits of human potential. But in a world where every move is watched, the greatest danger may be what lies beyond the Trials.',
    'primaryLabel','ENTER THE READING ROOM',
    'primaryHref','/books/trials-of-eden/',
    'secondaryLabel','HOW IT WORKS',
    'secondaryHref','#your-first-visit',
    'focusLabel','READ WITHOUT DISTRACTIONS',
    'heroNote','Your story starts here. You can explore the wider world whenever you are ready.',
    'bookEyebrow','THE STORY BEGINS',
    'bookTitle','Welcome to Eden.',
    'bookCopy1','Maya Garcia has spent her life preparing for a future she never truly understood. Now she finds herself competing in the Trials of Eden, a prestigious competition where failure comes at a devastating cost.',
    'bookCopy2','Read at your own pace. The Reading Room keeps the chapters together and gives you the controls you need for a comfortable reading experience.',
    'firstVisitTitle','YOUR FIRST VISIT',
    'firstVisitIntro','You do not need to learn the whole website before you start. Follow these steps and discover the extra features only when you want them.',
    'discoverTitle','THERE''S MORE TO DISCOVER',
    'discoverIntro','The extras are optional. The book always comes first.',
    'creatorTitle','THE ORLONG UNIVERSE',
    'creatorCopy','Created by Callum Macann, Orlong is an interconnected science-fiction and fantasy universe exploring society, identity, power and the future of humanity.'
  ),
  'published',
  now()
where not exists(select 1 from public.orlong_homepage_versions);

insert into public.orlong_homepage_version_revisions(
  version_id,revision_number,snapshot,revision_note
)
select
  version_id,
  1,
  jsonb_build_object(
    'name',version_name,'theme',theme,'design',design,'status',status,'publishAt',publish_at
  ),
  'Initial live homepage snapshot'
from public.orlong_homepage_versions v
where not exists(
  select 1 from public.orlong_homepage_version_revisions r where r.version_id=v.version_id
);
