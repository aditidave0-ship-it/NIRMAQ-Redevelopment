/**
 * Prompt K Task 2a — in-product privacy-request flow (request path only).
 *
 * Pure helpers for the public /privacy/request form. They mirror the API
 * contract in artifacts/api-server/src/routes/privacy.ts
 * (privacyRequestSubmitSchema) so the form rejects the same input the
 * server would — but the server stays the authority: nothing here changes
 * submission logic, rate limiting, duplicate protection or the token flow.
 *
 * The copy rules are part of the contract: a request files a verified
 * request for the NIRMAQ team to review. It never promises deletion from
 * backups, server logs or cache — the team confirms the scope after legal
 * review (Aditi, 27 Nov 2026, Option A).
 */

export const PRIVACY_REQUEST_TYPES = [
  "ACCESS",
  "CORRECTION",
  "DELETION",
] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_TYPE_LABELS: Record<PrivacyRequestType, string> = {
  ACCESS: "Access — see the personal data NIRMAQ holds about me",
  CORRECTION: "Correction — correct personal data NIRMAQ holds about me",
  DELETION: "Deletion — ask NIRMAQ to delete my personal data",
};

export const PRIVACY_REQUEST_ROUTE = "/privacy/request";

export type PrivacyRequestInput = {
  email: string;
  type: string;
  details?: string;
};

export type PrivacyRequestPayload = {
  email: string;
  type: PrivacyRequestType;
  details?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate + normalise a privacy-request form submission. Throws an Error
 * with a plain-language message the form can show. Mirrors the server
 * schema: email (trimmed, lowercased, max 320), type (one of the three),
 * details (optional, 2–2000 chars when given).
 */
export function buildPrivacyRequestPayload(
  input: PrivacyRequestInput,
): PrivacyRequestPayload {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Enter your email address.");
  if (email.length > 320 || !EMAIL_PATTERN.test(email))
    throw new Error("Enter a valid email address.");
  if (!PRIVACY_REQUEST_TYPES.includes(input.type as PrivacyRequestType))
    throw new Error("Choose a request type: Access, Correction or Deletion.");
  const details = input.details?.trim();
  if (details !== undefined && details !== "" && details.length < 2)
    throw new Error("Details need at least 2 characters when given.");
  if (details !== undefined && details.length > 2000)
    throw new Error("Details must be 2000 characters or fewer.");
  return {
    email,
    type: input.type as PrivacyRequestType,
    ...(details ? { details } : {}),
  };
}

/** What the confirmation screen tells the requester, by request status. */
export function privacyRequestNextSteps(status: string): {
  heading: string;
  body: string;
} {
  if (status === "IDENTITY_PENDING")
    return {
      heading: "Check your email to verify this request.",
      body: "We sent a verification link to your email address — it expires in 1 hour. Once verified, your request goes to the NIRMAQ team for review, and you can check its status with the link in that email.",
    };
  return {
    heading: "Your request has been submitted.",
    body: "The NIRMAQ team reviews your request and confirms what can be done after legal review. Keep your reference number — quote it if you contact us about this request.",
  };
}
