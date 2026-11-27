-- ORLONG MODERATOR — READER COLLECTION RESET & FACTORY RESET
-- Run once in Supabase SQL Editor after the existing Orlong schema and stage migrations.
-- Reader login and avatar are deliberately preserved. Reset audit history is retained.

create table if not exists public.reader_account_reset_log (
  reset_id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  target_email text,
  target_display_name text,
  performed_by uuid,
  reset_mode text not null check (reset_mode in ('collection','factory')),
  deleted_records jsonb not null default '{}'::jsonb,
  performed_at timestamptz not null default now()
);

alter table public.reader_account_reset_log enable row level security;
revoke all on public.reader_account_reset_log from anon, authenticated;

create or replace function public.moderator_search_reader_accounts(search_text text default '')
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  is_moderator boolean
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare q text := lower(trim(coalesce(search_text,'')));
begin
  if not public.is_reader_moderator() then
    raise exception 'Moderator access required';
  end if;
  if char_length(q) < 2 then
    return;
  end if;
  return query
  select u.id,
         u.email::text,
         coalesce(nullif(p.display_name,''),split_part(coalesce(u.email,''),'@',1),'Reader'),
         p.avatar_url,
         u.created_at,
         exists(select 1 from public.reader_moderators rm where rm.user_id=u.id)
  from auth.users u
  left join public.reader_profiles p on p.user_id=u.id
  where lower(coalesce(u.email,'')) like '%'||q||'%'
     or lower(coalesce(p.display_name,'')) like '%'||q||'%'
  order by u.created_at desc
  limit 30;
end;
$$;

create or replace function public.moderator_reset_reader_account(
  target_user_id uuid,
  reset_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_email text;
  target_name text;
  counts jsonb := '{}'::jsonb;
  n integer := 0;
begin
  if not public.is_reader_moderator() then
    raise exception 'Moderator access required';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'You cannot reset your own moderator account';
  end if;
  if reset_mode not in ('collection','factory') then
    raise exception 'Unknown reset mode';
  end if;

  select u.email, coalesce(p.display_name, split_part(coalesce(u.email,''),'@',1),'Reader')
    into target_email,target_name
  from auth.users u
  left join public.reader_profiles p on p.user_id=u.id
  where u.id=target_user_id
  for update of u;
  if not found then raise exception 'Reader account not found'; end if;

  -- Remove offers first so their references never block collection deletion.
  delete from public.card_trade_offers
   where proposer_user_id=target_user_id or recipient_user_id=target_user_id;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('trade_offers',n);

  delete from public.reader_card_copies where owner_user_id=target_user_id;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('card_copies',n);

  delete from public.card_reward_claims where user_id=target_user_id;
  get diagnostics n = row_count;
  counts := counts || jsonb_build_object('card_reward_claims',n);

  if reset_mode = 'factory' then
    delete from public.reader_achievement_unlocks where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('achievement_unlocks',n);

    delete from public.early_access_mission_completions where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('early_access_mission_completions',n);

    delete from public.early_access_mission_visits where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('early_access_mission_visits',n);

    delete from public.early_access_mission_feedback where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('early_access_feedback_entries',n);

    delete from public.founding_readers where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('founding_reader_records',n);

    delete from public.reader_access_grants where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('access_grants',n);

    delete from public.access_code_redemptions where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('access_code_redemptions',n);

    delete from public.chapter_completions where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('chapter_completions',n);

    delete from public.chapter_reactions where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('chapter_reactions',n);

    -- Detach other readers' replies before removing this reader's comments,
    -- preventing a reset from cascading into somebody else's contributions.
    update public.chapter_comments
       set parent_id=null
     where parent_id in (
       select id from public.chapter_comments where user_id=target_user_id
     ) and user_id<>target_user_id;

    delete from public.chapter_comment_reports where reporter_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('reports_submitted',n);

    delete from public.chapter_comments where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('comments_and_replies',n);

    delete from public.chapter_quiz_attempts where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('chapter_quiz_attempts',n);

    delete from public.series_interest where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('series_interest',n);

    delete from public.reader_content_interests where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('reader_content_interests',n);

    delete from public.reader_card_settings where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('card_settings',n);

    -- Preserve the login and avatar URL; reset the public-facing name only.
    update public.reader_profiles
       set display_name='Reader'
     where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('profile_names_reset',n);

    -- Moderator status is revoked, but historical moderation audit records stay.
    delete from public.reader_moderators where user_id=target_user_id;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object('moderator_privileges_revoked',n);
  end if;

  insert into public.reader_account_reset_log
    (target_user_id,target_email,target_display_name,performed_by,reset_mode,deleted_records)
  values
    (target_user_id,target_email,target_name,auth.uid(),reset_mode,counts);

  return jsonb_build_object(
    'success',true,
    'reset_mode',reset_mode,
    'email',target_email,
    'display_name',target_name,
    'preserved_login',true,
    'preserved_avatar',true,
    'deleted_records',counts
  );
end;
$$;

revoke all on function public.moderator_search_reader_accounts(text) from public, anon;
revoke all on function public.moderator_reset_reader_account(uuid,text) from public, anon;
grant execute on function public.moderator_search_reader_accounts(text) to authenticated;
grant execute on function public.moderator_reset_reader_account(uuid,text) to authenticated;

create or replace function public.moderator_get_reader_reset_log()
returns table (
  reset_id uuid,
  target_email text,
  target_display_name text,
  reset_mode text,
  deleted_records jsonb,
  performed_at timestamptz,
  moderator_email text
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
  return query
  select l.reset_id,l.target_email,l.target_display_name,l.reset_mode,l.deleted_records,
         l.performed_at,u.email::text
  from public.reader_account_reset_log l
  left join auth.users u on u.id=l.performed_by
  order by l.performed_at desc
  limit 50;
end;
$$;
revoke all on function public.moderator_get_reader_reset_log() from public, anon;
grant execute on function public.moderator_get_reader_reset_log() to authenticated;
