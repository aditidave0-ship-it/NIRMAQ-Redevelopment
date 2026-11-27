# Findings detail — Prompt J, Run 1 (main `aeb7aa8`)

Complete trace and reproduction for every confirmed medium (and high/critical — there are none above medium). The five lows and the informational finding are given in condensed form; every record is fully specified in `findings.json` (validator: PASS, 35 findings).

**Honesty note for all reproductions below:** no target code was executed in this run — this environment has no OS-enforced sandbox. Reproductions are written for a local instance built from this exact commit in an isolated environment, never against production. Where a result could not be observed locally, that is stated in the record.

---

## F1 — body-parser 2.3.0, CVE-2026-111181: one unauthenticated request crashes the API process

- **Severity:** medium (likelihood high, impact medium — see below) · **Confidence:** medium · **Fingerprint:** `body-parser-cve-2026-111181-dos`
- **Vendor:** CVE-2026-111181, CVSS 7.5 HIGH, GHSA-27r3-jxmh-p828, disclosed 22 Oct 2026, fixed in body-parser 2.4.0 / 1.20.9. Official Express advisory fetched 28 Nov 2026 (expressjs.com/en/blog/2026-10-28-cve-2026-111181/).

### Root cause

`body-parser` 2.3.0 contains a decompression-stream lifetime bug: after the first gzip member ends, `raw-body` detaches its error listener and `body-parser` calls `next()` while the request is still piped into the decoder. Trailing bytes then raise an error with no listener, which Node turns into an uncaught exception and the process exits. The app enables the vulnerable path by mounting the parsers globally with the default `inflate: true`.

### Intended behaviour

A malformed body produces a 400 response, never an uncaught exception or a process exit.

### Trace

| Step | Location | What happens |
|---|---|---|
| Entrypoint | `artifacts/api-server/src/routes/enquiries.ts:90` | `POST /enquiries` is reachable without any authentication and passes through the global parsers first. |
| Propagation | `artifacts/api-server/src/renova-app.ts:49` | `express.json({ limit: "256kb", strict: true })` mounted globally with default `inflate: true` (no `inflate: false`). `express.raw()` (webhook, :48) and `express.urlencoded()` (:50) are the same. |
| Sink | `pnpm-lock.yaml:4854` | `express@5.2.1` depends on `body-parser: 2.3.0`, inside the vulnerable range 2.0.0–2.3.0 (fixed in 2.4.0). The installed version is 2.3.0 (`node_modules/.pnpm/body-parser@2.3.0`). |

### Evidence

- `pnpm-lock.yaml:1800` — `body-parser@2.3.0` is the pinned version.
- `pnpm-lock.yaml:4854` — Express 5.2.1 resolves that vulnerable version.
- `renova-app.ts:48-50` — all three parsers mounted globally, default inflate.
- `routes/enquiries.ts:90` — unauthenticated `POST /enquiries` passes through the parsers.

### Conditions

- Request decompression is enabled (default `inflate: true`).
- `body-parser` 2.3.0 is the resolved version.
- No authentication is required: the parser runs before every route, including unauthenticated ones.

### Reproduction (against a local instance only, never production)

Attacker perspective: no account, no session and no valid route are needed. A single HTTP POST to any `/api` path with `Content-Type: application/json` and `Content-Encoding: gzip`, whose body is a valid gzip member for `{}` followed by a zero byte and trailing filler, crashes the API process.

Payload (the shape from the official Express advisory): gzip-compressed `{}` + `0x00` + 100 KiB of filler bytes, sent as the request body with `Content-Encoding: gzip`.

Steps:

1. Build a local instance from this exact commit in an isolated environment (never against production).
2. Send one POST to `/api/enquiries` (or any `/api` path) with `Content-Type: application/json`, `Content-Encoding: gzip`, and the payload above.
3. Observe the process: the request is answered normally, then the process exits with an uncaught exception once the trailing bytes reach the decoder.
4. Repeat against a second instance after upgrading body-parser to ≥ 2.4.0 (or setting `inflate: false`): the process stays alive and the request is rejected or parsed normally.

Observed result: **not reproduced by local execution in this run** (no OS-enforced sandbox was available). Established by the official Express advisory, which documents the single-request crash for a standard Express 5 application with body-parser 2.3.0, combined with the exact version match and the global default-inflate mounting verified in source. Confidence is medium for this reason.

Note on the 256 kb limit: the parsers carry `limit: "256kb"`, which does **not** mitigate this — the advisory's proof-of-concept body is about 100 kb.

### Severity reasoning

Likelihood high: trivially exploitable by any unauthenticated remote client; the payload shape is published in the vendor advisory. Impact medium: a process crash is an availability failure whose blast radius is bounded by the deployment model — on a long-lived host it kills all in-flight requests; on a Vercel serverless function it kills only that invocation (and consumes an invocation). The production process model is not in the repo, so impact is scored conservatively at 3, not higher. See needs-validation record `api-process-model-unknown`.

### Fix

Upgrade body-parser to ≥ 2.4.0 (bump via the Express 5 line or a direct override) and re-pin the lockfile; re-run the advisory's reproduction against a local instance to confirm the process survives. Alternative mitigation if compressed bodies are not needed: set `inflate: false` on `express.json()` and `express.urlencoded()` so encoded requests are rejected before a decompression stream is created.

---

## F2 — Unauthenticated legacy demo API

- **Severity:** medium (likelihood high, impact medium) · **Confidence:** high · **Fingerprint:** `legacy-demo-api-unauthenticated`

### Root cause

The legacy demo router (`artifacts/api-server/src/routes/renova.ts`) was written as a static prototype and was mounted under `/api` without any `requireAuth()` middleware, and the frontend workspace still consumes it as live data.

### Intended behaviour

Demo or prototype data must be clearly separated from production data, must not be writable by anonymous clients, and must not be presented to visitors as a real society's workspace. If demo content is kept, it is read-only and labelled as demo.

### Trace

| Step | Location | What happens |
|---|---|---|
| Entrypoint | `artifacts/api-server/src/routes/index.ts:17` | `renovaRouter` is mounted under `/api` with no authentication middleware. |
| Propagation | `artifacts/api-server/src/routes/renova.ts:83` | `POST /projects` appends the request body to the in-memory projects array with no auth, no rate limit and no size bound. |
| Sink | `artifacts/renova/src/App.tsx:600` | The workspace Overview renders the demo data (`useGetDashboard`) as a real society workspace, so injected content is shown to every visitor. |

### Evidence

- `renova.ts:70` — `GET /dashboard`, no auth. `:81` — `GET /projects`. `:83` — `POST /projects` appends to the in-memory array. `:103` — `GET /projects/:id`. `:110` — `GET /professionals`. `:116` — `GET /regulations`.
- `routes/index.ts:17` — demo router mounted under `/api` without auth.
- `renova-app.ts:53` — all routes live under `/api`.
- `App.tsx:600` — Overview consumes the demo endpoint as live workspace data.

### Conditions

- No authentication: the endpoints are reachable by any anonymous client.
- The demo arrays are process-lifetime in-memory state, so injected rows persist for the life of the process and are served to every visitor.

### Reproduction (against a local instance only, never production)

Attacker perspective: no account is needed. POST `/api/projects` with an arbitrary project object, then open `/workspace` as any visitor: the injected project appears in the workspace Overview alongside the demo society.

Payload: `{"name": "Attacker Society CHS", "location": "Mumbai", "readiness": 99, "stage": "Live"}` posted to `/api/projects`.

Steps:

1. Build a local instance from this exact commit in an isolated environment (never against production).
2. POST the payload to `/api/projects` with no credentials; expect a 2xx response and the project echoed back.
3. GET `/api/projects` with no credentials; expect the injected project in the list.
4. Open the workspace Overview page in a browser against the same local instance; expect the injected project to be rendered.

Observed result: **not executed against a running instance in this run** (no OS-enforced sandbox). Established from source: the routes carry no auth middleware, the POST handler appends to a module-level array, and the frontend Overview renders that endpoint's data. The existence of the unauthenticated write path is unambiguous in source, so confidence is high; the rendering step was not clicked through locally.

### Severity reasoning

Likelihood high: trivially reachable — no auth, no rate limit, and the endpoints are called by the shipped frontend so their paths are public knowledge. Impact medium: anonymous content injection shown to all visitors as a real society workspace, plus unbounded in-memory growth in a long-lived process. No real user data is exposed (the data is fictional) and no script execution is possible (React escapes it), so impact is medium, not high.

### Fix

Delete the legacy demo router from the `/api` mount, or move it behind `requireAuth()` + `requireRole('ADMIN')` and remove `POST /projects`. Replace the workspace Overview's demo data source with the real DB-backed workspace (or clearly label it as a demo preview that is not writable). Add a regression test asserting `GET /api/dashboard` and `POST /api/projects` return 401 without a session.

---

## Lows and informational (condensed)

### F3 — No security headers (low) · `missing-security-headers`

No CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy on either host. `artifacts/renova/vercel.json` has rewrites only (no `headers` section); the API sets only `Cache-Control: no-store` (`renova-app.ts:55`); `index.html` has no CSP meta tag. A repo-wide grep for all six header names returns zero hits. Impact: the login and workspace pages can be framed (clickjacking — needs a victim to interact with an attacker page), and there is no CSP backstop if any XSS ever appears. Fix: add a `headers` section to `vercel.json` and the same headers in the Express app (helmet or manual middleware), plus a regression test.

### F4 — `GET /billing/products` leaks `approvalReference` (low) · `sandbox-products-approval-reference-disclosure`

`GET /billing/products` (`sandbox-billing.ts:65`) lets any authenticated SOCIETY user list products, and the handler calls `.select()` with no column list (`:73`), so every column is returned — including `approvalReference`, a not-null internal field (`lib/db/src/schema/index.ts:665`). Non-secret internal disclosure. Fix: replace `.select()` with an explicit column list (code, name, amountMinor, currency, active) and add a regression test asserting the field is absent.

### F5 — Enquiry rate limit defeated by IP+email rotation (low) · `enquiry-rate-limit-ip-rotation`

`POST /enquiries` (`enquiries.ts:90`) is unauthenticated and has no global rate limit. Its only control is a fingerprint — SHA-256 of IP + email (`:71`) — capped at 5 accepted enquiries per hour (`:109`). Both inputs are attacker-controlled, so rotating IP (proxies/VPNs) and email defeats the cap entirely. Every accepted enquiry creates two Resend email jobs (acknowledgement + admin notification) and a DB row, so an attacker can drive unbounded email-provider spend, flood the admin inbox and grow the enquiries table. The handler also awaits the email-send attempt in the request (`:162`, up to 10 s per send — `email.ts:197`), so slow sends extend each request. Fix: a global per-endpoint rate limit keyed to a server-side counter, consider a CAPTCHA before launch, and move email dispatch fully out of the request path.

### F6 — No quota on feasibility requests or uploads (low) · `feasibility-no-upload-quota`

`POST /feasibility` (`feasibility.ts:251`) and `POST /feasibility/:id/documents` (`:446`) enforce no per-user, per-request or per-society quota: no limit on the number of requests, no limit on documents per request, no total storage cap. Only the per-file 10 MB cap exists (`:105`). An authenticated society user can drive unbounded private Blob storage cost. The file-content checks themselves are sound (allowlist + magic bytes + private bucket + `attachment` disposition). Fix: cap requests per society and documents/total size per request; return 429 when exceeded; add a Blob-store alert at a threshold. (Registration is currently closed, which bounds the principal set today.)

### F7 — Consent withdrawal has no API (low) · `consent-withdrawal-no-endpoint`

The consent ledger type is `"GIVEN" | "WITHDRAWN"` (`consent-policy.ts:14`) and the Phase B design doc states consent is "withdrawable" by design (`docs/phase-b-privacy-design.md:169`), but no route writes a WITHDRAWN event and no endpoint lets a user withdraw consent — a grep for WITHDRAWN finds only the type definition and opportunity-interest withdrawal (a different concept). Withdrawal today is manual-only, via a privacy request handled by an admin. Fix: add `POST /privacy/consent/withdraw` (authenticated or verified-email) that appends a WITHDRAWN consent event, surface it in the privacy page, and describe it in the (draft) privacy policy.

### F8 — `.gitignore` does not ignore `.env` (informational) · `gitignore-missing-dotenv`

`.gitignore` has no `.env` entry. No `.env` file exists and history is clean, so nothing has leaked; the risk is purely prospective — a developer adding a `.env` (which the codebase expects for `DATABASE_URL`, `RESEND_API_KEY` and the auth token secret) could commit it by accident. Fix: one line — `.env*` in `.gitignore`.
