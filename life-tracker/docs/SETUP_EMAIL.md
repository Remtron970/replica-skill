# Set up the email recap

Works without any setup: **Email → Paste** summarizes any email you paste in, using
Life Tracker's built-in rules. The steps below add **automatic Gmail reading** and
**AI summaries**. Both are optional and independent.

Before you start: cloud sync (`SETUP_SUPABASE.md`, including
`20261127040000_email.sql`) and the Google Cloud project from
`SETUP_SCHOOL.md` Part C.

## Will my school email work?
School Google accounts are managed by the school. For students under 18, Google
blocks apps the school hasn't approved, and many schools block them for everyone.
The only way to know is to try: if it's blocked, Google shows an
"admin" message and Life Tracker says **Blocked by school**. Then:
- paste important emails into **Email → Paste** (works every time), or
- ask your school's tech office whether "Life Tracker" (your Google Cloud
  project) can be allowed — they decide.

## Part A — Read Gmail (read-only)
1. Google Cloud console → your `life-tracker` project → **APIs & Services →
   Library** → enable **Gmail API**.
2. **OAuth consent screen → Data access / Scopes** → add
   `.../auth/gmail.readonly`. (Read-only: Life Tracker can't send, delete, label
   or change anything.)
3. Make sure your school address is a **Test user**, or **Publish** the app to
   avoid having to reconnect every 7 days (Google shows an "unverified app"
   warning for a personal app; that's expected).
4. Deploy the functions (from the `life-tracker` folder):
   ```bash
   supabase functions deploy google-auth email-sync email-summarize
   ```
   (`google-auth` replaces the earlier `google-classroom-auth`; the Classroom
   redirect URI becomes `…/functions/v1/google-auth`.)
5. In the app: **Email → Connect Gmail** → pick your school account → Allow.

Life Tracker reads the last 3 days the first time, then new mail since the last
check (when you open Email, or tap **Check now**). It stores only sender,
subject, a short preview and the summary — never the full email — and deletes
summaries after 30 days (change in Email → Settings).

## Part B — AI summaries (Claude)
1. Go to **console.anthropic.com**, create an account (account holders must be
   18+, so a parent may need to do this), add a payment method, and **set a
   monthly spend limit** (Settings → Limits), e.g. $5.
2. Create an API key. Add it as the Edge Function secret
   `ANTHROPIC_API_KEY` (Supabase → Edge Functions → Secrets). Never paste it into
   the app or into chat.
3. Optional: choose the model with the `EMAIL_MODEL` secret.

| `EMAIL_MODEL` | Notes | Rough cost* |
|---|---|---|
| `claude-opus-5-5` (default) | Best quality | ≈ 1¢ per email (≈ $10–15/month at 40 emails a day) |
| `claude-haiku-5-5` | Fast and much cheaper; fine for most email | well under 0.1¢ per email (≈ $0.50/month) |

\*Estimates from list prices ($4/$20 vs $0.10/$0.50 per million input/output
tokens) and a typical school email of ~1,500 tokens; your real usage shows in the
Anthropic console.

What's sent: the email's sender, subject and text, to Anthropic, only to write
the summary. Turn AI off any time in **Email → Settings**; Life Tracker then uses
its built-in quick summaries. Summaries are labeled **AI summary** or
**Quick summary (built-in)** so you always know which you're reading.

## Troubleshooting
| Message | What to do |
|---|---|
| Blocked by school | Use Paste, or ask your school to allow the app |
| Reconnect needed | Testing-mode tokens expire after 7 days — reconnect, or publish the app (Part A.3) |
| Only "Quick summary" appears | Check `ANTHROPIC_API_KEY` is set and AI is on in Email → Settings |
| "Couldn't check email" | Check the functions are deployed and the secrets from SETUP_SCHOOL Part A exist |
