-- ============================================================
-- ORLONG ACCESS CODES — STAGE 1: SECURE CODE AND REDEMPTION FOUNDATION
-- Run once in Supabase SQL Editor. Safe to rerun.
--
-- Readers must be signed in to redeem a code. Codes are stored as
-- SHA-256 hashes; the plaintext is returned only once by the admin
-- creation function. Grants remain permanent after code expiry.
--
-- Admin authority reuses public.reader_moderators from schema.sql.
-- NEVER put a service_role/secret key in website code.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.access_code_campaigns (
  campaign_id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(trim(label)) between 1 and 100),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  code_prefix text not null,
  access_keys text[] not null check (
    cardinality(access_keys) between 1 and 20
    and array_position(access_keys, null) is null
  ),
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.access_code_redemptions (
  redemption_id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.access_code_campaigns(campaign_id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists access_code_redemptions_user
  on public.access_code_redemptions(user_id, redeemed_at desc);

create table if not exists public.reader_access_grants (
  grant_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  access_key text not null check (access_key ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  campaign_id uuid not null references public.access_code_campaigns(campaign_id) on delete restrict,
  granted_at timestamptz not null default now(),
  unique (user_id, access_key, campaign_id)
);

create index if not exists reader_access_grants_user
  on public.reader_access_grants(user_id, access_key);

alter table public.access_code_campaigns enable row level security;
alter table public.access_code_redemptions enable row level security;
alter table public.reader_access_grants enable row level security;

revoke all on public.access_code_campaigns from anon, authenticated;
revoke all on public.access_code_redemptions from anon, authenticated;
revoke all on public.reader_access_grants from anon, authenticated;

-- Create a code as a moderator. The plaintext is returned once only.
-- Example access keys: early_access, event:summer-launch, feature:arena.
drop function if exists public.create_access_code(text, text[], timestamptz, integer);

create or replace function public.create_access_code(
  campaign_label text,
  granted_access_keys text[],
  code_expires_at timestamptz default null,
  redemption_limit integer default null,
  custom_code text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_code text;
  normalized_code text;
  key_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.reader_moderators m where m.user_id = auth.uid()
  ) then
    raise exception 'Not authorised to create access codes';
  end if;

  if campaign_label is null or char_length(trim(campaign_label)) not between 1 and 100 then
    raise exception 'Enter a campaign label between 1 and 100 characters';
  end if;
  if granted_access_keys is null or cardinality(granted_access_keys) not between 1 and 20 then
    raise exception 'Choose between 1 and 20 access permissions';
  end if;
  if exists (
    select 1 from unnest(granted_access_keys) as k
    where k !~ '^[a-z0-9][a-z0-9:_-]{0,79}$'
  ) then
    raise exception 'Access permissions may contain lowercase letters, numbers, colon, underscore and hyphen only';
  end if;
  select count(distinct k) into key_count from unnest(granted_access_keys) as k;
  if key_count <> cardinality(granted_access_keys) then
    raise exception 'Access permissions cannot contain duplicates';
  end if;
  if redemption_limit is not null and redemption_limit < 1 then
    raise exception 'Redemption limit must be at least 1';
  end if;
  if code_expires_at is not null and code_expires_at <= now() then
    raise exception 'Expiry must be in the future';
  end if;

  if custom_code is not null and trim(custom_code) <> '' then
    if trim(custom_code) !~ '^[A-Za-z0-9]{6,40}$' then
      raise exception 'Custom codes must be 6–40 letters or numbers, with no spaces or symbols';
    end if;
    new_code := trim(custom_code);
  else
    new_code := 'ORLONG-' || upper(substr(encode(gen_random_bytes(16), 'hex'), 1, 20));
  end if;

  normalized_code := regexp_replace(upper(new_code), '[^A-Z0-9]', '', 'g');

  if exists (
    select 1 from public.access_code_campaigns c
    where c.code_hash = encode(digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex')
  ) then
    raise exception 'That access code is already in use. Please choose a different custom code';
  end if;

  insert into public.access_code_campaigns
    (label, code_hash, code_prefix, access_keys, expires_at, max_redemptions, created_by)
  values (
    trim(campaign_label),
    encode(digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex'),
    left(upper(new_code), 3),
    granted_access_keys,
    code_expires_at,
    redemption_limit,
    auth.uid()
  );

  return new_code;
end;
$$;

-- Redeem a code for the currently authenticated reader. The campaign
-- row is locked so simultaneous requests cannot exceed its redemption cap.
create or replace function public.redeem_access_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  reader_id uuid := auth.uid();
  normalized_code text;
  campaign public.access_code_campaigns%rowtype;
  redemption_id uuid;
  was_already_redeemed boolean := false;
begin
  if reader_id is null then
    raise exception 'Please sign in before redeeming an access code';
  end if;

  if input_code is null or char_length(trim(input_code)) < 6 or char_length(trim(input_code)) > 100 then
    return jsonb_build_object('success', false, 'message', 'Enter a valid access code.');
  end if;

  normalized_code := regexp_replace(upper(trim(input_code)), '[^A-Z0-9]', '', 'g');

  select * into campaign
  from public.access_code_campaigns c
  where c.code_hash = encode(digest(convert_to(normalized_code, 'UTF8'), 'sha256'), 'hex')
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'That access code was not recognised.');
  end if;
  if not campaign.is_active then
    return jsonb_build_object('success', false, 'message', 'That access code is no longer active.');
  end if;
  if campaign.expires_at is not null and campaign.expires_at <= now() then
    return jsonb_build_object('success', false, 'message', 'That access code has expired.');
  end if;

  select r.redemption_id into redemption_id
  from public.access_code_redemptions r
  where r.campaign_id = campaign.campaign_id and r.user_id = reader_id;

  if redemption_id is not null then
    was_already_redeemed := true;
  else
    if campaign.max_redemptions is not null
       and campaign.redemption_count >= campaign.max_redemptions then
      return jsonb_build_object('success', false, 'message', 'That access code has reached its redemption limit.');
    end if;

    insert into public.access_code_redemptions(campaign_id, user_id)
    values (campaign.campaign_id, reader_id)
    returning access_code_redemptions.redemption_id into redemption_id;

    update public.access_code_campaigns
    set redemption_count = redemption_count + 1
    where campaign_id = campaign.campaign_id;
  end if;

  insert into public.reader_access_grants(user_id, access_key, campaign_id)
  select reader_id, k, campaign.campaign_id
  from unnest(campaign.access_keys) as k
  on conflict (user_id, access_key, campaign_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'already_redeemed', was_already_redeemed,
    'message', case when was_already_redeemed
      then 'You have already redeemed this code. Your access remains active.'
      else 'Access successfully unlocked. Your permission is saved to your account.'
    end,
    'access_keys', campaign.access_keys
  );
end;
$$;

-- A reader can retrieve only their own permanent access permissions.
create or replace function public.get_my_access_grants()
returns table (
  access_key text,
  granted_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select g.access_key, min(g.granted_at)
  from public.reader_access_grants g
  where g.user_id = auth.uid()
  group by g.access_key
  order by g.access_key;
$$;

revoke all on function public.create_access_code(text, text[], timestamptz, integer, text) from public, anon;
revoke all on function public.redeem_access_code(text) from public, anon;
revoke all on function public.get_my_access_grants() from public, anon;

grant execute on function public.create_access_code(text, text[], timestamptz, integer, text) to authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;
grant execute on function public.get_my_access_grants() to authenticated;

-- Verification: these three tables should exist with RLS enabled.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('access_code_campaigns', 'access_code_redemptions', 'reader_access_grants')
order by tablename;
