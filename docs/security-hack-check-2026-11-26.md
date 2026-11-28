# Vibe Coded App Hack Check — NIRMAQ (Prompt H, Task 1)

**Report-only. No code was changed for this check. No live site was attacked,
no requests were sent to production, nothing destructive was run, no database
was written to, no git history was rewritten.**

- **Base:** main `aeb7aa8e259f3ecfd1c1d28b3e4e747a292a8f86` (PR #66 merged 27 Nov 2026)
- **Branch:** `codex/prompt-h-safety-fixes`
- **Date:** 28 Nov 2026
- **Source checklist:** https://gist.github.com/jrmilburn/f63cb40613de8e6174edee4fc1997cdc
  ("The Vibe Coded App Hack Check", by jrmilburn — 15 attacks)
- **Method:** read the code on `aeb7aa8`. Every verdict below was checked from
  source in this run; where Prompt J (28 Nov 2026, Run 1, draft PR #67)
  independently reached the same verdict, that is noted as a cross-check.
  Anything that cannot be checked from code is `CAN'T TELL`, with exactly
  where to check it.
- **Secrets:** no secret is printed in full anywhere in this document — first
  4 characters + location only, per the gist's own rule. No live secret was
  found in source or in git history (see attack 13).

## Verdicts — all 15 attacks

### 1. Stored XSS — SAFE

**Evidence.**
- React escapes user text by default. The only `dangerouslySetInnerHTML` in
  the frontend is `artifacts/renova/src/components/ui/chart.tsx:78`
  (`ChartStyle`): it injects a `<style>` block built only from the chart
  component's own theme/color config — no user content flows into it — and
  the `ChartContainer` component has no imports anywhere in
  `artifacts/renova/src` (dead code; see the audit doc, Task 9).
- No `innerHTML` usage anywhere in `artifacts/renova/src`.
- Server-rendered HTML email escapes user values:
  `artifacts/api-server/src/lib/email.ts:21` (`escapeHtml`), used for the
  product name, OTP and sign-in URL.

**How an attacker would do it:** submit a society bio, comment or message
containing `<script>alert(1)</script>`. React renders it as text; emails
escape it. No script executes. Cross-check: J `h-stored-xss-user-content`.

### 2. IDOR — changing the id shows someone else's record — SAFE

**Evidence.** Every record route scopes its SQL to the session's organisation
and returns 404 on mismatch (no existence oracle):
- `artifacts/api-server/src/routes/opportunities.ts` — society-owned
  opportunities joined to the caller's organisation; developer/PMC detail
  only for `PUBLISHED` rows with an explicit public field list.
- `artifacts/api-server/src/routes/profiles.ts` — profile reads/writes
  scoped to the caller's organisation.
- `artifacts/api-server/src/routes/feasibility.ts` —
  `assertFeasibilityOwnership` on every feasibility read/write.
- `artifacts/api-server/src/routes/workspace.ts` — metrics scoped to the
  caller's organisation.
- `artifacts/api-server/src/routes/enquiries.ts` — admin enquiry reads are
  ADMIN-only (see attack 3).

**How an attacker would do it:** as society A, request
`/societies/me/opportunities/<society-B-opportunity-id>`. The query joins
against A's organisation, finds nothing, returns 404. Cross-check: J
`h-idor-cross-org`.

### 3. Typing `/admin` — SAFE

**Evidence.** Every `/admin/*` API route carries `requireAuth()` +
`requireRole("ADMIN")` on the server — hiding a link is not the check, and
no route relies on that. Sampled and grepped on `aeb7aa8`:
- `artifacts/api-server/src/routes/enquiries.ts:193-194, 246-247, 322-323,
  359-360` (admin enquiries list / update / consent / history)
- `artifacts/api-server/src/routes/feasibility.ts:585-586, 611-612, 629-630,
  695-696, 802-803` (admin feasibility list / detail / status / assessment)
- `artifacts/api-server/src/routes/privacy.ts:683, 720, 755, 877, 933, 1010,
  1033, 1074, 1115` (admin privacy-request queue)
- `artifacts/api-server/src/routes/email-jobs.ts:9, 24` (admin email jobs)
- There is no users-delete route at all, and registration cannot create an
  admin (see attack 6). The frontend has no real admin panel — only the
  demo preview, which says "Secure account access is not enabled in this
  preview" (`artifacts/renova/src/platform/PlatformApp.tsx:228`).
- The admin feasibility routes were exercised as 403 for non-admins in
  `artifacts/api-server/tests/security.integration.ts`.

**How an attacker would do it:** open `/admin/feasibility` or call
`PATCH /api/admin/feasibility/<id>/status` with no session — 401; with a
non-admin session — 403. Cross-check: J `h-admin-routes-no-auth`.

### 4. API key in the browser — SAFE (source; built bundle swept in Task 6)

**Evidence.**
- The only `VITE_` variable read anywhere in `artifacts/renova/src` is the
  boolean feature flag `VITE_RENOVA_LIVE_WORKSPACE`
  (`artifacts/renova/src/platform/PlatformApp.tsx:53`); it carries no secret.
- A source grep for `sk_live_`, `sk_test_`, `service_role`, `AKIA`, `ghp_`,
  `sk-`, `sk-ant-`, `RESEND_API_KEY`, `DATABASE_URL` across
  `artifacts/renova/src` returns no hits.
- `import.meta.env.BASE_URL` and `import.meta.env.DEV` are the only other
  `import.meta.env` uses (video path, dev-only error detail).

**How an attacker would do it:** open DevTools on the built site, search the
JS bundle for a key prefix, and call the provider directly. There is nothing
to find in source. The built-bundle sweep (Task 6) re-checks `dist/` after
the production build. Cross-check: J `h-api-key-in-browser` (dist sweep
clean on `aeb7aa8`).

### 5. Prompt injection — N/A

**Evidence.** The repo has no AI features, no model calls, no MCP
servers/clients, no AI endpoint. There is nothing for a prompt to inject
into. Cross-check: J `h-ai-endpoint-abuse` (N/A, excluded on every coverage
unit).

### 6. Making yourself admin at sign-up — SAFE

**Evidence.**
- `artifacts/api-server/src/routes/auth.ts` — `registrationSchema` lists
  explicit fields only (email, password, displayName, participantType,
  organizationName, location, ageAttestation). There is no `role`,
  `is_admin` or `plan` field, and no `...req.body` / `Object.assign(user,
  body)` spread anywhere in the auth or profile routes (grep verified).
- The role is derived server-side by `registrationIdentity()` from
  `participantType`
  (`artifacts/api-server/src/lib/role-policy.ts`), and
  `REGISTRATION_PARTICIPANTS` excludes ADMIN.
- Profile updates use explicit Zod schemas with server-derived ownership.

**How an attacker would do it:** `POST /auth/register` with
`{"role": "ADMIN", ...}` — Zod strips the unknown key and the created user
gets the role for their participant type. Cross-check: J
`h-mass-assignment-promotion`, `h-registration-creates-admin`.

### 7. Editing the price — SAFE

**Evidence.**
- `artifacts/api-server/src/routes/sandbox-billing.ts:23` — the amount is a
  positive integer from the database product row, never from the client.
- `:144, :155, :163` — the provider order is re-fetched and its amount is
  compared to `order.amountMinor` before anything is granted.
- Payments are sandbox-only (`VERCEL_ENV != production` AND
  `RENOVA_PAYMENTS_MODE = sandbox` AND `rzp_test_` key) and disabled on
  NIRMAQ unless Aditi approves them.

**How an attacker would do it:** POST a checkout with `price: 0` — the
server ignores the client amount and charges the DB price. Cross-check: J
`h-live-payment-price-edit`.

### 8. Faking a payment — SAFE

**Evidence.**
- `artifacts/api-server/src/routes/sandbox-billing.ts:306-331` — the
  webhook handler verifies the Razorpay HMAC signature, re-fetches the
  provider order, checks `order.amountMinor !== payment.amount`, and
  handles duplicate events idempotently (J verified the event-dedup path;
  the handler is safe to receive the same event twice).
- Paid access is granted only from the verified webhook, never from a
  success page or an unsigned request.

**How an attacker would do it:** POST a fake "payment succeeded" callback —
signature verification fails and nothing is granted. Cross-check: J
`h-fake-payment-callback`.

### 9. Race conditions — SAFE

**Evidence.** Every check-then-act path is atomic:
- Enquiries: advisory lock on the fingerprint inside the transaction
  (`artifacts/api-server/src/routes/enquiries.ts`, `pg_advisory_xact_lock`),
  with the 5/hour cap checked and the insert in the same transaction.
- OTP verify / password reset: user row locked (`FOR UPDATE`), token
  consumed with a conditional update (`usedAt IS NULL`, expiry and attempt
  checks in the `WHERE` clause).
- Opportunity publish/close and interest submit: conditional updates on
  status + unique constraint on (opportunity, organisation) with
  `onConflictDoNothing`.
- The integration suite proves the enquiry race: 8 concurrent identical
  enquiries yield exactly 5 × 201 and 3 × 429
  (`artifacts/api-server/tests/security.integration.ts`).

**How an attacker would do it:** fire 100 simultaneous coupon/credit/
interest requests — the first wins the lock or the unique constraint, the
rest get 409. Cross-check: J `h-race-condition-check-then-act`.

### 10. Ordering −1 items — SAFE

**Evidence.** All numeric inputs are server-validated as positive whole
numbers within bounds (Zod):
- `opportunities.ts` — `memberCount` positive int, max 100,000;
  `buildingAge` non-negative int, max 200.
- `sandbox-billing.ts:23` — `amountMinor` positive int, max 100,000,000;
  `:306` — payment amount positive int.
- `feasibility.ts` — quantities bounded by their Zod schemas.

**How an attacker would do it:** POST `memberCount: -1` or `amount: 0` —
Zod rejects it with 400. Cross-check: J `h-negative-quantity`.

### 11. Guessing the login code — SAFE

**Evidence.**
- Email OTP: 6 digits, `EMAIL_OTP_MAX_ATTEMPTS = 5` per token, 10-minute
  expiry (`EMAIL_VERIFICATION: 10 * 60 * 1000`), single-use (`usedAt`),
  verified with a timing-safe HMAC
  (`artifacts/api-server/src/lib/auth-tokens.ts`).
- Login: 10 attempts / 15 minutes per account, plus a per-IP bucket at 10×
  that limit (`artifacts/api-server/src/lib/auth-rate-limit.ts`,
  `AUTH_RATE_LIMIT_POLICIES.LOGIN`).
- Password reset: token-based, 60-minute expiry, single-use, all sessions
  invalidated on use.

**How an attacker would do it:** brute-force a 6-digit OTP — 5 attempts
per token, then the token is dead; a fresh token needs a fresh email send,
which is itself rate-limited (3/hour resend). Cross-check: J
`h-otp-brute-force`.

### 12. Uploading something that isn't a photo — SAFE

**Evidence** (`artifacts/api-server/src/routes/feasibility.ts`,
`POST /feasibility/:id/documents`, SOCIETY-only, ownership-checked):
- Allowlist of content types only: PDF, JPG, PNG
  (`ALLOWED_DOCUMENT_TYPES`, `:100`); anything else → 415.
- `express.raw` with a 10 MB cap (`MAX_DOCUMENT_BYTES`, `:105`).
- Magic-byte check: `documentContentMatchesType(request.body, contentType)`
  — the bytes must match the declared type, not just the extension or the
  browser's content type.
- Private Vercel Blob storage, randomised storage key, filename sanitised
  (`safeName`), SHA-256 checksum recorded.

**How an attacker would do it:** upload an HTML/SVG file labelled
`image/png` — the magic-byte check rejects it with 400. Cross-check: J
`h-upload-validation`.

### 13. `.env` in git — SAFE in history; VULNERABLE prospectively (F8)

**Evidence.**
- `git log --all --oneline -- .env '.env.*'` returns nothing: no `.env`
  file was ever committed.
- `git log --all -p -S "sk_live_"` and the same search for `sk_test_`,
  `AKIA`, `ghp_`, `service_role`, `BEGIN .*PRIVATE KEY` return nothing:
  no live secret was ever committed. (Only `TEST-ONLY-…` placeholders
  exist in test code.)
- **But `.gitignore` has no `.env` entry.** The codebase expects
  `DATABASE_URL`, `RESEND_API_KEY` and the auth token secret from the
  environment, so a developer adding a `.env` file could commit it by
  accident. That is exactly the prospective failure this attack checks
  for — so the check as defined FAILS.

**Fix (follow-up, not in this PR — see "Follow-ups"):** one line, `.env*`,
in `.gitignore`. Effort: trivial. Nothing has leaked, so there is nothing
to rotate for this item.

### 14. Hitting the AI endpoint 10,000 times — N/A

**Evidence.** There are no AI endpoints (see attack 5). No per-call cost
surface exists. Cross-check: J `h-ai-endpoint-abuse` (N/A).

### 15. Querying the database directly — N/A

**Evidence.** The browser only talks to `/api` (Vercel rewrite to the
api-server host); no database client, connection string or row-level
security question arises in the frontend. All access is server-mediated
(see attack 2).

## Summary table

| # | Attack | Verdict | Evidence | Fix | Effort |
|---|---|---|---|---|---|
| 1 | Stored XSS | SAFE | React escaping; only theme-color `dangerouslySetInnerHTML` in unused chart component; `escapeHtml` in emails | None | — |
| 2 | IDOR | SAFE | Org-scoped SQL + 404 on mismatch on every record route | None | — |
| 3 | Typing `/admin` | SAFE | `requireAuth()` + `requireRole("ADMIN")` on every `/admin/*` route | None | — |
| 4 | API key in browser | SAFE (source) | Only `VITE_RENOVA_LIVE_WORKSPACE` boolean flag; no key patterns in source | Confirm on built bundle (Task 6) | Small |
| 5 | Prompt injection | N/A | No AI surface | None | — |
| 6 | Self-admin at sign-up | SAFE | Explicit Zod fields; role derived server-side; ADMIN excluded | None | — |
| 7 | Price editing | SAFE | Amount from DB; provider re-fetch + amount check | None | — |
| 8 | Fake payment | SAFE | Webhook HMAC + re-fetch + amount match + idempotent events | None | — |
| 9 | Race conditions | SAFE | Advisory locks + conditional updates + unique constraints; proven by concurrent-enquiry test | None | — |
| 10 | Negative quantities | SAFE | Zod positive/bounded numerics everywhere | None | — |
| 11 | Login-code guessing | SAFE | OTP 5 attempts / 10 min / single-use; login 10 per 15 min per account + per-IP bucket | None | — |
| 12 | Uploads | SAFE | Allowlist + magic bytes + 10 MB + private Blob + randomised key | None | — |
| 13 | `.env` in git | VULNERABLE (prospective) | History clean; `.gitignore` has no `.env` entry | Add `.env*` to `.gitignore` | Trivial |
| 14 | AI-endpoint abuse | N/A | No AI endpoints | None | — |
| 15 | Direct DB access | N/A | Browser talks only to `/api`; server mediates all access | None | — |

## Leaked keys to rotate today

**None.** No live secret was found in source, in the built-bundle patterns
checked from source, or anywhere in git history. The only key-shaped strings
in the repo are `TEST-ONLY-…` placeholders in test code. Nothing needs
rotating for this check.

## The 5 fixes to do first (ranked by risk, then effort)

These are the fixes already decided in Prompt H (Tasks 2–7 and 9), ranked
here so Aditi can see the order:

1. **Remove or gate the unauthenticated legacy demo API (Task 4, Gap 3,
   MEDIUM).** Six endpoints with no auth, one of them a write path
   (`POST /projects`) that any anonymous visitor can use to inject content
   the live workspace renders as a real society. Highest user-facing risk
   in this check. (J finding F2.)
2. **Global rate limit for public POST routes (Task 5, Gaps 4–5, LOW).**
   The enquiry fingerprint cap is defeated by IP+email rotation, and each
   accepted enquiry triggers 2 Resend emails — unbounded email spend and
   admin-inbox flooding. (J finding F5.)
3. **Security headers (Task 9.2, LOW).** No CSP/HSTS/X-Frame-Options on
   either host; login and workspace pages can be framed. Small config
   change. (J finding F3.)
4. **First-admin provisioning path (Task 3, Gap 2, HIGH).** No seed script
   or doc exists; the only admin creation on record is a test-fixture
   direct DB insert. Needed before the site can be operated.
5. **Backup / recovery runbook (Task 2, Gap 1, HIGH).** No verified Neon
   backup/recovery; the Neon console requests email verification to link
   the Vercel Marketplace identity (owner step, BLOCKED). The runbook is
   honest about what is `CAN'T TELL` and what is blocked.

## Follow-ups — VULNERABLE or open items NOT fixed in this PR

Per the prompt's rule, new `VULNERABLE` findings that are not one of the
ranked gaps go here with fix + effort; they are not fixed in this PR.

| # | Item | Fix | Effort |
|---|---|---|---|
| F8 | `.gitignore` has no `.env` entry (attack 13) | Add `.env*` to `.gitignore` | Trivial — one line |
| F1 | body-parser 2.3.0, CVE-2026-111181 — one unauthenticated crafted-gzip request crashes the API process (J, medium) | Upgrade body-parser to ≥ 2.4.0 (or `inflate: false`); re-pin the lockfile | Small — one dependency upgrade + retest |
| F4 | `GET /billing/products` leaks `approvalReference` to any SOCIETY user (J, low) | Replace `.select()` with an explicit column list + regression test | Small |
| F6 | No quota on feasibility requests / uploads (J, low) | Cap requests per society and documents/total size per request; return 429 | Small–medium |
| F7 | Consent withdrawal has no API (J, low) | Add `POST /privacy/consent/withdraw` + surface it in the privacy page | Medium |

F1, F4 and F7 have no Prompt H task by design — Aditi decides their home
separately. F6 is adjacent to Task 5 (rate limits) but is a per-society
quota, not a public-route rate limit, so it is listed here rather than
folded into Task 5.

## Re-verification note (Task 9.4)

The verdicts above were checked from current main `aeb7aa8` in this run
(28 Nov 2026). Prompt J independently re-ran the same 15 attacks against
`aeb7aa8` on 28 Nov 2026 and reached the same result: 12 SAFE, 3 N/A
(`REPORT.md` §6). The one place the two runs differ in presentation is
attack 13: J rates the history SAFE and records the `.gitignore` gap
separately as F8 (informational); this check rates the attack as defined
— `.gitignore` coverage included — as VULNERABLE (prospective), because
the check explicitly asks whether `.gitignore` covers `.env` files. The
underlying facts agree: history is clean, the ignore line is missing.

## What this check did NOT do

- No live site was attacked and no requests were sent to production.
- No code was changed for this check (report-only).
- No target code was executed: this environment has no OS-enforced
  sandbox, so no local server was run for this check and no crash was
  reproduced. Findings rest on source evidence (plus vendor advisories
  where J cites them, e.g. F1).
- Hosting / dashboard facts (production Node version, production
  `CORS_ORIGINS`, the API process model, whether the Replit deployment is
  live) are `CAN'T TELL` from code — see J `NEEDS-VALIDATION.md`.
- This is not a penetration test. If NIRMAQ ever handles payments, health
  data or anything sensitive, get a human to review it too.
