# Set up cloud sync (Supabase)

About 10 minutes. Until you do this, Life Tracker works fully but saves only on
the device you're using.

> Supabase menus get renamed from time to time. If a label below doesn't match
> exactly, look for the closest one — the steps are the same.

## 1. Create the project
1. Go to **supabase.com** → **Start your project** → sign in (GitHub sign-in is easiest).
2. **New project**. Name: `life-tracker`. Choose a strong database password and
   save it in your password manager (you won't need it for the app itself).
   Region: the one closest to you. Plan: **Free**.
3. Wait for the project to finish setting up (1–2 minutes).

## 2. Create the database tables
1. In the project, open **SQL Editor** → **New query**.
2. Open `life-tracker/supabase/migrations/20261127000000_profiles.sql` from this
   repository, copy all of it, paste it into the editor and click **Run**.
3. You should see "Success. No rows returned".

This creates your profile table with privacy rules (each account can only ever
read or change its own row) and the "delete my account" function.

## 3. Turn on email-code sign-in
Life Tracker signs you in with a 6-digit code instead of a link, because links
in email open in Safari rather than in the installed iPhone app.

1. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
2. **Authentication → Email Templates**. In **both** the "Confirm signup" and
   "Magic Link" templates, make the email show the code by including
   `{{ .Token }}`, for example:

   ```html
   <h2>Your Life Tracker code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in one hour. If you didn't ask for it, ignore this email.</p>
   ```
3. **Authentication → URL Configuration**: set **Site URL** to where the app is
   hosted (see `DEPLOY.md`), e.g. `https://life-tracker-yourname.vercel.app`.
   For local testing add `http://localhost:5173` under **Redirect URLs**.

Note: Supabase's built-in email sender only allows a few emails per hour. That's
fine for one person; if you ever hit the limit, add your own SMTP sender under
**Project Settings → Authentication → SMTP**.

## 4. Give the app your project's address
1. **Project Settings → API** (or **Data API**). Copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon / public** key
2. These two values are designed to be public — your data is protected by the
   privacy rules from step 2. **Never** copy the `service_role` key anywhere.
3. Put them where the app is built:
   - **Hosting** (normal case): add them as environment variables in your
     hosting dashboard — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — then
     redeploy. See `DEPLOY.md`.
   - **Running locally**: in `apps/web`, copy `.env.example` to `.env.local` and
     fill them in, then `npm run dev`.

You can also just paste the Project URL and anon key to me in chat — they're
not secrets — and I'll check the setup.

## 5. Try it
Open the app → **Settings → Account** → enter your email → **Email me a code** →
type the code. Change your theme on one device and it appears on the other the
next time you open the app there.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Account page says "Cloud sync isn't set up yet" | The two environment variables aren't in the build. Add them and redeploy. |
| Email arrives with a link but no code | Add `{{ .Token }}` to both email templates (step 3.2). |
| "Too many attempts" | Supabase's email rate limit; wait an hour or add SMTP. |
| "Couldn't sync your settings" | Check the SQL in step 2 ran successfully. Your changes stay on the device and sync when fixed. |
