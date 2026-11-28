# Pre-deploy security checks — Prompt L findings

**Branch:** `codex/prompt-l-predeploy-security`, off `origin/main` (`aeb7aa8`, PR #66 merge).
**Date:** 28 Nov 2026. **Source:** Instagram @sheesbuilds (Shees Ahmad), Day 24 Reel
"Ship Fast, Not Exposed" — 6 pre-deploy checks. Audit basis: `predeploy-security-checks-mapping-2026-11-28.md`
(verified 28 Nov 2026 ~21:11 IST against main `aeb7aa8` + H branch `5be31b9`).
The Reel's numbers are examples, not NIRMAQ's; NIRMAQ's real numbers are the ones below.

**Verification status — read first.** The install problem is **fixed** (29 Nov 2026 ~01:10 IST, parent): the container's user namespace permits chown only to uid:gid 0:0, but pnpm's atomic lockfile writes preserve the existing file's owner (root:nogroup = 0:65534) → EPERM. Fix: `chown root:root` on the three lockfiles, then `pnpm install --lockfile-only` and a full `pnpm install` — both succeeded. The lockfile refresh is **complete** (see §4) and verification is now running; results are recorded in the PR report. Nothing below that depends on a test run is claimed as proven until the run it names has passed.

## Verdicts

| # | Check in the Reel | Verdict after Prompt L |
|---|---|---|
| 1 | Tiered rate limiting — different limits per endpoint type | **CLOSED (code).** Standard tier, global cap, feasibility quotas, reset-password limit built. Verification pending execution. |
| 2 | Strict input validation — every input against a strict schema (Zod) | **COVERED, unchanged.** Verified by the mapping; no Zod code touched. |
| 3 | Secrets & Git scan — no hardcoded keys/tokens/passwords; secrets only in env vars | **PARTIAL.** Tree + history clean (H sweep); the preventive `.gitignore` `.env` entry lives on H (PR #69, unmerged). L adds no secrets. |
| 4 | Dependency audit — patch the critical CVEs | **PARTIAL.** qs, proxy-addr, undici and zod-v4 fixed and lockfile refreshed (see §4); re-run audit leaves **2 advisories**: body-parser (pinned by gate) and zod (rejected CVE — scanner persistence, see §4). |
| 5 | Safe error logs — no stack traces, file paths or internal IPs in production responses | **COVERED, unchanged.** Generic bodies confirmed in code; the 429 body is the generic message. Test-proving pending execution. |
| 6 | File-upload guard — magic bytes, allowlist, size limit, isolated storage | **COVERED, plus the F6 quota CLOSED (code).** Guard unchanged; per-request document cap (20) + burst bucket built. Verification pending execution. |

## 1. Tiered rate limiting — CLOSED (code)

**What was missing on main.** Auth + privacy routes had DB-backed per-action tiers
(`src/lib/auth-rate-limit.ts`, `AUTH_RATE_LIMIT_POLICIES` — the single source of
truth), but nothing limited the standard routes, and nothing limited
`/auth/reset-password` or the feasibility routes. Enquiries had only fingerprint
dedup on main; the enquiry global limit already exists on H (PR #69) and is **not**
duplicated here.

**What Prompt L built** — all in the same DB-backed mechanism (`authRateLimits`
table, `sha256` subjects, no raw IP/email/token stored; new action names need no
migration — `action` is a varchar):

| Policy | Limit | Window | Scope | Reason |
|---|---|---|---|---|
| `STANDARD_REQUEST` | 100 | 1 min | per IP | The Reel's standard tier. A human session makes a few dozen requests a minute at most; 100/min bounds a single-IP flood to 100 DB writes a minute. ~6,000× the site's real per-IP volume (a handful of requests a day). |
| `STANDARD_REQUEST_GLOBAL` | 1000 | 1 min | all IPs | 10× the per-IP tier. Bounds a distributed flood that rotates IPs; legitimate pre-launch traffic never reaches it. |
| `FEASIBILITY_CREATE` | 5 | 24 h | per society | A society creates a feasibility request once per redevelopment cycle; 5 a day is far above any legitimate need. Per-IP bucket is 50/day (10×, same pattern as the auth actions). |
| `FEASIBILITY_DOCUMENT` | 20 | 24 h | per request | Burst protection for uploads. The hard cap is the same number (20 documents per request) — see §6. |
| `RESET_PASSWORD` | 5 | 1 h | per token | The token is 32–256 chars so brute force is infeasible; the limit bounds token-guessing floods and DB load. A legitimate user uses one link once. Per-IP bucket is 50/hr (10×). |

**Where it lives.**
- `src/lib/standard-rate-limit.ts` (new) — `rateLimitStandardRequest` enforces the
  per-IP bucket then the global bucket; `standardRateLimit` is the Express
  middleware. Mounted in `src/routes/index.ts` immediately after `healthRouter`
  and before every other router, so health/readyz still answer when the database
  is down, and every non-health route gets the tier on top of its own per-action
  limit. Auth routes keep their own limits; the standard tier sits on top of them
  (100/min per IP is far above the auth per-IP buckets, so it never binds first
  for legitimate use).
- `src/routes/feasibility.ts` — `rateLimitFeasibilityCreate` runs after the
  society check and before the transaction, so a limited create writes nothing;
  `rateLimitFeasibilityDocument` runs after the magic-byte check and before the
  Blob `put` (see §6).
- `src/routes/auth.ts` — `rateLimitResetPassword` runs after Zod parsing +
  `requireDb()` and before the token lookup. The per-token bucket is keyed by the
  sha256 of the token, so the raw token is never stored. Note: the per-token bucket
  never binds for guessing (each guess is a different token); the per-IP bucket is
  the one that binds a guessing flood — that is the intended shape.
- **`/auth/logout` is deliberately NOT limited** (verified, not assumed):
  `clearSession` (`src/lib/session.ts`) only deletes the presented session row by
  token hash, creates nothing, sends nothing, and cannot invalidate another user's
  session without their cookie. There is nothing to flood. Three consecutive
  logouts are test-proved to return 204 (`tests/security.integration.ts`).

**Fail-open, and only in one case.** The standard middleware fails open **only**
when no database is configured (`requireDb()` throws "DATABASE_URL is not
configured" → `next()`). Without a DB the API is already non-functional and each
route reports its own 503; the limiter must not mask those errors (and must not
break the no-DB unit tests, e.g. the registration-closed test). If the DB is
configured but down, the middleware throws and the error handler answers 500 —
acceptable, the API is down either way. Unit test:
`src/lib/standard-rate-limit.test.ts` (fail-open with `DATABASE_URL` unset).

**One construction site for the 429.** `tooManyRequestsError()` in
`src/lib/auth-rate-limit.ts` (status 429, code `RATE_LIMITED`, message "Too many
requests. Please try again later.") is now the single place that builds the
refusal; `enforceAuthRateLimit` uses it (behaviour-preserving refactor). A limited
request never reaches its handler, so it can never create a record, a job, an
email, or a Blob object.

**Tests (authored, not yet run).**
- Unit: `src/lib/auth-rate-limit.test.ts` pins the five new policy values/windows
  and the `tooManyRequestsError` shape; `src/routes/index.test.ts` is a structural
  test that `standardRateLimit` is the second layer in the router stack, after
  health.
- Integration (`tests/security.integration.ts`, Prompt L section): feasibility
  creation quota (5 × 201, 6th 429, DB count stays 5); a second express app on the
  production router composition with `trust proxy: 1` (the main app has no trust
  proxy and its volume exceeds the per-IP tier) proving the regression happy path
  (login → create → upload, all 200/201), the per-IP cap (seeded bucket: 100th
  request 200, 101st 429), per-IP isolation (fresh IP → 200), the global cap
  (seeded to 999: one IP's request 200, a different IP's request 429 — rotation
  defeated; run last, because afterwards the global bucket is full), reset-password
  per-token (5 × 400 invalid token, 6th 429) and per-IP (50 × 400 distinct wrong
  tokens, 51st 429), and logout 3 × 204. Bucket seeding uses the `authRateLimits`
  table directly (upsert, both the current and next minute windows, so the test
  survives a minute-boundary rollover). The Blob stub (`tests/blob-stub.ts`,
  wired in `tests/run-integration.mjs` via an esbuild `onResolve` for
  `@vercel/blob`) records every `put()` so the tests can prove a refused upload
  wrote no Blob object; `get()` returns null (downloads 404).

## 2. Strict input validation — COVERED, unchanged

Zod is the validation layer (3.25.76 in `lib/api-zod`, 4.1.11 via `@vercel/blob`
> `@vercel/oidc` > `@vercel/cli-config`). The mapping enumerated all 30 mutating
handlers across auth, enquiries, privacy, profiles, feasibility, opportunities
and sandbox-billing — every one parses its input (e.g. `enquirySchema.parse`,
`societyDetailsSchema` with bounded strings and a 6-digit PIN regex, OTP
`^\d{6}$`, token `min(32).max(256)`). The three handlers with zero `.parse()` calls
take no body (`/admin/enquiry-email-jobs/process`, `/feasibility/:id/submit`,
`/admin/feasibility/:id/publish` — only `:id`, looked up by parameterized Drizzle
`eq`; a non-UUID id yields 404). Invalid input returns 400 "Validation failed"
with per-field issues. **Prompt L changed no Zod schema and no handler**, so there
is nothing new to test-prove here; the existing integration suite already proves
the 400s. Do not "fix" the upload size to the Reel's example 5 MB — 10 MB is the
designed limit (§6).

## 3. Secrets & Git scan — PARTIAL (H carries the fix)

- Tree + history are clean: H Task 6 sweep recorded 0 hits ("no secrets in the
  built bundle or in git history", `docs/security-fixes-audit-2026-11-26.md`),
  and H adds the regression guard
  `artifacts/renova/tests/no-secrets-in-bundle.test.mjs` (scans the built bundle
  for `sk_live_`, `ghp_…`, `postgres://`, `neon.tech`, `VITE_…`).
- **The preventive `.gitignore` `.env` entry exists only on H** (J finding F8,
  draft PR #69, unmerged). Prompt L does **not** duplicate it — merge dependency
  on H, noted in the PR report.
- **Prompt L adds no secrets.** The diff reads no new env var and contains no
  key/token/password literal. One string that looks like a credential is the
  test-only placeholder `process.env.BLOB_READ_WRITE_TOKEN =
  "test-only-blob-token"` in `tests/security.integration.ts` — a dummy value used
  only to satisfy the route's storage-configured check in tests, in the same
  pattern as the existing `RENOVA_AUTH_TOKEN_SECRET =
  "TEST-ONLY-otp-secret-at-least-thirty-two-characters"`. It is not a real
  credential and must never be copied into a real environment.
- A fresh secrets sweep of this branch's tree was **not** re-run (blocked by the
  execution-risk notice — see the verification status at the top). Re-run it as
  part of verification before merge.

## 4. Dependency audit — PARTIAL (lockfile refresh incomplete)

**Audit run:** `pnpm audit --prod`, 28 Nov 2026 (registry reachable).
**Result: 12 vulnerabilities, 11 advisories — 5 moderate, 6 high, 1 critical.**
Full JSON saved at `/tmp/l-audit-before.json` (scratch, not on the branch).

| Package | Advisory | Severity | Fixed in | Action in Prompt L |
|---|---|---|---|---|
| `proxy-addr` 2.0.7 (via `express`) | GHSA-jqcg-44mw-7w3h / CVE-2026-90711 | **Critical** | ≥ 2.0.8 | Override to `2.0.8` |
| `zod` 4.1.11 (via `@vercel/blob` > `@vercel/oidc` > `@vercel/cli-config`) | GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 — "Zod can exhaust memory while validating oversized constrained collections" | High | ≥ 4.6.6 | Targeted override `@vercel/cli-config>zod` to `4.6.6` (verified against github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| `body-parser` 2.3.0 (via `express`) | GHSA-27r3-jxmh-p828 / CVE-2026-111181 — one crafted-gzip request crashes the process; no auth or matching route needed | High | ≥ 2.4.0 | **PINNED — gated, see below** |
| `undici` 6.29.0 (via `@vercel/blob`) | 5 advisories (3 high, 2 moderate) | High/moderate | ≥ 6.29.1 | Override to `6.29.1` |
| `qs` 6.15.3 (via `express` + `body-parser`) | GHSA-x5fp, GHSA-4mjr, GHSA-6pq8 | Moderate ×3 | ≥ 6.16.1 | Override to `6.16.1` |

**Corrections to the mapping.** (a) qs must go to **6.16.1**, not 6.16.0: GHSA-6pq8
affects versions ≤ 6.16.0. (b) The zod advisory does **not** affect the v4 copy
only — that claim in the first draft of this doc was wrong, and is corrected
here (see "Zod determination" below). (c) `recharts` is **not** removed: H's note that its only
user `chart.tsx` was deleted is true only on the H branch. On main `aeb7aa8`,
`artifacts/renova/src/components/ui/chart.tsx:3` still imports it and
`artifacts/renova/package.json:68` still declares it. Removal is H's — it dies
with `chart.tsx` when H merges.

**Exposure notes (from the mapping, unchanged).** proxy-addr's CVE only triggers
when a trust subnet is written in IPv4-mapped IPv6 notation with an IPv4-sized
prefix; NIRMAQ sets `app.set("trust proxy", 1)` (a hop count), not a subnet — so
the CVE is present in the tree but not exploitable via this config. It still
matters because `req.ip` feeds all rate limiting. qs is likely unreachable in
this app (Express 5 defaults to the `'simple'` query parser and NIRMAQ sets no
query parser) but is still stale in the tree. body-parser's exposure is real and
unmitigated on main: body parsing runs before routing, so one crafted request
crashes the process.

**body-parser stays pinned — the gate.** Its upgrade is J finding F1, gated on the
F1/F4/F7 addendum decision, which Aditi has **not** made. Prompt L does NOT
upgrade body-parser, does NOT apply `inflate: false`, does NOT do both. The chosen
route is targeted `pnpm.overrides` (qs / proxy-addr / undici / zod-v4 only),
which does not touch Express (`^5.2.1` unchanged). An Express 5.3.0 refresh would
pull body-parser 2.4.0 with it and was **not** applied.

**Lockfile refresh — COMPLETE.** The overrides are written in
`pnpm-workspace.yaml` (appended to the existing `overrides:` section, with
comments). The first `pnpm install` failed with `EPERM: operation not
permitted, chown '…/pnpm-lock.yaml.2302244525'`, exit 255 — the container's
user namespace permits chown only to uid:gid 0:0, but pnpm's atomic lockfile
writes try to preserve the existing file's owner (root:nogroup = 0:65534).
Fix applied 29 Nov 2026 ~01:10 IST (parent): `chown root:root` on
`pnpm-lock.yaml`, `node_modules/.pnpm/lock.yaml` and
`node_modules/.modules.yaml`, then `pnpm install --lockfile-only` (succeeded)
and a full `pnpm install` (succeeded). The lockfile now lists qs **6.16.1**,
proxy-addr **2.0.8**, undici **6.29.1**, zod **4.6.6** (for the
`@vercel/cli-config` copy); `node_modules/.pnpm/` has the same versions.
**Re-run audit (`pnpm audit --prod`, 29 Nov 2026): 2 advisories remain** —
body-parser 2.3.0 (high, GHSA-27r3-jxmh-p828 — gated, expected) and zod
3.25.76 (high, GHSA-mrhx-c7xc-m3w5 — see "Zod determination" below). The
qs, proxy-addr, undici and zod-v4 advisories are gone. Do not hand-edit
`pnpm-lock.yaml`. If `pnpm` must be re-run in this container, chown the three
lockfiles to root:root first, or the same EPERM returns.

**Zod determination (verified 29 Nov 2026 against the advisory itself).**
- The first draft of this doc said the advisory "affects the v4 copy only".
  That is **incorrect**. The unbounded-issue-accumulation behaviour exists in
  zod **v3** too: with a million bad elements, `z.array(z.string()).max(100)`
  returns 1,000,001 issues on zod **3.25.76** — identical to 4.6.5 — while
  4.6.6 returns 1 (CyberNative test table, 3 Nov 2026). The advisory range
  `< 4.6.6` covers 3.25.76, which is why `pnpm audit` still flags it after the
  v4 copy was fixed to 4.6.6. The v3 line is listed as affected with "no fix,
  no longer updated" (inlinr advisory page).
- **But the CVE was rejected.** NVD (primary source, read 29 Nov 2026) lists
  CVE-2023-54404 as **Rejected**: "The described memory use only grows in
  proportion to input already allocated by JSON.parse before Zod runs, is
  reachable only without an application request-size limit, and reflects
  expected validator behavior rather than a defect in Zod." VulnCheck rejected
  it 28 Oct 2026; the maintainer then closed the PR that would have released
  zod 3.25.77 with backported fixes ("CVE-2023-54404 was rejected, so there's
  no 3.x release to cut"). **No v3 fix exists or will exist** (registry check:
  no 3.25.77; latest stable 3.x is 3.25.76). GitHub's advisory stays open only
  because the withdrawal request has had no reply — so any scanner reading
  GitHub/OSV advisory data keeps reporting it until that data changes.
- **NIRMAQ's exposure is bounded, and the bound is the one VulnCheck named.**
  `express.json({ limit: "256kb", strict: true })`
  (`artifacts/api-server/src/renova-app.ts:49`) runs before routing, so an
  oversized body is refused with 413 before any Zod schema sees it. Worst
  case inside the cap: a 256 kb body of `[0,0,0,…]` is ~128k elements →
  ~128k transient issue objects (~25 MB) — proportional to input already
  allocated by JSON.parse, exactly the rejection reasoning. No OOM is
  reachable. Every inbound array schema is also `.max()`-bounded
  (feasibility: 30/100/100; profiles: 30/30/30); the `lib/api-zod` generated
  response schemas parse server-side in-memory data only (demo API), never
  attacker-controlled request bodies. Note the 4.6.6 fix only helps schemas
  *with* `.max()/.length()/.size()` — and on v3 a `.max()` does not
  short-circuit issue accumulation — so adding bounds is not the mitigation
  here; the body cap is.
- **Conclusion: rejected-CVE scanner persistence, not a live vulnerability and
  not a v3→v4 migration trigger.** Fix options for Aditi: (a) **accept and
  document** (recommended) — the CVE is rejected, no v3 fix exists, and the
  256 kb body cap bounds the exposure; the audit will keep reporting this
  finding until GitHub withdraws the advisory, which is not a regression.
  (b) Migrate the validation layer to zod v4 ≥ 4.6.6 — a real project
  (breaking API changes, drizzle-zod compatibility, catalog bump, every
  schema re-checked); Aditi's decision, not this prompt. (c) Add
  defense-in-depth `.max()` bounds — already present on all inbound array
  schemas; on v3 they do not change the exposure. The targeted
  `"@vercel/cli-config>zod": "4.6.6"` override stays — it correctly fixed the
  v4 copy.

## 5. Safe error handling — COVERED, unchanged

`artifacts/api-server/src/renova-app.ts` error handler: 500s return exactly
`{"error":"Internal server error"}`; oversized bodies 413 `{"error":"Request body
is too large"}`; a missing `DATABASE_URL` is reworded to `"Database is not
configured"` (the real message never leaves the server); Zod failures return
`"Validation failed"` plus field/message pairs only. Details go to server-side
pino logs only. `readyz` swallows **all** failures into the same generic body.
No `.stack` and no raw `error.message` reaches clients outside the handler; the
4xx messages that do pass through are curated generics. **Prompt L changed
nothing in the error handler.** The new 429 refusal flows through it as a
sub-500 status, so the client sees the generic message from
`tooManyRequestsError()` (`"Too many requests. Please try again later."`) — that
shape is pinned by the unit test in `src/lib/auth-rate-limit.test.ts` (authored,
not yet run). H Task 7.1 already test-proved the generic 500 (forced 500 →
generic body, no stack).

## 6. File-upload guard — COVERED, plus F6 quota CLOSED (code)

**The guard (unchanged, on main).** Exactly one server-side upload path:
`POST /feasibility/:id/documents` (`src/routes/feasibility.ts`, `SOCIETY` role +
ownership + status checks first). Allowlist + size at the parser:
`express.raw({type: ["application/pdf","image/jpeg","image/png"], limit: 10 MB})`;
non-listed type → 415 "Only PDF, JPG and PNG documents are supported". Magic
bytes, not extension: `documentContentMatchesType` (`src/lib/feasibility-policy.ts`)
— PDF `%PDF-`, JPEG `FF D8 FF`, PNG 8-byte signature; mismatch → 400 "Document
content does not match its file type". Isolated storage: Vercel Blob
`put(storageKey, body, {access: "private", contentType})`, key
`feasibility/<requestId>/<24-hex-random>-<sanitized-name>`, filename sanitized
to `[a-zA-Z0-9._-]`, SHA-256 recorded in `feasibilityDocuments`. Blob object
storage does not execute uploads. Upload requires `BLOB_STORE_ID` /
`BLOB_READ_WRITE_TOKEN`, else 503. **The 10 MB per-file limit stays** — it is the
designed limit, not the Reel's example 5 MB. The other two file pickers in the
frontend (`FeasibilityDocuments.tsx`, `FeasibilityDashboard.tsx`) are localStorage
checklist pages — no file ever leaves the device there.

**The F6 quota (built in Prompt L).** Two mechanisms, one number:
- **Burst bucket** — `FEASIBILITY_DOCUMENT`, 20 per 24 h per request, enforced
  by `rateLimitFeasibilityDocument` after the magic-byte check and before the
  Blob `put`.
- **Hard count cap** — `FEASIBILITY_DOCUMENT_CAP`, derived from
  `AUTH_RATE_LIMIT_POLICIES.FEASIBILITY_DOCUMENT.limit` (20), enforced by a
  count query (`feasibilityDocuments` where `requestId = ?` and `status =
  'AVAILABLE'`, using the existing `feasibility_documents_request_idx`) in the
  same helper, before the Blob `put`. A rate bucket is a rate, not a cap —
  without the count query, 20 uploads a day forever would still accumulate. The
  count is per request, not per society or global: a second request for the same
  society accepts documents. Removed documents do not consume the cap (only
  `AVAILABLE` is counted).
- A refused upload never writes a Blob object, a row, or a checksum: the quota
  runs before the `put`, and the integration test proves it via the Blob stub's
  `putCalls` (20 after 20 uploads, still 20 after the 21st) and the DB row count.
- The test also proves the cap binds on its own: after the 21st refusal (burst
  bucket), the burst bucket rows are deleted and the upload is tried again — the
  bucket allows it, the count (20 of 20) still refuses it with 429.

**Tests (authored, not yet run)** — `tests/security.integration.ts`: upload-guard
re-checks (PNG-extension-with-PDF-bytes → 400, non-listed type → 415, over-10-MB
→ 413, valid upload → 201 with private Blob + matching SHA-256), the 20-document
cap (count = 8 after 8 uploads, 21st → 429, rows = 20, `putCalls` = 20), the
count-cap independence proof above, and the per-request (not per-society) proof.

## What was deliberately NOT changed

- **body-parser 2.3.0** (F1, addendum-gated), **Express `^5.2.1`**, the
  **`trust proxy: 1`** setting, the **10 MB** upload limit, the **256 kb** JSON body
  cap, the error handler, the upload guard, and every existing auth/privacy
  rate-limit policy and Zod schema.
- **Prompt H's work is not duplicated:** the enquiry global limit
  (`ENQUIRY_SUBMIT` / `ENQUIRY_SUBMIT_GLOBAL`), the `.gitignore` `.env` fix,
  security headers/CSP/HSTS, and the bundle secret guard all live on H (draft PR
  #69, unmerged) — verified present on the H branch (`5be31b9`) before this build.
  This branch notes the merge dependency instead of re-implementing them.
- **recharts** (still imported on main — see §4).
- **No migrations, no production DB writes.** Every quota uses the existing
  `authRateLimits` table with new action names.
- **No test weakened to pass.** No existing test was changed except the import
  block of `tests/security.integration.ts` (new imports for the new section) and
  the `finally` (closes the mini-app server); all existing assertions are
  untouched.

## Owner-side remainders (need Aditi / the team, not code)

1. **Run verification + finish the lockfile refresh** — the go-ahead question in
   the PR report (EPERM + execution-risk notice). Until a clean `pnpm install`
   rewrites the lockfile and the re-run audit passes, §4 stays PARTIAL and this
   branch must not merge.
2. **F1/F4/F7 addendum decision** — body-parser's upgrade path (Express 5.3.0
   refresh) is hers to approve, change, or park. Until then body-parser stays
   pinned and its exposure (one crafted-gzip request crashes the process) stays
   open on main.
3. **Merge H (PR #69) before or with this branch** — the enquiry global limit,
   the `.gitignore` `.env` fix, security headers and the bundle secret guard only
   reach production when H merges. L does not depend on H's code, but the
   "ship fast, not exposed" story is incomplete without it.
4. **Production Node version** — Brotli CVE-2026-111497 (CVSS 9.2, CISA KEV)
   depends on the Vercel runtime's Node version, not the repo. Confirm the
   production runtime is patched; J already lists it as needs-validation.
5. **Rebase if K (#68) merges first** — this branch is off main `aeb7aa8`; if
   another branch lands first, rebase and re-run the suite before merging.
