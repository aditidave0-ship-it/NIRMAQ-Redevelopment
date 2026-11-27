import test from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_SECTIONS,
  EMPTY_DASHBOARD_ANSWERS,
  EMPTY_DASHBOARD_CONTACT,
  buildDashboardEnquiryDetails,
  carpetTotalSqft,
  dashboardReadiness,
  isSectionGiven,
  membersTotal,
  plotAreaSqft,
  validateDashboardSend,
} from "../src/experience/feasibility-dashboard.ts";
import { buildRequirementEnquiryPayload } from "../src/experience/requirement-enquiry.ts";

test("members and carpet totals add the society's own figures", () => {
  const answers = {
    ...EMPTY_DASHBOARD_ANSWERS,
    resMembers: "129",
    comMembers: "6",
    resArea: "33000",
    comArea: "4714",
  };
  assert.equal(membersTotal(answers), 135);
  assert.equal(carpetTotalSqft(answers), 37714);
  assert.equal(membersTotal(EMPTY_DASHBOARD_ANSWERS), null);
  assert.equal(carpetTotalSqft(EMPTY_DASHBOARD_ANSWERS), null);
});

test("plot area converts sq.m to sq.ft like the intake form", () => {
  assert.equal(
    plotAreaSqft({ ...EMPTY_DASHBOARD_ANSWERS, plotAreaSqm: "5003.46" }),
    53857,
  );
  assert.equal(plotAreaSqft(EMPTY_DASHBOARD_ANSWERS), null);
});

test("readiness needs basic details and members; documents and notes do not block", () => {
  const empty = dashboardReadiness(EMPTY_DASHBOARD_ANSWERS);
  assert.equal(empty.ready, false);
  assert.equal(empty.sectionsGiven, 0);

  const basicOnly = dashboardReadiness({
    ...EMPTY_DASHBOARD_ANSWERS,
    societyName: "Test CHSL",
    ctsNumber: "123",
    district: "Mumbai Sub",
  });
  assert.equal(basicOnly.ready, false);

  const ready = dashboardReadiness({
    ...EMPTY_DASHBOARD_ANSWERS,
    societyName: "Test CHSL",
    ctsNumber: "123",
    district: "Mumbai Sub",
    resMembers: "10",
    comMembers: "2",
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.sectionsGiven, 2);
  assert.deepEqual(
    ready.missing.map((section) => section.id),
    ["documents", "additional"],
  );
});

test("send validation blocks an empty record and a filled record without a real contact", () => {
  assert.ok(
    validateDashboardSend(EMPTY_DASHBOARD_ANSWERS, EMPTY_DASHBOARD_CONTACT)
      .length > 0,
  );
  const filledErrors = validateDashboardSend(
    {
      ...EMPTY_DASHBOARD_ANSWERS,
      societyName: "Test CHSL",
      ctsNumber: "123",
      district: "Mumbai Sub",
      resMembers: "129",
      comMembers: "6",
      resArea: "33000",
      comArea: "4714",
    },
    {
      ...EMPTY_DASHBOARD_CONTACT,
      consent: true,
    },
  );
  assert.ok(filledErrors.some((error) => error.includes("phone")));
  assert.ok(filledErrors.some((error) => error.includes("email")));
  assert.ok(filledErrors.some((error) => error.includes("contact person")));
});

test("send validation passes with society, CTS, district, contact and consent", () => {
  const errors = validateDashboardSend(
    {
      ...EMPTY_DASHBOARD_ANSWERS,
      contactPerson: "Anita Desai",
      societyName: "Test CHSL",
      ctsNumber: "123",
      district: "Mumbai Sub",
    },
    {
      role: "Secretary",
      phone: "98200 12345",
      email: "secretary@society.in",
      consent: true,
    },
  );
  assert.deepEqual(errors, []);
});

test("the enquiry brief carries every section and lists file names, never the files", () => {
  const details = buildDashboardEnquiryDetails(
    {
      ...EMPTY_DASHBOARD_ANSWERS,
      societyName: "Shanti Sagar CHS",
      ctsNumber: "123",
      district: "Mumbai Sub",
      resMembers: "100",
      comMembers: "5",
      resArea: "20000",
      comArea: "3000",
      contactPerson: "Anita Desai",
      ctsRecord: "123",
      propertyCard: "Available",
      conveyanceFiles: ["conveyance.pdf"],
      dpRemarkFiles: ["dp-remark.pdf"],
      plotAreaSqm: "4000",
      roadWidth: "12 M",
      additionalInfo: "Please call after 6 pm.",
    },
    {
      role: "Secretary",
      phone: "98200 12345",
      email: "secretary@society.in",
      consent: true,
    },
  );
  assert.equal(details.societyName, "Shanti Sagar CHS");
  assert.equal(details.memberCount, 105);
  assert.equal(details.plotArea, 43056);
  assert.match(details.brief ?? "", /Shanti Sagar CHS/);
  assert.match(details.brief ?? "", /CTS No\. \/ F\.P\. No\.: 123/);
  assert.match(details.brief ?? "", /Property Card: Available/);
  assert.match(details.brief ?? "", /conveyance\.pdf/);
  assert.match(details.brief ?? "", /dp-remark\.pdf/);
  assert.match(details.brief ?? "", /info@nirmaq\.in/);
  assert.match(details.brief ?? "", /23,000 sq\.ft in total/);
  assert.match(details.brief ?? "", /Please call after 6 pm\./);

  const payload = buildRequirementEnquiryPayload(details);
  assert.equal(payload.organizationName, "Shanti Sagar CHS");
  assert.equal(payload.email, "secretary@society.in");
  assert.equal(payload.consent, true);
});

test("the dashboard has four sections in the file's order", () => {
  assert.deepEqual(
    DASHBOARD_SECTIONS.map((section) => section.id),
    ["basic", "documents", "members", "additional"],
  );
  assert.deepEqual(
    DASHBOARD_SECTIONS.map((section) => section.number),
    ["01", "02", "03", "04"],
  );
});
