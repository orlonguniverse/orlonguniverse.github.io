# The Trials of Eden — reader engagement setup

The Reading Room now has a Supabase-powered community interface. All reading and participation are free. A confirmed email account is required to open chapter manuscripts; public visitors can still browse the book contents and site.

## 1. Database setup

1. Open your Supabase project dashboard.
2. Choose **SQL Editor → New query**.
3. Open [the latest schema.sql file](https://github.com/orlonguniverse/orlonguniverse.github.io/blob/main/supabase/schema.sql).
4. Copy the entire file into the SQL Editor and run it.
5. If you previously ran an earlier version, run the complete latest file again. It is designed to add the new moderation/reporting features and updated public Reader Insights statistics without deleting existing reader activity.

This creates the reader tables, duplicate-prevention constraints, Row Level Security policies, public aggregate statistics, reporting, content-preference collection and moderator-only analytics.

## 2. Email authentication

1. Open **Authentication → Providers** and make sure **Email** is enabled.
2. Keep email confirmation enabled.
3. Under **Authentication → URL Configuration**, set the Site URL to:
   `https://orlonguniverse.github.io`
4. Add this Redirect URL:
   `https://orlonguniverse.github.io/books/trials-of-eden/*`
5. The Reading Room has a **SIGN IN** button in the top navigation. The account window switches between **SIGN IN** and **CREATE ACCOUNT**. Readers must confirm their email address before signing in. All registered readers have free access; there are no paid tiers or subscriptions.
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

This grants moderation and private analytics access to that account only. Do not add ordinary reader accounts as moderators.

### How to approve comments

1. Open the Reading Room and sign in using the same email account whose UID you added above.
2. Scroll down past the chapter text and the **CHAPTER DISCUSSION** section.
3. You should see a separate **AUTHOR MODERATION** panel. It is intentionally invisible to ordinary readers.
4. Each pending submission appears with its chapter ID and comment text.
5. Click **APPROVE** to publish the comment in that chapter's discussion. Click **HIDE** to keep it unpublished.
6. The list refreshes after each decision. Approved comments will then appear in the public discussion.

If you cannot see **AUTHOR MODERATION**, check that the UID was copied exactly, that the SQL command ran successfully, and that you are signed into that same account. Sign out and back in after granting the role.

## 4. What the Reading Room now supports

- Free account required to access private chapter manuscripts; the site and contents page remain publicly browsable.
- A private **My Reading Statistics** page at `books/trials-of-eden/account.html`, showing each signed-in reader their own completed chapter milestones, saved reactions, submitted comments and moderation statuses, and saved content preferences.
- Account access from the main website, book contents page and Reading Room navigation.
- Email-confirmed sign-up, sign-in and sign-out.
- One saved completion per account and chapter.
- Multiple saved content preferences per account: characters, plot and twists, worldbuilding and lore, relationships, action and challenges, and other suggestions.
- One changeable reaction per account and chapter.
- Chapter comments and replies, held for approval before public display.
- Spoiler-marked comments hidden behind a reveal control.
- Comment reporting and a moderator panel to approve or hide comments.
- Public Reader Insights showing aggregate chapter milestones, total reactions, approved comments, reaction breakdowns and content-preference rankings. Anyone can view these without an account.
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


## 6. Private chapter library (required for chapter access)

The Reading Room now retrieves manuscript HTML from a **private Supabase Storage bucket** named `eden-chapters`. The bucket is created as private by the updated `supabase/schema.sql`; a Storage Row Level Security policy allows downloads only for authenticated users.

1. Open the Supabase SQL Editor and run the complete updated `supabase/schema.sql` again. This creates the private bucket and its authenticated-read policy without deleting reader records.
2. Open **Storage → eden-chapters**. Upload each released chapter HTML file using the exact object name matching its chapter ID, for example `chapter-01.html`.
3. In `books/trials-of-eden/chapters.js`, set that chapter's `available` value to `true` only after its file has been uploaded to the private bucket.
4. Keep finished manuscript files out of GitHub. The public `chapters` folder is for the blank `chapter-template.html` only.
5. Test in a private/incognito window: the chapter must not load until a reader signs in. Also test with a confirmed reader account.

**Important:** the current `chapter-01.html` in the repository was only a sample template, not a finished manuscript. It has been replaced by `chapter-template.html` and Chapter 01 remains marked unavailable until you upload the real chapter to the private bucket. This avoids publishing placeholder text as a chapter and ensures no manuscript is exposed by a public GitHub URL.

The Storage policy permits authenticated downloads only. The bucket must remain private; do not change its visibility to Public.


## Chapter quiz attempts (added November 2026)

The updated Reading Room includes optional three-question quizzes configured per chapter in `books/trials-of-eden/chapters.js`. Copy the commented `quiz` example into a chapter object, replace the question text/options, and set each `answer` to the correct option's zero-based index (first option = `0`). Keep exactly three questions.

Each submission is stored in `chapter_quiz_attempts` as a separate attempt. Readers can review previous results and submit a new attempt, but existing submissions cannot be updated or deleted through the reader account. The table is private to the signed-in reader.

**Database update required:** run the complete current `supabase/schema.sql` file in the Supabase SQL Editor to create the quiz-attempt table and its row-level security policies. This is safe to rerun; the schema uses idempotent table/policy creation where applicable.


### Uploading Chapter 01 — important distinction

The Storage location must be the private bucket **eden-chapters**, with the object named exactly **chapter-01.html** at the bucket's top level. In the Supabase Storage browser, the object path is just `chapter-01.html` (not `files/buckets/eden-chapters/chapter-01.html`; that is only the dashboard's breadcrumb/location description).

The object must contain the completed Chapter One manuscript, not the public `chapter-template.html` starter file. Replace all sample text such as `Your first paragraph goes here.` before uploading. The Reading Room now detects this placeholder and displays a specific explanation rather than presenting it as a real chapter.

Chapter 01 is configured as available in `books/trials-of-eden/chapters.js`, with the title **The Show**. After uploading the real manuscript, sign in to a reader account and open the Reading Room. If Storage still cannot retrieve it, the page will now show the specific Supabase error instead of a generic loading message.
