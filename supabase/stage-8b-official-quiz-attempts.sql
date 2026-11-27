-- Stage 8B — enforce one official quiz attempt per reader, chapter and quiz version.
-- Existing readers with multiple historical submissions keep their earliest attempt.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, chapter_id, quiz_version
           order by submitted_at asc, id asc
         ) as attempt_number
  from public.chapter_quiz_attempts
)
delete from public.chapter_quiz_attempts a
using ranked r
where a.id = r.id
  and r.attempt_number > 1;

create unique index if not exists chapter_quiz_one_official_attempt
  on public.chapter_quiz_attempts (user_id, chapter_id, quiz_version);

comment on index public.chapter_quiz_one_official_attempt is
  'Enforces one permanent official quiz attempt per reader, chapter and quiz version.';
