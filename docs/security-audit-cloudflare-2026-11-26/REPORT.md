# Prompt J — Cloudflare security-audit skill run (audit only)

**NIRMAQ, main `aeb7aa8` · Run 1 · 28 Nov 2026 · Audit only — no code was changed.**

## Read this first — four honest corrections and limits

1. **The Reel's numbers were wrong.** The Reel that introduced this skill said 24,000 stars. The skill repository (github.com/cloudflare/security-audit-skill) is public, MIT-licensed, and had **79,189 stars** when installed for this run — so "78,000+" is the right figure, not 24,000. Separately, the Reel's **7,245 figure describes Cloudflare's fleet harness, not this skill** — it is not a count of anything this audit did or found.
2. **Token cost was not measured.** This run did not instrument token usage, so no token-cost figure is given. Any number quoted elsewhere for this run would be invented.
3. **There was no sandbox, so nothing was executed.** This environment has no OS-enforced sandbox, so no target code was run at all — no local server, no live requests, no crash reproduction. Every finding rests on source evidence plus vendor advisories for exact pinned dependency versions. Anything that needs a running system or a deployment fact stayed **needs_validation** instead of being confirmed by assertion. The seven needs-validation records are listed in §5 and in NEEDS-VALIDATION.md.
4. **One run finds roughly half of what repeated runs find.** This is Run 1 of the skill's profile. It is not a clean bill of health: a second run after fixes is expected to surface things this run missed, and the rejected records exist so a future run does not re-open settled questions.

Two execution deviations from the skill's documented procedure (also recorded in run-metadata.json):

- **Single-agent run.** This environment cannot spawn sub-agents, so the skill's isolated-hunter / fresh-verifier separation was approximated by sequential passes with distinct pass roles (hunter-a, verifier-a, verifier-b) and explicit disprove intent. Independence is procedural, not process independence.
- **Install needed `--yes`.** The documented install command (`npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`) hung on the CLI's interactive "Select agents to install skills to" prompt (no agent auto-detected; first attempt hung ~15 minutes before being killed). Re-running with `--yes` completed in ~4 seconds. Same source, same skill, project-level install. The installed skill files (`.agents/skills/`, `skills-lock.json`) are untracked and are **not** part of this PR.

## Run profile

| Item | Value |
|---|---|
| Run | prompt-j-run-1, profile `standard`, Run 1 |
| Source | main `aeb7aa8e259f3ecfd1c1d28b3e4e747a292a8f86` (PR #66 merged 27 Nov 2026 23:57 IST) |
| Branch | `codex/prompt-j-cloudflare-audit` |
| Skill | cloudflare/security-audit-skill, commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`, public, MIT, 79,189 stars at install |
| Scope | `artifacts/api-server`, `artifacts/renova`, `lib/db`, `lib/api-zod`, `lib/api-spec`, `lib/api-client-react`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vercel.json`, `.gitignore` — plus the new Phase 1 files on main (GetStarted.tsx, get-started.ts, FeasibilityCheck.tsx, Header.tsx, Home.tsx, App.tsx, experience.css, page-meta.ts, sitemap.xml) |
| Not hunted | Memory-safety / binary / kernel classes (TypeScript/JavaScript target, no native code) and AI/LLM classes (no AI features, model calls or MCP servers/clients in the target) — recorded as excluded on every ledger unit |
| Validators | `validate-findings.cjs`: **PASS: 35 findings valid** · `validate-coverage-ledger.cjs`: **PASS: 35 coverage units valid** |
| Output | `docs/security-audit-cloudflare-2026-11-26/` — `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`, `run-metadata.json` |

## Security posture — summary

The core is in better shape than the Reel that prompted this audit would suggest. Authentication, authorisation, org isolation, payment handling and input validation are all enforced server-side with real controls, and Prompt H's five main verdicts all held up on re-check (see §6). The problems this run found are concentrated in three places: **an old dependency with a published single-request crash**, **demo/prototype code still wired into the live API**, and **missing platform hygiene (headers, quotas, rate limits)**. Nothing found gives an attacker another user's data or a live payment.

Counts: **8 confirmed** (2 medium, 5 low, 1 informational), **7 needs_validation** (no severity — these are open questions, not findings), **20 rejected** (claims disproved with evidence).

## 1. Confirmed findings

| # | Finding | Severity | One line |
|---|---|---|---|
| F1 | body-parser 2.3.0 — CVE-2026-111181 | **medium** | One unauthenticated request with a crafted gzip body crashes the API process (vendor CVSS 7.5 HIGH; medium here because the production process model is unknown — see N6). Fix: upgrade body-parser ≥ 2.4.0 (or `inflate: false`). |
| F2 | Unauthenticated legacy demo API | **medium** | Six demo endpoints (`GET /dashboard`, `POST /projects`, …) have no auth; anyone can inject content the live workspace renders as a real society. Fix: delete the demo router from `/api` or gate it behind ADMIN and make it read-only. |
| F3 | No security headers | low | No CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy on either host — login and workspace pages can be framed. |
| F4 | `GET /billing/products` leaks `approvalReference` | low | Unscoped `.select()` returns the internal approval reference to any SOCIETY user. Fix: explicit column list. |
| F5 | Enquiry rate limit defeated by IP+email rotation | low | `POST /enquiries` has no global rate limit; rotating IP and email defeats the 5/hour fingerprint cap, and each accepted enquiry triggers 2 Resend emails. |
| F6 | No quota on feasibility requests / uploads | low | Unlimited requests and 10 MB uploads per society → unbounded private Blob storage cost. (File-content checks themselves are sound.) |
| F7 | Consent withdrawal has no API | low | The ledger supports `WITHDRAWN` and the design says consent is withdrawable, but nothing can write it — withdrawal is manual-only. |
| F8 | `.gitignore` does not ignore `.env` | informational | No `.env` exists and history is clean; a future `.env` could be committed by accident. One-line fix. |

Full trace and reproduction for the two mediums are in FINDINGS-DETAIL.md; every record (including the lows) is fully specified in findings.json.

### F1 detail (the one to fix first)

Express 5.2.1 resolves body-parser 2.3.0 (`pnpm-lock.yaml:4854`), inside the vulnerable range 2.0.0–2.3.0 for CVE-2026-111181 (fixed in 2.4.0). The API mounts `express.raw()` (webhook), `express.json()` and `express.urlencoded()` globally with the default `inflate: true` (`renova-app.ts:48-50`), ahead of all routes and ahead of authentication. The official Express advisory (fetched 28 Nov 2026) states a single request — a valid gzip member followed by a zero byte and trailing bytes — crashes the server with an uncaught exception, and that the request "does not need to match a valid route or pass an authentication check" when the parser is mounted globally. The 256 kb size limit on the parsers does **not** mitigate this: the advisory's proof-of-concept body is about 100 kb. The crash was **not** reproduced locally in this run (no sandbox); it is established by the advisory plus the exact version match plus the global default-inflate mounting, which is why confidence is medium, not high. Severity is medium rather than the vendor's high because the blast radius depends on the production process model (N6): on a long-lived host one request kills all in-flight work; on a Vercel serverless function it kills only that invocation.

### F2 detail

`artifacts/api-server/src/routes/renova.ts` defines `GET /dashboard`, `GET /projects`, `POST /projects`, `GET /projects/:id`, `GET /professionals`, `GET /regulations` with no authentication, mounted under `/api` (`routes/index.ts:17`). `POST /projects` appends to an in-memory array with no rate limit and no size bound, and the workspace Overview (`App.tsx:600`, `useGetDashboard`) renders that data as a real society workspace (the demo society "Kirti Heights CHS"). Any anonymous visitor can inject a project every other visitor sees, and can grow process memory without limit. No real user data is exposed (the data is fictional) and no script executes (React escapes it), which is why this is medium, not high.

## 2. Hardening notes (not findings — no record in findings.json)

- **CSRF:** no token or Origin check; the `SameSite=Lax` session cookie is the only control. Acceptable in modern browsers; residual risk is old browsers and same-site attackers.
- **Sessions:** 14 days, no rotation on login (multi-device by design), `credentialVersion` invalidates sessions on password change/verify.
- **scrypt:** parameters are unpinned (Node defaults N=16384, r=8, p=1 — the recommended values). Pin them explicitly; the 8-character password floor meets the NIST minimum — a higher floor is Aditi's call, not a fix.
- **Opportunities search:** `%`/`_` are not escaped in the `ilike` pattern (unlike the admin enquiry search). Not a vulnerability — a `%` query returns only the already-public PUBLISHED set — but it is a correctness nit worth fixing with the admin search's escaping.
- **localStorage drafts:** the feasibility dashboard stores society answers and contact details (PII) in localStorage with no expiry.
- **Misc:** `isMapsLink` is weak (`startsWith("http")` + contains `google.`/`goo.gl`/`maps`); the feasibility dashboard copy contradicts itself about whether uploaded files are emailed (lines ~470/480 vs ~692); `ContactForm` posts directly to `/api/enquiries`; the privacy page has no `/api/privacy` fetch yet (Phase 2 follow-up); the generated API client's Bearer-token hook (`setAuthTokenGetter`) is never called — cookie sessions are the only auth, and the dead Bearer path should be removed or documented.
- **Coverage-critic pass (self-check):** re-read for unmapped entry points — `scripts/` (only `pnpm install --frozen-lockfile` in the post-merge hook), `docs/` (no secrets), `artifacts/renova/src/data/` (no hardcoded PII), the platform preview flag (`VITE_RENOVA_LIVE_WORKSPACE`), `lib/api-client-react` (Bearer path unused, see above), and the `.replit` deployment config (now N7). No missing coverage unit was found; one unit remains out of scope (the dev-only mockup sandbox).

## 3. Positive patterns (things that held up)

Org-scoped SQL joins on every route with 404-on-mismatch (no existence oracle); conditional updates and advisory locks on every check-then-act path (OTP verify, reset consume, privacy verify, checkout, webhooks, interest submit, opportunity publish/close, feasibility transitions); HMAC + provider re-fetch + amount match + event dedup on the payment webhook; sandbox-only payment config that refuses production; Zod parsing on every database route with parameterised Drizzle; scrypt + 16-byte salt + `timingSafeEqual`; OTP attempt caps (5 per token) plus per-account rate limits; magic-byte upload validation with an allowlist, private Blob storage and `attachment` disposition; fail-closed CORS (unset origin list = no cross-origin access) and fail-closed registration (release file all-false).

## 4. Coverage summary

35 coverage units: **32 candidate** (a candidate was produced — confirmed, needs_validation or rejected), **2 covered** (reviewed, no finding: the localStorage drafts unit and the Phase 1 pages unit), **1 out_of_scope** (the dev-only mockup sandbox), **0 blocked, 0 deferred, 0 planned**. The two covered units still carry their hardening notes in §2. One rejected record (`h-ai-endpoint-abuse`) maps to no ledger unit by design — no AI surface exists, and AI blocks are recorded as excluded on every unit.

## 5. Needs validation (no severity — open questions, not findings)

| # | Question | Where to check |
|---|---|---|
| N1 | Production Node.js version vs CVE-2026-111497 (Brotli, critical 9.2, CISA KEV) | Vercel dashboard — needs ≥ 22.23.4 / 24.22.1 / 26.12.1 |
| N2 | Neon backup / recovery + production DB baseline (0003–0008 unverified, readyz 503) | Neon console + Aditi's 3 read-only Neon queries |
| N3 | First-admin provisioning — no path exists; who is the first admin, and by which approved method? | Aditi's decision |
| N4 | Production `CORS_ORIGINS` value (credentials are allowed, so the list must be exactly the approved hosts) | Vercel dashboard |
| N5 | `trust proxy: 1` + X-Forwarded-For — does Vercel overwrite or append? (IP-limit bypass / victim-bucket poisoning if it appends) | Vercel docs / deployment logs |
| N6 | API process model — serverless function or long-lived host? (Bounds the F1 blast radius) | Vercel dashboard |
| N7 | Is the Replit autoscale deployment (`.replit`) live, and what does it serve? | Aditi / operator |

Full blockers and validation plans are in NEEDS-VALIDATION.md and in findings.json.

## 6. Prompt H revalidation (Task 2)

Every Prompt H verdict was re-checked from the current source on main `aeb7aa8` by a fresh pass that tried to disprove it. All five main verdicts held.

| Prompt H verdict | This run | Record |
|---|---|---|
| Admin gating PASS | **Confirmed** — "admin routes lack auth" disproved (every `/admin/*` route has `requireAuth()` + `requireRole("ADMIN")`) | `h-admin-routes-no-auth` (rejected) |
| Registration cannot create an admin PASS | **Confirmed** — self-promotion disproved (role derived server-side; `REGISTRATION_PARTICIPANTS` excludes ADMIN; test pins it) | `h-registration-creates-admin` (rejected) |
| No live payment path PASS | **Confirmed** — live payment / price manipulation disproved (sandbox-only config, amount from DB, webhook HMAC + re-fetch) | `h-live-payment-price-edit` (rejected) |
| Password hashing PASS | **Confirmed** — plaintext disproved (scrypt + 16-byte salt + `timingSafeEqual`) | `h-passwords-plaintext` (rejected) |
| Zod + Drizzle PASS | **Confirmed** — SQL injection disproved (Zod on every DB route; parameterised Drizzle; only raw `sql` is advisory locks/counters) | `h-sql-injection-unvalidated-input` (rejected) |
| Low minor 1: `ilike` `%`/`_` unescaped | **Rejected as a vulnerability** — returns only the already-public PUBLISHED set; correctness nit only | `h-opportunities-ilike-wildcard` (rejected) |
| Low minor 2: no global rate limit | **Confirmed, low** — enquiry fingerprint is defeated by IP+email rotation; each accepted enquiry triggers 2 emails | `enquiry-rate-limit-ip-rotation` (confirmed) |
| Backup gap (HIGH in H) | **Needs validation** — no backup config in repo; Neon console + Aditi's 3 queries still awaited | `neon-backup-recovery-unverified` |
| First-admin gap (HIGH in H) | **Needs validation** — no provisioning path; owner decision required | `first-admin-provisioning-missing` |
| Legacy demo API | **Confirmed, medium** — six unauthenticated demo endpoints, writable, rendered as real | `legacy-demo-api-unauthenticated` (confirmed) |

### The 15-attack gist (Prompt H Task 1), re-run against `aeb7aa8`

| # | Attack | Verdict | Evidence / record |
|---|---|---|---|
| 1 | Stored XSS | SAFE | React escapes; `escapeHtml` in email; only `dangerouslySetInnerHTML` is dev-config style in unused ChartContainer — `h-stored-xss-user-content` |
| 2 | IDOR | SAFE | Org-scoped SQL everywhere; 404 on mismatch — `h-idor-cross-org` |
| 3 | Typing `/admin` | SAFE | Server role checks; frontend admin views role-gated from `/auth/me` — `h-admin-routes-no-auth` |
| 4 | API key in browser | SAFE | `dist/` sweep: no `sk_live_`/`sk_test_`/`AKIA`/`ghp_`/`service_role`/`RESEND_API_KEY`/`DATABASE_URL`; only the `VITE_RENOVA_LIVE_WORKSPACE` boolean flag |
| 5 | Prompt injection | N/A | No AI features/endpoints — `h-ai-endpoint-abuse` |
| 6 | Self-admin | SAFE | Explicit Zod-parsed fields; role derived server-side — `h-mass-assignment-promotion` |
| 7 | Price editing | SAFE | Amount from DB; provider order re-fetched and amount-checked — `h-live-payment-price-edit` |
| 8 | Fake payment | SAFE | Webhook HMAC + re-fetch + amount match + idempotent events — `h-fake-payment-callback` |
| 9 | Races | SAFE | Advisory locks + conditional updates + unique constraints on all check-then-act paths — `h-race-condition-check-then-act` |
| 10 | Negative quantities | SAFE | All numeric inputs server-validated positive/bounded — `h-negative-quantity` |
| 11 | Login-code guessing | SAFE | OTP 5 attempts/token, 10-min expiry, single-use; login 10/15 min per account — `h-otp-brute-force` |
| 12 | Uploads | SAFE | Allowlist + magic bytes + 10 MB + private blob + `attachment` disposition — `h-upload-validation` |
| 13 | `.env` in git | SAFE in history | Zero live secrets in history; only TEST-ONLY placeholders — `h-live-secrets-in-git`. The `.gitignore` gap is F8 (confirmed, informational) |
| 14 | AI-endpoint abuse | N/A | No AI endpoints — `h-ai-endpoint-abuse` |
| 15 | Direct DB access | N/A | Browser only talks to `/api`; server mediates all access — `h-direct-db-access-browser` |

## 7. What is still open / needs Aditi

1. **Fix order (suggested, Aditi decides):** F1 first (one dependency upgrade — the only finding with a published exploit and a trivial fix), then F2 (remove or admin-gate the demo router), then F3 + F8 (headers and the `.gitignore` line are both small), then F4–F7 with the Prompt H fixes.
2. **Second run:** after the fixes land, a second skill run is expected — this run is Run 1 and a single run finds roughly half of what repeated runs find. Decide whether the second run is Muse or Codex, and whether it re-runs the full profile or only the changed units.
3. **The seven needs-validation questions (§5)** need owner/operator answers: the Vercel Node version (N1), the Neon backup/baseline check (N2 — same 3 read-only queries already awaited), the first admin (N3), the production CORS value (N4), the X-Forwarded-For behaviour (N5), the API process model (N6), and whether the Replit deployment is live (N7).
4. **Prompt H stays held** until this audit report lands — it has now landed. The Prompt H fixes should be shaped by these findings (notably F1, F2, F3 and the enquiry rate limit).
5. **Nothing in this PR changes code, production, the database or any deployment.** It is audit output only, on branch `codex/prompt-j-cloudflare-audit`, as a [DO NOT MERGE] draft PR.
