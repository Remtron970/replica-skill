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
| `--brand` | #FF7A1A | #FF8A33 | Primary buttons, active nav, key numbers |
| `--brand-deep` | #C2541A | #E0662A | Gradients, pressed states |
| `--bg` | #FFF8F0 (warm cream) | #15120F | App background |
| `--surface` | #FFFFFF | #1F1B17 | Cards |
| `--surface-2` | #FFF1E3 | #2A241F | Nested panels, inputs |
| `--text` | #2B2B2B (charcoal) | #F5EFE8 | Primary text |
| `--text-muted` | #6B6560 | #A89F96 | Secondary text |
| `--border` | #F0E4D7 | #3A322B | Hairlines |
| Accents | blue #3B82F6 · purple #8B5CF6 · green #22C55E · yellow #F5B300 · red #EF4444 | slightly lifted in dark | Charts, status, section identity |

Each section gets an accent for its icon chip (Academics purple, Schedule blue,
Assignments orange, Email blue, Health green, News red, Calendar yellow,
Productivity green, AI orange gradient). All text/background pairs must meet
WCAG AA contrast (checked in Phase 2).

## Typography
- **Inter** (variable) for UI, with SF Pro as the system fallback on Apple
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

## Core components (built in Phase 2)
AppShell (sidebar / rail / bottom bar + More sheet), PageHeader, Card,
StatCard (animated number + trend), SectionCard (with "synced at · source"
footer and DEMO badge), Button, IconButton, Chip, Badge, Tabs/SegmentedControl,
Sheet, Dialog, Toast, ListRow, EmptyState (with "Connect" CTA), ErrorState,
Skeleton, ProgressRing, ProgressBar, Countdown, Chart wrappers (line, bar,
area, donut), FormField, DateTimePicker, ThemeToggle, SyncStatus.
