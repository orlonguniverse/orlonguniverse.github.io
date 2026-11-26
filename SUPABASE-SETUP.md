# The Trials of Eden — reader engagement setup

The Reading Room now has a Supabase-powered community interface. Reading stays free and does not require an account. A confirmed email account is needed only to save milestones, vote, react or comment.

## 1. Database setup

1. Open your Supabase project dashboard.
2. Choose **SQL Editor → New query**.
3. Open [the latest schema.sql file](https://github.com/orlonguniverse/orlonguniverse.github.io/blob/main/supabase/schema.sql).
4. Copy the entire file into the SQL Editor and run it.
5. If you previously ran an earlier version, run the complete latest file again. It is designed to add the new moderation/reporting features without deleting existing reader activity.

This creates the reader tables, duplicate-prevention constraints, Row Level Security policies, public aggregate statistics, reporting, content-preference collection and moderator-only analytics.

## 2. Email authentication

1. Open **Authentication → Providers** and make sure **Email** is enabled.
2. Keep email confirmation enabled.
3. Under **Authentication → URL Configuration**, set the Site URL to:
   `https://orlonguniverse.github.io`
4. Add this Redirect URL:
   `https://orlonguniverse.github.io/books/trials-of-eden/*`
5. The Reading Room account form uses email and password. Readers must confirm their email address before signing in.
6. For a public launch, configure a reliable SMTP provider. Supabase's built-in email service has sending limits and is intended for testing.

## 3. Make your own account a moderator

Do this after the Reading Room is live and you have created your own account through its **CREATE ACCOUNT** button.

1. Confirm your email and sign in to the Reading Room.
2. In Supabase, open **Authentication → Users**.
3. Find your account and copy its **User UID**.
4. In **SQL Editor → New query**, run the following, replacing the placeholder with your exact UID:

```sql
insert into public.reader_moderators (user_id)
values ('YOUR-AUTH-USER-UUID')
on conflict (user_id) do nothing;
```

This grants moderation and private analytics access to that account only. Do not add ordinary reader accounts as moderators. After signing out and back in, your **AUTHOR MODERATION** panel will appear below the discussion area.

## 4. What the Reading Room now supports

- Free reading without an account.
- Email-confirmed sign-up, sign-in and sign-out.
- One saved completion per account and chapter.
- Multiple saved content preferences per account: characters, plot and twists, worldbuilding and lore, relationships, action and challenges, and other suggestions.
- One changeable reaction per account and chapter.
- Chapter comments and replies, held for approval before public display.
- Spoiler-marked comments hidden behind a reveal control.
- Comment reporting and a moderator panel to approve or hide comments.
- Public aggregate totals that do not display email addresses or account IDs.
- Content-interest responses are aggregated by category; optional text entered under Other is kept out of public statistics.
- Private author statistics available only to the moderator account.

## 5. Measurement and privacy notes

- The author's unique-reader figure counts distinct accounts that have completed at least one chapter. It is not a count of all website visitors.
- Chapter completion is a reader-declared milestone, not proof that the chapter was read in full.
- Duplicate prevention is per account, not a guarantee of one account per human. Do not use browser fingerprinting.
- Public comments are labelled generically as “Reader”; display names, email addresses and account IDs are not shown in public discussions.
- Readers can read the novel without participating.

## Security

The website uses the Supabase **publishable** key. That key is intended for browser use when Row Level Security is enabled. Never put a service-role/secret key, database password or SMTP password in website code or share them in chat.
