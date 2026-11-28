// First-admin provisioning — Prompt H, Task 3.
//
// Operator-only script. It creates the FIRST (and only) Admin account on a
// fully migrated database. It is NOT run by any build, deploy or test, and
// it never runs against production without the owner's explicit "go" for
// that concrete step.
//
// Why a script and not registration: registration can never create an Admin
// (registrationSchema has no role field; registrationIdentity() derives the
// role server-side and REGISTRATION_PARTICIPANTS excludes ADMIN — see
// docs/security-fixes-audit-2026-11-26.md and the test in
// artifacts/api-server/tests/auth-delivery.ts). The first Admin therefore
// has to be created by an operator, once, with the credentials supplied
// out-of-band. After that, this script refuses to run again.
//
// Usage (operator's machine, connection string from the Neon console):
//   RENOVA_PROVISION_FIRST_ADMIN=confirm \
//   RENOVA_FIRST_ADMIN_EMAIL=admin@example.invalid \
//   RENOVA_FIRST_ADMIN_PASSWORD='<at least 12 characters>' \
//   RENOVA_FIRST_ADMIN_DISPLAY_NAME='NIRMAQ Admin' \
//   DATABASE_URL_UNPOOLED='<from the Neon console — never in chat>' \
//   node ./scripts/provision-first-admin.mjs
//
// The script never prints the password or the connection string. On success
// it prints only the email and the new user id.
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

// Pinned scrypt parameters — identical to artifacts/api-server/src/lib/session.ts
// (hashPassword). Pinning them here keeps the stored hash verifiable by the
// login code even if Node's defaults ever change.
export const ADMIN_PASSWORD_SCRYPT = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
  keyLength: 64,
});

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export function hashAdminPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, ADMIN_PASSWORD_SCRYPT.keyLength, {
    N: ADMIN_PASSWORD_SCRYPT.N,
    r: ADMIN_PASSWORD_SCRYPT.r,
    p: ADMIN_PASSWORD_SCRYPT.p,
    maxmem: ADMIN_PASSWORD_SCRYPT.maxmem,
  });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function validateInput({ email, password, displayName }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedEmail.length > 320
  )
    throw new Error("RENOVA_FIRST_ADMIN_EMAIL must be a valid email address");
  if (
    typeof password !== "string" ||
    password.length < ADMIN_PASSWORD_MIN_LENGTH
  )
    throw new Error(
      `RENOVA_FIRST_ADMIN_PASSWORD must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`,
    );
  const name = String(displayName ?? "").trim();
  if (name.length < 2 || name.length > 160)
    throw new Error(
      "RENOVA_FIRST_ADMIN_DISPLAY_NAME must be between 2 and 160 characters",
    );
  return { email: normalizedEmail, password, displayName: name };
}

// client: any object with an async query(text, params) => { rows } — a pg
// Client or a PGlite instance. Runs the whole provisioning in one
// transaction: the user row and the audit row land together or not at all.
export async function provisionFirstAdmin(client, input) {
  const { email, password, displayName } = validateInput(input);
  await client.query("begin");
  try {
    const existingAdmin = await client.query(
      "select count(*)::int as count from users where role = 'ADMIN'",
    );
    if (Number(existingAdmin.rows[0]?.count ?? 0) > 0)
      throw new Error(
        "An admin account already exists; refusing to create another",
      );
    const existingEmail = await client.query(
      "select id from users where lower(email) = lower($1)",
      [email],
    );
    if (existingEmail.rows.length > 0)
      throw new Error("A user with this email address already exists");
    const created = await client.query(
      `insert into users
         (email, password_hash, display_name, role, is_active,
          email_verified_at, credential_version)
       values ($1, $2, $3, 'ADMIN', true, now(), 0)
       returning id, email, display_name`,
      [email, hashAdminPassword(password), displayName],
    );
    const user = created.rows[0];
    if (!user) throw new Error("First admin insert returned no row");
    await client.query(
      `insert into audit_logs
         (actor_user_id, action, entity_type, entity_id, metadata)
       values ($1, 'FIRST_ADMIN_PROVISIONED', 'USER', $1, $2)`,
      [
        user.id,
        JSON.stringify({ email: user.email, provisionedBy: "operator" }),
      ],
    );
    await client.query("commit");
    return { id: user.id, email: user.email, displayName: user.display_name };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // The connection is already unusable; the original error is the one
      // that matters.
    }
    throw error;
  }
}

const isEntrypoint =
  process.argv[1] &&
  new URL(import.meta.url).pathname === process.argv[1];
if (isEntrypoint) {
  try {
    if (process.env.RENOVA_PROVISION_FIRST_ADMIN !== "confirm")
      throw new Error(
        "Refusing to provision: set RENOVA_PROVISION_FIRST_ADMIN=confirm to confirm this operator action",
      );
    const connectionString = process.env.DATABASE_URL_UNPOOLED;
    if (!connectionString)
      throw new Error(
        "DATABASE_URL_UNPOOLED is required (from the Neon console; never paste it in chat)",
      );
    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 15_000,
    });
    try {
      const client = await pool.connect();
      try {
        const result = await provisionFirstAdmin(client, {
          email: process.env.RENOVA_FIRST_ADMIN_EMAIL,
          password: process.env.RENOVA_FIRST_ADMIN_PASSWORD,
          displayName:
            process.env.RENOVA_FIRST_ADMIN_DISPLAY_NAME ?? "NIRMAQ Admin",
        });
        // Only the email and id are printed — never the password.
        console.log(
          `First admin provisioned: ${result.email} (id ${result.id})`,
        );
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error(
      `First admin provisioning failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
}
