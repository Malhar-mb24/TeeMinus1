# Third-Party Notices & Reference Repository Audit

Per Batch 00 engineering guidelines (§3), all five reference repositories were cloned and inspected directly before implementation. **No source code, UI components, or binary assets were copied** into Ember; all Ember code in Batch 00 is original.

---

## Reference Repository Licence & Quality Audit

| Repository | Inspected Licence | Code Reused? | Architectural Lessons & Notes |
| :--- | :--- | :--- | :--- |
| `bendeze/focus-web` | **MIT License** (`LICENSE`, Copyright 2026 Focus Contributors) | No (design & architecture study only) | Clean dark-first color tokens (`#0C0C0E` canvas, `#141416` surface, `#242428` subtle borders), `tabular-nums` timer typography, modular separation of dashboard/analytics/tasks, accessible toast/aria patterns. Uses Python/FastAPI + Vite SPA rather than Next.js/Drizzle. |
| `Xtrios09/Flocus-V2` | **MIT License** (`LICENSE`, Copyright 2025 Abhijeet Prabhakar) | No (schema/drizzle config study only) | Helpful reference for Drizzle + Neon `drizzle.config.ts` structure, Zod validation alongside Drizzle schemas, and modular music/avatar boundaries. Avoided mixing MUI + Radix UI + Express patterns from that repo. |
| `smrithipiedy/Questify` | **Absent / Unclear** (`README.md` links to `LICENSE`, but no `LICENSE` file or `"license"` field exists in repo; `.env` was also committed in repo) | **No — Prohibited** (unclear licence) | Studied conceptual StudyBuddy/gamification domain framing only. Strictly avoided code reuse due to missing `LICENSE` file and avoided the repo's `.env` commit anti-pattern. |
| `JOY-BOY0912/Student-learning-tracker` | **Absent / Unclear** (no `LICENSE` file and no `"license"` field in `package.json`) | **No — Prohibited** (absent licence) | Studied high-level student XP/badge progression concepts only. Strictly avoided code reuse due to absent licence. |
| `timgioh/Privacy-First-Screen-Time-Focus-Dashboard` | **Absent / Unclear** (no `LICENSE` file and no `"license"` field in `package.json`) | **No — Prohibited** (absent licence) | Studied MV3 `manifest.json` permission scope (`tabs`, `idle`, `storage`, `alarms`) and `PRIVACY.md` local-first documentation style. Strictly avoided code reuse due to absent licence. |

---

## Direct Package Dependencies

Ember relies on standard open-source ecosystem packages installed via `pnpm` (Next.js, React, Clerk SDK, Drizzle ORM, `pg`, Zod, Tailwind CSS, Radix UI primitives, Lucide React, Vitest, Testing Library, Playwright). Refer to `pnpm-lock.yaml` and each package's upstream licence metadata.
