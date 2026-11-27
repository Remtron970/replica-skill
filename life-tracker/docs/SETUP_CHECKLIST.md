# Life Tracker — External Setup Checklist

You don't need any of this for Phase 2. Each item lists the phase that needs
it; I'll give step-by-step instructions at that point.

> Several of these services (Google Cloud, Anthropic API billing, Apple
> Developer Program) require the account holder to be an adult. If you're
> under 18, a parent or guardian can create and own those accounts.

| Needed by | Account / key | Cost | What it's for |
|---|---|---|---|
| Phase 3 | **Supabase** project | Free tier (free projects may pause after a period of inactivity) | Database, sign-in, server functions, scheduled jobs |
| Phase 3 | **GitHub** repository | Free | Code + automatic deploys |
| Phase 3/12 | **Vercel** or **Cloudflare Pages** | Free | Hosting the web app over HTTPS |
| Phase 3 | Sign in with Apple (optional) | Requires Apple Developer Program | Otherwise use Google / email sign-in |
| Phase 4 | **Google Cloud** project + OAuth consent screen; enable Classroom, Gmail, Calendar APIs | Free | Classroom, Gmail, Google Calendar connections |
| Phase 4 | **Canvas access token** (if your school uses Canvas) | Free | Grades and assignments |
| Phase 6 | **Anthropic API key** (console.anthropic.com) | Pay per use; set a monthly spend limit | Email summaries, AI assistant, briefings |
| Phase 7 | iPhone **Shortcuts** app | Free | Sending Apple Health data to the app |
| Phase 7 (optional) | Mac with **Xcode** + **Apple Developer Program** | $99/year | Native iOS app with direct HealthKit / Apple Calendar |
| Phase 8 | **Guardian Open Platform** key, **GNews** key | Free tiers | News feeds |
| Phase 11 | VAPID key pair (I generate it) | Free | Push notifications |

Never paste secret keys into chat. I'll show you where to store each one
(Supabase → Edge Functions → Secrets, or the hosting dashboard).
