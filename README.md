# trainingcamp

trainingcamp is a small personal expense tracker built with React, TypeScript, Vite, and Tailwind CSS.

## Accounts

The app includes Vietnamese email/password authentication using Supabase:

- `/login`: sign in; accessible from the calendar header.
- `/register`: create an account and confirm the email when confirmation is enabled.
- `/forgot-password` and `/reset-password`: request a recovery link and choose a new password.
- `/auth/callback`: receive email confirmation and OAuth callbacks.

Copy `.env.example` to `.env.local` and set the project's Supabase URL and public anon/publishable key. Never put a service-role key in a `VITE_` variable. Missing configuration leaves the calendar available in guest mode and shows an explanation on account pages.

The existing `VITE_PUBLIC_SUPABASE_URL` and `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names are also supported; existing local credentials do not need to be changed.

In Supabase Authentication, enable the Email provider and set Site URL to the deployed origin. Add the following Redirect URLs for every allowed origin (replace the port if your local dev server uses another):

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/reset-password
https://YOUR_DOMAIN/auth/callback
https://YOUR_DOMAIN/reset-password
```

Configure production email delivery in Supabase before relying on confirmation/recovery emails. See [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords). Google/Facebook helper files are not exposed as login buttons because they require separate provider setup.

**Storage:** signed-in users load and save classes, teaching sessions, salary payments, recurring schedules and skipped dates in Supabase. Apply `supabase/migrations/20260922000100_teaching_database.sql` once before using cloud data. Requests filter by user ID; RLS and composite foreign keys enforce ownership on the server.

Writes finish before dialogs close. Failed loads offer a retry and never upload an empty browser snapshot. Refresh the page to see changes from another device; there is no realtime subscription or offline write queue. Multi-table class/schedule saves and bulk imports are sequential; after a partial failure the app reloads actual server data so users can check what was saved before retrying.

Guest mode still uses the original browser localStorage keys. Previous account-local snapshots and guest data remain intact but are **not automatically uploaded** or merged. An empty cloud account starts with an empty calendar. Session amounts are snapshots, including zero; editing class rates does not recalculate past earnings. Classes with teaching history cannot be deleted from the UI.

New sessions retain actual training hours and end times, but bill fractional hours rounded up to the next whole hour. The class named `Hamza` (case-insensitive, ignoring surrounding spaces) rounds down instead: 1.5h bills as 1h; 2.5h bills as 2h. This applies to manual check-ins, recurring confirmations, and bulk imports. Existing saved session amounts are unchanged.

## Verification

```bash
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start an isolated dev server on port 4175 with dummy Supabase configuration, intercept Auth and database requests, and never create real accounts or send emails. Set `PLAYWRIGHT_BASE_URL` to use an already running configured dev server, or `PLAYWRIGHT_EXECUTABLE_PATH` to use an installed Chrome executable. Real email delivery and provider configuration must be checked separately in the target Supabase project.

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Deploy

The app is ready for Vercel with `vercel.json`.

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```
