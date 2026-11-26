# Orlong collectible cards — catalogue guide

This folder is the authoring foundation for the Orlong collectible-card system.

## Core rules

- A card has one permanent identity. Its ID and category number are never reused, even if the card is retired.
- Numbering is independent inside each category. The first three character cards are `CHR-001`, `CHR-002`, and `CHR-003`. The first creature card will be `CRE-001`, the first location `LOC-001`, and so on.
- Categories organise the master binder. Sets are separate themed groupings and may contain cards from more than one category.
- Rarity belongs to a card edition, not its category number. The initial tiers are Common, Uncommon, Rare, Epic and Legendary. Drop rates will be designed with the reward system in a later stage.
- Artwork and spoiler-safe descriptions are intentionally blank until approved. Do not invent details or add plot information ahead of its chapter unlock.
- The catalogue is for card definitions only. It does not record who owns a card, how it was earned, duplicates, currency, trades or public/private collection settings.

## Current starter catalogue

The first set is **The Show**, tied to Chapter One of *The Trials of Eden*. Its three starter character cards are:

| Number | Card | Category | Rarity |
|---|---|---|---|
| CHR-001 | Maya Garcia | Characters | Common |
| CHR-002 | Elena Strix | Characters | Common |
| CHR-003 | Mrs Finch | Characters | Common |

These are catalogue entries, not rewards already granted to readers. The later reward stage will decide which activity can award each card and will enforce one reward claim per eligible activity.

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
