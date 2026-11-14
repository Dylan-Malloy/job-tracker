# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Job Application Hub: a Next.js 16 (App Router) + Supabase + Vercel app where users track job applications (NOT STARTED → IN-PROGRESS → FINISHED), keep a resume bank, use a Claude-powered resume tailor and cover-letter generator, and share their hub with helpers/viewers.

**Next.js 16 differs from older versions** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` before using framework APIs. Notable here: `middleware` is now `proxy.ts`; `params`/`searchParams`/`cookies()` are async; `PageProps<"/route">`, `LayoutProps`, `RouteContext<"/route">` are generated global types.

## Commands

```bash
npm run dev              # dev server on :3000 (restart it after editing app/globals.css — Turbopack serves stale CSS)
npm run build            # production build (load .env first: `set -a; . ./.env; set +a`)
npx next typegen         # regenerate route types; run after adding/renaming routes, else tsc reports PageProps/RouteContext errors
npx tsc --noEmit         # typecheck
npm run lint             # eslint
npx vitest run           # all unit tests (no npm script)
npx vitest run lib/resume/resume.test.ts -t "one-page"   # single file / test name
```

Vitest does **not** resolve the `@/` alias. Code under test (`lib/resume/*`, `lib/letter/render.ts`, `lib/jobs/normalize.ts`) must import with relative paths and must not import `server-only` or `next/*`.

## Architecture

**Auth & hubs.** Supabase Auth with email verification. `proxy.ts` → `lib/supabase/proxy.ts` refreshes the session, redirects unauthenticated users to `/login`, and **rewrites `/` to the public landing page (`app/welcome`) for logged-out visitors** (public paths: `/login`, `/auth`, `/verify`, `/invite`, `/welcome`). A DB trigger creates one hub per new user. `lib/hub.ts` is the central helper: `getHubContext()` (server components; selected hub comes from the `hub_id` cookie) and `roleInHub()` (route handlers). Roles: `owner`, `helper`, `viewer`.

**Sign-up is invite-only, enforced in Postgres.** There is no sign-up page. A `before insert on auth.users` trigger (`private.require_invite`) rejects any new account unless the email has a pending, unexpired row in `hub_invites` or is in `signup_allowlist` (owner bootstrap; rows are added by hand with SQL and must never be committed — the repo is public). This also blocks direct calls to Supabase Auth with the public key. Accounts are created at `/invite/[token]` (`joinWithInvite`: email locked to the invite, normal `signUp` + email verification, then back to the invite to accept). Don't reintroduce an open sign-up path. Users change their password at `/account`.

**Authorization lives in Postgres RLS, not the UI.** `supabase/migrations/*.sql` is the source of truth (already applied to the Supabase project; new schema changes need both a migration file and applying it, e.g. via the Supabase MCP). Policies call `private.is_owner/hub_role/is_member`, which read `hub_members` live, so revoking access (deleting the row) takes effect on the next request. Helpers can only insert `not_started` jobs and unapproved resumes; only owners update/approve/use AI. Triggers (`jobs_guard`, `resumes_guard`) enforce column-level rules (e.g. a job's resume must be approved and in the same hub). UI hides controls as a convenience only. After any DDL, run the Supabase security advisor.

**Three Supabase clients** (`lib/supabase/`): `server.ts` (user session, RLS applies — default), `client.ts` (browser, `NEXT_PUBLIC_*` only), `admin.ts` (service role, `server-only`, bypasses RLS). Use admin only where RLS can't express the need: uploading to the resume bucket (the bucket has no client INSERT policy so server-side file validation can't be bypassed) and accepting invites.

**Job intake pipeline** (`app/api/jobs/extract`, `lib/jobs/*`): `normalizeJobUrl` canonicalizes links (dedupe via `unique(hub_id, normalized_url)`; LinkedIn/Indeed/Glassdoor collapse to ID-based URLs) → `fetchPage` (SSRF-guarded: validates resolved IPs at connect time, manual redirects) → `htmlToText` + `classifyUnreadable` → Claude extraction. Unreadable pages return `needs_paste` so the UI asks for pasted text. The route streams NDJSON progress events (`{type:"step"}` then `{type:"result"}`); `lib/ndjson.ts` + `components/progress-steps.tsx` consume them. The tailor and cover-letter routes use the same streaming pattern.

**Resume assistant** (`lib/ai/tailor.ts`, `app/api/jobs/[id]/tweak`): Claude returns a structured `ResumeDoc` (`lib/resume/types.ts`), then loops up to 3 attempts: tailor → `measureFit` (must fit one page) → separate Claude fact-check against the original → retry with specific feedback. Output that is over one page or has unsupported claims is never saved. Never relax the "no fabrication" system prompts or the verification step.

**One-page guarantee** (`lib/resume/layout.ts`, `render-pdf.ts`, `render-docx.ts`; `lib/letter/render.ts` for cover letters): a single layout engine (pdf-lib Helvetica metrics) is used both to measure and to draw. Font shrinks 10.5→9pt, uses a 95% page-height safety factor, and throws `OnePageError`/`LetterTooLongError` rather than spilling to page 2. DOCX uses Arial with exact line spacing and the same fitted size. PDFs are rendered on demand from stored JSON (`resume_tweaks.tailored_resume`/`original_resume`, `cover_letters.letter`) by `app/api/tweaks/[id]/pdf|docx` and `app/api/cover-letters/[id]/pdf|docx`; the UI embeds them in iframes (`components/compare-viewer.tsx`, `letter-viewer.tsx`). The "original" side is rebuilt from extracted text via `lib/resume/parse-original.ts` (heuristic).

**Claude calls**: `lib/ai/client.ts` (server-only; model overridable with `ANTHROPIC_MODEL`). The model does not support forced `tool_choice`, so prompts instruct it to call the tool and callers handle a missing tool_use block. Page/resume/notes text is untrusted: prompts tell the model to ignore embedded instructions.

**Admin panel** (`app/(app)/admin/*`, `lib/admin/*`, `components/admin/*`). Visible only to site admins: rows in `app_admins`, added by hand with SQL (never committed; the repo is public). `requireAdmin()` (`lib/admin/guard.ts`) must be the first call in every admin page/layout and server action — the UI hiding the link is not security. Tabs: Analytics (the admin's own hub: job history from `job_events`, which a DB trigger fills on every job insert/status change), AI spend, Helpers (members of the admin's hub, role changes via the user's session so RLS still applies), Users (site-wide CRUD with the service role: create = allow-list the email, `createUser` with a one-time temp password, then remove the allow-list row; delete requires typing the email, refuses self/admins, and removes the user's storage files first). Aggregation lives in pure, unit-tested functions (`lib/admin/analytics.ts`, `spend.ts`).

**AI token/cost tracking.** Every Claude call must go through `createMessage(feature, params)` in `lib/ai/client.ts`, never `anthropic().messages.create` directly, and the route must wrap its work in `withUsage({userId, hubId, jobId}, …)` (`lib/ai/usage.ts`, AsyncLocalStorage) so the call is attributed. It writes a row to `ai_usage` (tokens + estimated `cost_usd`; rows outlive deleted users/jobs). Prices are in `lib/ai/pricing.ts` — update `PRICES`/`PRICING_AS_OF` when models or prices change; unknown models are priced like Sonnet 5.5. Costs are estimates; the Anthropic invoice is authoritative.

**Other conventions.** User time zone: `components/timezone-sync.tsx` stores it in a `tz` cookie; server-rendered dates must go through `lib/tz.ts` (`getTimeZone`, `fmtDate`, `fmtDateTime`, `longDate`), never `toLocale*` (server is UTC). Tooltips are CSS-only via a `data-tip` attribute (`data-tip-end` anchors right); add one to every new button. Styling is Tailwind v4 with a dark purple token system in `app/globals.css` (`.btn`, `.card`, `.input`, … component classes).

## Environment & deployment

Env var names are in `.env.example`. `NEXT_PUBLIC_*` only in browser code; `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` are server-only. They must exist on Vercel for Production and Preview (already set on the `job-tracker` project, team `polus5`); env changes only apply to new deployments. Vercel's project settings are Next.js preset, Node 22.x. Pushing a branch creates a preview deployment; merging to `main` deploys production. Vercel Authentication (deployment protection) must stay off for the app to be usable by invitees. Supabase Auth Site URL and redirect-URL allow-list (dashboard) must include the deployed domain's `/auth/callback`, otherwise confirmation emails link to localhost.

No GitHub CLI/MCP is configured in this environment; use `git` over SSH.
