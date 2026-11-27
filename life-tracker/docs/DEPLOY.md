# Put Life Tracker online and install it on your iPhone

Life Tracker is a static web app: hosting it is free and takes ~5 minutes.
You need the code in a GitHub repository first.

## Option A — Vercel (recommended)
1. Go to **vercel.com** → sign in with GitHub → **Add New… → Project**.
2. Import the repository that contains Life Tracker.
3. Settings:
   | Setting | Value |
   |---|---|
   | Root Directory | `life-tracker/apps/web` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
4. **Environment Variables** (only once Supabase is set up — see `SETUP_SUPABASE.md`):
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. **Deploy**. You get an address like `https://life-tracker-yourname.vercel.app`.
6. Put that address in Supabase → Authentication → URL Configuration → Site URL.

Every push to the branch you choose redeploys automatically.

## Option B — Cloudflare Pages
**Workers & Pages → Create → Pages → Connect to Git**, same settings as above
(build command `npm run build`, output `dist`, root `life-tracker/apps/web`),
same two environment variables.

## Install on iPhone
1. Open the address in **Safari** (installing only works from Safari).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open Life Tracker from the Home Screen — it runs full-screen and works offline.

## Install on a computer
Open the address in Chrome or Edge and click **Install** in the address bar (or
Settings → Install on your devices).

## Notes
- URLs use `#/` (for example `/#/academics`) so the app works on any static host
  without extra server rules.
- Updates: when a new version is deployed, the app shows "Update available —
  Reload now".
