# Ember Production Release Checklist, Clerk/Neon Runbook & Rollback Plan

> **Scope:** Authoritative Batch 04 release runbook for promoting `feature/batch-04-release` to `main` and deploying Production without downtime or data loss. Do not commit or expose secret values.

---

## 1. Clerk Production Configuration

1. **Create / Switch to Clerk Production Instance** in the [Clerk Dashboard](https://dashboard.clerk.com):
   - Use your verified custom domain (or Clerk production domain setup) and add all required DNS records (Frontend API CNAME, Account Portal CNAME, and DKIM email records if email sign-in is active) until DNS verification passes.
2. **Google OAuth Production Credentials** *(Critical)*:
   - Clerk Development instances allow shared Google OAuth test credentials, **Production requires your own Google Cloud OAuth 2.0 Client ID & Secret**:
     - Create Web OAuth credentials in Google Cloud Console.
     - Add Clerk's Production Authorized Redirect URI shown in **Clerk Dashboard -> SSO Connections -> Google**.
     - Save Client ID & Client Secret in Clerk Production.
3. **Allowed Paths, Origins & Redirect Variables:**
   - Set **Sign-in / Sign-up / Fallback URLs** in Vercel Production Environment Variables:
     - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
     - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
     - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`
     - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard`
     - `NEXT_PUBLIC_APP_URL=https://<your-production-domain>`
   - Replace `pk_test_...` / `sk_test_...` with Production keys (`pk_live_...` in `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `sk_live_...` in `CLERK_SECRET_KEY`) **for Production only** — keep `Preview` on development/staging keys unless testing live domain flows.
4. **Session & Route Guard Invariants:**
   - `apps/web/src/middleware.ts` enforces fail-closed protection on `/dashboard`, `/onboarding`, `/focus`, `/tasks`, `/habits`, `/insights`, `/wellbeing`, `/settings`, and protected `/api/*` endpoints.
   - Public routes remain `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/health`, plus token/pairing-gated `/api/devices/pair` and `/api/wellbeing/sync`.

---

## 2. Neon PostgreSQL, Migrations & Backup / Recovery

1. **Migration Inventory (`packages/database/drizzle/`):**
   - `0000_curly_mikhail_rasputin.sql` — Users, Preferences, Extension Devices
   - `0001_soft_changeling.sql` — Tasks, Focus Sessions, Habits, Habit Entries, Goals, Gamification tables
   - `0002_rainy_tusk.sql` — Additive `extension_devices.device_type` + Pairing Codes, Website/App Usage Daily, Categories
   - `0003_good_reavers.sql` — Additive `user_reminder_preferences` table
   - All migrations from Batch 00 through Batch 04 are strictly additive and already applied/verified on the active database (`pnpm db:migrate` + `pnpm db:health`).
2. **Backups & Point-in-Time Restore (PITR):**
   - Before promoting a major release or applying any future migration, create a named Neon snapshot/branch (`neonctl branches create --name pre-release-YYYYMMDD`) so schema/data can be inspected or restored via Neon PITR without affecting active connections.
   - Keep Neon's **pooled** connection string (`-pooler...sslmode=require`) in Vercel `DATABASE_URL` for serverless scaling, and reserve direct unpooled URLs solely for interactive maintenance or `drizzle-kit migrate` if advisory lock timeouts occur.

---

## 3. Vercel Production & Security Verification

- **Project Settings:** Root Directory = `apps/web`, Install Command = `pnpm install --frozen-lockfile`, Build Command = `pnpm build`.
- **Required Production Environment Variables (Names Only):**
  - `DATABASE_URL` (Secret, Neon pooled connection string)
  - `CLERK_SECRET_KEY` (Secret, `sk_live_...`)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Config, `pk_live_...`)
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (`/sign-in`)
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (`/sign-up`)
  - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` (`/dashboard`)
  - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` (`/dashboard`)
  - `NEXT_PUBLIC_APP_URL` (`https://ember-nine-flame.vercel.app` or custom domain)
- **HTTP Security & Caching Headers (`apps/web/next.config.ts`):**
  - Global: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - API routes (`/api/*`): `Cache-Control: no-store, max-age=0` preventing shared/browser caching of user telemetry or personal records.
- **Logging & Privacy Audit:**
  - Confirmed zero `console.log`/`error` printing of `process.env`, bearer tokens, pairing codes, or user telemetry across `apps/web/src` and `packages/database/src` runtime handlers.
  - Confirmed `extension_devices.token_hash` and `device_pairing_codes.code_hash` store SHA-256 digests only and are omitted from `/api/devices` and `/api/export`.

---

## 4. GitHub Branch Audit & Safe Merge Steps

Verified commit chain (all descendant fast-forward lineage from `main` at `74e41c0`):
- `74e41c0` (`main`, `origin/main`) — Batch 00 Foundation
- `c17699a` (`feature/batch-01-core-product`) — Batch 01 Core Product + Clerk v7 & E2E fixes (`97068a1..c17699a`)
- `1b10edd` (`feature/batch-02-tracking`) — Batch 02 Chrome MV3 Extension, Windows Tracker & `/wellbeing`
- `aaa0fc8` (`feature/batch-03-completion`) — Batch 03 FlowTunes, Focus Intelligence, Insights, Reminders
- `HEAD` (`feature/batch-04-release`) — Batch 04 Final QA fixes & Release Readiness docs

### Exact Integration & Production Promotion Commands (After Manual Approval)
```bash
# 1. Fetch & fast-forward main without rewriting history or force-pushing
git checkout main
git pull origin main
git merge --ff-only feature/batch-04-release
git push origin main

# 2. Ensure Production env vars on Vercel use sk_live_ / pk_live_ & verified custom domain
#    (Check variable names only: pnpm dlx vercel@latest env ls)

# 3. Ensure all migrations (0000..0003) are applied against Production DATABASE_URL
pnpm db:migrate && pnpm db:health

# 4. Deploy Production explicitly (never before owner approval & manual QA)
pnpm dlx vercel@latest deploy --prod --yes --logs
```

---

## 5. Pre-Launch Checklist & Rollback Plan

### Go / No-Go Checklist
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` all pass green on `feature/batch-04-release`.
- [ ] Neon database migrations `0000`–`0003` applied and `pnpm db:health` reports `connected`.
- [ ] Manual QA passed on Preview URL: Google OAuth sign-in, Onboarding, Focus + FlowTunes, Tasks, Habits, Insights Daily/Weekly/Monthly, Reminder alerts & Quiet Hours, Chrome MV3 extension pairing/sync, and interactive Windows Desktop Tracker (`GetForegroundWindow`).
- [ ] Clerk Production keys (`pk_live_`, `sk_live_`) and Google OAuth production client configured in Vercel **Production** environment.
- [ ] `main` merged cleanly without `--force`.

### Instant Rollback Plan
1. **Application Code Rollback (Zero Downtime, ~15s):**
   ```bash
   # List recent production deployments and roll back to previous READY production URL
   pnpm dlx vercel@latest ls --environment production
   pnpm dlx vercel@latest rollback <previous-ready-deployment-url> --yes
   ```
   Because migrations `0002` and `0003` are strictly additive (new tables + defaulted `device_type`), Batch 01 Production code continues running against the database seamlessly with zero schema downgrade required.
2. **Database Recovery (Only if Data Corruption Suspected):**
   - Restore to the pre-release Neon branch / timestamp snapshot via Neon Console (**Branches / Restore / Time Travel**) and re-verify `pnpm db:health`.
3. **Emergency Tracking Cutoff:**
   - Individual devices can be revoked immediately via `/wellbeing` (`POST /api/devices/[id]/revoke`), or cloud sync paused per user via `PATCH /api/preferences` (`extensionTrackingConsent: false`).
