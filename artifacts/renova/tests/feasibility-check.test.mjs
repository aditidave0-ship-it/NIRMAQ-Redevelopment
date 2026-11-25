import test from "node:test";
import assert from "node:assert/strict";
import {
  getTeaserSensitivityNotes,
} from "../src/experience/feasibility-check.ts";
import {
  assessTentativeFeasibility,
} from "../src/experience/tentative-feasibility.ts";

const EXTRA_AREAS = [0, 10, 20, 30];

/** A note must never carry a figure: no rupees, no crores, no FSI, no areas. */
function assertFigureFree(text) {
  assert.doesNotMatch(text, /₹/);
  assert.doesNotMatch(text, /\bCr\b/);
  assert.doesNotMatch(text, /FSI/);
  assert.doesNotMatch(text, /sq\.?ft/i);
  assert.doesNotMatch(text, /guarantee/i);
}

test("teaser notes: one extra-area note, figure-free, and never a regulation claim", () => {
  for (const extra of EXTRA_AREAS) {
    const notes = getTeaserSensitivityNotes(extra);
    assert.equal(notes.length, 1);
    for (const note of notes) {
      assertFigureFree(note);
      // The society does not pick a regulation in the teaser — no note
      // may name one or tell the society which applies.
      assert.doesNotMatch(note, /33\(7\)/);
      assert.doesNotMatch(note, /33\(11\)/);
    }
  }
});

test("teaser notes: the extra-area note changes with the extra area", () => {
  const notesByExtra = EXTRA_AREAS.map(
    (extra) => getTeaserSensitivityNotes(extra)[0],
  );
  assert.equal(new Set(notesByExtra).size, 4);
});

test("teaser result: band label and reasons carry no figures", () => {
  const favourable = assessTentativeFeasibility({
    plotAreaSqft: 24_000,
    homeCount: 48,
    avgHomeCarpetSqft: 500,
    buildingAgeYears: 35,
    localityRatePerSqft: 28_000,
  });
  assert.equal(favourable.band, "favourable");
  assertFigureFree(favourable.bandLabel);
  for (const reason of favourable.reasons) assertFigureFree(reason);

  const challenging = assessTentativeFeasibility({
    plotAreaSqft: 6_000,
    homeCount: 60,
    avgHomeCarpetSqft: 450,
    buildingAgeYears: 12,
    localityRatePerSqft: 9_000,
  });
  assert.equal(challenging.band, "challenging");
  assertFigureFree(challenging.bandLabel);
  for (const reason of challenging.reasons) assertFigureFree(reason);
});
