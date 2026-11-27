import test from "node:test";
import assert from "node:assert/strict";
import { GET_STARTED_OPTIONS } from "../src/experience/get-started.ts";

test("Get Started offers one journey per stakeholder, to a working entry", () => {
  assert.deepEqual(
    GET_STARTED_OPTIONS.map((option) => option.id),
    ["society", "developer", "pmc", "professional"],
  );
  const byId = Object.fromEntries(
    GET_STARTED_OPTIONS.map((option) => [option.id, option]),
  );
  // Societies start with the public feasibility check — the full
  // dashboard follows from there. Nobody is promised an account.
  assert.equal(byId.society.href, "/feasibility-check");
  assert.equal(byId.developer.href, "/developers");
  assert.equal(byId.pmc.href, "/professionals/pmcs");
  assert.equal(byId.professional.href, "/professionals");
  for (const option of GET_STARTED_OPTIONS) {
    assert.ok(option.title.length > 0);
    assert.ok(option.text.length > 0);
    assert.ok(option.action.length > 0);
    assert.ok(!/workspace|register|sign up/i.test(option.text), option.id);
  }
});
