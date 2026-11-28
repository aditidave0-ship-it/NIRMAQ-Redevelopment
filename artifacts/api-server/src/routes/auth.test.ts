import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import authRouter from "./auth";
import app from "../renova-app";

test("the complete verification and password recovery API surface is registered", () => {
  const paths = new Set(
    (
      authRouter as unknown as { stack: Array<{ route?: { path: string } }> }
    ).stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => Boolean(path)),
  );
  for (const path of [
    "/auth/register",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/login",
    "/auth/logout",
    "/auth/me",
  ])
    assert.equal(paths.has(path), true, `${path} should be registered`);
});

test("a forced server error returns a generic message, never a stack trace", async () => {
  // Prompt H, Task 7.1: debug mode is off and error pages are generic.
  // The DB pool is created at module load (lib/db/src/index.ts), so the
  // dead-host DATABASE_URL must be set BEFORE the app is imported — this
  // test therefore runs the app in a child process with the env preset,
  // then forces a raw connection error through registration and records
  // the response. The child prints one JSON line: { status, body }.
  const { execFile } = await import("node:child_process");
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const apiServerDirectory = new URL("../..", import.meta.url).pathname;
  const childCode = `
    import { createServer } from "node:http";
    import app from ${JSON.stringify(`${apiServerDirectory}src/renova-app.ts`)};
    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const response = await fetch(
      "http://127.0.0.1:" + address.port + "/api/auth/register",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-renova-registration-test": "TEST-ONLY-local-registration",
        },
        body: JSON.stringify({
          email: "forced-error@example.invalid",
          password: "test-password-valid",
          displayName: "TEST ONLY forced error",
          participantType: "SOCIETY",
          organizationName: "TEST ONLY forced error",
          ageAttestation: true,
        }),
      },
    );
    console.log(JSON.stringify({ status: response.status, body: await response.json() }));
    server.close();
  `;
  // The child runs from a temp file (not -e: --input-type conflicts with
  // the tsx loader). It is deleted after the test.
  const folder = await mkdtemp(join(tmpdir(), "renova-forced-error-"));
  const childFile = join(folder, "server.mjs");
  await writeFile(childFile, childCode);
  let output: string;
  try {
    output = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        ["--import", "tsx", childFile],
        {
          cwd: apiServerDirectory,
          env: {
            ...process.env,
            DATABASE_URL:
              "postgres://127.0.0.1:1/renova-test-unreachable",
            DATABASE_URL_UNPOOLED:
              "postgres://127.0.0.1:1/renova-test-unreachable",
            RENOVA_EMAIL_PROVIDER: "resend",
            RESEND_API_KEY: "TEST-ONLY-no-real-provider-key",
            RENOVA_REGISTRATION_TEST_TOKEN: "TEST-ONLY-local-registration",
            RENOVA_APP_URL: "https://qa.example.invalid",
            RENOVA_EMAIL_FROM: "TEST ONLY <no-mail@example.invalid>",
            // Registration issues the email OTP before touching the database.
            RENOVA_AUTH_TOKEN_SECRET:
              "TEST-ONLY-otp-secret-at-least-thirty-two-characters",
          },
          timeout: 30_000,
        },
        (error, stdout, stderr) => {
          if (error)
            reject(new Error(`forced-error server failed: ${stderr}`));
          else resolve(stdout.trim());
        },
      );
    });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  // The child also prints pino log lines to stdout, so take the one line
  // that is the JSON result (it starts with {"status":).
  const resultLine = output
    .split("\n")
    .find((line) => line.startsWith('{"status":'));
  assert.ok(resultLine, "forced-error server must print a JSON result line");
  const { status, body } = JSON.parse(resultLine) as {
    status: number;
    body: Record<string, unknown>;
  };
  assert.equal(status, 500);
  assert.deepEqual(body, { error: "Internal server error" });
  assert.equal("stack" in body, false);
});

test("an oversized request body is rejected generically, not with a stack trace", async () => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Over the 256kb JSON body limit (renova-app.ts), so express.json
        // rejects the request with 413 before any route runs.
        body: JSON.stringify({ padding: "x".repeat(300_000) }),
      },
    );
    assert.equal(response.status, 413);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(body, { error: "Request body is too large" });
    assert.equal("stack" in body, false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("CORS allows only the origins in CORS_ORIGINS, with credentials", async () => {
  // Prompt H, Task 9.1. The allow-list is evaluated per request, so the
  // test can set it. A listed origin gets Access-Control-Allow-Origin +
  // credentials; an unlisted origin gets no CORS headers at all (no `*`,
  // no reflected Origin); with CORS_ORIGINS empty, nothing is allowed.
  const previous = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = "https://qa.example.invalid";
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/healthz`;
    const listed = await fetch(base, {
      headers: { Origin: "https://qa.example.invalid" },
    });
    assert.equal(listed.status, 200);
    assert.equal(
      listed.headers.get("access-control-allow-origin"),
      "https://qa.example.invalid",
    );
    assert.equal(
      listed.headers.get("access-control-allow-credentials"),
      "true",
    );
    const unlisted = await fetch(base, {
      headers: { Origin: "https://evil.example.invalid" },
    });
    assert.equal(unlisted.status, 200);
    assert.equal(unlisted.headers.get("access-control-allow-origin"), null);
    assert.equal(
      unlisted.headers.get("access-control-allow-credentials"),
      null,
    );
    delete process.env.CORS_ORIGINS;
    const closed = await fetch(base, {
      headers: { Origin: "https://qa.example.invalid" },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (previous === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previous;
  }
});

test("API responses carry the security headers", async () => {
  // Prompt H, Task 9.2: Strict-Transport-Security, nosniff, DENY,
  // Referrer-Policy and a restrictive CSP on every /api response.
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/healthz`,
    );
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("strict-transport-security"),
      "max-age=31536000; includeSubDomains",
    );
    assert.equal(
      response.headers.get("x-content-type-options"),
      "nosniff",
    );
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(
      response.headers.get("referrer-policy"),
      "no-referrer",
    );
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; frame-ancestors 'none'",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("public registration stays closed without both release flags", async () => {
  const previousOpen = process.env.RENOVA_REGISTRATION_OPEN;
  const previousApproved = process.env.RENOVA_BETA_RELEASE_APPROVED;
  const previousProvider = process.env.RENOVA_EMAIL_PROVIDER;
  delete process.env.RENOVA_REGISTRATION_OPEN;
  delete process.env.RENOVA_BETA_RELEASE_APPROVED;
  delete process.env.RENOVA_EMAIL_PROVIDER;
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Registration is not open yet",
    });
    const forgotResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/auth/forgot-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "release-check@example.invalid" }),
      },
    );
    assert.equal(forgotResponse.status, 503);
    assert.deepEqual(await forgotResponse.json(), {
      error: "Account email verification is not configured yet",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    if (previousOpen === undefined) delete process.env.RENOVA_REGISTRATION_OPEN;
    else process.env.RENOVA_REGISTRATION_OPEN = previousOpen;
    if (previousApproved === undefined)
      delete process.env.RENOVA_BETA_RELEASE_APPROVED;
    else process.env.RENOVA_BETA_RELEASE_APPROVED = previousApproved;
    if (previousProvider === undefined)
      delete process.env.RENOVA_EMAIL_PROVIDER;
    else process.env.RENOVA_EMAIL_PROVIDER = previousProvider;
  }
});
