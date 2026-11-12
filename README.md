# Ember

Ember is a full-stack personal focus and digital-wellbeing platform built as a TypeScript monorepo. It pairs a Next.js App Router web application (Clerk authentication, Neon PostgreSQL, Drizzle ORM) with a Chrome Manifest V3 browser tracker and a Windows desktop application tracker.

> **Current Status:** Batch 03 — Product Completion & Experience (Official FlowTunes Launcher/Panel, Focus & Wellbeing Intelligence, Daily/Weekly/Monthly Insights, Consent-Gated Reminders & Quiet Hours, Full-App UX Polish)

---

## Monorepo Structure

```text
ember/
├── apps/
│   ├── web/                # Next.js App Router web app (Tailwind CSS v4, Clerk, Lucide, Recharts)
│   ├── extension/          # Chrome Manifest V3 extension (active tab + idle + opt-in sync)
│   └── desktop-tracker/    # Windows Win32 foreground app & idle tracker CLI
├── packages/
│   ├── shared/             # Zod contracts, privacy hostname/app sanitizers, date/gamification helpers
│   └── database/           # Drizzle ORM schema, connection pool, migrations, transactional services
├── docs/                   # Architecture, setup, decisions, security, notices
├── .env.example            # Placeholder environment variables (no secrets)
├── pnpm-workspace.yaml
└── package.json
```

---

## Quick Start

1. **Install dependencies** (requires Node.js >= 20.18 and pnpm >= 11):
   ```bash
   pnpm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `apps/web/.env.local` (and `.env` at root or `packages/database/.env` when running Drizzle CLI commands):
   ```bash
   cp .env.example apps/web/.env.local
   ```
   See [`docs/SETUP.md`](./docs/SETUP.md) for obtaining Neon PostgreSQL and Clerk credentials.

3. **Run database migrations**:
   ```bash
   pnpm db:migrate
   pnpm db:health
   ```

4. **Start local development**:
   ```bash
   pnpm dev
   ```

---

## Available Scripts

| Command | Purpose |
| :--- | :--- |
| `pnpm dev` | Start Next.js development server (`apps/web`) |
| `pnpm build` | Build shared, database, web, Chrome extension, and desktop tracker targets |
| `pnpm build:web` | Build only `apps/web` for production |
| `pnpm build:extension` | Compile `apps/extension` into `apps/extension/dist` |
| `pnpm build:desktop-tracker` | Compile `apps/desktop-tracker` into `apps/desktop-tracker/dist` |
| `pnpm typecheck` | Run TypeScript checks across all workspace packages |
| `pnpm lint` | Run ESLint on `apps/web` |
| `pnpm test` | Run Vitest unit tests across shared, database, and web |
| `pnpm test:e2e` | Run Playwright smoke tests on desktop and mobile viewports |
| `pnpm db:generate` | Generate Drizzle SQL migrations from `packages/database/src/schema.ts` |
| `pnpm db:migrate` | Apply generated migrations to PostgreSQL |
| `pnpm db:health` | Execute `SELECT 1` connectivity health check |

---

## Documentation Index

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — System architecture, monorepo boundaries, and UI shell
- [`docs/SETUP.md`](./docs/SETUP.md) — Local environment, Neon PostgreSQL, Clerk, and Vercel deployment steps
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — Architectural decision records for Batch 00
- [`docs/SECURITY.md`](./docs/SECURITY.md) — Authentication, ownership enforcement, and secret handling
- [`docs/THIRD_PARTY_NOTICES.md`](./docs/THIRD_PARTY_NOTICES.md) — Reference repository audit & licence compliance log
