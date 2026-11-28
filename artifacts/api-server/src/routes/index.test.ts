import assert from "node:assert/strict";
import test from "node:test";
import router from "./index";

// Prompt L, Task 1 — structural check that the standard tier is wired in
// production order: after the health probes (readiness must answer when the
// database is down) and before every other router. This does not make HTTP
// requests; the behaviour is proven in tests/security.integration.ts.
test("standard rate limit sits after health in the router stack", () => {
  const stack = (
    router as unknown as { stack: Array<{ handle: { name?: string } }> }
  ).stack;
  const names = stack.map((layer) => layer.handle?.name ?? "");
  const standardIndex = names.indexOf("standardRateLimit");
  assert.ok(
    standardIndex >= 0,
    `standardRateLimit is mounted (stack: ${names.join(", ")})`,
  );
  // Layer 0 is the health router; the standard tier must be layer 1 so no
  // other route is reachable before it.
  assert.equal(
    standardIndex,
    1,
    `standardRateLimit must be the second layer, after health (stack: ${names.join(", ")})`,
  );
});
