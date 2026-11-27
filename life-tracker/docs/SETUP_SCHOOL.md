# Connect your school (optional)

Life Tracker works fully with grades you enter or import. Connecting a school
platform makes classes and grades arrive automatically. Everything is
**read-only**: Life Tracker never submits, posts or changes anything.

Before you start: cloud sync must be set up and you must be signed in
(`SETUP_SUPABASE.md`), because connections run on the server so your tokens
stay off your devices.

| Platform | Works for students? | How |
|---|---|---|
| Canvas | Usually | Personal access token (below) |
| Google Classroom | If your school allows it | Sign in with Google (below) |
| StudentVUE (Synergy) | No student API for apps | Academics → **Import** (copy your gradebook, paste it) — see Part D |
| PowerSchool | No student API | Academics → **Import** (copy your grade table, paste it) |
| Infinite Campus | No student API | Academics → **Import** |

---

## Part A — Server setup (once)

You need the [Supabase CLI](https://supabase.com/docs/guides/cli) on a computer,
logged in with `supabase login`, then from the `life-tracker` folder:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy school-sync school-connect-canvas google-auth email-sync email-summarize
```

Then add these **Edge Function secrets** (Supabase → Edge Functions → Secrets, or
`supabase secrets set NAME=value`):

| Secret | Value |
|---|---|
| `TOKEN_ENCRYPTION_KEY` | A random 32-byte key. Generate with `openssl rand -base64 32`. Keep it secret; if it's lost, you just reconnect. |
| `APP_URL` | Where the app is hosted, e.g. `https://life-tracker-yourname.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Only for Google Classroom (Part C) |

(`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided
to functions automatically.)

## Part B — Canvas
1. Open the app → **Settings → School connections → Canvas → Connect**.
2. In Canvas (in a browser): **Account → Settings → Approved Integrations →
   + New Access Token**. Purpose: "Life Tracker". Copy the token.
3. Paste your school's Canvas address (e.g. `yourschool.instructure.com`) and the
   token, then **Connect Canvas**.

Life Tracker checks the token works, stores it encrypted, and imports your
active courses, assignment groups (with their weights) and graded work. You can
revoke the token in Canvas at any time; the app will then say "Reconnect needed".

If there's no "New Access Token" button, your school has turned it off; use Import.

## Part C — Google Classroom
Google requires each app to have its own Google Cloud project. This is free and
takes about 15 minutes.

1. Go to **console.cloud.google.com** → create a project named `life-tracker`.
2. **APIs & Services → Library**: enable **Google Classroom API**.
3. **APIs & Services → OAuth consent screen**: User type **External**; app name
   "Life Tracker"; your email for support/developer contact. Add these scopes:
   - `.../auth/classroom.courses.readonly`
   - `.../auth/classroom.coursework.me.readonly`
   - `.../auth/classroom.rosters.readonly`
   Add your Google account under **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URI:
   `https://YOUR-PROJECT-REF.supabase.co/functions/v1/google-auth`
   Copy the client ID and secret into the `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` secrets.
5. In the app: **Settings → School connections → Google Classroom → Connect**,
   sign in with your school Google account and allow access.

Notes:
- While the consent screen is in **Testing**, Google ends the connection after
  7 days and you'll need to reconnect. To avoid that, choose **Publish app** on
  the consent screen. Google then shows an "unverified app" warning when you
  connect (expected for a personal app), and verification isn't required for
  personal use.
- School Google accounts are managed by the school. If the admin blocks
  third-party apps, the app shows "Blocked by school" — use Import instead.
- Classroom doesn't label work as "missing" in its API. Like the Classroom app,
  Life Tracker counts work as missing when it's past due and not turned in.

## Part D — StudentVUE
StudentVUE only lets its own app sign in with your school password, and Life
Tracker won't ask for that. Copy-paste works well instead and needs no setup:

1. Open StudentVUE **in a web browser** (your district's StudentVUE address; the
   phone app doesn't allow copying tables).
2. **Grade Book** → choose a class → its assignment list.
3. Select the whole table, starting at the heading row (Date, Assignment,
   Assignment Type, Score, …), and copy it.
4. Life Tracker → **Academics → Import** → paste, type the class name when asked,
   check the preview, **Import**. Do this per class.
5. Run it again whenever you like — grades you already imported are skipped.

Life Tracker reads StudentVUE's "18 out of 20" scores and its Points column,
"Not Graded" work, and missing/excused marks. Category weights aren't part of the
copied table: open the class, set **How is this class graded? → Categories**, and
enter the weights shown in StudentVUE's grade summary. Or, if you only want the
official number, set the class to **Portal %** and type the percentage StudentVUE shows.

## Using Canvas, Classroom and StudentVUE together
The same class can arrive from more than one place (e.g. Biology in Canvas *and*
in StudentVUE). Each copy would count in your GPA. A simple setup:

- **StudentVUE is your school's official gradebook** — let those classes count
  for GPA (imported grades, or Portal %).
- **Canvas / Classroom copies** of the same classes are still useful for
  assignments and recent scores: open each one → Edit → **Credits 0** so it
  doesn't count twice.

## What syncs, and what stays yours
- Classes, categories and weights, assignments, scores, due dates, missing/excused.
- Your own choices on a synced class (color, credits, honors/AP level, grading
  scale, term) are kept on every sync.
- Grades you entered yourself are never changed by a sync.
- Assignments your teacher deletes disappear from Life Tracker on the next sync.
- Life Tracker calculates percentages itself. Special teacher rules (like
  "drop the lowest quiz") aren't applied, so a number can differ slightly from
  the platform; set the class to **Portal %** if you prefer the platform's number.
