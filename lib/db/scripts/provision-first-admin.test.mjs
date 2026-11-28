// Tests for the first-admin provisioning script (Prompt H, Task 3).
// Runs against an in-memory PGlite database with the real migrations
// (journal 0000–0008 + provisional 0010) — no production access.
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  ADMIN_PASSWORD_SCRYPT,
  hashAdminPassword,
  provisionFirstAdmin,
} from "./provision-first-admin.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.resolve(scriptDirectory, "../drizzle");

async function migratedEngine() {
  const engine = new PGlite();
  const journal = JSON.parse(
    await readFile(path.join(migrationDirectory, "meta", "_journal.json"), "utf8"),
  );
  for (const entry of journal.entries)
    await engine.exec(
      await readFile(path.join(migrationDirectory, `${entry.tag}.sql`), "utf8"),
    );
  await engine.exec(
    await readFile(
      path.join(migrationDirectory, "provisional", "0010_privacy_phase_b.sql"),
      "utf8",
    ),
  );
  return engine;
}

test("hashAdminPassword matches the login hash format and verifies", () => {
  const hash = hashAdminPassword("operator-chosen-password");
  const [salt, derived] = hash.split(":");
  assert.match(salt, /^[a-f0-9]{32}$/);
  assert.match(derived, /^[a-f0-9]{128}$/);
  assert.equal(
    scryptSync("operator-chosen-password", Buffer.from(salt, "hex"), 64, {
      N: ADMIN_PASSWORD_SCRYPT.N,
      r: ADMIN_PASSWORD_SCRYPT.r,
      p: ADMIN_PASSWORD_SCRYPT.p,
      maxmem: ADMIN_PASSWORD_SCRYPT.maxmem,
    }).toString("hex"),
    derived,
  );
  assert.notEqual(
    scryptSync("a-different-password", Buffer.from(salt, "hex"), 64, {
      N: ADMIN_PASSWORD_SCRYPT.N,
      r: ADMIN_PASSWORD_SCRYPT.r,
      p: ADMIN_PASSWORD_SCRYPT.p,
      maxmem: ADMIN_PASSWORD_SCRYPT.maxmem,
    }).toString("hex"),
    derived,
  );
});

test("provisions the first admin with an audit row, then refuses a second", async () => {
  const engine = await migratedEngine();
  try {
    const result = await provisionFirstAdmin(engine, {
      email: "First.Admin@example.invalid",
      password: "operator-chosen-password",
      displayName: "First Admin",
    });
    // Email is normalized to lowercase, matching registration.
    assert.equal(result.email, "first.admin@example.invalid");
    assert.match(result.id, /^[0-9a-f-]{36}$/);

    const users = await engine.query(
      "select email, display_name, role, is_active, email_verified_at, credential_version, password_hash from users",
    );
    assert.equal(users.rows.length, 1);
    const [user] = users.rows;
    assert.equal(user.email, "first.admin@example.invalid");
    assert.equal(user.display_name, "First Admin");
    assert.equal(user.role, "ADMIN");
    assert.equal(user.is_active, true);
    assert.ok(user.email_verified_at, "operator-verified email is marked verified");
    assert.equal(user.credential_version, 0);
    assert.match(user.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);

    const audit = await engine.query(
      "select actor_user_id, action, entity_type, entity_id, metadata from audit_logs",
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].action, "FIRST_ADMIN_PROVISIONED");
    assert.equal(audit.rows[0].entity_type, "USER");
    assert.equal(audit.rows[0].entity_id, result.id);
    assert.equal(audit.rows[0].actor_user_id, result.id);
    assert.equal(JSON.parse(audit.rows[0].metadata).email, result.email);
    assert.equal(
      audit.rows[0].metadata.includes("operator-chosen-password"),
      false,
      "the audit row must never contain the password",
    );

    await assert.rejects(
      provisionFirstAdmin(engine, {
        email: "second.admin@example.invalid",
        password: "operator-chosen-password",
        displayName: "Second Admin",
      }),
      /already exists/,
    );
    assert.equal(
      (await engine.query("select count(*)::int as count from users")).rows[0]
        .count,
      1,
      "the refused second provisioning must not add a user",
    );
  } finally {
    await engine.close();
  }
});

test("refuses a duplicate email and invalid input, creating nothing", async () => {
  const engine = await migratedEngine();
  try {
    await engine.query(
      `insert into users (email, password_hash, display_name, role, is_active, email_verified_at, credential_version)
       values ('taken@example.invalid', 'x:y', 'Taken', 'SOCIETY', true, now(), 0)`,
    );
    await assert.rejects(
      provisionFirstAdmin(engine, {
        email: "TAKEN@example.invalid",
        password: "operator-chosen-password",
        displayName: "Duplicate",
      }),
      /already exists/,
    );
    await assert.rejects(
      provisionFirstAdmin(engine, {
        email: "not-an-email",
        password: "operator-chosen-password",
        displayName: "Bad Email",
      }),
      /valid email/,
    );
    await assert.rejects(
      provisionFirstAdmin(engine, {
        email: "short@example.invalid",
        password: "too-short",
        displayName: "Short Password",
      }),
      /at least 12 characters/,
    );
    await assert.rejects(
      provisionFirstAdmin(engine, {
        email: "noname@example.invalid",
        password: "operator-chosen-password",
        displayName: " ",
      }),
      /between 2 and 160/,
    );
    const users = await engine.query(
      "select count(*)::int as count from users",
    );
    assert.equal(users.rows[0].count, 1, "only the pre-seeded user exists");
    const audit = await engine.query(
      "select count(*)::int as count from audit_logs",
    );
    assert.equal(audit.rows[0].count, 0, "no audit row for refused attempts");
  } finally {
    await engine.close();
  }
});
