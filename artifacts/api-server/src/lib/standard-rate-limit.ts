import type { NextFunction, Request, Response } from "express";
import { requireDb, type AppDb } from "@workspace/db";
import {
  authRateLimitSubject,
  enforceAuthRateLimit,
  AUTH_RATE_LIMIT_POLICIES,
} from "./auth-rate-limit";

// Prompt L, Task 1 — the standard (non-auth) tier.
//
// Every /api request except the health probes passes through this limiter,
// on top of whatever per-action limit its route already has. Two buckets,
// same DB-backed mechanism as the auth routes (see lib/auth-rate-limit.ts):
// - STANDARD_REQUEST, per IP, 100/min — the Reel's standard tier.
// - STANDARD_REQUEST_GLOBAL, all IPs, 1000/min — bounds a distributed
//   flood that rotates IPs. A limited request never reaches its handler,
//   so it can never create a record, a job, an email, or a Blob object.
//
// The health probes (/healthz, /readyz) are mounted BEFORE this middleware
// in routes/index.ts, so readiness still answers when the database is down.
// Auth routes keep their own per-action limits; this tier sits on top of
// them (100/min per IP is far above the auth per-IP buckets, so it never
// binds before them for legitimate use).
export async function rateLimitStandardRequest(
  database: AppDb,
  request: { ip?: string },
): Promise<void> {
  await enforceAuthRateLimit(
    database,
    "STANDARD_REQUEST",
    authRateLimitSubject(request.ip || "unknown", "*"),
    AUTH_RATE_LIMIT_POLICIES.STANDARD_REQUEST,
  );
  await enforceAuthRateLimit(
    database,
    "STANDARD_REQUEST_GLOBAL",
    authRateLimitSubject("global", "standard"),
    AUTH_RATE_LIMIT_POLICIES.STANDARD_REQUEST_GLOBAL,
  );
}

export function standardRateLimit(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  let database: AppDb;
  try {
    database = requireDb();
  } catch (error) {
    // Fail open ONLY when no database is configured: without a DB the API is
    // already non-functional and each route reports its own 503; the limiter
    // must not mask those errors (and must not break the no-DB unit tests,
    // e.g. the registration-closed test, which expects the route's own 503).
    // Any other failure (e.g. the DB is configured but down) still
    // propagates, so a mid-outage request fails loudly instead of slipping
    // past the limiter uncounted.
    if (
      error instanceof Error &&
      error.message === "DATABASE_URL is not configured"
    ) {
      next();
      return;
    }
    next(error);
    return;
  }
  rateLimitStandardRequest(database, request).then(
    () => next(),
    (error: unknown) => next(error),
  );
}
