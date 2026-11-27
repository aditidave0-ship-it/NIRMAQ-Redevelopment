# Needs validation — Prompt J, Run 1 (main `aeb7aa8`)

Seven source-grounded candidates whose decisive validation is blocked on a fact that is **not in the repo** — a deployment setting, a console-only value, or an owner decision. These carry **no severity**: they are open questions, not findings. Each record is fully specified in `findings.json` (validator: PASS, 35 findings). Nothing here was confirmed by assertion.

---

## N1 — Production Node.js version vs CVE-2026-111497 (Brotli, critical 9.2, CISA KEV)

- **Fingerprint:** `node-brotli-cve-2026-111497-runtime`

**Claimed root cause.** If production runs an unpatched Node version, a malicious Brotli-compressed request body could trigger the CVE-2026-111497 flaw (remote code execution per the advisory).

**Why it cannot be settled from source.** CVE-2026-111497 ("Node2Shell") is a critical (CVSS 9.2) Brotli decompression flaw in Node.js, added to the CISA Known Exploited Vulnerabilities catalog on 27 Oct 2026 and fixed in Node 22.23.4 / 24.22.1 / 26.12.1 on 21 Oct 2026. The API inflates Brotli request bodies by default (`express.json()`/`urlencoded()` with default inflate, `renova-app.ts:49-50`), so the vulnerable code path exists in source. But no `package.json` in the repo pins a Node version (no `engines` field anywhere) and the API server has no `vercel.json`, so the production Node version is unknown. The VM used for this audit runs Node v24.22.1 (patched), which says nothing about production.

**Blockers.**

- `environment`: production Node.js version is not in the repo and cannot be read from source.
- `deployment`: the Vercel Node.js runtime version for the api-server project must be read from the Vercel dashboard or a deployment log.

**Validation plan (deployment).**

1. In the Vercel dashboard, open the api-server project settings and read the Node.js version (or read it from a recent deployment log).
2. Confirm the version is ≥ 22.23.4, ≥ 24.22.1 or ≥ 26.12.1 (the patched lines). If it is older, upgrade and redeploy.
3. If the Replit autoscale deployment (`.replit`) is also live, confirm its Node version too (it declares `modules = ['nodejs-24']`, the 24 line, but the exact patch version is unknown).

---

## N2 — Neon backup / recovery and the production database baseline are unverified

- **Fingerprint:** `neon-backup-recovery-unverified`

**Claimed root cause.** If Neon backups or point-in-time recovery are not enabled on the production branch, a database loss or a bad migration has no recovery path, and the launch would proceed on an unverified schema baseline.

**Why it cannot be settled from source.** The production database baseline was last verified at migrations 0000–0002; migrations 0003–0008 are pending verification and `/api/readyz` still reports 503 "Database is not ready" (`routes/health.ts:41`). No backup, point-in-time recovery or retention configuration exists anywhere in the repo (a repo-wide search finds only the privacy retention-policy feature, which is a different thing), and the preflight doc requires an established Neon recovery point before production changes (`docs/production-controlled-test-preflight.md:20`). Whether Neon backups / PITR are enabled on the production branch, and whether the database can be restored, is an owner-only fact checkable only in the Neon console.

**Blockers.**

- `deployment`: Neon console access is owner-only; backups/PITR status and the production branch's migration state are not visible from the repo.
- `data`: the three read-only Neon SQL Editor query results (migration history, public tables, columns for enquiries / enquiry_email_jobs / privacy_consent_events / audit_logs / users / auth_sessions) are still awaited from Aditi.

**Validation plan (deployment).**

1. In the Neon console, confirm backups / point-in-time recovery are enabled on the production branch and note the retention window.
2. Run the three read-only queries Aditi was asked to run in the Neon SQL Editor and compare the applied migrations against the journal (`lib/db/drizzle/meta/_journal.json`: 0000–0008 on main, 0009 only in PR #35, 0010 provisional).
3. Confirm `/api/readyz` returns 200 after the baseline is verified.

---

## N3 — No first-admin provisioning path

- **Fingerprint:** `first-admin-provisioning-missing`

**Claimed root cause.** The first admin can only be created by direct database access, with no reviewed procedure, no named operator and no audit trail for the bootstrap step.

**Why it cannot be settled from source.** No seed script, CLI, admin-creation endpoint or documented procedure exists in the repo for creating the first ADMIN user. Registration cannot create one (`REGISTRATION_PARTICIPANTS` excludes ADMIN, `role-policy.ts:1`, and a test asserts it, `role-policy.test.ts:10`), every admin route requires an existing ADMIN, and the only admin-creation evidence anywhere is a test fixture that inserts a user directly into the database. Registration is closed (`registration-release.ts:17`, release all-false, approvalId empty). The admin role is therefore unreachable by design until someone with database access creates the first admin manually, and no approved method or named person for that step exists. This is the Prompt H "first-admin gap" (rated HIGH there); it stays open because the decision is the owner's, not the code's.

**Blockers.**

- `owner_decision`: who the first admin is, and which provisioning method is approved (owner-run SQL, a reviewed one-off script, or a seed), is Aditi's decision and is not in the repo.
- `environment`: whether an admin already exists in production cannot be checked from source (and must not be probed from here).

**Validation plan (deployment).**

1. Aditi names the first admin and the approved provisioning method.
2. Provision the first admin through that reviewed method (never an unreviewed script against production), record the audit-log entry, and verify the admin can sign in and reach `/admin`.
3. Document the procedure in the repo so the next admin creation is repeatable.

---

## N4 — Production `CORS_ORIGINS` value is unknown

- **Fingerprint:** `cors-origins-production-value`

**Claimed root cause.** A misconfigured `CORS_ORIGINS` value in production (wildcard, attacker-controlled or stale preview origin) combined with `credentials: true` would allow cross-origin authenticated API calls.

**Why it cannot be settled from source.** The CORS configuration is fail-closed in code: origins come from the `CORS_ORIGINS` environment variable (`renova-app.ts:36`), `credentials: true` is set (`:44`), and an unset variable means `origin: false` (no cross-origin access at all, `:43`). That is the correct design, but the actual production value is deployment-only and is not in the repo.

**Blockers.**

- `environment`: the production `CORS_ORIGINS` value lives in the Vercel project settings and is not in the repo.

**Validation plan (deployment).**

1. In the Vercel dashboard for the api-server project, read `CORS_ORIGINS` and confirm it lists exactly `https://nirmaq.in` (and any explicitly approved preview origins) — no wildcard, no other domains.
2. Confirm the value after any preview deployment is added or removed.

---

## N5 — `trust proxy: 1` plus IP-keyed rate limits: X-Forwarded-For behaviour is unknown

- **Fingerprint:** `trust-proxy-xff-rate-limit-spoofing`

**Claimed root cause.** If the deployment appends client-supplied X-Forwarded-For values, `request.ip` is attacker-controlled and IP-keyed rate limits can be bypassed or weaponised against other users' IPs.

**Why it cannot be settled from source.** The app sets `trust proxy` to 1 (`renova-app.ts:15`), so Express takes the client IP from X-Forwarded-For. IP-keyed controls depend on that value: auth rate limits hash `ip|email` (`auth-rate-limit.ts:35-37`), the login IP bucket is ×10, and the enquiry fingerprint is SHA-256(ip|email) (`enquiries.ts:71`). Whether a client-supplied X-Forwarded-For is honoured depends on whether Vercel overwrites the header or appends to it, which is a deployment fact not in the repo. If Vercel appends, an attacker can bypass IP limits by rotating spoofed IPs and can poison a victim IP's bucket (a login denial-of-service for a shared or NAT IP). Account-keyed limits still bind in that case, which bounds the damage.

**Blockers.**

- `deployment`: whether Vercel overwrites or appends X-Forwarded-For for the api-server project is not in the repo and cannot be probed from here (no live-endpoint probing in this run).

**Validation plan (deployment).**

1. Check the Vercel documentation and the api-server deployment logs for how `req.ip` is derived under a client-supplied X-Forwarded-For (send a test request with a spoofed header to a non-production deployment and observe the logged IP).
2. If Vercel appends, set `trust proxy` to the value that matches the actual proxy count, or switch the rate-limit key to a server-derived value.

---

## N6 — API process model is unknown

- **Fingerprint:** `api-process-model-unknown`

**Claimed root cause.** The production process model is undocumented, so the availability impact of any process crash cannot be bounded from source.

**Why it cannot be settled from source.** The API server has no `vercel.json` in the repo, so its deployment shape is not in source: it is reached through a rewrite to `api-server-delta-teal.vercel.app` (`artifacts/renova/vercel.json:7`), which is consistent with a Vercel serverless function but is not proof of it. The distinction matters for the body-parser finding (CVE-2026-111181): on a long-lived host a single malicious request kills every in-flight request, while on a serverless function it kills only that invocation. The same distinction applies to any future uncaught-exception crash. The local entry point (`artifacts/api-server/server.mjs:1`) re-exports the built bundle and does not describe the production runtime.

**Blockers.**

- `deployment`: the api-server project's Vercel configuration (serverless function vs long-lived host) must be read from the Vercel dashboard.

**Validation plan (deployment).**

1. In the Vercel dashboard, confirm whether the api-server project deploys as serverless functions (and which runtime) or as a long-lived host.
2. Record the answer in the repo (or in the audit follow-up) so the body-parser finding's blast radius is stated correctly.

---

## N7 — A Replit autoscale deployment is configured, but it is unknown whether it is live

- **Fingerprint:** `replit-deployment-live-unknown`

**Claimed root cause.** An undocumented second deployment would be an unreviewed public surface with its own configuration, outside the Vercel-focused review in this audit.

**Why it cannot be settled from source.** The repo root contains a `.replit` file declaring `modules = ['nodejs-24']` (`:1`) and `deploymentTarget = 'autoscale'` (`:5`), with a post-merge hook that runs `pnpm install` (`scripts/post-merge.sh:1`). That means a Replit deployment of this repo may exist alongside the Vercel deployment. If it is live, it is a second public surface serving the same code with different configuration (different environment variables, different CORS origins, different Node patch version, and possibly a different database). Nothing in the repo says whether it is deployed, what URL it has, or what it serves.

**Blockers.**

- `deployment`: whether the Replit deployment is live, its URL, and what it serves are owner-only facts not in the repo.

**Validation plan (deployment).**

1. Aditi (or the operator) confirms whether the Replit deployment is live and, if so, its URL and what it serves.
2. If it is live, add it to the audit scope (or shut it down if it is not needed) and align its environment variables with production.
