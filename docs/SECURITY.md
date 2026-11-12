# Security & Privacy Baseline (Batch 00)

## 1. Secret Management
- Secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`) are strictly server-only and never prefixed with `NEXT_PUBLIC_`.
- Server modules (`apps/web/src/lib/auth.ts`) import `"server-only"` so accidental inclusion in Client Components fails at build time.
- `.env` and `.env.*` (except `.env.example`) are excluded in `.gitignore`.
- Environment validation (`parseServerEnv`, `requireServerEnv`) reports missing/invalid **variable names only**—never raw values.

## 2. Authentication & Ownership Enforcement
- **Middleware Protection:** `apps/web/src/middleware.ts` enforces authentication on `/dashboard(.*)`, `/settings(.*)`, `/api/me(.*)`, and `/api/preferences(.*)`.
- **Defense in Depth:** Both `(app)/layout.tsx` and individual route handlers re-verify identity server-side via `getVerifiedSession()` (`@clerk/nextjs/server`).
- **No Client-Supplied Trust:** No route reads `userId` from query strings, JSON bodies, or custom headers. Preferences updates (`PATCH /api/preferences`) update `WHERE user_id = <verified internal user id>`.
- **Fail-Closed Default:** If Clerk environment keys are absent or invalid, protected page routes redirect to `/sign-in` and protected API routes return `401 Unauthorized`.

## 3. Input Validation & Error Hygiene
- All incoming API JSON payloads are parsed safely and validated against Zod schemas (`updateUserPreferencesSchema`).
- Health and API error responses sanitize underlying exceptions and never expose stack traces, SQL queries, or PostgreSQL connection errors.
- Response security headers configured in `apps/web/next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

## 4. Extension & Wellbeing Privacy Boundary (Batch 04 Prep)
- `extension_devices` stores `token_hash` only (unique index) so raw extension bearer tokens are never persisted in plaintext.
- `user_preferences.extension_tracking_consent` defaults to `false`, requiring explicit opt-in before future extension sync.
- `apps/extension/manifest.json` requests minimal permissions (`tabs`, `idle`, `storage`, `alarms`) without broad content script injection.
