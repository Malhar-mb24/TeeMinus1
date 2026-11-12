# Ember Architecture (Batch 03)

## 1. System Overview

Ember is a responsive full-stack productivity and digital-wellbeing platform built in a `pnpm` TypeScript monorepo:

- **`apps/web`** — Next.js 15 App Router web application (React 19, Tailwind CSS v4, Clerk auth, Lucide icons, Recharts).
  - Routes: `/` (public landing), `/sign-in`, `/sign-up`, `/onboarding`, `/dashboard`, `/focus`, `/tasks`, `/habits`, `/insights`, `/wellbeing`, `/settings`.
  - APIs: `/api/health`, `/api/me`, `/api/preferences`, `/api/onboarding`, `/api/tasks`, `/api/tasks/[id]`, `/api/goals`, `/api/focus-sessions`, `/api/focus-sessions/[id]`, `/api/habits`, `/api/habits/[id]`, `/api/habits/[id]/checkin`, `/api/analytics`, `/api/gamification`, `/api/export`, `/api/devices`, `/api/devices/pairing-code`, `/api/devices/pair`, `/api/devices/[id]/revoke`, `/api/wellbeing`, `/api/wellbeing/sync`, `/api/wellbeing/categories`, `/api/wellbeing/data`, `/api/reminders`, `/api/intelligence`.
- **`apps/extension`** — Chrome Manifest V3 extension (`dist/`) tracking active hostname-only browser time with window-focus and `chrome.idle` awareness, incognito exclusion, local storage, and opt-in sync.
- **`apps/desktop-tracker`** — Windows CLI companion using Win32 `GetForegroundWindow` + `GetWindowThreadProcessId` + `GetLastInputInfo` to aggregate active executable usage and idle pauses cleanly.
- **`packages/shared`** — Zod contracts, privacy sanitizers (`extractTrackableHostname`, `normalizeDesktopAppName`), reminder evaluation (`isWithinQuietHours`, `evaluateDueReminders`), focus intelligence helpers (`classifyFocusOutcome`, `computeSessionPauseGapSeconds`), timezone-aware date/streak helpers, gamification level/XP rules, and dark-first design tokens (`EMBER_TOKENS`).
- **`packages/database`** — Drizzle ORM PostgreSQL schema (17 tables), connection pool, SQL migrations (`drizzle/`), transactional services for focus sessions, tasks, goals, habits, server-authoritative XP/achievements, wellbeing tracking sync, reminder schedules, focus intelligence, and indexed analytics aggregations.

---

## 2. Database Schema (Batch 03)

1. **`users`**, **`user_preferences`**, **`user_reminder_preferences`**, **`extension_devices`** (`chrome_extension` | `windows_desktop`)
2. **`device_pairing_codes`** — 10-minute one-time pairing codes stored strictly as SHA-256 hashes and consumed atomically inside a transaction.
3. **`website_usage_daily`**, **`app_usage_daily`**, **`website_categories`** — Idempotent per-device daily hostname and desktop application summaries (`GREATEST` upsert) plus custom productive/neutral/distracting classifications.
4. **`tasks`**, **`focus_sessions`**, **`habits`**, **`habit_entries`**, **`goals`**, **`user_progress`**, **`xp_events`**, **`achievements`**, **`user_achievements`** — Core productivity and gamification tables.

---

## 3. Reliability & Privacy Invariants

- **Timestamp-driven Timer:** Elapsed time is calculated from server-persisted `accumulated_seconds + (now - last_resumed_at)` on both server transitions and client visibility/interval syncs, surviving page reloads and tab suspension.
- **Transactional Gamification:** Focus session completion, daily goal bonus checks, streak increments, and achievement unlocks execute inside a single PostgreSQL transaction.
- **FlowTunes Integration:** Official link-out to `https://www.flowtunes.app/index.html` paired with an optional sandboxed in-page preview and graceful blocked-embed fallback — no scraping, proxying, or fabricated playback APIs.
- **Honest Time Accounting & Intelligence:** Focus time, browser domain totals, Windows desktop usage, and observed session pause gaps are separated explicitly. Untracked intervals stay `"Unknown"` rather than estimated, and same-day distracting usage is presented without false causal claims.
- **Consent-Gated Reminders:** Browser notifications require explicit permission + user opt-in consent, honor configured Quiet Hours, and fall back to accessible in-app toasts cleanly.
