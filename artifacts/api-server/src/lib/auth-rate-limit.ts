import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { authRateLimits, type AppDb } from "@workspace/db";

export type AuthRateLimitAction =
  | "REGISTER"
  | "VERIFY_EMAIL"
  | "RESEND_VERIFICATION"
  | "FORGOT_PASSWORD"
  | "LOGIN"
  | "PRIVACY_REQUEST"
  | "PRIVACY_VERIFY"
  | "ENQUIRY_SUBMIT"
  | "ENQUIRY_SUBMIT_GLOBAL";

export type AuthRateLimitPolicy = {
  limit: number;
  windowMs: number;
};

// Single source of truth for every rate-limited action, including the
// Phase B privacy endpoints. authRateLimits.action is a varchar, so adding
// an action here needs no migration.
export const AUTH_RATE_LIMIT_POLICIES: Record<
  AuthRateLimitAction,
  AuthRateLimitPolicy
> = {
  REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  VERIFY_EMAIL: { limit: 10, windowMs: 10 * 60 * 1000 },
  RESEND_VERIFICATION: { limit: 3, windowMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { limit: 5, windowMs: 60 * 60 * 1000 },
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  PRIVACY_REQUEST: { limit: 5, windowMs: 60 * 60 * 1000 },
  PRIVACY_VERIFY: { limit: 10, windowMs: 10 * 60 * 1000 },
  // Prompt H, Task 5 — the public enquiry limit (F5). Two buckets, same
  // mechanism as the auth routes (see rateLimitAuthRequest in routes/auth.ts
  // and rateLimitPrivacyRequest in routes/privacy.ts):
  // - ENQUIRY_SUBMIT (per IP, 20/hour): one IP rotating email addresses
  //   can submit at most 20 enquiries an hour. The fingerprint cap (5/hour
  //   per IP+email, in routes/enquiries.ts) still applies on top of this.
  // - ENQUIRY_SUBMIT_GLOBAL (all IPs, 100/hour): caps what a distributed
  //   flood can trigger — each accepted enquiry creates 2 Resend emails.
  // Both numbers are chosen values for a pre-launch site whose real enquiry
  // volume is a handful a day; change them here (one place) if the volume
  // grows. The limits run BEFORE the enquiry transaction, so a rate-limited
  // request never creates an enquiry, a consent event or an email job.
  ENQUIRY_SUBMIT: { limit: 20, windowMs: 60 * 60 * 1000 },
  ENQUIRY_SUBMIT_GLOBAL: { limit: 100, windowMs: 60 * 60 * 1000 },
};

export function authRateLimitSubject(ip: string, email: string): string {
  return createHash("sha256")
    .update(`${ip.trim().toLowerCase()}|${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function rateLimitWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function enforceAuthRateLimit(
  database: AppDb,
  action: AuthRateLimitAction,
  subjectHash: string,
  policy: AuthRateLimitPolicy,
  now = new Date(),
): Promise<void> {
  const [bucket] = await database
    .insert(authRateLimits)
    .values({
      action,
      subjectHash,
      windowStartedAt: rateLimitWindowStart(now, policy.windowMs),
      requestCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        authRateLimits.action,
        authRateLimits.subjectHash,
        authRateLimits.windowStartedAt,
      ],
      set: {
        requestCount: sql`${authRateLimits.requestCount} + 1`,
        updatedAt: now,
      },
    })
    .returning({ requestCount: authRateLimits.requestCount });

  if ((bucket?.requestCount ?? policy.limit + 1) > policy.limit) {
    const error = new Error("Too many requests. Please try again later.");
    Object.assign(error, { status: 429, code: "RATE_LIMITED" });
    throw error;
  }
}
