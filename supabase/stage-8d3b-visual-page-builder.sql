-- ORLONG STAGE 8D.3B — VISUAL PAGE BUILDER
-- Adds safe, moderator-managed page sections and blocks without permitting arbitrary HTML or scripts.

create table if not exists public.orlong_site_sections (
 section_id uuid primary key default gen_random_uuid(),
 page_path text not null check (page_path ~ '^/[A-Za-z0-9_./-]*$' and length(page_path)<=240),
 anchor_selector text not null default 'main' check (length(trim(anchor_selector)) between 1 and 500),
 sort_order integer not null default 0,
 section_data jsonb not null,
 is_published boolean not null default true,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create index if not exists orlong_site_sections_page_idx
 on public.orlong_site_sections(page_path,is_published,sort_order,updated_at);
alter table public.orlong_site_sections enable row level security;
revoke all on public.orlong_site_sections from anon,authenticated;

create or replace function public.get_public_orlong_site_sections(p_page_path text)
returns jsonb language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',section_id,'anchorSelector',anchor_selector,'sortOrder',sort_order,'data',section_data
 ) order by sort_order,updated_at,section_id),'[]'::jsonb)
 from public.orlong_site_sections
 where page_path=p_page_path and is_published=true;
$$;

create or replace function public.get_moderator_orlong_site_sections(p_page_path text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',section_id,'pagePath',page_path,'anchorSelector',anchor_selector,
  'sortOrder',sort_order,'data',section_data,'published',is_published,'updatedAt',updated_at
 ) order by sort_order,updated_at,section_id)
 from public.orlong_site_sections where page_path=p_page_path),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_site_section(
 p_section_id uuid,
 p_page_path text,
 p_anchor_selector text,
 p_sort_order integer,
 p_section_data jsonb,
 p_is_published boolean default true
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
 v_block jsonb;
 v_item jsonb;
 v_type text;
 v_url text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_page_path is null or p_page_path !~ '^/[A-Za-z0-9_./-]*$' or length(p_page_path)>240 then raise exception 'Invalid page path'; end if;
 if p_anchor_selector is null or length(trim(p_anchor_selector))<1 or length(p_anchor_selector)>500 then raise exception 'Choose a valid page section to place this content after'; end if;
 if p_section_data is null or jsonb_typeof(p_section_data) is distinct from 'object' or jsonb_typeof(p_section_data->'blocks') is distinct from 'array' then raise exception 'Section content is invalid'; end if;
 if length(p_section_data::text)>50000 then raise exception 'Section content is too large'; end if;
 if jsonb_array_length(p_section_data->'blocks')>40 then raise exception 'A section can contain no more than 40 content blocks'; end if;
 if length(coalesce(p_section_data->>'title',''))>180 then raise exception 'Section title is too long'; end if;
 if coalesce(p_section_data->>'theme','default') not in ('default','panel','blue','light') then raise exception 'Invalid section theme'; end if;
 if coalesce(p_section_data->>'width','standard') not in ('narrow','standard','wide','full') then raise exception 'Invalid section width'; end if;
 for v_block in select value from jsonb_array_elements(p_section_data->'blocks') loop
  v_type:=v_block->>'type';
  if v_type is null or v_type not in ('heading','text','callout','accordion','image','button','divider') then raise exception 'Unsupported content block type'; end if;
  if length(coalesce(v_block->>'text',''))>12000 or length(coalesce(v_block->>'title',''))>500 or length(coalesce(v_block->>'caption',''))>1000 then raise exception 'A content block is too long'; end if;
  if v_type in ('image','button') then
   v_url:=coalesce(v_block->>'url','');
   if v_url='' or v_url !~ '^(https://|http://|/|#)' then raise exception 'Images and buttons need a safe web or relative URL'; end if;
  end if;
  if v_type='accordion' then
   if jsonb_typeof(v_block->'items') is distinct from 'array' or jsonb_array_length(v_block->'items')>20 then raise exception 'Collapsible menus need a valid list of up to 20 items'; end if;
   for v_item in select value from jsonb_array_elements(v_block->'items') loop
    if length(coalesce(v_item->>'title',''))>500 or length(coalesce(v_item->>'text',''))>12000 then raise exception 'A collapsible menu item is too long'; end if;
   end loop;
  end if;
 end loop;
 if p_section_id is null then
  insert into public.orlong_site_sections(page_path,anchor_selector,sort_order,section_data,is_published,updated_by)
  values(p_page_path,trim(p_anchor_selector),coalesce(p_sort_order,0),p_section_data,coalesce(p_is_published,true),auth.uid())
  returning section_id into p_section_id;
 else
  update public.orlong_site_sections set
   page_path=p_page_path,anchor_selector=trim(p_anchor_selector),sort_order=coalesce(p_sort_order,0),
   section_data=p_section_data,is_published=coalesce(p_is_published,true),updated_by=auth.uid(),updated_at=now()
  where section_id=p_section_id;
  if not found then raise exception 'Section not found'; end if;
 end if;
 return jsonb_build_object('success',true,'section_id',p_section_id);
end;
$$;

create or replace function public.delete_moderator_orlong_site_section(p_section_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 delete from public.orlong_site_sections where section_id=p_section_id;
 if not found then raise exception 'Section not found'; end if;
 return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.get_public_orlong_site_sections(text) from public;
revoke all on function public.get_moderator_orlong_site_sections(text) from public,anon;
revoke all on function public.save_moderator_orlong_site_section(uuid,text,text,integer,jsonb,boolean) from public,anon;
revoke all on function public.delete_moderator_orlong_site_section(uuid) from public,anon;
grant execute on function public.get_public_orlong_site_sections(text) to anon,authenticated;
grant execute on function public.get_moderator_orlong_site_sections(text) to authenticated;
grant execute on function public.save_moderator_orlong_site_section(uuid,text,text,integer,jsonb,boolean) to authenticated;
grant execute on function public.delete_moderator_orlong_site_section(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('orlong-site-media','orlong-site-media',true,15728640,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=15728640,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

do $$
begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Orlong site media public read') then
  create policy "Orlong site media public read" on storage.objects for select using (bucket_id='orlong-site-media');
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Orlong site media moderator insert') then
  create policy "Orlong site media moderator insert" on storage.objects for insert to authenticated with check (bucket_id='orlong-site-media' and public.is_reader_moderator());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Orlong site media moderator update') then
  create policy "Orlong site media moderator update" on storage.objects for update to authenticated using (bucket_id='orlong-site-media' and public.is_reader_moderator()) with check (bucket_id='orlong-site-media' and public.is_reader_moderator());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Orlong site media moderator delete') then
  create policy "Orlong site media moderator delete" on storage.objects for delete to authenticated using (bucket_id='orlong-site-media' and public.is_reader_moderator());
 end if;
end $$;
