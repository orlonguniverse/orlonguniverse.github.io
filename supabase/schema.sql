-- THE TRIALS OF EDEN — reader engagement schema
-- Run this entire file in Supabase SQL Editor.
-- Public website access uses the publishable/anon key + these RLS policies.
-- NEVER put a service_role/secret key in website code.

create extension if not exists pgcrypto;

create table if not exists public.reader_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Reader' check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.reader_profiles
  add column if not exists avatar_url text;

create or replace function public.create_reader_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reader_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 40), ''), 'Reader')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_reader_profile on auth.users;
create trigger on_auth_user_created_reader_profile
after insert on auth.users
for each row execute procedure public.create_reader_profile();

create table if not exists public.chapter_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists public.series_interest (
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id text not null check (series_id ~ '^[a-z0-9-]{1,80}$'),
  interest text not null check (interest in ('interested', 'maybe', 'not_now')),
  updated_at timestamptz not null default now(),
  primary key (user_id, series_id)
);

create table if not exists public.chapter_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  reaction text not null check (reaction in ('like', 'love', 'shocked', 'sad', 'excited')),
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists public.chapter_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  parent_id uuid references public.chapter_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  contains_spoiler boolean not null default false,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists chapter_comments_chapter_status_created
  on public.chapter_comments (chapter_id, moderation_status, created_at desc);

alter table public.reader_profiles enable row level security;
alter table public.chapter_completions enable row level security;
alter table public.series_interest enable row level security;
alter table public.chapter_reactions enable row level security;
alter table public.chapter_comments enable row level security;

-- Reader display names are public; readers can only change their own.
drop policy if exists "Reader profiles are viewable" on public.reader_profiles;
create policy "Reader profiles are viewable"
  on public.reader_profiles for select using (true);
drop policy if exists "Readers create their own profile" on public.reader_profiles;
create policy "Readers create their own profile"
  on public.reader_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Readers update their own profile" on public.reader_profiles;
create policy "Readers update their own profile"
  on public.reader_profiles for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Completion is private to the signed-in reader; the unique key prevents duplicates.
drop policy if exists "Readers view their own completions" on public.chapter_completions;
create policy "Readers view their own completions"
  on public.chapter_completions for select using (auth.uid() = user_id);
drop policy if exists "Readers record their own completions" on public.chapter_completions;
create policy "Readers record their own completions"
  on public.chapter_completions for insert with check (auth.uid() = user_id);
drop policy if exists "Readers remove their own completions" on public.chapter_completions;
create policy "Readers remove their own completions"
  on public.chapter_completions for delete using (auth.uid() = user_id);

-- One interest choice per reader and series; later choices update the existing row.
drop policy if exists "Readers view their own series interests" on public.series_interest;
create policy "Readers view their own series interests"
  on public.series_interest for select using (auth.uid() = user_id);
drop policy if exists "Readers set their own series interests" on public.series_interest;
create policy "Readers set their own series interests"
  on public.series_interest for insert with check (auth.uid() = user_id);
drop policy if exists "Readers update their own series interests" on public.series_interest;
create policy "Readers update their own series interests"
  on public.series_interest for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One reaction per reader per chapter. A new choice replaces the previous one.
drop policy if exists "Readers view their own reactions" on public.chapter_reactions;
create policy "Readers view their own reactions"
  on public.chapter_reactions for select using (auth.uid() = user_id);
drop policy if exists "Readers add their own reactions" on public.chapter_reactions;
create policy "Readers add their own reactions"
  on public.chapter_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "Readers change their own reactions" on public.chapter_reactions;
create policy "Readers change their own reactions"
  on public.chapter_reactions for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Readers remove their own reactions" on public.chapter_reactions;
create policy "Readers remove their own reactions"
  on public.chapter_reactions for delete using (auth.uid() = user_id);

-- Only approved comments are public. Authors can see their own pending/hidden comments.
drop policy if exists "Approved comments and own submissions are visible" on public.chapter_comments;
create policy "Approved comments and own submissions are visible"
  on public.chapter_comments for select
  using (moderation_status = 'approved' or auth.uid() = user_id);
drop policy if exists "Signed-in readers submit pending comments" on public.chapter_comments;
create policy "Signed-in readers submit pending comments"
  on public.chapter_comments for insert
  with check (auth.uid() = user_id and moderation_status = 'pending');
drop policy if exists "Readers delete their own pending comments" on public.chapter_comments;
create policy "Readers delete their own pending comments"
  on public.chapter_comments for delete
  using (auth.uid() = user_id and moderation_status = 'pending');

-- Public-facing statistics contain totals only, never account IDs or email addresses.
create or replace function public.get_public_engagement_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chapter_id', chapter_id,
        'completions', completion_count,
        'reactions', reaction_count,
        'comments', comment_count
      ) order by chapter_id)
      from (
        select chapter_id,
          (select count(*) from public.chapter_completions cc where cc.chapter_id = c.chapter_id) as completion_count,
          (select count(*) from public.chapter_reactions cr where cr.chapter_id = c.chapter_id) as reaction_count,
          (select count(*) from public.chapter_comments cm where cm.chapter_id = c.chapter_id and cm.moderation_status = 'approved') as comment_count
        from (
          select chapter_id from public.chapter_completions
          union select chapter_id from public.chapter_reactions
          union select chapter_id from public.chapter_comments where moderation_status = 'approved'
        ) c
      ) totals
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'series_id', series_id,
        'interested', interested_count,
        'maybe', maybe_count
      ) order by series_id)
      from (
        select series_id,
          count(*) filter (where interest = 'interested') as interested_count,
          count(*) filter (where interest = 'maybe') as maybe_count
        from public.series_interest
        group by series_id
      ) series_totals
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_public_engagement_stats() from public;
grant execute on function public.get_public_engagement_stats() to anon, authenticated;

grant select, insert, update on public.reader_profiles to authenticated;
grant select, insert, delete on public.chapter_completions to authenticated;
grant select, insert, update on public.series_interest to authenticated;
grant select, insert, update, delete on public.chapter_reactions to authenticated;
grant select, insert, delete on public.chapter_comments to authenticated;

-- Existing users created before this schema get a profile row too.
insert into public.reader_profiles (user_id, display_name)
select id, coalesce(nullif(left(trim(raw_user_meta_data ->> 'display_name'), 40), ''), 'Reader')
from auth.users
on conflict (user_id) do nothing;


-- Moderation and reporting extension.
create table if not exists public.reader_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.reader_moderators enable row level security;
drop policy if exists "Moderators can see their own role" on public.reader_moderators;
create policy "Moderators can see their own role" on public.reader_moderators
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_reader_moderator()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.reader_moderators where user_id = auth.uid());
$$;
revoke all on function public.is_reader_moderator() from public;
grant execute on function public.is_reader_moderator() to anon, authenticated;

drop policy if exists "Moderators can view all comments" on public.chapter_comments;
create policy "Moderators can view all comments" on public.chapter_comments
  for select to authenticated using (public.is_reader_moderator());
drop policy if exists "Moderators can moderate comments" on public.chapter_comments;
create policy "Moderators can moderate comments" on public.chapter_comments
  for update to authenticated using (public.is_reader_moderator())
  with check (public.is_reader_moderator());

create table if not exists public.chapter_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.chapter_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
alter table public.chapter_comment_reports enable row level security;
drop policy if exists "Readers report comments once" on public.chapter_comment_reports;
create policy "Readers report comments once" on public.chapter_comment_reports
  for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Moderators review reports" on public.chapter_comment_reports;
create policy "Moderators review reports" on public.chapter_comment_reports
  for select to authenticated using (public.is_reader_moderator());
grant select, insert on public.chapter_comment_reports to authenticated;

create or replace function public.get_author_engagement_stats()
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_reader_moderator() then
    raise exception 'Not authorised';
  end if;
  return jsonb_build_object(
    'unique_readers', (select count(distinct user_id) from public.chapter_completions),
    'chapter_completions', (select count(*) from public.chapter_completions),
    'pending_comments', (select count(*) from public.chapter_comments where moderation_status = 'pending'),
    'approved_comments', (select count(*) from public.chapter_comments where moderation_status = 'approved'),
    'series_interest', (select count(*) from public.series_interest where interest = 'interested'),
    'chapter_activity', coalesce((select jsonb_agg(jsonb_build_object('chapter_id', chapter_id, 'completions', total) order by chapter_id)
      from (select chapter_id, count(*) as total from public.chapter_completions group by chapter_id) activity), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_author_engagement_stats() from public;
grant execute on function public.get_author_engagement_stats() to authenticated;

-- To grant the author moderation access, run this separately in the SQL Editor
-- after creating your own reader account, replacing the UUID with your auth.users.id:
-- insert into public.reader_moderators (user_id) values ('YOUR-AUTH-USER-UUID')
-- on conflict (user_id) do nothing;

-- Approved discussions are readable without an account; RLS still hides pending/hidden submissions.
grant select on public.chapter_comments to anon;


-- Reader content preferences: multiple categories may be selected by each reader.
create table if not exists public.reader_content_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  interest_id text not null check (interest_id in ('characters','plot','worldbuilding','relationships','action','other')),
  other_detail text check (other_detail is null or char_length(other_detail) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, interest_id),
  check (interest_id = 'other' or other_detail is null)
);
alter table public.reader_content_interests enable row level security;
drop policy if exists "Readers view their own content preferences" on public.reader_content_interests;
create policy "Readers view their own content preferences"
  on public.reader_content_interests for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Readers add their own content preferences" on public.reader_content_interests;
create policy "Readers add their own content preferences"
  on public.reader_content_interests for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Readers remove their own content preferences" on public.reader_content_interests;
create policy "Readers remove their own content preferences"
  on public.reader_content_interests for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.reader_content_interests to authenticated;

-- Public anonymous dashboard: aggregate totals only; no user IDs, emails or free-text suggestions.
create or replace function public.get_public_engagement_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chapter_id', chapter_id,
        'completions', completion_count,
        'reactions', reaction_count,
        'comments', comment_count
      ) order by chapter_id)
      from (
        select chapter_id,
          (select count(*) from public.chapter_completions cc where cc.chapter_id = c.chapter_id) as completion_count,
          (select count(*) from public.chapter_reactions cr where cr.chapter_id = c.chapter_id) as reaction_count,
          (select count(*) from public.chapter_comments cm where cm.chapter_id = c.chapter_id and cm.moderation_status = 'approved') as comment_count
        from (
          select chapter_id from public.chapter_completions
          union select chapter_id from public.chapter_reactions
          union select chapter_id from public.chapter_comments where moderation_status = 'approved'
        ) c
      ) totals
    ), '[]'::jsonb),
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object('reaction', reaction, 'responses', responses) order by reaction)
      from (
        select reaction, count(*) as responses
        from public.chapter_reactions
        group by reaction
      ) reaction_totals
    ), '[]'::jsonb),
    'content_interests', coalesce((
      select jsonb_agg(jsonb_build_object('interest_id',interest_id,'responses',responses) order by interest_id)
      from (
        select interest_id,count(*) as responses
        from public.reader_content_interests
        group by interest_id
      ) preferences
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.get_public_engagement_stats() from public;
grant execute on function public.get_public_engagement_stats() to anon, authenticated;


-- Private manuscript delivery. Chapter HTML must never be stored in the public GitHub Pages folder.
insert into storage.buckets (id, name, public)
values ('eden-chapters', 'eden-chapters', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated readers can download Eden chapters" on storage.objects;
create policy "Authenticated readers can download Eden chapters"
  on storage.objects for select to authenticated
  using (bucket_id = 'eden-chapters');

-- Storage downloads are authenticated-only. Upload manuscript files through the
-- Supabase Dashboard as the project owner; do not make this bucket public.


-- Immutable chapter quiz attempts. Readers may submit multiple attempts,
-- but each submission is a separate row and cannot be edited or deleted.
create table if not exists public.chapter_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  quiz_version text not null default '1',
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = 3),
  score integer not null check (score between 0 and 3),
  total_questions integer not null default 3 check (total_questions = 3),
  submitted_at timestamptz not null default now()
);
create index if not exists chapter_quiz_attempts_reader_chapter
  on public.chapter_quiz_attempts (user_id, chapter_id, submitted_at desc);
alter table public.chapter_quiz_attempts enable row level security;
drop policy if exists "Readers view their own quiz attempts" on public.chapter_quiz_attempts;
create policy "Readers view their own quiz attempts"
  on public.chapter_quiz_attempts for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Readers submit their own quiz attempts" on public.chapter_quiz_attempts;
create policy "Readers submit their own quiz attempts"
  on public.chapter_quiz_attempts for insert to authenticated
  with check (auth.uid() = user_id);
revoke all on public.chapter_quiz_attempts from anon, authenticated;
grant select, insert on public.chapter_quiz_attempts to authenticated;


-- Ensure signed-in readers can remove only their own chapter reactions.
-- Safe to run more than once in the Supabase SQL Editor.
drop policy if exists "Readers remove their own reactions" on public.chapter_reactions;
create policy "Readers remove their own reactions"
  on public.chapter_reactions for delete
  using (auth.uid() = user_id);


-- Reliable, account-scoped reaction removal.
-- The function can delete only the signed-in reader's own reaction.
create or replace function public.remove_own_chapter_reaction(target_chapter_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to remove a reaction.';
  end if;

  delete from public.chapter_reactions
  where user_id = auth.uid()
    and chapter_id = target_chapter_id;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

revoke all on function public.remove_own_chapter_reaction(text) from public;
grant execute on function public.remove_own_chapter_reaction(text) to authenticated;
