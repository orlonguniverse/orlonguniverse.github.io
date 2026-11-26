-- THE TRIALS OF EDEN — public reader profile pictures
-- Run once in Supabase Dashboard -> SQL Editor.
-- Profile images are intentionally public because they appear beside public comments.

alter table public.reader_profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reader-avatars',
  'reader-avatars',
  true,
  2097152,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view reader avatars" on storage.objects;
create policy "Public can view reader avatars"
  on storage.objects for select
  using (bucket_id = 'reader-avatars');

drop policy if exists "Readers upload their own avatar" on storage.objects;
create policy "Readers upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reader-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Readers update their own avatar" on storage.objects;
create policy "Readers update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'reader-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'reader-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Readers delete their own avatar" on storage.objects;
create policy "Readers delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'reader-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
