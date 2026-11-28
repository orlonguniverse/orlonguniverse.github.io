-- ORLONG STAGE 8D.3B — ARCHIVE CONNECTION MANAGER REPAIR + CUSTOM RELATIONSHIP TYPES
-- Run after Stage 8D.2C and 8D.3 migrations.

create table if not exists public.eden_archive_relation_types(
 type_key text primary key,
 display_name text not null,
 type_group text not null default 'General',
 description text not null default '',
 sort_order integer not null default 0,
 is_system boolean not null default false,
 created_at timestamptz not null default now(),
 constraint eden_archive_relation_type_key_format check(type_key ~ '^[a-z][a-z0-9_]{1,63}$')
);
alter table public.eden_archive_relation_types enable row level security;
revoke all on public.eden_archive_relation_types from anon,authenticated;

alter table public.eden_archive_relations drop constraint if exists eden_archive_relation_type;
alter table public.eden_archive_relations add constraint eden_archive_relation_type
 check(relationship_type ~ '^[a-z][a-z0-9_]{1,63}$');

insert into public.eden_archive_relation_types(type_key,display_name,type_group,description,sort_order,is_system) values
 ('related_to','Related to','General','A general connection between records.',10,true),
 ('parent','Parent of','Family','Parent relationship.',20,true),
 ('child','Child of','Family','Child relationship.',21,true),
 ('sibling','Sibling of','Family','Sibling relationship.',22,true),
 ('spouse','Spouse of','Family','Spouse relationship.',23,true),
 ('family','Family connection','Family','A broader family relationship.',24,true),
 ('biological_parent','Biological parent of','Family','Biological parentage.',25,true),
 ('adoptive_parent','Adoptive parent of','Family','Adoptive parentage.',26,true),
 ('guardian','Guardian of','Family','Legal or personal guardianship.',27,true),
 ('ancestor','Ancestor of','Family','Ancestral lineage.',28,true),
 ('descendant','Descendant of','Family','Descendant lineage.',29,true),
 ('cousin','Cousin of','Family','Cousin relationship.',30,true),
 ('aunt_uncle','Aunt / uncle of','Family','Aunt or uncle relationship.',31,true),
 ('niece_nephew','Niece / nephew of','Family','Niece or nephew relationship.',32,true),
 ('partner','Partner of','Family & Personal','Romantic or life partnership.',40,true),
 ('engaged_to','Engaged to','Family & Personal','Engagement relationship.',41,true),
 ('ex_partner','Former partner of','Family & Personal','Former romantic partnership.',42,true),
 ('friend','Friend of','Friendship','Friendship connection.',50,true),
 ('best_friend','Best friend of','Friendship','Especially close friendship.',51,true),
 ('mentor','Mentor of','Friendship','Mentor relationship.',52,true),
 ('student','Student of','Friendship','Student relationship.',53,true),
 ('colleague','Colleague of','Friendship','Professional colleague.',54,true),
 ('ally','Ally of','Conflict & Politics','Political or strategic ally.',60,true),
 ('rival','Rival of','Conflict & Politics','Rivalry.',61,true),
 ('enemy','Enemy of','Conflict & Politics','Hostile relationship.',62,true),
 ('opposes','Opposes','Conflict & Politics','Opposition or disagreement.',63,true),
 ('serves','Serves','Conflict & Politics','Service or allegiance.',64,true),
 ('member','Member of','Organisations','Membership.',70,true),
 ('leader','Leader of','Organisations','Leadership.',71,true),
 ('founder','Founder of','Organisations','Founding relationship.',72,true),
 ('employee','Works for','Organisations','Employment relationship.',73,true),
 ('employer','Employs','Organisations','Employer relationship.',74,true),
 ('owns','Owns','Organisations','Ownership.',75,true),
 ('part_of','Part of','Structure & Places','Part-whole relationship.',80,true),
 ('contains','Contains','Structure & Places','Container relationship.',81,true),
 ('located_in','Located in','Structure & Places','Location relationship.',82,true),
 ('originated_in','Originated in','Structure & Places','Origin or birthplace.',83,true),
 ('created_by','Created by','Creation & Discovery','Creator relationship.',90,true),
 ('created','Created','Creation & Discovery','Creation event.',91,true),
 ('invented_by','Invented by','Creation & Discovery','Invention relationship.',92,true),
 ('discovered_by','Discovered by','Creation & Discovery','Discovery relationship.',93,true),
 ('discovered','Discovered','Creation & Discovery','Discovery event.',94,true),
 ('uses','Uses','Creation & Discovery','Uses an object, method or technology.',95,true),
 ('powered_by','Powered by','Creation & Discovery','Power source or enabling force.',96,true),
 ('derived_from','Derived from','Creation & Discovery','Origin or derivation.',97,true),
 ('predecessor','Predecessor of','History & Events','Earlier role, event or era.',100,true),
 ('successor','Successor of','History & Events','Later role, event or era.',101,true),
 ('participated_in','Participated in','History & Events','Participation in an event.',102,true),
 ('witnessed','Witnessed','History & Events','Witness to an event.',103,true),
 ('caused','Caused','History & Events','Caused an event or outcome.',104,true),
 ('prevented','Prevented','History & Events','Prevented an event or outcome.',105,true),
 ('happened_during','Happened during','History & Events','Occurred within an era or event.',106,true),
 ('before','Occurred before','History & Events','Chronological predecessor.',107,true),
 ('after','Occurred after','History & Events','Chronological successor.',108,true),
 ('custom','Custom relationship','General','Legacy custom relationship option.',999,true)
on conflict(type_key) do nothing;

create or replace function public.get_moderator_eden_archive_relation_types()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'key',type_key,'label',display_name,'group',type_group,'description',description,
  'sortOrder',sort_order,'isSystem',is_system,
  'usageCount',(select count(*) from public.eden_archive_relations r where r.relationship_type=t.type_key)
 ) order by sort_order,display_name) from public.eden_archive_relation_types t),'[]'::jsonb);
end;
$$;

create or replace function public.add_moderator_eden_archive_relation_type(
 p_display_name text,p_type_group text default 'Custom',p_description text default ''
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_key text;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if length(trim(coalesce(p_display_name,'')))<2 then raise exception 'Enter a relationship name with at least two characters'; end if;
 v_key:=trim(both '_' from left(regexp_replace(lower(trim(p_display_name)),'[^a-z0-9]+','_','g'),64));
 if length(v_key)<2 then raise exception 'Use a more descriptive relationship name'; end if;
 if exists(select 1 from public.eden_archive_relation_types where type_key=v_key) then raise exception 'That relationship option already exists'; end if;
 insert into public.eden_archive_relation_types(type_key,display_name,type_group,description,sort_order,is_system)
 values(v_key,left(trim(p_display_name),80),left(coalesce(nullif(trim(p_type_group),''),'Custom'),60),
  left(coalesce(trim(p_description),''),300),coalesce((select max(sort_order)+1 from public.eden_archive_relation_types),1000),false);
 return jsonb_build_object('success',true,'key',v_key);
end;
$$;

create or replace function public.delete_moderator_eden_archive_relation_type(p_type_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if exists(select 1 from public.eden_archive_relation_types where type_key=p_type_key and is_system) then
  raise exception 'Built-in relationship options cannot be removed';
 end if;
 if exists(select 1 from public.eden_archive_relations where relationship_type=p_type_key) then
  raise exception 'This option is currently used by saved connections. Change or delete those connections first.';
 end if;
 delete from public.eden_archive_relation_types where type_key=p_type_key;
 if not found then raise exception 'Custom relationship option not found'; end if;
 return jsonb_build_object('success',true,'deleted',p_type_key);
end;
$$;

create or replace function public.save_moderator_eden_archive_relation(
 p_relation_id bigint,p_source_entry_id text,p_source_block_id text,
 p_target_entry_id text,p_target_block_id text,p_relationship_type text,
 p_label text,p_description text,p_sort_order integer default 0,
 p_is_bidirectional boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id bigint;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if not exists(select 1 from public.eden_archive_entries where entry_id=p_source_entry_id)
  or not exists(select 1 from public.eden_archive_entries where entry_id=p_target_entry_id) then
  raise exception 'Choose two existing archive entries'; end if;
 if not exists(select 1 from public.eden_archive_relation_types where type_key=p_relationship_type) then
  raise exception 'Choose a valid relationship type'; end if;
 if p_source_block_id is not null and not exists(select 1 from public.eden_archive_entries e,jsonb_array_elements(e.content_blocks) b
  where e.entry_id=p_source_entry_id and b->>'id'=p_source_block_id) then raise exception 'The source block no longer exists'; end if;
 if p_target_block_id is not null and not exists(select 1 from public.eden_archive_entries e,jsonb_array_elements(e.content_blocks) b
  where e.entry_id=p_target_entry_id and b->>'id'=p_target_block_id) then raise exception 'The target block no longer exists'; end if;
 if p_relation_id is null then
  insert into public.eden_archive_relations(source_entry_id,source_block_id,target_entry_id,target_block_id,relationship_type,label,description,sort_order,is_bidirectional)
  values(p_source_entry_id,nullif(p_source_block_id,''),p_target_entry_id,nullif(p_target_block_id,''),p_relationship_type,
   left(coalesce(nullif(trim(p_label),''),(select display_name from public.eden_archive_relation_types where type_key=p_relationship_type)),120),left(coalesce(p_description,''),500),coalesce(p_sort_order,0),coalesce(p_is_bidirectional,false))
  returning relation_id into v_id;
 else
  update public.eden_archive_relations set source_entry_id=p_source_entry_id,source_block_id=nullif(p_source_block_id,''),
   target_entry_id=p_target_entry_id,target_block_id=nullif(p_target_block_id,''),relationship_type=p_relationship_type,
   label=left(coalesce(nullif(trim(p_label),''),(select display_name from public.eden_archive_relation_types where type_key=p_relationship_type)),120),description=left(coalesce(p_description,''),500),
   sort_order=coalesce(p_sort_order,0),is_bidirectional=coalesce(p_is_bidirectional,false)
  where relation_id=p_relation_id returning relation_id into v_id;
  if v_id is null then raise exception 'Archive connection not found'; end if;
 end if;
 return jsonb_build_object('success',true,'relation_id',v_id);
end;
$$;

revoke all on function public.get_moderator_eden_archive_relation_types() from public,anon;
revoke all on function public.add_moderator_eden_archive_relation_type(text,text,text) from public,anon;
revoke all on function public.delete_moderator_eden_archive_relation_type(text) from public,anon;
revoke all on function public.save_moderator_eden_archive_relation(bigint,text,text,text,text,text,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.get_moderator_eden_archive_relation_types() to authenticated;
grant execute on function public.add_moderator_eden_archive_relation_type(text,text,text) to authenticated;
grant execute on function public.delete_moderator_eden_archive_relation_type(text) to authenticated;
grant execute on function public.save_moderator_eden_archive_relation(bigint,text,text,text,text,text,text,text,integer,boolean) to authenticated;
