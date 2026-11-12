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

## 4. Extension & Desktop Wellbeing Privacy Boundary (Batch 02)
- `device_pairing_codes.code_hash` and `extension_devices.token_hash` store SHA-256 digests only; plaintext tokens are returned once at pairing time and never stored or re-exposed.
- `user_preferences.extension_tracking_consent` defaults to `false`; `/api/wellbeing/sync` rejects uploads with HTTP `403 CONSENT_REQUIRED` unless explicit sync consent is enabled.
- `apps/extension/manifest.json` requests minimal permissions (`tabs`, `idle`, `storage`, `alarms`) without broad content script injection or DOM reading. Incognito windows and internal browser schemes (`chrome://`, `edge://`, `about:`, `file://`) are strictly excluded.
- Both `apps/extension` and `apps/desktop-tracker` strip full URLs, paths, query strings, window titles, keystrokes, screenshots, and clipboard content — storing only normalized hostnames (`github.com`) and executable binary names (`code.exe`).
- Sliding-window rate limiting protects `/api/devices/pairing-code`, `/api/devices/pair`, and `/api/wellbeing/sync`, while `DELETE /api/wellbeing/data` and `POST /api/devices/[id]/revoke` enforce strict user ownership.
- Scheduled reminder delivery (`GET`/`PUT /api/reminders`, `user_reminder_preferences`) enforces authenticated user scoping, quiet-hour suppression (`isWithinQuietHours`), and explicit master notification consent without requesting browser permissions until initiated by user click.
