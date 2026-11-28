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
  // Prompt L — standard (non-auth) tier and feasibility quotas. Adding an
  // action here needs no migration (authRateLimits.action is a varchar).
  | "STANDARD_REQUEST"
  | "STANDARD_REQUEST_GLOBAL"
  | "FEASIBILITY_CREATE"
  | "FEASIBILITY_DOCUMENT"
  | "RESET_PASSWORD";

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
  // Prompt L — standard (non-auth) tier and feasibility quotas. The numbers
  // are chosen values for a pre-launch site whose real traffic is a handful
  // of requests a day; change them here (one place) if the volume grows.
  // - STANDARD_REQUEST (per IP, 100/min): the Reel's standard tier. A human
  //   session makes a few dozen requests a minute at most; 100/min bounds a
  //   single-IP flood to 100 DB writes a minute.
  // - STANDARD_REQUEST_GLOBAL (all IPs, 1000/min): 10x the per-IP tier.
  //   Bounds a distributed flood; legitimate traffic never reaches it.
  // - FEASIBILITY_CREATE (per society, 5/day; per IP, 50/day): a society
  //   creates a feasibility request once per redevelopment cycle — 5 a day
  //   is far above any legitimate need. The per-IP bucket is 10x, same
  //   pattern as the auth actions.
  // - FEASIBILITY_DOCUMENT (per request, 20/day): burst protection for
  //   uploads. The hard cap is the same number (20 documents per request),
  //   enforced by a count check in routes/feasibility.ts — the bucket bounds
  //   bursts, the count check is the cap.
  // - RESET_PASSWORD (per token, 5/hr; per IP, 50/hr): the token is 32–256
  //   chars so brute force is infeasible; the limit bounds token-guessing
  //   floods and DB load. A legitimate user uses one link once.
  STANDARD_REQUEST: { limit: 100, windowMs: 60 * 1000 },
  STANDARD_REQUEST_GLOBAL: { limit: 1000, windowMs: 60 * 1000 },
  FEASIBILITY_CREATE: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
  FEASIBILITY_DOCUMENT: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
  RESET_PASSWORD: { limit: 5, windowMs: 60 * 60 * 1000 },
};

export function authRateLimitSubject(ip: string, email: string): string {
  return createHash("sha256")
    .update(`${ip.trim().toLowerCase()}|${email.trim().toLowerCase()}`)
    .digest("hex");
}

export function rateLimitWindowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

// Single construction site for the 429 refusal, so every limiter answers
// with the same generic body ("Too many requests. Please try again later.")
// and no limiter invents its own wording.
export function tooManyRequestsError(): Error & {
  status: number;
  code: string;
} {
  const error = new Error("Too many requests. Please try again later.");
  Object.assign(error, { status: 429, code: "RATE_LIMITED" });
  return error as Error & { status: number; code: string };
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
    throw tooManyRequestsError();
  }
}
