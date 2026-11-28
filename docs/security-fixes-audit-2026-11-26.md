# Prompt H — safety fixes audit

**Date:** 2026-11-28
**Branch:** `codex/prompt-h-safety-fixes` (base `aeb7aa8`, PR #66 merged)
**Prompt:** `codex-prompt-h-safety-fixes-2026-11-26.md` (Tasks 1–9)
**Status:** [DO NOT MERGE] draft — for Aditi's review. Nothing here is merged,
deployed, or run against production.

This is the findings document for Prompt H. The per-task working records are
`docs/security-hack-check-2026-11-26.md` (Task 1, the 15-attack gist check)
and `docs/backup-recovery-runbook-2026-11-26.md` (Task 2). The Cloudflare
audit that motivated the fixes is `docs/security-audit-cloudflare-2026-11-26/`
(Prompt J, draft PR #67): 8 confirmed findings, 7 needs_validation.
Where this document and the J audit disagree, the J audit's finding number is
given (F1–F8).

## 1. The five mistakes — verdicts

The Reel's five checks (admin gating, self-registration, payments, password
storage, input validation) were each re-checked from code on `aeb7aa8`.
All five verdicts held — the same result the J audit reached independently:

1. **Admin gating — SAFE.** Every admin route requires auth + `requireRole("ADMIN")`;
   there is no admin-only UI reachable without it.
2. **No self-admin registration — SAFE.** `registrationSchema` has no role
   field (Zod strips it); `registrationIdentity()` derives the role
   server-side; `REGISTRATION_PARTICIPANTS` excludes ADMIN. Tests prove a
   registration injected with `role: "ADMIN"` creates a SOCIETY user, and a
   SOCIETY `PUT /profiles/me` with `role: "ADMIN"` leaves the user SOCIETY.
3. **No live payment path — SAFE.** Checkout/orders/payments are sandbox
   only; the only billing endpoint is the Razorpay webhook, HMAC-verified
   (`x-razorpay-signature`, 401 on an invalid signature).
4. **Password hashing — SAFE, and now pinned.** Passwords are scrypt hashes
   (salt:derived, N=16384, r=8, p=1, maxmem 64MB, keyLength 64) — the
   parameters are now pinned in `session.ts` and in the first-admin
   provisioning script, so a Node default change cannot silently weaken
   them. Existing hashes still verify (the pinned values are Node's
   defaults); no re-hash was needed.
5. **Input validation — SAFE.** Zod schemas on every write path, Drizzle
   parameterised queries throughout; no string-concatenated SQL was found.
   (One gap was found and fixed in this PR: `ilike` wildcards in the
   opportunities search — see §3, Task 5.)

## 2. The 15-attack gist check — result

Re-run from code on `aeb7aa8` (full detail in
`docs/security-hack-check-2026-11-26.md`): **12 SAFE, 3 N/A**. The same
result the J audit reached. No new attack surface was introduced by the
pages added since the audit's base (`/feasibility-dashboard` was checked
too: it saves to `localStorage` on the device only, and its Send action
goes through the enquiry pipeline — nothing leaves the device otherwise).

One check was rated **VULNERABLE prospectively** and is now fixed in this
PR: attack 13 (`.env` in git). The git history is clean — no `.env` was
ever committed — but `.gitignore` had no `.env` entry, so one careless
`git add .` could have leaked a secret. `.gitignore` now has `.env` +
`.env.*` at the top (J finding **F8**, fixed here — see the deviation note
in §6).

## 3. What was fixed, per gap

| Gap | Fix in this PR | Where |
| --- | --- | --- |
| F2 — unauthenticated legacy demo API (6 endpoints, **confirmed live 28 Nov ~13:29 IST**: `GET /api/dashboard` returned 200 with demo society data) | The demo router (`artifacts/api-server/src/routes/renova.ts`) is deleted; its mount and import are removed. The `/regulations` page keeps rendering — its 4 static entries now live in the frontend `Regulations` component. All six demo routes now return 404 unauthenticated (test-proven, incl. `POST /projects`). | Task 4 |
| F3 — no security headers | API: Express middleware on `/api` — HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive CSP (`default-src 'none'; frame-ancestors 'none'`). Frontend: `vercel.json` `headers` with the same four plus a strict CSP (no `unsafe-inline` anywhere; the single inline script — the JSON-LD block — is allowed by its SHA-256 hash). Both are test-proven (live API headers in `auth.test.ts`; the frontend config + a recomputed JSON-LD hash in `tests/security-headers.test.mjs`). | Task 9 |
| F5 — enquiry rate limit defeated by IP+email rotation | Global enquiry rate limit: per-IP 20/hour + global 100/hour (new `ENQUIRY_SUBMIT` / `ENQUIRY_SUBMIT_GLOBAL` policies, enforced before any enquiry/consent/email job is created). The fingerprint dedup (5/hour per IP+email) is untouched. Test-proven: 21 submissions with rotating emails from one IP → 20×201 + 1×429, and the global bucket grows by exactly 20. | Task 5 |
| F8 — `.gitignore` does not ignore `.env` | One-line fix (see §2). | Task 6 |
| `ilike` wildcard injection in opportunities search | `escapeIlike()` (same pattern as `enquiries.ts`) applied to `q` and `location`. Test-proven: an opportunity titled "TEST ONLY 100% redevelopment _pilot" is found by `q=100%` but NOT by `q=100_`, and `q=%` returns only it. | Task 5 |
| No backup/recovery configured | Runbook written (`docs/backup-recovery-runbook-2026-11-26.md`): branch-as-snapshot-copy, PITR, pg_dump, restore rehearsals A/B/C, and a read-only preflight tool (`lib/db/scripts/preflight-production.mjs`, exit 0 READY / 2 BLOCKED_PENDING_MIGRATIONS / 2 BLOCKED_SCHEMA_DRIFT / 1 failure). Recommended cadence (Task 7.4): daily backup + weekly check + monthly rehearsal — a recommendation, not a decision. **Neon-side state is CAN'T TELL** (see §5). | Tasks 2, 7.4 |
| No first-admin provisioning path | Operator CLI (`lib/db/scripts/provision-first-admin.mjs`) + doc (`docs/first-admin-provisioning-2026-11-26.md`): scrypt-hashed password (min 12 chars for this admin account), inserts the user + an `FIRST_ADMIN_PROVISIONED` audit row in one transaction, refuses if an ADMIN already exists. **No admin account was created by this PR.** | Task 3 |
| Generic errors / stack traces | Confirmed by reading `renova-app.ts` and test-proven: a forced 500 returns `{error: "Internal server error"}` with no stack; an oversized body returns 413 `{error: "Request body is too large"}`. | Task 7.1 |
| CORS | The allow-list (`CORS_ORIGINS`) is now evaluated per request, fail-closed when empty; no `*` with credentials, no reflected Origin. Test-proven in `auth.test.ts` (listed origin gets the header + credentials; unlisted gets nothing; empty list allows nothing). **The production value of `CORS_ORIGINS` is CAN'T TELL** (Vercel env vars, not visible from code). | Task 9 |
| Dead code / attack surface | 1,739 lines removed from `App.tsx` (the never-rendered `WorkspaceRouter` and its four dead pages — Overview, Assessment, ProjectDetail, Professionals — plus `AppShell`, dead helpers and 7 dead api-client imports); dead `components/ui/chart.tsx` deleted (it held the app's only `<style>` injection and only `dangerouslySetInnerHTML`); retired `scripts/verify-live-workspace.mjs` deleted. **Bundle effect: none** — the dead code was already tree-shaken by Rollup (JS 500,068 bytes before and after; CSS 236,836 → 236,859 bytes). The value is source hygiene and a smaller import surface, not size. | Task 9 |

## 4. What was verified absent

- **No secrets in the built bundle or in git history.** Production build
  scanned for `sk_live_`, `sk_test_`, `service_role`, `AKIA`, `ghp_`,
  `sk-ant-`, `VITE_`, `postgres://`, `neon.tech`, Resend endpoints, quoted
  `re_…`/`sk-…` keys: zero hits. Git history grep for secret patterns: 0.
  No `.env` files in the tree. (Guard test added:
  `artifacts/renova/tests/no-secrets-in-bundle.test.mjs`.)
- **No role/org escalation.** Every protected endpoint derives role and
  organisation from the session + database. No `...req.body`, no
  `body.role` / `body.isAdmin` / `body.organizationId` / `body.plan`
  anywhere in routes or lib. `/auth/me` and `/auth/attestations/me` read
  the session server-side (401 without one); `/auth/logout` clears only
  the caller's own session; `/workspace/metrics` is auth-gated with the
  org from the session.
- **No unrated unauthenticated POST.** `/auth/*` are rate-limited
  (per-IP ×10 + per-account); `POST /privacy/requests` is rate-limited;
  every other POST requires auth + a role. `POST /enquiries` was the only
  unrated unauthenticated POST — now covered (see §3, Task 5).
- **No Google-host or third-party calls from the app** other than the
  Google Fonts stylesheet (Prompt F item — see §5) and the same-origin
  `/api` calls.

## 5. Still open / blocked

- **F1 — body-parser 2.3.0, CVE-2026-111181 (medium).** One unauthenticated
  crafted-gzip request can crash the API process. The fix (upgrade to
  ≥2.4.0 or `inflate: false`) is **out of scope for H** by Aditi's standing
  instruction — noted only. The J audit's confidence is medium: it rests
  on the official Express advisory + the exact version match (confirmed
  in the lockfile), not a local reproduction.
- **F4 — `GET /billing/products` leaks `approvalReference` to any SOCIETY
  user (low). Out of scope for H** — noted only.
- **F7 — consent withdrawal has no API (low). Out of scope for H** — the
  ledger supports WITHDRAWN, but nothing can write it. Noted only.
- **F6 — no quota on feasibility requests/uploads (low).** Not fixed in
  this PR: the enquiry rate limit covers enquiries, not feasibility
  requests or the 10 MB uploads. Needs a home (same decision as F1/F4/F7).
- **Password floor stays 8.** The recommendation is a floor above 8; the
  floor was NOT changed — Aditi decides.
- **Dependency audit is incomplete.** `npm audit` fails (ENOLOCK — the
  repo uses pnpm-lock.yaml, no package-lock.json); `pnpm audit --prod`
  fails (ECONNRESET to the npm registry audit endpoint, though registry
  downloads work). A full `pnpm audit` must run from a machine with
  registry access. Inventory recorded in the Task 7 notes.
- **`recharts` is now an unused dependency** (its only user, `chart.tsx`,
  was deleted). Removing it needs a pnpm lockfile regeneration — left for
  a follow-up, listed here so it is not forgotten.
- **The generated API client is stale.** `lib/api-client-react` and
  `lib/api-zod` still export the seven dead demo hooks (`useGetDashboard`,
  `useListProjects`, `useGetProject`, `useListProfessionals`,
  `getGetProjectQueryKey`, `getListProfessionalsQueryKey`,
  `useHealthCheck`). There is no re-generation script in the repo; the
  generated files were left as-is and the staleness is recorded here.
- **Production `CORS_ORIGINS` value — CAN'T TELL.** It must list
  `https://nirmaq.in` and only the Vercel preview origins the team
  actually uses, if any. Verify in the Vercel dashboard after merge.
- **Production header verification — UNVERIFIED.** The `vercel.json`
  headers only take effect on a Vercel deployment, and preview
  deployments are currently failing to provision (separate investigation).
  Verify the headers on the live host after the next successful deploy.
- **Backup/recovery, Neon side — CAN'T TELL.** The runbook's Neon steps
  are blocked on the owner step: the Neon console asks for email
  verification to link the Vercel Marketplace identity. No backup
  schedule, retention, or PITR setting is confirmed on the Neon side.
- **The enquiry path is still broken in production for a different
  reason.** The production database was migrated on 28 Nov 2026 (~13:17
  IST, verified: 9 journal rows, 31 tables) but `/api/readyz` is still
  503 — the live API's `DATABASE_URL` evidently points at a different
  database. That is a separate track (operator host compare-check); it is
  NOT fixed by this PR, and no enquiry can succeed until it is.
- **Mail is separate.** Enquiry email delivery to info@nirmaq.in needs
  the Zoho completion + Resend sender-domain verification (Phase 4).
- **Policy pages are NOT drafted here.** The privacy notice, retention
  periods, grievance officer and legal entity are blocked on facts only
  Aditi (and Indian privacy counsel) can supply. They are listed as
  blocked, not drafted.
- **Google Fonts still loads from Google** (`src/index.css:1`). That is
  the known Prompt F item, still present on main `aeb7aa8`; the CSP in
  this PR explicitly allows `fonts.googleapis.com` /
  `fonts.gstatic.com` until Prompt F lands. When F lands, the CSP's
  `style-src`/`font-src` should drop the Google origins.

## 6. Deviations from the prompt, recorded honestly

- **F8 was fixed in this PR.** The Task 1 doc listed it as a follow-up
  "not fixed per Task 1.4", but the task instruction lists only F1/F4/F7
  as out of scope, and Task 6.1 covers the sweep including attack 13's
  `.gitignore` check — so the one-line fix was applied.
- **Task 4's "gate them" premise did not fit `GET /regulations`.** That
  endpoint serves a public page, so gating it would have broken the page.
  Deleting the router closes F2 fully while the page keeps rendering from
  local static data.
- **The prompt's "stop and report the gist result before starting the
  fixes" step was folded into the single execution.** Aditi's direct go
  ("Start on J or H from your side", 28 Nov ~13:19 IST) authorised the
  full run; the gist result is §2 of this document and the Task 1 doc.
- **Task 1.1's "commit everything first"** is satisfied by the branch
  point `aeb7aa8` itself (clean tree, nothing modified before the check).

## 7. Verification evidence (all local, 28 Nov 2026)

- Typecheck clean: renova + api-server.
- api-server unit tests: **59 pass, 0 fail** (incl. the 2 new Task 7
  tests + the 2 new Task 9 CORS/headers tests).
- Security integration suite: **356 checks pass** (PGlite; incl. the 6
  demo-route 404 checks and the 10 Task 5 rate-limit/`ilike` checks).
- Privacy integration: **94 checks pass** (the `aeb7aa8` baseline — the
  K branch's extra privacy tests are not on main).
- Renova tests: **56 pass, 0 fail** (incl. the new security-headers test
  and the bundle secret guard); workspace-ux **7/7**.
- Production build passes (vite, 9.02s). No-secrets guard passes on the
  new build.
- **CSP drive-through (built bundle served locally with the exact
  `vercel.json` headers applied):** 6 routes (`/`, `/regulations`,
  `/feasibility-dashboard`, `/feasibility-check`, `/get-started`,
  `/societies/documents`) — all render with correct titles and content,
  **zero CSP violations, zero failed local requests, mobile horizontal
  overflow 0px**. The only console error on any page is the Google Fonts
  stylesheet failing with `ERR_TUNNEL_CONNECTION_FAILED` — the sandbox
  has no route to `fonts.googleapis.com`; the CSP explicitly allows it,
  so the failure is the environment's network, not a CSP block. (The
  pages render with fallback fonts locally; in a real browser the fonts
  load.) Homepage and dashboard screenshots were inspected: hero
  composite, consulting copy and the v3 dashboard all render as approved.
- `renova-intro.mp4` untouched; `/spike/*` record page untouched.

## 8. What needs Aditi

1. **Decide the home for F1, F4, F7 (and F6):** an H addendum or a
   separate follow-up. F1 is the only medium left; the fix is small
   (body-parser ≥2.4.0).
2. **Password floor:** raise above 8, or keep 8?
3. **Backup owner step:** the Neon console email verification to link
   the Vercel Marketplace identity (needed to confirm PITR/retention on
   the Neon side).
4. **Review this draft PR and decide on merging.** After a merge, verify
   on the live host: the security headers, the production `CORS_ORIGINS`
   value, and — once the separate Neon connection issue is fixed — one
   test enquiry.
5. **The separate Neon/readyz track and the mail track are still open**
   (see §5); this PR fixes neither.
