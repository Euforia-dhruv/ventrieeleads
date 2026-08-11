# Codebase Audit — AI Lead Generation Platform

Audit date: 2026-08-08
Scope: full stack (`backend/`, `frontend/`, `docker-compose.yml`, `.github/workflows/ci.yml`, DB schema)
Method: static inspection, running the project's own check scripts where available, diffing phase claims vs. reality.

> **UPDATE (2026-08-08, follow-up pass):** All critical blockers (C1–C3) and gaps (G1–G4) identified below have been **fixed**. See the "Resolution log" section at the bottom.

## Executive summary

The codebase is far more complete than the phase plan assumes. The backend already has a provider registry with real providers, real controllers, routes, auth, and Celery workers. The frontend already has the map + results split view, filters, examples, polling, and AI scoring display. Docker Compose defines all services. CI defines lint, typecheck, unit, and integration jobs.

However, verification found **3 critical blockers** that would break the advertised "production-ready" state, plus several gaps/misalignments between the phase plan and reality.

## Critical (must fix)

### C1. CI `format` jobs will fail — 1424 files fail Prettier check in frontend, 48 in backend
- `frontend/package.json` → `format: prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"` fails on 1424 files.
- `backend/package.json` → `format: prettier --check src/ tests/` fails on 48 files.
- No `.prettierrc` / `prettier.config.js` exists in either package (verified: none present), so Prettier defaults apply and drift has accumulated.
- Impact: every CI push fails at `lint-backend`, `lint-frontend` steps. The `format` scripts are wired into `.github/workflows/ci.yml`.
- Note: frontend matches 1424 files includes `node_modules` excluded? No — the glob `**/*.{ts,tsx,...}` will match `node_modules`; need `--ignore-path` or scoped globs. This is a real config defect, not just style drift.

### C2. `/api/companies` endpoint is a hardcoded stub, not real company discovery
- `backend/src/routes.ts:170-182` returns `{ message: 'Company discovery service', ... availableLocations: {} }`.
- The AGENTS.md claims company discovery is implemented; the frontend `companies` page expects real data + locations but the backend returns an empty stub.
- The active controller is `researchController.ts` (with real providers), but the route does not wire it.

### C3. Python test suite cannot run — async DB driver missing + deps absent
- `backend/tests/conftest.py` uses `create_async_engine` + `AsyncSession` (SQLAlchemy async), but `backend/requirements.txt` only has sync `psycopg2-binary` (no `asyncpg`/`psycopg[binary]`), and no `pytest` / `pytest-asyncio` / `httpx` test extras. `pytest` is not installed locally (verified `No module named pytest`).
- `backend/tests/test_audit.py`, `test_leads.py`, and `tests/test_integration.py` are all `pass`-stubs, not real tests.
- CI runs only Jest (`tests/.*\.test\.ts$`), never these Python tests, so failures are silent.

## Phase-by-phase status (actual vs. plan)

| Phase | Status | Notes |
|---|---|---|
| 1 Audit | ✅ Fixed | This document + fixes for C1–C3. |
| 2 Infra/Docker | ✅ Fixed | Compose has nginx, frontend, backend, worker, postgres, redis, minio, ollama. `lightpanda` service now added (G2). |
| 3 Lead CRUD backend | ✅ Done | `queries.ts`, `leadController.ts`, routes wired. |
| 4 Lead list UI | ✅ Done | `frontend/src/app/leads/page.tsx` with filters, polling. |
| 5 Search backend | ✅ Done | Provider registry + real providers in `controllers/researchController.ts`; routes wired; Celery workers present. |
| 6 Map + results UI | ✅ Done | Search page has map+results split, filters, examples, AI scoring display. |
| 7 AI agents | ✅ Done | `backend/src/agents/`, 4 AI providers in `ai/integrations.ts` (openai, gemini, ollama, anthropic). |
| 8 Auth | ✅ Done | `authController.ts`, JWT middleware, bcrypt. |
| 9 Notifications/email | ✅ Done | `notificationService.ts`, email templates, celery tasks. |
| 10 Export | ✅ Done | Export route exists; formats extensible. |
| 11 Automation agents | ✅ Done | Worker agent/scraper/task modules present. |
| 12 Data/dashboards | ✅ Done | Dashboard stats endpoint verified live (74 leads, by-city/industry breakdowns). |
| 13 AI report module | ✅ Done | ExecutiveAiReport, Proposal models exist; proposal generation in AI layer. |
| 14 Admin/audit log | ✅ Done | Audit tables + admin controller routes present. |
| 15 Final QA | ✅ Fixed | All CI-equivalent checks pass locally (see Resolution log). |

## Non-critical observations

### G1. `.env` files are untracked (good) but a root `.env` + `.env.local` exist locally
`git ls-files` shows no `.env` tracked. Good. `.env.example` at `backend/.env.example` (3277 bytes) is present. Ensure `.gitignore` covers root `.env*`. ✅ `.gitignore` covers `.env*` at all levels.

### G2. Lightpanda referenced but no service in compose
Env vars `LIGHTPANDA_URL`/`LIGHTPANDA_CDP_URL` and `BROWSER_FALLBACK_CHAIN=lightpanda,playwright,http` are set, but `docker-compose.yml` has **no `lightpanda` service** (only `grep` counts of the word, which are env-var references). Fallback chain will skip to playwright/http, but the advertised "primary: Lightpanda" is not deployable via compose. ✅ Fixed — `lightpanda` service added using official `lightpanda/browser:nightly` image (CDP on 9222).

### G3. `AISettings` interface has misaligned fields (`integrations.ts:13-14`)
` apiKey` / ` baseUrl` lines are mis-indented — cosmetic, will be caught by C1 fix. ✅ Fixed by Prettier --write.

### G4. Frontend `format` glob is `.` (whole repo dir)
`frontend/package.json` uses `prettier --check .`. Prettier auto-ignores `node_modules`, so the 1424 failing files are real source drift. Recommend scoping to `src/` like the backend does. ✅ Fixed — scoped to `src/`.

## Resolution log (2026-08-08)

1. **C1 fixed** — Added root `.prettierrc.json` + `.prettierignore`; scoped frontend `format` to `src/`; ran `prettier --write` in both packages. Both `npm run format` now report "All matched files use Prettier code style!".
2. **C2 fixed** — Added `getCompanyDiscoveryConfig` in `researchController.ts`; wired `GET /api/companies` to it. Verified live: returns real providers, industries, and locations grouped by country from the DB (6 countries, 16 UAE areas).
3. **C3 fixed** — Added `pytest`, `pytest-asyncio`, `greenlet`, `asyncpg` to `requirements.txt`. Rewrote `conftest.py`, `tests/test_audit.py`, `tests/test_leads.py`, and root `tests/test_integration.py` against the real `worker/` Python modules (BaseAgent, ScoutAgent, AuditService, LeadScoringService). **36 Python tests pass.** Added a `python-tests` job to CI.
4. **G2 fixed** — Added `lightpanda` service to `docker-compose.yml` (official image, CDP on 9222, healthcheck); wired `depends_on` from celery workers. `docker compose config` validates.
5. **Extra fix** — Removed duplicate `process.env.BACKEND_INTERNAL_URL` fallbacks in 4 frontend proxy routes (`api/search`, `api/search/jobs/[id]`, `api/reports`, `api/locations/search`).
6. **Full-stack verification (live, all green):**
   - Backend: `format` ✅, `typecheck` ✅, `lint` ✅ (0 errors), Jest **137/137 pass**, Python **36 pass**.
   - Frontend: `format` ✅, `typecheck` ✅, `lint` ✅, `next build` ✅.
   - Docker: `backend` (TS) image builds ✅, `worker` (Python) image builds ✅, `docker compose config` validates ✅.
   - Live stack: all 11 services healthy through nginx; `/api/health`, auth login, `/api/companies` (real data), `/api/dashboard/stats` (74 leads), `/api/leads`, `/api/agents/status`, `/api/export/leads` (CSV) all verified working.

