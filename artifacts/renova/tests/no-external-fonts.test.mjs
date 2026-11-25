import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RENOVA = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(RENOVA, "src");
const FONTS_DIR = join(RENOVA, "public", "fonts");
const DIST = join(RENOVA, "dist");

/** External font hosts. One request to any of these sends the visitor's IP to Google before consent can be asked — the LG München I fact pattern (Prompt F, Risk 2). */
const EXTERNAL_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "googleapis.com"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function filesWithHost(dir, hosts) {
  if (!existsSync(dir)) return [];
  return walk(dir)
    .filter((path) => /\.(ts|tsx|css|html|js|mjs)$/.test(path))
    .filter((path) => {
      const text = readFileSync(path, "utf8");
      return hosts.some((host) => text.includes(host));
    });
}

test("no external font host is referenced anywhere in the site source", () => {
  const hits = [
    ...filesWithHost(SRC, EXTERNAL_FONT_HOSTS),
    ...filesWithHost(join(RENOVA, "public"), EXTERNAL_FONT_HOSTS).filter(
      (path) => !path.includes(`${"fonts"}/`),
    ),
  ];
  const indexHtml = join(RENOVA, "index.html");
  if (existsSync(indexHtml)) {
    const text = readFileSync(indexHtml, "utf8");
    if (EXTERNAL_FONT_HOSTS.some((host) => text.includes(host))) hits.push(indexHtml);
  }
  assert.deepEqual(
    hits,
    [],
    `External font hosts must never appear in source — self-host the fonts instead: ${hits.join(", ")}`,
  );
});

test("the three families are self-hosted: woff2 files exist and index.css points at them", () => {
  const expected = [
    "dm-sans-latin.woff2",
    "dm-sans-latin-ext.woff2",
    "dm-mono-400-latin.woff2",
    "dm-mono-400-latin-ext.woff2",
    "dm-mono-500-latin.woff2",
    "dm-mono-500-latin-ext.woff2",
    "playfair-display-latin.woff2",
    "playfair-display-latin-ext.woff2",
    "playfair-display-cyrillic.woff2",
    "playfair-display-vietnamese.woff2",
  ];
  for (const file of expected) {
    const path = join(FONTS_DIR, file);
    assert.ok(existsSync(path), `missing self-hosted font: public/fonts/${file}`);
    assert.ok(statSync(path).size > 1000, `font file suspiciously small: public/fonts/${file}`);
    assert.equal(readFileSync(path).subarray(0, 4).toString("latin1"), "wOF2");
  }
  const css = readFileSync(join(SRC, "index.css"), "utf8");
  assert.doesNotMatch(css, /@import[^;]*fonts\.googleapis/);
  assert.match(css, /@font-face/);
  for (const file of expected) {
    assert.ok(css.includes(`url(/fonts/${file})`), `index.css does not reference /fonts/${file}`);
  }
  // The variable families are declared once per subset with a weight range,
  // not once per weight — Google serves one variable file per subset.
  assert.match(css, /font-family: 'DM Sans';[\s\S]*?font-weight: 100 1000;/);
  assert.match(css, /font-family: 'Playfair Display';[\s\S]*?font-weight: 400 900;/);
});

test("built assets contain no external font host (runs when dist/ exists)", (t) => {
  if (!existsSync(DIST)) {
    t.skip("dist/ not built yet — run the production build to check the built assets");
    return;
  }
  const hits = filesWithHost(DIST, EXTERNAL_FONT_HOSTS);
  assert.deepEqual(
    hits,
    [],
    `Built assets must not reference an external font host: ${hits.join(", ")}`,
  );
  const builtCss = walk(join(DIST, "public", "assets")).filter((path) =>
    path.endsWith(".css"),
  );
  assert.ok(builtCss.length > 0, "expected built CSS in dist/public/assets");
  const cssText = builtCss.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.match(cssText, /url\(\/fonts\/dm-sans-latin\.woff2\)/);
});
