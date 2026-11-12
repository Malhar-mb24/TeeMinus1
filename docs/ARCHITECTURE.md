# Ember Architecture (Batch 01)

## 1. System Overview

Ember is a responsive full-stack productivity and digital-wellbeing platform built in a `pnpm` TypeScript monorepo:

- **`apps/web`** — Next.js 15 App Router web application (React 19, Tailwind CSS v4, Clerk auth, Lucide icons, Recharts).
  - Routes: `/` (public landing), `/sign-in`, `/sign-up`, `/onboarding`, `/dashboard`, `/focus`, `/tasks`, `/habits`, `/insights`, `/settings`.
  - APIs: `/api/health`, `/api/me`, `/api/preferences`, `/api/onboarding`, `/api/tasks`, `/api/tasks/[id]`, `/api/goals`, `/api/focus-sessions`, `/api/focus-sessions/[id]`, `/api/habits`, `/api/habits/[id]`, `/api/habits/[id]/checkin`, `/api/analytics`, `/api/gamification`, `/api/export`.
- **`apps/extension`** — Separate Chrome Manifest V3 build target (`dist/`) reserved for Batch 04 browser tracking.
- **`packages/shared`** — Zod contracts, environment validation, timezone-aware date/streak helpers (`getLocalDateKey`, `computeHabitStats`), gamification level/XP rules (`getLevelProgress`, `calculateSessionXp`), and dark-first design tokens (`EMBER_TOKENS`).
- **`packages/database`** — Drizzle ORM PostgreSQL schema (12 tables), connection pool, SQL migrations (`drizzle/`), transactional services for focus sessions, tasks, goals, habits, server-authoritative XP/achievements, and indexed analytics aggregations.

---

## 2. Database Schema (Batch 01)

1. **`users`**, **`user_preferences`**, **`extension_devices`** (Batch 00 foundation)
2. **`tasks`** — Task title, description, category, hex color bar, priority, status, planned minutes, `scheduled_date`, `planned_start_minute`, `completed_at`. Indexed on `(user_id, scheduled_date)` and `(user_id, status)`.
3. **`focus_sessions`** — Timestamp-anchored sessions (`started_at`, `last_resumed_at`, `accumulated_seconds`, `ended_at`, `local_date`, `mode`, `status`, `task_id`, `label`, `notes`, `soundscape`, `xp_earned`, `completion_idempotency_key`). Indexed on `(user_id, status)`, `(user_id, local_date)`, `(user_id, started_at)` and unique `(user_id, completion_idempotency_key)`.
4. **`habits`** & **`habit_entries`** — Custom schedules (`daily` | `weekdays`), `target_per_day`, and strictly one entry per habit/user/`local_date` (`completed` | `partial` | `skipped` | `missed`).
5. **`goals`** — Daily (`YYYY-MM-DD`) and weekly (`YYYY-Www`) focus minute/session targets.
6. **`user_progress`**, **`xp_events`**, **`achievements`**, **`user_achievements`** — Server-authoritative XP ledger with unique `(user_id, idempotency_key)` preventing duplicate rewards and XP farming.

---

## 3. Reliability & Privacy Invariants

- **Timestamp-driven Timer:** Elapsed time is calculated from server-persisted `accumulated_seconds + (now - last_resumed_at)` on both server transitions and client visibility/interval syncs, surviving page reloads and tab suspension.
- **Transactional Gamification:** Focus session completion, daily goal bonus checks, streak increments, and achievement unlocks execute inside a single PostgreSQL transaction.
- **FlowTunes Integration:** Non-intrusive soundscape selector and official website link (`https://www.flowtunes.app/index.html`) without proxying or scraping.
- **2D Flame Companion:** Lightweight animated SVG/CSS states (`idle`, `happy`, `excited`, `sleepy`, `celebration`) with level-unlocked cosmetic styles and non-punitive messaging.
