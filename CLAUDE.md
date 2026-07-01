# CLAUDE.md

Guidance for working in this repository.

## What this is

**The Pigsty** (package name `pigtrack-pro`) — a full-stack, multi-tenant SaaS for
pig farm management: pig lifecycle, weights/ADG, pens, feed, financials, reports,
team management, subscription billing, and an AI assistant.

## Layout

- `backend/` — Express + TypeScript API, Prisma ORM, PostgreSQL. Deploys to Vercel
  as a serverless function (`serverless-http`); `src/server.ts` only calls
  `app.listen()` when run directly.
- `frontend/` — React 19 + TypeScript, Vite, Tailwind v4, TanStack Query, React
  Hook Form + Zod, Recharts. PWA via `vite-plugin-pwa`.
- `email-worker/` — Cloudflare Worker relaying transactional mail to Resend.
- `scripts/` — dev orchestration and build/copy helpers.

## Commands

Backend (`cd backend`):
- `npm run dev` — ts-node-dev with reload
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest (unit + middleware tests)
- `npm run build` — `prisma generate && tsc`

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server (port 5173)
- `npm run typecheck` — `tsc -b`
- `npm test` — Vitest
- `npm run build` — `tsc -b && vite build`
- Install requires `--legacy-peer-deps` (React 19 peer ranges).

CI: `.github/workflows/ci.yml` runs typecheck + tests for both, plus a frontend build.

## Architecture conventions (follow these)

- **Auth**: JWT access/refresh tokens in httpOnly cookies (Bearer also accepted).
  Access tokens carry a `tv` (token version) checked against `user.tokenVersion`
  in `auth.middleware.ts` — bump the user's `tokenVersion` to revoke all sessions.
- **Authorization**: `requireFarmAccess(...permissions)` in `rbac.middleware.ts`
  resolves the caller's `FarmMember` role, checks a permission matrix, and enforces
  plan gating (returns `402` when a feature needs a higher plan). It sets
  `req.farmId` and `req.memberRole`.
- **Tenant isolation**: routes are mounted under `/api/farms/:farmId`. Nested
  resources (pig, pen, weight, etc.) are looked up by id and then explicitly
  checked with `resource.farmId !== req.farmId` before use. **Always keep this
  check** — it is the primary defense against cross-farm IDOR.
- **Plan gating**: single source of truth is `config/planLimits.ts`
  (`allowsReports`, `allowsMassImport`, `allowsMultiUser`, `allowsFinancialsExport`,
  `pigLimitForPlan`, `memberLimitForPlan`, ...). Frontend mirrors 402 handling in
  `lib/planAccess.ts`.
- **Secrets/config**: all env access goes through `config/env.ts`, which fail-fasts
  in production on missing/weak/duplicate JWT secrets. Add new env vars there.
- **AI**: `services/ai.service.ts` is a provider-agnostic wrapper
  (Claude/OpenAI/Gemini) selected by `AI_PROVIDER`. Default Claude model is
  `claude-haiku-4-5`. Credentials are validated lazily so a missing key never
  blocks API startup.
- **Stripe webhook** is mounted with `express.raw` **before** the JSON body parser
  in `server.ts` — keep it first.
- **Audit/security logging**: mutations log via `AuditService`; auth/rate-limit
  events log via `SecurityService`.

## Testing notes

- Backend tests live beside sources as `*.test.ts` and run on Vitest (node env,
  test secrets injected in `vitest.config.ts`). Prisma-backed middleware is tested
  by mocking `../config/database`. Prefer unit-testing pure logic in `lib/` and
  `config/` plus middleware with mocked Prisma over hitting a real database.

## Gotchas

- `backend` uses `xlsx` from a pinned SheetJS tarball URL (not the npm registry).
- Roles are exactly three: `OWNER`, `FARM_MANAGER`, `WORKER` (see `schema.prisma`).
- Never commit real secrets. `.env*`, `*client_secret*.json`, and Vercel env dumps
  are gitignored — keep them out of the repo.
