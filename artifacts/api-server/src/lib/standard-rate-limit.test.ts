import test from "node:test";

// Prompt L, Task 1 — the standard tier fails open ONLY when no database is
// configured. lib/db creates its pool at import time, so the env var must
// be deleted before importing the middleware (a dynamic import).
test("standard rate limit fails open only when no database is configured", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const { standardRateLimit } = await import("./standard-rate-limit");
    await new Promise<void>((resolve, reject) => {
      standardRateLimit(
        { ip: "203.0.113.9" } as never,
        {} as never,
        (error?: unknown) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
  // The promise above resolves only if next() was called with no error, so
  // reaching here proves the middleware failed open and the route's own 503
  // still answers.
});
