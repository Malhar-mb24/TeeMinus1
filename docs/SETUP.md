# Setup & Deployment Guide

## 1. Prerequisites

- **Node.js:** `>= 20.18.0` (verified on `v22.23.1`)
- **pnpm:** `>= 11.x` (verified on `11.22.0`)
- **Neon PostgreSQL account** (or local PostgreSQL 15+ for development)
- **Clerk application** (for authentication)
- **Vercel project** (for web hosting)

---

## 2. Environment Variables

Copy `.env.example` into `apps/web/.env.local` for local web development:

| Variable | Visibility | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server-only | Yes | Neon PostgreSQL pooled connection string (`postgresql://...sslmode=require`) |
| `CLERK_SECRET_KEY` | Server-only | Yes | Clerk backend API key (`sk_test_...` / `sk_live_...`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Yes | Clerk browser publishable key (`pk_test_...` / `pk_live_...`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Public | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Public | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Public | Yes | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Public | Yes | `/dashboard` |
| `NEXT_PUBLIC_APP_URL` | Public | Optional | Base URL (`http://localhost:3000` locally, Vercel URL in prod) |

> **Never prefix `DATABASE_URL` or `CLERK_SECRET_KEY` with `NEXT_PUBLIC_`.**

---

## 3. Database Setup & Migrations (Neon + Drizzle)

1. Create a database project in [Neon](https://neon.tech) and copy the **pooled** PostgreSQL connection string (`-pooler...aws.neon.tech/...?sslmode=require`).
2. Export `DATABASE_URL` in your shell or `.env` for Drizzle CLI:
   ```bash
   # PowerShell example
   $env:DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/ember?sslmode=require"
   ```
3. Run the generated Batch 00 migration (`packages/database/drizzle/0000_curly_mikhail_rasputin.sql`):
   ```bash
   pnpm db:migrate
   ```
4. Verify database connectivity:
   ```bash
   pnpm db:health
   ```
   Expected output: `{"status":"connected","latencyMs":...,"errorCode":null}`.

To generate future schema migrations after modifying `packages/database/src/schema.ts`:
```bash
pnpm db:generate
```

---

## 4. Clerk Authentication Setup

1. Create an application in the [Clerk Dashboard](https://dashboard.clerk.com).
2. Enable email/password or preferred OAuth providers.
3. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `apps/web/.env.local`.
4. Configure Clerk redirect paths in Clerk Dashboard -> **Paths** (or via env vars):
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - Fallback redirect after sign-in / sign-up: `/dashboard`

---

## 5. Verification Commands

```bash
# TypeScript across all packages
pnpm typecheck

# ESLint (apps/web)
pnpm lint

# Unit tests (shared, database, web)
pnpm test

# Production build (shared, database, web, extension)
pnpm build

# End-to-end Playwright smoke suite (requires production build)
pnpm test:e2e
```

---

## 6. Vercel Deployment Steps

1. Push branch `feature/batch-00-foundation` (or `main` after PM approval) to GitHub.
2. Import the repository in **Vercel**:
   - **Root Directory:** `apps/web` (recommended) — or keep repo root and configure build/install commands:
     - **Install Command:** `pnpm install --frozen-lockfile`
     - **Build Command:** `pnpm --filter @ember/web build`
     - **Output Directory:** `apps/web/.next` (auto-detected if Root Directory is `apps/web`).
3. Add all environment variables from `.env.example` under **Project Settings -> Environment Variables** for **Preview** and **Production**.
4. Ensure Clerk **Allowed redirect origins / domains** include your Vercel preview (`*.vercel.app`) and production domains.
5. Deploy and verify `GET /api/health` returns HTTP `200` with `"status": "ok"`, `"database": "connected"`, `"auth": "configured"`.

---

## 7. Known Limitations (Batch 00)

- Focus timer, task planner, habits, gamification, and Chrome extension sync are intentionally deferred to Batches 02–04.
- Live Clerk login and Neon database execution require real credentials in `.env.local` / Vercel; when unconfigured, `/api/health` reports `503 degraded` and protected routes fail closed to `/sign-in`.
