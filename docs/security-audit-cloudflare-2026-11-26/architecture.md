# Architecture — NIRMAQ (main `aeb7aa8`, Prompt J Run 1)

## Product, principals, protected resources

NIRMAQ is a Mumbai housing-society redevelopment platform: societies post
redevelopment opportunities, developers/PMCs/professionals express interest,
the NIRMAQ team assesses feasibility, and enquiries flow to an admin. The
public site is a React + Vite SPA (`artifacts/renova`, served from Vercel at
nirmaq.in, `/api/*` rewritten to a separate Vercel app hosting the Express
API). The API (`artifacts/api-server`, Express 5 + Drizzle + PostgreSQL on
Neon) holds the trust-sensitive state: user accounts, sessions, enquiries,
feasibility requests and documents (Vercel Blob, private), opportunities and
interests, privacy requests, and sandbox-only payment orders. Principals, by
rising trust: anonymous visitor (public pages, unauthenticated enquiry
submit); authenticated SOCIETY / DEVELOPER / PMC / PROFESSIONAL (own
organisation only); ADMIN (all enquiries, privacy queue, feasibility,
retention). Registration is closed by a reviewed release gate
(`registration-release.ts`, all checks false) and by a frontend flag; the only
other admission is a test-token header for controlled staging.

## Stack and deployment paths

TypeScript throughout; pnpm workspace (`artifacts/*`, `lib/*`); Zod schemas
in `lib/api-zod`; Drizzle schema in `lib/db` with migrations `0000`–`0008`
on main (`0009` lives in unmerged PR #35; `0010` Phase B is provisional).
Build: `pnpm run build` (typecheck + per-package builds); API bundled with
esbuild (`build.mjs`, side-effect-free by design). Tests run on Node with
`tsx --test` plus PGlite integration suites. No `engines` pin and no Node
version in any Vercel config: the production runtime version is not
source-visible. The API has no `vercel.json` of its own in the repo; its
Vercel project settings live outside the repo. Offline build/test limits:
no sandbox exists in this environment, so no target code was executed in
this run.

## Entry surfaces and source-to-sink paths

HTTP JSON API under `/api` (auth, enquiries, opportunities, profiles,
feasibility incl. raw document upload, privacy, workspace metrics, sandbox
billing + Razorpay webhook, admin email jobs, health); browser SPA routes
(public marketing/feasibility pages, `/platform/live` workspace); email
outbound via Resend (OTP, reset, enquiry ack/admin, privacy verification);
Vercel Blob for feasibility documents; Razorpay sandbox API for orders.
Input flows: unauthenticated `POST /enquiries` → Zod → fingerprint dedup
(advisory lock, 5/hour) → enquiry + consent event + two email jobs in one
transaction; authenticated opportunity/interest/feasibility flows → Zod →
org-scoped Drizzle queries → audit log. Auth flows: register → HMAC-bound
6-digit OTP (10 min, 5 attempts, single-use) → scrypt password, server-side
httpOnly session (14 days, `credentialVersion` invalidation), password
reset via SHA-256-hashed single-use token (1 hour). Privacy flows: request
→ email-token verification (1 hour, 5 attempts) → admin queue with
state-machine transitions and legal/financial/security holds; fulfilment is
a recorded admin decision, never automated deletion.

## Trust boundaries and strongest source-visible controls

- **Anonymous → authenticated:** `requireAuth()` + `readSession()` (token
  hash, expiry, `isActive`, `emailVerifiedAt`, `credentialVersion`).
- **Role → resource:** `requireRole()` on every `/admin/*` route;
  registration cannot yield ADMIN (`role-policy.ts`); ownership is always
  re-derived from the session org id in SQL joins (404 on mismatch, no
  existence oracle).
- **Anonymous → email/money:** per-account + per-IP rate limits on auth
  and privacy endpoints; enquiry fingerprint dedup; webhook HMAC +
  provider re-fetch + amount match; sandbox-only payments
  (`sandboxPaymentConfig` refuses production and non-test keys).
- **Browser → server:** SameSite=Lax session cookie is the only CSRF
  control (no token, no Origin check); CORS allowlist comes from
  `CORS_ORIGINS` env, credentials allowed.
- **Stored data:** passwords scrypt + 16-byte salt; OTP/reset/privacy
  tokens SHA-256-hashed; consent events append-only in the enquiry
  transaction; documents magic-byte-checked, 10 MB cap, private blob,
  `attachment` download.

## Starting paths

`artifacts/api-server/src/renova-app.ts`, `src/routes/`,
`src/lib/session.ts`, `src/lib/auth-tokens.ts`, `src/lib/auth-rate-limit.ts`,
`src/lib/privacy-policy.ts`, `src/lib/consent-policy.ts`,
`artifacts/renova/src/App.tsx`, `src/experience/`, `src/platform/`,
`lib/db/src/schema/index.ts`, `lib/db/drizzle/`, `pnpm-lock.yaml`,
`artifacts/renova/vercel.json`, `.gitignore`.

## Prior coverage gaps and revalidation targets

No prior skill ledger exists. Prompt H's prose verdicts (main `d8a3049`)
are revalidated here as candidates: admin gating, no-admin registration,
sandbox-only payments, scrypt passwords, Zod + Drizzle, the two low minors
(`ilike` wildcards, no global rate limit), the backup gap, the first-admin
gap, the legacy demo API, plus the 15-attack gist check. New since `d8a3049`:
the Phase 1 frontend (`GetStarted`, `FeasibilityCheck` teaser, `Header`,
`Home`, `App` routing, `page-meta`, `sitemap.xml`) and the
`/feasibility-dashboard` page, all inside this run's coverage.

## Companion selection

Selected because recon found the boundary each describes: WEB-PROTOCOL-AND-
AUTH (sessions, OTP, reset, webhook, CORS/headers); CLIENT-SIDE (SPA
rendering, localStorage drafts, `_blank` links, routing); DATA-ISOLATION-
AND-LIFECYCLE (org isolation, consent ledger, retention, backup/migration);
CLOUD-AND-DEPLOYMENT (Vercel rewrites, trust proxy, secrets, Node runtime);
SUPPLY-CHAIN-AND-RELEASE (pinned deps, lockfile, `minimumReleaseAge`);
RESOURCE-EXHAUSTION-AND-AVAILABILITY (rate limits, uploads, enquiry spam).
Excluded with reasons (also per ledger unit): MEMORY-SAFETY-AND-BINARY
(JavaScript target, no native code/FFI/binary parsers); AI-AND-LLM (no AI
features or model calls); DESKTOP-MOBILE-AND-LOCAL-IPC (no native app or
local IPC); PROTOCOLS-RPC-AND-MESSAGING (no gRPC/brokers/queues; the one
webhook is plain HTTPS, covered by WEB-PROTOCOL-AND-AUTH).
