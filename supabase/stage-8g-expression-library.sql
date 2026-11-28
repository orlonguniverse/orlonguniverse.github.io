-- ============================================================
-- STAGE 8G — ORLONG EXPRESSION LIBRARY
-- Shared emoji, sticker, GIF and meme catalogue; reader requests;
-- chapter/card unlocks; comment attachments; moderator controls.
-- Run once in Supabase SQL Editor after the Reading Room and card
-- collection migrations.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.expression_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique check (asset_key ~ '^[a-z0-9-]{2,100}$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  asset_type text not null check (asset_type in ('emoji','sticker','gif','meme')),
  category text not null default 'community',
  asset_url text,
  preview_url text,
  emoji_text text,
  alt_text text not null default '',
  source text not null default 'orlong',
  provider_id text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_public boolean not null default true,
  unlock_chapter_ids text[] not null default '{}',
  unlock_card_ids uuid[] not null default '{}',
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expression_assets_payload_check check (
    (asset_type = 'emoji' and (nullif(emoji_text,'') is not null or nullif(asset_url,'') is not null))
    or (asset_type <> 'emoji' and nullif(asset_url,'') is not null)
  )
);
create index if not exists expression_assets_active_type_sort
  on public.expression_assets(is_active, asset_type, sort_order, created_at desc);

create table if not exists public.reader_expression_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.expression_assets(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unlock_reason text not null default 'progress',
  primary key(user_id, asset_id)
);
create index if not exists reader_expression_unlocks_user_idx
  on public.reader_expression_unlocks(user_id, unlocked_at desc);

create table if not exists public.expression_asset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_type text not null check (requested_type in ('sticker','gif','meme','emoji')),
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text not null check (char_length(trim(description)) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','declined','added')),
  moderator_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists expression_requests_status_created
  on public.expression_asset_requests(status, created_at desc);

create table if not exists public.expression_provider_settings (
  provider text primary key,
  public_api_key text not null default '',
  enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.chapter_comment_expression_assets (
  comment_id uuid not null references public.chapter_comments(id) on delete cascade,
  asset_id uuid not null references public.expression_assets(id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 4),
  primary key(comment_id, asset_id),
  unique(comment_id, position)
);
create index if not exists chapter_comment_expression_assets_asset_idx
  on public.chapter_comment_expression_assets(asset_id);

-- GIF-provider and catalogue media can be attached as a compact JSON payload.
alter table public.chapter_comments
 add column if not exists expression_attachments jsonb not null default '[]'::jsonb;
alter table public.chapter_comments
 drop constraint if exists chapter_comments_expression_attachments_check;
alter table public.chapter_comments
 add constraint chapter_comments_expression_attachments_check
 check (jsonb_typeof(expression_attachments)='array' and jsonb_array_length(expression_attachments)<=4);

alter table public.chapter_comments drop constraint if exists chapter_comments_body_check;
alter table public.chapter_comments add constraint chapter_comments_body_or_expression_check
 check (
  (char_length(trim(body)) between 1 and 2000)
  or (char_length(trim(body))=0 and jsonb_array_length(expression_attachments)>0)
 );

create or replace function public.validate_comment_expression_attachments()
returns trigger language plpgsql set search_path=public
as $
declare v_item jsonb; v_url text;
begin
 if jsonb_typeof(new.expression_attachments)<>'array' or jsonb_array_length(new.expression_attachments)>4 then
  raise exception 'A comment can contain up to four expression items.';
 end if;
 for v_item in select value from jsonb_array_elements(new.expression_attachments) loop
  if coalesce(v_item->>'type','') not in ('emoji','sticker','gif','meme') then
   raise exception 'Invalid expression item type.';
  end if;
  v_url:=nullif(v_item->>'url','');
  if v_url is not null and v_url !~ '^https://[A-Za-z0-9.-]+(/|$)' then
   raise exception 'Expression media must use a secure HTTPS address.';
  end if;
 end loop;
 return new;
end;
$;
drop trigger if exists chapter_comment_expression_attachment_validation on public.chapter_comments;
create trigger chapter_comment_expression_attachment_validation
 before insert or update of expression_attachments on public.chapter_comments
 for each row execute function public.validate_comment_expression_attachments();



alter table public.expression_assets enable row level security;
alter table public.reader_expression_unlocks enable row level security;
alter table public.expression_asset_requests enable row level security;
alter table public.expression_provider_settings enable row level security;
alter table public.chapter_comment_expression_assets enable row level security;

drop policy if exists "Readers view active expression assets" on public.expression_assets;
create policy "Readers view active expression assets" on public.expression_assets
 for select to authenticated using (is_active and (is_public or exists(select 1 from public.reader_expression_unlocks u where u.asset_id=id and u.user_id=auth.uid()) or public.is_reader_moderator()));
drop policy if exists "Readers view own expression unlocks" on public.reader_expression_unlocks;
create policy "Readers view own expression unlocks" on public.reader_expression_unlocks
 for select to authenticated using (auth.uid() = user_id or public.is_reader_moderator());
drop policy if exists "Readers submit own expression requests" on public.expression_asset_requests;
create policy "Readers submit own expression requests" on public.expression_asset_requests
 for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Readers view own expression requests" on public.expression_asset_requests;
create policy "Readers view own expression requests" on public.expression_asset_requests
 for select to authenticated using (auth.uid() = user_id or public.is_reader_moderator());
drop policy if exists "Readers view attached expression assets" on public.chapter_comment_expression_assets;
create policy "Readers view attached expression assets" on public.chapter_comment_expression_assets
 for select to authenticated using (true);
drop policy if exists "Readers attach expressions to own comments" on public.chapter_comment_expression_assets;
create policy "Readers attach expressions to own comments" on public.chapter_comment_expression_assets
 for insert to authenticated with check (
   exists(select 1 from public.chapter_comments c where c.id=comment_id and c.user_id=auth.uid())
   and exists(select 1 from public.expression_assets a where a.id=asset_id and a.is_active
     and (a.is_public or exists(select 1 from public.reader_expression_unlocks u where u.user_id=auth.uid() and u.asset_id=a.id)))
 );
drop policy if exists "Moderators manage expression assets" on public.expression_assets;
create policy "Moderators manage expression assets" on public.expression_assets
 for all to authenticated using (public.is_reader_moderator()) with check (public.is_reader_moderator());
drop policy if exists "Moderators manage expression requests" on public.expression_asset_requests;
create policy "Moderators manage expression requests" on public.expression_asset_requests
 for all to authenticated using (public.is_reader_moderator()) with check (public.is_reader_moderator());
drop policy if exists "Moderators manage expression provider settings" on public.expression_provider_settings;
create policy "Moderators manage expression provider settings" on public.expression_provider_settings
 for all to authenticated using (public.is_reader_moderator()) with check (public.is_reader_moderator());

grant select on public.expression_assets, public.reader_expression_unlocks,
 public.expression_asset_requests, public.chapter_comment_expression_assets to authenticated;
grant insert on public.expression_asset_requests, public.chapter_comment_expression_assets to authenticated;
grant select, insert, update, delete on public.expression_assets, public.expression_asset_requests,
 public.expression_provider_settings to authenticated;
grant select on public.expression_provider_settings to authenticated;

-- Public, curated catalogue plus each reader's own unlock state.
create or replace function public.get_my_expression_library()
returns table(
 asset_id uuid, asset_key text, title text, asset_type text, category text,
 asset_url text, preview_url text, emoji_text text, alt_text text,
 source text, provider_id text, is_featured boolean, is_unlocked boolean,
 unlock_chapter_ids text[], unlock_card_ids uuid[]
)
language sql stable security definer set search_path=public
as $$
 select a.id,a.asset_key,a.title,a.asset_type,a.category,case when a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator() then a.asset_url end,
        case when a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator() then a.preview_url end,
        case when a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator() then a.emoji_text end,
        a.alt_text,a.source,a.provider_id,a.is_featured,
        (a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator()),
        case when a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator() then a.unlock_chapter_ids else '{}' end,
        case when a.is_public or exists(select 1 from reader_expression_unlocks u where u.asset_id=a.id and u.user_id=auth.uid()) or public.is_reader_moderator() then a.unlock_card_ids else '{}' end
 from expression_assets a
 where a.is_active
 order by a.is_featured desc,a.sort_order,a.title;
$$;

create or replace function public.get_expression_giphy_config()
returns text language sql stable security definer set search_path=public
as $$
 select public_api_key from expression_provider_settings
 where provider='giphy' and enabled and auth.uid() is not null
 limit 1;
$$;

create or replace function public.request_expression_asset(
 p_type text,p_title text,p_description text
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to request an expression item.'; end if;
 insert into expression_asset_requests(user_id,requested_type,title,description)
 values(auth.uid(),p_type,trim(p_title),trim(p_description)) returning id into v_id;
 return v_id;
end;
$$;

create or replace function public.moderator_save_expression_asset(
 p_asset_id uuid,p_asset_key text,p_title text,p_type text,p_category text,
 p_asset_url text,p_preview_url text,p_emoji_text text,p_alt_text text,
 p_source text,p_provider_id text,p_is_public boolean,p_is_featured boolean,
 p_unlock_chapters text[],p_unlock_cards uuid[],p_sort_order integer
) returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required.'; end if;
 if p_asset_id is null then
  insert into expression_assets(asset_key,title,asset_type,category,asset_url,preview_url,emoji_text,alt_text,source,provider_id,is_public,is_featured,unlock_chapter_ids,unlock_card_ids,sort_order,created_by)
  values(p_asset_key,p_title,p_type,coalesce(nullif(p_category,''),'community'),nullif(p_asset_url,''),nullif(p_preview_url,''),nullif(p_emoji_text,''),coalesce(p_alt_text,''),coalesce(p_source,'orlong'),nullif(p_provider_id,''),coalesce(p_is_public,true),coalesce(p_is_featured,false),coalesce(p_unlock_chapters,'{}'),coalesce(p_unlock_cards,'{}'),coalesce(p_sort_order,100),auth.uid())
  returning id into v_id;
 else
  update expression_assets set asset_key=p_asset_key,title=p_title,asset_type=p_type,category=coalesce(nullif(p_category,''),'community'),
   asset_url=nullif(p_asset_url,''),preview_url=nullif(p_preview_url,''),emoji_text=nullif(p_emoji_text,''),
   alt_text=coalesce(p_alt_text,''),source=coalesce(p_source,'orlong'),provider_id=nullif(p_provider_id,''),
   is_public=coalesce(p_is_public,true),is_featured=coalesce(p_is_featured,false),
   unlock_chapter_ids=coalesce(p_unlock_chapters,'{}'),unlock_card_ids=coalesce(p_unlock_cards,'{}'),
   sort_order=coalesce(p_sort_order,100),updated_at=now()
   where id=p_asset_id returning id into v_id;
  if v_id is null then raise exception 'Expression item not found.'; end if;
 end if;
 -- Grant this item to readers who have already completed its linked chapter or own its linked card.
 insert into reader_expression_unlocks(user_id,asset_id,unlock_reason)
 select distinct c.user_id,v_id,'chapter:'||c.chapter_id
 from chapter_completions c where c.chapter_id=any(coalesce(p_unlock_chapters,'{}'))
 on conflict(user_id,asset_id) do nothing;
 insert into reader_expression_unlocks(user_id,asset_id,unlock_reason)
 select distinct copies.owner_user_id,v_id,'card:'||copies.card_id::text
 from reader_card_copies copies where copies.card_id=any(coalesce(p_unlock_cards,'{}'))
 on conflict(user_id,asset_id) do nothing;
 return v_id;
end;
$$;

create or replace function public.moderator_set_giphy_api_key(p_api_key text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required.'; end if;
 insert into expression_provider_settings(provider,public_api_key,enabled,updated_by,updated_at)
 values('giphy',coalesce(trim(p_api_key),''),coalesce(p_enabled,false),auth.uid(),now())
 on conflict(provider) do update set public_api_key=excluded.public_api_key,enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now();
end;
$$;

create or replace function public.moderator_review_expression_request(p_request_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required.'; end if;
 if p_status not in ('approved','declined','added') then raise exception 'Invalid request status.'; end if;
 update expression_asset_requests set status=p_status,moderator_note=nullif(trim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now()
 where id=p_request_id;
end;
$$;

create or replace function public.moderator_delete_expression_asset(p_asset_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required.'; end if;
 update expression_assets set is_active=false,updated_at=now() where id=p_asset_id;
end;
$$;

-- Award newly available items as soon as a reader completes a chapter or obtains a card.
create or replace function public.grant_expression_unlocks_for_progress()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if tg_table_name='chapter_completions' then
  insert into reader_expression_unlocks(user_id,asset_id,unlock_reason)
  select new.user_id,a.id,'chapter:'||new.chapter_id
  from expression_assets a where a.is_active and new.chapter_id=any(a.unlock_chapter_ids)
  on conflict(user_id,asset_id) do nothing;
 elsif tg_table_name='reader_card_copies' then
  insert into reader_expression_unlocks(user_id,asset_id,unlock_reason)
  select new.owner_user_id,a.id,'card:'||new.card_id::text
  from expression_assets a where a.is_active and new.card_id=any(a.unlock_card_ids)
  on conflict(user_id,asset_id) do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists chapter_completion_expression_unlock on public.chapter_completions;
create trigger chapter_completion_expression_unlock after insert on public.chapter_completions
 for each row execute function public.grant_expression_unlocks_for_progress();
drop trigger if exists card_copy_expression_unlock on public.reader_card_copies;
create trigger card_copy_expression_unlock after insert or update on public.reader_card_copies
 for each row execute function public.grant_expression_unlocks_for_progress();

-- Existing chapter discussions remain text-first; readers can attach up to four
-- library items to a comment. The trigger enforces the cap at database level.
create or replace function public.limit_comment_expression_attachments()
returns trigger language plpgsql set search_path=public
as $$
begin
 if (select count(*) from chapter_comment_expression_assets where comment_id=new.comment_id)>=4 then
  raise exception 'A comment can contain up to four expression items.';
 end if;
 return new;
end;
$$;
drop trigger if exists chapter_comment_expression_attachment_limit on public.chapter_comment_expression_assets;
create trigger chapter_comment_expression_attachment_limit before insert on public.chapter_comment_expression_assets
 for each row execute function public.limit_comment_expression_attachments();

-- A public GIPHY API key is intentionally exposed only to signed-in readers.
-- Restrict the key to the Orlong website domain in the GIPHY developer console.
grant execute on function public.get_my_expression_library() to authenticated;
grant execute on function public.get_expression_giphy_config() to authenticated;
grant execute on function public.request_expression_asset(text,text,text) to authenticated;
grant execute on function public.moderator_save_expression_asset(uuid,text,text,text,text,text,text,text,text,text,text,boolean,boolean,text[],uuid[],integer) to authenticated;
grant execute on function public.moderator_set_giphy_api_key(text,boolean) to authenticated;
grant execute on function public.moderator_review_expression_request(uuid,text,text) to authenticated;
grant execute on function public.moderator_delete_expression_asset(uuid) to authenticated;

-- Starter emoji set. More items can be added at any time in Moderator HQ.
insert into public.expression_assets(asset_key,title,asset_type,category,emoji_text,alt_text,source,is_public,is_featured,sort_order)
values
 ('emoji-electric-eel','Electric Eel','emoji','Orlong','⚡','Electric spark','orlong',true,true,1),
 ('emoji-blue-heart','Blue Heart','emoji','Orlong','💙','Blue heart','orlong',true,true,2),
 ('emoji-phoenix','Phoenix','emoji','Orlong','🔥','Flame','orlong',true,true,3),
 ('emoji-hummingbird','Hummingbird','emoji','Orlong','🐦','Bird','orlong',true,false,4),
 ('emoji-octopus','Octopus','emoji','Orlong','🐙','Octopus','orlong',true,false,5),
 ('emoji-peacock','Peacock','emoji','Orlong','🦚','Peacock','orlong',true,false,6),
 ('emoji-eel','Eel','emoji','Orlong','🐍','Snake','orlong',true,false,7),
 ('emoji-crystal','Crystal','emoji','Orlong','💎','Crystal','orlong',true,true,8),
 ('emoji-crown','Crown','emoji','Community','👑','Crown','orlong',true,false,20),
 ('emoji-star','Star','emoji','Community','⭐','Star','orlong',true,false,21),
 ('emoji-sparkles','Sparkles','emoji','Community','✨','Sparkles','orlong',true,false,22),
 ('emoji-laugh','Laughing','emoji','Community','😂','Laughing face','orlong',true,false,23),
 ('emoji-cry','Crying','emoji','Community','😭','Crying face','orlong',true,false,24),
 ('emoji-shock','Shocked','emoji','Community','😱','Shocked face','orlong',true,false,25),
 ('emoji-heart','Heart','emoji','Community','❤️','Red heart','orlong',true,false,26),
 ('emoji-skull','Skull','emoji','Community','💀','Skull','orlong',true,false,27),
 ('emoji-eyes','Eyes','emoji','Community','👀','Eyes','orlong',true,false,28),
 ('emoji-clap','Clapping','emoji','Community','👏','Clapping hands','orlong',true,false,29),
 ('emoji-fire','Fire','emoji','Community','🔥','Fire','orlong',true,false,30),
 ('emoji-rocket','Rocket','emoji','Community','🚀','Rocket','orlong',true,false,31)
on conflict(asset_key) do nothing;

-- Storage for moderator-created stickers, GIFs and memes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('orlong-expressions','orlong-expressions',true,12582912,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=12582912,allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif'];
drop policy if exists "Moderators upload expression assets" on storage.objects;
create policy "Moderators upload expression assets" on storage.objects
 for insert to authenticated with check (bucket_id='orlong-expressions' and public.is_reader_moderator());
drop policy if exists "Moderators update expression assets" on storage.objects;
create policy "Moderators update expression assets" on storage.objects
 for update to authenticated using (bucket_id='orlong-expressions' and public.is_reader_moderator())
 with check (bucket_id='orlong-expressions' and public.is_reader_moderator());
drop policy if exists "Moderators delete expression assets" on storage.objects;
create policy "Moderators delete expression assets" on storage.objects
 for delete to authenticated using (bucket_id='orlong-expressions' and public.is_reader_moderator());
drop policy if exists "Public reads expression assets" on storage.objects;
create policy "Public reads expression assets" on storage.objects
 for select to public using (bucket_id='orlong-expressions');
