-- ============================================================
-- ORLONG COLLECTIBLE CARDS — STAGE 1 FOUNDATION
-- Safe to run more than once.
--
-- Creates the card catalogue only. It does NOT award cards,
-- create balances, enable trading, or expose unreleased cards.
-- RLS is enabled with no reader-facing policies yet.
-- ============================================================

create table if not exists public.card_categories (
  category_id text primary key check (category_id ~ '^[a-z0-9-]{1,40}$'),
  label text not null,
  category_code text not null unique check (category_code ~ '^[A-Z]{3}$'),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.card_sets (
  set_id text primary key check (set_id ~ '^[a-z0-9-]{1,80}$'),
  title text not null,
  description text,
  universe_id text not null default 'orlong',
  series_id text,
  book_id text,
  unlock_chapter_id text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.card_catalogue (
  card_id text primary key check (card_id ~ '^[a-z0-9-]{1,100}$'),
  category_id text not null references public.card_categories(category_id),
  category_number integer not null check (category_number > 0),
  card_number text not null unique,
  name text not null,
  rarity text not null default 'common'
    check (rarity in ('common','uncommon','rare','epic','legendary')),
  set_id text references public.card_sets(set_id),
  universe_id text not null default 'orlong',
  series_id text,
  book_id text,
  unlock_chapter_id text,
  spoiler_safe_description text,
  artwork_url text,
  duplicate_exchange_value integer
    check (duplicate_exchange_value is null or duplicate_exchange_value >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, category_number)
);

create index if not exists card_catalogue_category_order
  on public.card_catalogue (category_id, category_number);

create index if not exists card_catalogue_set
  on public.card_catalogue (set_id, sort_order);

create index if not exists card_catalogue_unlock
  on public.card_catalogue (unlock_chapter_id);

alter table public.card_categories enable row level security;
alter table public.card_sets enable row level security;
alter table public.card_catalogue enable row level security;

-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies or grants
-- are created here. The later reward and archive stages will expose
-- only chapter-authorised catalogue data through controlled functions.
-- Do not add a broad public SELECT policy to card_catalogue.

insert into public.card_categories
  (category_id, label, category_code, description, sort_order)
values
  ('characters', 'Characters', 'CHR', 'People who shape the Orlong Universe.', 1),
  ('creatures', 'Creatures', 'CRE', 'Wildlife, species and extraordinary lifeforms.', 2),
  ('locations', 'Locations', 'LOC', 'Places, regions, buildings and environments.', 3),
  ('objects', 'Objects', 'OBJ', 'Important items, artefacts and possessions.', 4),
  ('organisations', 'Organisations', 'ORG', 'Groups, institutions and factions.', 5),
  ('technology', 'Technology', 'TEC', 'Devices, inventions and scientific systems.', 6),
  ('events', 'Events & History', 'EVT', 'Historical events, competitions and turning points.', 7),
  ('concepts', 'Concepts & Abilities', 'CON', 'Abilities, forces and important universe concepts.', 8),
  ('special-edition', 'Special Edition', 'ERA', 'Limited and promotional card editions.', 9),
on conflict (category_id) do update set
  label = excluded.label,
  category_code = excluded.category_code,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.card_sets
  (set_id, title, description, universe_id, series_id, book_id, unlock_chapter_id, sort_order)
values
  ('eden-chapter-01', 'The Show',
   'The first character cards introduced in The Trials of Eden.',
   'orlong', 'eden', 'trials-of-eden', 'chapter-01', 1)
on conflict (set_id) do update set
  title = excluded.title,
  description = excluded.description,
  universe_id = excluded.universe_id,
  series_id = excluded.series_id,
  book_id = excluded.book_id,
  unlock_chapter_id = excluded.unlock_chapter_id,
  sort_order = excluded.sort_order;

insert into public.card_catalogue
  (card_id, category_id, category_number, card_number, name, rarity, set_id,
   universe_id, series_id, book_id, unlock_chapter_id, sort_order)
values
  ('maya-garcia', 'characters', 1, 'CHR-001', 'Maya Garcia', 'common',
   'eden-chapter-01', 'orlong', 'eden', 'trials-of-eden', 'chapter-01', 1),
  ('elena-strix', 'characters', 2, 'CHR-002', 'Elena Strix', 'common',
   'eden-chapter-01', 'orlong', 'eden', 'trials-of-eden', 'chapter-01', 2),
  ('mrs-finch', 'characters', 3, 'CHR-003', 'Mrs Finch', 'common',
   'eden-chapter-01', 'orlong', 'eden', 'trials-of-eden', 'chapter-01', 3)
on conflict (card_id) do update set
  category_id = excluded.category_id,
  category_number = excluded.category_number,
  card_number = excluded.card_number,
  name = excluded.name,
  rarity = excluded.rarity,
  set_id = excluded.set_id,
  universe_id = excluded.universe_id,
  series_id = excluded.series_id,
  book_id = excluded.book_id,
  unlock_chapter_id = excluded.unlock_chapter_id,
  sort_order = excluded.sort_order;
