# Architectural Decisions (Batch 00)

## ADR-001: Monorepo Root & pnpm Workspaces
- **Decision:** Initialize the `ember` monorepo directly at repository root (`apps/web`, `apps/extension`, `packages/shared`, `packages/database`) using `pnpm` workspaces without Turborepo overhead.
- **Rationale:** Matches PRD §5 while keeping build scripts simple and fast across 4 workspace packages. Turborepo can be added cleanly later if build caching becomes necessary.
- **Note on pnpm v11:** Added `.npmrc` with `verify-deps-before-run=false` and explicit `allowBuilds` in `pnpm-workspace.yaml` so non-interactive test/build runs execute cleanly without re-running `install` implicitly.

## ADR-002: `drizzle-orm/node-postgres` (`pg`) for Database Access
- **Decision:** Use `drizzle-orm/node-postgres` with a lazy singleton `pg.Pool` (`max: 5`) and SSL enforcement for `.neon.tech` / `sslmode=require`.
- **Rationale:** `neon-http` does not support interactive PostgreSQL transactions (`db.transaction`), which are essential for idempotent profile provisioning now and atomic session/XP/streak updates in Batches 02–03. `pg` works uniformly against both Neon's pooled endpoints on Vercel Node.js runtime and standard local PostgreSQL instances.

## ADR-003: Internal Surrogate UUIDs Mapped to Clerk IDs
- **Decision:** `users.id` uses a database-generated `uuid` PK while `users.clerk_user_id` stores the unique indexed Clerk external ID.
- **Rationale:** Decouples relational foreign keys (`user_preferences`, `extension_devices`, and future modules) from external identity provider formats while preserving strict server-side Clerk identity lookup (`ensureUserProfile`).

## ADR-004: Fail-Closed Auth Middleware & Build-Safe Env Handling
- **Decision:** Use `@ember/shared`'s `getEnvReadiness()` in Next.js middleware and root layout so missing Clerk/Neon keys never crash `next build` or leak 500s on public pages, while **still failing closed** (`401` on protected APIs, redirect to `/sign-in` on protected pages).
- **Rationale:** Allows safe CI builds, clean local smoke testing, and early Vercel preview verification before secrets are attached, with zero insecure auth bypasses.

## ADR-005: Offline-Safe System Font Stack
- **Decision:** Define `--font-sans` and `--font-mono` via CSS variables in `globals.css` rather than `next/font/google`.
- **Rationale:** `next/font/google` requires external network fetches at build time, which causes deterministic build failures in network-isolated sandboxes and air-gapped CI environments.
