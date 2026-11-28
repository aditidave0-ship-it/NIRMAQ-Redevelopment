# First-admin provisioning — NIRMAQ

**Status: script + tests are in this PR. No admin account is created by
this PR.** The first Admin is created only by the operator, once, on Aditi's
explicit "go" for that concrete step, against the fully migrated database.

- **Base:** main `aeb7aa8` · **Date:** 28 Nov 2026 · **Prompt H, Task 3 (HIGH)**

## Who the first admin is for

The first Admin account belongs to the NIRMAQ team — Aditi or Aziz, as Aditi
decides. **No name or email is invented here.** Aditi supplies the email
address and chooses the password; the operator runs the script with them.
Until she names the person and the email, there is no first admin, and the
admin-only routes have no user.

## Why a script, not registration

Registration **cannot** create an Admin, by code and by test:

- `artifacts/api-server/src/routes/auth.ts` — `registrationSchema` lists
  only `email`, `password`, `displayName`, `participantType`,
  `organizationName`, `ageAttestation`. There is no `role` field and no
  `...req.body` spread anywhere in the auth or profile routes, so a
  `role: "ADMIN"` in the request body is stripped by Zod before it is read.
- `artifacts/api-server/src/lib/role-policy.ts` —
  `registrationIdentity(participantType)` derives the role server-side;
  `REGISTRATION_PARTICIPANTS = ["SOCIETY", "DEVELOPER", "PMC",
  "PROFESSIONAL"]` — ADMIN is not a registrable participant.
- Profile updates cannot promote either: `PUT /profiles/me`
  (`artifacts/api-server/src/routes/profiles.ts`) takes the role from the
  session (`request.auth.role`) and the update schemas have no role field.
- **Tests (this PR):**
  - `artifacts/api-server/tests/auth-delivery.ts` — registers a SOCIETY
    with `role: "ADMIN"` and `isAdmin: true` in the body; the created user
    is a SOCIETY, and logging in returns role `SOCIETY`.
  - `artifacts/api-server/tests/security.integration.ts` — a SOCIETY
    `PUT /profiles/me` with `role: "ADMIN"` and `isAdmin: true`; the user
    row still reads `SOCIETY`.
  - `lib/db/scripts/provision-first-admin.test.mjs` — the script itself.

Because registration can never create an Admin, the first Admin has to be
created by an operator. That is what the script does, once.

## The script

`lib/db/scripts/provision-first-admin.mjs` — operator CLI, self-contained
(`pg` Pool + `node:crypto` scrypt). It is not run by any build, deploy or
test.

### What it does

1. Reads `DATABASE_URL_UNPOOLED` (from the Neon console; never in chat),
   `RENOVA_FIRST_ADMIN_EMAIL`, `RENOVA_FIRST_ADMIN_PASSWORD`,
   `RENOVA_FIRST_ADMIN_DISPLAY_NAME` (optional, default `"NIRMAQ Admin"`).
2. Refuses unless `RENOVA_PROVISION_FIRST_ADMIN=confirm`.
3. In one transaction: refuses if any `ADMIN` user already exists (so it
   can only ever run once); refuses if the email is already taken; inserts
   the user (`role 'ADMIN'`, `is_active true`, `email_verified_at now()`,
   `credential_version 0`, scrypt hash with pinned parameters
   N=16384, r=8, p=1, 64-byte key — identical to
   `artifacts/api-server/src/lib/session.ts`); inserts an `audit_logs` row
   (`FIRST_ADMIN_PROVISIONED`, entity `USER`, actor = the new user).
4. Prints only the email and the new user id. **Never prints the password
   or the connection string.**

### Password rules

- The provisioned Admin password must be **at least 12 characters**. This
  is the script's own floor for the single most powerful account; it does
  **not** change the registration password floor (8 characters — see Task
  7.2 in `docs/security-fixes-audit-2026-11-26.md`, where a higher floor is
  a recommendation for Aditi, not a silent change).
- The email is lowercased before insert, matching registration.
- `email_verified_at` is set to now() because the operator supplies the
  address out-of-band and verifies it with the person directly. There is
  no email-verification bypass in the application: this is the operator
  creating the account, not a user self-registering.

## Exact steps (operator, once, on Aditi's go)

Preconditions — all must hold before running:

1. The production database is fully migrated and the read-only preflight
   is `READY` (`node ./scripts/preflight-production.mjs` from `lib/db` —
   see `docs/backup-recovery-runbook-2026-11-26.md` §4). The script
   inserts `credential_version`, which only exists after migration 0007.
2. Aditi has named the first admin's email and chosen a password of at
   least 12 characters (supplied out-of-band, never in chat).
3. Aditi has given an explicit "go" for this concrete step.

Run (from the operator's machine, in the repo checkout):

```sh
cd lib/db
RENOVA_PROVISION_FIRST_ADMIN=confirm \
RENOVA_FIRST_ADMIN_EMAIL='<the email Aditi named>' \
RENOVA_FIRST_ADMIN_PASSWORD='<at least 12 characters>' \
RENOVA_FIRST_ADMIN_DISPLAY_NAME='NIRMAQ Admin' \
DATABASE_URL_UNPOOLED='<from the Neon console — never in chat>' \
node ./scripts/provision-first-admin.mjs
```

Expected output: `First admin provisioned: <email> (id <uuid>)`.

Then verify (read-only, Neon SQL Editor on the production branch):

```sql
SELECT email, role, is_active, email_verified_at
FROM users WHERE role = 'ADMIN';
-- expected: exactly 1 row, the email above

SELECT action, entity_type, created_at
FROM audit_logs WHERE action = 'FIRST_ADMIN_PROVISIONED';
-- expected: exactly 1 row
```

Then the Admin logs in at `https://nirmaq.in` with that email and password
and changes the password on first use. If the login fails, the account is
not manually "verified" in the database — report the failure and
investigate; never edit the user row by hand.

## Refusals (all by design)

- `RENOVA_PROVISION_FIRST_ADMIN` is not `confirm` → refuses.
- `DATABASE_URL_UNPOOLED` missing → refuses.
- An `ADMIN` already exists → refuses ("An admin account already exists").
  Re-running the script after a successful provisioning is therefore safe:
  it changes nothing.
- Email already taken (any role, case-insensitive) → refuses.
- Password under 12 characters, invalid email, display name under 2 or
  over 160 characters → refuses, creating nothing.

## Tests

`lib/db/scripts/provision-first-admin.test.mjs` — run with
`pnpm --filter @workspace/db run provision:test` (or
`node --test ./scripts/provision-first-admin.test.mjs` from `lib/db`).
PGlite, real migrations (journal `0000`–`0008` + provisional `0010`).
3 tests: hash format + verification; provision + audit row + second-run
refusal; duplicate email / invalid input refusals with nothing created.

## What is NOT done by this PR

- No admin account is created. No production database is touched.
- The first admin's name and email are still Aditi's to supply.
- There is no "make me admin" button, endpoint or self-service path, and
  none is added by this PR.
