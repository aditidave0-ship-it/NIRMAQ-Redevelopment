import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_ITEMS,
  EMPTY_DOCUMENT_ANSWERS,
  EMPTY_DOCUMENTS_CONTACT,
  EMPTY_TEAM_STATUSES,
  bifurcationTotal,
  buildDocumentsEnquiryDetails,
  carpetRowsGiven,
  carpetTotalSqft,
  documentsReadiness,
  isItemGiven,
  isMapsLink,
  teamReadiness,
  validateDocumentsSend,
} from "../src/experience/feasibility-documents.ts";
import { buildRequirementEnquiryPayload } from "../src/experience/requirement-enquiry.ts";

function fullAnswers(overrides = {}) {
  return {
    ...EMPTY_DOCUMENT_ANSWERS,
    google_location: "https://maps.app.goo.gl/example",
    cts_number: "CTS 1234",
    dp_remark: "dp-remark.pdf",
    property_card: "property-card.pdf",
    conveyance: "conveyance-deed.pdf",
    member_list: "member-list.xlsx",
    bifurcation: { residential: "38", commercial: "2" },
    carpet_areas: [
      { id: "r1", label: "Flat 1", area: "520" },
      { id: "r2", label: "Flat 2", area: "480" },
    ],
    remarks:
      "We would like 20% extra area. If possible, we would like the redevelopment under Regulation 33(7)(B).",
    ...overrides,
  };
}

function fullContact(overrides = {}) {
  return {
    ...EMPTY_DOCUMENTS_CONTACT,
    name: "Anita Desai",
    role: "Secretary",
    phone: "98200 12345",
    email: "secretary@society.in",
    consent: true,
    ...overrides,
  };
}

test("the dashboard carries Aditi's eight items, in her order, six compulsory", () => {
  assert.equal(DOCUMENT_ITEMS.length, 8);
  assert.deepEqual(
    DOCUMENT_ITEMS.map((item) => item.id),
    [
      "google_location",
      "cts_number",
      "dp_remark",
      "property_card",
      "conveyance",
      "member_list",
      "bifurcation",
      "carpet_areas",
    ],
  );
  assert.equal(
    DOCUMENT_ITEMS.filter((item) => item.compulsory).length,
    6,
  );
  // DP remark and conveyance are the two items she did not mark compulsory.
  assert.equal(
    DOCUMENT_ITEMS.find((item) => item.id === "dp_remark")?.compulsory,
    false,
  );
  assert.equal(
    DOCUMENT_ITEMS.find((item) => item.id === "conveyance")?.compulsory,
    false,
  );
});

test("isItemGiven: a link or a typed detail counts once it is filled in", () => {
  const answers = fullAnswers();
  assert.equal(isItemGiven(DOCUMENT_ITEMS[0], answers), true);
  assert.equal(
    isItemGiven(
      DOCUMENT_ITEMS[0],
      fullAnswers({ google_location: "   " }),
    ),
    false,
  );
  assert.equal(isItemGiven(DOCUMENT_ITEMS[1], answers), true);
  assert.equal(
    isItemGiven(DOCUMENT_ITEMS[1], fullAnswers({ cts_number: "" })),
    false,
  );
});

test("isItemGiven: a document counts once a file is chosen", () => {
  const answers = fullAnswers();
  assert.equal(isItemGiven(DOCUMENT_ITEMS[3], answers), true);
  assert.equal(
    isItemGiven(DOCUMENT_ITEMS[3], fullAnswers({ property_card: "" })),
    false,
  );
});

test("isItemGiven: the split counts only when both numbers are in and the total is above zero", () => {
  const item = DOCUMENT_ITEMS[6];
  assert.equal(isItemGiven(item, fullAnswers()), true);
  assert.equal(
    isItemGiven(
      item,
      fullAnswers({ bifurcation: { residential: "38", commercial: "" } }),
    ),
    false,
  );
  assert.equal(
    isItemGiven(
      item,
      fullAnswers({ bifurcation: { residential: "0", commercial: "0" } }),
    ),
    false,
  );
  assert.equal(bifurcationTotal(fullAnswers()), 40);
  assert.equal(
    bifurcationTotal(
      fullAnswers({ bifurcation: { residential: "", commercial: "2" } }),
    ),
    null,
  );
});

test("isItemGiven: carpet areas count by rows with a real area, and the total adds up", () => {
  const item = DOCUMENT_ITEMS[7];
  assert.equal(isItemGiven(item, fullAnswers()), true);
  assert.equal(carpetTotalSqft(fullAnswers()), 1000);
  assert.equal(carpetRowsGiven(fullAnswers()), 2);
  assert.equal(
    isItemGiven(item, fullAnswers({ carpet_areas: [] })),
    false,
  );
  assert.equal(
    isItemGiven(
      item,
      fullAnswers({ carpet_areas: [{ id: "r1", label: "Flat 1", area: "0" }] }),
    ),
    false,
  );
  assert.equal(
    carpetTotalSqft(
      fullAnswers({
        carpet_areas: [
          { id: "r1", label: "Flat 1", area: "520" },
          { id: "r2", label: "Flat 2", area: "" },
        ],
      }),
    ),
    520,
  );
});

test("isMapsLink recognises Google Maps links and rejects other links", () => {
  assert.equal(isMapsLink("https://maps.app.goo.gl/example"), true);
  assert.equal(isMapsLink("https://www.google.com/maps/place/X"), true);
  assert.equal(isMapsLink("https://maps.google.co.in/@19,72"), true);
  assert.equal(isMapsLink("https://example.com/plot"), false);
  assert.equal(isMapsLink(""), false);
});

test("readiness: empty checklist is 0 of 6 compulsory, and the two optional items never block it", () => {
  const empty = documentsReadiness(EMPTY_DOCUMENT_ANSWERS);
  assert.equal(empty.compulsoryGiven, 0);
  assert.equal(empty.compulsoryTotal, 6);
  assert.equal(empty.ready, false);
  assert.equal(empty.missingCompulsory.length, 6);

  const optionalMissing = fullAnswers({ dp_remark: "", conveyance: "" });
  const readiness = documentsReadiness(optionalMissing);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.compulsoryGiven, 6);
  assert.equal(readiness.totalGiven, 6);
  assert.equal(readiness.total, 8);
  assert.deepEqual(readiness.missingAll.map((item) => item.id), [
    "dp_remark",
    "conveyance",
  ]);
});

test("team readiness: a compulsory item blocks until it is both given and verified", () => {
  const answers = fullAnswers();
  const none = teamReadiness(answers, EMPTY_TEAM_STATUSES);
  assert.equal(none.verifiedCompulsory, 0);
  assert.equal(none.blocking.length, 6);

  const half = teamReadiness(answers, {
    ...EMPTY_TEAM_STATUSES,
    google_location: "verified",
    cts_number: "verified",
    property_card: "verified",
  });
  assert.equal(half.verifiedCompulsory, 3);
  assert.deepEqual(
    half.blocking.map((item) => item.id),
    ["member_list", "bifurcation", "carpet_areas"],
  );

  const all = teamReadiness(answers, {
    google_location: "verified",
    cts_number: "verified",
    dp_remark: "verified",
    property_card: "verified",
    conveyance: "verified",
    member_list: "verified",
    bifurcation: "verified",
    carpet_areas: "verified",
  });
  assert.equal(all.verifiedCompulsory, 6);
  assert.equal(all.blocking.length, 0);
});

test("validateDocumentsSend: an empty checklist and missing contact are all reported", () => {
  const errors = validateDocumentsSend(
    "",
    EMPTY_DOCUMENTS_CONTACT,
    EMPTY_DOCUMENT_ANSWERS,
  );
  assert.ok(errors.some((error) => error.includes("housing society")));
  assert.ok(errors.some((error) => error.includes("checklist is empty")));
  assert.ok(errors.some((error) => error.includes("remarks")));
  assert.ok(errors.some((error) => error.includes("contact name")));
  assert.ok(errors.some((error) => error.includes("phone number")));
  assert.ok(errors.some((error) => error.includes("email address")));
  assert.ok(errors.some((error) => error.includes("consent box")));
});

test("validateDocumentsSend: a full checklist with contact sends cleanly", () => {
  assert.deepEqual(
    validateDocumentsSend("Shanti Sagar CHS", fullContact(), fullAnswers()),
    [],
  );
  // A partial checklist can still be sent — the brief lists what is missing.
  assert.deepEqual(
    validateDocumentsSend(
      "Shanti Sagar CHS",
      fullContact(),
      fullAnswers({ google_location: "https://maps.app.goo.gl/x", cts_number: "", dp_remark: "", property_card: "", conveyance: "", member_list: "", bifurcation: { residential: "", commercial: "" }, carpet_areas: [] }),
    ),
    [],
  );
  // The remarks are compulsory: a full checklist without them cannot be sent.
  assert.deepEqual(
    validateDocumentsSend(
      "Shanti Sagar CHS",
      fullContact(),
      fullAnswers({ remarks: "   " }),
    ),
    ["Please write your remarks — tell us anything specific, like a regulation you want or the extra area percentage you have in mind."],
  );
});


test("buildDocumentsEnquiryDetails: every item travels in the brief, nothing is dropped", () => {
  const details = buildDocumentsEnquiryDetails(
    "Shanti Sagar CHS",
    fullContact(),
    fullAnswers(),
  );
  const payload = buildRequirementEnquiryPayload(details);
  assert.equal(payload.organizationName, "Shanti Sagar CHS");
  assert.equal(payload.name, "Anita Desai");
  assert.match(payload.message, /CTS 1234/);
  assert.match(payload.message, /maps\.app\.goo\.gl/);
  assert.match(payload.message, /property-card\.pdf/);
  assert.match(payload.message, /conveyance-deed\.pdf/);
  assert.match(payload.message, /member-list\.xlsx/);
  assert.match(payload.message, /38 residential, 2 commercial \(40 members in total\)/);
  assert.match(payload.message, /2 flats listed, total 1,000 sq\.ft/);
  assert.match(payload.message, /Flat 1: 520 sq\.ft/);
  assert.match(
    payload.message,
    /Society's remarks: We would like 20% extra area/,
  );
  assert.match(payload.message, /ready for feasibility preparation/);
  assert.match(payload.message, /info@nirmaq\.in/);
});

test("buildDocumentsEnquiryDetails: a partial checklist says plainly what is still needed", () => {
  const details = buildDocumentsEnquiryDetails(
    "Shanti Sagar CHS",
    fullContact(),
    fullAnswers({
      google_location: "",
      cts_number: "",
      property_card: "",
      member_list: "",
      bifurcation: { residential: "", commercial: "" },
      carpet_areas: [],
    }),
  );
  const payload = buildRequirementEnquiryPayload(details);
  assert.match(payload.message, /Google location: Not given yet/);
  assert.match(payload.message, /CTS number: Not given yet/);
  assert.match(payload.message, /Still needed before feasibility preparation/);
  assert.match(payload.message, /Property card/);
  assert.match(payload.message, /List of existing members/);
  assert.equal(details.conveyanceStatus, "Conveyance document chosen — file to follow by email");
});
