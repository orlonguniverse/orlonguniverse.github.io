-- Orlong Stage 2.5 — Chapter Discussions & Moderation
-- Run once in the Supabase SQL Editor. Safe to re-run.

alter table public.chapter_comments
  add column if not exists category text not null default 'general';

alter table public.chapter_comments
  drop constraint if exists chapter_comments_category_check;
alter table public.chapter_comments
  add constraint chapter_comments_category_check
  check (category in ('general','question','theory'));

alter table public.chapter_comments
  drop constraint if exists chapter_comments_moderation_status_check;
alter table public.chapter_comments
  add constraint chapter_comments_moderation_status_check
  check (moderation_status in ('pending','approved','hidden','removed'));

alter table public.chapter_comment_reports
  add column if not exists status text not null default 'pending';
alter table public.chapter_comment_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.chapter_comment_reports
  add column if not exists reviewed_at timestamptz;
alter table public.chapter_comment_reports
  add column if not exists moderator_note text;

alter table public.chapter_comment_reports
  drop constraint if exists chapter_comment_reports_status_check;
alter table public.chapter_comment_reports
  add constraint chapter_comment_reports_status_check
  check (status in ('pending','dismissed','actioned'));

create index if not exists chapter_comments_chapter_created_idx
  on public.chapter_comments(chapter_id, created_at desc);
create index if not exists chapter_comments_category_idx
  on public.chapter_comments(chapter_id, category, created_at desc);
create index if not exists chapter_comment_reports_status_idx
  on public.chapter_comment_reports(status, created_at desc);

create table if not exists public.chapter_comment_moderation_log (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null,
  moderator_id uuid not null references auth.users(id) on delete restrict,
  previous_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.chapter_comment_moderation_log enable row level security;
drop policy if exists "Moderators view moderation history" on public.chapter_comment_moderation_log;
create policy "Moderators view moderation history"
  on public.chapter_comment_moderation_log for select to authenticated
  using (public.is_reader_moderator());
grant select on public.chapter_comment_moderation_log to authenticated;

create or replace function public.log_chapter_comment_moderation()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if old.moderation_status is distinct from new.moderation_status
     and public.is_reader_moderator() then
    insert into public.chapter_comment_moderation_log
      (comment_id, moderator_id, previous_status, new_status)
    values (new.id, auth.uid(), old.moderation_status, new.moderation_status);
  end if;
  return new;
end;
$$;

drop trigger if exists chapter_comment_moderation_audit on public.chapter_comments;
create trigger chapter_comment_moderation_audit
  after update of moderation_status on public.chapter_comments
  for each row execute function public.log_chapter_comment_moderation();

-- Keep removed comments out of public view; moderators retain access through RLS.
drop policy if exists "Approved comments and own submissions are visible" on public.chapter_comments;
create policy "Approved comments and own submissions are visible"
  on public.chapter_comments for select
  using ((moderation_status = 'approved' and moderation_status <> 'removed')
    or auth.uid() = user_id);

drop policy if exists "Moderators can view all comments" on public.chapter_comments;
create policy "Moderators can view all comments"
  on public.chapter_comments for select to authenticated
  using (public.is_reader_moderator());

-- Readers can see their own report submissions; moderators can review all reports.
drop policy if exists "Moderators review reports" on public.chapter_comment_reports;
create policy "Moderators review reports" on public.chapter_comment_reports
  for select to authenticated
  using (public.is_reader_moderator() or reporter_id = auth.uid());

drop policy if exists "Moderators update reports" on public.chapter_comment_reports;
create policy "Moderators update reports" on public.chapter_comment_reports
  for update to authenticated
  using (public.is_reader_moderator())
  with check (public.is_reader_moderator());

grant select, insert, update on public.chapter_comment_reports to authenticated;
