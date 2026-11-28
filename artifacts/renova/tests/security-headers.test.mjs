// Static check — Prompt H, Task 9.2.
//
// The frontend's security headers live in vercel.json (Vercel applies them;
// they cannot be tested by serving the bundle locally). This test asserts
// the configured headers are present and that the CSP's JSON-LD hash
// matches the actual <script type="application/ld+json"> block in
// index.html — if the block is edited without updating the hash, the
// browser would block it and this test fails first.
//
// The CSP is deliberately strict: no 'unsafe-inline' anywhere. The only
// inline script is the JSON-LD block (allowed by hash); styles come from
// the built CSS file plus Google Fonts (allowed explicitly until Prompt F
// self-hosts the fonts); images, video and API calls are same-origin.
// If a future change needs an inline script or style, add its hash here
// and in vercel.json together — do not loosen the policy to 'unsafe-inline'.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const vercelPath = path.resolve(testDirectory, "../vercel.json");
const indexPath = path.resolve(testDirectory, "../index.html");

test("vercel.json sets the security headers, with a CSP hash that matches index.html", async () => {
  const vercel = JSON.parse(await readFile(vercelPath, "utf8"));
  const rule = (vercel.headers ?? []).find(
    (entry) => entry.source === "/(.*)",
  );
  assert.ok(rule, "expected a /(.*) headers rule in vercel.json");
  const byKey = new Map(
    (rule.headers ?? []).map((header) => [header.key, header.value]),
  );
  assert.equal(
    byKey.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
  );
  assert.equal(byKey.get("X-Content-Type-Options"), "nosniff");
  assert.equal(byKey.get("X-Frame-Options"), "DENY");
  assert.equal(byKey.get("Referrer-Policy"), "no-referrer");
  const csp = byKey.get("Content-Security-Policy") ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  assert.match(
    csp,
    /font-src 'self' https:\/\/fonts\.googleapis\.com https:\/\/fonts\.gstatic\.com/,
  );
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /media-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.doesNotMatch(csp, /unsafe-eval/);

  // The JSON-LD block is the only inline script; its hash must match.
  const indexHtml = await readFile(indexPath, "utf8");
  const match = indexHtml.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s,
  );
  assert.ok(match, "expected the JSON-LD block in index.html");
  const hash = createHash("sha256")
    .update(match[1])
    .digest("base64");
  assert.ok(
    csp.includes(`'sha256-${hash}'`),
    `CSP must allow the JSON-LD hash 'sha256-${hash}'`,
  );
  assert.equal(
    indexHtml.match(/<script(?![^>]*src=)/g)?.length ?? 0,
    1,
    "the JSON-LD block must be the only inline script",
  );
});
