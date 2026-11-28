import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  adminEnquiryNotificationEmail,
  breachNotificationBoardEmail,
  breachNotificationUserEmail,
  enquiryAcknowledgementEmail,
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
} from "./email";

const brand = {
  productName: "Example Platform",
  appUrl: "https://example.test",
  from: "Example <onboarding@resend.dev>",
};

test("verification template uses configurable neutral branding and a ten-minute OTP", () => {
  const message = verificationEmail(brand, "123456");
  assert.match(message.subject, /Example Platform/);
  assert.match(message.text, /123456/);
  assert.match(message.text, /10 minutes/);
  assert.doesNotMatch(message.text, /#verify=/);
  assert.doesNotMatch(message.text, /RENOVA/);
});

test("welcome template confirms activation without claiming provider delivery", () => {
  const message = welcomeEmail(brand);
  assert.match(message.subject, /Welcome to Example Platform/);
  assert.match(message.text, /account is active/);
  assert.match(message.text, /https:\/\/example\.test\/platform\/live/);
});

test("enquiry templates use the saved reference and neutral branding", () => {
  const acknowledgement = enquiryAcknowledgementEmail(brand, {
    name: "Society Contact",
    reference: "REQ-2026-ABC123",
  });
  const notification = adminEnquiryNotificationEmail(brand, {
    reference: "REQ-2026-ABC123",
    organizationName: "Example Society",
    source: "FEASIBILITY",
  });
  assert.match(acknowledgement.text, /REQ-2026-ABC123/);
  assert.match(acknowledgement.text, /received your enquiry/);
  assert.match(notification.text, /Example Society/);
  assert.match(notification.text, /FEASIBILITY/);
});

test("password reset template documents its one-hour expiry", () => {
  const message = passwordResetEmail(brand, "reset-token");
  assert.match(message.text, /#reset=reset-token/);
  assert.match(message.text, /1 hour/);
});

// Prompt K Task 3 — breach-notification templates (DRAFTS pending Indian
// privacy counsel review). Both render with a reference, a breach summary
// and contact details, and both are labelled as drafts.
test("breach notification to affected users renders reference, summary and contact, as a draft", () => {
  const message = breachNotificationUserEmail(brand, {
    reference: "BRCH-2026-0001",
    breachSummary: "TEST ONLY unauthorised access to the enquiry store",
    dataInvolved: "Names and email addresses from enquiries",
    whatToDo: "Watch for suspicious email and reset your password",
    contactEmail: "privacy@example.invalid",
  });
  assert.match(message.subject, /BRCH-2026-0001/);
  assert.match(message.text, /BRCH-2026-0001/);
  assert.match(message.text, /TEST ONLY unauthorised access/);
  assert.match(message.text, /Names and email addresses/);
  assert.match(message.text, /reset your password/);
  assert.match(message.text, /privacy@example\.invalid/);
  assert.match(message.text, /DRAFT/);
  assert.match(message.text, /pending Indian privacy counsel review/);
  assert.match(message.html, /DRAFT/);
});

test("breach notification to the Data Protection Board renders the 72-hour detailed report, as a draft", () => {
  const message = breachNotificationBoardEmail(brand, {
    reference: "BRCH-2026-0001",
    breachSummary: "TEST ONLY unauthorised access to the enquiry store",
    dataCategories: "Contact details and enquiry messages",
    approximatePeopleAffected: "Approximately 40 people",
    likelyConsequences:
      "TEST ONLY risk of phishing using names and email addresses",
    measuresTaken: "TEST ONLY access revoked and passwords rotated",
    contactEmail: "privacy@example.invalid",
  });
  assert.match(message.subject, /BRCH-2026-0001/);
  assert.match(message.text, /BRCH-2026-0001/);
  assert.match(message.text, /TEST ONLY unauthorised access/);
  assert.match(message.text, /Contact details and enquiry messages/);
  assert.match(message.text, /Approximately 40 people/);
  assert.match(message.text, /risk of phishing/);
  assert.match(message.text, /access revoked/);
  assert.match(message.text, /72 hours/);
  assert.match(message.text, /privacy@example\.invalid/);
  assert.match(message.text, /DRAFT/);
  assert.match(message.text, /pending Indian privacy counsel review/);
});

test("breach templates have no sending path: no code outside email.ts calls them", () => {
  const roots = [
    new URL("./", import.meta.url),
    new URL("../routes/", import.meta.url),
  ];
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (
        !/\.(ts|tsx|mjs|js)$/.test(entry) ||
        entry === "email.ts" ||
        entry === "email.test.ts"
      )
        continue;
      const source = readFileSync(path, "utf8");
      if (
        source.includes("breachNotificationUserEmail") ||
        source.includes("breachNotificationBoardEmail")
      )
        hits.push(path);
    }
  };
  for (const root of roots) walk(root.pathname);
  assert.deepEqual(hits, [], "breach templates must have no caller");
});
