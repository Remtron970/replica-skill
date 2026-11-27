# Set up Health (Apple Health via an iPhone Shortcut)

Works without any setup: **Health → Add** lets you type steps, distance,
active energy and exercise minutes for any day.

The steps below send your numbers from **Apple Health** automatically. A web app
can't read Apple Health directly (only native iPhone apps can, and that needs a
Mac and Xcode), so a free **Shortcut** on your iPhone reads the numbers and sends
them to Life Tracker.

Before you start: cloud sync (`SETUP_SUPABASE.md`, including
`20261127050000_health.sql`) and sign in to the app on your iPhone.

## Part A — Deploy the two functions (once)
From the `life-tracker` folder:
```bash
supabase functions deploy health-token
supabase functions deploy health-ingest --no-verify-jwt
```
`--no-verify-jwt` is needed because the Shortcut signs in with your personal
Health key, not with a Supabase session. The function checks that key itself and
refuses everything else.

## Part B — Get your key
In the app: **Health → Connect Apple Health → Make my key**. Copy the
**Address** and the **Key** line (it starts with `Bearer lth_`). The key is shown
only once. Life Tracker stores only a fingerprint of it (SHA-256). Making a new
key turns the old one off; **Health → Settings → Turn off Shortcut key** turns it
off completely.

The key can only *add* numbers to your Health page. It can't read anything,
and it can't touch the rest of your account. Still, don't share it.

## Part C — Build the Shortcut (iPhone)
1. Open **Shortcuts** → **+** → name it **Send to Life Tracker**.
2. Add **Find Health Samples**: *Type* **Steps**, filter *Start Date* **is
   today**. Then add **Calculate Statistics** → **Sum** of the Health Samples.
3. Do the same for **Walking + Running Distance**, **Active Energy** and
   **Exercise Minutes** (four Find + four Calculate Statistics in total). You can
   skip any you don't want.
4. Add **Get Contents of URL**:
   - URL: the **Address** you copied.
   - **Method**: POST.
   - **Headers**: add `Authorization` with the value of the **Key** line
     (`Bearer lth_…`).
   - **Request Body**: JSON, with these fields (type *Number*, each set to the
     matching *Statistics* result):

     | Field | Value |
     |---|---|
     | `steps` | Steps sum |
     | `distance_mi` (or `distance_km` if your iPhone uses km) | Distance sum |
     | `active_energy_kcal` | Active Energy sum |
     | `exercise_minutes` | Exercise Minutes sum |

5. Optional, only if you turned on **Health → Settings → Show weight**: add a
   **Find Health Samples** for *Weight*, *Sort by* Start Date *Latest First*,
   *Limit* 1, and add a field `weight_lb` (or `weight_kg`).
6. Tap ▶︎. iPhone asks for Health access the first time: allow only the types
   you used. The app's Health page then shows **Receiving**.

Tip: add **Show Result** after *Get Contents of URL* while testing. The answer
says which days were saved, plus anything that was ignored and why.

## Part D — Make it automatic
**Shortcuts → Automation → +** → **Time of Day** (e.g. 9:00 PM, Daily) →
**Run Immediately** → pick **Send to Life Tracker**.

Known iPhone limitation: Apple Health is locked while the phone is locked, so a
run while the phone is locked can fail or send nothing. Each run sends the
*whole day so far*, so the next successful run (or tapping ▶︎ yourself) fills it
in. Nothing is double-counted: one Health row per day is updated.

## What gets sent and stored
Only the numbers above, the date and your key. They're stored in your private
tables (`health_daily`, `weight_entries`), which only your account can read.
Apple Health numbers replace typed ones for the same day, metric by metric. Days
with no data stay empty, never zero. **Health → Settings → Delete all health
data** removes everything on all your devices (Apple Health itself is not
affected).

## Advanced: what the Address accepts
`POST` JSON, header `Authorization: Bearer lth_…`:
- Today: `{"steps": 8421, "distance_mi": 3.2, "active_energy_kcal": 410, "exercise_minutes": 34}`
- Specific or several days (max 60 days back): `{"days": [{"date": "2026-11-24", "steps": 5100}, …]}`
- Numbers may be text (`"8,421"`); distance `distance_km`/`distance_mi`; weight
  `weight_kg`/`weight_lb`. Impossible values (e.g. negative steps) are ignored
  and listed in the reply.
- Replies: `200 {"ok": true, "saved": {...}, "problems": [...]}`, `401` bad key,
  `400` nothing usable.

## Troubleshooting
| Problem | Fix |
|---|---|
| Reply says the key isn't valid | A newer key replaced it, or it was turned off. Make a new key and paste it into the Shortcut. |
| `No health values found` | The JSON field names don't match the table above. |
| Numbers are 0 | Health access wasn't granted for that type: Settings → Health → Data Access & Devices → Shortcuts. |
| Distance looks 1.6× off | Use `distance_mi` if your iPhone shows miles, `distance_km` if km. |
| Automation didn't run | The phone was locked; open the Shortcut and tap ▶︎, or pick a time you're usually using your phone. |
