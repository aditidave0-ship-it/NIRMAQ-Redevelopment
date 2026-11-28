import assert from "node:assert/strict";
import test from "node:test";
import {
  authRateLimitSubject,
  rateLimitWindowStart,
  tooManyRequestsError,
  AUTH_RATE_LIMIT_POLICIES,
} from "./auth-rate-limit";

test("auth rate-limit subjects do not persist raw IP or email values", () => {
  const subject = authRateLimitSubject("203.0.113.9", "Person@Example.com");
  assert.match(subject, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(subject, /Person|Example|203/);
  assert.equal(
    subject,
    authRateLimitSubject("203.0.113.9", "person@example.com"),
  );
});

test("rate-limit windows are stable time buckets", () => {
  const start = rateLimitWindowStart(
    new Date("2026-01-01T00:14:59.999Z"),
    15 * 60 * 1000,
  );
  assert.equal(start.toISOString(), "2026-01-01T00:00:00.000Z");
});

// Prompt L — the standard tier and feasibility quotas live in the same
// single source of truth as the auth policies. The numbers are pinned here
// so a quiet change shows up as a failing test, not a silent drift.
test("Prompt L policies: standard tier and feasibility quotas", () => {
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES.STANDARD_REQUEST, {
    limit: 100,
    windowMs: 60 * 1000,
  });
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES.STANDARD_REQUEST_GLOBAL, {
    limit: 1000,
    windowMs: 60 * 1000,
  });
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES.FEASIBILITY_CREATE, {
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
  });
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES.FEASIBILITY_DOCUMENT, {
    limit: 20,
    windowMs: 24 * 60 * 60 * 1000,
  });
  assert.deepEqual(AUTH_RATE_LIMIT_POLICIES.RESET_PASSWORD, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  // Every new action name fits the authRateLimits.action column (varchar 48).
  for (const action of [
    "STANDARD_REQUEST",
    "STANDARD_REQUEST_GLOBAL",
    "FEASIBILITY_CREATE",
    "FEASIBILITY_DOCUMENT",
    "RESET_PASSWORD",
  ] as const)
    assert.ok(action.length <= 48, action);
});

test("tooManyRequestsError is the single 429 refusal shape", () => {
  const error = tooManyRequestsError();
  assert.equal(error.message, "Too many requests. Please try again later.");
  assert.equal(error.status, 429);
  assert.equal(error.code, "RATE_LIMITED");
});
