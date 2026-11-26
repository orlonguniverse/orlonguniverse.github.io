-- The Trials of Eden — secure reaction removal
-- Run this complete script once in the Supabase SQL Editor.
-- A reader can remove only their own reaction. No client-side service key is used.

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
