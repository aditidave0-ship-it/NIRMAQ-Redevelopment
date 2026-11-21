import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPreflight,
  compareMigrationLedger,
  findMissingColumns,
  loadExpectedMigrations,
  withReadOnlyTransaction,
} from "./preflight-production.mjs";

const expected = [
  { tag: "0000_base", hash: "hash-0", createdAt: "100" },
  { tag: "0001_next", hash: "hash-1", createdAt: "200" },
];

test("canonical migration files match the complete journal", async () => {
  const migrations = await loadExpectedMigrations();
  assert.equal(migrations.length, 9);
  assert.equal(migrations[0].tag, "0000_real_roland_deschain");
  assert.equal(migrations[8].tag, "0008_spotty_morg");
  assert.match(migrations[8].hash, /^[a-f0-9]{64}$/);
});

test("a canonical ledger prefix is reported as pending, not drift", () => {
  assert.deepEqual(
    compareMigrationLedger([{ hash: "hash-0", createdAt: "100" }], expected),
    {
      appliedCount: 1,
      expectedCount: 2,
      applied: ["0000_base"],
      pending: ["0001_next"],
      unexpected: [],
    },
  );
});

test("an unexpected ledger hash blocks migration execution", () => {
  const result = compareMigrationLedger(
    [{ hash: "unknown", createdAt: "100" }],
    expected,
  );
  assert.equal(result.unexpected.length, 1);
  assert.equal(result.unexpected[0].expectedTag, "0000_base");
});

test("schema checks list only missing required columns", () => {
  assert.deepEqual(
    findMissingColumns(
      [{ tableName: "users", columnName: "id" }],
      [
        ["users", "id"],
        ["users", "credential_version"],
      ],
    ),
    ["users.credential_version"],
  );
});

test("missing columns from applied migrations are schema drift", () => {
  const result = classifyPreflight(
    { appliedCount: 3, pending: ["0003_next"], unexpected: [] },
    ["users.email_verified_at", "feasibility_requests.status"],
  );
  assert.equal(result.status, "BLOCKED_SCHEMA_DRIFT");
  assert.deepEqual(result.missingAppliedColumns, ["users.email_verified_at"]);
  assert.deepEqual(result.missingPendingColumns, [
    "feasibility_requests.status",
  ]);
});

test("canonical pending columns are not misreported as drift", () => {
  const result = classifyPreflight(
    { appliedCount: 3, pending: ["0003_next"], unexpected: [] },
    ["feasibility_requests.status"],
  );
  assert.equal(result.status, "BLOCKED_PENDING_MIGRATIONS");
  assert.deepEqual(result.missingAppliedColumns, []);
});


test("a failed read query rolls back before releasing the client", async () => {
  const failure = new Error("query failed");
  const statements = [];
  let released = false;
  let releaseError;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql === "select broken") throw failure;
      return { rows: [] };
    },
    release(error) {
      released = true;
      releaseError = error;
    },
  };

  await assert.rejects(
    withReadOnlyTransaction(client, (transaction) =>
      transaction.query("select broken"),
    ),
    (error) => error === failure,
  );
  assert.deepEqual(statements, [
    "begin transaction read only",
    "set local statement_timeout = '15s'",
    "select broken",
    "rollback",
  ]);
  assert.equal(released, true);
  assert.equal(releaseError, undefined);
});

test("a client with failed rollback is discarded and cleanup failure is reported safely", async () => {
  const statements = [];
  let released = false;
  let releaseError;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql === "rollback") throw new Error("sensitive connection detail");
      return { rows: [] };
    },
    release(error) {
      released = true;
      releaseError = error;
    },
  };

  await assert.rejects(
    withReadOnlyTransaction(client, async () => "result"),
    /Read-only preflight transaction cleanup failed/,
  );
  assert.deepEqual(statements, [
    "begin transaction read only",
    "set local statement_timeout = '15s'",
    "rollback",
  ]);
  assert.equal(released, true);
  assert.match(releaseError.message, /cleanup failed/);
  assert.doesNotMatch(releaseError.message, /sensitive connection detail/);
});
