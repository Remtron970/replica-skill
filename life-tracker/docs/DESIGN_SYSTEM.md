# Life Tracker — Design System (spec for Phase 2)

## Brand
- **Name:** LIFE TRACKER (wordmark in caps, tight tracking; "Life Tracker" in body text).
- **Tagline:** "One app. Everything happening in my life."
- **Icon:** minimal rounded lightbulb, white glyph on a vibrant-orange →
  burnt-orange gradient squircle; the filament forms a small check-mark
  (organization + growth). Delivered as PNG at 1024, 512, 192, 180
  (apple-touch-icon), 167, 152, 120, 32 and a maskable variant; must read
  clearly at 32 px.

## Color tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | #FF7A1A | #FF8A33 | Fills, icons beside a label, chart series (not for text) |
| `--brand-ink` | #A8430B | #FF9A4D | Orange **text**: links, active nav labels |
| `--brand-strong` / `--on-brand` | #C24E0C / white | #FF8A33 / #1A1208 | Primary button fill and its text |
| `--brand-soft` | #FFE7D2 | #3A2616 | Tints, selected nav background |
| `--hero-from` → `--hero-to` | #C64F0B → #A3400B | #C2541A → #7A3110 | Home greeting gradient (white text) |
| `--brand-deep` | #C2541A | #E0662A | Gradients, pressed states |
| `--bg` | #FFF8F0 (warm cream) | #15120F | App background |
| `--surface` | #FFFFFF | #1F1B17 | Cards |
| `--surface-2` | #FFF1E3 | #2A241F | Nested panels, inputs |
| `--text` | #2B2B2B (charcoal) | #F5EFE8 | Primary text |
| `--text-muted` | #6B6560 | #A89F96 | Secondary text |
| `--border` | #F0E4D7 | #3A322B | Hairlines |
| Accents (text-safe) | blue #2152D9 · purple #7C3AED · green #15703A · yellow #92500A · red #C81E1E | #60A5FA · #A78BFA · #4ADE80 · #FCD34D · #F87171 | Status text, icons, section identity |
| Chart series `--chart-1…5` | #FF7A1A · #3B82F6 · #8B5CF6 · #22C55E · #F5B300 | lifted | Chart lines/bars (graphics need 3:1) |

Each section gets an accent for its icon chip (Academics purple, Schedule blue,
Assignments orange, Email blue, Health green, News red, Calendar yellow,
Productivity green, AI orange gradient). All text/background pairs must meet
WCAG AA contrast. This is **enforced by a test** (`src/design/tokens.test.ts`):
every text/background pair in both themes must reach 4.5:1, or the test suite
fails. Phase 2 found that the bright brand orange is only 2.5:1 as text on
cream, which is why orange text uses `--brand-ink` and buttons use
`--brand-strong`.

## Typography
- **Inter** (variable, self-hosted so it works offline) for UI, with SF Pro as the system fallback on Apple
  devices; tabular numbers for stats and timers.
- Scale: Display 34/40 bold · Title 22/28 semibold · Headline 17/22 semibold ·
  Body 15/22 · Caption 13/18 · Micro 11/14.

## Shape, depth, spacing
- Radius: cards 20 px, buttons 14 px, chips full. 4-px spacing grid; card
  padding 16 (mobile) / 20 (desktop).
- Shadows: soft warm shadows (`0 1px 2px rgba(60,30,0,.06), 0 8px 24px rgba(60,30,0,.06)`); in dark mode borders replace most shadows.

## Motion
| Pattern | Spec |
|---|---|
| Page transition | fade + 8 px slide, 220 ms, ease-out |
| Card press | scale 0.98, spring |
| Card expand | shared-layout animation into detail view |
| Numbers | count-up 600 ms on first view only |
| Charts | draw-in 700 ms, once |
| Toasts / notification popups | slide from top, spring, auto-dismiss 4 s |
| Loading | shimmer skeletons that match the final layout (no spinners for content) |
| Progress rings | animated stroke |
- `prefers-reduced-motion` turns all of this into simple fades.
- Budget: animations use transform/opacity only; target 60 fps on a mid-range iPhone.

## Core components (built in Phase 2 — live gallery at Settings → About → Design system, `/#/design`)
**Built:** AppShell (sidebar / rail / bottom bar + More sheet), PageHeader,
SectionTitle, Card, IconChip, SectionCard (with "synced at · source" footer and
DEMO badge), SyncStatus, Button, IconButton, Spinner, Chip, Badge,
SegmentedControl (also the Day/Week/Month switcher and theme toggle),
TextField, Select, Switch, Sheet, Dialog, Toast, ListRow, EmptyState,
ErrorState, Skeleton, SkeletonCard, ProgressRing, ProgressBar, AnimatedNumber,
Countdown, charts (TrendChart line/area, BarSeries, Donut), InstallCard.

**Deferred to the phase that first needs them:** StatCard with live values +
trend (Phase 3, once there is data), DateTimePicker (Phase 5, assignments and
events).
