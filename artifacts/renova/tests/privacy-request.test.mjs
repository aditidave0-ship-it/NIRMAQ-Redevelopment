import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRIVACY_REQUEST_ROUTE,
  buildPrivacyRequestPayload,
  privacyRequestNextSteps,
} from "../src/experience/privacy-request.ts";
import {
  PRIVACY_ADMIN_NEXT_STATUSES,
  privacyAdminNextStatuses,
  privacyRequestCanBeFulfilled,
} from "../src/platform/privacy-queue.ts";
import { getPageMeta } from "../src/experience/page-meta.ts";

const liveWorkspace = readFileSync(
  new URL("../src/platform/LiveWorkspace.tsx", import.meta.url),
  "utf8",
);
const privacyRequestPage = readFileSync(
  new URL("../src/experience/PrivacyRequestPage.tsx", import.meta.url),
  "utf8",
);
const privacyPages = readFileSync(
  new URL("../src/experience/PrivacyPages.tsx", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../src/experience/Header.tsx", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

// --- Prompt K Task 1: sign-up privacy + terms links -----------------------
test("Task 1: the register form and the role-selection screen both link /privacy and /terms", () => {
  // The consent line is one component, rendered in both modes.
  assert.match(
    liveWorkspace,
    /function PolicyConsentLine\(\) \{[^}]*By creating an account you agree to our/,
  );
  assert.match(liveWorkspace, /<Link href="\/privacy">Privacy Policy<\/Link>/);
  assert.match(liveWorkspace, /<Link href="\/terms">Terms of Use<\/Link>/);
  assert.equal(
    (liveWorkspace.match(/<PolicyConsentLine \/>/g) || []).length,
    2,
    "consent line renders once in mode === 'roles' and once in mode === 'register'",
  );
  // The register block keeps the closed-registration gate: the links are
  // present while submission is blocked.
  assert.match(liveWorkspace, /mode === "register" && !publicSignupEnabled/);
});

test("Task 1: the 18+ attestation checkbox is untouched", () => {
  assert.match(liveWorkspace, /name="ageAttestation"/);
  assert.match(
    liveWorkspace,
    /I confirm that I am 18 years of age or older and I am\s+creating a NIRMAQ account\./,
  );
  assert.match(
    liveWorkspace,
    /ageAttestation: form\.get\("ageAttestation"\) === "on"/,
  );
});

// --- Prompt K Task 2a: public privacy-request form -----------------------
test("Task 2a: the privacy-request payload mirrors the API contract", () => {
  assert.deepEqual(
    buildPrivacyRequestPayload({
      email: "  Requester@Example.Invalid ",
      type: "DELETION",
      details: "  Delete my data. ",
    }),
    {
      email: "requester@example.invalid",
      type: "DELETION",
      details: "Delete my data.",
    },
  );
  for (const type of ["ACCESS", "CORRECTION", "DELETION"])
    assert.equal(
      buildPrivacyRequestPayload({ email: "a@example.invalid", type }).type,
      type,
    );
  // Details are optional.
  assert.equal(
    buildPrivacyRequestPayload({ email: "a@example.invalid", type: "ACCESS" })
      .details,
    undefined,
  );
  assert.throws(
    () => buildPrivacyRequestPayload({ email: "not-an-email", type: "ACCESS" }),
    /valid email/,
  );
  assert.throws(
    () =>
      buildPrivacyRequestPayload({ email: "a@example.invalid", type: "ERASE" }),
    /Choose a request type/,
  );
  assert.throws(
    () =>
      buildPrivacyRequestPayload({
        email: "a@example.invalid",
        type: "ACCESS",
        details: "x",
      }),
    /at least 2 characters/,
  );
  assert.throws(
    () =>
      buildPrivacyRequestPayload({
        email: "a@example.invalid",
        type: "ACCESS",
        details: "x".repeat(2001),
      }),
    /2000 characters or fewer/,
  );
});

test("Task 2a: the confirmation copy never promises deletion from backups, logs or cache", () => {
  for (const status of ["IDENTITY_PENDING", "SUBMITTED"]) {
    const steps = privacyRequestNextSteps(status);
    assert.doesNotMatch(steps.body, /backup/i);
    assert.doesNotMatch(steps.body, /server log/i);
    assert.doesNotMatch(steps.body, /cache/i);
    assert.doesNotMatch(steps.body, /deleted from everywhere/i);
  }
  assert.match(
    privacyRequestNextSteps("IDENTITY_PENDING").body,
    /verification link/,
  );
  assert.match(
    privacyRequestNextSteps("SUBMITTED").body,
    /confirms what can be done after legal review/,
  );
});

test("Task 2a: the /privacy/request page is routed, linked and submitted to the existing API", () => {
  assert.equal(PRIVACY_REQUEST_ROUTE, "/privacy/request");
  assert.match(app, /pathname === "\/privacy\/request"/);
  assert.match(app, /PrivacyRequestPage/);
  assert.equal(
    getPageMeta("/privacy/request").title,
    "NIRMAQ | File a Privacy Request",
  );
  // Linked from the /privacy page and the footer, alongside Privacy.
  assert.match(
    privacyPages,
    /<Link href="\/privacy\/request">File a privacy request/,
  );
  assert.match(
    header,
    /<Link href="\/privacy\/request">Privacy request<\/Link>/,
  );
  // The page posts to the existing endpoint and shows the reference.
  assert.match(privacyRequestPage, /fetch\("\/api\/privacy\/requests"/);
  assert.match(
    privacyRequestPage,
    /Reference: <strong>\{submitted\.reference\}<\/strong>/,
  );
  assert.match(privacyRequestPage, /does not delete\s+anything by itself/);
});

// --- Prompt K Task 2b: Delete My Account entry ---------------------------
test("Task 2b: account settings file a verified DELETION request and delete nothing", () => {
  assert.match(
    liveWorkspace,
    /<DeleteAccountRequest email=\{account\.email\} \/>/,
  );
  assert.match(liveWorkspace, /Delete my account/);
  assert.match(liveWorkspace, /type: "DELETION"/);
  assert.match(liveWorkspace, /Filing this request does not delete anything/);
  assert.match(
    liveWorkspace,
    /Your account\s+stays usable until the request is fulfilled/,
  );
  // No delete call anywhere in the workspace: the request is a POST to the
  // privacy API, never a DELETE.
  assert.equal(
    (liveWorkspace.match(/method: "DELETE"/g) || []).length,
    0,
    "no DELETE request exists in the workspace",
  );
  assert.doesNotMatch(
    liveWorkspace,
    /\/users\/.*DELETE|deleteAccount|deleteUser/,
  );
});

// --- Prompt K Task 2d: admin privacy-request queue view ------------------
test("Task 2d: the admin queue offers only the API's legal next statuses", () => {
  assert.deepEqual(privacyAdminNextStatuses("SUBMITTED"), [
    "IN_REVIEW",
    "REJECTED",
    "CLOSED",
  ]);
  assert.deepEqual(privacyAdminNextStatuses("IN_REVIEW"), [
    "MORE_INFORMATION_REQUIRED",
    "FULFILLED",
    "REJECTED",
    "CLOSED",
  ]);
  assert.deepEqual(privacyAdminNextStatuses("IDENTITY_PENDING"), []);
  assert.deepEqual(privacyAdminNextStatuses("FULFILLED"), ["CLOSED"]);
  assert.deepEqual(privacyAdminNextStatuses("CLOSED"), []);
  assert.deepEqual(Object.keys(PRIVACY_ADMIN_NEXT_STATUSES).sort(), [
    "CLOSED",
    "FULFILLED",
    "IDENTITY_PENDING",
    "IN_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "REJECTED",
    "SUBMITTED",
  ]);
});

test("Task 2d: fulfilment is blocked while a hold is active", () => {
  assert.equal(
    privacyRequestCanBeFulfilled({ status: "IN_REVIEW", underHold: false }),
    true,
  );
  assert.equal(
    privacyRequestCanBeFulfilled({ status: "IN_REVIEW", underHold: true }),
    false,
  );
  assert.equal(
    privacyRequestCanBeFulfilled({ status: "SUBMITTED", underHold: false }),
    false,
  );
});

test("Task 2d: the queue view is admin-only in the workspace", () => {
  assert.match(
    liveWorkspace,
    /account\.role === "ADMIN" && view === "privacy-requests"/,
  );
  assert.match(liveWorkspace, /<AdminPrivacyQueue \/>/);
  assert.match(liveWorkspace, /\/admin\/privacy-requests/);
  assert.match(liveWorkspace, /Record a legal hold \(reason required\)/);
  assert.match(liveWorkspace, /Record a decision/);
  assert.match(liveWorkspace, /Record hold/);
  assert.match(liveWorkspace, /Release hold/);
});
