// Regression guard — Prompt H, Task 6.3.
//
// Fails if the production bundle ships a secret. Scans the built JS/CSS
// (and index.html) in dist/public for known secret patterns. Run after the
// production build (`vite build`); if dist/ is absent the test skips with a
// clear message instead of failing — the guard only has meaning on a build.
//
// The patterns are the same as the Task 6.1 sweep. Two of them are
// deliberately quoted-string-only (`"re_..."`, `"sk-..."`): an unquoted
// `re_` / `sk-` match in minified code is usually an identifier, not a key,
// while a real inlined key always appears as a string literal. A `VITE_`
// hit fails outright: no VITE_ variable is expected in the bundle at all
// (the only one in source, VITE_RENOVA_LIVE_WORKSPACE, is a boolean flag
// that Vite inlines as a value, so its name never reaches the bundle).
//
// If this test ever fails, do NOT just delete the string: a key that was
// committed must be rotated in its provider's dashboard first (gist
// attack 13), because deleting it from code does not remove it from git
// history. Report the file + pattern only — never print the matched value.
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(testDirectory, "../dist/public");

// [pattern, label] — the label is what the failure reports, never the value.
const SECRET_PATTERNS = [
  [/sk_live_/g, "sk_live_ (Stripe live key)"],
  [/sk_test_/g, "sk_test_ (Stripe test key)"],
  [/service_role/g, "service_role (Supabase service key)"],
  [/AKIA[0-9A-Z]{16}/g, "AKIA… (AWS access key)"],
  [/ghp_[A-Za-z0-9]{20,}/g, "ghp_… (GitHub token)"],
  [/sk-ant-/g, "sk-ant- (Anthropic key)"],
  [/VITE_[A-Z_]+/g, "VITE_… (client env variable)"],
  [/postgres(?:ql)?:\/\/[^\s"'`]+/g, "postgres:// (database URL)"],
  [/neon\.tech/g, "neon.tech (Neon host)"],
  [/api\.resend\.com/g, "api.resend.com (Resend endpoint)"],
  [/["']re_[A-Za-z0-9_]{20,}["']/g, '"re_…" (Resend key, quoted)'],
  [/["']sk-[A-Za-z0-9]{20,}["']/g, '"sk-…" (AI provider key, quoted)'],
];

async function builtFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await builtFiles(full)));
    else if (/\.(js|css|html)$/.test(entry.name)) files.push(full);
  }
  return files;
}

test("built assets contain no secret patterns", async (t) => {
  let distExists = true;
  try {
    await stat(distDirectory);
  } catch {
    distExists = false;
  }
  if (!distExists) {
    t.skip("production build not present — run `vite build` first");
    return;
  }
  const files = await builtFiles(distDirectory);
  assert.ok(files.length > 0, "expected built JS/CSS/HTML in dist/public");
  const hits = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    for (const [pattern, label] of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content))
        hits.push(`${path.relative(distDirectory, file)}: ${label}`);
    }
  }
  assert.deepEqual(hits, [], "secret patterns found in the built bundle");
});
