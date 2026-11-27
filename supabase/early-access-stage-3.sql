-- ============================================================
-- ORLONG EARLY ACCESS — STAGE 3: TESTING MISSIONS & PROGRESS
-- Run after early-access-stage-2.sql.
--
-- Mission completion is a reader self-attestation: the reader
-- confirms they have completed the described test. The server
-- enforces Early Access permission and stores completion per user.
-- ============================================================

create table if not exists public.early_access_missions (
  mission_key text primary key check (mission_key ~ '^[a-z0-9-]{1,80}$'),
  title text not null check (char_length(title) between 1 and 100),
  category text not null check (char_length(category) between 1 and 60),
  description text not null check (char_length(description) between 1 and 1000),
  instructions text not null check (char_length(instructions) between 1 and 1500),
  action_label text not null check (char_length(action_label) between 1 and 50),
  action_url text not null check (action_url ~ '^/[a-zA-Z0-9/_#?=&.-]*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.early_access_mission_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_key text not null references public.early_access_missions(mission_key) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, mission_key)
);

create index if not exists early_access_mission_completions_user
  on public.early_access_mission_completions(user_id, completed_at desc);

alter table public.early_access_missions enable row level security;
alter table public.early_access_mission_completions enable row level security;
revoke all on public.early_access_missions from anon, authenticated;
revoke all on public.early_access_mission_completions from anon, authenticated;

insert into public.early_access_missions
 (mission_key,title,category,description,instructions,action_label,action_url,sort_order,is_active)
values
 ('account-profile','Your Account','GETTING STARTED',
  'Make sure your reader account and profile are ready.',
  'Sign in to your reader account, check your Statistics page, and try setting or changing your profile picture if you have not already.',
  'OPEN MY STATISTICS','/books/trials-of-eden/account.html#dashboard',1,true),
 ('reading-room','Explore the Reading Room','READING EXPERIENCE',
  'Put the Reading Room through its paces.',
  'Open The Trials of Eden Reading Room. Try the chapter directory, previous and next chapter controls, reading themes, fonts and the available reading preferences.',
  'OPEN THE READING ROOM','/books/trials-of-eden/index.html#chapter',2,true),
 ('chapter-challenge','Take a Chapter Challenge','READING EXPERIENCE',
  'Try a chapter quiz and check that the experience feels clear.',
  'Complete an available Chapter Challenge. Check that the answer buttons, selected-answer highlight, submission and result are all working as expected.',
  'OPEN THE READING ROOM','/books/trials-of-eden/index.html#chapter',3,true),
 ('collectible-binder','Visit Your Collectible Binder','COLLECTIBLES',
  'See how collectible cards are awarded and displayed.',
  'Open your Statistics page and inspect your card collection. If you have not earned a card yet, complete an eligible Reading Room activity first.',
  'OPEN MY STATISTICS','/books/trials-of-eden/account.html#dashboard',4,true),
 ('trading-post','Try the Trading Post','COLLECTIBLES',
  'Explore the card-trading experience.',
  'Open the Trading Post from your account area. If possible, use a second reader account to test creating, accepting and dismissing a trade offer. Never share your password.',
  'OPEN MY STATISTICS','/books/trials-of-eden/account.html#dashboard',5,true),
 ('achievements','Check Your Achievements','COLLECTIBLES',
  'Review the achievements connected to your reader activity.',
  'Find your achievements on the Statistics page. Check that unlocked achievements and progress descriptions make sense.',
  'OPEN MY STATISTICS','/books/trials-of-eden/account.html#dashboard',6,true),
 ('community','Explore the Reader Community','COMMUNITY',
  'Try the social features available to readers.',
  'If available, try leaving a chapter reaction or comment and look at the public reader activity. Please keep comments respectful and avoid posting spoilers without marking them.',
  'OPEN THE READING ROOM','/books/trials-of-eden/index.html#chapter',7,true),
 ('final-review','Prepare Your Tester Feedback','FINAL REVIEW',
  'Think about what worked well and what could be improved.',
  'Make a note of any bugs, confusing moments or ideas you would like to share. The dedicated feedback submission area will be added in a later stage; marking this mission complete confirms you have prepared your notes.',
  'OPEN MY STATISTICS','/books/trials-of-eden/account.html#dashboard',8,true)
on conflict (mission_key) do update set
 title=excluded.title,
 category=excluded.category,
 description=excluded.description,
 instructions=excluded.instructions,
 action_label=excluded.action_label,
 action_url=excluded.action_url,
 sort_order=excluded.sort_order,
 is_active=excluded.is_active;

create or replace function public.get_my_early_access_missions()
returns table (
 mission_key text,
 title text,
 category text,
 description text,
 instructions text,
 action_label text,
 action_url text,
 sort_order integer,
 is_completed boolean,
 completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
begin
 if reader_id is null then
  raise exception 'Authentication required';
 end if;

 if not exists (
  select 1 from public.reader_access_grants g
  where g.user_id = reader_id and g.access_key = 'early_access'
 ) then
  raise exception 'Early Access permission required';
 end if;

 return query
 select m.mission_key,m.title,m.category,m.description,m.instructions,
  m.action_label,m.action_url,m.sort_order,
  (c.mission_key is not null),c.completed_at
 from public.early_access_missions m
 left join public.early_access_mission_completions c
  on c.mission_key=m.mission_key and c.user_id=reader_id
 where m.is_active=true
 order by m.sort_order,m.title;
end;
$$;

create or replace function public.complete_early_access_mission(target_mission_key text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
 completion_time timestamptz;
begin
 if reader_id is null then
  raise exception 'Authentication required';
 end if;

 if not exists (
  select 1 from public.reader_access_grants g
  where g.user_id = reader_id and g.access_key = 'early_access'
 ) then
  raise exception 'Early Access permission required';
 end if;

 if target_mission_key is null or target_mission_key !~ '^[a-z0-9-]{1,80}$'
  or not exists (
   select 1 from public.early_access_missions m
   where m.mission_key=target_mission_key and m.is_active=true
  ) then
  raise exception 'Mission not found or no longer active';
 end if;

 insert into public.early_access_mission_completions(user_id,mission_key)
 values(reader_id,target_mission_key)
 on conflict (user_id,mission_key) do nothing;

 select c.completed_at into completion_time
 from public.early_access_mission_completions c
 where c.user_id=reader_id and c.mission_key=target_mission_key;

 return completion_time;
end;
$$;

revoke all on function public.get_my_early_access_missions() from public, anon;
revoke all on function public.complete_early_access_mission(text) from public, anon;
grant execute on function public.get_my_early_access_missions() to authenticated;
grant execute on function public.complete_early_access_mission(text) to authenticated;

-- Verification: eight active missions should be returned here.
select mission_key,title,sort_order,is_active
from public.early_access_missions
where is_active=true
order by sort_order;
