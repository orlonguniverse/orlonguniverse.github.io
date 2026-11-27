-- ============================================================
-- ORLONG STAGE 8C.2 — DATABASE-DRIVEN EVENT PAGES
-- Run once in Supabase SQL Editor after the Stage 8C.1 migration.
-- Events use one reusable public page template; each event receives
-- its own URL through events.html?event=<event-id>.
-- ============================================================

create table if not exists public.orlong_events (
 event_id text primary key check (event_id ~ '^[a-z0-9-]{1,80}$'),
 event_type text not null default 'announcement'
  check (event_type in ('announcement','interactive')),
 title text not null check (char_length(trim(title)) between 1 and 160),
 eyebrow text not null default 'ORLONG EVENT' check (char_length(eyebrow)<=100),
 summary text not null default '' check (char_length(summary)<=500),
 description text not null default '' check (char_length(description)<=12000),
 artwork_url text,
 starts_at timestamptz,
 ends_at timestamptz,
 rewards jsonb not null default '[]'::jsonb check (jsonb_typeof(rewards)='array'),
 activities jsonb not null default '[]'::jsonb check (jsonb_typeof(activities)='array'),
 is_published boolean not null default false,
 sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_at is null or starts_at is null or ends_at>=starts_at)
);

create index if not exists orlong_events_public_order
 on public.orlong_events(is_published,sort_order,starts_at);

alter table public.orlong_events enable row level security;
revoke all on public.orlong_events from anon,authenticated;

-- Public artwork is intentionally separate from private chapter manuscripts.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('orlong-event-artwork','orlong-event-artwork',true,12582912,
 array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=12582912,
 allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Moderators upload Orlong event artwork" on storage.objects;
create policy "Moderators upload Orlong event artwork"
on storage.objects for insert to authenticated
with check(bucket_id='orlong-event-artwork' and public.is_reader_moderator());
drop policy if exists "Moderators update Orlong event artwork" on storage.objects;
create policy "Moderators update Orlong event artwork"
on storage.objects for update to authenticated
using(bucket_id='orlong-event-artwork' and public.is_reader_moderator())
with check(bucket_id='orlong-event-artwork' and public.is_reader_moderator());
drop policy if exists "Moderators delete Orlong event artwork" on storage.objects;
create policy "Moderators delete Orlong event artwork"
on storage.objects for delete to authenticated
using(bucket_id='orlong-event-artwork' and public.is_reader_moderator());
drop policy if exists "Public view Orlong event artwork" on storage.objects;
create policy "Public view Orlong event artwork"
on storage.objects for select to anon,authenticated
using(bucket_id='orlong-event-artwork');

create or replace function public.get_public_orlong_events()
returns jsonb
language sql stable security definer
set search_path=public,pg_temp
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',event_id,'type',event_type,'title',title,'eyebrow',eyebrow,
  'summary',summary,'description',description,'artworkUrl',artwork_url,
  'startDate',starts_at,'endDate',ends_at,'rewards',rewards,
  'activities',activities
 ) order by sort_order,starts_at desc nulls last,created_at desc),'[]'::jsonb)
 from public.orlong_events
 where is_published=true;
$$;

create or replace function public.get_moderator_orlong_events()
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',event_id,'type',event_type,'title',title,'eyebrow',eyebrow,
  'summary',summary,'description',description,'artworkUrl',artwork_url,
  'startDate',starts_at,'endDate',ends_at,'rewards',rewards,
  'activities',activities,'published',is_published,'sortOrder',sort_order
 ) order by sort_order,starts_at desc nulls last,created_at desc)
 from public.orlong_events),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_orlong_event(
 p_event_id text,
 p_event_type text,
 p_title text,
 p_eyebrow text,
 p_summary text,
 p_description text,
 p_artwork_url text,
 p_starts_at timestamptz,
 p_ends_at timestamptz,
 p_rewards jsonb,
 p_activities jsonb,
 p_is_published boolean default false,
 p_sort_order integer default 0
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_event_id is null or p_event_id !~ '^[a-z0-9-]{1,80}$' then raise exception 'Event ID must use lowercase letters, numbers and hyphens'; end if;
 if p_event_type not in ('announcement','interactive') then raise exception 'Choose a valid event type'; end if;
 if nullif(trim(p_title),'') is null or char_length(trim(p_title))>160 then raise exception 'Enter an event title of 1–160 characters'; end if;
 if char_length(coalesce(p_eyebrow,''))>100 or char_length(coalesce(p_summary,''))>500 or char_length(coalesce(p_description,''))>12000 then raise exception 'One of the event text fields is too long'; end if;
 if p_ends_at is not null and p_starts_at is not null and p_ends_at<p_starts_at then raise exception 'Event end must be after its start'; end if;
 if p_rewards is null or jsonb_typeof(p_rewards)<>'array' or p_activities is null or jsonb_typeof(p_activities)<>'array' then raise exception 'Rewards and activities must be JSON arrays'; end if;
 insert into public.orlong_events(
  event_id,event_type,title,eyebrow,summary,description,artwork_url,
  starts_at,ends_at,rewards,activities,is_published,sort_order,created_by,updated_at
 ) values (
  p_event_id,p_event_type,trim(p_title),coalesce(nullif(trim(p_eyebrow),''),'ORLONG EVENT'),
  coalesce(p_summary,''),coalesce(p_description,''),nullif(trim(p_artwork_url),''),
  p_starts_at,p_ends_at,p_rewards,p_activities,coalesce(p_is_published,false),
  coalesce(p_sort_order,0),auth.uid(),now()
 )
 on conflict(event_id) do update set
  event_type=excluded.event_type,title=excluded.title,eyebrow=excluded.eyebrow,
  summary=excluded.summary,description=excluded.description,artwork_url=excluded.artwork_url,
  starts_at=excluded.starts_at,ends_at=excluded.ends_at,rewards=excluded.rewards,
  activities=excluded.activities,is_published=excluded.is_published,
  sort_order=excluded.sort_order,updated_at=now();
 return jsonb_build_object('success',true,'event_id',p_event_id);
end;
$$;

create or replace function public.archive_moderator_orlong_event(p_event_id text)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 update public.orlong_events set is_published=false,updated_at=now() where event_id=p_event_id;
 if not found then raise exception 'Event not found'; end if;
 return jsonb_build_object('success',true,'event_id',p_event_id);
end;
$$;

revoke all on function public.get_public_orlong_events() from public;
revoke all on function public.get_moderator_orlong_events() from public,anon;
revoke all on function public.save_moderator_orlong_event(text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb,jsonb,boolean,integer) from public,anon;
revoke all on function public.archive_moderator_orlong_event(text) from public,anon;
grant execute on function public.get_public_orlong_events() to anon,authenticated;
grant execute on function public.get_moderator_orlong_events() to authenticated;
grant execute on function public.save_moderator_orlong_event(text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb,jsonb,boolean,integer) to authenticated;
grant execute on function public.archive_moderator_orlong_event(text) to authenticated;

select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename='orlong_events';
