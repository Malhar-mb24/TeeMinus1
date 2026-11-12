# Ember Architecture (Batch 00)

## 1. System Overview

Ember uses a cohesive TypeScript monorepo managed with `pnpm` workspaces:

- **`apps/web`** — Next.js App Router application serving the public entry page, Clerk authentication routes, protected dashboard/settings shell, and JSON API routes (`/api/health`, `/api/me`, `/api/preferences`).
- **`apps/extension`** — Isolated Chrome Manifest V3 TypeScript build target (`dist/`) for Batch 04 digital-wellbeing features. Kept separate from `apps/web` bundle outputs.
- **`packages/shared`** — Runtime-agnostic Zod validation schemas (`parseServerEnv`, `getEnvReadiness`, `updateUserPreferencesSchema`), shared DTO types, and dark-first design tokens (`EMBER_TOKENS`).
- **`packages/database`** — Drizzle ORM PostgreSQL schema, pooled connection factory (`pg` + Drizzle), SQL migrations (`drizzle/`), health check (`checkDatabaseHealth`), and user profile/preferences repository (`ensureUserProfile`, `updateUserPreferencesForUser`).

```text
Browser UI (Desktop Rail / Mobile Bottom Nav)
  -> Next.js App Router & Middleware (Clerk JWT verification)
  -> Server Components / Route Handlers (apps/web/src/lib/auth.ts)
  -> Database Repository Layer (packages/database)
  -> Neon PostgreSQL (Drizzle ORM + parameterized queries)
```

---

## 2. Database Schema (Batch 00 Scope)

Only the core foundation tables are created in Batch 00:

1. **`users`**
   - `id` (`uuid`, PK) — Internal surrogate key.
   - `clerk_user_id` (`text`, unique index) — External verified identity from Clerk.
   - `email`, `display_name`, `avatar_url`, `onboarding_completed`, `created_at`, `updated_at`.
2. **`user_preferences`**
   - `id` (`uuid`, PK), `user_id` (`uuid`, unique FK -> `users.id` ON DELETE CASCADE).
   - Timer defaults (`pomodoro_minutes`, `short_break_minutes`, `long_break_minutes`, `daily_focus_goal_minutes`), `timezone`, `theme`, `companion_style`, `soundscape_preference`, `extension_tracking_consent`, `extension_consent_updated_at`, `notifications_enabled`.
3. **`extension_devices`** (placeholder)
   - `id` (`uuid`, PK), `user_id` (`uuid`, FK -> `users.id` ON DELETE CASCADE).
   - `device_name`, `browser`, `token_hash` (unique), `status`, `last_seen_at`, `revoked_at`.

Product tables for focus sessions, tasks, habits, XP, and website usage belong to Batches 02–04 and are intentionally omitted here.

---

## 3. UI Shell & Responsiveness

- **Dark-first surface hierarchy:** Canvas `#0B0C0E`, primary cards `#131519`, elevated controls `#1A1D23`, subtle borders `#252932`, restrained flame accent `#F97316`.
- **Desktop (`md+`):** Left navigation rail with active routes (`Dashboard`, `Settings`) and clearly labeled upcoming module slots (`B02`–`B05`).
- **Mobile (`< md`):** Compact sticky header + thumb-friendly bottom navigation bar with `>= 44px` tap targets and `overflow-x-hidden` protection.
- **Honest Foundation State:** No fabricated focus durations, streaks, or screen-time metrics are displayed.
