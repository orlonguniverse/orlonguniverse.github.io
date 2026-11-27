-- ============================================================
-- ORLONG COLLECTIBLE CARDS — STAGE 5: READER ACHIEVEMENTS
-- Run in Supabase SQL Editor after Stage 3.
--
-- Stores permanent achievement unlocks. Progress is calculated
-- from each signed-in reader's existing Reading Room activity.
-- No currency or bonus card rewards are issued in this stage.
-- ============================================================

create table if not exists public.card_achievement_catalogue (
  achievement_id text primary key check (achievement_id ~ '^[a-z0-9-]{1,80}$'),
  title text not null,
  description text not null,
  metric_key text not null check (metric_key in (
    'chapters_completed','reactions_made','challenges_submitted',
    'perfect_challenges','approved_comments','cards_earned','unique_cards'
  )),
  target_progress integer not null check (target_progress > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reader_achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.card_achievement_catalogue(achievement_id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists reader_achievement_unlocks_user
  on public.reader_achievement_unlocks(user_id, unlocked_at desc);

alter table public.card_achievement_catalogue enable row level security;
alter table public.reader_achievement_unlocks enable row level security;
revoke all on public.card_achievement_catalogue from anon, authenticated;
revoke all on public.reader_achievement_unlocks from anon, authenticated;

insert into public.card_achievement_catalogue
 (achievement_id,title,description,metric_key,target_progress,sort_order)
values
 ('first-chapter','First Chapter','Complete your first released chapter.','chapters_completed',1,1),
 ('dedicated-reader','Dedicated Reader','Complete five released chapters.','chapters_completed',5,2),
 ('first-reaction','First Reaction','Leave your first reaction on a chapter.','reactions_made',1,3),
 ('challenge-accepted','Challenge Accepted','Submit your first chapter challenge.','challenges_submitted',1,4),
 ('perfect-score','Perfect Score','Earn full marks on a chapter challenge.','perfect_challenges',1,5),
 ('joining-the-conversation','Joining the Conversation','Have your first chapter comment approved.','approved_comments',1,6),
 ('first-collectible','First Collectible','Earn your first collectible card.','cards_earned',1,7),
 ('growing-collection','Growing Collection','Collect three different cards.','unique_cards',3,8)
on conflict (achievement_id) do update set
 title=excluded.title, description=excluded.description,
 metric_key=excluded.metric_key, target_progress=excluded.target_progress,
 sort_order=excluded.sort_order, is_active=true;

create or replace function public.get_my_achievements()
returns table (
 achievement_id text,
 title text,
 description text,
 progress bigint,
 target_progress integer,
 is_unlocked boolean,
 unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
 reader_id uuid := auth.uid();
begin
 if reader_id is null then
  raise exception 'Authentication required';
 end if;

 with reader_metrics as (
  select
   (select count(*) from public.chapter_completions x where x.user_id=reader_id) as chapters_completed,
   (select count(*) from public.chapter_reactions x where x.user_id=reader_id) as reactions_made,
   (select count(*) from public.chapter_quiz_attempts x where x.user_id=reader_id) as challenges_submitted,
   (select count(*) from public.chapter_quiz_attempts x where x.user_id=reader_id and x.total_questions>0 and x.score=x.total_questions) as perfect_challenges,
   (select count(*) from public.chapter_comments x where x.user_id=reader_id and x.moderation_status='approved') as approved_comments,
   (select count(*) from public.reader_card_copies x where x.owner_user_id=reader_id) as cards_earned,
   (select count(distinct x.card_id) from public.reader_card_copies x where x.owner_user_id=reader_id) as unique_cards
 ), evaluated as (
  select a.achievement_id,
   case a.metric_key
    when 'chapters_completed' then m.chapters_completed
    when 'reactions_made' then m.reactions_made
    when 'challenges_submitted' then m.challenges_submitted
    when 'perfect_challenges' then m.perfect_challenges
    when 'approved_comments' then m.approved_comments
    when 'cards_earned' then m.cards_earned
    when 'unique_cards' then m.unique_cards
    else 0
   end::bigint as current_progress,
   a.target_progress
  from public.card_achievement_catalogue a cross join reader_metrics m
  where a.is_active=true
 )
 insert into public.reader_achievement_unlocks(user_id,achievement_id)
 select reader_id,e.achievement_id from evaluated e
 where e.current_progress>=e.target_progress
 on conflict on constraint reader_achievement_unlocks_pkey do nothing;

 return query
 select a.achievement_id,a.title,a.description,
  least(
   case a.metric_key
    when 'chapters_completed' then (select count(*) from public.chapter_completions x where x.user_id=reader_id)
    when 'reactions_made' then (select count(*) from public.chapter_reactions x where x.user_id=reader_id)
    when 'challenges_submitted' then (select count(*) from public.chapter_quiz_attempts x where x.user_id=reader_id)
    when 'perfect_challenges' then (select count(*) from public.chapter_quiz_attempts x where x.user_id=reader_id and x.total_questions>0 and x.score=x.total_questions)
    when 'approved_comments' then (select count(*) from public.chapter_comments x where x.user_id=reader_id and x.moderation_status='approved')
    when 'cards_earned' then (select count(*) from public.reader_card_copies x where x.owner_user_id=reader_id)
    when 'unique_cards' then (select count(distinct x.card_id) from public.reader_card_copies x where x.owner_user_id=reader_id)
    else 0
   end,
   a.target_progress
  )::bigint,
  a.target_progress,
  (u.achievement_id is not null),
  u.unlocked_at
 from public.card_achievement_catalogue a
 left join public.reader_achievement_unlocks u
  on u.achievement_id=a.achievement_id and u.user_id=reader_id
 where a.is_active=true
 order by a.sort_order;
end;
$$;

revoke all on function public.get_my_achievements() from public, anon;
grant execute on function public.get_my_achievements() to authenticated;

-- Verification: eight achievements should be listed.
select achievement_id,title,metric_key,target_progress,is_active
from public.card_achievement_catalogue
order by sort_order;
