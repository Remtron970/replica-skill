# Life Tracker — Database Design (Supabase Postgres)

> **Implemented so far** (see `supabase/migrations/`): `profiles` (incl.
> `academic_settings`), `terms`, `grading_scales`, `courses`,
> `grade_categories`, `grade_items`, `past_courses`, `integrations`,
> `integration_tokens`, `sync_runs`, `day_types`, `schedule_blocks`,
> `schedule_exceptions`, `assignments` (and `profiles.schedule_settings`). The rest of this document is the plan for
> later phases.
>
> **Sync model** (all synced tables): `id` is created on the device so records
> can be made offline; `client_updated_at` is when the user changed it (newest
> wins, enforced by the `sync_row_guard` trigger, which ignores older writes);
> `updated_at` is set by the server so devices can download "changes since";
> `deleted` is a soft delete so deletions reach every device. Synced tables
> don't use foreign keys between each other (a device may upload a class before
> its term); the app keeps references consistent.

Conventions for every user-owned table:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users on delete cascade`
- `created_at`, `updated_at timestamptz` (trigger-maintained)
- `source text` — `'manual' | 'demo' | 'google_classroom' | 'canvas' | 'gmail' | 'google_calendar' | 'apple_health' | 'ics' | 'csv_import'`
- `external_id text` + unique `(user_id, source, external_id)` for synced rows (idempotent upserts)
- `synced_at timestamptz` for synced rows
- **RLS enabled**: select/insert/update/delete where `user_id = auth.uid()`

All times UTC; local dates (`date` columns) are computed in the user's time zone.

## Identity & settings
| Table | Key columns |
|---|---|
| `profiles` | user_id (pk), display_name, avatar_url, timezone, locale, school_name, grade_level, location_city, location_region, location_country, briefing_time (default 07:00), weekly_recap_day/time, theme (`system/light/dark`), dashboard_layout jsonb, nav_pins text[], demo_mode bool |
| `ai_permissions` | user_id, section (`academics/email/health/news/calendar/productivity`), allowed bool |
| `notification_prefs` | user_id, category, enabled, min_priority, quiet_start, quiet_end, max_per_window, window_minutes, lead_times int[] (e.g. assignment reminders 1440, 120 min) |
| `push_subscriptions` | user_id, kind (`webpush/apns`), endpoint/token, keys jsonb, device_label, last_seen_at |

## Integrations
| Table | Key columns |
|---|---|
| `integrations` | user_id, provider, status (`connected/error/expired/blocked/disconnected`), scopes text[], account_label (e.g. email address), last_sync_at, last_error, settings jsonb (Canvas base URL, …) — readable by client |
| `integration_tokens` | integration_id, access_token_enc, refresh_token_enc, expires_at, iv — **no client policies**; service role only |
| `sync_runs` | integration_id, started_at, finished_at, status, items_upserted, error — powers "last synced" and debugging |
| `health_ingest_tokens` | user_id, token_hash, created_at, last_used_at — for the iOS Shortcut |

## Academics
| Table | Key columns |
|---|---|
| `terms` | user_id, name ("Fall 2026"), starts_on, ends_on, is_current |
| `grading_scales` | user_id, name, bands jsonb (`[{min:93, letter:"A", points:4.0}, …]`), is_default |
| `courses` | user_id, term_id, name, teacher, room, color, credits (default 1.0), level (`regular/honors/ap/ib/dual`), weight_bonus (default by level, editable), grading_scale_id, current_percent (cached), letter (cached), grading_mode (`points/weighted_categories`), source, external_id |
| `grade_categories` | course_id, name ("Tests"), weight_percent |
| `grade_items` | course_id, category_id, assignment_id (nullable), title, points_earned, points_possible, is_excused, is_missing, graded_at, is_hypothetical (what-if) |
| `grade_snapshots` | course_id, taken_on date, percent, letter — daily snapshot for history charts and "grade changed" detection |
| `term_results` | user_id, term_id, course name, final_letter, credits, level — for cumulative GPA from past terms (manual) |

GPA math lives in `packages/shared/gpa.ts` (pure, unit-tested):
unweighted = Σ(points×credits)/Σcredits; weighted adds `weight_bonus`
(defaults +0.5 honors, +1.0 AP/IB — editable because schools differ).

## Schedule & calendar
| Table | Key columns |
|---|---|
| `schedule_blocks` | user_id, course_id (nullable), title, teacher, room, day_pattern (`weekly` with days int[] **or** `rotation` with rotation_day e.g. "A"/"B"), start_time, end_time, term_id |
| `rotation_calendar` | user_id, date, rotation_day — supports A/B and block schedules |
| `schedule_exceptions` | user_id, date, kind (`no_school/early_release/custom`), note |
| `calendar_events` | user_id, title, starts_at, ends_at, all_day, location, notes, calendar_name, color, recurrence_rule (RRULE), source, external_id |
| `reminders` | user_id, title, remind_at, recurrence_rule, done_at, linked_type, linked_id |

## Assignments
| Table | Key columns |
|---|---|
| `assignments` | user_id, course_id, title, description, due_at, priority (`low/normal/high`), status (`todo/in_progress/submitted/graded/missing/excused`), completed_at, points_possible, grade_received, url (open in Classroom/Canvas), local_priority_override, source, external_id |

## Email
| Table | Key columns |
|---|---|
| `emails` | user_id, gmail_id, thread_id, from_name, from_email, subject, snippet, received_at, labels text[], category (`important/school/personal/notifications/other`), ai_summary, has_deadline, deadline_at, needs_reply, is_school, importance (0–3), web_url |
| `email_digests` | user_id, for_date, summary_md, counts jsonb |

## Health
| Table | Key columns |
|---|---|
| `health_daily` | user_id, day date, steps, walk_run_distance_m, running_distance_m, active_energy_kcal, exercise_minutes, source — unique (user_id, day, source) |
| `weight_entries` | user_id, measured_at, weight_kg, source |

## News
| Table | Key columns |
|---|---|
| `news_articles` (shared, read-only for users) | id, provider, region_key (`world` or `us-ca-sacramento`), category, title, summary, source_name, url, image_url, published_at, is_breaking, is_developing, cluster_id, source_count |
| `news_prefs` | user_id, categories text[], muted_sources text[], local_enabled |

## Productivity
| Table | Key columns |
|---|---|
| `tasks` | user_id, title, notes, due_on, priority, completed_at, list (`today/someday`), sort_order |
| `goals` | user_id, title, period (`week/month/custom`), target_value, unit, current_value, starts_on, ends_on, status |
| `habits` | user_id, name, icon, color, schedule (days int[] or times-per-week), target_per_day, archived |
| `habit_logs` | habit_id, day, count — streaks computed from this |
| `milestones` | user_id, title, achieved_at, kind (auto e.g. "30-day streak" or manual) |

## Automation & AI
| Table | Key columns |
|---|---|
| `briefings` | user_id, kind (`daily/weekly`), for_date, content jsonb (sections + "unavailable" list), summary_md, generated_at, model |
| `notifications` | user_id, category, priority, title, body, deep_link, created_at, read_at, delivered_at, dedupe_key (unique) |
| `ai_conversations` | user_id, title, created_at |
| `ai_messages` | conversation_id, role, content jsonb, tool_calls jsonb, created_at |

## Data lifecycle
- **Export:** Edge Function `export-data` builds a zip of JSON + CSV per table.
- **Delete account:** revoke OAuth tokens at providers → delete `auth.users`
  row → cascades every table.
- **Retention:** emails 30 days (configurable), AI messages until you delete
  them, news articles 14 days.
