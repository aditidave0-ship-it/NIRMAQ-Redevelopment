# Neon backup & recovery runbook — NIRMAQ

**Status: honest about what is verified vs `CAN'T TELL` vs blocked.**
No backup or recovery is configured anywhere in the repo, and no restore has
ever been tested. This runbook records that plainly, gives the operator the
exact steps to check and to rehearse a restore on a branch database only,
and names the owner step that blocks everything else. **Nothing in this
document writes to production, runs a migration, or restores production.**

- **Base:** main `aeb7aa8` · **Date:** 28 Nov 2026 · **Prompt H, Task 2 (Gap 1, HIGH)**

## 1. What backup / recovery exists today

### From the repo + hosting config: nothing verifiable

A repo-wide search for backup, PITR, point-in-time, restore and snapshot
configuration returns no backup feature at all:

- No backup script, no scheduled backup, no retention value, no restore
  procedure in code or config. The only hits are doc *expectations* ("verify
  Neon recovery/backup/restore-branch availability",
  `docs/migration-reconciliation.md:71`; "take provider snapshot/backup",
  `docs/domain-independent-milestone.md:15`) — expectations, not configured
  features.
- `lib/db/scripts/` holds exactly two operator scripts, both read-only or
  migration-only: `preflight-production.mjs` (read-only ledger + schema
  check, see §4) and `migrate-production.mjs` (applies the Drizzle journal;
  manual-only, never run by a build or deploy).
- `artifacts/renova/vercel.json` has rewrites only. No backup, retention or
  recovery setting exists in any Vercel config in the repo.

**Verdict: no backup/recovery is configured in the repo. Do not assert that
Neon point-in-time recovery (PITR) exists for this project.**

### From the Neon console: `CAN'T TELL` (blocked on the owner step)

Whether the Neon project has PITR, what its retention is, and whether a
restore has ever been tested cannot be established from code. It must be
checked in the Neon console, project `mute-waterfall-57186332`:

- **BLOCKED owner step:** the Neon console requests email verification to
  link the Vercel Marketplace identity before the backup/recovery state can
  even be checked. Until Aditi completes that verification, no one can
  verify a backup exists or rehearse a restore through the console.
- Where to check once unblocked: Neon console → project → Settings /
  Backups (or the project's plan page) — record the plan, whether PITR is
  enabled, and the retention window. Do not guess the plan or the retention
  from memory: Neon plan features change, and the Free tier historically
  has no PITR.

### Production database baseline: verified, but the live API is not reading it

The baseline stated in Prompt H (26 Nov 2026 — `0000`–`0002` verified,
`0003`–`0008` pending, `/api/readyz` 503) is superseded by the production
run on 28 Nov 2026:

- **Production migration ran 28 Nov 2026 ~13:17 IST** (the same file
  rehearsed on the test branch) and **production verification PASSED
  13:22–13:25 IST**: 9 journal rows, 31 tables, 61 rows across the 6 key
  tables. The production database now has the full schema.
- **But `/api/readyz` is still 503 at ~13:25 IST** (live check, verified
  twice; `healthz` 200). All 25 readyz (table, column) pairs exist in the
  migrated database (verified locally against the migration file), so the
  mismatch is the **connection, not the schema**: the live API
  (`api-server-delta-teal.vercel.app`, a separate Vercel project) is
  evidently not querying this database — its `DATABASE_URL` points
  elsewhere.
- **Next step (operator, eyes only, never paste either value):** compare
  the Neon production Connect host against the Vercel api-server
  `DATABASE_URL` host. Until that is fixed, enquiries will NOT work and
  readyz will NOT be 200, regardless of the database state.

This runbook does **not** assert the live API's connection outcome. The
read-only preflight (§4) is the tool that settles the database side.

## 2. How a backup is taken

Neon does not have a "take a backup now" button like a traditional database.
There are three mechanisms; only the third is available before the owner
step is cleared.

### (a) Neon branch as a snapshot copy — available now

A Neon branch is a copy of the database at a point in time. It is **not** a
backup with retention — branches auto-delete (the rehearsal branches use
7 days) and a branch is not a restore point. But it is the protective step
available today, and it is what the migration rehearsals already use:

1. Neon console → Branches → New Branch → parent `production` → name
   `snapshot-YYYYMMDD` → type "Branch data and schema" → auto-delete 7 days.
2. Record the branch name and date in the run log (§6). Do not rely on it
   past its auto-delete date.

### (b) Point-in-time recovery (PITR) — `CAN'T TELL`, owner step required

If the project plan includes PITR, a restore goes to a **new branch**, never
in place: Neon console → Restore → pick a point in time → restores into a
new branch → verify that branch (§5). Whether PITR exists for this project
is unknown until the owner step in §1 is cleared. **Do not assert PITR
exists.**

### (c) Logical dump with `pg_dump` — available now, operator-held

The one backup the operator can take without Neon console access. The
operator supplies the connection string from the Neon console; it is never
pasted in chat, never committed, never printed in logs.

```sh
# From the operator's machine, with the production pooled connection string
# in DATABASE_URL_UNPOOLED (from the Neon console — never in chat).
pg_dump "$DATABASE_URL_UNPOOLED" --format=custom --no-owner --no-privileges \
  --file="nirmaq-production-YYYYMMDD.dump"
```

- Store the dump file securely (operator's machine or the team's private
  storage). Never commit it to git, never put it in the repo, never share
  it in chat.
- Record the dump date, size and SHA-256 in the run log (§6).
- A dump restores with `pg_restore` into an **empty branch database only**
  (see §5). Restoring a dump over production is never done by this runbook.

## 3. How a restore is rehearsed (branch database only, never production)

A restore rehearsal proves a backup can actually come back. It is always
done on a throwaway branch, never on `production`, and only after a snapshot
(§2a) plus Aditi's explicit "go" for that step.

### Rehearsal A — restore a dump into a fresh branch (prepared, not run)

```sh
# 1. Create an empty branch from production in the Neon console
#    (name: restore-rehearsal-YYYYMMDD, auto-delete 7 days).
# 2. Restore the dump into that branch (operator supplies the branch URL):
pg_restore -d "$BRANCH_DATABASE_URL" --no-owner --no-privileges \
  "nirmaq-production-YYYYMMDD.dump"
# 3. Verify the branch (§5). 4. Delete the branch when done.
```

### Rehearsal B — PITR restore into a new branch (only if PITR exists)

1. Neon console → Restore → pick a point in time → restore into a new
   branch named `restore-rehearsal-YYYYMMDD`.
2. Verify the branch (§5). 3. Delete the branch when done.

### Rehearsal C — preflight-only check (no restore, runs today)

The preflight (§4) proves the *schema* on any database is exactly the
reviewed journal. It does not prove a backup exists, but it is the
verification step every rehearsal ends with.

### What the operator must provide (if a rehearsal cannot be prepared)

If a rehearsal cannot be prepared without a production connection, the
operator must supply, in the Neon console (never in chat): the branch
connection string, the dump file (or its secure location), and Aditi's
explicit "go" for that rehearsal step. Without those three, the rehearsal
stays unprepared — it is not improvised.

## 4. The read-only preflight (the verification tool)

`lib/db/scripts/preflight-production.mjs` — read-only, no writes, no
migrations. It opens a single read-only transaction, rolls it back, and
compares the live migration ledger and schema columns against the reviewed
journal (`lib/db/drizzle/meta/_journal.json`, 9 entries `0000`–`0008`).

```sh
# From lib/db, with the target database URL in the environment.
# The URL is never printed: on failure the script withholds the underlying error.
DATABASE_URL_UNPOOLED="<target database URL>" node ./scripts/preflight-production.mjs
```

- Exit `0` + `"status": "READY"` — the database matches the reviewed
  journal exactly (9 ledger rows, all required columns present).
- Exit `2` + `"status": "BLOCKED_PENDING_MIGRATIONS"` — migrations are
  missing; do not proceed.
- Exit `2` + `"status": "BLOCKED_SCHEMA_DRIFT"` — the ledger or schema
  differs from the journal; stop and report.
- Exit `1` — the check itself failed (connection or config); details are
  withheld to protect credentials.

The same script has a test: `pnpm --filter @workspace/db run preflight:test`
(`node --test ./scripts/preflight-production.test.mjs`).

## 5. How to verify a restore worked

A restore counts as **tested** only when all of these pass on the rehearsed
branch:

1. **Preflight READY** — run §4 against the branch; status must be `READY`.
2. **The three Neon checks** (same as the migration verification, run in the
   branch's SQL Editor):
   - `SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY
     created_at ASC;` → 9 rows.
   - `SELECT table_name FROM information_schema.tables WHERE table_schema =
     'public' ORDER BY table_name;` → the 30 app tables (plus the
     `playing_with_neon` demo table on a production copy = 31).
   - The six key tables (`enquiries`, `enquiry_email_jobs`,
     `privacy_consent_events`, `audit_logs`, `users`, `auth_sessions`)
     present with their columns.
3. **Spot-check the data that matters:** the most recent enquiry rows and
   the admin-visible counts are present on the branch (read-only `SELECT
   count(*)` — never write to the branch to "test" it).
4. **Record the result** in the run log (§6): branch name, date, method
   (dump / PITR / branch copy), preflight status, check results, and who
   ran it. Then delete the rehearsal branch.

Note: `https://nirmaq.in/api/readyz` checks the *production* database, so
it cannot verify a rehearsal branch. For a branch, the preflight + the
three checks are the verification. A local API run pointed at the branch
is an optional extra, only with Aditi's go.

## 6. Who checks it, how often, what "tested" means (Task 7.4)

**Recommendation for Aditi to approve — not yet decided:**

- **Daily-backup expectation:** a usable backup must exist for every day
  the site accepts enquiries. Until PITR is confirmed, that means a daily
  branch snapshot (§2a) and/or a daily `pg_dump` (§2c), recorded in the
  run log.
- **Who checks it:** the operator (Aditi, or the person she names — no
  name is invented here). The check is: "does a backup from the last 24
  hours exist, and is it recorded in the run log?"
- **How often:** the backup-exists check is weekly at minimum (daily
  while the site is being launched); a full restore rehearsal (§3) is
  monthly, and before any production migration.
- **What "tested" means:** a restore is "tested" only when §5 passes in
  full on a rehearsal branch and the result is recorded. A backup that has
  never been restored is *unverified*, not *tested* — the two words are
  not interchangeable in this runbook.
- **Run log:** keep a dated log (branch/dump name, date, method, preflight
  result, who ran it) in the goal workspace. This runbook does not create
  the log; the operator starts it at the first rehearsal.

**Blocked on the owner step:** none of the above can be verified until the
Neon console email verification (§1) is done. The runbook is written; the
verification is not.

## 7. What this runbook does NOT do

- No production database write, no migration, no restore against
  production.
- No backup is taken by this PR and no restore is rehearsed by this PR.
- No Neon plan, PITR availability or retention is asserted — all of it is
  `CAN'T TELL` until the owner step is cleared.
- Do not disconnect/reconnect the Neon–Vercel integration to "fix" backup
  access: it could rotate the environment variables and break production.
