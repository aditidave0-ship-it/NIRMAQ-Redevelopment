import test from "node:test";
import assert from "node:assert/strict";
import {
  assessTentativeFeasibility,
  TENTATIVE_FEASIBILITY_DISCLAIMER,
} from "../src/experience/tentative-feasibility.ts";

function assess(overrides) {
  return assessTentativeFeasibility({
    plotAreaSqft: 12_000,
    homeCount: 30,
    avgHomeCarpetSqft: 500,
    buildingAgeYears: 25,
    localityRatePerSqft: null,
    ...overrides,
  });
}

test("favourable band with locality rate entered", () => {
  const result = assess({
    plotAreaSqft: 24_000,
    homeCount: 48,
    avgHomeCarpetSqft: 500,
    buildingAgeYears: 35,
    localityRatePerSqft: 28_000,
  });
  assert.equal(result.band, "favourable");
  assert.equal(result.score, 6);
  assert.equal(result.maxScore, 6);
  assert.equal(result.reasons.length, 3);
});

test("favourable band without locality rate (density bonus clamps at max)", () => {
  const result = assess({
    plotAreaSqft: 24_000,
    homeCount: 40,
    avgHomeCarpetSqft: 450,
    buildingAgeYears: 35,
  });
  assert.equal(result.band, "favourable");
  assert.equal(result.maxScore, 4);
  assert.equal(result.score, 4);
  assert.match(result.reasons[2], /did not enter a locality sale rate/);
});

test("moderate band with locality rate entered", () => {
  const result = assess({ localityRatePerSqft: 20_000 });
  assert.equal(result.band, "moderate");
  assert.equal(result.score, 3);
  assert.equal(result.maxScore, 6);
});

test("moderate band without locality rate", () => {
  const result = assess({});
  assert.equal(result.band, "moderate");
  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 4);
});

test("challenging band with locality rate entered (score clamps at zero)", () => {
  const result = assess({
    plotAreaSqft: 6_000,
    homeCount: 40,
    avgHomeCarpetSqft: 600,
    buildingAgeYears: 12,
    localityRatePerSqft: 12_000,
  });
  assert.equal(result.band, "challenging");
  assert.equal(result.score, 0);
});

test("challenging band without locality rate", () => {
  const result = assess({
    plotAreaSqft: 8_000,
    homeCount: 20,
    buildingAgeYears: 15,
  });
  assert.equal(result.band, "challenging");
  assert.equal(result.score, 0);
});

test("dense existing layout can pull a borderline result down a band", () => {
  const result = assess({
    plotAreaSqft: 15_000,
    homeCount: 60,
    avgHomeCarpetSqft: 600,
    buildingAgeYears: 22,
  });
  assert.equal(result.band, "challenging");
  assert.equal(result.score, 1);
});

test("output stays qualitative: no currency, FSI or TDR language anywhere", () => {
  const cases = [
    assess({ plotAreaSqft: 24_000, buildingAgeYears: 35, localityRatePerSqft: 28_000 }),
    assess({}),
    assess({ plotAreaSqft: 6_000, buildingAgeYears: 12, localityRatePerSqft: 12_000 }),
  ];
  for (const result of cases) {
    const text = [result.bandLabel, ...result.reasons].join(" ");
    assert.ok(!text.includes("₹"), text);
    assert.ok(!/FSI|TDR/i.test(text), text);
    assert.ok(!/crore|sq\.ft of saleable|entitlement/i.test(text), text);
  }
  assert.match(TENTATIVE_FEASIBILITY_DISCLAIMER, /Tentative indication only/);
  assert.match(TENTATIVE_FEASIBILITY_DISCLAIMER, /not a feasibility report/i);
});
