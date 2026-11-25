import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIntakeEnquiryDetails,
  EMPTY_INTAKE_FORM,
  assessIntakeBand,
  intakeBandInput,
  validateIntakeForm,
} from "../src/experience/intake-form.ts";
import { buildRequirementEnquiryPayload } from "../src/experience/requirement-enquiry.ts";

function fullValues(overrides = {}) {
  return {
    ...EMPTY_INTAKE_FORM,
    societyName: "Malvani Virgo Co-op Housing Society Ltd.",
    registrationNumber: "MH/1234/1990",
    address: "Virgo CHS, Malad (West), Mumbai 400064",
    wardCts: "P/N Ward, Village Malvani, CTS No. 8-A",
    landOwnership: "freehold",
    plotArea: "3000",
    plotUnit: "sqm",
    roadWidth: "12_18",
    roadReservation: "no",
    buildingAge: "35",
    structureType: "Ground + 4 Floors, RCC",
    residentialFlats: "100",
    commercialUnits: "2",
    totalCarpet: "33000",
    avgCarpet: "330",
    extraAreaPct: "20",
    corpusPerSqft: "1000",
    rentPerSqft: "75",
    parking: "covered",
    sellingPrice: "21000",
    documents: ["property_card", "conveyance_deed", "dp_remarks"],
    contactName: "Test Secretary",
    contactRole: "Secretary",
    contactPhone: "9876543210",
    contactEmail: "test@example.com",
    consent: true,
    ...overrides,
  };
}

test("validation: empty form lists every missing required field", () => {
  const errors = validateIntakeForm(EMPTY_INTAKE_FORM);
  assert.match(errors.join(" "), /name of your housing society/);
  assert.match(errors.join(" "), /plot area/);
  assert.match(errors.join(" "), /residential flats/);
  assert.match(errors.join(" "), /building age/);
  assert.match(errors.join(" "), /carpet area/);
  assert.match(errors.join(" "), /contact name/);
  assert.match(errors.join(" "), /phone number/);
  assert.match(errors.join(" "), /email address/);
  assert.match(errors.join(" "), /consent box/);
});

test("validation: a complete form has no errors", () => {
  assert.deepEqual(validateIntakeForm(fullValues()), []);
});

test("mapping: all 15 intake fields land in the enquiry payload", () => {
  const payload = buildRequirementEnquiryPayload(buildIntakeEnquiryDetails(fullValues()));
  assert.equal(payload.organizationName, "Malvani Virgo Co-op Housing Society Ltd.");
  assert.equal(payload.actorType, "Housing Society");
  assert.equal(payload.name, "Test Secretary");
  assert.equal(payload.email, "test@example.com");
  const message = payload.message;
  assert.match(message, /Member households: 100/);
  assert.match(message, /Building age: 35 years/);
  assert.match(message, /Land tenure: Society Conveyed Freehold/);
  assert.match(message, /Approximate plot area: 32292/);
  assert.match(message, /Conveyance status: Conveyance Deed available/);
  assert.match(message, /Services requested: Feasibility review/);
  assert.match(message, /Registration number & year: MH\/1234\/1990/);
  assert.match(message, /Municipal ward & village \/ CTS No\.: P\/N Ward/);
  assert.match(message, /Plot area: 3000 Sq\. Mtrs \(32,292 Sq\. Ft\.\)/);
  assert.match(message, /Width of road touching the plot: 12m to 18m/);
  assert.match(message, /Road widening \/ reservation on plot: No/);
  assert.match(message, /Structure type: Ground \+ 4 Floors, RCC/);
  assert.match(message, /Commercial shops \/ offices: 2/);
  assert.match(message, /Total existing carpet area of all flats: 33,000 Sq\. Ft\./);
  assert.match(message, /Average flat carpet area: 330 Sq\. Ft\./);
  assert.match(message, /Expected extra carpet area: 20%/);
  assert.match(message, /Expected hardship corpus: ₹1000 per sq\. ft\./);
  assert.match(message, /Current local rent in area: ₹75 per sq\. ft\. per month/);
  assert.match(message, /Car parking requirement: 1 covered parking per flat/);
  assert.match(message, /Expected new flat selling price in area: ₹21000 per sq\. ft\./);
  assert.match(
    message,
    /Documents ready: Property Card \(P\.R\. Card\); Conveyance Deed \/ Lease Deed; DP 2034 Remarks/,
  );
});

test("mapping: plot entered in sq.ft is not converted", () => {
  const payload = buildRequirementEnquiryPayload(
    buildIntakeEnquiryDetails(
      fullValues({ plotArea: "18000", plotUnit: "sqft" }),
    ),
  );
  assert.match(payload.message, /Approximate plot area: 18000/);
  assert.match(payload.message, /Plot area: 18000 Sq\. Ft\. \(18,000 Sq\. Ft\.\)/);
});

test("mapping: 30% extra area reads as 30% or more", () => {
  const payload = buildRequirementEnquiryPayload(buildIntakeEnquiryDetails(fullValues({ extraAreaPct: "30" })));
  assert.match(payload.message, /Expected extra carpet area: 30% or more/);
});

test("mapping: no conveyance deed says so in the payload", () => {
  const payload = buildRequirementEnquiryPayload(buildIntakeEnquiryDetails(fullValues({ documents: [] })));
  assert.match(payload.message, /Conveyance status: Conveyance Deed not yet available/);
  assert.match(payload.message, /Documents ready: none ticked yet/);
});

test("band: the four numbers produce a figure-free band", () => {
  const input = intakeBandInput(fullValues());
  assert.notEqual(input, null);
  assert.equal(input.plotAreaSqft, 32292);
  assert.equal(input.homeCount, 100);
  assert.equal(input.avgHomeCarpetSqft, 330);
  assert.equal(input.buildingAgeYears, 35);
  assert.equal(input.localityRatePerSqft, 21000);
  const band = assessIntakeBand(fullValues());
  assert.equal(band.band, "favourable");
  assert.doesNotMatch(band.bandLabel, /₹/);
  assert.doesNotMatch(band.bandLabel, /\bCr\b/);
  for (const reason of band.reasons) {
    assert.doesNotMatch(reason, /₹/);
    assert.doesNotMatch(reason, /\bCr\b/);
  }
});

test("band: missing carpet figures means no band, not a made-up one", () => {
  const values = fullValues({ totalCarpet: "", avgCarpet: "" });
  assert.equal(intakeBandInput(values), null);
  assert.equal(assessIntakeBand(values), null);
});
