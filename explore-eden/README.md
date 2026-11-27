# Orlong collectible cards — catalogue guide

This folder is the authoring foundation for the Orlong collectible-card system.

## Core rules

- A card has one permanent identity. Its ID and category number are never reused, even if the card is retired.
- Numbering is independent inside each category. The first three character cards are `CHR-001`, `CHR-002`, and `CHR-003`. The first creature card will be `CRE-001`, the first location `LOC-001`, and so on.
- Categories organise the master binder. Sets are separate themed groupings and may contain cards from more than one category.
- Rarity belongs to a card edition, not its category number. The initial tiers are Common, Uncommon, Rare, Epic and Legendary. Drop rates will be designed with the reward system in a later stage.
- Artwork and spoiler-safe descriptions are intentionally blank until approved. Do not invent details or add plot information ahead of its chapter unlock.
- The catalogue is for card definitions only. It does not record who owns a card, how it was earned, duplicates, currency, trades or public/private collection settings. Card-front artwork is stored separately in `explore-eden/cards/`.

## Current starter catalogue

The first set is **The Show**, tied to Chapter One of *The Trials of Eden*. Its three starter character cards are:

| Number | Card | Category | Rarity |
|---|---|---|---|
| CHR-001 | Maya Garcia | Characters | Common |
| CHR-002 | Elena Strix | Characters | Common |
| CHR-003 | Mrs Finch | Characters | Common |

These are catalogue entries, not rewards already granted to readers. Stage 2 now defines the activity pools and secure one-time reward claims in `supabase/card-reward-engine.sql`.

## Adding a card

1. Choose the category and use its next unused number.
2. Create a permanent lowercase hyphenated ID (for example, `new-character-name`).
3. Add the card to `card-catalogue.json`.
4. Set its first eligible chapter in `unlockChapterId`.
5. Add only facts and artwork that are safe to reveal at that chapter.
6. Add the matching row through a new Supabase migration when the catalogue is ready to publish.

Do not renumber cards to fill gaps. Do not put unreleased character names, artwork, descriptions or reward pools in public files. The Supabase card tables created in Stage 1 have row-level security enabled and no reader-facing read policy yet; later stages will add carefully gated access.

## Collection and duplicate rules already decided

These are product rules for the later binder and trading stages:

- A reader keeps a duplicate card by default. They may choose to exchange an unwanted duplicate for in-game currency; duplicates are never automatically converted.
- The exchange currency name and card values have not been set yet. Keep those values configurable rather than hard-coding an economy now.
- Each reader's collection can be switched between private and public.
- A public collection lets other readers view the cards owned and make trade offers. It does not grant visitors the owner's rewards, achievements, currency, activity history or other account benefits.
- Collection visibility and card ownership are separate. Viewing a card never grants ownership, and a trade changes ownership only after the trade is explicitly accepted and completed.

## Future systems kept separate

The catalogue deliberately leaves room for:
- editions and alternate artwork;
- activity-specific reward pools;
- permanent ownership and duplicate copies;
- optional duplicate-to-currency exchange;
- achievements and set completion;
- public/private binders and reader-to-reader trade offers.

Those systems will be added in their own stages rather than mixed into the card definitions.


## Stage 2 — reward engine

The Stage 2 migration is `supabase/card-reward-engine.sql`. Run it in the Supabase SQL Editor after Stage 1.

For Chapter One (`chapter-01`), it configures four independent reward activities:
- first chapter completion;
- first chapter reaction;
- first saved chapter challenge attempt;
- first approved discussion comment.

Each activity currently has the same three-card starter pool (Maya, Elena and Mrs Finch). One card is selected randomly for each qualifying activity. A reader can therefore receive duplicates, and each duplicate is stored as its own card copy.

The database triggers award cards automatically. Removing and re-adding a completion or reaction, changing a reaction, retaking the challenge, or having further comments approved will not issue another reward for the same activity and chapter. Existing qualifying Chapter One activity is also backfilled when the migration runs. The unique reward-claim constraint makes rerunning the migration safe.

The Stage 2 tables are not directly readable or writable by website visitors. The later binder stage will add controlled collection-reading functions and the reader-facing interface.

## Card artwork

Upload public, spoiler-safe PNG card fronts to `explore-eden/cards/`. Keep the editable Canva masters separately. Use the permanent card number in each filename:

- `CHR-001-maya-garcia.png`
- `CHR-002-elena-strix.png`
- `CHR-003-mrs-finch.png`

After the files are uploaded, set the corresponding `artworkUrl` fields in `card-catalogue.json` to their site paths. Artwork is not required for the reward engine to issue card copies.


## Stage 3 — personal card binder

The Stage 3 database migration is `supabase/card-binder-stage-3.sql`. Run it in the Supabase SQL Editor after Stage 2.

The migration:
- connects the three uploaded starter PNGs to their catalogue records;
- keeps Chapter One completion as the only active reward pool until separate reaction, challenge and approved-comment card pools are configured;
- removes any Chapter One reaction, challenge or comment cards previously issued from the temporary shared starter pool;
- adds a private `get_my_card_collection()` function that returns only the signed-in reader's own cards.

The My Account page now includes a personal card binder. It displays the cards a reader owns, their permanent card numbers, category, rarity and number of copies. Readers cannot directly query or edit the underlying ownership tables.

The binder currently displays earned cards only. Public binders, trading, duplicate exchange, achievements and card-set completion are later features.


## Stage 4 — interactive personal binder

Stage 4 upgrades the signed-in reader's binder with:
- category filters that appear automatically as the reader collects cards from more categories;
- selectable card fronts that open a larger detail view;
- card number, category, rarity and owned-copy count in the detail view;
- spoiler-safe descriptions when one has been approved in the catalogue.

The binder still shows only cards the signed-in reader owns. It does not expose the master catalogue or another reader's collection. Explore Eden companion links will be added as the corresponding spoiler-safe lore entries are authored and released.

No additional Supabase SQL is required for this interface stage. The existing private get_my_card_collection() function supplies the data.


## Stage 5 — reader achievements

The Stage 5 migration is `supabase/card-achievements-stage-5.sql`. Run it in the Supabase SQL Editor after Stage 3.

The first achievement collection tracks:
- First Chapter — complete a released chapter;
- Dedicated Reader — complete five chapters;
- First Reaction — react to a chapter;
- Challenge Accepted — submit a chapter challenge;
- Perfect Score — earn full marks on a challenge;
- Joining the Conversation — have a discussion comment approved;
- First Collectible — earn a card;
- Growing Collection — own three different cards.

Achievements unlock automatically when the signed-in reader opens My Account. Unlock timestamps are stored permanently in the database; progress is calculated from the reader's saved Reading Room activity and card ownership. The private `get_my_achievements()` RPC exposes only the signed-in reader's achievements.

This stage adds achievement milestones and progress tracking, not an in-game currency or automatic bonus card. Those reward types need their own carefully balanced economy and reward rules and will be designed separately. The animated card-opening reveal with music remains reserved for the final stage.


## Stage 6 — Trading Post database foundation

The Stage 6 migration is `supabase/card-trading-stage-6.sql`. Run it in the Supabase SQL Editor after Stage 5.

The database foundation introduces:
- opt-in public/private collection visibility (all existing and new readers default to private);
- a public directory containing only opted-in readers and their collection counts;
- public binder views that reveal card identities and copy counts, never private reading activity or physical copy IDs;
- trade offers in which a reader offers one of their own physical card copies for a card held by another reader;
- incoming/outgoing offer history, with accept, decline and cancel actions;
- atomic server-side ownership transfers: accepting an offer transfers both cards together or neither;
- a pending-offer lock so one physical card copy cannot be committed to multiple simultaneous offers.

The trade tables have row-level security enabled and direct reader access revoked. All collection visibility and trade actions are performed through authenticated, narrowly scoped database functions. Public visibility does not expose achievements, currency, account activity or other private statistics.

No in-game currency or automatic duplicate exchange is introduced in this stage. Duplicate copies remain owned unless the reader explicitly trades one. The Trading Post interface is now connected to the My Account page. Readers can toggle binder visibility, browse opted-in collections, send card-for-card offers, and accept, decline or cancel offers. The owner-only `get_my_tradeable_card_copies()` RPC supplies the physical copy IDs needed to make offers without exposing those IDs to other readers. After the UI was connected, this RPC was added to the Stage 6 SQL migration; rerun the latest complete migration so the website can use it.


## Stage 7 — editable Events Hub

The Events page is available at `/events.html`. The event list is controlled by the root-level `events-config.js` file, so new events can be added without editing the page layout or JavaScript.

To create an event, copy one of the commented examples in `events-config.js` into the `window.ORLONG_EVENTS` array. Choose `type: "announcement"` for an information-only event or `type: "interactive"` for an event with reader activity links. Set `published: false` to hide an event without deleting its configuration. Dates use `YYYY-MM-DD`; the page automatically labels events upcoming, live or ended and provides All, Live Now, Upcoming and Past filters.

Each event can include a summary, full description, potential rewards and (for interactive events) as many activities as desired. Each activity has a title, description, button label and destination URL. The Events page displays reward descriptions and links to activities.

**Current Stage 7 scope:** this is the editable event directory and activity-launch hub. Interactive buttons direct readers to the relevant website activities, but this first version does not yet verify completion, maintain event-specific progress, or automatically grant event rewards. Reward descriptions are informational only. A later reward-claim stage will be needed before configuring exclusive collectible rewards as automatically earnable.


## Stage 1 — reusable access-code foundation

The Stage 1 migration is `supabase/access-code-stage-1.sql`. Run the entire file in the Supabase SQL Editor after the existing reader engagement schema (which creates `reader_moderators` and `is_reader_moderator()`). It creates three protected tables: access-code campaigns, individual redemptions and permanent reader access grants. Codes are stored as SHA-256 hashes, and the plaintext is returned only once when a moderator generates a code. Readers must be signed in to redeem a code; redemption is checked and recorded server-side, including expiry and redemption limits. A successful grant remains on the reader's account after the code expires or is deactivated.

The My Reading Statistics page now includes a Special Access panel for signed-in readers and an Access Code Administration panel for moderators. Moderators can create codes with one or more permission keys, an optional expiry and an optional redemption cap. Use `early_access` for the Founding Reader programme; future permissions can use keys such as `event:launch` or `feature:arena`. Share the generated code with its intended audience and save it securely when it is first displayed. A reader can redeem the same campaign only once; entering it again reports that it has already been redeemed without consuming another redemption.

**Important:** the existing moderation role is reused for code administration. If your account has not already been added to `public.reader_moderators`, add your own authenticated user UUID in the Supabase SQL Editor (the same process documented in `supabase/schema.sql`), then sign out and back in. Do not grant moderator status to ordinary readers. The browser uses only the existing publishable key; never expose a service-role key.

The migration creates the secure database and UI, but it is not executed automatically by GitHub. Run the SQL migration in Supabase before testing redemption or generating your first code. The default code expiry in the admin panel is 31 December 2026 at 11:59 pm in your browser's local time; you can adjust it before generating the code.


## Early Access — Special Edition character packs

The Founding Reader Special Edition set contains ten character cards, numbered CHR-101 through CHR-110. The cards are awarded randomly from one shared pool whenever an Early Access mission is completed. The same character can be awarded more than once, so duplicate copies are intentional and can be traded through the existing Trading Post.

The ten cards are Maya Garcia, Leo Lee, Kiera Patel, Al Jones, Marcus Roberts, Charlee Neil, Emily Kim, Alek Petrov, Ethan Lawson and Colin Thornsberg. Their card-front artwork is intentionally pending; the catalogue currently displays undiscovered silhouettes until the artwork is approved and uploaded.

The Early Access journey contains ten missions. The original eight testing activities remain, with Explore Eden and Founding Readers added as missions nine and ten. The old eight concept-card rewards (CON-101–CON-108) are retired and removed, including their existing copies and claims. Existing mission completion progress is retained, and completed missions receive a random Special Edition card during the migration.

Run `supabase/early-access-special-edition-character-packs.sql` in the Supabase SQL Editor after the existing Early Access Stage 4 and collectible-card migrations. This migration updates the reward function and should be run before testing the updated Early Access page.


## Moderator Headquarters and Card Studio

The private Moderator Headquarters is at `/moderator/`. The shared navigation displays its link only after the signed-in account passes `is_reader_moderator()`; the page independently checks the same permission and refuses access to other accounts.

The Card Studio provides a shared 2:3 portrait card template and live preview. Moderators enter a card name, category, rarity, set, unlock chapter and spoiler-safe description, then upload artwork. The crop tool supports drag-to-position and zoom, and exports a consistent WebP card-art image. The database assigns the permanent category number and card number automatically. Existing cards can be edited without changing their permanent identity or category.

Card artwork is stored in the public `orlong-card-artwork` Supabase Storage bucket. Only moderators can upload, replace or delete objects in that bucket; readers can view the published artwork. The `get_public_card_catalogue()` RPC supplies Explore Eden with active cards that have no chapter lock or are unlocked at Chapter One. Future chapter-locked cards remain hidden until the moderator clears their unlock chapter after release.

Install `supabase/moderator-card-studio.sql` in Supabase after the existing card foundation and moderator schema. This creates the artwork bucket, moderator-only storage policies and the secure catalogue RPCs. The migration must be run before using Card Studio or loading the dynamic card catalogue in Explore Eden.

Community moderation and access-code management are linked from Moderator Headquarters to the existing approved moderation and account tools. They continue to use the established moderator role and database policies.
