# The Trials of Eden — reader engagement setup

This adds the secure backend for chapter completion, series interest, reactions, moderated chapter discussions and aggregate readership statistics.

## What readers will experience

- The novel remains readable without an account.
- A free, email-verified account is required only to participate.
- A reader can complete each chapter once. The database prevents duplicate rows for the same account and chapter.
- A reader can keep one interest choice per series and one reaction per chapter. Changing a choice updates the existing record.
- Comments are submitted for moderation before appearing publicly. Spoiler-marked comments will be hidden behind a reveal control in the Reading Room.
- Public statistics show totals only. They never reveal reader email addresses or account IDs.

## 1. Create the Supabase project

1. Visit https://supabase.com/ and create a free project.
2. Give it a name such as `orlong-reading-room`.
3. Choose a strong database password and save it somewhere secure.
4. Choose a region close to most readers (Sydney is a sensible default for an Australian project).
5. Wait for the project to finish provisioning.

## 2. Create the database tables and security rules

1. Open the project dashboard.
2. Select **SQL Editor**.
3. Open **New query**.
4. Copy the complete contents of `supabase/schema.sql` from this repository into the editor.
5. Run the query. It creates the tables, duplicate-prevention constraints, moderation defaults, row-level security policies and public aggregate-statistics function.

The SQL is designed to be safe to run again if setup needs to be repeated.

## 3. Configure email sign-in

1. Open **Authentication → Providers** and ensure **Email** is enabled.
2. Keep email confirmation enabled.
3. Under **Authentication → URL Configuration**, add:
   - Site URL: `https://orlonguniverse.github.io`
   - Redirect URL: `https://orlonguniverse.github.io/books/trials-of-eden/*`
4. Configure the email template so the confirmation/magic link returns readers to the Reading Room.
5. For a public launch, configure a reliable SMTP provider in Supabase. The built-in email service is intended for testing and has sending limits.\n6. The Reading Room account form uses email and password; readers must confirm their email before signing in.

## 4. Send me the two public connection values

In **Project Settings → API** (or **Data API**, depending on the dashboard layout), copy:

- **Project URL**
- **Publishable key** (the newer `sb_publishable_...` key) or the legacy **anon/public** key.

Send those two values here. They are intended for browser use when Row Level Security is correctly configured.

**Never send the service_role key, secret key, database password or SMTP password.** Those must remain private.

## 5. What I will connect after you provide the values

I will update the Reading Room to add:

- Sign up, sign in, sign out and account display.
- A chapter-completion control and personal completion state.
- Series-interest voting for Eden, Bitsy, Evalon, Varex and Arcanet (editable later).
- Chapter reactions and a moderated comment/reply area with spoiler reveal controls.
- Public aggregate totals, with no personally identifying information.
- A private author analytics approach that does not expose administrator credentials in the public website.

## Important notes

- Duplicate prevention is per verified account, not a guarantee of one account per human. No privacy-respecting website can perfectly stop someone creating multiple email accounts.
- Do not use browser fingerprinting to try to identify readers.
- The author should review pending comments regularly. Do not launch public comments until moderation and reporting controls are in place.
- Keep the book itself open to everyone. Participation should be optional.
