/**
 * Prompt K Task 2d — admin privacy-request queue view (team-only).
 *
 * Pure helpers for the AdminPrivacyQueue component in LiveWorkspace.tsx.
 * The status machine is the API's own: LEGAL_TRANSITIONS in
 * artifacts/api-server/src/lib/privacy-policy.ts — the UI offers only the
 * moves the server accepts (an illegal move is a 409), and fulfilment is
 * blocked while a hold is active (assertFulfillable). If the API ever
 * changes, this map must change with it; the integration test in
 * tests/privacy.integration.ts pins the server side.
 */

export type PrivacyRequestStatus =
  | "IDENTITY_PENDING"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "MORE_INFORMATION_REQUIRED"
  | "FULFILLED"
  | "REJECTED"
  | "CLOSED";

export type PrivacyRequestType = "ACCESS" | "CORRECTION" | "DELETION";

export type PrivacyRequestAdminRow = {
  id: string;
  reference: string;
  email: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  details: string | null;
  verificationStatus: "VERIFIED" | "PENDING" | "EXPIRED" | "NONE";
  verificationAttempts: number;
  underHold: boolean;
  holdReason: string | null;
  holdByUserId: string | null;
  requesterUserId: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
};

export type PrivacyRequestEvent = {
  id: string;
  actorUserId: string | null;
  actorType: string;
  action: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** Statuses an Admin may set directly (ADMIN_SETTABLE_STATUSES, API). */
export const PRIVACY_ADMIN_SETTABLE_STATUSES = [
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "FULFILLED",
  "REJECTED",
  "CLOSED",
] as const;

/** Legal next statuses from each current status (LEGAL_TRANSITIONS, API). */
export const PRIVACY_ADMIN_NEXT_STATUSES: Record<
  PrivacyRequestStatus,
  PrivacyRequestStatus[]
> = {
  IDENTITY_PENDING: [],
  SUBMITTED: ["IN_REVIEW", "REJECTED", "CLOSED"],
  IN_REVIEW: ["MORE_INFORMATION_REQUIRED", "FULFILLED", "REJECTED", "CLOSED"],
  MORE_INFORMATION_REQUIRED: ["IN_REVIEW", "REJECTED", "CLOSED"],
  FULFILLED: ["CLOSED"],
  REJECTED: ["CLOSED"],
  CLOSED: [],
};

export function privacyAdminNextStatuses(
  status: PrivacyRequestStatus,
): PrivacyRequestStatus[] {
  return PRIVACY_ADMIN_NEXT_STATUSES[status] ?? [];
}

/**
 * Fulfilment is a recorded Admin decision, not automated deletion — and a
 * request under a legal, financial or security hold can never be fulfilled
 * while the hold is active (assertFulfillable, API). The queue hides the
 * Fulfilled option while a hold is active instead of letting the Admin
 * hit the server's 409.
 */
export function privacyRequestCanBeFulfilled(
  request: Pick<PrivacyRequestAdminRow, "status" | "underHold">,
): boolean {
  return (
    privacyAdminNextStatuses(request.status).includes("FULFILLED") &&
    !request.underHold
  );
}

export const PRIVACY_REQUEST_STATUS_LABELS: Record<
  PrivacyRequestStatus,
  string
> = {
  IDENTITY_PENDING: "Identity pending",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  MORE_INFORMATION_REQUIRED: "More information required",
  FULFILLED: "Fulfilled",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};
