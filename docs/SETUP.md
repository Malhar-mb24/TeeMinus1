# Setup & Deployment Guide

## 1. Prerequisites

- **Node.js:** `>= 20.18.0` (verified on `v22.23.1`)
- **pnpm:** `>= 11.x` (verified on `11.22.0`)
- **Neon PostgreSQL account** (or PostgreSQL 15+)
- **Clerk application** (`@clerk/nextjs` v6)
- **Vercel project** (for web hosting)

---

## 2. Environment Variables (Names Only — Never Commit Real Secrets)

Copy `.env.example` into `apps/web/.env.local` for local web development:

| Variable | Visibility | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server-only | Yes | Neon PostgreSQL connection string (`postgresql://...sslmode=require`) |
| `CLERK_SECRET_KEY` | Server-only | Yes | Clerk backend secret key (`sk_test_...` / `sk_live_...`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Yes | Clerk browser publishable key (`pk_test_...` / `pk_live_...`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Public | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Public | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Public | Yes | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Public | Yes | `/dashboard` |
| `NEXT_PUBLIC_APP_URL` | Public | Optional | Base URL (`http://localhost:3000` locally, Vercel URL in production) |

> **Security rule:** Never prefix `DATABASE_URL` or `CLERK_SECRET_KEY` with `NEXT_PUBLIC_`, and never commit `.env` or `.env.local`.

---

## 3. Neon PostgreSQL Setup & Migrations

1. Create a database project in [Neon](https://neon.tech) and copy:
   - **Pooled connection string** (`-pooler...aws.neon.tech/ember?sslmode=require`) for Vercel runtime `DATABASE_URL`.
   - *(Tip: if `drizzle-kit migrate` reports a PgBouncer advisory lock issue on a pooled host, pass Neon's **direct** unpooled connection string for the `pnpm db:migrate` command while keeping the pooled URL in Vercel.)*
2. Save `DATABASE_URL` in `apps/web/.env.local` (or root `.env`). Both `drizzle.config.ts` and `pnpm db:health` automatically load `apps/web/.env.local` and root `.env`/`.env.local` without overriding shell variables.
3. Apply the ordered Batch 00 + Batch 01 SQL migrations (`0000_curly_mikhail_rasputin.sql` and `0001_soft_changeling.sql`):
   ```bash
   pnpm db:migrate
   ```
4. Verify PostgreSQL connectivity:
   ```bash
   pnpm db:health
   ```
   Expected output: `{"status":"connected","latencyMs":...,"errorCode":null}`.

---

## 4. Clerk Authentication Setup (`@clerk/nextjs` v6)

1. Create an application in the [Clerk Dashboard](https://dashboard.clerk.com).
2. Enable desired sign-in methods (e.g., Email + Password, Google OAuth).
3. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `apps/web/.env.local`.
4. Add the Clerk v6 route variables:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard`
5. In Clerk Dashboard -> **Domains / Allowed origins**, add `http://localhost:3000` for local testing and your Vercel `*.vercel.app` / custom domain for preview and production deployments.

---

## 5. Verification Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

---

## 6. Vercel Monorepo Deployment Steps

1. Push branch `feature/batch-01-core-product` (or `main` after review) to GitHub.
2. Import the repository in **Vercel**:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
   - **Install Command:** `pnpm install --frozen-lockfile` (runs from monorepo root automatically when `pnpm-workspace.yaml` is detected)
   - **Build Command:** `pnpm build` (inside `apps/web`, running `next build`; `apps/web/next.config.ts` includes `transpilePackages` and `outputFileTracingRoot` for monorepo resolution)
3. Add all environment variables from Section 2 under **Vercel Project Settings -> Environment Variables** for **Preview** and **Production**.
4. Ensure migrations have been applied to the target Neon database (`pnpm db:migrate`) **before** opening the deployed app.
5. Deploy and verify:
   - `GET https://<preview-domain>/api/health` returns HTTP `200` with `{"status":"ok","database":"connected","auth":"configured",...}`.
   - Unauthenticated visit to `/dashboard` redirects to `/sign-in`.
   - New sign-up reaches `/onboarding`, persists preferences, and loads `/dashboard`, `/focus`, `/tasks`, `/habits`, `/insights`, `/wellbeing`, and `/settings`.

---

## 7. Chrome MV3 Extension & Windows Desktop App Tracker (Batch 02)

### Load Chrome Extension Unpacked (`apps/extension/dist`)
1. Build the MV3 extension bundle:
   ```bash
   pnpm build:extension
   ```
2. Open Chrome -> `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `apps/extension/dist`.
3. To sync browser domain totals to your Ember account:
   - Open Ember **Digital Wellbeing** (`/wellbeing`), enable **Privacy-First Opt-In Sync**, and click **Pair Chrome Extension**.
   - Open the extension **Options & Sync** page, set your Ember Server URL (`https://ember-nine-flame.vercel.app` or `http://localhost:3000`), paste the pairing code, and click **Pair Browser**.

### Run Windows Desktop Application Tracker (`apps/desktop-tracker`)
1. Build the tracker CLI:
   ```bash
   pnpm build:desktop-tracker
   ```
2. *(Optional sync)* Generate a Windows tracker code in Ember `/wellbeing` and pair once:
   ```bash
   pnpm --filter @ember/desktop-tracker start pair --code XXXX-XXXX --server http://localhost:3000
   ```
3. Start real-time Win32 foreground app & idle tracking:
   ```bash
   pnpm --filter @ember/desktop-tracker start start --poll-ms 1000 --idle-seconds 60
   ```
4. Inspect or export local data anytime without syncing:
   ```bash
   pnpm --filter @ember/desktop-tracker start status
   pnpm --filter @ember/desktop-tracker start export --out desktop-usage.json
   ```
