# Ember Architecture (Batch 02)

## 1. System Overview

Ember is a responsive full-stack productivity and digital-wellbeing platform built in a `pnpm` TypeScript monorepo:

- **`apps/web`** — Next.js 15 App Router web application (React 19, Tailwind CSS v4, Clerk auth, Lucide icons, Recharts).
  - Routes: `/` (public landing), `/sign-in`, `/sign-up`, `/onboarding`, `/dashboard`, `/focus`, `/tasks`, `/habits`, `/insights`, `/wellbeing`, `/settings`.
  - APIs: `/api/health`, `/api/me`, `/api/preferences`, `/api/onboarding`, `/api/tasks`, `/api/tasks/[id]`, `/api/goals`, `/api/focus-sessions`, `/api/focus-sessions/[id]`, `/api/habits`, `/api/habits/[id]`, `/api/habits/[id]/checkin`, `/api/analytics`, `/api/gamification`, `/api/export`, `/api/devices`, `/api/devices/pairing-code`, `/api/devices/pair`, `/api/devices/[id]/revoke`, `/api/wellbeing`, `/api/wellbeing/sync`, `/api/wellbeing/categories`, `/api/wellbeing/data`.
- **`apps/extension`** — Chrome Manifest V3 extension (`dist/`) tracking active hostname-only browser time with window-focus and `chrome.idle` awareness, incognito exclusion, local storage, and opt-in sync.
- **`apps/desktop-tracker`** — Windows CLI companion using Win32 `GetForegroundWindow` + `GetWindowThreadProcessId` + `GetLastInputInfo` to aggregate active executable usage and idle pauses cleanly.
- **`packages/shared`** — Zod contracts, privacy sanitizers (`extractTrackableHostname`, `normalizeDesktopAppName`), default productivity classifications, timezone-aware date/streak helpers (`getLocalDateKey`, `computeHabitStats`), gamification level/XP rules (`getLevelProgress`, `calculateSessionXp`), and dark-first design tokens (`EMBER_TOKENS`).
- **`packages/database`** — Drizzle ORM PostgreSQL schema (16 tables), connection pool, SQL migrations (`drizzle/`), transactional services for focus sessions, tasks, goals, habits, server-authoritative XP/achievements, wellbeing tracking sync, and indexed analytics aggregations.

---

## 2. Database Schema (Batch 02)

1. **`users`**, **`user_preferences`**, **`extension_devices`** (with `device_type`: `chrome_extension` | `windows_desktop`)
2. **`device_pairing_codes`** — 10-minute one-time pairing codes stored strictly as SHA-256 hashes and consumed atomically inside a transaction.
3. **`website_usage_daily`**, **`app_usage_daily`**, **`website_categories`** — Idempotent per-device daily hostname and desktop application summaries (`GREATEST` upsert) plus custom productive/neutral/distracting classifications.
4. **`tasks`**, **`focus_sessions`**, **`habits`**, **`habit_entries`**, **`goals`**, **`user_progress`**, **`xp_events`**, **`achievements`**, **`user_achievements`** — Core Batch 01 productivity and gamification tables.

---

## 3. Reliability & Privacy Invariants

- **Timestamp-driven Timer:** Elapsed time is calculated from server-persisted `accumulated_seconds + (now - last_resumed_at)` on both server transitions and client visibility/interval syncs, surviving page reloads and tab suspension.
- **Transactional Gamification:** Focus session completion, daily goal bonus checks, streak increments, and achievement unlocks execute inside a single PostgreSQL transaction.
- **FlowTunes Integration:** Non-intrusive soundscape selector and official website link (`https://www.flowtunes.app/index.html`) without proxying or scraping.
- **2D Flame Companion:** Lightweight animated SVG/CSS states (`idle`, `happy`, `excited`, `sleepy`, `celebration`) with level-unlocked cosmetic styles and non-punitive messaging.
